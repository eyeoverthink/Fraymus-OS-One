export const GROUND = [16, 16, 20, 255];
const BLACK = [0, 0, 0, 255];
const CYAN = [0, 255, 255, 255];

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function l1(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function idx(x, y, width) {
  return (y * width + x) * 4;
}

function read(data, x, y, width) {
  const i = idx(x, y, width);
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function paint(data, x, y, width, color) {
  const i = idx(x, y, width);
  data[i] = color[0];
  data[i + 1] = color[1];
  data[i + 2] = color[2];
  data[i + 3] = color[3] ?? 255;
}

function luminance(color) {
  return (color[0] + color[1] + color[2]) / 3;
}

function saturation(color) {
  return Math.max(color[0], color[1], color[2]) - Math.min(color[0], color[1], color[2]);
}

function isSkin(color) {
  const [r, g, b] = color;
  return r > 75 && g > 40 && b > 25 && r > g + 6 && r > b + 10 && r < 235 && r - g < 95;
}

function patch(image, x, y, radius) {
  const colors = [];
  for (let yy = Math.max(0, y - radius); yy <= Math.min(image.height - 1, y + radius); yy += 2) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(image.width - 1, x + radius); xx += 2) {
      colors.push(read(image.data, xx, yy, image.width));
    }
  }
  const mean = [0, 0, 0];
  colors.forEach((color) => {
    mean[0] += color[0];
    mean[1] += color[1];
    mean[2] += color[2];
  });
  mean[0] /= colors.length;
  mean[1] /= colors.length;
  mean[2] /= colors.length;
  const deviation = colors.reduce((sum, color) => sum + l1(color, mean), 0) / colors.length;
  return { mean, deviation };
}

function flood(width, height, start, allow) {
  const mask = new Uint8Array(width * height);
  const stack = [];
  start.forEach((at) => {
    if (mask[at] || !allow(at)) return;
    mask[at] = 1;
    stack.push(at);
  });
  while (stack.length) {
    const at = stack.pop();
    const x = at % width;
    const y = Math.floor(at / width);
    const neighbors = [at + 1, at - 1, at + width, at - width];
    if (x === 0) neighbors[1] = -1;
    if (x === width - 1) neighbors[0] = -1;
    neighbors.forEach((next) => {
      if (next < 0 || next >= mask.length || mask[next] || !allow(next)) return;
      mask[next] = 1;
      stack.push(next);
    });
  }
  return mask;
}

function largest(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  let best = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || seen[i]) continue;
    const stack = [i];
    const comp = [];
    seen[i] = 1;
    while (stack.length) {
      const at = stack.pop();
      comp.push(at);
      const x = at % width;
      const y = Math.floor(at / width);
      const neighbors = [];
      if (x > 0) neighbors.push(at - 1);
      if (x < width - 1) neighbors.push(at + 1);
      if (y > 0) neighbors.push(at - width);
      if (y < height - 1) neighbors.push(at + width);
      neighbors.forEach((next) => {
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      });
    }
    if (comp.length > best.length) best = comp;
  }
  const out = new Uint8Array(mask.length);
  best.forEach((at) => { out[at] = 1; });
  return out;
}

function fillHoles(mask, width, height) {
  const outside = flood(width, height, borderPixels(width, height).filter((at) => !mask[at]), (at) => !mask[at]);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) out[i] = outside[i] ? 0 : 1;
  return out;
}

function borderPixels(width, height) {
  const seeds = [];
  for (let x = 0; x < width; x += 1) {
    seeds.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    seeds.push(y * width, y * width + width - 1);
  }
  return seeds;
}

function flatBackdrop(image, tolerance) {
  const { width, height, data } = image;
  const radius = Math.max(6, Math.round(Math.min(width, height) * 0.06));
  const spots = [
    [radius, radius],
    [width - 1 - radius, radius],
    [radius, height - 1 - radius],
    [width - 1 - radius, height - 1 - radius]
  ];
  const seeds = spots
    .map(([x, y]) => patch(image, x, y, radius))
    .filter((corner) => corner.deviation < 64)
    .map((corner) => corner.mean);
  if (seeds.length < 3) return null;
  const limit = Math.max(28, tolerance) * 1.15;
  const near = (at) => {
    const color = read(data, at % width, Math.floor(at / width), width);
    return seeds.some((seed) => l1(color, seed) <= limit);
  };
  const background = flood(width, height, borderPixels(width, height).filter(near), near);
  let kept = 0;
  for (let i = 0; i < background.length; i += 1) if (!background[i]) kept += 1;
  const ratio = kept / background.length;
  if (ratio < 0.1 || ratio > 0.86) return null;
  const subject = new Uint8Array(background.length);
  for (let i = 0; i < background.length; i += 1) subject[i] = background[i] ? 0 : 1;
  return fillHoles(subject, width, height);
}

function portraitBackdrop(image, tolerance) {
  const { width, height, data } = image;
  const skin = new Uint8Array(width * height);
  const allowed = new Uint8Array(width * height);
  const roomLum = Math.max(96, 176 - tolerance);
  let skinCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = read(data, x, y, width);
      const at = y * width + x;
      const lum = luminance(color);
      const sat = saturation(color);
      const room = lum > Math.max(roomLum, 168) && sat < 36;
      if (isSkin(color)) {
        skin[at] = 1;
        allowed[at] = 1;
        skinCount += 1;
      } else if (!room) {
        allowed[at] = 1;
      }
    }
  }
  if (skinCount / skin.length < 0.012) return null;
  const seeds = [];
  for (let i = 0; i < skin.length; i += 1) if (skin[i]) seeds.push(i);
  const grown = flood(width, height, seeds, (at) => allowed[at]);
  const face = largest(skin, width, height);
  const xs = [];
  const ys = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!face[y * width + x]) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  const column = new Array(width).fill(0);
  const row = new Array(height).fill(0);
  xs.forEach((x) => { column[x] += 1; });
  ys.forEach((y) => { row[y] += 1; });
  const dense = (hist, portion) => {
    const peak = Math.max(...hist, 1);
    const hits = [];
    hist.forEach((value, index) => {
      if (value >= peak * portion) hits.push(index);
    });
    return hits.length ? [hits[0], hits[hits.length - 1]] : [0, 0];
  };
  const [minX, maxX] = dense(column, 0.34);
  const [minY, maxY] = dense(row, 0.28);
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const x0 = Math.max(0, Math.floor(minX - boxW * 0.22));
  const x1 = Math.min(width - 1, Math.ceil(maxX + boxW * 0.22));
  const y0 = Math.max(0, Math.floor(minY - boxH * 0.9));
  const y1 = Math.min(height - 1, Math.ceil(maxY + boxH * 1.35));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (!grown[at]) continue;
      if (x < x0 || x > x1 || y < y0 || y > y1) {
        grown[at] = 0;
        continue;
      }
      const color = read(data, x, y, width);
      const lum = luminance(color);
      if (!isSkin(color) && lum > 112 && saturation(color) < 42 && y < maxY - boxH * 0.15) grown[at] = 0;
      const edge = x < x0 + boxW * 0.16 || x > x1 - boxW * 0.16;
      if (edge && y < maxY && lum > 88 && !isSkin(color)) grown[at] = 0;
    }
  }
  const subject = fillHoles(largest(grown, width, height), width, height);
  let kept = 0;
  for (let i = 0; i < subject.length; i += 1) kept += subject[i];
  const ratio = kept / subject.length;
  if (ratio < 0.08 || ratio > 0.86) return null;
  return subject;
}

function weightedLuma(color) {
  return color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
}

function inversionValue(color) {
  return 255 - weightedLuma(color);
}

function reverseZ(color) {
  return clamp(255 - weightedLuma(color) * 0.5 - 64);
}

function depthBackdrop(image) {
  const { width, height, data } = image;
  const far = (at) => {
    const color = read(data, at % width, Math.floor(at / width), width);
    return weightedLuma(color) > 112 && saturation(color) < 48 && reverseZ(color) < 132;
  };
  const seeds = [];
  for (let x = 0; x < width; x += 1) {
    if (far(x)) seeds.push(x);
  }
  const side = Math.floor(height * 0.62);
  for (let y = 0; y < side; y += 1) {
    const left = y * width;
    const right = left + width - 1;
    if (far(left)) seeds.push(left);
    if (far(right)) seeds.push(right);
  }
  if (seeds.length < 8) return null;
  const background = flood(width, height, seeds, far);
  const subject = new Uint8Array(background.length);
  let kept = 0;
  for (let i = 0; i < background.length; i += 1) {
    subject[i] = background[i] ? 0 : 1;
    kept += subject[i];
  }
  const ratio = kept / subject.length;
  if (ratio < 0.12 || ratio > 0.9) return null;
  return fillHoles(subject, width, height);
}

function peelBright(image, subject) {
  const { width, height, data } = image;
  const open = (at) => {
    if (!subject[at]) return true;
    const color = read(data, at % width, Math.floor(at / width), width);
    if (isSkin(color)) return false;
    return weightedLuma(color) > 140 && saturation(color) < 48;
  };
  const reached = flood(width, height, borderPixels(width, height).filter(open), open);
  const box = faceBox(image, subject);
  const limit = box ? Math.max(0, box.minY - 6) : Math.round(height * 0.32);
  const out = subject.slice();
  for (let y = 0; y < limit; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!reached[y * width + x] || !subject[y * width + x]) continue;
      out[y * width + x] = 0;
    }
  }
  if (box) {
    const hat = Math.max(0, box.minY - 2);
    for (let y = 0; y < hat; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        if (!out[at]) continue;
        if (weightedLuma(read(data, x, y, width)) > 78) out[at] = 0;
      }
    }
  }
  const peeled = fillHoles(dropSpecks(out, width, height), width, height);
  let kept = 0;
  for (let i = 0; i < peeled.length; i += 1) kept += peeled[i];
  if (kept / peeled.length < 0.08) return subject;
  return peeled;
}

function dropSpecks(mask, width, height) {
  const minSize = Math.max(48, Math.round(mask.length * 0.004));
  const seen = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || seen[i]) continue;
    const stack = [i];
    const comp = [];
    seen[i] = 1;
    while (stack.length) {
      const at = stack.pop();
      comp.push(at);
      const x = at % width;
      const y = Math.floor(at / width);
      const neighbors = [];
      if (x > 0) neighbors.push(at - 1);
      if (x < width - 1) neighbors.push(at + 1);
      if (y > 0) neighbors.push(at - width);
      if (y < height - 1) neighbors.push(at + width);
      neighbors.forEach((next) => {
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      });
    }
    if (comp.length >= minSize) comp.forEach((at) => { out[at] = 1; });
  }
  return out;
}

function subjectMask(image, tolerance) {
  const mask = flatBackdrop(image, tolerance)
    || portraitBackdrop(image, tolerance)
    || depthBackdrop(image)
    || new Uint8Array(image.width * image.height).fill(1);
  return trimSides(image, peelBright(image, mask));
}

export function buildSubjectMask(image, tolerance) {
  return subjectMask(image, tolerance);
}

export function brushMask(mask, width, height, x, y, radius, value) {
  const r = Math.max(1, radius);
  const bit = value ? 1 : 0;
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(width - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(height - 1, Math.ceil(y + r));
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      if ((xx - x) * (xx - x) + (yy - y) * (yy - y) > r * r) continue;
      mask[yy * width + xx] = bit;
    }
  }
  return mask;
}

export function traceCut(image, mask, points, radius) {
  const { width, height, data } = image;
  const seeds = [];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  const stamp = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const color = read(data, x, y, width);
    const at = y * width + x;
    mask[at] = 0;
    seeds.push(at);
    if (isSkin(color)) return;
    sr += color[0];
    sg += color[1];
    sb += color[2];
    count += 1;
  };
  points.forEach(([px, py]) => {
    const r = Math.max(1, radius);
    for (let y = Math.floor(py - r); y <= py + r; y += 1) {
      for (let x = Math.floor(px - r); x <= px + r; x += 1) {
        if ((x - px) * (x - px) + (y - py) * (y - py) > r * r) continue;
        stamp(Math.round(x), Math.round(y));
      }
    }
  });
  if (!count) return mask;
  const mean = [sr / count, sg / count, sb / count];
  const dist = new Uint16Array(mask.length);
  const queue = [];
  seeds.forEach((at) => {
    if (dist[at]) return;
    dist[at] = 1;
    queue.push(at);
  });
  let head = 0;
  while (head < queue.length) {
    const at = queue[head];
    head += 1;
    const depth = dist[at];
    if (depth > 22) continue;
    const x = at % width;
    const y = Math.floor(at / width);
    [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const next = ny * width + nx;
      if (dist[next]) return;
      const color = read(data, nx, ny, width);
      if (isSkin(color) || l1(color, mean) > 46) return;
      mask[next] = 0;
      dist[next] = depth + 1;
      queue.push(next);
    });
  }
  return mask;
}

function faceDetailBand(image) {
  const { width, height, data } = image;
  const x0 = Math.round(width * 0.28);
  const x1 = Math.round(width * 0.72);
  const rows = new Array(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let grad = 0;
    let n = 0;
    for (let x = x0; x < x1 - 2; x += 2) {
      const i = (y * width + x) * 4;
      const j = (y * width + (x + 2)) * 4;
      grad += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
      n += 1;
    }
    rows[y] = n ? grad / n : 0;
  }
  let best = null;
  let start = -1;
  for (let y = 0; y <= height; y += 1) {
    const hot = y < height && rows[y] > 20;
    if (hot && start < 0) start = y;
    if (!hot && start >= 0) {
      if (y - start > 24 && (!best || y - start > best.end - best.start)) best = { start, end: y };
      start = -1;
    }
  }
  return best;
}

function faceBox(image, mask) {
  const { width, height, data } = image;
  const column = new Array(width).fill(0);
  const row = new Array(height).fill(0);
  const yLimit = Math.round(height * 0.62);
  for (let y = 0; y < yLimit; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x] || !isSkin(read(data, x, y, width))) continue;
      column[x] += 1;
      row[y] += 1;
    }
  }
  const dense = (hist, portion) => {
    const peak = Math.max(...hist, 1);
    const hits = [];
    hist.forEach((value, index) => {
      if (value >= peak * portion) hits.push(index);
    });
    if (hits.length < 2) return null;
    return [hits[0], hits[hits.length - 1]];
  };
  const across = dense(column, 0.34);
  const down = dense(row, 0.28);
  if (!across || !down) return null;
  return { minX: across[0], maxX: across[1], minY: down[0], maxY: down[1] };
}

function cutBars(image, mask) {
  const { width, height, data } = image;
  const box = faceBox(image, mask);
  if (!box) return mask;
  const out = mask.slice();
  const pad = Math.round((box.maxX - box.minX) * 0.06);
  const leftOf = box.minX - pad;
  const rightOf = box.maxX + pad;
  const shoulder = box.maxY;
  const colors = [];
  for (let y = 0; y <= shoulder; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= leftOf && x <= rightOf) continue;
      if (!out[y * width + x]) continue;
      colors.push(read(data, x, y, width));
      out[y * width + x] = 0;
    }
  }
  if (colors.length < 12) return out;
  const mean = [0, 0, 0];
  colors.forEach((color) => {
    mean[0] += color[0];
    mean[1] += color[1];
    mean[2] += color[2];
  });
  mean[0] /= colors.length;
  mean[1] /= colors.length;
  mean[2] /= colors.length;
  const faceTop = box.minY;
  const faceMid = box.minY + (box.maxY - box.minY) * 0.55;
  for (let y = faceTop; y < Math.min(shoulder, faceMid); y += 1) {
    for (let x = leftOf; x <= rightOf; x += 1) {
      const at = y * width + x;
      if (!out[at]) continue;
      const color = read(data, x, y, width);
      if (l1(color, mean) <= 40) out[at] = 0;
    }
  }
  return out;
}

export function liftMask(image, mask, steps) {
  const { width, height, data } = image;
  const out = mask.slice();
  const box = faceBox(image, out);
  const rounds = Math.max(0, Math.min(4, steps));
  const protectedSkin = (x, y) => {
    if (!box || !isSkin(read(data, x, y, width))) return false;
    const padX = Math.round((box.maxX - box.minX) * 0.08);
    const padY = Math.round((box.maxY - box.minY) * 0.12);
    return x >= box.minX - padX && x <= box.maxX + padX && y >= box.minY - padY && y <= box.maxY + padY;
  };
  for (let step = 0; step < rounds; step += 1) {
    const kill = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        if (!out[at] || protectedSkin(x, y)) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
          || !out[at - 1] || !out[at + 1] || !out[at - width] || !out[at + width];
        if (edge) kill.push(at);
      }
    }
    kill.forEach((at) => { out[at] = 0; });
  }
  return fillHoles(rounds >= 1 ? trimSides(image, cutBars(image, out)) : out, width, height);
}

export function portraitPhoto(image, mask) {
  const window = portraitWindow(image, mask);
  if (!window) return image;
  const { left, top, size } = window;
  const { data, width } = image;
  const next = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = read(data, left + x, top + y, width);
      paint(next, x, y, size, color);
    }
  }
  return { data: next, width: size, height: size };
}

export function trimCeiling(image, mask) {
  const box = faceBox(image, mask);
  if (!box) return mask;
  const { width, data } = image;
  const out = mask.slice();
  const hat = Math.max(0, box.minY - 2);
  for (let y = 0; y < hat; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (!out[at]) continue;
      if (weightedLuma(read(data, x, y, width)) > 78) out[at] = 0;
    }
  }
  return out;
}

export function trimSides(image, mask) {
  const box = faceBox(image, mask);
  if (!box) return mask;
  const { width, height, data } = image;
  const out = mask.slice();
  const pad = Math.round((box.maxX - box.minX) * 0.22);
  const left = box.minX - pad;
  const right = box.maxX + pad;
  const bottom = Math.min(height - 1, box.maxY + Math.round((box.maxY - box.minY) * 0.85));
  for (let y = 0; y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= left && x <= right) continue;
      const at = y * width + x;
      if (!out[at]) continue;
      const color = read(data, x, y, width);
      if (isSkin(color)) continue;
      if (weightedLuma(color) > 108 && saturation(color) < 52) out[at] = 0;
    }
  }
  return out;
}

function portraitWindow(image, subject) {
  const { width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!subject[y * width + x]) continue;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!count) return null;
  const padX = Math.round((maxX - minX) * 0.1);
  const padY = Math.round((maxY - minY) * 0.16);
  minX = Math.max(0, minX - padX);
  maxX = Math.min(width - 1, maxX + padX);
  minY = Math.max(0, minY - padY);
  maxY = Math.min(height - 1, maxY + padY);
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const band = faceDetailBand(image);
  let size;
  let left;
  let top;
  if (band) {
    const span = Math.max(8, band.end - band.start);
    const cx = (minX + maxX) / 2;
    size = Math.max(1, Math.min(width, height, Math.round(span * 1.35)));
    left = Math.round(cx - size / 2);
    top = Math.round(band.start - span * 0.22);
  } else {
    const cx = (minX + maxX) / 2;
    const headShot = boxH > boxW * 1.15 && boxH > height * 0.5;
    const side = headShot ? Math.min(width, height, Math.round(boxW * 1.2)) : Math.max(boxW, boxH);
    size = Math.max(1, Math.min(side, width, height));
    const cy = headShot ? minY + size * 0.42 : (minY + maxY) / 2 - size * 0.04;
    left = Math.round(cx - size / 2);
    top = Math.round(headShot ? minY - size * 0.04 : cy - size / 2);
  }
  left = Math.max(0, Math.min(left, width - size));
  top = Math.max(0, Math.min(top, height - size));
  return { left, top, size };
}

function cropSquare(image, subject) {
  const { data, width } = image;
  const window = portraitWindow(image, subject);
  if (!window) return { image, subject, empty: true };
  const { left, top, size } = window;
  const next = new Uint8ClampedArray(size * size * 4);
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = read(data, left + x, top + y, width);
      paint(next, x, y, size, subject[(top + y) * width + left + x] ? color : BLACK);
      mask[y * size + x] = subject[(top + y) * width + left + x];
    }
  }
  return { image: { data: next, width: size, height: size }, subject: mask, empty: false };
}

function channelSpan(colors) {
  let best = 0;
  let span = -1;
  for (let channel = 0; channel < 3; channel += 1) {
    let min = 255;
    let max = 0;
    colors.forEach((color) => {
      min = Math.min(min, color[channel]);
      max = Math.max(max, color[channel]);
    });
    if (max - min > span) {
      span = max - min;
      best = channel;
    }
  }
  return { channel: best, span };
}

function medianCut(colors, count) {
  if (!colors.length) return [[186, 132, 96, 255]];
  let buckets = [colors];
  while (buckets.length < count) {
    let pick = 0;
    let span = -1;
    buckets.forEach((bucket, index) => {
      const range = channelSpan(bucket);
      if (range.span > span && bucket.length > 1) {
        span = range.span;
        pick = index;
      }
    });
    if (span < 12) break;
    const bucket = buckets[pick];
    const channel = channelSpan(bucket).channel;
    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.max(1, Math.floor(bucket.length / 2));
    buckets.splice(pick, 1, bucket.slice(0, mid), bucket.slice(mid));
  }
  return buckets.map((bucket) => {
    const total = bucket.reduce((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]], [0, 0, 0]);
    return [clamp(total[0] / bucket.length), clamp(total[1] / bucket.length), clamp(total[2] / bucket.length), 255];
  });
}

function nearestIndex(color, palette) {
  let best = 0;
  let score = Infinity;
  palette.forEach((swatch, index) => {
    const gap = l1(color, swatch);
    if (gap < score) {
      score = gap;
      best = index;
    }
  });
  return best;
}

function cartoonColor(color, amount) {
  const gray = luminance(color);
  const lifted = [
    gray + (color[0] - gray) * amount,
    gray + (color[1] - gray) * amount,
    gray + (color[2] - gray) * amount
  ];
  return lifted.map((channel) => clamp((channel - 128) * 1.12 + 132)).concat(255);
}

function inversionField(source, mask) {
  const field = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % source.width;
    const y = Math.floor(i / source.width);
    field[i] = inversionValue(read(source.data, x, y, source.width));
  }
  return field;
}

function inversionTrace(source, mask) {
  const { width, height } = source;
  const field = inversionField(source, mask);
  const mag = new Float32Array(field.length);
  const vertical = new Uint8Array(field.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x;
      const gx = field[at + 1] - field[at - 1];
      const gy = field[at + width] - field[at - width];
      mag[at] = Math.hypot(gx, gy);
      vertical[at] = Math.abs(gy) > Math.abs(gx) ? 1 : 0;
    }
  }
  const trace = new Uint8ClampedArray(width * height * 4);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x;
      const strength = mag[at];
      if (strength < 46) {
        paint(trace, x, y, width, GROUND);
        continue;
      }
      const ridge = vertical[at]
        ? strength >= mag[at - width] && strength >= mag[at + width]
        : strength >= mag[at - 1] && strength >= mag[at + 1];
      paint(trace, x, y, width, ridge ? [0, 229, 255, 255] : GROUND);
    }
  }
  const line = new Uint8ClampedArray(trace);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (y * width + x) * 4;
      if (line[at + 2] > 200) continue;
      const neighbor = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => {
        const i = (ny * width + nx) * 4;
        return line[i + 2] > 200;
      });
      if (neighbor) paint(trace, x, y, width, [0, 229, 255, 255]);
    }
  }
  return trace;
}

function rgbToHsv(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max === 0 ? 0 : delta / max, max];
}

function hsvToRgb(hue, sat, value) {
  const chroma = value * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }
  return [clamp((red + m) * 255), clamp((green + m) * 255), clamp((blue + m) * 255), 255];
}

function boostColor(color, amount) {
  const [hue, sat, value] = rgbToHsv(color[0], color[1], color[2]);
  const skinTone = hue >= 5 && hue <= 40 && sat > 0.12 && sat < 0.75;
  if (skinTone) return hsvToRgb(hue, Math.min(1, sat * Math.min(amount, 1.08)), value);
  let next = sat * amount;
  const blue = hue > 190 && hue < 265;
  const yellow = hue > 35 && hue < 75;
  if (blue || yellow) next *= 1.45;
  return hsvToRgb(hue, Math.min(1, next), value);
}

function sobelMag(data, width, height) {
  const mag = new Float32Array(width * height);
  const lumaAt = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  };
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const gx = lumaAt(x + 1, y - 1) + 2 * lumaAt(x + 1, y) + lumaAt(x + 1, y + 1)
        - lumaAt(x - 1, y - 1) - 2 * lumaAt(x - 1, y) - lumaAt(x - 1, y + 1);
      const gy = lumaAt(x - 1, y + 1) + 2 * lumaAt(x, y + 1) + lumaAt(x + 1, y + 1)
        - lumaAt(x - 1, y - 1) - 2 * lumaAt(x, y - 1) - lumaAt(x + 1, y - 1);
      mag[y * width + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function boxDownscale(source, mask, pixel) {
  const cols = Math.max(24, Math.round(source.width / pixel));
  const rows = Math.max(24, Math.round(source.height / pixel));
  const data = new Uint8ClampedArray(cols * rows * 4);
  const keep = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy += 1) {
    const y0 = Math.floor(gy * source.height / rows);
    const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * source.height / rows));
    for (let gx = 0; gx < cols; gx += 1) {
      const x0 = Math.floor(gx * source.width / cols);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * source.width / cols));
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      let area = 0;
      for (let y = y0; y < y1 && y < source.height; y += 1) {
        for (let x = x0; x < x1 && x < source.width; x += 1) {
          area += 1;
          if (!mask[y * source.width + x]) continue;
          const color = read(source.data, x, y, source.width);
          r += color[0];
          g += color[1];
          b += color[2];
          covered += 1;
        }
      }
      if (!area || covered / area < 0.4) {
        paint(data, gx, gy, cols, BLACK);
        continue;
      }
      keep[gy * cols + gx] = 1;
      paint(data, gx, gy, cols, [clamp(r / covered), clamp(g / covered), clamp(b / covered), 255]);
    }
  }
  return { data, width: cols, height: rows, keep };
}

function quantizeBlocks(small, count, amount) {
  const samples = [];
  for (let i = 0; i < small.keep.length; i += 1) {
    if (!small.keep[i]) continue;
    const x = i % small.width;
    const y = Math.floor(i / small.width);
    samples.push(read(small.data, x, y, small.width));
  }
  const palette = medianCut(samples, count);
  const data = new Uint8ClampedArray(small.data.length);
  for (let i = 0; i < small.keep.length; i += 1) {
    const x = i % small.width;
    const y = Math.floor(i / small.width);
    if (!small.keep[i]) {
      paint(data, x, y, small.width, BLACK);
      continue;
    }
    const color = read(small.data, x, y, small.width);
    paint(data, x, y, small.width, boostColor(palette[nearestIndex(color, palette)], amount));
  }
  return { data, width: small.width, height: small.height, palette: palette.length };
}

function strokeOutline(block, strength) {
  if (strength <= 0) return block.data;
  const mag = sobelMag(block.data, block.width, block.height);
  const threshold = 280 - strength * 90;
  const edge = new Uint8Array(block.width * block.height);
  for (let y = 1; y < block.height - 1; y += 1) {
    for (let x = 1; x < block.width - 1; x += 1) {
      const at = y * block.width + x;
      if (mag[at] < threshold) continue;
      const vertical = mag[at] >= mag[at - 1] && mag[at] >= mag[at + 1];
      const horizontal = mag[at] >= mag[at - block.width] && mag[at] >= mag[at + block.width];
      if (vertical || horizontal) edge[at] = 1;
    }
  }
  if (strength > 0.65) {
    const bold = edge.slice();
    for (let y = 1; y < block.height - 1; y += 1) {
      for (let x = 1; x < block.width - 1; x += 1) {
        if (!edge[y * block.width + x]) continue;
        bold[y * block.width + x + 1] = 1;
        bold[(y + 1) * block.width + x] = 1;
      }
    }
    edge.set(bold);
  }
  const data = new Uint8ClampedArray(block.data);
  for (let i = 0; i < edge.length; i += 1) {
    const pix = i * 4;
    if (!edge[i] || (data[pix] + data[pix + 1] + data[pix + 2]) < 18) continue;
    data[pix] = 0;
    data[pix + 1] = 0;
    data[pix + 2] = 0;
    data[pix + 3] = 255;
  }
  return data;
}

function nearestScale(block, target) {
  const scale = Math.max(2, Math.round(target / block.width));
  const width = block.width * scale;
  const height = block.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = read(block.data, Math.floor(x / scale), Math.floor(y / scale), block.width);
      paint(data, x, y, width, color);
    }
  }
  return { data, width, height, scale };
}

function paintCyan(frame, amount) {
  if (amount <= 0) return frame.data;
  const mag = sobelMag(frame.data, frame.width, frame.height);
  const data = new Uint8ClampedArray(frame.data);
  const threshold = Math.max(40, 210 - amount * 8);
  const dark = (x, y) => {
    const color = read(data, x, y, frame.width);
    return color[0] + color[1] + color[2] < 28;
  };
  for (let y = 1; y < frame.height - 1; y += 1) {
    for (let x = 1; x < frame.width - 1; x += 1) {
      const at = y * frame.width + x;
      if (mag[at] < threshold) continue;
      const vertical = mag[at] >= mag[at - 1] && mag[at] >= mag[at + 1];
      const horizontal = mag[at] >= mag[at - frame.width] && mag[at] >= mag[at + frame.width];
      if (!vertical && !horizontal) continue;
      const pix = at * 4;
      if (data[pix] + data[pix + 1] + data[pix + 2] < 36) continue;
      const silhouette = dark(x - 1, y) || dark(x + 1, y) || dark(x, y - 1) || dark(x, y + 1);
      if (!silhouette && mag[at] < threshold + 90) continue;
      data[pix] = CYAN[0];
      data[pix + 1] = CYAN[1];
      data[pix + 2] = CYAN[2];
      data[pix + 3] = 255;
    }
  }
  return data;
}

export function offsetMask(mask, width, height, steps) {
  let out = mask.slice();
  const grow = steps > 0;
  const rounds = Math.min(8, Math.abs(steps));
  for (let step = 0; step < rounds; step += 1) {
    const next = out.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        const neighbors = [
          x > 0 ? out[at - 1] : 0,
          x < width - 1 ? out[at + 1] : 0,
          y > 0 ? out[at - width] : 0,
          y < height - 1 ? out[at + width] : 0
        ];
        if (grow && !out[at] && neighbors.some(Boolean)) next[at] = 1;
        if (!grow && out[at] && neighbors.some((bit) => !bit)) next[at] = 0;
      }
    }
    out = next;
  }
  return out;
}

export function renderPixel(image, options) {
  const subject = options.mask && options.mask.length === image.width * image.height
    ? options.mask
    : subjectMask(image, options.tolerance);
  const cropped = cropSquare(image, subject);
  const source = cropped.image;
  const mask = cropped.subject;
  const pixel = Math.max(2, Math.round(options.pixelSize || 6));
  const colors = Math.max(8, Math.round(options.colors || 32));
  const sat = options.saturation || 1.4;
  const small = boxDownscale(source, mask, pixel);
  const flat = quantizeBlocks(small, colors, sat);
  const outlined = strokeOutline(flat, options.outline ?? 0.8);
  const blocks = { data: outlined, width: flat.width, height: flat.height };
  const portrait = nearestScale(blocks, 520);
  const result = paintCyan(portrait, options.cyan ?? 8);
  const matte = new Uint8ClampedArray(source.data.length);
  for (let i = 0; i < mask.length; i += 1) {
    const x = i % source.width;
    const y = Math.floor(i / source.width);
    paint(matte, x, y, source.width, mask[i] ? read(source.data, x, y, source.width) : BLACK);
  }
  const abstract = nearestScale({ data: flat.data, width: flat.width, height: flat.height }, 520);
  return {
    empty: cropped.empty,
    grid: flat.width,
    palette: flat.palette,
    cells: { data: outlined, width: flat.width, height: flat.height },
    result: new ImageData(result, portrait.width, portrait.height),
    trace: new ImageData(inversionTrace(source, mask), source.width, source.height),
    matte: new ImageData(matte, source.width, source.height),
    abstract: new ImageData(abstract.data, abstract.width, abstract.height)
  };
}

export function presentBlocks(blocks, maxSize = 720, cyan = 8) {
  const edge = Math.max(blocks.width, blocks.height);
  const scale = Math.max(2, Math.floor(maxSize / edge));
  const portrait = nearestScale(blocks, blocks.width * scale);
  const data = paintCyan(portrait, cyan);
  if (typeof ImageData !== "undefined") return new ImageData(data, portrait.width, portrait.height);
  return { data, width: portrait.width, height: portrait.height };
}

export function drawCrisp(canvas, image, maxSize = 512) {
  const scale = Math.max(1, Math.floor(maxSize / image.width));
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const ctx = canvas.getContext("2d");
  const chip = document.createElement("canvas");
  chip.width = image.width;
  chip.height = image.height;
  chip.getContext("2d").putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(chip, 0, 0, canvas.width, canvas.height);
}

export function fitSource(img, maxSize = 960) {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

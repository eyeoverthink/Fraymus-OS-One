function copyImage(image) {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

function background(data, index) {
  return data[index] + data[index + 1] + data[index + 2] < 42;
}

function lip(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return red > 130 && red > green + 10 && green > 60 && blue < 180;
}

function pixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}

function isBackground(r, g, b) {
  return r + g + b < 42;
}

function isSkin(r, g, b) {
  return r > 68 && g > 32 && b > 18 && r >= g + 8 && r >= b + 12 && r < 242 && r - g < 100 && g > b * 0.55;
}

function isBeard(r, g, b) {
  if (isBackground(r, g, b) || isSkin(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 200 && max - min < 42;
}

function isCyan(r, g, b) {
  return b > 130 && g > 80 && r < 110 && b > r + 30;
}

function isSclera(r, g, b) {
  return r > 165 && g > 158 && b > 150 && Math.abs(r - b) < 36;
}

function isTooth(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 185 && g > 170 && b > 145 && r + 6 >= b && max - min < 55 && r + g + b > 520;
}

function measureFace(image) {
  const { data, width, height } = image;
  const skinRows = new Int32Array(height);
  const skinLeft = new Int32Array(height);
  const skinRight = new Int32Array(height);
  skinLeft.fill(width);
  skinRight.fill(-1);
  let fgTop = height;
  let fgBottom = 0;
  let fgLeft = width;
  let fgRight = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(data, width, x, y);
      if (!isBackground(r, g, b)) {
        if (y < fgTop) fgTop = y;
        if (y > fgBottom) fgBottom = y;
        if (x < fgLeft) fgLeft = x;
        if (x > fgRight) fgRight = x;
      }
      if (!isSkin(r, g, b)) continue;
      skinRows[y] += 1;
      if (x < skinLeft[y]) skinLeft[y] = x;
      if (x > skinRight[y]) skinRight[y] = x;
    }
  }
  const rowMin = Math.max(4, Math.round(width * 0.012));
  const lefts = [];
  const rights = [];
  for (let y = 0; y < height; y += 1) {
    if (skinRows[y] < rowMin) continue;
    lefts.push(skinLeft[y]);
    rights.push(skinRight[y]);
  }
  lefts.sort((a, b) => a - b);
  rights.sort((a, b) => a - b);
  const left = lefts[Math.floor(lefts.length / 2)] ?? fgLeft;
  const right = rights[Math.floor(rights.length / 2)] ?? fgRight;
  const faceW = Math.max(8, right - left);
  const cx = Math.round((left + right) / 2);
  const eyeY = eyeLine(image, left, right, fgTop, fgBottom);
  const headLimit = height - 1;
  let chin = eyeY ?? fgTop;
  const half = Math.max(4, Math.round(faceW * 0.22));
  const rowFace = (y) => {
    let face = 0;
    let wide = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(data, width, x, y);
      if (isBackground(r, g, b)) continue;
      const onFace = isSkin(r, g, b) || isBeard(r, g, b);
      if (onFace && x >= cx - half && x <= cx + half) face += 1;
      if (x < left - faceW * 0.2 || x > right + faceW * 0.2) wide += 1;
    }
    return face >= 3 && wide <= face + half;
  };
  let y = Math.min(height - 1, (eyeY ?? fgTop) + 1);
  while (y < headLimit && !rowFace(y)) y += 1;
  let gap = 0;
  for (; y < headLimit; y += 1) {
    if (!rowFace(y)) {
      gap += 1;
      if (gap > 12) break;
      continue;
    }
    gap = 0;
    chin = y;
  }
  return { left, right, faceW, cx, eyeY, chin, fgTop, fgBottom, fgLeft, fgRight };
}

function eyeLine(image, left, right, fgTop, fgBottom) {
  const { data, width, height } = image;
  const headBottom = fgTop + Math.round((fgBottom - fgTop) * 0.5);
  const bands = [];
  const take = (match, maxWidth) => {
    const mask = new Uint8Array(width * height);
    for (let y = fgTop; y <= headBottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const [r, g, b] = pixel(data, width, x, y);
        if (match(r, g, b)) mask[y * width + x] = 1;
      }
    }
    const seen = new Uint8Array(width * height);
    for (let y = fgTop; y <= fgBottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const start = y * width + x;
        if (!mask[start] || seen[start]) continue;
        const stack = [start];
        seen[start] = 1;
        let n = 0;
        let sy = 0;
        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        while (stack.length) {
          const index = stack.pop();
          const px = index % width;
          const py = (index - px) / width;
          n += 1;
          sy += py;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (!dx && !dy) continue;
              const nx = px + dx;
              const ny = py + dy;
              if (nx < left || nx > right || ny < fgTop || ny > fgBottom) continue;
              const next = ny * width + nx;
              if (!mask[next] || seen[next]) continue;
              seen[next] = 1;
              stack.push(next);
            }
          }
        }
        const span = maxX - minX + 1;
        if (n < 4 || span > maxWidth || maxY - minY > Math.round((headBottom - fgTop) * 0.45)) continue;
        bands.push({ cy: sy / n, n, minY, maxY });
      }
    }
  };
  take(isCyan, Math.max(24, right - left));
  if (!bands.length) take(isSclera, Math.max(36, right - left));
  if (!bands.length) return null;
  bands.sort((a, b) => b.n - a.n);
  const top = bands.slice(0, 2);
  return Math.round(top.reduce((sum, band) => sum + band.cy, 0) / top.length);
}

function toothBands(image, face) {
  const { data, width, height } = image;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(data, width, x, y);
      if (isTooth(r, g, b)) mask[y * width + x] = 1;
    }
  }
  const seen = new Uint8Array(width * height);
  const parts = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      let n = 0;
      let sx = 0;
      let sy = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      while (stack.length) {
        const index = stack.pop();
        const px = index % width;
        const py = (index - px) / width;
        n += 1;
        sx += px;
        sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const next = ny * width + nx;
            if (!mask[next] || seen[next]) continue;
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      parts.push({ n, sx, sy, minX, maxX, minY, maxY });
    }
  }
  parts.sort((a, b) => a.minX - b.minX);
  const bands = [];
  parts.forEach((part) => {
    const last = bands[bands.length - 1];
    const close = last
      && part.minX <= last.maxX + 8
      && part.minY <= last.maxY + 3
      && part.maxY >= last.minY - 3;
    if (!close) {
      bands.push({ ...part });
      return;
    }
    last.n += part.n;
    last.sx += part.sx;
    last.sy += part.sy;
    last.minX = Math.min(last.minX, part.minX);
    last.maxX = Math.max(last.maxX, part.maxX);
    last.minY = Math.min(last.minY, part.minY);
    last.maxY = Math.max(last.maxY, part.maxY);
  });
  return bands.filter((band) => {
    const spanW = band.maxX - band.minX + 1;
    const spanH = band.maxY - band.minY + 1;
    if (band.n < 16 || spanW < 10) return false;
    if (spanH > Math.max(16, spanW * 0.4)) return false;
    if (face.eyeY != null && band.maxY < face.eyeY + 8) return false;
    const cx = band.sx / band.n;
    return Math.abs(cx - face.cx) <= face.faceW * 0.35;
  });
}

function findTeeth(image, face) {
  const bands = toothBands(image, face);
  let best = null;
  bands.forEach((band) => {
    const spanW = band.maxX - band.minX + 1;
    const spanH = band.maxY - band.minY + 1;
    const score = band.n * (spanW / (spanH + 1));
    if (best && score <= best.score) return;
    best = {
      score,
      cx: Math.round(band.sx / band.n),
      cy: Math.round(band.sy / band.n),
      width: spanW,
      height: spanH
    };
  });
  return best;
}

function findLipSlit(image, face) {
  const { data, width, height } = image;
  const y0 = face.eyeY == null
    ? face.fgTop + Math.round((face.fgBottom - face.fgTop) * 0.45)
    : face.eyeY + Math.max(8, Math.round((face.chin - face.eyeY) * 0.18));
  const y1 = Math.min(height - 2, face.chin);
  const minW = Math.max(12, Math.round(face.faceW * 0.16));
  let best = null;
  for (let y = y0; y <= y1; y += 1) {
    let run = 0;
    let runStart = 0;
    const consider = (xEnd) => {
      const runW = xEnd - runStart;
      if (runW < minW || runW > face.faceW * 0.62) return;
      const cx = (runStart + xEnd - 1) / 2;
      if (Math.abs(cx - face.cx) > face.faceW * 0.2) return;
      const index = (y * width + Math.round(cx)) * 4;
      let above = false;
      let below = false;
      for (let dy = 1; dy <= 6; dy += 1) {
        if (y - dy >= 0 && lip(data, index - dy * width * 4)) above = true;
        if (y + dy < height && lip(data, index + dy * width * 4)) below = true;
      }
      if (!above || !below) return;
      if (!best || runW > best.width) {
        best = { cx: Math.round(cx), cy: y, width: runW, height: 2 };
      }
    };
    for (let x = face.left; x <= face.right; x += 1) {
      const [r, g, b] = pixel(data, width, x, y);
      const dark = r + g + b < 110 && r < 85;
      if (dark) {
        if (!run) runStart = x;
        run += 1;
      } else if (run) {
        consider(x);
        run = 0;
      }
    }
    if (run) consider(face.right + 1);
  }
  return best;
}

function mouthAt(feature, face) {
  const rx = Math.max(8, Math.round(feature.width / 2));
  let ryOpen = Math.max(6, Math.round(rx * 0.42));
  if (face.eyeY != null) {
    const cap = Math.max(6, Math.round((feature.cy - face.eyeY) * 0.22));
    if (ryOpen > cap) ryOpen = cap;
  }
  const lipY = feature.cy;
  return {
    cx: feature.cx,
    lipY,
    cy: Math.round(lipY + ryOpen * 0.55),
    rx,
    ryOpen,
    ryMid: Math.max(3, Math.round(ryOpen * 0.45))
  };
}

function findMouth(image) {
  const { width, height } = image;
  const face = measureFace(image);
  const teeth = findTeeth(image, face);
  if (teeth) return mouthAt(teeth, face);
  const slit = findLipSlit(image, face);
  if (slit) return mouthAt(slit, face);
  const eyeY = face.eyeY ?? face.fgTop + Math.round((face.chin - face.fgTop) * 0.32);
  const lipY = Math.min(face.chin - 2, eyeY + Math.round((face.chin - eyeY) * 0.62));
  const boxW = Math.max(8, face.fgRight - face.fgLeft);
  return mouthAt({
    cx: face.cx || Math.floor(width / 2),
    cy: lipY,
    width: Math.max(16, Math.round((face.faceW || boxW) * 0.34)),
    height: 4
  }, { ...face, eyeY });
}

function sampleLip(image, mouth) {
  const { data, width, height } = image;
  for (let dy = 2; dy <= 16; dy += 1) {
    const y = mouth.cy - dy;
    if (y < 0 || y >= height) continue;
    const x = Math.max(0, Math.min(width - 1, mouth.cx));
    const index = (y * width + x) * 4;
    const [r, g, b] = [data[index], data[index + 1], data[index + 2]];
    if (isSkin(r, g, b)) return [r, g, b];
  }
  return [176, 120, 96];
}

function blend(data, index, color, cover) {
  const amount = Math.max(0, Math.min(1, cover));
  if (amount <= 0) return;
  const keep = 1 - amount;
  data[index] = data[index] * keep + color[0] * amount;
  data[index + 1] = data[index + 1] * keep + color[1] * amount;
  data[index + 2] = data[index + 2] * keep + color[2] * amount;
}

function sclera(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return red > 170 && green > 165 && blue > 170 && blue + 12 >= red && green + 18 >= red;
}

function findEye(image, x0, x1) {
  const { data, width, height } = image;
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.floor(height * 0.46);
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!sclera(data, (y * width + x) * 4)) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (count < 40 || boxW < 12 || boxH < 6 || boxH > Math.round(height * 0.06)) return null;
  return { minX, maxX, minY, maxY, cy: Math.round((minY + maxY) / 2) };
}

function lidColor(image, eye) {
  const { data, width, height } = image;
  const x = Math.round((eye.minX + eye.maxX) / 2);
  for (let y = eye.maxY + 4; y < Math.min(height - 1, eye.maxY + 28); y += 1) {
    const index = (y * width + x) * 4;
    if (lip(data, index)) return [data[index], data[index + 1], data[index + 2]];
  }
  return [196, 140, 108];
}

function paintBlink(image) {
  const { data, width } = image;
  const mid = Math.floor(width / 2);
  const eyes = [
    findEye(image, Math.floor(width * 0.22), mid - 10),
    findEye(image, mid + 10, Math.floor(width * 0.78))
  ].filter(Boolean);
  eyes.forEach((eye) => {
    const lid = lidColor(image, eye);
    for (let y = eye.minY; y <= eye.maxY; y += 1) {
      let left = -1;
      let right = -1;
      for (let x = eye.minX; x <= eye.maxX; x += 1) {
        if (!sclera(data, (y * width + x) * 4)) continue;
        if (left < 0) left = x;
        right = x;
      }
      if (left < 0) continue;
      for (let x = left; x <= right; x += 1) {
        const index = (y * width + x) * 4;
        const lash = Math.abs(y - eye.cy) <= 1;
        blend(data, index, lash ? [28, 16, 12] : lid, 1);
      }
    }
  });
}

function paintMouth(image, kind) {
  const mouth = findMouth(image);
  const ry = kind === "open" ? mouth.ryOpen : mouth.ryMid;
  const anchor = Number.isFinite(mouth.lipY) ? mouth.lipY : mouth.cy;
  const cy = Math.round(anchor + ry * 0.55);
  const lip = sampleLip(image, { ...mouth, cy: anchor });
  const interior = [22, 10, 12];
  const teeth = [232, 220, 206];
  const { data, width, height } = image;
  const x0 = Math.max(0, mouth.cx - mouth.rx - 2);
  const x1 = Math.min(width - 1, mouth.cx + mouth.rx + 2);
  const y0 = Math.max(0, cy - ry - 2);
  const y1 = Math.min(height - 1, cy + ry + 2);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = (y * width + x) * 4;
      if (background(data, index)) continue;
      const nx = (x - mouth.cx) / mouth.rx;
      const ny = (y - cy) / ry;
      const distance = Math.hypot(nx, ny);
      if (distance < 1) {
        const tooth = kind === "open" && ny < -0.28 && ny > -0.82;
        blend(data, index, tooth ? teeth : interior, 1);
      } else if (distance < 1.35) {
        blend(data, index, lip, (1.35 - distance) / 0.35);
      }
    }
  }
}

function asImage(image) {
  if (typeof ImageData !== "undefined") return new ImageData(image.data, image.width, image.height);
  return image;
}

export function inspectTalk(closed, open) {
  const mouth = findMouth(closed);
  let lip = 0;
  let other = 0;
  const { data: before, width, height } = closed;
  const after = open.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const delta = Math.abs(before[index] - after[index])
        + Math.abs(before[index + 1] - after[index + 1])
        + Math.abs(before[index + 2] - after[index + 2]);
      if (delta < 48) continue;
      const distance = Math.hypot((x - mouth.cx) / mouth.rx, (y - mouth.cy) / mouth.ryOpen);
      if (distance < 1.6) lip += 1;
      else other += 1;
    }
  }
  return { ok: lip >= 30 && other <= lip * 0.35, lip, other, cy: mouth.cy };
}

export function composeTalkCells(base) {
  const closed = copyImage(base);
  const mid = copyImage(base);
  const open = copyImage(base);
  paintMouth(mid, "mid");
  paintMouth(open, "open");
  const blink = copyImage(base);
  paintBlink(blink);
  return { closed: asImage(closed), mid: asImage(mid), open: asImage(open), blink: asImage(blink) };
}

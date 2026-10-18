function copyImage(image) {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

function dark(data, index) {
  return data[index] < 48 && data[index + 1] < 42;
}

function background(data, index) {
  return data[index] + data[index + 1] + data[index + 2] < 36;
}

function lip(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return red > 130 && red > green + 10 && green > 60 && blue < 180;
}

function spanOf(image, y, cx, test) {
  const { data, width, height } = image;
  if (y < 0 || y >= height) return null;
  const at = (x) => test(data, (y * width + x) * 4);
  if (!at(cx)) return null;
  let left = cx;
  let right = cx;
  while (left > 0 && at(left - 1)) left -= 1;
  while (right < width - 1 && at(right + 1)) right += 1;
  return { left, right, width: right - left, mid: (left + right) / 2 };
}

function findMouth(image) {
  const { width, height } = image;
  const cx = Math.floor(width / 2);
  const y0 = Math.floor(height * 0.5);
  const y1 = Math.floor(height * 0.68);
  const minW = Math.round(width * 0.08);
  const maxW = Math.round(width * 0.2);
  let best = null;
  for (let y = y0; y < y1; y += 1) {
    const run = spanOf(image, y, cx, dark);
    if (!run || run.width < minW || run.width > maxW) continue;
    const above = spanOf(image, y - 2, cx, lip) || spanOf(image, y - 4, cx, lip);
    const below = spanOf(image, y + 8, cx, lip) || spanOf(image, y + 12, cx, lip);
    if (!above || !below || above.width < minW || below.width < minW) continue;
    if (!best || run.width < best.run.width) best = { y, run };
  }
  const ryOpen = Math.max(8, Math.round(height * 0.02));
  const ryMid = Math.max(3, Math.round(ryOpen * 0.45));
  if (!best) {
    return {
      cx,
      cy: Math.floor(height * 0.58),
      rx: Math.max(10, Math.round(width * 0.05)),
      ryOpen,
      ryMid,
    };
  }
  return {
    cx: Math.round(best.run.mid),
    cy: best.y,
    rx: Math.max(10, Math.round(best.run.width / 2)),
    ryOpen,
    ryMid,
  };
}

function sampleLip(image, mouth) {
  const { data, width, height } = image;
  const x = Math.min(width - 2, mouth.cx + mouth.rx + 3);
  const y = Math.min(height - 2, mouth.cy);
  const index = (y * width + x) * 4;
  if (background(data, index)) return [176, 120, 96];
  return [data[index], data[index + 1], data[index + 2]];
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
  const lip = sampleLip(image, mouth);
  const interior = [22, 10, 12];
  const teeth = [232, 220, 206];
  const { data, width, height } = image;
  const x0 = Math.max(0, mouth.cx - mouth.rx - 2);
  const x1 = Math.min(width - 1, mouth.cx + mouth.rx + 2);
  const y0 = Math.max(0, mouth.cy - ry - 2);
  const y1 = Math.min(height - 1, mouth.cy + ry + 2);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = (y * width + x) * 4;
      if (background(data, index)) continue;
      const nx = (x - mouth.cx) / mouth.rx;
      const ny = (y - mouth.cy) / ry;
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

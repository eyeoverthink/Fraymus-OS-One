import { buildSubjectMask, fitSource, portraitPhoto, renderPixel } from "./pixelEngine.js";

export const LIVE_EDGE = 240;
export const CLIP_EDGE = 480;
export const CLIP_FPS = 10;
export const CARTOON_FPS = 2;
export const PACK_EDGE = 720;
export const EXPORT_EDGE = 960;

export function motionView(view) {
  if (view === "trace" || view === "matte") return view;
  return "result";
}

function rasterSource(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) throw new Error("That frame is not ready.");
  if (!source.videoWidth) return source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function portraitJpeg(source, maxSize = 768) {
  const image = fitSource(rasterSource(source), maxSize);
  const mask = buildSubjectMask(image, 36);
  const photo = portraitPhoto(image, mask);
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  const frame = new ImageData(photo.data, photo.width, photo.height);
  canvas.getContext("2d").putImageData(frame, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function styleImage(source, options, maxSize) {
  const image = fitSource(rasterSource(source), maxSize);
  const mask = buildSubjectMask(image, options.tolerance);
  const made = renderPixel(image, { ...options, mask });
  const shown = options.view === "trace" ? made.trace : options.view === "matte" ? made.abstract : made.result;
  return { shown, palette: made.palette, empty: made.empty };
}

export const MOSAIC_CHUNK = 8;
const MOSAIC_HOLD = 18;

function mosaicSize(width, height) {
  const limit = Math.min(MOSAIC_CHUNK, width, height);
  for (let size = limit; size >= 4; size -= 1) {
    if (width % size === 0 && height % size === 0) return size;
  }
  return 1;
}

function readTile(data, width, x0, y0, size) {
  const tile = new Uint8Array(size * size * 4);
  let pen = 0;
  for (let y = 0; y < size; y += 1) {
    const offset = ((y0 + y) * width + x0) * 4;
    tile.set(data.subarray(offset, offset + size * 4), pen);
    pen += size * 4;
  }
  return tile;
}

function tileHash(tile) {
  let hash = 2166136261;
  for (let i = 0; i < tile.length; i += 1) {
    hash ^= tile[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tileDrift(left, right) {
  let diff = 0;
  for (let i = 0; i < left.length; i += 4) {
    diff += Math.abs(left[i] - right[i]) + Math.abs(left[i + 1] - right[i + 1]) + Math.abs(left[i + 2] - right[i + 2]);
  }
  return diff / (left.length / 4) / 3;
}

export function buildMosaic(frames) {
  if (!frames?.length) throw new Error("The loop has no frames.");
  const width = frames[0].width;
  const height = frames[0].height;
  const chunk = mosaicSize(width, height);
  const cols = Math.floor(width / chunk);
  const rows = Math.floor(height / chunk);
  const book = [];
  const known = new Map();
  const maps = [];
  const cellCount = cols * rows;

  function adopt(tile) {
    const key = tileHash(tile);
    const found = known.get(key);
    if (found != null && tileDrift(book[found], tile) === 0) return found;
    const code = book.length;
    book.push(tile);
    if (found == null) known.set(key, code);
    return code;
  }

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const data = frames[frameIndex].data;
    const map = new Uint32Array(cellCount);
    const prior = maps[frameIndex - 1];
    let cell = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = readTile(data, width, col * chunk, row * chunk, chunk);
        if (prior && tileDrift(book[prior[cell]], tile) <= MOSAIC_HOLD) map[cell] = prior[cell];
        else map[cell] = adopt(tile);
        cell += 1;
      }
    }
    maps.push(map);
  }

  if (maps.length > 1) {
    const first = maps[0];
    for (let cell = 0; cell < cellCount; cell += 1) {
      for (let frame = maps.length - 1; frame > 0; frame -= 1) {
        if (maps[frame][cell] === first[cell]) continue;
        if (tileDrift(book[maps[frame][cell]], book[first[cell]]) > MOSAIC_HOLD) break;
        maps[frame][cell] = first[cell];
      }
    }
  }

  return { width, height, chunk, cols, rows, book, maps, chunks: book.length, tiles: cellCount };
}

export function paintMosaic(mosaic, index) {
  const { width, height, chunk, cols, rows, book, maps } = mosaic;
  const map = maps[index];
  const data = new Uint8ClampedArray(width * height * 4);
  let cell = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const tile = book[map[cell]];
      let pen = 0;
      for (let y = 0; y < chunk; y += 1) {
        const offset = ((row * chunk + y) * width + col * chunk) * 4;
        data.set(tile.subarray(pen, pen + chunk * 4), offset);
        pen += chunk * 4;
      }
      cell += 1;
    }
  }
  if (typeof ImageData !== "undefined") return new ImageData(data, width, height);
  return { data, width, height };
}

export function packFrame(image, size = PACK_EDGE) {
  const scale = size / Math.max(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const chip = document.createElement("canvas");
  chip.width = image.width;
  chip.height = image.height;
  chip.getContext("2d").putImageData(image, 0, 0);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(chip, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function knownDuration(video) {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  if (video.seekable?.length) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return 0;
}

export function measureDuration(video) {
  const known = knownDuration(video);
  if (known > 0) return Promise.resolve(known);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(knownDuration(video));
    }, 2500);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      video.removeEventListener("durationchange", finish);
    };
    const finish = () => {
      const next = knownDuration(video);
      if (next > 0) {
        cleanup();
        resolve(next);
      }
    };
    video.addEventListener("seeked", finish);
    video.addEventListener("durationchange", finish);
    try {
      video.currentTime = 1e101;
    } catch {
      cleanup();
      resolve(0);
    }
  });
}

export function seekVideo(video, time) {
  const duration = Number.isFinite(video.duration) ? video.duration : time;
  const target = Math.min(Math.max(0, time), Math.max(0, duration));
  if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The video stalled on a frame."));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("error", onErr);
    };
    const onSeek = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error("Could not read a frame of that video."));
    };
    video.addEventListener("seeked", onSeek);
    video.addEventListener("error", onErr);
    const same = Math.abs(video.currentTime - target) < 0.001;
    video.currentTime = same ? Math.min(duration, target + 0.001) : target;
  });
}

export function isVideoFile(file) {
  if (!file) return false;
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name || "");
}

export function stampWebmDuration(buffer, durationMs) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const ms = Math.max(1, durationMs);
  for (let i = 0; i < bytes.length - 11; i += 1) {
    if (bytes[i] !== 0x44 || bytes[i + 1] !== 0x89) continue;
    const size = bytes[i + 2];
    if (size === 0x88) {
      view.setFloat64(i + 3, ms, false);
      return true;
    }
    if (size === 0x84) {
      view.setFloat32(i + 3, ms, false);
      return true;
    }
  }
  return false;
}

export function webmMime() {
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => {
    try {
      return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) || "";
}

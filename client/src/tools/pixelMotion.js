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

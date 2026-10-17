import React, { useEffect, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { brushMask, buildSubjectMask, drawCrisp, fitSource, liftMask, offsetMask, renderPixel, traceCut, trimCeiling, trimSides } from "./pixelEngine.js";
import { CARTOON_FPS, CLIP_EDGE, CLIP_FPS, EXPORT_EDGE, LIVE_EDGE, isVideoFile, measureDuration, motionView, packFrame, portraitJpeg, seekVideo, stampWebmDuration, styleImage, webmMime } from "./pixelMotion.js";
import { LINE_GAP, MOUTH_CELLS, TALK_FPS, frameAt, lineSchedule, talkMime, voiceEnvelope } from "./pixelTalk.js";

const ROLL_KEY = "fraymus.pixel.roll";

function readRoll() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLL_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeRoll(items) {
  const next = items.slice(0, 12);
  try {
    localStorage.setItem(ROLL_KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(ROLL_KEY, JSON.stringify(next.slice(0, 4)));
  }
  return next;
}

function encodeMask(mask) {
  const runs = [];
  let value = mask[0] ? 1 : 0;
  let count = 1;
  for (let i = 1; i <= mask.length; i += 1) {
    const bit = i < mask.length && mask[i] ? 1 : 0;
    if (i < mask.length && bit === value && count < 65535) {
      count += 1;
    } else {
      runs.push(count * 2 + value);
      value = bit;
      count = 1;
    }
  }
  return runs.join(".");
}

function decodeMask(text, length) {
  const out = new Uint8Array(length);
  let index = 0;
  String(text || "").split(".").forEach((part) => {
    const n = Number(part);
    if (!n) return;
    const value = n % 2;
    const count = Math.floor(n / 2);
    if (value) out.fill(1, index, Math.min(length, index + count));
    index += count;
  });
  return out;
}

const VIEWS = [
  ["ai", "Render"],
  ["result", "Character"],
  ["trace", "Trace"],
  ["matte", "Abstract"]
];

function imageData(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function skinLike(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 40 && r >= g && g >= b * 0.8 && r - b >= 12 && r - b <= 140 && spread >= 12;
}

function skinStats(img) {
  if (!img) return null;
  const { width, height, data } = img;
  const picks = [];
  for (let y = Math.round(height * 0.12); y < Math.round(height * 0.62); y += 2) {
    for (let x = Math.round(width * 0.28); x < Math.round(width * 0.72); x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (skinLike(r, g, b)) picks.push([0.299 * r + 0.587 * g + 0.114 * b, r, g, b]);
    }
  }
  if (picks.length < 120) return null;
  picks.sort((a, b) => a[0] - b[0]);
  const mid = picks.slice(Math.floor(picks.length * 0.25), Math.ceil(picks.length * 0.75));
  const mean = [0, 0, 0];
  mid.forEach(([, r, g, b]) => { mean[0] += r; mean[1] += g; mean[2] += b; });
  return mean.map((value) => value / mid.length);
}

function matchSkin(raw, photo, shift) {
  const out = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
  const rendered = skinStats(raw);
  if (!rendered) return out;
  const target = skinStats(photo);
  const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const auto = target ? Math.min(1.1, Math.max(0.7, luma(target) / Math.max(1, luma(rendered)))) : 1;
  const gain = auto * (1 + shift / 100);
  const ratio = [gain, gain, gain];
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (!skinLike(r, g, b)) continue;
    if (Math.abs(r - rendered[0]) + Math.abs(g - rendered[1]) + Math.abs(b - rendered[2]) > 120) continue;
    d[i] = r * ratio[0];
    d[i + 1] = g * ratio[1];
    d[i + 2] = b * ratio[2];
  }
  return out;
}

function drawAi(canvas, img, lock) {
  const width = 512;
  const height = Math.round(width * img.height / img.width);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!lock) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    return;
  }
  const small = document.createElement("canvas");
  small.width = lock;
  small.height = Math.round(lock * img.height / img.width);
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(img, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, width, height);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = src;
  });
}

async function readAnyFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch {
    const response = await fetch("/api/pixel/convert", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": file.name || "upload" },
      body: file
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.image) throw new Error(body.error || `Could not open ${file.name}.`);
    return loadImage(body.image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function applySprite(project, dataUrl) {
  const css = ".pixel-portrait{display:block;width:min(420px,86vw);margin:28px auto;background:#101014;padding:16px;image-rendering:pixelated;image-rendering:crisp-edges}";
  if (project.stack !== "mern") {
    return {
      ...project,
      html: `${project.html || ""}\n<img class="pixel-portrait" alt="8-bit character" src=${JSON.stringify(dataUrl)}>\n`,
      css: `${project.css || ""}\n${css}\n`
    };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Sprite.jsx";
  const pages = next.pages.some((page) => page.name === "Sprite")
    ? next.pages
    : [...next.pages, { name: "Sprite", path: "/sprite", file, auth: false }];
  const source = `import React from "react";
export default function Sprite() {
  return (
    <main className="page">
      <p className="kicker">8-bit</p>
      <h1>Character</h1>
      <img className="pixel-portrait" alt="8-bit character" src=${JSON.stringify(dataUrl)} />
    </main>
  );
}
`;
  return {
    ...next,
    pages,
    files: {
      ...next.files,
      [file]: source,
      "client/src/styles.css": `${next.files["client/src/styles.css"] || ""}\n${css}\n`,
      "client/src/App.jsx": buildAppSource(pages)
    }
  };
}

export default function PixelPage({ project, onApply, say }) {
  const videoRef = useRef(null);
  const clipRef = useRef(null);
  const clipUrlRef = useRef("");
  const framesRef = useRef([]);
  const playIndexRef = useRef(0);
  const liveRef = useRef(false);
  const playingRef = useRef(false);
  const stylingRef = useRef(false);
  const videoCancelRef = useRef(false);
  const durationRef = useRef(0);
  const fpsRef = useRef(CLIP_FPS);
  const talkRef = useRef(false);
  const cellsRef = useRef(null);
  const linesRef = useRef([]);
  const voiceTargetRef = useRef("");
  const seedRef = useRef(null);
  const voiceFileRef = useRef(null);
  const videoFileRef = useRef(null);
  const resultRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const maskRef = useRef(null);
  const fileRef = useRef(null);
  const styleFileRef = useRef(null);
  const photoRef = useRef(null);
  const photoDataRef = useRef(null);
  const aiRawRef = useRef(null);
  const paintingRef = useRef(null);
  const editedRef = useRef(false);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [view, setView] = useState("ai");
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState("remove");
  const [brushSize, setBrushSize] = useState(10);
  const [pixelSize, setPixelSize] = useState(6);
  const [colors, setColors] = useState(32);
  const [tolerance, setTolerance] = useState(36);
  const [lift, setLift] = useState(0);
  const [saturation, setSaturation] = useState(1.55);
  const [outline, setOutline] = useState(0.4);
  const [cyan, setCyan] = useState(12);
  const [note, setNote] = useState("Drop a picture, or take one.");
  const [paletteCount, setPaletteCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hasSource, setHasSource] = useState(false);
  const [roll, setRoll] = useState(readRoll);
  const [aiImage, setAiImage] = useState(null);
  const [aiMode, setAiMode] = useState("real");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [styleRef, setStyleRef] = useState(null);
  const [lock, setLock] = useState(0);
  const [skin, setSkin] = useState(0);
  const [clip, setClip] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoJob, setVideoJob] = useState("");
  const [videoProgress, setVideoProgress] = useState({ done: 0, total: 0 });
  const [talkReady, setTalkReady] = useState(false);
  const [lines, setLines] = useState([]);
  const [lineText, setLineText] = useState("");

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => setNote("The camera preview could not start."));
  }, [cameraOn]);

  async function useSource(img) {
    const fitted = fitSource(img);
    sourceRef.current = fitted;
    photoDataRef.current = fitted;
    aiRawRef.current = null;
    photoRef.current = imageData(img, 768);
    setAiImage(null);
    setAiNote("");
    editedRef.current = false;
    const base = buildSubjectMask(fitted, tolerance);
    maskRef.current = lift > 0 ? liftMask(fitted, base, Math.round(lift / 6)) : base;
    setHasSource(true);
    setNote(`${img.width}×${img.height} source`);
    paint();
  }

  function motionOptions() {
    return { pixelSize: Math.min(2, pixelSize), colors, tolerance, saturation, outline, cyan, view: motionView(view) };
  }

  function paint() {
    if (liveRef.current || playingRef.current || stylingRef.current || talkRef.current) return;
    const source = sourceRef.current;
    const canvas = resultRef.current;
    if (!source || !canvas) return;
    if (view === "ai") {
      if (aiImage) {
        drawAi(canvas, aiComposite(), editing ? 0 : lock);
        return;
      }
      if (!editing) {
        drawCrisp(canvas, source, 520);
        return;
      }
    }
    const made = renderPixel(source, {
      pixelSize,
      colors,
      tolerance,
      saturation,
      outline,
      cyan,
      mask: maskRef.current
    });
    setPaletteCount(made.palette);
    const shown = editing ? made.matte : view === "trace" ? made.trace : view === "matte" ? made.abstract : made.result;
    drawCrisp(canvas, shown, editing ? 420 : 520);
    if (made.empty) setNote("The frame was all background. Lower Background, or paint Keep.");
  }

  useEffect(() => {
    const source = sourceRef.current;
    if (source && !paintingRef.current && !aiRawRef.current) {
      const base = buildSubjectMask(source, tolerance);
      maskRef.current = lift > 0 ? liftMask(source, base, Math.round(lift / 6)) : base;
      editedRef.current = false;
    }
    paint();
  }, [tolerance, lift]);

  useEffect(() => {
    paint();
  }, [pixelSize, colors, saturation, outline, cyan, view, editing, aiImage, lock]);

  useEffect(() => {
    if (!cameraOn) return undefined;
    liveRef.current = true;
    playingRef.current = false;
    let stop = false;
    let frames = 0;
    let stamp = performance.now();
    let busy = false;
    const tick = () => {
      if (stop) return;
      if (!busy) {
        const video = videoRef.current;
        if (video?.videoWidth) {
          busy = true;
          try {
            const styled = styleImage(video, motionOptions(), LIVE_EDGE);
            if (resultRef.current) drawCrisp(resultRef.current, styled.shown, 520);
            frames += 1;
            const now = performance.now();
            if (now - stamp >= 1000) {
              setPaletteCount(styled.palette);
              setNote(`Live 8-bit · ${frames} fps. Shutter saves this moment into the editor.`);
              frames = 0;
              stamp = now;
            }
          } catch {
            setNote("Waiting for the camera frame.");
          }
          busy = false;
        }
      }
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      stop = true;
      liveRef.current = false;
      cancelAnimationFrame(id);
    };
  }, [cameraOn, pixelSize, colors, tolerance, saturation, outline, cyan, view]);

  useEffect(() => {
    playingRef.current = playing;
    if (!playing) return undefined;
    const frames = framesRef.current;
    if (!frames.length) return undefined;
    liveRef.current = false;
    let index = playIndexRef.current % frames.length;
    let last = 0;
    let raf = 0;
    const step = 1000 / fpsRef.current;
    const loop = (now) => {
      if (!playingRef.current) return;
      if (now - last >= step) {
        last = now;
        const frame = frames[index];
        if (resultRef.current && frame) drawCrisp(resultRef.current, frame, 520);
        playIndexRef.current = index;
        index = (index + 1) % frames.length;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, frameCount]);

  function aiComposite() {
    const src = sourceRef.current;
    const mask = maskRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i]) continue;
      out.data[i * 4] = 0;
      out.data[i * 4 + 1] = 0;
      out.data[i * 4 + 2] = 0;
      out.data[i * 4 + 3] = 255;
    }
    canvas.getContext("2d").putImageData(out, 0, 0);
    return canvas;
  }

  function adoptAi(img, shift = skin) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round(512 * img.height / img.width);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    aiRawRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    sourceRef.current = matchSkin(aiRawRef.current, photoDataRef.current, shift);
    maskRef.current = new Uint8Array(canvas.width * canvas.height).fill(1);
    editedRef.current = false;
    undoRef.current = [];
    redoRef.current = [];
  }

  useEffect(() => {
    if (!aiRawRef.current || !aiImage) return;
    sourceRef.current = matchSkin(aiRawRef.current, photoDataRef.current, skin);
    paint();
  }, [skin]);

  function toggleEdit() {
    if (editing) {
      setEditing(false);
      return;
    }
    undoRef.current = [];
    redoRef.current = [];
    if (!(view === "ai" && aiImage)) setView("matte");
    setEditing(true);
  }

  async function aiRender() {
    if (!photoRef.current || aiBusy) return;
    setAiBusy(true);
    setEditing(false);
    setView("ai");
    setAiNote("Rendering… about 10 seconds.");
    try {
      const response = await fetch("/api/pixel/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photoRef.current, style: styleRef, mode: aiMode })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Render failed (${response.status})`);
      const rendered = await loadImage(body.image);
      adoptAi(rendered);
      setAiImage(rendered);
      if (Number.isInteger(body.seed)) seedRef.current = body.seed;
      setAiNote(`AI render ready · seed ${body.seed}. Render again for another take.`);
      say?.("ok", "AI render ready");
    } catch (error) {
      setAiNote(error.message);
      say?.("error", error.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function onStyleFile(file) {
    if (!file) return;
    try {
      setStyleRef(imageData(await readAnyFile(file), 512));
      setAiNote("Style reference set. The render copies its drawing style.");
    } catch (error) {
      setAiNote(error.message);
    }
  }

  async function onFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      setNote(`Opening ${file.name}…`);
      await useSource(await readAnyFile(file));
      say?.("ok", "Picture loaded");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      playingRef.current = false;
      setPlaying(false);
      setCameraOn(true);
      setNote("Camera live. The stage shows the 8-bit filter. Shutter saves the photo into the editor.");
    } catch (error) {
      setNote(error.name === "NotAllowedError" ? "Camera permission was blocked." : "No camera is available.");
      say?.("error", "Camera unavailable");
    }
  }

  function stopCamera() {
    liveRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function shutter() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    liveRef.current = false;
    stopCamera();
    const img = await loadImage(canvas.toDataURL("image/png"));
    await useSource(img);
    say?.("ok", "Picture taken");
  }

  async function onVideoFile(file) {
    if (!file) return;
    if (!isVideoFile(file)) {
      setNote("That file is not a video. Use MP4, WebM, or MOV.");
      return;
    }
    stopCamera();
    playingRef.current = false;
    setPlaying(false);
    framesRef.current = [];
    setFrameCount(0);
    playIndexRef.current = 0;
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    const url = URL.createObjectURL(file);
    clipUrlRef.current = url;
    const video = clipRef.current;
    if (!video) return;
    setBusy(true);
    try {
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("error", onErr);
        };
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onErr = () => {
          cleanup();
          reject(new Error("That video could not be opened."));
        };
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("error", onErr);
        video.src = url;
        video.load();
      });
      const duration = await measureDuration(video);
      if (!(duration > 0)) throw new Error("That video has no readable length.");
      await seekVideo(video, 0);
      durationRef.current = duration;
      const next = {
        name: file.name,
        duration,
        width: video.videoWidth,
        height: video.videoHeight
      };
      setClip(next);
      const frames = Math.max(1, Math.ceil(next.duration * CLIP_FPS));
      setNote(`${next.name} · ${next.duration.toFixed(1)}s · ${frames} frames at ${CLIP_FPS} fps. Style video keeps the face large and uses 2-pixel blocks on every frame.`);
    } catch (error) {
      setClip(null);
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function styleClip() {
    const video = clipRef.current;
    const duration = durationRef.current;
    if (!video || !(duration > 0)) return;
    stopCamera();
    playingRef.current = false;
    setPlaying(false);
    videoCancelRef.current = false;
    stylingRef.current = true;
    setVideoJob("style");
    setVideoBusy(true);
    const total = Math.max(1, Math.ceil(duration * CLIP_FPS));
    const made = [];
    fpsRef.current = CLIP_FPS;
    const options = motionOptions();
    setVideoProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i += 1) {
        if (videoCancelRef.current) throw new Error("Stopped.");
        const time = Math.min(Math.max(0, duration - 0.05), i / CLIP_FPS);
        await seekVideo(video, time);
        const styled = styleImage(video, options, CLIP_EDGE);
        const packed = packFrame(styled.shown);
        made.push(packed);
        if (resultRef.current) drawCrisp(resultRef.current, packed, 520);
        setPaletteCount(styled.palette);
        setVideoProgress({ done: i + 1, total });
        setNote(`Styling frame ${i + 1} of ${total}.`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      framesRef.current = made;
      playIndexRef.current = 0;
      setFrameCount(made.length);
      stylingRef.current = false;
      setPlaying(true);
      say?.("ok", `${made.length} frames styled`);
    } catch (error) {
      stylingRef.current = false;
      if (made.length) {
        framesRef.current = made;
        setFrameCount(made.length);
      }
      setNote(error.message === "Stopped." ? `Stopped at frame ${made.length} of ${total}.` : error.message);
      if (error.message !== "Stopped.") say?.("error", error.message);
    } finally {
      stylingRef.current = false;
      setVideoJob("");
      setVideoBusy(false);
    }
  }

  async function cartoonClip() {
    const video = clipRef.current;
    const duration = durationRef.current;
    if (!video || !(duration > 0)) return;
    stopCamera();
    playingRef.current = false;
    setPlaying(false);
    videoCancelRef.current = false;
    stylingRef.current = true;
    setVideoJob("cartoon");
    setVideoBusy(true);
    const total = Math.max(1, Math.ceil(duration * CARTOON_FPS));
    const made = [];
    let seed = null;
    fpsRef.current = CARTOON_FPS;
    setVideoProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i += 1) {
        if (videoCancelRef.current) throw new Error("Stopped.");
        const time = Math.min(Math.max(0, duration - 0.05), i / CARTOON_FPS);
        await seekVideo(video, time);
        setNote(`Cartoon frame ${i + 1} of ${total}. The model redraws each frame, about 10 seconds.`);
        const response = await fetch("/api/pixel/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: portraitJpeg(video, 768),
            style: styleRef,
            mode: aiMode,
            seed,
            note: "One frame of a video. Keep this exact character, palette, hat and clothes. Only the pose changes between frames."
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Render failed (${response.status})`);
        if (Number.isInteger(body.seed)) seed = body.seed;
        const rendered = await loadImage(body.image);
        const canvas = document.createElement("canvas");
        canvas.width = rendered.width;
        canvas.height = rendered.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(rendered, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        made.push(frame);
        if (resultRef.current) drawCrisp(resultRef.current, frame, 520);
        setVideoProgress({ done: i + 1, total });
      }
      framesRef.current = made;
      playIndexRef.current = 0;
      setFrameCount(made.length);
      stylingRef.current = false;
      setPlaying(true);
      setNote(`Cartoon ready · ${made.length} frames · seed ${seed}.`);
      say?.("ok", `${made.length} cartoon frames`);
    } catch (error) {
      stylingRef.current = false;
      if (made.length) {
        framesRef.current = made;
        setFrameCount(made.length);
      }
      setNote(error.message === "Stopped." ? `Stopped at cartoon frame ${made.length} of ${total}.` : error.message);
      if (error.message !== "Stopped.") say?.("error", error.message);
    } finally {
      stylingRef.current = false;
      setVideoJob("");
      setVideoBusy(false);
    }
  }

  async function downloadClip() {
    const frames = framesRef.current;
    if (!frames.length) return;
    const mime = webmMime();
    if (!mime) {
      setNote("This browser cannot record WebM. Edit this frame, then use PNG.");
      return;
    }
    setVideoJob("export");
    setVideoBusy(true);
    playingRef.current = false;
    setPlaying(false);
    try {
      const canvas = document.createElement("canvas");
      drawCrisp(canvas, frames[0], EXPORT_EDGE);
      const stream = canvas.captureStream(0);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      const chunks = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise((resolve) => {
        rec.onstop = resolve;
      });
      rec.start();
      const track = stream.getVideoTracks()[0];
      for (let i = 0; i < frames.length; i += 1) {
        drawCrisp(canvas, frames[i], EXPORT_EDGE);
        if (resultRef.current) drawCrisp(resultRef.current, frames[i], 520);
        if (typeof track.requestFrame === "function") track.requestFrame();
        setNote(`Writing WebM frame ${i + 1} of ${frames.length}.`);
        await new Promise((resolve) => setTimeout(resolve, Math.round(1000 / fpsRef.current)));
      }
      if (typeof rec.requestData === "function") rec.requestData();
      rec.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      const raw = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
      const durationMs = Math.round((frames.length / fpsRef.current) * 1000);
      stampWebmDuration(raw, durationMs);
      const blob = new Blob([raw], { type: "video/webm" });
      if (blob.size < 100) throw new Error("The WebM file came out empty.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "fraymus-8bit.webm";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      setNote(`Saved fraymus-8bit.webm · ${frames.length} frames · ${fpsRef.current} fps.`);
      say?.("ok", "8-bit video saved");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      setVideoJob("");
      setVideoBusy(false);
    }
  }

  async function useClipFrame() {
    const video = clipRef.current;
    if (!video?.videoWidth) return;
    playingRef.current = false;
    setPlaying(false);
    stylingRef.current = false;
    const time = Math.min(Math.max(0, (durationRef.current || video.duration) - 0.05), playIndexRef.current / fpsRef.current);
    try {
      await seekVideo(video, time);
    } catch (error) {
      setNote(error.message);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const img = await loadImage(canvas.toDataURL("image/png"));
    await useSource(img);
    say?.("ok", "Frame loaded into the editor");
  }

  function spriteJpeg() {
    if (!aiImage) return "";
    const canvas = document.createElement("canvas");
    drawAi(canvas, aiComposite(), lock);
    const scale = Math.min(1, 768 / Math.max(canvas.width, canvas.height));
    const chip = document.createElement("canvas");
    chip.width = Math.max(1, Math.round(canvas.width * scale));
    chip.height = Math.max(1, Math.round(canvas.height * scale));
    chip.getContext("2d").drawImage(canvas, 0, 0, chip.width, chip.height);
    return chip.toDataURL("image/jpeg", 0.92);
  }

  async function imageDataFromUrl(url) {
    const rendered = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(rendered, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function drawTalkCell(canvas, id, size, caption = "") {
    const cells = cellsRef.current;
    const frame = cells?.[id] || cells?.closed;
    if (!frame || !canvas) return;
    drawCrisp(canvas, frame, size);
    if (!caption) return;
    const ctx = canvas.getContext("2d");
    const bar = Math.max(36, Math.round(canvas.height * 0.12));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
    ctx.fillStyle = "#e7eee8";
    ctx.font = `${Math.max(14, Math.round(bar * 0.42))}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = caption.length > 48 ? `${caption.slice(0, 47)}…` : caption;
    ctx.fillText(text, canvas.width / 2, canvas.height - bar / 2);
  }

  function showLines(next) {
    linesRef.current = next;
    setLines(next.map((line) => ({
      id: line.id,
      text: line.text,
      name: line.name,
      duration: line.audio ? line.audio.duration : 0
    })));
  }

  function spokenLines() {
    return linesRef.current.filter((line) => line.audio);
  }

  async function buildTalk() {
    if (!aiImage || videoBusy) {
      setNote("AI Render the sprite first. The mouth buffer copies that picture.");
      return;
    }
    const image = spriteJpeg();
    if (!image) return;
    stopCamera();
    playingRef.current = false;
    setPlaying(false);
    talkRef.current = false;
    videoCancelRef.current = false;
    stylingRef.current = true;
    setVideoJob("talk");
    setVideoBusy(true);
    const cells = {};
    let seed = seedRef.current;
    setVideoProgress({ done: 0, total: MOUTH_CELLS.length });
    try {
      for (let i = 0; i < MOUTH_CELLS.length; i += 1) {
        if (videoCancelRef.current) throw new Error("Stopped.");
        const cell = MOUTH_CELLS[i];
        setNote(`Mouth ${cell.id} · ${i + 1} of ${MOUTH_CELLS.length}.`);
        const response = await fetch("/api/pixel/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            style: image,
            mode: aiMode,
            seed,
            note: cell.note
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Render failed (${response.status})`);
        if (Number.isInteger(body.seed)) {
          seed = body.seed;
          seedRef.current = body.seed;
        }
        cells[cell.id] = await imageDataFromUrl(body.image);
        if (resultRef.current) drawCrisp(resultRef.current, cells[cell.id], 520);
        setVideoProgress({ done: i + 1, total: MOUTH_CELLS.length });
      }
      cellsRef.current = cells;
      setTalkReady(true);
      stylingRef.current = false;
      setNote("Mouth buffer ready · closed, mid, open, blink. Add a line, then a voice. Play does not call the model.");
      say?.("ok", "Mouth buffer ready");
    } catch (error) {
      stylingRef.current = false;
      setNote(error.message === "Stopped." ? "Mouth buffer stopped." : error.message);
      if (error.message !== "Stopped.") say?.("error", error.message);
    } finally {
      stylingRef.current = false;
      setVideoJob("");
      setVideoBusy(false);
    }
  }

  function addLine() {
    const text = lineText.trim();
    if (!text) {
      setNote("Write the line, then add it.");
      return;
    }
    const line = { id: `L${Date.now().toString(36)}`, text, name: "", audio: null, envelope: [] };
    showLines([...linesRef.current, line]);
    setLineText("");
    voiceTargetRef.current = line.id;
    setNote(`“${text}” is on the timeline. Attach a voice.`);
  }

  function removeLine(id) {
    showLines(linesRef.current.filter((line) => line.id !== id));
  }

  async function onVoiceFile(file) {
    if (!file) return;
    const target = voiceTargetRef.current || linesRef.current.find((line) => !line.audio)?.id;
    if (!target) {
      setNote("Add a line first, then attach the voice.");
      return;
    }
    try {
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(await file.arrayBuffer());
      await ctx.close();
      const next = linesRef.current.map((line) => (
        line.id === target ? { ...line, name: file.name, audio, envelope: voiceEnvelope(audio) } : line
      ));
      showLines(next);
      voiceTargetRef.current = "";
      setNote(`${file.name} · ${audio.duration.toFixed(1)}s on that line.`);
    } catch {
      setNote("That audio could not be read. Use WAV, MP3, or M4A.");
    }
  }

  function stopTalk() {
    talkRef.current = false;
  }

  async function mixLines(parts) {
    const plan = lineSchedule(parts, LINE_GAP);
    const rate = 44100;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(plan.duration * rate)), rate);
    parts.forEach((line, index) => {
      const src = offline.createBufferSource();
      src.buffer = line.audio;
      src.connect(offline.destination);
      src.start(plan.captions[index].start);
    });
    const audio = await offline.startRendering();
    return { audio, ...plan };
  }

  async function playTalk() {
    const parts = spokenLines();
    if (!cellsRef.current?.closed || !parts.length) {
      setNote(cellsRef.current?.closed ? "Add a line and a voice first." : "Build the mouth buffer first.");
      return;
    }
    stopCamera();
    playingRef.current = false;
    setPlaying(false);
    talkRef.current = false;
    const { audio, captions } = await mixLines(parts);
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.destination);
    talkRef.current = true;
    const start = ctx.currentTime;
    src.start();
    const loop = () => {
      if (!talkRef.current) {
        try { src.stop(); } catch { /* already stopped */ }
        ctx.close().catch(() => {});
        return;
      }
      const time = ctx.currentTime - start;
      if (time >= audio.duration) {
        talkRef.current = false;
        ctx.close().catch(() => {});
        setNote("Lines finished.");
        return;
      }
      const frame = frameAt(captions, time);
      drawTalkCell(resultRef.current, frame.id, 520, frame.text);
      requestAnimationFrame(loop);
    };
    src.onended = () => {
      talkRef.current = false;
      ctx.close().catch(() => {});
    };
    requestAnimationFrame(loop);
  }

  async function downloadTalk() {
    const parts = spokenLines();
    if (!cellsRef.current?.closed || !parts.length) return;
    const mime = talkMime();
    if (!mime) {
      setNote("This browser cannot record WebM.");
      return;
    }
    talkRef.current = false;
    playingRef.current = false;
    setPlaying(false);
    setVideoJob("export");
    setVideoBusy(true);
    const audioCtx = new AudioContext();
    try {
      const { audio, captions, duration } = await mixLines(parts);
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createBufferSource();
      src.buffer = audio;
      src.connect(dest);
      const canvas = document.createElement("canvas");
      drawTalkCell(canvas, "closed", EXPORT_EDGE, captions[0]?.text || "");
      const videoStream = canvas.captureStream(0);
      const mixed = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise((resolve) => {
        rec.onstop = resolve;
      });
      rec.start();
      src.start();
      const track = videoStream.getVideoTracks()[0];
      const total = Math.max(1, Math.ceil(duration * TALK_FPS));
      for (let i = 0; i < total; i += 1) {
        const frame = frameAt(captions, i / TALK_FPS);
        drawTalkCell(canvas, frame.id, EXPORT_EDGE, frame.text);
        if (resultRef.current) drawTalkCell(resultRef.current, frame.id, 520, frame.text);
        if (typeof track.requestFrame === "function") track.requestFrame();
        setNote(`Writing talk frame ${i + 1} of ${total}.`);
        await new Promise((resolve) => setTimeout(resolve, Math.round(1000 / TALK_FPS)));
      }
      try { src.stop(); } catch { /* already ended */ }
      if (typeof rec.requestData === "function") rec.requestData();
      rec.stop();
      await stopped;
      mixed.getTracks().forEach((item) => item.stop());
      const raw = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
      stampWebmDuration(raw, Math.round(duration * 1000));
      const blob = new Blob([raw], { type: "video/webm" });
      if (blob.size < 100) throw new Error("The WebM file came out empty.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "fraymus-talk.webm";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      setNote(`Saved fraymus-talk.webm · ${parts.length} lines · ${duration.toFixed(1)}s.`);
      say?.("ok", "Talking avatar saved");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      audioCtx.close().catch(() => {});
      setVideoJob("");
      setVideoBusy(false);
    }
  }

  function characterCanvas() {
    const source = sourceRef.current;
    if (!source) return null;
    if (view === "ai" && aiImage) {
      const canvas = document.createElement("canvas");
      drawAi(canvas, aiComposite(), lock);
      return canvas;
    }
    const made = renderPixel(source, { pixelSize, colors, tolerance, saturation, outline, cyan, mask: maskRef.current });
    const canvas = document.createElement("canvas");
    drawCrisp(canvas, made.result, 512);
    return canvas;
  }

  function download() {
    const canvas = view === "result" && !editing ? resultRef.current : characterCanvas();
    if (!canvas?.width) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "fraymus-8bit.png";
    link.click();
  }

  function saveRoll() {
    const source = sourceRef.current;
    const mask = maskRef.current;
    const canvas = characterCanvas();
    if (!source || !mask || !canvas) return;
    const sheet = document.createElement("canvas");
    sheet.width = source.width;
    sheet.height = source.height;
    sheet.getContext("2d").putImageData(source, 0, 0);
    const item = {
      id: `px_${Date.now()}`,
      name: `Character ${roll.length + 1}`,
      png: canvas.toDataURL("image/png"),
      source: sheet.toDataURL("image/jpeg", 0.72),
      mask: encodeMask(mask),
      width: source.width,
      height: source.height
    };
    const next = writeRoll([item, ...roll]);
    setRoll(next);
    say?.("ok", "Saved to the roll");
    setNote("Saved to the roll. Click a frame to bring it back.");
  }

  async function openRoll(item) {
    setBusy(true);
    try {
      const img = await loadImage(item.source);
      const fitted = fitSource(img);
      sourceRef.current = fitted;
      photoDataRef.current = fitted;
      aiRawRef.current = null;
      photoRef.current = imageData(img, 768);
      setAiImage(null);
      const restored = decodeMask(item.mask, fitted.width * fitted.height);
      maskRef.current = restored.length === fitted.width * fitted.height && restored.some((bit) => bit)
        ? restored
        : buildSubjectMask(fitted, tolerance);
      if (fitted.width !== item.width || fitted.height !== item.height) maskRef.current = buildSubjectMask(fitted, tolerance);
      editedRef.current = true;
      setHasSource(true);
      setEditing(false);
      setView("result");
      setNote(item.name);
      paint();
    } catch (error) {
      setNote(error.message);
    } finally {
      setBusy(false);
    }
  }

  function removeBackground() {
    if (!sourceRef.current) return;
    const amount = Math.max(lift, 72);
    if (amount === lift) {
      const source = sourceRef.current;
      maskRef.current = liftMask(source, buildSubjectMask(source, tolerance), Math.round(amount / 6));
      paint();
    }
    setLift(amount);
    setNote("Background lifted. Edit, then trace anything still behind the person.");
  }

  function editSource() {
    return sourceRef.current;
  }

  function editMask() {
    return maskRef.current;
  }

  function setEditMask(mask) {
    maskRef.current = mask;
  }

  function pointerPoint(event) {
    const canvas = resultRef.current;
    const source = editSource();
    if (!canvas || !source) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [
      (event.clientX - rect.left) / rect.width * source.width,
      (event.clientY - rect.top) / rect.height * source.height
    ];
  }

  function onPointerDown(event) {
    const mask = editMask();
    if (!editing || !mask) return;
    const point = pointerPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    undoRef.current.push(mask.slice());
    if (undoRef.current.length > 24) undoRef.current.shift();
    redoRef.current = [];
    paintingRef.current = { points: [point] };
    if (brush !== "trace") {
      const source = editSource();
      brushMask(mask, source.width, source.height, point[0], point[1], brushSize, brush === "keep");
      editedRef.current = true;
      paint();
    }
  }

  function onPointerMove(event) {
    const stroke = paintingRef.current;
    if (!stroke || !editing) return;
    const point = pointerPoint(event);
    if (!point) return;
    stroke.points.push(point);
    const source = editSource();
    const radius = brush === "trace" ? Math.max(2, Math.round(brushSize * 0.45)) : brushSize;
    brushMask(editMask(), source.width, source.height, point[0], point[1], radius, brush === "keep");
    editedRef.current = true;
    paint();
  }

  function onPointerUp() {
    const stroke = paintingRef.current;
    paintingRef.current = null;
    const source = editSource();
    const mask = editMask();
    if (!stroke || brush !== "trace" || !source || !mask) return;
    traceCut(source, mask, stroke.points, Math.max(2, Math.round(brushSize * 0.45)));
    editedRef.current = true;
    setNote("Trace applied. The stroke and matching nearby color left the character.");
    paint();
  }

  function undoMask() {
    const prev = undoRef.current.pop();
    const mask = editMask();
    if (!prev || !mask) return;
    redoRef.current.push(mask.slice());
    setEditMask(prev);
    editedRef.current = true;
    setNote("Undid the last stroke.");
    paint();
  }

  function redoMask() {
    const next = redoRef.current.pop();
    const mask = editMask();
    if (!next || !mask) return;
    undoRef.current.push(mask.slice());
    setEditMask(next);
    editedRef.current = true;
    setNote("Redid the stroke.");
    paint();
  }

  function nudgeMask(steps) {
    const source = editSource();
    const mask = editMask();
    if (!source || !mask) return;
    undoRef.current.push(mask.slice());
    setEditMask(offsetMask(mask, source.width, source.height, steps));
    editedRef.current = true;
    setNote(steps > 0 ? "Mask expanded." : "Mask contracted.");
    paint();
  }

  function reshape(kind) {
    const source = editSource();
    const mask = editMask();
    if (!source || !mask) return;
    undoRef.current.push(mask.slice());
    if (undoRef.current.length > 24) undoRef.current.shift();
    redoRef.current = [];
    setEditMask(kind === "ceiling" ? trimCeiling(source, mask) : trimSides(source, mask));
    editedRef.current = true;
    setNote(kind === "ceiling" ? "Cleared the light strip above the hat." : "Cleared pale bars beside the shoulders.");
    paint();
  }

  function place() {
    const canvas = characterCanvas();
    if (!canvas?.width || !project) return;
    onApply(applySprite(project, canvas.toDataURL("image/png")));
    say?.("ok", "8-bit character placed in the project");
    setNote("Placed in the project. Open Code to see it.");
  }

  return (
    <div className="tool">
      <aside className="tool-side">
        <p className="fh">Capture</p>
        <p className="muted">Style video is the fast pixel filter. Cartoon video is the AI sprite, the same drawing as AI Render, two frames a second with one locked seed.</p>
        <input ref={fileRef} hidden type="file" accept="image/*,.heic,.tif,.tiff,.pdf,.psd,.doc,.docx,.pages,.key" onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={videoFileRef} hidden type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={(event) => { onVideoFile(event.target.files?.[0]); event.target.value = ""; }} />
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy || videoBusy}>New picture</button>
        <button className="btn" onClick={() => videoFileRef.current?.click()} disabled={busy || videoBusy}>New video</button>
        {!cameraOn && <button className="btn" onClick={startCamera} disabled={videoBusy}>Take picture</button>}
        {cameraOn && (
          <div className="stack">
            <video ref={videoRef} className="pixel-video" playsInline muted autoPlay />
            <p className="muted">Raw camera. The stage is the 8-bit view.</p>
            <div className="row">
              <button className="btn on" onClick={shutter}>Shutter</button>
              <button className="btn" onClick={stopCamera}>Stop</button>
            </div>
          </div>
        )}
        {clip && (
          <div className="stack">
            <p className="muted">{clip.name} · {clip.duration.toFixed(1)}s · {clip.width}×{clip.height}</p>
            <button className="btn" onClick={styleClip} disabled={videoBusy}>{videoJob === "style" ? `Frame ${videoProgress.done}/${videoProgress.total}` : videoJob === "export" ? "Saving WebM…" : "Style video"}</button>
            <button className="btn on" onClick={cartoonClip} disabled={videoBusy}>{videoJob === "cartoon" ? `Cartoon ${videoProgress.done}/${videoProgress.total}` : "Cartoon video"}</button>
            {(videoJob === "style" || videoJob === "cartoon") && <button className="btn" onClick={() => { videoCancelRef.current = true; }}>Stop</button>}
            <div className="row">
              <button className="btn" onClick={() => setPlaying((on) => !on)} disabled={!frameCount || videoBusy}>{playing ? "Pause" : "Play"}</button>
              <button className="btn" onClick={downloadClip} disabled={!frameCount || videoBusy}>WebM</button>
            </div>
            <button className="btn" onClick={useClipFrame} disabled={videoBusy}>Edit this frame</button>
          </div>
        )}
        <p className="fh">Talk</p>
        <p className="muted">Four frames from the AI sprite. Each line has words and a voice. A vowel opens the mouth. Play and WebM do not call the model.</p>
        <button className="btn on" onClick={buildTalk} disabled={videoBusy || aiBusy || !aiImage}>{videoJob === "talk" ? `Mouth ${videoProgress.done}/${videoProgress.total}` : talkReady ? "Rebuild mouth buffer" : "Build mouth buffer"}</button>
        {videoJob === "talk" && <button className="btn" onClick={() => { videoCancelRef.current = true; }}>Stop</button>}
        <label className="field">Line
          <input value={lineText} placeholder="What they say" onChange={(event) => setLineText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addLine(); }} />
        </label>
        <button className="btn" onClick={addLine} disabled={videoBusy}>Add line</button>
        <input ref={voiceFileRef} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.aac" onChange={(event) => { onVoiceFile(event.target.files?.[0]); event.target.value = ""; }} />
        {lines.map((line) => (
          <div className="row" key={line.id}>
            <span className="muted">{line.text}</span>
            <button className="btn" disabled={videoBusy} onClick={() => { voiceTargetRef.current = line.id; voiceFileRef.current?.click(); }}>{line.name ? `${line.duration.toFixed(1)}s` : "Voice"}</button>
            <button className="btn" disabled={videoBusy} onClick={() => removeLine(line.id)}>×</button>
          </div>
        ))}
        <div className="row">
          <button className="btn" onClick={playTalk} disabled={!talkReady || !lines.some((line) => line.duration) || videoBusy}>Play</button>
          <button className="btn" onClick={stopTalk} disabled={!talkReady}>Stop</button>
          <button className="btn" onClick={downloadTalk} disabled={!talkReady || !lines.some((line) => line.duration) || videoBusy}>WebM</button>
        </div>
        <p className="fh">AI render</p>
        <div className="seg">
          <button className={aiMode === "real" ? "on" : ""} onClick={() => setAiMode("real")}>Real outfit</button>
          <button className={aiMode === "avatar" ? "on" : ""} onClick={() => setAiMode("avatar")}>Avatar</button>
        </div>
        <button className="btn on" onClick={aiRender} disabled={!hasSource || aiBusy}>{aiBusy ? "Rendering…" : "AI Render"}</button>
        <input ref={styleFileRef} hidden type="file" onChange={(event) => { onStyleFile(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="row">
          <button className="btn" onClick={() => styleFileRef.current?.click()}>{styleRef ? "Change style ref" : "Style reference"}</button>
          {styleRef && <button className="btn" onClick={() => setStyleRef(null)}>Clear</button>}
        </div>
        {styleRef && <img className="pixel-styleref" src={styleRef} alt="Style reference" />}
        <label className="field">Skin {skin === 0 ? "match photo" : skin > 0 ? `+${skin} lighter` : `${skin} darker`}
          <input type="range" min={-40} max={40} step={2} value={skin} onChange={(event) => setSkin(Number(event.target.value))} />
        </label>
        <label className="field">Pixel lock {lock ? `${lock} wide` : "off"}
          <input type="range" min={0} max={160} step={8} value={lock} onChange={(event) => setLock(Number(event.target.value) < 48 ? 0 : Number(event.target.value))} />
        </label>
        <p className="fh">Background</p>
        <button className="btn on" onClick={removeBackground} disabled={!hasSource}>Remove background</button>
        <label className="field">Lift {lift}
          <input type="range" min={0} max={84} step={6} value={lift} onChange={(event) => setLift(Number(event.target.value))} />
        </label>
        <label className="field">Reach {tolerance}
          <input type="range" min={8} max={78} value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
        </label>
        <p className="fh">Pixel portrait</p>
        <label className="field">Block {pixelSize}
          <input type="range" min={2} max={12} value={pixelSize} onChange={(event) => setPixelSize(Number(event.target.value))} />
        </label>
        <label className="field">Colors {colors}
          <input type="range" min={12} max={40} value={colors} onChange={(event) => setColors(Number(event.target.value))} />
        </label>
        <label className="field">Saturation {saturation.toFixed(2)}
          <input type="range" min={1} max={2.2} step={0.05} value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} />
        </label>
        <label className="field">Outline {outline.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={outline} onChange={(event) => setOutline(Number(event.target.value))} />
        </label>
        <label className="field">Cyan {cyan}
          <input type="range" min={0} max={28} value={cyan} onChange={(event) => setCyan(Number(event.target.value))} />
        </label>
      </aside>
      <section
        className="tool-main"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          if (isVideoFile(file)) onVideoFile(file);
          else onFile(file);
        }}
      >
        <div className="codebar pixel-bar">
          <b>8-bit</b>
          <span className="muted">{paletteCount ? `${paletteCount} colors` : "character studio"}</span>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy || videoBusy}>New picture</button>
          <button className="btn" onClick={() => videoFileRef.current?.click()} disabled={busy || videoBusy}>New video</button>
          <button className="btn on" onClick={aiRender} disabled={!hasSource || aiBusy}>{aiBusy ? "Rendering…" : "AI Render"}</button>
          <button className={`btn ${editing ? "on" : ""}`} onClick={toggleEdit} disabled={!hasSource}>Edit</button>
          <button className="btn" onClick={removeBackground} disabled={!hasSource}>Remove background</button>
          <span className="spacer" />
          <div className="seg">
            {VIEWS.map(([id, label]) => (
              <button key={id} className={!editing && view === id ? "on" : ""} onClick={() => { setEditing(false); setView(id); }}>{label}</button>
            ))}
          </div>
          <button className="btn" onClick={saveRoll} disabled={!hasSource}>Save</button>
          <button className="btn" onClick={download} disabled={!hasSource}>PNG</button>
          <button className="btn on" onClick={place} disabled={!project || !hasSource}>Place in project</button>
        </div>
        {editing && (
          <div className="pixel-editbar">
            <span className="muted">Cursor</span>
            {[["remove", "Remove"], ["keep", "Keep"], ["trace", "Trace"]].map(([id, label]) => (
              <button key={id} className={`btn ${brush === id ? "on" : ""}`} onClick={() => setBrush(id)}>{label}</button>
            ))}
            <label className="field pixel-size">Size {brushSize}
              <input type="range" min={2} max={36} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
            <button className="btn" onClick={undoMask}>Undo</button>
            <button className="btn" onClick={redoMask}>Redo</button>
            <button className="btn" onClick={() => nudgeMask(1)}>Expand</button>
            <button className="btn" onClick={() => nudgeMask(-1)}>Contract</button>
            <button className="btn" onClick={() => reshape("ceiling")}>Ceiling</button>
            <button className="btn" onClick={() => reshape("sides")}>Sides</button>
          </div>
        )}
        <div
          className={`pixel-stage${editing ? " editing" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <canvas ref={resultRef} aria-label="8-bit character" />
          <video ref={clipRef} className="pixel-clip" playsInline muted />
          {!hasSource && !cameraOn && !frameCount && !videoBusy && <p className="pixel-empty">{note}</p>}
        </div>
        <div className="pixel-roll" aria-label="Gallery">
          {!roll.length && <span className="muted">Roll is empty. Save a character to keep it here.</span>}
          {roll.map((item) => (
            <button key={item.id} title={item.name} onClick={() => openRoll(item)}>
              <img src={item.png} alt={item.name} />
              <span className="x" onClick={(event) => {
                event.stopPropagation();
                setRoll(writeRoll(roll.filter((entry) => entry.id !== item.id)));
              }}>×</span>
            </button>
          ))}
        </div>
        <p className="muted" style={{ padding: "8px 12px" }}>{videoJob || clip || frameCount ? note : (view === "ai" && aiNote ? aiNote : note)}</p>
      </section>
    </div>
  );
}

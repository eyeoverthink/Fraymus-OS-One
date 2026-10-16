import React, { useEffect, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { brushMask, buildSubjectMask, drawCrisp, fitSource, liftMask, offsetMask, renderPixel, traceCut, trimCeiling, trimSides } from "./pixelEngine.js";

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
  const resultRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const maskRef = useRef(null);
  const fileRef = useRef(null);
  const styleFileRef = useRef(null);
  const photoRef = useRef(null);
  const aiSrcRef = useRef(null);
  const aiMaskRef = useRef(null);
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

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
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

  function paint() {
    const source = sourceRef.current;
    const canvas = resultRef.current;
    if (!source || !canvas) return;
    if (view === "ai") {
      if (aiImage && aiSrcRef.current) {
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
    if (source && !paintingRef.current) {
      const base = buildSubjectMask(source, tolerance);
      maskRef.current = lift > 0 ? liftMask(source, base, Math.round(lift / 6)) : base;
      editedRef.current = false;
    }
    paint();
  }, [tolerance, lift]);

  useEffect(() => {
    paint();
  }, [pixelSize, colors, saturation, outline, cyan, view, editing, aiImage, lock]);

  function aiComposite() {
    const src = aiSrcRef.current;
    const mask = aiMaskRef.current;
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

  function adoptAi(img) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round(512 * img.height / img.width);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    aiSrcRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    aiMaskRef.current = new Uint8Array(canvas.width * canvas.height).fill(1);
    undoRef.current = [];
    redoRef.current = [];
  }

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
    const url = URL.createObjectURL(file);
    try {
      setStyleRef(imageData(await loadImage(url), 512));
      setAiNote("Style reference set. The render copies its drawing style.");
    } catch (error) {
      setAiNote(error.message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      await useSource(img);
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
      setCameraOn(true);
      setNote("Camera live. Take the picture when the subject fills the frame.");
    } catch (error) {
      setNote(error.name === "NotAllowedError" ? "Camera permission was blocked." : "No camera is available.");
      say?.("error", "Camera unavailable");
    }
  }

  function stopCamera() {
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
    const img = await loadImage(canvas.toDataURL("image/png"));
    await useSource(img);
    say?.("ok", "Picture taken");
  }

  function characterCanvas() {
    const source = sourceRef.current;
    if (!source) return null;
    if (view === "ai" && aiImage && aiSrcRef.current) {
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

  function onAiLayer() {
    return view === "ai" && Boolean(aiImage) && Boolean(aiSrcRef.current);
  }

  function editSource() {
    return onAiLayer() ? aiSrcRef.current : sourceRef.current;
  }

  function editMask() {
    return onAiLayer() ? aiMaskRef.current : maskRef.current;
  }

  function setEditMask(mask) {
    if (onAiLayer()) aiMaskRef.current = mask;
    else maskRef.current = mask;
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
        <p className="muted">AI Render redraws the photo as an 8-bit portrait. Character is the offline filter.</p>
        <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>New picture</button>
        {!cameraOn && <button className="btn" onClick={startCamera}>Take picture</button>}
        {cameraOn && (
          <div className="stack">
            <video ref={videoRef} className="pixel-video" playsInline muted autoPlay />
            <div className="row">
              <button className="btn on" onClick={shutter}>Shutter</button>
              <button className="btn" onClick={stopCamera}>Stop</button>
            </div>
          </div>
        )}
        <p className="fh">AI render</p>
        <div className="seg">
          <button className={aiMode === "real" ? "on" : ""} onClick={() => setAiMode("real")}>Real outfit</button>
          <button className={aiMode === "avatar" ? "on" : ""} onClick={() => setAiMode("avatar")}>Avatar</button>
        </div>
        <button className="btn on" onClick={aiRender} disabled={!hasSource || aiBusy}>{aiBusy ? "Rendering…" : "AI Render"}</button>
        <input ref={styleFileRef} hidden type="file" accept="image/*" onChange={(event) => { onStyleFile(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="row">
          <button className="btn" onClick={() => styleFileRef.current?.click()}>{styleRef ? "Change style ref" : "Style reference"}</button>
          {styleRef && <button className="btn" onClick={() => setStyleRef(null)}>Clear</button>}
        </div>
        {styleRef && <img className="pixel-styleref" src={styleRef} alt="Style reference" />}
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
          <input type="range" min={3} max={12} value={pixelSize} onChange={(event) => setPixelSize(Number(event.target.value))} />
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
          if (file) onFile(file);
        }}
      >
        <div className="codebar pixel-bar">
          <b>8-bit</b>
          <span className="muted">{paletteCount ? `${paletteCount} colors` : "character studio"}</span>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>New picture</button>
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
          {!hasSource && <p className="pixel-empty">{note}</p>}
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
        <p className="muted" style={{ padding: "8px 12px" }}>{view === "ai" && aiNote ? aiNote : note}</p>
      </section>
    </div>
  );
}

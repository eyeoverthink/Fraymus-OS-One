import React, { useEffect, useRef, useState } from "react";
import { drawCrisp } from "./pixelEngine.js";
import { stampWebmDuration } from "./pixelMotion.js";
import { composeTalkCells, inspectTalk } from "./pixelMouth.js";
import { LINE_GAP, TALK_FPS, frameAt, lineSchedule, talkMime, voiceEnvelope } from "./pixelTalk.js";

function faceView(face) {
  return {
    id: face.id,
    name: face.name,
    photo: face.photo,
    status: face.status,
    progress: face.progress,
    ready: Boolean(face.cells?.closed),
    lines: face.lines.map((line) => ({
      id: line.id,
      text: line.text,
      name: line.name,
      duration: line.audio ? line.audio.duration : 0
    }))
  };
}

function readJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That picture could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 768 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = () => reject(new Error("That picture could not be read."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The render could not be read."));
    img.src = src;
  });
}

async function toImageData(src) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function jpegCanvas(source, width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (source instanceof ImageData && scale === 1) ctx.putImageData(source, 0, 0);
  else if (source instanceof ImageData) {
    const raw = document.createElement("canvas");
    raw.width = source.width;
    raw.height = source.height;
    raw.getContext("2d").putImageData(source, 0, 0);
    ctx.drawImage(raw, 0, 0, canvas.width, canvas.height);
  } else ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function jpegFromImageData(frame) {
  return jpegCanvas(frame, frame.width, frame.height, 768);
}

async function jpegFromUrl(src) {
  if (!src) return "";
  if (src.startsWith("data:image/jpeg") && src.length < 450_000) return src;
  const img = await loadImage(src);
  return jpegCanvas(img, img.width, img.height, 768);
}

function audioToWavUrl(buffer) {
  const channel = buffer.getChannelData(0);
  const samples = channel.length;
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The voice could not be stored."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(new Blob([bytes], { type: "audio/wav" }));
  });
}

async function packFace(face) {
  const cells = {};
  if (face.cells) {
    Object.keys(face.cells).forEach((id) => {
      if (face.cells[id]) cells[id] = jpegFromImageData(face.cells[id]);
    });
  }
  const lines = [];
  for (const line of face.lines) {
    lines.push({
      id: line.id,
      text: line.text,
      name: line.name || "",
      wav: line.audio ? await audioToWavUrl(line.audio) : ""
    });
  }
  return {
    id: face.id,
    name: face.name,
    photo: await jpegFromUrl(face.photo),
    sprite: await jpegFromUrl(face.sprite),
    cells,
    seed: Number.isInteger(face.seed) ? face.seed : null,
    lines
  };
}

function gateMouth(cells) {
  const report = inspectTalk(cells.closed, cells.open);
  if (!report.ok) {
    cells.mid = cells.closed;
    cells.open = cells.closed;
  }
  return report.ok;
}

async function unpackFace(saved) {
  const cells = {};
  for (const [id, src] of Object.entries(saved.cells || {})) {
    if (src) cells[id] = await toImageData(src);
  }
  const ctx = new AudioContext();
  const lines = [];
  try {
    for (const line of saved.lines || []) {
      let audio = null;
      if (line.wav) {
        const bytes = await (await fetch(line.wav)).arrayBuffer();
        audio = await ctx.decodeAudioData(bytes.slice(0));
      }
      lines.push({
        id: line.id,
        text: line.text || "",
        name: line.name || "",
        audio,
        envelope: audio ? voiceEnvelope(audio) : []
      });
    }
  } finally {
    ctx.close().catch(() => {});
  }
  const ready = Boolean(cells.closed);
  const settled = ready ? composeTalkCells(cells.closed) : null;
  const mouthOk = settled ? gateMouth(settled) : true;
  return {
    id: saved.id,
    name: saved.name || "Face",
    photo: saved.photo,
    sprite: saved.sprite || "",
    cells: settled,
    mouthOk,
    seed: Number.isInteger(saved.seed) ? saved.seed : null,
    status: ready ? "ready" : "photo",
    progress: { done: ready ? 5 : 0, total: 5 },
    lines
  };
}

export function applyCast(project, cast) {
  return { ...project, cast };
}

async function renderSprite(body) {
  const response = await fetch("/api/pixel/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Render failed (${response.status})`);
  return payload;
}

function paintCaption(canvas, caption) {
  if (!caption) return;
  const ctx = canvas.getContext("2d");
  const bar = Math.max(36, Math.round(canvas.height * 0.12));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
  ctx.fillStyle = "#e7eee8";
  ctx.font = `${Math.max(14, Math.round(bar * 0.42))}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const wide = Math.max(1, Math.floor(canvas.width * 0.9));
  const words = caption.split(/\s+/);
  const lines = [];
  let row = "";
  words.forEach((word) => {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > wide && row) {
      lines.push(row);
      row = word;
    } else row = next;
  });
  if (row) lines.push(row);
  const shown = lines.slice(0, 2);
  const lineHeight = Math.max(16, Math.round(bar * 0.46));
  const top = canvas.height - bar / 2 - ((shown.length - 1) * lineHeight) / 2;
  shown.forEach((text, index) => ctx.fillText(text, canvas.width / 2, top + index * lineHeight));
}

function drawCell(canvas, frame, size, caption = "") {
  if (!canvas || !frame) return;
  drawCrisp(canvas, frame, size);
  paintCaption(canvas, caption);
}

export default function StudioPage({ project, onApply, say }) {
  const fileRef = useRef(null);
  const voiceRef = useRef(null);
  const voiceTargetRef = useRef("");
  const facesRef = useRef([]);
  const stageRef = useRef(null);
  const talkRef = useRef(false);
  const cancelRef = useRef(false);
  const selectedRef = useRef("");
  const projectRef = useRef(project);
  const onApplyRef = useRef(onApply);
  const keepTimer = useRef(0);
  const readyKeep = useRef(false);
  projectRef.current = project;
  onApplyRef.current = onApply;
  const [faces, setFaces] = useState([]);
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState("real");
  const [lineText, setLineText] = useState("");
  const [note, setNote] = useState("Add a face. Making the avatar, then a voice, is the same for every face you add.");
  const [busy, setBusy] = useState(false);

  const current = faces.find((face) => face.id === selected) || null;

  function scheduleKeep() {
    clearTimeout(keepTimer.current);
    keepTimer.current = setTimeout(() => { keepCast(false); }, 800);
  }

  function commit(next) {
    facesRef.current = next;
    setFaces(next.map(faceView));
    if (readyKeep.current) scheduleKeep();
  }

  async function keepCast(announce) {
    const currentProject = projectRef.current;
    const apply = onApplyRef.current;
    if (!readyKeep.current || !currentProject || !apply) {
      if (announce) setNote(currentProject ? "The cast is still opening." : "Open a project first. The cast stays in that project, not in the browser.");
      return;
    }
    const list = facesRef.current;
    try {
      const packed = [];
      for (const face of list) packed.push(await packFace(face));
      const cast = { faces: packed, savedAt: Date.now() };
      const latest = projectRef.current || currentProject;
      const next = applyCast(latest, cast);
      if (JSON.stringify(next).length > 7_500_000) {
        setNote("This cast is too large for the project file. Remove a face, then keep it again.");
        return;
      }
      apply(next);
      if (announce) {
        const count = list.length;
        setNote(count
          ? `Cast kept in the project. ${count} face${count === 1 ? "" : "s"}. A refresh brings them back.`
          : "The project cast is cleared.");
        say?.("ok", "Cast kept");
      }
    } catch (error) {
      setNote(error.message || "The cast could not be kept.");
      if (announce) say?.("error", error.message || "The cast could not be kept.");
    }
  }

  function patchFace(id, patch) {
    commit(facesRef.current.map((face) => (face.id === id ? { ...face, ...patch } : face)));
  }

  function choose(id) {
    talkRef.current = false;
    selectedRef.current = id;
    setSelected(id);
  }

  useEffect(() => {
    const face = facesRef.current.find((item) => item.id === selected);
    const canvas = stageRef.current;
    if (!face || !canvas || talkRef.current || busy) return undefined;
    if (face.cells?.closed) {
      drawCell(canvas, face.cells.closed, 520);
      return undefined;
    }
    const img = new Image();
    img.onload = () => {
      if (talkRef.current || selectedRef.current !== face.id) return;
      canvas.width = 520;
      canvas.height = 520;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#101014";
      ctx.fillRect(0, 0, 520, 520);
      const scale = Math.min(520 / img.width, 520 / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      ctx.drawImage(img, (520 - width) / 2, (520 - height) / 2, width, height);
    };
    img.src = face.sprite || face.photo;
    return undefined;
  }, [selected, faces, busy]);

  useEffect(() => {
    let cancelled = false;
    readyKeep.current = false;
    (async () => {
      const saved = projectRef.current?.cast?.faces || [];
      if (saved.length && !facesRef.current.length) {
        try {
          const next = [];
          for (const face of saved) next.push(await unpackFace(face));
          if (cancelled) return;
          if (facesRef.current.length) {
            readyKeep.current = true;
            return;
          }
          facesRef.current = next;
          setFaces(next.map(faceView));
          selectedRef.current = next[0]?.id || "";
          setSelected(next[0]?.id || "");
          setNote(next[0]?.mouthOk !== false
            ? `Cast restored. ${next.length} face${next.length === 1 ? "" : "s"}. Add another face and the same steps run again.`
            : "Cast restored. The mouth check failed on the saved opening, so play stays on the closed mouth.");
        } catch (error) {
          if (!cancelled) setNote(error.message || "The saved cast could not be opened.");
        }
      }
      if (!cancelled) readyKeep.current = true;
    })();
    return () => {
      cancelled = true;
      clearTimeout(keepTimer.current);
    };
  }, [project?.id]);

  async function onFaceFile(file) {
    if (!file) return;
    try {
      const photo = await readJpeg(file);
      const face = {
        id: `F${Date.now().toString(36)}`,
        name: file.name.replace(/\.[^.]+$/, "") || "Face",
        photo,
        sprite: "",
        cells: null,
        seed: null,
        status: "photo",
        progress: { done: 0, total: 5 },
        lines: []
      };
      commit([...facesRef.current, face]);
      choose(face.id);
      setNote(`${face.name} is in the cast. Make avatar runs the same steps for each face.`);
      say?.("ok", "Face added");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    }
  }

  function rename(name) {
    if (!selected) return;
    patchFace(selected, { name });
  }

  function removeFace(id) {
    if (busy) return;
    talkRef.current = false;
    const next = facesRef.current.filter((face) => face.id !== id);
    commit(next);
    if (selectedRef.current === id) choose(next[0]?.id || "");
  }

  async function makeAvatar() {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    if (!face || busy) return;
    cancelRef.current = false;
    talkRef.current = false;
    setBusy(true);
    let seed = face.seed;
    try {
      patchFace(face.id, { status: "rendering", progress: { done: 0, total: 1 } });
      setNote(`Drawing ${face.name}. The mouth is painted on that same picture, so the face does not jump.`);
      const master = await renderSprite({
        image: face.photo,
        mode,
        seed,
        note: "Head and shoulders, solid black background. Preserve this person's exact facial likeness, expression, age, eyeglasses, hat or headwear, beard including any gray hair, and clothes. Do not redesign the face."
      });
      if (cancelRef.current) throw new Error("Stopped.");
      if (Number.isInteger(master.seed)) seed = master.seed;
      const cells = composeTalkCells(await toImageData(master.image));
      const mouthOk = gateMouth(cells);
      patchFace(face.id, { sprite: master.image, cells, seed, status: "ready", progress: { done: 1, total: 1 } });
      if (selectedRef.current === face.id && stageRef.current) drawCell(stageRef.current, cells.closed, 520);
      setNote(mouthOk
        ? `${face.name} can talk. The mouth check puts the opening on the lips. Add a line, or make a voice. A recording you attach is kept.`
        : `${face.name} is drawn. The mouth check failed, so the mouth stays closed.`);
      say?.("ok", `${face.name} is ready`);
    } catch (error) {
      patchFace(face.id, { status: facesRef.current.find((item) => item.id === face.id)?.cells?.closed ? "ready" : "photo" });
      setNote(error.message === "Stopped." ? "Stopped. The face stays in the cast." : error.message);
      if (error.message !== "Stopped.") say?.("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  function addLine() {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    const text = lineText.trim();
    if (!face) {
      setNote("Add a face first.");
      return;
    }
    if (!text) {
      setNote("Write the line, then add it.");
      return;
    }
    const line = { id: `L${Date.now().toString(36)}`, text, name: "", audio: null, envelope: [] };
    patchFace(face.id, { lines: [...face.lines, line] });
    voiceTargetRef.current = line.id;
    setLineText("");
    setNote(`“${text}” is on ${face.name}. Attach a voice.`);
  }

  function moveLine(id, dir) {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    if (!face) return;
    const list = face.lines.slice();
    const index = list.findIndex((line) => line.id === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= list.length) return;
    const [row] = list.splice(index, 1);
    list.splice(next, 0, row);
    patchFace(face.id, { lines: list });
  }

  function removeLine(id) {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    if (!face) return;
    patchFace(face.id, { lines: face.lines.filter((line) => line.id !== id) });
  }

  async function onVoiceFile(file) {
    if (!file) return;
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    const target = voiceTargetRef.current || face?.lines.find((line) => !line.audio)?.id;
    if (!face || !target) {
      setNote("Add a line on this face, then attach the voice.");
      return;
    }
    try {
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(await file.arrayBuffer());
      await ctx.close();
      patchFace(face.id, {
        lines: face.lines.map((line) => (
          line.id === target ? { ...line, name: file.name, audio, envelope: voiceEnvelope(audio) } : line
        ))
      });
      voiceTargetRef.current = "";
      setNote(`${file.name} · ${audio.duration.toFixed(1)}s on ${face.name}.`);
    } catch {
      setNote("That audio could not be read. Use WAV, MP3, or M4A.");
    }
  }

  async function makeVoice(line) {
    if (!line?.text || line.audio || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line.text })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "VoiceStudio did not speak.");
      const blob = await (await fetch(body.audio)).blob();
      const file = new File([blob], "voicestudio.wav", { type: blob.type || "audio/wav" });
      voiceTargetRef.current = line.id;
      await onVoiceFile(file);
      setNote("VoiceStudio spoke this line. A recording already on a line is left as it is.");
      say?.("ok", "Voice ready");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadHyperframes() {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    const parts = face?.lines.filter((line) => line.audio) || [];
    if (!face?.cells?.closed || !parts.length) {
      setNote("Keep the cast, add a line, and give it a voice. HyperFrames reads those saved frames.");
      return;
    }
    const plan = lineSchedule(parts, LINE_GAP);
    const hop = 1 / TALK_FPS;
    const clips = [];
    for (let time = 0; time < plan.duration - 0.0001; time += hop) {
      const frame = frameAt(plan.captions, time);
      const last = clips[clips.length - 1];
      if (last && last.id === frame.id) last.duration += hop;
      else clips.push({ id: frame.id, start: time, duration: hop });
    }
    setBusy(true);
    try {
      const response = await fetch("/api/cast/hyperframes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectRef.current?.id,
          faceId: face.id,
          duration: plan.duration,
          clips,
          lines: plan.captions.map((line, index) => ({ id: parts[index].id, text: line.text, start: line.start, duration: line.end - line.start }))
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "HyperFrames export failed.");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${face.name.replace(/[^\w\-]+/g, "-") || "face"}-hyperframes.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      setNote(`Saved ${link.download}. The sprite frames are the picture. HyperFrames does not redraw the face.`);
      say?.("ok", "HyperFrames export saved");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      setBusy(false);
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
    const ctx = new AudioContext();
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    const parts = face?.lines.filter((line) => line.audio) || [];
    if (!face?.cells?.closed || !parts.length) {
      ctx.close();
      setNote(face?.cells?.closed ? "Add a line and a voice on this face." : "Make the avatar before it can talk.");
      return;
    }
    talkRef.current = false;
    const { audio, captions } = await mixLines(parts);
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.destination);
    talkRef.current = true;
    const start = ctx.currentTime;
    const faceId = face.id;
    src.start();
    const loop = () => {
      if (!talkRef.current || selectedRef.current !== faceId) {
        try { src.stop(); } catch { /* already stopped */ }
        ctx.close().catch(() => {});
        return;
      }
      const time = ctx.currentTime - start;
      if (time >= audio.duration) {
        talkRef.current = false;
        ctx.close().catch(() => {});
        setNote(`${face.name} finished.`);
        return;
      }
      const frame = frameAt(captions, time);
      drawCell(stageRef.current, face.cells[frame.id] || face.cells.closed, 520, frame.text);
      requestAnimationFrame(loop);
    };
    src.onended = () => {
      talkRef.current = false;
      ctx.close().catch(() => {});
    };
    requestAnimationFrame(loop);
  }

  async function downloadTalk() {
    const face = facesRef.current.find((item) => item.id === selectedRef.current);
    const parts = face?.lines.filter((line) => line.audio) || [];
    if (!face?.cells?.closed || !parts.length) return;
    const mime = talkMime();
    if (!mime) {
      setNote("This browser cannot record WebM.");
      return;
    }
    talkRef.current = false;
    setBusy(true);
    const audioCtx = new AudioContext();
    try {
      const { audio, captions, duration } = await mixLines(parts);
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createBufferSource();
      src.buffer = audio;
      src.connect(dest);
      const canvas = document.createElement("canvas");
      drawCell(canvas, face.cells.closed, 720, captions[0]?.text || "");
      const videoStream = canvas.captureStream(0);
      const mixed = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise((resolve) => { rec.onstop = resolve; });
      rec.start();
      src.start();
      const track = videoStream.getVideoTracks()[0];
      const total = Math.max(1, Math.ceil(duration * TALK_FPS));
      for (let i = 0; i < total; i += 1) {
        const frame = frameAt(captions, i / TALK_FPS);
        drawCell(canvas, face.cells[frame.id] || face.cells.closed, 720, frame.text);
        if (stageRef.current) drawCell(stageRef.current, face.cells[frame.id] || face.cells.closed, 520, frame.text);
        if (typeof track.requestFrame === "function") track.requestFrame();
        setNote(`Writing ${face.name} · ${i + 1} of ${total}.`);
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
      link.download = `${face.name.replace(/[^\w\-]+/g, "-") || "face"}-talk.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      setNote(`Saved ${link.download} · ${face.name} · ${duration.toFixed(1)}s.`);
      say?.("ok", "Voiceover saved");
    } catch (error) {
      setNote(error.message);
      say?.("error", error.message);
    } finally {
      audioCtx.close().catch(() => {});
      setBusy(false);
    }
  }

  return (
    <div className="tool">
      <aside className="tool-side">
        <p className="fh">Cast</p>
        <p className="muted">Each face is its own avatar. Add one, make it, give it a voice. Add the next face and do the same. Keep stores the cast in this project. A refresh brings it back. It is not stored in the browser.</p>
        <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => { onFaceFile(event.target.files?.[0]); event.target.value = ""; }} />
        <button className="btn on" onClick={() => fileRef.current?.click()} disabled={busy}>Add face</button>
        <button className="btn" onClick={() => keepCast(true)} disabled={!faces.length || busy}>Keep cast</button>
        {faces.map((face) => (
          <button key={face.id} className={`card face-card ${selected === face.id ? "on" : ""}`} onClick={() => choose(face.id)}>
            <img src={face.photo} alt="" />
            <span>
              <b>{face.name}</b>
              <span className="muted">{face.ready ? "Talks" : face.status === "rendering" ? `Making ${face.progress.done}/${face.progress.total}` : "Photo"}</span>
            </span>
          </button>
        ))}
        {!faces.length && <p className="muted">No faces yet.</p>}
      </aside>
      <section className="tool-main">
        <div className="codebar">
          <b>Production</b>
          <span className="muted">{current ? current.name : "No face selected"}</span>
          <span className="spacer" />
          <div className="seg">
            <button className={mode === "real" ? "on" : ""} onClick={() => setMode("real")}>Real outfit</button>
            <button className={mode === "avatar" ? "on" : ""} onClick={() => setMode("avatar")}>Avatar</button>
          </div>
          <button className="btn on" onClick={makeAvatar} disabled={!current || busy}>{busy && current?.status === "rendering" ? `Making ${current.progress.done}/${current.progress.total}` : "Make avatar"}</button>
          {busy && <button className="btn" onClick={() => { cancelRef.current = true; }}>Stop</button>}
          <button className="btn" onClick={playTalk} disabled={!current?.ready || !current.lines.some((line) => line.duration) || busy}>Play</button>
          <button className="btn" onClick={stopTalk} disabled={!current}>Stop</button>
          <button className="btn" onClick={downloadTalk} disabled={!current?.ready || !current.lines.some((line) => line.duration) || busy}>WebM</button>
          <button className="btn" onClick={downloadHyperframes} disabled={!current?.ready || !current.lines.some((line) => line.duration) || busy}>HyperFrames</button>
        </div>
        <div className="pixel-stage smooth">
          <canvas ref={stageRef} aria-label="Production stage" />
          {!current && <p className="pixel-empty">Add a face.</p>}
        </div>
        <p className="muted" style={{ padding: "8px 12px" }}>{note}</p>
      </section>
      <aside className="tool-side">
        <p className="fh">Voice</p>
        {current && (
          <label className="field">Name
            <input value={current.name} onChange={(event) => rename(event.target.value)} />
          </label>
        )}
        <label className="field">Line
          <input value={lineText} placeholder="What this face says" onChange={(event) => setLineText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addLine(); }} />
        </label>
        <button className="btn" onClick={addLine} disabled={!current || busy}>Add line</button>
        <input ref={voiceRef} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.aac" onChange={(event) => { onVoiceFile(event.target.files?.[0]); event.target.value = ""; }} />
        {current?.lines.map((line, index) => (
          <div className="stack" key={line.id}>
            <div className="row">
              <span className="muted">{line.text}</span>
              <button className="btn" disabled={busy || index === 0} onClick={() => moveLine(line.id, -1)}>Up</button>
              <button className="btn" disabled={busy || index === current.lines.length - 1} onClick={() => moveLine(line.id, 1)}>Down</button>
              <button className="btn" disabled={busy} onClick={() => { voiceTargetRef.current = line.id; voiceRef.current?.click(); }}>{line.duration ? `${line.duration.toFixed(1)}s` : "Voice"}</button>
              {!line.duration && <button className="btn" disabled={busy} onClick={() => makeVoice(line)}>Make voice</button>}
              <button className="btn" disabled={busy} onClick={() => removeLine(line.id)}>×</button>
            </div>
          </div>
        ))}
        {current && <button className="btn" disabled={busy} onClick={() => removeFace(current.id)}>Remove this face</button>}
        {!current && <p className="muted">The voice belongs to the face you have selected.</p>}
      </aside>
    </div>
  );
}

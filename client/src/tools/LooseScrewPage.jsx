import React, { useEffect, useMemo, useRef, useState } from "react";
import { synthesizeVocalStudioOffline } from "./sovereignEcosystem.js";
import {
  DEPLOY_SCRIPT,
  LOOSE_SCREW_JAVA,
  PHI,
  SEED_CATALOG,
  applyLooseScrew,
  buildFlyCard,
  buildPccCard,
  buildStudioCards,
  cardFromStem,
  formatClock,
  mergeCards,
  standaloneIndexHtml
} from "./looseScrewEngine.js";

const CHANNELS = ["ALL", "MUSIC", "VIDEO", "CODE"];
const STEM_IDS = [
  ["sub", "Sub"],
  ["lead", "Lead"],
  ["drum", "Drum"],
  ["custom", "Custom"]
];

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawAvatar(ctx, tick, talking, mouth) {
  ctx.clearRect(0, 0, 64, 68);
  const bounce = talking ? Math.sin(tick * 0.35) : 0;
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(14, 6 + bounce, 36, 2);
  ctx.fillRect(8, 12 + bounce, 2, 16);
  ctx.fillRect(54, 12 + bounce, 2, 16);
  ctx.fillRect(2, 48, 14, 2);
  ctx.fillRect(48, 48, 14, 2);
  ctx.fillStyle = "#293829";
  ctx.fillRect(14, 8 + bounce, 36, 6);
  ctx.fillRect(10, 12 + bounce, 44, 15);
  ctx.fillStyle = "#182019";
  ctx.fillRect(12, 15 + bounce, 40, 12);
  ctx.fillStyle = "#9c5a3c";
  ctx.fillRect(17, 17 + bounce, 30, 26);
  ctx.fillStyle = "#1b2226";
  ctx.fillRect(18, 23 + bounce, 12, 8);
  ctx.fillRect(34, 23 + bounce, 12, 8);
  ctx.fillRect(30, 25 + bounce, 4, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(22, 26 + bounce, 4, 2);
  ctx.fillRect(38, 26 + bounce, 4, 2);
  ctx.fillStyle = "#090b0e";
  ctx.fillRect(23, 26 + bounce, 2, 2);
  ctx.fillRect(39, 26 + bounce, 2, 2);
  ctx.fillStyle = "#1e2224";
  ctx.fillRect(23, 34 + bounce, 18, 3);
  ctx.fillRect(24, 39 + bounce, 16, 6);
  if (talking && mouth > 0.2) {
    ctx.fillStyle = "#00e5ff";
    ctx.fillRect(27, 36 + bounce, 10, Math.min(4, Math.ceil(mouth * 4)));
  } else {
    ctx.fillStyle = "#bf7959";
    ctx.fillRect(26, 36 + bounce, 12, 2);
  }
  ctx.fillStyle = "#f2f4f7";
  ctx.fillRect(18, 45, 28, 23);
  ctx.fillStyle = "#2d3748";
  ctx.fillRect(31, 52, 2, 2);
  ctx.fillRect(31, 59, 2, 2);
  ctx.fillStyle = "#293829";
  ctx.fillRect(2, 50, 17, 18);
  ctx.fillRect(45, 50, 17, 18);
}

function noiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
  return buffer;
}

export default function LooseScrewPage({ project, say, onApply }) {
  const [catalog, setCatalog] = useState(SEED_CATALOG);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(SEED_CATALOG[0].id);
  const [playing, setPlaying] = useState(false);
  const [workbench, setWorkbench] = useState(false);
  const [editor, setEditor] = useState(SEED_CATALOG[0].code);
  const [reaOut, setReaOut] = useState(SEED_CATALOG[0].reaTrace);
  const [speech, setSpeech] = useState("Welcome to looseScrew. Load a stem and it becomes a Code and App Design card.");
  const [thermal, setThermal] = useState(36.48);
  const [fossils, setFossils] = useState(14);
  const [log, setLog] = useState(["Fraymus portal standing by."]);
  const [scrub, setScrub] = useState(0);
  const [goal, setGoal] = useState("stem-driven app design");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestChannel, setIngestChannel] = useState("CODE");
  const [stems, setStems] = useState({
    sub: { mute: false, gain: 0.35 },
    lead: { mute: false, gain: 0.28 },
    drum: { mute: false, gain: 0.22 },
    custom: { mute: false, gain: 0.7, name: "" }
  });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hostState, setHostState] = useState("HOST STANDBY");
  const stageRef = useRef(null);
  const avatarRef = useRef(null);
  const audioRef = useRef(null);
  const liveRef = useRef({});
  const avatarUrlRef = useRef("");

  const active = catalog.find((item) => item.id === activeId) || catalog[0];
  const designKey = [
    project?.id,
    project?.stack,
    project?.updatedAt,
    (project?.pages || []).map((page) => page.name).join(",")
  ].join("|");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const channelOk = filter === "ALL" || item.channel === filter;
      const text = `${item.title} ${(item.tags || []).join(" ")}`.toLowerCase();
      return channelOk && (!q || text.includes(q));
    });
  }, [catalog, filter, query]);

  function pushLog(message) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 40));
  }

  function selectCard(item, speak = true) {
    setActiveId(item.id);
    setEditor(item.code || "");
    setReaOut(item.reaTrace || "");
    setWorkbench(item.channel === "CODE");
    if (speak) speakText(item.voiceIntro || item.title);
    pushLog(`[${item.channel}] ${item.title}`);
  }

  function speakText(text) {
    const line = String(text || "").trim();
    if (!line) return;
    setSpeech(line);
    setHostState("ON AIR");
    liveRef.current.talking = true;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(line);
      utter.pitch = 0.92;
      utter.rate = 1.02;
      utter.onboundary = () => { liveRef.current.mouth = 0.4 + Math.random() * 0.6; };
      utter.onend = () => {
        liveRef.current.talking = false;
        liveRef.current.mouth = 0;
        setHostState("HOST STANDBY");
      };
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => {
        liveRef.current.talking = false;
        setHostState("HOST STANDBY");
      }, 2500);
    }
  }

  function ensureAudio() {
    if (audioRef.current) return audioRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    const bus = {};
    for (const [id] of STEM_IDS) {
      const gain = ctx.createGain();
      gain.gain.value = id === "custom" ? 0.7 : 0.3;
      gain.connect(master);
      bus[id] = { gain, buffer: null, source: null };
    }
    bus.drum.buffer = noiseBuffer(ctx);
    audioRef.current = { ctx, analyser, master, bus, timer: null };
    return audioRef.current;
  }

  function syncCustomLoop(engine, shouldPlay) {
    const stem = engine.bus.custom;
    if (stem.source) {
      try { stem.source.stop(); } catch { /* already stopped */ }
      stem.source.disconnect();
      stem.source = null;
    }
    const mute = liveRef.current.stems?.custom?.mute;
    if (!shouldPlay || mute || !stem.buffer) return;
    const source = engine.ctx.createBufferSource();
    source.buffer = stem.buffer;
    source.loop = true;
    source.connect(stem.gain);
    source.start();
    stem.source = source;
  }

  function startClock() {
    const engine = ensureAudio();
    if (engine.ctx.state === "suspended") engine.ctx.resume();
    if (engine.timer) clearInterval(engine.timer);
    const item = liveRef.current.active || SEED_CATALOG[0];
    const stepMs = (60 / (item.bpm || 120)) * 500;
    let step = 0;
    engine.timer = setInterval(() => {
      const live = liveRef.current;
      if (!live.playing) return;
      const notes = live.active?.synthNotes || SEED_NOTES_FALLBACK;
      const freq = notes[step % notes.length];
      step += 1;
      const now = engine.ctx.currentTime;
      const dur = (stepMs / 1000) * 0.9;
      const hit = (id, type, frequency, gainValue) => {
        if (live.stems?.[id]?.mute) return;
        const osc = engine.ctx.createOscillator();
        const gain = engine.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(gainValue, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(engine.bus[id].gain);
        osc.start(now);
        osc.stop(now + dur);
      };
      hit("sub", "sawtooth", freq / 2, 0.2);
      hit("lead", "triangle", freq, 0.16);
      if (!live.stems?.drum?.mute && step % 4 === 0 && engine.bus.drum.buffer) {
        const source = engine.ctx.createBufferSource();
        source.buffer = engine.bus.drum.buffer;
        source.connect(engine.bus.drum.gain);
        source.start(now);
      }
      if (live.talking) live.mouth = Math.random();
    }, stepMs);
    syncCustomLoop(engine, true);
  }

  function stopClock() {
    const engine = audioRef.current;
    if (!engine) return;
    if (engine.timer) clearInterval(engine.timer);
    engine.timer = null;
    syncCustomLoop(engine, false);
  }

  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    if (next) startClock();
    else stopClock();
  }

  async function mountBuffer(buffer, meta) {
    const engine = ensureAudio();
    if (engine.ctx.state === "suspended") await engine.ctx.resume();
    engine.bus.custom.buffer = buffer;
    const card = cardFromStem({
      name: meta.name,
      seconds: buffer.duration,
      sampleRate: buffer.sampleRate,
      bpm: active?.bpm || 118
    }, project, goal);
    setCatalog((prev) => mergeCards(prev, [card]));
    setFilter("CODE");
    selectCard(card, true);
    setStems((prev) => ({ ...prev, custom: { ...prev.custom, name: meta.name, mute: false } }));
    if (liveRef.current.playing) syncCustomLoop(engine, true);
    say?.(`Stem ${meta.name} populated a Code & App Design card at ${card.synthNotes[0]} Hz.`);
    pushLog(`Stem absorbed → ${card.title}`);
  }

  async function onStemFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const engine = ensureAudio();
      const bytes = await file.arrayBuffer();
      const buffer = await engine.ctx.decodeAudioData(bytes.slice(0));
      await mountBuffer(buffer, { name: file.name });
    } catch (error) {
      say?.(error.message || "Could not decode that audio stem.");
    }
  }

  async function forgeVocalStem() {
    try {
      const line = speech || "Loose screw code channel locked at four thirty two hertz.";
      const wav = synthesizeVocalStudioOffline(line.slice(0, 180), "fraymus-432hz");
      const engine = ensureAudio();
      const res = await fetch(wav.wavDataUrl);
      const buffer = await engine.ctx.decodeAudioData(await res.arrayBuffer());
      await mountBuffer(buffer, { name: `vocal-${Math.round(wav.baseHz)}hz.wav` });
    } catch (error) {
      say?.(error.message || "Could not forge the 432 Hz stem.");
    }
  }

  async function refreshDesign() {
    const next = buildStudioCards(project, goal);
    setCatalog((prev) => mergeCards(prev, next));
    setFilter("CODE");
    try {
      const res = await fetch("/api/loosescrew/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, stem: stems.custom.name || "project" })
      });
      const data = await res.json();
      pushLog(data.ok ? `SystemDesign steps ${data.steps.length} · ${data.goal}` : "SystemDesign route unavailable");
    } catch {
      pushLog("SystemDesign route unavailable");
    }
    say?.("Code channel refreshed from the open project, REA, Brain, and SystemDesign.");
  }

  function addFly() {
    const card = buildFlyCard(goal);
    setCatalog((prev) => mergeCards(prev, [card]));
    setFilter("CODE");
    selectCard(card, true);
  }

  function addPcc() {
    try {
      const card = buildPccCard();
      setCatalog((prev) => mergeCards(prev, [card]));
      setFilter("CODE");
      selectCard(card, true);
    } catch (error) {
      say?.(error.message || "PCC compile failed.");
    }
  }

  function runEditor() {
    try {
      const result = new Function(editor)();
      setReaOut(`${active?.reaTrace || ""}\n\n[LIVE ${new Date().toLocaleTimeString()}]\n${result}`);
      setThermal((value) => Number((value + 0.42).toFixed(2)));
      speakText("Rebuild executed and verified.");
    } catch (error) {
      setReaOut(`[REBUILD EXCEPTION]\n${error.message}`);
      speakText("The rebuild raised an exception.");
    }
  }

  function upvote() {
    setCatalog((prev) => prev.map((item) => item.id === active.id ? { ...item, screws: (item.screws || 0) + 1 } : item));
    pushLog(`Tightened screw on ${active.title}`);
  }

  async function archiveFossil() {
    const payload = `${active?.title || "transmission"} @ ${thermal.toFixed(2)}C`;
    setFossils((value) => value + 1);
    pushLog(`Fossil archived: ${payload}`);
    speakText(`Temporal fossil preserved for ${active?.title || "this transmission"}.`);
    try {
      await fetch("/api/loosescrew/akashic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "FOSSIL", payload })
      });
    } catch { /* local log still stands */ }
  }

  function ingest() {
    const title = ingestTitle.trim();
    if (!title) return;
    const card = {
      id: `custom-${Date.now()}`,
      channel: ingestChannel,
      title,
      duration: "05:00",
      screws: 1,
      bpm: 120,
      tags: ["#Ingest", "#Live"],
      voiceIntro: `New transmission ingested: ${title}.`,
      synthNotes: [130.81, 164.81, 196, 261.63],
      code: `return ${JSON.stringify(`Module online: ${title}`)};`,
      reaTrace: `[INGEST]\n${new Date().toISOString()}`
    };
    setCatalog((prev) => [card, ...prev]);
    setIngestTitle("");
    selectCard(card, true);
  }

  function onAvatarFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    const url = URL.createObjectURL(file);
    avatarUrlRef.current = url;
    setAvatarUrl(url);
    pushLog("Avatar image mounted for this session only.");
  }

  function applyToProject() {
    if (!project) {
      say?.("Open a project first.");
      return;
    }
    onApply?.(applyLooseScrew(project, active));
    say?.(`Wrote ${active.title} into the project.`);
  }

  useEffect(() => {
    liveRef.current = { active, playing, stems, talking: liveRef.current.talking, mouth: liveRef.current.mouth || 0 };
    const engine = audioRef.current;
    if (!engine) return;
    for (const [id] of STEM_IDS) {
      engine.bus[id].gain.gain.value = stems[id].mute ? 0 : stems[id].gain;
    }
  }, [active, playing, stems]);

  useEffect(() => {
    if (!project) return;
    setCatalog((prev) => mergeCards(prev, buildStudioCards(project, goal)));
  }, [designKey]);

  useEffect(() => {
    const stage = stageRef.current;
    const avatar = avatarRef.current;
    if (!stage || !avatar) return;
    const sctx = stage.getContext("2d");
    const actx = avatar.getContext("2d");
    const freq = new Uint8Array(64);
    let tick = 0;
    let raf = 0;
    const loop = () => {
      tick += 1;
      const live = liveRef.current;
      drawAvatar(actx, tick, !!live.talking, live.mouth || 0);
      const engine = audioRef.current;
      if (engine && live.playing) engine.analyser.getByteFrequencyData(freq);
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.floor(rect.width * dpr));
      const h = Math.max(180, Math.floor(rect.height * dpr));
      if (stage.width !== w) stage.width = w;
      if (stage.height !== h) stage.height = h;
      const sky = sctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#050814");
      sky.addColorStop(0.55, "#071018");
      sky.addColorStop(1, "#020308");
      sctx.fillStyle = sky;
      sctx.fillRect(0, 0, w, h);
      const glow = sctx.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.45);
      glow.addColorStop(0, "rgba(0,229,255,0.18)");
      glow.addColorStop(1, "rgba(0,229,255,0)");
      sctx.fillStyle = glow;
      sctx.fillRect(0, 0, w, h);
      const horizon = h * 0.62;
      for (let i = -14; i <= 14; i += 1) {
        const fade = 1 - Math.abs(i) / 16;
        sctx.strokeStyle = `rgba(0,229,255,${0.08 + fade * 0.18})`;
        sctx.beginPath();
        sctx.moveTo(w / 2 + i * (w * 0.02), horizon);
        sctx.lineTo(w / 2 + i * (w * 0.12), h);
        sctx.stroke();
      }
      const drift = (tick * (live.playing ? 1.6 : 0.35)) % 36;
      for (let y = horizon; y < h; y += 28 * dpr) {
        const depth = (y - horizon) / (h - horizon);
        sctx.strokeStyle = `rgba(0,229,255,${0.05 + depth * 0.2})`;
        sctx.beginPath();
        sctx.moveTo(0, y + drift * depth);
        sctx.lineTo(w, y + drift * depth);
        sctx.stroke();
      }
      const channel = live.active?.channel || "MUSIC";
      if (channel === "VIDEO") {
        sctx.save();
        sctx.translate(w / 2, horizon - h * 0.12);
        sctx.strokeStyle = "#00e5ff";
        sctx.lineWidth = 2 * dpr;
        const r = h * 0.16 + Math.sin(tick * 0.04) * 8;
        sctx.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);
        sctx.restore();
      }
      const barCount = 48;
      const barWidth = (w * 0.86) / barCount;
      const origin = w * 0.07;
      for (let i = 0; i < barCount; i += 1) {
        const idle = 18 + Math.abs(Math.sin(tick * 0.03 + i * 0.35)) * (h * 0.08);
        const val = live.playing ? (freq[i] || (Math.sin(tick * 0.08 + i) + 1) * 48) : idle;
        const barH = live.playing ? (val / 255) * (h * 0.42) : idle;
        sctx.fillStyle = i % 2 === 0 ? "rgba(0,229,255,0.92)" : "rgba(45,160,130,0.8)";
        sctx.fillRect(origin + i * barWidth, horizon - barH, Math.max(2, barWidth - 3 * dpr), barH);
        sctx.fillStyle = "rgba(0,229,255,0.16)";
        sctx.fillRect(origin + i * barWidth, horizon + 4, Math.max(2, barWidth - 3 * dpr), barH * 0.28);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => {
    stopClock();
    audioRef.current?.ctx?.close();
    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const codeCount = catalog.filter((item) => item.channel === "CODE").length;

  return (
    <div className="tool ls">
      <aside className="tool-side">
        <div className="fh">Channels</div>
        {CHANNELS.map((channel) => (
          <button key={channel} className={`card ${filter === channel ? "on" : ""}`} onClick={() => setFilter(channel)}>
            <b>{channel === "ALL" ? "All" : channel === "MUSIC" ? "Music" : channel === "VIDEO" ? "Video" : "Code & App Design"}</b>
            <span className="muted">{channel === "CODE" ? `${codeCount} cards` : channel === "ALL" ? `${catalog.length} live` : "Broadcast"}</span>
          </button>
        ))}
        <div className="fh">Lazarus</div>
        <div className="ls-stats">
          <span>CORE<b>{thermal.toFixed(2)}°</b></span>
          <span>PHI<b>{PHI.toFixed(3)}</b></span>
          <span>FOSSILS<b>{fossils}</b></span>
          <span>HOST<b>EYEO</b></span>
        </div>
        <div className="fh">SystemDesign</div>
        <label className="field">Goal
          <input value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <button className="btn" onClick={refreshDesign}>Rebuild from project</button>
        <button className="btn" onClick={addFly}>Brain connectome</button>
        <button className="btn" onClick={addPcc}>Proof-carrying WASM</button>
      </aside>
      <section className="tool-main">
        <div className="codebar">
          <b>looseScrew</b>
          <span className="muted">EyeOverthink</span>
          <span className="spacer" />
          <button className="btn" onClick={applyToProject}>Keep</button>
          <button className="btn" onClick={() => download("index.html", standaloneIndexHtml(catalog), "text/html")}>HTML</button>
          <button className="btn" onClick={() => download("LooseScrewEngine.java", LOOSE_SCREW_JAVA, "text/plain")}>Java</button>
          <button className="btn" onClick={() => download("deploy_loosescrew.sh", DEPLOY_SCRIPT, "text/plain")}>Deploy</button>
        </div>
        <div className="tool-body">
          <div className="ls-stage">
            <canvas ref={stageRef} width="960" height="360" />
            <div className="ls-lower">
              <span className="ls-pill">{active?.channel}</span>
              <b>{active?.title}</b>
              <span className="ls-bpm">{active?.bpm} BPM</span>
            </div>
          </div>
          <div className="ls-transport">
            <button className="btn play" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
            <span className="muted">{formatClock((scrub / 100) * 260)} / {active?.duration}</span>
            <input type="range" min="0" max="100" value={scrub} onChange={(event) => setScrub(Number(event.target.value))} aria-label="Scrub" />
            <button className={`btn ${workbench ? "on" : ""}`} onClick={() => setWorkbench((value) => !value)}>Code</button>
            <button className="btn" onClick={() => speakText(active?.voiceIntro)}>Explain</button>
            <button className="btn" onClick={upvote}>Tighten {active?.screws || 0}</button>
            <button className="btn" onClick={archiveFossil}>Archive</button>
          </div>
          <div className="ls-mixer">
            {STEM_IDS.map(([id, label]) => (
              <label key={id} className="ls-fader">
                <b>{id === "custom" && stems.custom.name ? stems.custom.name : label}</b>
                <input type="range" min="0" max="1" step="0.01" value={stems[id].gain} aria-label={`${label} level`} onChange={(event) => setStems((prev) => ({ ...prev, [id]: { ...prev[id], gain: Number(event.target.value) } }))} />
                <button type="button" className={`btn ${stems[id].mute ? "on" : ""}`} onClick={() => setStems((prev) => ({ ...prev, [id]: { ...prev[id], mute: !prev[id].mute } }))}>{stems[id].mute ? "Muted" : "On"}</button>
              </label>
            ))}
            <label className="btn">
              Load stem
              <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg" hidden onChange={onStemFile} />
            </label>
            <button className="btn" onClick={forgeVocalStem}>432 Hz</button>
          </div>
          {workbench && (
            <div className="ls-bench">
              <div>
                <div className="row">
                  <b>{active?.id}.js</b>
                  <span className="spacer" />
                  <button className="btn play" onClick={runEditor}>Run</button>
                </div>
                <textarea value={editor} spellCheck={false} onChange={(event) => setEditor(event.target.value)} />
              </div>
              <div>
                <div className="row">
                  <b>Evidence</b>
                  <span className="spacer" />
                  <button className="btn" onClick={() => setWorkbench(false)}>Close</button>
                </div>
                <pre>{reaOut}</pre>
              </div>
            </div>
          )}
          <div className="ls-feedhead">
            <b>Transmissions</b>
            <span className="muted">{visible.length}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search transmissions" />
          </div>
          <div className="ls-grid">
            {visible.map((item) => (
              <button key={item.id} className={`ls-card ${item.id === activeId ? "on" : ""}`} onClick={() => selectCard(item)}>
                <span className={`ls-thumb ${item.channel}`}>
                  <span className="ls-pill">{item.channel}</span>
                  <span className="ls-dur">{item.duration}</span>
                </span>
                <b>{item.title}</b>
                <span className="muted">{(item.tags || []).slice(0, 3).join(" ")}</span>
                <span className="ls-meta"><span>{item.bpm} BPM</span><span>{item.screws || 0} screws</span></span>
              </button>
            ))}
          </div>
          <div className="ls-ingest">
            <input value={ingestTitle} onChange={(event) => setIngestTitle(event.target.value)} placeholder="New transmission" aria-label="Transmission title" />
            <select value={ingestChannel} onChange={(event) => setIngestChannel(event.target.value)} aria-label="Channel">
              <option>MUSIC</option>
              <option>VIDEO</option>
              <option>CODE</option>
            </select>
            <button className="btn" onClick={ingest}>Ingest</button>
          </div>
        </div>
      </section>
      <aside className="tool-side">
        <div className="fh">Host</div>
        <div className="ls-avatar">
          <span className="ls-pill ls-live">{hostState === "ON AIR" ? "ON AIR" : "STANDBY"}</span>
          <canvas ref={avatarRef} width="64" height="68" />
          {avatarUrl && <img src={avatarUrl} alt="" />}
        </div>
        <label className="btn">
          Swap portrait
          <input type="file" accept="image/*" hidden onChange={onAvatarFile} />
        </label>
        <blockquote className="ls-speech">{speech}</blockquote>
        <div className="row">
          <button className="btn" onClick={() => speakText("Welcome to looseScrew. Music, video, and clean-room code share one stem bus.")}>Intro</button>
          <button className="btn" onClick={() => speakText("Reverse engineer anything: scope, map, trace, collect evidence, rebuild, verify, report.")}>REA</button>
        </div>
        <div className="fh">Akashic</div>
        <pre className="ls-log">{log.join("\n")}</pre>
      </aside>
    </div>
  );
}

const SEED_NOTES_FALLBACK = [110, 146.83, 164.81, 220];

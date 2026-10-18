import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { drawCrisp } from "./pixelEngine.js";
import { composeTalkCells, inspectTalk } from "./pixelMouth.js";
import { LINE_GAP, TALK_FPS, frameAt, lineSchedule, voiceEnvelope } from "./pixelTalk.js";
import { base64, cleanCarrier, sha256, textBytes } from "./emojiCodec.js";
import {
  ALPHABET, GENESIS, PAD, WINDOWS,
  bytesFromBase64, decodeWire, deflate, encodeWire, fingerprint, generateKeys, inflate, verifySignature
} from "./dispatchCore.js";
import EmojiSelect from "./EmojiSelect.jsx";

const MAILBOX = "fx-4041-f10e-7ee2-2bdc";
const FX_NUMBER = /^fx-[0-9a-f]{4}(-[0-9a-f]{4}){3}$/;
const NAMED_TARGET = new Set(["FRAYNIX", "BROADCAST"]);
const PREV_KEY = "fraymus.seal.prev";

function validTarget(value) {
  const to = String(value || "").trim();
  if (NAMED_TARGET.has(to) || FX_NUMBER.test(to)) return to;
  return "";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load sprite."));
    img.src = src;
  });
}

async function toImageData(src, size = 128) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / img.width, size / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  ctx.drawImage(img, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
  return ctx.getImageData(0, 0, size, size);
}

function makeDemoSprite(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, size, size);
  // Cyan rim silhouette
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(34, 20, 60, 66);
  ctx.fillRect(22, 86, 84, 34);
  // Black outline inside
  ctx.fillStyle = "#121216";
  ctx.fillRect(36, 22, 56, 62);
  ctx.fillRect(24, 88, 80, 32);
  // Jacket
  ctx.fillStyle = "#182438";
  ctx.fillRect(26, 90, 76, 30);
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(62, 90, 4, 30);
  // Head skin (warm tone that matches lip/eye detectors)
  ctx.fillStyle = "#c68b6a";
  ctx.fillRect(38, 28, 52, 54);
  // Hair / cap top
  ctx.fillStyle = "#181820";
  ctx.fillRect(36, 20, 56, 12);
  // Brows
  ctx.fillStyle = "#1a1412";
  ctx.fillRect(44, 42, 14, 3);
  ctx.fillRect(70, 42, 14, 3);
  // Eyes with cool white sclera (r>170, g>165, b>170, b+12>=r) and dark pupil
  ctx.fillStyle = "#e2ecf5";
  ctx.fillRect(45, 47, 12, 6);
  ctx.fillRect(71, 47, 12, 6);
  ctx.fillStyle = "#141820";
  ctx.fillRect(49, 48, 4, 4);
  ctx.fillRect(75, 48, 4, 4);
  // Nose shadow
  ctx.fillStyle = "#9e684b";
  ctx.fillRect(62, 54, 4, 10);
  // Upper and lower lips (red > 130, red > green + 10, green > 60, blue < 180)
  ctx.fillStyle = "#b85c48";
  ctx.fillRect(52, 70, 24, 4);
  ctx.fillRect(52, 76, 24, 5);
  // Dark mouth slit at y=74..75 (width 20, 0.08..0.20 of 128 is 10..25)
  ctx.fillStyle = "#160c0c";
  ctx.fillRect(54, 74, 20, 2);
  return canvas.toDataURL("image/png");
}

function synthVoiceWav(text, rate = 8000) {
  const words = String(text || "Hello from Fraymus").trim().split(/\s+/).filter(Boolean);
  const dur = Math.min(4.2, Math.max(1.2, words.length * 0.34));
  const samples = Math.floor(dur * rate);
  const pcm = new Int16Array(samples);
  let cursor = 0;
  const totalWeight = words.reduce((s, w) => s + Math.max(1, w.length), 0);
  for (let w = 0; w < words.length; w += 1) {
    const word = words[w].toLowerCase();
    const span = Math.floor((samples * Math.max(1, word.length)) / totalWeight);
    const spoken = Math.floor(span * 0.86);
    for (let i = 0; i < span && cursor + i < samples; i += 1) {
      const idx = cursor + i;
      if (i >= spoken) {
        pcm[idx] = 0;
        continue;
      }
      const letterIdx = Math.min(word.length - 1, Math.floor((i / spoken) * word.length));
      const ch = word[letterIdx];
      const vowel = "aeiouy".includes(ch);
      const t = idx / rate;
      const env = Math.sin((Math.PI * i) / spoken);
      const f0 = 125 + ((w * 19 + letterIdx * 11) % 45);
      const f1 = vowel ? 520 : 280;
      const f2 = vowel ? 1480 : 920;
      const wave =
        0.55 * Math.sin(2 * Math.PI * f0 * t) +
        0.28 * Math.sin(2 * Math.PI * f1 * t) +
        0.14 * Math.sin(2 * Math.PI * f2 * t);
      const amp = vowel ? 0.78 : 0.36;
      const s = Math.max(-1, Math.min(1, wave * env * amp));
      pcm[idx] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    cursor += span;
  }
  const buf = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buf);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) view.setInt16(44 + i * 2, pcm[i], true);
  return { bytes: new Uint8Array(buf), duration: dur, rate };
}

async function downsampleWav(dataUrl, targetRate = 6000) {
  const bytes = await (await fetch(dataUrl)).arrayBuffer();
  const ctx = new AudioContext();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(bytes.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
  const dur = Math.min(5.0, decoded.duration);
  const length = Math.max(1, Math.ceil(dur * targetRate));
  const offline = new OfflineAudioContext(1, length, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const ch = rendered.getChannelData(0);
  // 8-bit unsigned WAV for compact wire size (6 KB/sec before deflate)
  const buf = new ArrayBuffer(44 + ch.length);
  const view = new DataView(buf);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + ch.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, "data");
  view.setUint32(40, ch.length, true);
  for (let i = 0; i < ch.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, ch[i]));
    view.setUint8(44 + i, Math.round((sample + 1) * 127.5));
  }
  return { bytes: new Uint8Array(buf), duration: dur, rate: targetRate };
}

async function compactSpriteWebp(src, edge = 96) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, edge, edge);
  const scale = Math.min(edge / img.width, edge / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  ctx.drawImage(img, Math.floor((edge - w) / 2), Math.floor((edge - h) / 2), w, h);
  const webp = canvas.toDataURL("image/webp", 0.72);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.76);
}

const SEAL_MAGIC = [0x46, 0x53, 0x45, 0x4c]; // "FSEL"

async function merkleSeal(leavesObj) {
  const keys = ["sprite", "voice", "timeline", "script"];
  const leaves = {};
  for (const k of keys) leaves[k] = await sha256(textBytes(String(leavesObj[k] || "")));
  const h01 = await sha256(textBytes(leaves.sprite + leaves.voice));
  const h23 = await sha256(textBytes(leaves.timeline + leaves.script));
  const root = await sha256(textBytes(h01 + h23));
  return { root, leaves };
}

function canonSeal(env) {
  return [env.v, env.from, env.to, env.ts, env.prev, env.psha, env.merkle.root].join("|");
}

const SIGN_PARAMS = { Ed25519: { name: "Ed25519" }, "ECDSA-P256": { name: "ECDSA", hash: "SHA-256" } };

async function buildSealEnvelope({ from, to, subject, capsule, prev, keys }) {
  const leavesObj = {
    sprite: capsule.sprite,
    voice: capsule.voiceB64,
    timeline: JSON.stringify(capsule.clips),
    script: capsule.text
  };
  const psha = await sha256(textBytes(JSON.stringify(capsule)));
  const tree = await merkleSeal(leavesObj);
  const env = {
    fray: "seal/1",
    v: 16,
    from,
    to,
    subject,
    ts: Date.now(),
    prev: prev || GENESIS,
    capsule,
    psha,
    merkle: tree,
    alg: keys.alg,
    pub: keys.pub
  };
  env.canon = canonSeal(env);
  env.sig = base64(new Uint8Array(await crypto.subtle.sign(SIGN_PARAMS[keys.alg], keys.pair.privateKey, textBytes(env.canon))));
  return env;
}

async function packSeal(env) {
  const json = textBytes(JSON.stringify(env));
  const body = await deflate(json);
  return new Uint8Array([...SEAL_MAGIC, 1, 1, ...body]);
}

async function unpackSeal(bytes) {
  if (!SEAL_MAGIC.every((b, i) => bytes[i] === b)) throw new Error("No FSEL header found in carrier");
  const compressed = (bytes[5] & 1) === 1;
  const body = bytes.slice(6);
  const json = new TextDecoder().decode(compressed ? await inflate(body) : body);
  return { version: bytes[4], compressed, json, env: JSON.parse(json) };
}

function paintCaption(canvas, caption) {
  if (!caption) return;
  const ctx = canvas.getContext("2d");
  const bar = Math.max(36, Math.round(canvas.height * 0.12));
  ctx.fillStyle = "rgba(10, 10, 11, 0.88)";
  ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
  ctx.fillStyle = "#e7eee8";
  ctx.font = `${Math.max(13, Math.round(bar * 0.4))}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption.slice(0, 56), canvas.width / 2, canvas.height - bar / 2);
}

export function applySeal(project, glyph, meta) {
  const safeGlyph = String(glyph || "");
  const title = String(meta?.name || "Living Seal");
  const line = String(meta?.text || "");
  const cardHtml = `<section class="fray-seal-card" style="max-width:460px;margin:28px auto;padding:18px;border:1px solid #262b26;border-radius:12px;background:#101210;color:#e7eee8;font-family:ui-monospace,monospace">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <b>◈ ${title.replace(/[<>&"]/g, "")}</b>
    <span style="color:#3dff9a;font-size:11px">Signed Living Seal · ${meta?.alg || "Ed25519"}</span>
  </div>
  <p style="font-size:12px;color:#8b978e;margin:0 0 10px">“${line.replace(/[<>&"]/g, "")}”</p>
  <div style="padding:10px;background:#070807;border:1px dashed #343b34;border-radius:8px;font-size:28px;line-height:1.3;word-break:break-all">${safeGlyph}</div>
  <p style="font-size:11px;color:#8b978e;margin:8px 0 0">Root ${(meta?.root || "").slice(0, 16)}… · Paste into Fraymus Web Studio → Seal to verify &amp; play.</p>
</section>`;
  if (project.stack !== "mern") {
    return { ...project, html: `${project.html || ""}\n${cardHtml}\n` };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Seal.jsx";
  const pages = next.pages.some((p) => p.name === "Seal") ? next.pages : [...next.pages, { name: "Seal", path: "/seal", file, auth: false }];
  const source = `import React from "react";
const GLYPH = ${JSON.stringify(safeGlyph)};
export default function Seal() {
  return (
    <main className="page">
      <p className="kicker">Living Seal</p>
      <h1>${title.replace(/[<>&"]/g, "")}</h1>
      <p>${line.replace(/[<>&"]/g, "")}</p>
      <pre style={{ padding: 14, background: "#070807", border: "1px dashed #343b34", borderRadius: 8, fontSize: 26, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{GLYPH}</pre>
    </main>
  );
}
`;
  return { ...next, pages, files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) } };
}

const STEPS = [
  ["DECODE", "Carrier glyph → deflate stream → FSEL v1 capsule"],
  ["VERIFY SIG", "Ed25519 / ECDSA signature over sender, target, timestamp & Merkle root"],
  ["MERKLE + REA", "4-leaf Merkle check (sprite, voice, timeline, script) + REA lip-slit check"],
  ["RECOMPOSE", "Single master sprite → painted closed / mid / open / blink cells"],
  ["SPEAK", "Decode embedded WAV + play lip-synced 8-bit avatar on stage"]
];

const freshSteps = () => STEPS.map(([label, detail], index) => ({ id: index + 1, label, detail, status: "idle", proof: "" }));

export default function SealPage({ project, say, onApply }) {
  const savedFaces = project?.cast?.faces || [];
  const [sourceKind, setSourceKind] = useState(() => (savedFaces.length ? "cast" : "demo"));
  const [castId, setCastId] = useState(() => savedFaces[0]?.id || "");
  const [speakerName, setSpeakerName] = useState("Cipher Envoy");
  const [lineText, setLineText] = useState("One glyph carries my face, my voice, and my cryptographic seal.");
  const [from, setFrom] = useState("envoy@fraymus.world");
  const [to, setTo] = useState(MAILBOX);
  const [subject, setSubject] = useState("FRAYMUS-SEAL-AVATAR");
  const [scheme, setScheme] = useState("glyph");
  const [carrier, setCarrier] = useState("🗣️");
  const [windowSec, setWindowSec] = useState("3600");
  const [keys, setKeys] = useState(null);
  const [keyPrint, setKeyPrint] = useState("");
  const [sealed, setSealed] = useState(null);
  const [incoming, setIncoming] = useState("");
  const [steps, setSteps] = useState(freshSteps);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("Mint a self-contained talking avatar inside a single signed emoji, or paste a seal to verify and play it.");
  const stageRef = useRef(null);
  const playRef = useRef(false);
  const unpackedRef = useRef(null);

  useEffect(() => {
    generateKeys().then(async (next) => {
      setKeys(next);
      setKeyPrint(await fingerprint(next.pub));
    });
  }, []);

  const selectedFace = useMemo(
    () => savedFaces.find((f) => f.id === castId) || savedFaces[0] || null,
    [savedFaces, castId]
  );

  async function forgeSeal() {
    if (!keys || busy) return;
    const target = validTarget(to);
    if (!target) {
      setNote("Recipient must be a FRAYMUS number fx-xxxx-xxxx-xxxx-xxxx, FRAYNIX, or BROADCAST.");
      say?.("err", "Invalid FRAYMUS recipient");
      return;
    }
    setBusy(true);
    playRef.current = false;
    setPlaying(false);
    try {
      let spriteUrl = "";
      let wavBytes = null;
      let duration = 0;
      let spokenText = lineText.trim() || "One Seed = Reborn.";
      let name = speakerName.trim() || "Envoy";

      if (sourceKind === "cast" && selectedFace?.cells?.closed) {
        spriteUrl = await compactSpriteWebp(selectedFace.cells.closed, 96);
        name = selectedFace.name || name;
        const firstLine = (selectedFace.lines || []).find((l) => l.wav) || selectedFace.lines?.[0];
        if (firstLine?.text) spokenText = firstLine.text;
        if (firstLine?.wav) {
          const compact = await downsampleWav(firstLine.wav, 6000);
          wavBytes = compact.bytes;
          duration = compact.duration;
        }
      }
      if (!spriteUrl) {
        spriteUrl = makeDemoSprite(128);
      }
      if (!wavBytes) {
        const synth = synthVoiceWav(spokenText, 8000);
        wavBytes = synth.bytes;
        duration = synth.duration;
      }

      const audioCtx = new AudioContext();
      let audioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength));
      } finally {
        audioCtx.close().catch(() => {});
      }

      const envBins = voiceEnvelope(audioBuffer);
      const plan = lineSchedule([{ text: spokenText, audio: audioBuffer, envelope: envBins }], LINE_GAP);
      const hop = 1 / TALK_FPS;
      const clips = [];
      for (let t = 0; t < plan.duration - 0.0001; t += hop) {
        const f = frameAt(plan.captions, t);
        const last = clips[clips.length - 1];
        if (last && last.id === f.id) last.duration = Number((last.duration + hop).toFixed(4));
        else clips.push({ id: f.id, start: Number(t.toFixed(4)), duration: Number(hop.toFixed(4)) });
      }

      const capsule = {
        name,
        text: spokenText,
        duration: Number(plan.duration.toFixed(3)),
        sprite: spriteUrl,
        voiceB64: base64(wavBytes),
        clips
      };

      const prev = localStorage.getItem(PREV_KEY) || GENESIS;
      const env = await buildSealEnvelope({ from, to: target, subject, capsule, prev, keys });
      const wire = await packSeal(env);
      const encoded = encodeWire(wire, scheme === "glyph" ? cleanCarrier(carrier) || "🗣️" : null);
      localStorage.setItem(PREV_KEY, await sha256(textBytes(env.canon)));

      setSealed({ env, wire, text: encoded });
      setIncoming(encoded);
      setSteps(freshSteps());
      setNote(`Forged ${name} into ${scheme === "glyph" ? "1 carrier glyph" : `${[...encoded].length} emoji-64 symbols`} (${wire.length.toLocaleString()} compressed bytes). Click Verify & Play Seal to test.`);
      say?.("ok", `Living Seal forged · ${wire.length} bytes`);
    } catch (error) {
      setNote(error.message || "Could not forge seal.");
      say?.("err", error.message || "Forge failed");
    } finally {
      setBusy(false);
    }
  }

  function tamperSeal() {
    const chars = [...incoming];
    if (chars.length < 6) return;
    if (/[\u{E0100}-\u{E01EF}]/u.test(incoming)) {
      const idx = chars.findIndex((ch, i) => i > chars.length / 2 && ch.codePointAt(0) >= 0xe0100);
      if (idx >= 0) chars[idx] = String.fromCodePoint(((chars[idx].codePointAt(0) - 0xe0100 + 1) % 240) + 0xe0100);
    } else {
      const idx = chars.findIndex((ch, i) => i > chars.length / 2 && ALPHABET.some((g) => g.startsWith(ch)));
      if (idx >= 0) {
        const at = ALPHABET.findIndex((g) => g.startsWith(chars[idx]));
        chars[idx] = ALPHABET[(at + 1) % 64].replace(/\uFE0F/g, "");
      }
    }
    setIncoming(chars.join(""));
    setSteps(freshSteps());
    setNote("Tampered 1 byte inside the carrier. Run Verify & Play Seal to see the signature and Merkle guard reject it.");
    say?.("ok", "Tampered 1 symbol in the seal");
  }

  async function verifyAndPlay() {
    if (!incoming.trim() || busy) return;
    setBusy(true);
    playRef.current = false;
    setPlaying(false);
    const nextSteps = freshSteps();
    const mark = (id, status, proof = "") => {
      const idx = id - 1;
      nextSteps[idx] = { ...nextSteps[idx], status, proof };
      setSteps([...nextSteps]);
    };

    try {
      // Step 1: Decode
      mark(1, "running");
      const decoded = decodeWire(incoming);
      if (!decoded.bytes.length) throw new Error("No variation selectors or Emoji-64 payload found.");
      const unpacked = await unpackSeal(decoded.bytes);
      const env = unpacked.env;
      const cap = env.capsule || {};
      mark(1, "done", `${decoded.scheme === "glyph" ? `1 glyph + ${decoded.bytes.length} selectors` : "emoji-64"} → ${decoded.bytes.length} B → FSEL v${unpacked.version} (${unpacked.json.length} B JSON)`);

      // Step 2: Verify cryptographic signature
      mark(2, "running");
      if (!env.sig || !env.pub || !env.alg) throw new Error("Unsigned seal payload.");
      const canon = canonSeal(env);
      if (env.canon !== canon) throw new Error("Canonical header mismatch.");
      const validSig = await verifySignature(env.alg, env.pub, canon, env.sig);
      if (!validSig) throw new Error(`${env.alg} signature verification FAILED — carrier was altered.`);
      const fp = await fingerprint(env.pub);
      mark(2, "done", `${env.alg} verify = TRUE · key ${fp}`);

      // Step 3: Merkle + Freshness + REA lip check
      mark(3, "running");
      const psha = await sha256(textBytes(JSON.stringify(cap)));
      if (psha !== env.psha) throw new Error("Capsule SHA-256 mismatch.");
      const tree = await merkleSeal({
        sprite: cap.sprite,
        voice: cap.voiceB64,
        timeline: JSON.stringify(cap.clips),
        script: cap.script ?? cap.text
      });
      if (tree.root !== env.merkle?.root) throw new Error("4-leaf Merkle root mismatch — sprite, voice, or script was modified.");
      const age = Date.now() - Number(env.ts);
      const limit = Number(windowSec) * 1000;
      if (limit && Math.abs(age) > limit) throw new Error("Seal is outside the freshness window.");

      const baseImg = await toImageData(cap.sprite, 128);
      const cells = composeTalkCells(baseImg);
      const rea = inspectTalk(cells.closed, cells.open);
      if (!rea.ok) {
        cells.mid = cells.closed;
        cells.open = cells.closed;
      }
      mark(3, "done", `Merkle root ${tree.root.slice(0, 12)}… ok · REA lip slit y=${rea.cy} (${rea.lip} lip px, ${rea.other} outside)`);

      // Step 4: Recompose 4 cells onto stage
      mark(4, "running");
      if (stageRef.current) {
        drawCrisp(stageRef.current, cells.closed, 360);
        paintCaption(stageRef.current, `${cap.name}: “${cap.text}”`);
      }
      mark(4, "done", `4 cells composed locally from 1 master sprite (closed, mid, open, blink)`);

      // Step 5: Decode WAV & play lip-synced performance
      mark(5, "running");
      const wavBytes = bytesFromBase64(cap.voiceB64);
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength));
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.connect(ctx.destination);

      unpackedRef.current = { env, cap, cells, audio };
      playRef.current = true;
      setPlaying(true);
      const start = ctx.currentTime;
      src.start();

      mark(5, "done", `Speaking “${cap.text}” · ${audio.duration.toFixed(2)}s · ${cap.clips?.length || 0} timeline spans`);
      setNote(`Verified ${cap.name} (${fp}). Playing directly from the decoded emoji carrier.`);
      say?.("ok", `Verified & playing ${cap.name}`);

      const clips = Array.isArray(cap.clips) ? cap.clips : [];
      const loop = () => {
        if (!playRef.current) {
          try { src.stop(); } catch { /* stopped */ }
          ctx.close().catch(() => {});
          setPlaying(false);
          return;
        }
        const elapsed = ctx.currentTime - start;
        if (elapsed >= audio.duration) {
          playRef.current = false;
          setPlaying(false);
          ctx.close().catch(() => {});
          if (stageRef.current) {
            drawCrisp(stageRef.current, cells.closed, 360);
            paintCaption(stageRef.current, `${cap.name}: “${cap.text}”`);
          }
          return;
        }
        const active = clips.find((c) => elapsed >= c.start && elapsed < c.start + c.duration);
        const cellId = active?.id || "closed";
        if (stageRef.current) {
          drawCrisp(stageRef.current, cells[cellId] || cells.closed, 360);
          paintCaption(stageRef.current, cap.text);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (error) {
      const runningIdx = nextSteps.findIndex((s) => s.status === "running");
      if (runningIdx >= 0) mark(runningIdx + 1, "fail", error.message);
      setNote(`Verification rejected: ${error.message}`);
      say?.("err", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendToMailbox() {
    if (!sealed) return;
    setBusy(true);
    try {
      const body = `Fraymus Living Seal (${sealed.env.capsule.name}). Paste into Fraymus Web Studio > Seal to verify and play.\n\n${sealed.text}`;
      const res = await fetch("/api/mail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: sealed.env.from,
          to: sealed.env.to,
          subject: sealed.env.subject,
          body,
          folder: "inbox"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not deliver to local mailbox.");
      setNote(`Delivered Living Seal to local mailbox (${sealed.env.to}). Open Mail to inspect it.`);
      say?.("ok", "Delivered Living Seal to local mailbox");
    } catch (error) {
      setNote(error.message);
      say?.("err", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyGlyph() {
    if (!incoming) return;
    try {
      await navigator.clipboard.writeText(incoming);
      say?.("ok", "Copied Living Seal glyph");
    } catch {
      say?.("err", "Clipboard blocked in this view");
    }
  }

  const statusIcon = { idle: "○", running: "◌", done: "✓", fail: "✕" };

  return (
    <div className="tool dispatch">
      <aside className="tool-side">
        <b>Living Seal</b>
        <span className="muted">
          Pack an 8-bit talking avatar, its voice, its lip-sync timeline, and an Ed25519 Merkle signature into a single copy-pasteable emoji.
        </span>
        <div className="seg">
          <button className={sourceKind === "demo" ? "on" : ""} onClick={() => setSourceKind("demo")}>Stand-in Envoy</button>
          <button className={sourceKind === "cast" ? "on" : ""} onClick={() => setSourceKind("cast")} disabled={!savedFaces.length}>
            Project Cast ({savedFaces.length})
          </button>
        </div>

        {sourceKind === "cast" && savedFaces.length > 0 ? (
          <label className="field">
            <span>Cast member</span>
            <select value={selectedFace?.id || ""} onChange={(e) => setCastId(e.target.value)}>
              {savedFaces.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.lines?.length || 0} lines)</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Envoy name</span>
            <input value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>Spoken line</span>
          <textarea
            className="dispatch-code"
            rows={3}
            value={lineText}
            onChange={(e) => setLineText(e.target.value)}
            placeholder="What the sealed avatar says"
          />
        </label>

        <label className="field">
          <span>From</span>
          <input value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>To (FRAYMUS number)</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="field">
          <span>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>

        <div className="seg">
          <button className={scheme === "glyph" ? "on" : ""} onClick={() => setScheme("glyph")}>One glyph</button>
          <button className={scheme === "emoji64" ? "on" : ""} onClick={() => setScheme("emoji64")}>Emoji-64</button>
        </div>
        {scheme === "glyph" && (
          <div className="row">
            <EmojiSelect value={carrier} onChange={setCarrier} label="Carrier emoji" />
            <span className="muted" style={{ flex: 1 }}>Hides sprite + WAV + signature inside 1 emoji.</span>
          </div>
        )}

        <button className="btn on" disabled={!keys || busy} onClick={forgeSeal}>
          {busy ? "Forging…" : keys ? `Forge Living Seal (${keys.alg})` : "Preparing keys…"}
        </button>
        {keyPrint && <span className="muted">Session key: {keyPrint}</span>}
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Seal</b>
          <span className="muted">cryptographic talking avatar · {sealed ? `${sealed.wire.length.toLocaleString()} B in carrier` : "ready"}</span>
          <span className="spacer" />
          <button className="btn" disabled={!incoming || busy} onClick={tamperSeal}>Tamper</button>
          <button className="btn on" disabled={!incoming || busy} onClick={verifyAndPlay}>
            {playing ? "Playing…" : "▶ Verify & Play Seal"}
          </button>
          <button className="btn" disabled={!playing} onClick={() => { playRef.current = false; setPlaying(false); }}>Stop</button>
          <button
            className="btn"
            disabled={!sealed || !project}
            onClick={() => {
              onApply(applySeal(project, sealed.text, {
                name: sealed.env.capsule.name,
                text: sealed.env.capsule.text,
                alg: sealed.env.alg,
                root: sealed.env.merkle?.root
              }));
              say?.("ok", "Placed Living Seal in project");
            }}
          >
            Place in project
          </button>
        </div>

        <div className="dispatch-body">
          <div className="dispatch-steps">
            {steps.map((s) => (
              <div key={s.id} className={`dispatch-step ${s.status}`}>
                <span className="dispatch-icon">{statusIcon[s.status]}</span>
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <b>{s.id}. {s.label}</b>
                  <span className="muted">{s.detail}</span>
                  {s.proof && <code>{s.proof}</code>}
                </div>
              </div>
            ))}
            <p className="muted" style={{ margin: "6px 0 0" }}>{note}</p>
          </div>

          <div className="dispatch-stage" style={{ alignItems: "center", justifyContent: "center", padding: 12 }}>
            <canvas
              ref={stageRef}
              width={360}
              height={360}
              aria-label="Living Seal stage"
              style={{ width: "min(100%, 360px)", aspectRatio: "1 / 1", background: "#0a0a0b", border: "1px solid var(--line2)", borderRadius: 10, imageRendering: "pixelated" }}
            />
          </div>
        </div>
      </section>

      <aside className="tool-side">
        <b>Carrier payload</b>
        <span className="muted">
          Copy this single emoji into an email, chat, or page. Paste any Living Seal below to verify its signature, check its 4-leaf Merkle tree, and play the avatar.
        </span>
        <textarea
          className="dispatch-code"
          rows={6}
          value={incoming}
          onChange={(e) => { setIncoming(e.target.value); setSteps(freshSteps()); }}
          placeholder="🗣️…"
          spellCheck={false}
          aria-label="Seal carrier"
        />
        <div className="row">
          <button className="btn on" disabled={!incoming} onClick={copyGlyph}>Copy seal</button>
          <button className="btn" disabled={!sealed || busy} onClick={sendToMailbox}>Deliver to Mail</button>
        </div>
        <label className="field">
          <span>Freshness window</span>
          <select value={windowSec} onChange={(e) => setWindowSec(e.target.value)}>
            {WINDOWS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </label>
        {sealed && (
          <div className="stack">
            <b>Merkle leaves</b>
            <span className="muted">sprite: {sealed.env.merkle.leaves.sprite.slice(0, 14)}…</span>
            <span className="muted">voice: {sealed.env.merkle.leaves.voice.slice(0, 14)}…</span>
            <span className="muted">timeline: {sealed.env.merkle.leaves.timeline.slice(0, 14)}…</span>
            <span className="muted">script: {sealed.env.merkle.leaves.script.slice(0, 14)}…</span>
          </div>
        )}
      </aside>
    </div>
  );
}

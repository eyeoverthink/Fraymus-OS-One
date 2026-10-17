import { base64, decodeGlyph, encodeGlyph, sha256, textBytes } from "./emojiCodec.js";

export const ALPHABET = ["🟦", "🟩", "🟥", "🟨", "🟪", "🟧", "⬛", "⬜", "🔵", "🟢", "🔴", "🟡", "🟣", "🟠", "⚫", "⚪", "🔷", "💚", "❤️", "💛", "💜", "🧡", "🖤", "🤍", "🚀", "🤖", "💾", "📦", "🧬", "⚙️", "🔐", "🔑", "🌐", "📡", "💡", "🔋", "🧠", "👁️", "🎯", "🛰️", "🦾", "🦿", "🧩", "⚡", "🔥", "❄️", "🌊", "🌪️", "🎮", "🎲", "🧿", "🔮", "💎", "🏴", "🏳️", "🚩", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
export const PAD = "💤";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map(ALPHABET.map((glyph, index) => [glyph.replace(/\uFE0F/g, ""), B64[index]]));
LOOKUP.set(PAD, "=");

export const MAGIC = [0x46, 0x52, 0x41, 0x59];
export const GENESIS = "0".repeat(64);
export const WINDOWS = [["300", "5 min"], ["3600", "1 hour"], ["86400", "1 day"], ["0", "off"]];

export const ROBOT_CSS = `@keyframes roboRun {
  0% { transform: translateX(0) rotate(0) }
  25% { transform: translateX(30px) rotate(2deg) }
  50% { transform: translateX(70px) rotate(-1deg) }
  75% { transform: translateX(30px) rotate(1deg) }
  100% { transform: translateX(0) rotate(0) }
}
.robo { animation: roboRun 1.2s infinite; border-color: #3dff9a; }`;
export const ROBOT_JS = `robot.say("payload received");
robot.move(60);
setTimeout(() => robot.move(-30), 1400);`;
export const ROBOT_HTML = "";

export function bytesFromBase64(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function toEmoji64(bytes) {
  return [...base64(bytes)].map((ch) => (ch === "=" ? PAD : ALPHABET[B64.indexOf(ch)])).join("");
}

export function fromEmoji64(text) {
  let out = "";
  for (const ch of String(text).replace(/\uFE0F/g, "")) {
    const symbol = LOOKUP.get(ch);
    if (symbol) out += symbol;
  }
  return out ? bytesFromBase64(out) : new Uint8Array();
}

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
export const deflate = (bytes) => pipe(bytes, new CompressionStream("deflate-raw"));
export const inflate = (bytes) => pipe(bytes, new DecompressionStream("deflate-raw"));

export async function generateKeys() {
  try {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    return { alg: "Ed25519", pair, pub: base64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) };
  } catch {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    return { alg: "ECDSA-P256", pair, pub: base64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) };
  }
}

const SIGN_PARAMS = { Ed25519: { name: "Ed25519" }, "ECDSA-P256": { name: "ECDSA", hash: "SHA-256" } };
const IMPORT_PARAMS = { Ed25519: { name: "Ed25519" }, "ECDSA-P256": { name: "ECDSA", namedCurve: "P-256" } };

export async function verifySignature(alg, pub, canon, sig) {
  if (!SIGN_PARAMS[alg]) throw new Error(`Unknown signature algorithm ${alg}`);
  const key = await crypto.subtle.importKey("raw", bytesFromBase64(pub), IMPORT_PARAMS[alg], false, ["verify"]);
  return crypto.subtle.verify(SIGN_PARAMS[alg], key, bytesFromBase64(sig), textBytes(canon));
}

export const LEAVES = ["css", "js", "html", "wasm"];

async function hashPair(left, right) {
  return sha256(textBytes(left + right));
}

export async function merkle(program) {
  const leaves = {};
  for (const name of LEAVES) leaves[name] = await sha256(textBytes(String(program[name] || "")));
  let level = LEAVES.map((name) => leaves[name]);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(await hashPair(level[i], level[i + 1] ?? level[i]));
    level = next;
  }
  return { root: level[0], leaves };
}

export const canonOf = (env) => [env.v, env.from, env.to, env.ts, env.prev, env.psha, env.merkle.root].join("|");

export async function buildEnvelope({ from, to, subject, program, prev, keys }) {
  const psha = await sha256(textBytes(JSON.stringify(program)));
  const tree = await merkle(program);
  const env = { fray: "dispatch/1", v: 15, from, to, subject, ts: Date.now(), prev: prev || GENESIS, program, psha, merkle: tree, alg: keys.alg, pub: keys.pub };
  env.canon = canonOf(env);
  env.sig = base64(new Uint8Array(await crypto.subtle.sign(SIGN_PARAMS[keys.alg], keys.pair.privateKey, textBytes(env.canon))));
  return env;
}

export async function packEnvelope(env, compress = true) {
  const json = textBytes(JSON.stringify(env));
  const body = compress ? await deflate(json) : json;
  return new Uint8Array([...MAGIC, 1, compress ? 1 : 0, ...body]);
}

export function encodeWire(bytes, carrier) {
  return carrier ? encodeGlyph(bytes, carrier) : toEmoji64(bytes);
}

const GLYPH_SELECTOR = /[\uFE00-\uFE0E]|[\u{E0100}-\u{E01EF}]/u;

export function decodeWire(text) {
  if (GLYPH_SELECTOR.test(text)) return { scheme: "glyph", bytes: decodeGlyph(text).bytes };
  return { scheme: "emoji64", bytes: fromEmoji64(text) };
}

export async function unpackWire(bytes) {
  if (bytes[0] === 0x7b) return { framed: false, compressed: false, json: new TextDecoder().decode(bytes) };
  if (!MAGIC.every((byte, index) => bytes[index] === byte)) throw new Error("No FRAY header and not plain JSON");
  const compressed = (bytes[5] & 1) === 1;
  const body = bytes.slice(6);
  return { framed: true, version: bytes[4], compressed, json: new TextDecoder().decode(compressed ? await inflate(body) : body) };
}

export async function fingerprint(pub) {
  return (await sha256(bytesFromBase64(pub))).slice(0, 16).replace(/(....)(?=.)/g, "$1 ");
}

export function mailtoLink(env, body) {
  return `mailto:${encodeURIComponent(env.to)}?subject=${encodeURIComponent(env.subject || "FRAYMUS-OP")}&body=${encodeURIComponent(body)}`;
}

export function gmailLink(env, body) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(env.to)}&su=${encodeURIComponent(env.subject || "FRAYMUS-OP")}&body=${encodeURIComponent(body)}`;
}

export const MAIL_NOTE = "Fraymus payload. Paste everything below into Fraymus Web Studio > Dispatch > Receive to verify and run it.";

function uleb(value) {
  const out = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    out.push(byte);
  } while (value);
  return out;
}

function sleb(value) {
  const out = [];
  for (;;) {
    const byte = value & 0x7f;
    value >>= 7;
    if ((value === 0 && !(byte & 0x40)) || (value === -1 && byte & 0x40)) {
      out.push(byte);
      return out;
    }
    out.push(byte | 0x80);
  }
}

const wsection = (id, body) => [id, ...uleb(body.length), ...body];
const wname = (text) => [...uleb(textBytes(text).length), ...textBytes(text)];

export const MOVIE = { w: 160, h: 90 };

export function buildMovieWasm() {
  const { w, h } = MOVIE;
  const get = (index) => [0x20, index];
  const set = (index) => [0x21, index];
  const i32 = (value) => [0x41, ...sleb(value)];
  const T = 0, X = 1, Y = 2;
  const pixel = [
    ...get(Y), ...i32(w), 0x6c, ...get(X), 0x6a, ...i32(2), 0x74,
    ...get(X), ...i32(1), 0x74, ...get(T), 0x6a, ...i32(255), 0x71,
    ...get(Y), ...i32(3), 0x6c, ...get(T), ...i32(1), 0x74, 0x6a, ...i32(255), 0x71, ...i32(8), 0x74, 0x72,
    ...get(X), ...get(Y), 0x73, ...get(T), 0x6a, ...i32(255), 0x71, ...i32(16), 0x74, 0x72,
    ...i32(-16777216), 0x72,
    0x36, 0x02, 0x00
  ];
  const frameBody = [
    0x01, 0x02, 0x7f,
    ...i32(0), ...set(Y),
    0x02, 0x40, 0x03, 0x40,
    ...get(Y), ...i32(h), 0x4f, 0x0d, 0x01,
    ...i32(0), ...set(X),
    0x02, 0x40, 0x03, 0x40,
    ...get(X), ...i32(w), 0x4f, 0x0d, 0x01,
    ...pixel,
    ...get(X), ...i32(1), 0x6a, ...set(X), 0x0c, 0x00,
    0x0b, 0x0b,
    ...get(Y), ...i32(1), 0x6a, ...set(Y), 0x0c, 0x00,
    0x0b, 0x0b,
    0x0b
  ];
  const ep3Body = [0x00, ...i32(42), 0x0b];
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...wsection(1, [0x02, 0x60, 0x00, 0x01, 0x7f, 0x60, 0x01, 0x7f, 0x00]),
    ...wsection(3, [0x02, 0x00, 0x01]),
    ...wsection(5, [0x01, 0x00, 0x01]),
    ...wsection(7, [0x03, ...wname("ep3"), 0x00, 0x00, ...wname("frame"), 0x00, 0x01, ...wname("mem"), 0x02, 0x00]),
    ...wsection(10, [0x02, ...uleb(ep3Body.length), ...ep3Body, ...uleb(frameBody.length), ...frameBody]),
    ...wsection(0, [...wname("fraymus.movie"), ...textBytes(JSON.stringify({ name: "plasma", w, h, fps: 30 }))])
  ]);
}

const scriptSafe = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export function stageDoc(program, run) {
  const css = String(program.css || "").replace(/<\/style/gi, "<\\/style");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0e14;color:#e6ecf2;font:12px ui-monospace,Menlo,monospace}
.stage{position:relative;height:120px;overflow:hidden;border-bottom:1px solid #232a36;background-image:linear-gradient(#141a24 1px,transparent 1px),linear-gradient(90deg,#141a24 1px,transparent 1px);background-size:16px 16px}
.robo{position:absolute;left:16px;top:30px;width:56px;height:56px;display:grid;place-items:center;font-size:30px;border-radius:8px;background:#232a36;border:1px solid #6ee7a8;transition:translate .6s ease}
.floor{position:absolute;bottom:6px;left:8px;right:8px;height:2px;background:#232a36}
.bubble{position:absolute;left:84px;top:18px;padding:3px 8px;border-radius:8px;background:#e6ecf2;color:#0b0e14;font-size:11px;opacity:0;transition:opacity .3s}
.bubble.on{opacity:1}
.movie{display:flex;gap:10px;align-items:center;padding:8px}
canvas{width:240px;height:135px;image-rendering:pixelated;border:1px solid #232a36;border-radius:6px;background:#000}
#app{padding:0 8px}
${css}
</style></head><body>
<div class="stage"><div class="robo" id="robo">🤖</div><div class="bubble" id="bubble"></div><div class="floor"></div></div>
<div class="movie"><canvas id="movie"></canvas><div id="meta">waiting for WASM…</div></div>
<div id="app">${program.html || ""}</div>
<script>
const RUN = ${scriptSafe(run)};
const send = (type, data) => parent.postMessage({ fray: "dispatch", run: RUN, type, ...data }, "*");
const log = (...parts) => send("log", { text: parts.map(String).join(" ") });
window.onerror = (message, source, line) => { send("error", { text: message + (line ? " (line " + line + ")" : "") }); };
const robo = document.getElementById("robo");
const bubble = document.getElementById("bubble");
const robot = {
  x: 0,
  move(px) { this.x += Number(px) || 0; robo.style.translate = this.x + "px 0"; log("robot.move(" + px + ") → x=" + this.x); },
  say(text) { bubble.textContent = String(text); bubble.classList.add("on"); setTimeout(() => bubble.classList.remove("on"), 1800); log("robot.say(" + JSON.stringify(String(text)) + ")"); },
  spin() { robo.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 700 }); log("robot.spin()"); }
};
(async () => {
  const b64 = ${scriptSafe(program.wasm || "")};
  if (b64) {
    try {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const { module, instance } = await WebAssembly.instantiate(bytes);
      const ex = instance.exports;
      const section = WebAssembly.Module.customSections(module, "fraymus.movie")[0];
      const meta = section ? JSON.parse(new TextDecoder().decode(section)) : { w: 160, h: 90, fps: 30 };
      const ep3 = typeof ex.ep3 === "function" ? ex.ep3() : null;
      send("wasm", { bytes: bytes.length, exports: Object.keys(ex), ep3, meta });
      const memory = ex.mem || ex.memory;
      if (typeof ex.frame === "function" && memory) {
        const canvas = document.getElementById("movie");
        canvas.width = meta.w; canvas.height = meta.h;
        const ctx = canvas.getContext("2d");
        let t = 0, frames = 0, last = 0;
        const tick = (now) => {
          if (now - last >= 1000 / (meta.fps || 30)) {
            last = now;
            ex.frame(t++);
            ctx.putImageData(new ImageData(new Uint8ClampedArray(memory.buffer, 0, meta.w * meta.h * 4).slice(), meta.w, meta.h), 0, 0);
            frames++;
            if (frames === 1 || frames % 30 === 0) document.getElementById("meta").textContent = (meta.name || "movie") + " · " + meta.w + "×" + meta.h + " · frame " + frames + " · computed in WASM";
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else document.getElementById("meta").textContent = "WASM ran · no frame() export, so no movie";
    } catch (error) { send("error", { text: "WASM: " + error.message }); }
  } else document.getElementById("meta").textContent = "no WASM in this payload";
  try {
    new Function("robot", "log", ${scriptSafe(String(program.js || ""))})(robot, log);
    send("js", { ok: true });
  } catch (error) { send("error", { text: "JS: " + error.message }); }
})();
</script></body></html>`;
}

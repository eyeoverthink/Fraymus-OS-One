import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { base64, cleanCarrier, sha256, textBytes } from "./emojiCodec.js";
import EmojiSelect from "./EmojiSelect.jsx";
import {
  ALPHABET, GENESIS, MAIL_NOTE, PAD, ROBOT_CSS, ROBOT_HTML, ROBOT_JS, WINDOWS,
  buildEnvelope, buildMovieWasm, bytesFromBase64, canonOf, decodeWire, encodeWire, fingerprint, generateKeys,
  gmailLink, mailtoLink, merkle, packEnvelope, stageDoc, unpackWire, verifySignature
} from "./dispatchCore.js";

const FORM_KEY = "fraymus.dispatch.form";
const PROGRAM_KEY = "fraymus.dispatch.program";
const PREV_KEY = "fraymus.dispatch.prev";
const MOVIE_B64 = base64(buildMovieWasm());
const DEFAULT_PROGRAM = { command: "EXECUTE", css: ROBOT_CSS, js: ROBOT_JS, html: ROBOT_HTML, wasm: MOVIE_B64 };
const STEPS = [
  ["DECODE", "emoji → bytes → FRAY header → inflate → envelope"],
  ["VERIFY SIG", "signature over from|to|ts|prev|psha|root"],
  ["MERKLE + CHAIN", "recompute root, payload hash, prev, time window"],
  ["UNPACK", "program → files, WASM validated"],
  ["EXECUTE", "robot CSS + robot JS + WASM movie, sandboxed"],
  ["DISPATCH", "mail to the recipient named in the payload"]
];
const freshSteps = () => STEPS.map(([label, detail], index) => ({ id: index + 1, label, detail, status: "idle", proof: "" }));
const LONG_LINK = 8000;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function download(name, data, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeAttr = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const ago = (ms) => (ms < 90000 ? `${Math.round(ms / 1000)} s` : ms < 5400000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);

export function applyDispatch(project, program) {
  const frame = `<iframe class="fray-robot" title="Fraymus robot" sandbox="allow-scripts" style="width:100%;height:300px;border:0;border-radius:10px" srcdoc="${escapeAttr(stageDoc(program, 0))}"></iframe>`;
  if (project.stack !== "mern") return { ...project, html: `${project.html || ""}\n${frame}\n` };
  const next = ensureMern(project);
  const file = "client/src/pages/Robot.jsx";
  const pages = next.pages.some((page) => page.name === "Robot") ? next.pages : [...next.pages, { name: "Robot", path: "/robot", file, auth: false }];
  const source = `import React from "react";
const STAGE = ${JSON.stringify(stageDoc(program, 0))};
export default function Robot() {
  return (
    <main className="page">
      <iframe title="Fraymus robot" sandbox="allow-scripts" srcDoc={STAGE} style={{ width: "100%", height: 300, border: 0, borderRadius: 10 }} />
    </main>
  );
}
`;
  return { ...next, pages, files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) } };
}

export default function DispatchPage({ project, say, onApply }) {
  const [form, setForm] = useState(() => readJson(FORM_KEY, { from: "me@fraymus.world", to: "fx-4041@fraymus.world", subject: "FRAYMUS-OP" }));
  const [program, setProgram] = useState(() => readJson(PROGRAM_KEY, DEFAULT_PROGRAM));
  const [part, setPart] = useState("css");
  const [scheme, setScheme] = useState("emoji64");
  const [carrier, setCarrier] = useState("🤖");
  const [compress, setCompress] = useState(true);
  const [keys, setKeys] = useState(null);
  const [print, setPrint] = useState("");
  const [built, setBuilt] = useState(null);
  const [incoming, setIncoming] = useState("");
  const [windowSec, setWindowSec] = useState("300");
  const [steps, setSteps] = useState(freshSteps);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);
  const [log, setLog] = useState([]);
  const [received, setReceived] = useState(null);
  const ctx = useRef({});
  const runRef = useRef(0);
  const stopRef = useRef(false);

  useEffect(() => { localStorage.setItem(FORM_KEY, JSON.stringify(form)); }, [form]);
  useEffect(() => { localStorage.setItem(PROGRAM_KEY, JSON.stringify(program)); }, [program]);
  useEffect(() => {
    generateKeys().then(async (next) => {
      setKeys(next);
      setPrint(await fingerprint(next.pub));
    });
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.fray !== "dispatch" || data.run !== runRef.current) return;
      if (data.type === "log") setLog((current) => [...current.slice(-40), `› ${data.text}`]);
      if (data.type === "error") {
        setLog((current) => [...current.slice(-40), `✕ ${data.text}`]);
        if (data.text.startsWith("WASM:")) setSteps((current) => current.map((step) => (step.id === 5 ? { ...step, status: "fail", proof: data.text } : step)));
      }
      if (data.type === "wasm") {
        setLog((current) => [...current.slice(-40), `› WASM ${data.bytes} B instantiated · exports ${data.exports.join(", ")}${data.ep3 != null ? ` · ep3() = ${data.ep3}` : ""}`]);
        setSteps((current) => current.map((step) => (step.id === 5 ? { ...step, status: "done", proof: `WebAssembly.instantiate ok · ep3() = ${data.ep3} · movie ${data.meta.w}×${data.meta.h} rendering · robot CSS injected` } : step)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const body = built ? `${MAIL_NOTE}\n\n${built.text}` : "";
  const mailto = built ? mailtoLink(built.env, body) : "";
  const gmail = built ? gmailLink(built.env, body) : "";
  const wasmBytes = useMemo(() => {
    try { return program.wasm ? bytesFromBase64(program.wasm) : new Uint8Array(); } catch { return new Uint8Array(); }
  }, [program.wasm]);

  function resetPipeline() {
    stopRef.current = true;
    setRunning(false);
    setSteps(freshSteps());
    setTick(0);
    setStage(null);
    setLog([]);
    setReceived(null);
    ctx.current = {};
  }

  async function seal() {
    if (!keys) return;
    const prev = localStorage.getItem(PREV_KEY) || GENESIS;
    const env = await buildEnvelope({ ...form, program, prev, keys });
    const wire = await packEnvelope(env, compress);
    const text = encodeWire(wire, scheme === "glyph" ? cleanCarrier(carrier) || "🤖" : null);
    localStorage.setItem(PREV_KEY, await sha256(textBytes(env.canon)));
    setBuilt({ env, wire, text });
    setIncoming(text);
    resetPipeline();
    say?.(`Signed with ${env.alg} and encoded: ${wire.length} bytes → ${[...text].length} emoji code points`);
  }

  function tamper() {
    const chars = [...incoming];
    if (chars.length < 8) return;
    if (scheme === "glyph" && /[\u{E0100}-\u{E01EF}]/u.test(incoming)) {
      const index = chars.findIndex((ch, i) => i > chars.length / 2 && ch.codePointAt(0) >= 0xe0100);
      chars[index] = String.fromCodePoint(((chars[index].codePointAt(0) - 0xe0100 + 1) % 240) + 0xe0100);
    } else {
      const index = chars.findIndex((ch, i) => i > chars.length / 2 && ALPHABET.some((glyph) => glyph.startsWith(ch)));
      const at = ALPHABET.findIndex((glyph) => glyph.startsWith(chars[index]));
      chars[index] = ALPHABET[(at + 1) % 64].replace(/\uFE0F/g, "");
    }
    setIncoming(chars.join(""));
    resetPipeline();
    say?.("Changed one symbol in the received payload. Run the heartbeat to see where it is caught.");
  }

  async function runStep(id) {
    const c = ctx.current;
    if (id === 1) {
      if (!incoming.trim()) throw new Error("Nothing to decode. Sign & encode, or paste a received payload.");
      const decoded = decodeWire(incoming);
      if (!decoded.bytes.length) throw new Error("No payload symbols found");
      const unpacked = await unpackWire(decoded.bytes);
      c.env = JSON.parse(unpacked.json);
      c.unpacked = unpacked;
      setReceived(c.env);
      const symbols = decoded.scheme === "glyph" ? `one glyph with ${decoded.bytes.length} selectors` : `${[...incoming.replace(/\uFE0F/g, "")].filter((ch) => ch === PAD || ALPHABET.some((glyph) => glyph.startsWith(ch))).length} emoji-64 symbols`;
      return `${symbols} → ${decoded.bytes.length} bytes · ${unpacked.framed ? `FRAY v${unpacked.version} header` : "plain JSON (archive format)"}${unpacked.compressed ? ` · inflated to ${unpacked.json.length} bytes` : ""}`;
    }
    if (id === 2) {
      const env = c.env;
      if (!env.sig || !env.pub || !env.alg) throw new Error("Unsigned payload: no sig, pub, or alg (archive payloads carry a placeholder signature)");
      const canon = canonOf(env);
      if (env.canon && env.canon !== canon) throw new Error("canon field does not match the payload fields");
      const valid = await verifySignature(env.alg, env.pub, canon, env.sig);
      if (!valid) throw new Error(`${env.alg} verify(pub, canon, sig) = FALSE — the payload was changed after signing`);
      c.print = await fingerprint(env.pub);
      return `${env.alg} verify(pub, canon, sig) = TRUE · key ${c.print}${keys && env.pub === keys.pub ? " (this session's key)" : ""}`;
    }
    if (id === 3) {
      const env = c.env;
      const psha = await sha256(textBytes(JSON.stringify(env.program)));
      if (psha !== env.psha) throw new Error("payload hash (psha) mismatch");
      const tree = await merkle(env.program);
      if (tree.root !== env.merkle?.root) throw new Error("Merkle root mismatch — a program part was changed");
      const age = Date.now() - Number(env.ts);
      const limit = Number(windowSec) * 1000;
      if (limit && Math.abs(age) > limit) throw new Error(`Stale: signed ${ago(age)} ago, outside the ${WINDOWS.find(([value]) => value === windowSec)[1]} window`);
      return `root ${tree.root.slice(0, 12)}… matches 4 leaves · psha ok · prev ${env.prev === GENESIS ? "genesis" : `${env.prev.slice(0, 12)}…`} · signed ${ago(Math.max(0, age))} ago${limit ? " · inside window" : ""}`;
    }
    if (id === 4) {
      const prog = c.env.program || {};
      const files = [["robot.css", textBytes(prog.css || "")], ["robot.js", textBytes(prog.js || "")], ["index.html", textBytes(prog.html || "")]];
      if (prog.wasm) {
        const bytes = bytesFromBase64(prog.wasm);
        if (!WebAssembly.validate(bytes)) throw new Error("movie.wasm failed WebAssembly.validate");
        files.push(["movie.wasm", bytes]);
      }
      c.files = files;
      return files.map(([name, bytes]) => `${name} ${bytes.length} B`).join(" · ") + (prog.wasm ? " · WASM valid" : "");
    }
    if (id === 5) {
      runRef.current += 1;
      setLog([`› stage ${runRef.current}: injecting ${c.env.program.css ? "robot CSS" : "no CSS"}, running JS in a sandbox`]);
      setStage({ run: runRef.current, doc: stageDoc(c.env.program, runRef.current) });
      return "launching stage…";
    }
    if (id === 6) {
      const env = c.env;
      const text = incoming;
      c.mail = { to: env.to, subject: env.subject || "FRAYMUS-OP", mailto: mailtoLink(env, `${MAIL_NOTE}\n\n${text}`), gmail: gmailLink(env, `${MAIL_NOTE}\n\n${text}`) };
      return `ready for ${env.to} · subject ${c.mail.subject} · mailto ${c.mail.mailto.length.toLocaleString()} chars${c.mail.mailto.length > LONG_LINK ? " (long: use Copy or Download if your mail app truncates)" : ""}`;
    }
    return "";
  }

  async function step(id) {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, status: "running" } : s)));
    try {
      const proof = await runStep(id);
      const waiting = id === 5 && Boolean(ctx.current.env?.program?.wasm);
      setSteps((current) => current.map((s) => (s.id === id ? { ...s, status: waiting ? "running" : "done", proof: id === 5 && !waiting ? "robot CSS injected · JS running · no WASM in this payload" : proof } : s)));
      setTick(id);
      return true;
    } catch (error) {
      setSteps((current) => current.map((s) => (s.id === id ? { ...s, status: "fail", proof: error.message } : s)));
      setTick(id);
      say?.(`Stopped at ${STEPS[id - 1][0]}: ${error.message}`);
      return false;
    }
  }

  async function heartbeat() {
    resetPipeline();
    stopRef.current = false;
    setRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    for (let id = 1; id <= 6; id++) {
      if (stopRef.current) break;
      const passed = await step(id);
      if (!passed) break;
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    setRunning(false);
  }

  function loadWasm(file) {
    if (!file) return;
    if (file.size > 262144) return say?.("Keep the .wasm under 256 KB so it fits in an email");
    file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      if (!WebAssembly.validate(bytes)) return say?.(`${file.name} is not a valid WebAssembly module`);
      setProgram((current) => ({ ...current, wasm: base64(bytes) }));
      say?.(`Loaded ${file.name} (${bytes.length} B). Export frame(t) and mem to play it as a movie.`);
    });
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      say?.(`Copied ${label}`);
    } catch {
      say?.("Clipboard is blocked here — use Download instead");
    }
  }

  const mail = ctx.current.mail;
  const statusIcon = { idle: "○", running: "◌", done: "✓", fail: "✕" };

  return (
    <div className="tool dispatch">
      <aside className="tool-side">
        <b>Compose</b>
        <span className="muted">A signed program travels inside emoji. The recipient's studio verifies it and runs it in a sandbox.</span>
        <label className="field"><span>From</span><input value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} /></label>
        <label className="field"><span>To (dispatchTo)</span><input value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} /></label>
        <label className="field"><span>Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
        <b style={{ marginTop: 6 }}>Program</b>
        <div className="seg">
          {[["css", "Robot CSS"], ["js", "Robot JS"], ["html", "HTML"], ["wasm", "WASM"]].map(([id, label]) => (
            <button key={id} className={part === id ? "on" : ""} onClick={() => setPart(id)}>{label}</button>
          ))}
        </div>
        {part === "wasm" ? (
          <div className="stack">
            <span className="muted">{wasmBytes.length ? `${wasmBytes.length} B · magic ${Array.from(wasmBytes.slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join(" ")}${program.wasm === MOVIE_B64 ? " · built-in plasma movie: exports ep3(), frame(t), mem · 160×90 computed in WASM" : " · your module"}` : "No WASM in this program."}</span>
            <div className="row">
              <label className="btn">Load .wasm…<input type="file" accept=".wasm,application/wasm" hidden onChange={(event) => { loadWasm(event.target.files?.[0]); event.target.value = ""; }} /></label>
              <button className="btn" onClick={() => setProgram((current) => ({ ...current, wasm: MOVIE_B64 }))}>Built-in movie</button>
              <button className="btn" onClick={() => setProgram((current) => ({ ...current, wasm: "" }))}>None</button>
            </div>
            <span className="muted">A movie module exports <code>frame(t)</code> and its memory as <code>mem</code>; each frame writes RGBA pixels at offset 0. An optional <code>fraymus.movie</code> custom section sets <code>{"{w, h, fps}"}</code>.</span>
          </div>
        ) : (
          <textarea className="dispatch-code" rows={9} value={program[part]} spellCheck={false} onChange={(event) => setProgram({ ...program, [part]: event.target.value })} aria-label={`Program ${part}`} />
        )}
        {part === "js" && <span className="muted">The robot API: <code>robot.move(px)</code>, <code>robot.say(text)</code>, <code>robot.spin()</code>, <code>log(...)</code>.</span>}
        <button className="btn" onClick={() => setProgram(DEFAULT_PROGRAM)}>Reset to the archive robot</button>
        <b style={{ marginTop: 6 }}>Carrier</b>
        <div className="seg">
          <button className={scheme === "emoji64" ? "on" : ""} onClick={() => setScheme("emoji64")}>Emoji-64</button>
          <button className={scheme === "glyph" ? "on" : ""} onClick={() => setScheme("glyph")}>One glyph</button>
        </div>
        {scheme === "glyph" ? (
          <div className="row"><EmojiSelect value={carrier} onChange={setCarrier} label="Carrier emoji" /><span className="muted" style={{ flex: 1 }}>Every byte hides as one invisible selector after the carrier.</span></div>
        ) : <span className="muted">Each base64 character becomes one visible emoji from the heartbeat engine's 64-symbol alphabet; 💤 is padding.</span>}
        <label className="row"><input type="checkbox" checked={compress} onChange={(event) => setCompress(event.target.checked)} style={{ flex: "none" }} /> <span>Compress (deflate) before encoding</span></label>
        <button className="btn on" disabled={!keys} onClick={seal}>{keys ? `Sign (${keys.alg}) & encode` : "Making a key…"}</button>
        {print && <span className="muted">Session key {print}. It lives only in this tab; reload makes a new one.</span>}
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Dispatch</b>
          <span className="muted">email-launched engine · heartbeat tick {tick}/6</span>
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={!incoming || running} onClick={tamper} title="Change one symbol to prove tampering is caught">Tamper</button>
          <button className="btn" disabled={running || tick >= 6 || steps.some((s) => s.status === "fail")} onClick={() => step(tick + 1)}>Step</button>
          <button className="btn" onClick={resetPipeline}>Reset</button>
          <button className="btn on" disabled={!incoming || running} onClick={heartbeat}>{running ? "Running…" : "▶ Run heartbeat"}</button>
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
            {mail && (
              <div className="row">
                <a className="btn on" href={mail.mailto}>Open in mail app</a>
                <a className="btn" href={mail.gmail} target="_blank" rel="noreferrer">Gmail draft</a>
                <button className="btn" onClick={() => copy(`${MAIL_NOTE}\n\n${incoming}`, "the email body")}>Copy body</button>
              </div>
            )}
          </div>
          <div className="dispatch-stage">
            <div className="webjs-head"><b>Stage</b><span className="muted">sandboxed · no access to the studio</span></div>
            {stage
              ? <iframe key={stage.run} className="dispatch-frame" title="Dispatch stage" sandbox="allow-scripts" srcDoc={stage.doc} />
              : <div className="dispatch-empty muted">Tick 5 injects the robot CSS from the payload, runs its JS, and plays the WASM movie here.</div>}
            <pre className="dispatch-log">{log.join("\n") || "—"}</pre>
            {received && (
              <div className="row">
                <span className="muted" style={{ flex: 1 }}>from {received.from} → {received.to}</span>
                <button className="btn" onClick={() => { onApply(applyDispatch(project, received.program)); say?.(project.stack === "mern" ? "Added a Robot page at /robot" : "Appended the robot stage to the HTML"); }}>Place in project</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="tool-side">
        <b>Email</b>
        {built ? (
          <>
            <span className="muted">To {built.env.to} · subject {built.env.subject}</span>
            <pre className="emoji-view dispatch-mail">{body}</pre>
            <span className="muted">{built.wire.length} bytes · {[...built.text].length} code points · {textBytes(built.text).length.toLocaleString()} UTF-8 bytes · link {mailto.length.toLocaleString()} chars</span>
            {mailto.length > LONG_LINK && <span className="note">This link is long. Some mail apps cut long links, so if the body arrives short, use Copy body and paste it instead.</span>}
            <div className="row">
              <a className="btn on" href={mailto}>Open in mail app</a>
              <a className="btn" href={gmail} target="_blank" rel="noreferrer">Gmail draft</a>
            </div>
            <div className="row">
              <button className="btn" onClick={() => copy(body, "the email body")}>Copy body</button>
              <button className="btn" onClick={() => download("fresh_payload_emoji.txt", body)}>.txt</button>
              <button className="btn" onClick={() => download("envelope.json", JSON.stringify(built.env, null, 2), "application/json")}>envelope.json</button>
            </div>
          </>
        ) : <span className="muted">Sign & encode a program to get an email you can send from your own mail app. Nothing is sent from the studio.</span>}
        <b style={{ marginTop: 6 }}>Receive</b>
        <span className="muted">Paste an email body (the note line is ignored) or a payload from the archive engine, then run the heartbeat.</span>
        <textarea className="dispatch-code" rows={6} value={incoming} onChange={(event) => { setIncoming(event.target.value); resetPipeline(); }} placeholder="🟦🤖🧬…" spellCheck={false} aria-label="Received payload" />
        <label className="field">
          <span>Freshness window</span>
          <select value={windowSec} onChange={(event) => setWindowSec(event.target.value)}>
            {WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <span className="muted">A valid signature proves the payload is unchanged since it was signed by that key. To know who signed it, compare the key fingerprint with the sender.</span>
      </aside>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import {
  CARRIERS, MAX_BYTES, MEANINGS, bytesToDna, cleanCarrier, codepoints, decodeGlyph, dnaToBytes, encodeGlyph, encodeMeaning,
  fnv1a64, hex, hexToBytes, hideZeroWidth, isUtf8, javaSource, readBack, sha256, textBytes, toVS, views, x86Subset, zeroWidthToBytes
} from "./emojiCodec.js";

const MODES = [
  ["hide", "Hide", "Text or bytes → one emoji"],
  ["reveal", "Reveal", "Glyph, DNA, or zero-width → bytes"],
  ["dna", "DNA", "Bytes ↔ A C G T"],
  ["zero", "Zero-width", "Hide inside a normal sentence"]
];

const SAMPLES = [
  ["Hello World", "text", "Hello World"],
  ["φ seal", "text", "φ^75 = 4721424167835376.00 · SEED 1337 · 137.507°"],
  ["Emoji in emoji", "text", "👋🌍 love the code"],
  ["x86 → 15", "hex", "B8 0A 00 00 00 05 05 00 00 00 C3"],
  ["All 256 bytes", "hex", Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0")).join(" ")]
];

const VIEW_TABS = [["text", "Text"], ["hex", "Hex"], ["base64", "Base64"], ["json", "JSON"], ["c", "C"], ["js", "JS"], ["java", "Java"], ["python", "Python"], ["dna", "DNA"], ["x86", "x86"]];
const KIND_LABEL = { glyph: "variation-selector glyph", zero: "zero-width text", dna: "DNA bases", text: "plain text" };

export function applyGlyph(project, glyph) {
  const css = ".fray-glyph{font-size:44px;display:flex;gap:14px;align-items:center;justify-content:center;margin:28px auto}.fray-glyph button{font:14px system-ui;padding:8px 14px;border-radius:8px;border:1px solid #3dff9a;background:#101210;color:#3dff9a;cursor:pointer}";
  const reveal = `document.querySelectorAll(".fray-glyph button").forEach(function (button) {
  button.addEventListener("click", function () {
    var bytes = [];
    for (var ch of button.previousElementSibling.textContent) {
      var c = ch.codePointAt(0);
      if (c >= 0xFE00 && c <= 0xFE0F) bytes.push(c - 0xFE00);
      else if (c >= 0xE0100 && c <= 0xE01EF) bytes.push(c - 0xE0100 + 16);
    }
    button.textContent = new TextDecoder().decode(new Uint8Array(bytes));
    button.disabled = true;
  });
});`;
  if (project.stack !== "mern") {
    return {
      ...project,
      html: `${project.html || ""}\n<p class="fray-glyph"><span title="Hidden message">${glyph}</span><button type="button">Reveal</button></p>\n`,
      css: `${project.css || ""}\n${css}\n`,
      js: `${project.js || ""}\n${reveal}\n`
    };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Glyph.jsx";
  const pages = next.pages.some((page) => page.name === "Glyph")
    ? next.pages
    : [...next.pages, { name: "Glyph", path: "/glyph", file, auth: false }];
  const source = `import React from "react";
const GLYPH = ${JSON.stringify(glyph)};
function reveal(text) {
  const bytes = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0xFE00 && c <= 0xFE0F) bytes.push(c - 0xFE00);
    else if (c >= 0xE0100 && c <= 0xE01EF) bytes.push(c - 0xE0100 + 16);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
export default function Glyph() {
  const [shown, setShown] = React.useState("");
  return (
    <main className="page">
      <p className="kicker">Emoji</p>
      <h1>Hidden message</h1>
      <p className="fray-glyph"><span>{GLYPH}</span><button type="button" disabled={!!shown} onClick={() => setShown(reveal(GLYPH))}>{shown || "Reveal"}</button></p>
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

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function same(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export default function EmojiPage({ project, say, onApply }) {
  const [mode, setMode] = useState("hide");
  const [source, setSource] = useState("text");
  const [input, setInput] = useState("Hello World");
  const [file, setFile] = useState(null);
  const [carrier, setCarrier] = useState("🧠");
  const [spread, setSpread] = useState("one");
  const [cover, setCover] = useState("Just a normal sentence.");
  const [reveal, setReveal] = useState("");
  const [view, setView] = useState("text");
  const [mask, setMask] = useState(false);
  const [expect, setExpect] = useState("");
  const [hashes, setHashes] = useState({ input: "", trip: "" });
  const fileInput = useRef(null);

  const encodeSide = mode !== "reveal";

  const payload = useMemo(() => {
    if (!encodeSide) {
      try {
        const result = readBack(reveal);
        return { bytes: result.bytes, kind: result.kind, carriers: result.carriers, error: "" };
      } catch (error) {
        return { bytes: new Uint8Array(), kind: "dna", carriers: [], error: error.message };
      }
    }
    try {
      if (file) return { bytes: file.bytes, kind: "file", carriers: [], error: "" };
      if (mode === "dna" && source === "dna") return { bytes: dnaToBytes(input), kind: "dna", carriers: [], error: "" };
      return { bytes: source === "hex" ? hexToBytes(input) : textBytes(input), kind: source, carriers: [], error: "" };
    } catch (error) {
      return { bytes: new Uint8Array(), kind: source, carriers: [], error: error.message };
    }
  }, [encodeSide, reveal, file, mode, source, input]);

  const tooBig = payload.bytes.length > MAX_BYTES;
  const bytes = useMemo(() => (tooBig ? payload.bytes.slice(0, MAX_BYTES) : payload.bytes), [payload, tooBig]);

  const output = useMemo(() => {
    if (mode === "hide") {
      if (spread === "meaning") return encodeMeaning(source === "text" && !file ? input : "", bytes, carrier);
      return encodeGlyph(bytes, carrier, spread === "each");
    }
    if (mode === "dna") return source === "dna" && !file ? views(bytes).text : bytesToDna(bytes);
    if (mode === "zero") return hideZeroWidth(cover, bytes);
    return views(bytes).text;
  }, [mode, spread, source, file, input, bytes, carrier, cover]);

  const tripBytes = useMemo(() => {
    try {
      if (mode === "hide") return decodeGlyph(output).bytes;
      if (mode === "dna") return source === "dna" && !file ? dnaToBytes(bytesToDna(bytes)) : dnaToBytes(output);
      if (mode === "zero") return zeroWidthToBytes(output);
      return bytes;
    } catch {
      return new Uint8Array();
    }
  }, [mode, output, source, file, bytes]);

  const exact = same(Array.from(bytes), Array.from(tripBytes));

  useEffect(() => {
    let alive = true;
    Promise.all([sha256(bytes), sha256(tripBytes)]).then(([a, b]) => { if (alive) setHashes({ input: a, trip: b }); });
    return () => { alive = false; };
  }, [bytes, tripBytes]);

  const allViews = useMemo(() => views(bytes), [bytes]);
  const code = useMemo(() => x86Subset(bytes), [bytes]);
  const utf8 = isUtf8(bytes);
  const outPoints = [...output].length;
  const expectClean = expect.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  const expectMatch = expectClean.length >= 8 ? hashes.input.startsWith(expectClean) : null;

  function pickFile(event) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      say?.(`That file is ${chosen.size} bytes; the limit is ${MAX_BYTES}`);
      return;
    }
    chosen.arrayBuffer().then((buffer) => {
      setFile({ name: chosen.name, bytes: new Uint8Array(buffer) });
      say?.(`Loaded ${chosen.name} · ${chosen.size} bytes`);
    });
  }

  function pickRevealFile(event) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    chosen.text().then((text) => {
      setReveal(text);
      say?.(`Read ${chosen.name}`);
    });
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      say?.(`Copied ${label}`);
    } catch {
      say?.("Clipboard is blocked here — use the download instead");
    }
  }

  function sendToReveal() {
    setReveal(output);
    setMode("reveal");
    say?.("Sent the output to Reveal");
  }

  const viewText = view === "x86"
    ? code.lines.length
      ? `${code.lines.map((line) => `${String(line.at).padStart(4, "0")}  ${line.hex.padEnd(16)}  ${line.asm}`).join("\n")}\n\n${code.ok ? `eax = ${code.eax}` : `stopped at byte ${code.stop}: not in the subset (mov/add/sub/xor imm32, xor eax,eax, inc, dec, nop, ret)`}`
      : "Not x86 from the Fray-Exec subset. Try the “x86 → 15” sample."
    : view === "text" && mask
      ? "•".repeat([...allViews.text].length)
      : allViews[view];

  const breakdown = Array.from(bytes.slice(0, 64));
  const carrierClean = cleanCarrier(carrier);
  const usedMeanings = Object.entries(MEANINGS).filter(([word]) => new RegExp(`\\b${word}\\b`, "i").test(input)).slice(0, 8);

  return (
    <div className="tool emoji">
      <aside className="tool-side">
        <b>Transmute</b>
        {MODES.map(([id, label, note]) => (
          <button key={id} className={`chip emoji-mode${mode === id ? " on" : ""}`} onClick={() => setMode(id)}>
            <b>{label}</b>
            <span className="muted">{note}</span>
          </button>
        ))}
        {mode === "reveal" ? (
          <>
            <b style={{ marginTop: 6 }}>Read-back</b>
            <span className="muted">Paste or open a FRAYMUS message. The format is recognized for you.</span>
            <button className="btn" onClick={() => fileInput.current?.click()}>Open .txt…</button>
            <label className="field"><span>Hide decoded text</span><input type="checkbox" checked={mask} onChange={(event) => setMask(event.target.checked)} /></label>
            <label className="field">
              <span>Expected sha256 (prefix is fine)</span>
              <input value={expect} onChange={(event) => setExpect(event.target.value)} placeholder="cdeb7bef24c7e82c…" spellCheck={false} />
            </label>
            {expectMatch !== null && (
              <div className={`emoji-badge ${expectMatch ? "ok" : "bad"}`}>{expectMatch ? "Fingerprint matches" : "Fingerprint does not match"}</div>
            )}
            <input ref={fileInput} type="file" accept=".txt,text/plain" hidden onChange={pickRevealFile} />
          </>
        ) : (
          <>
            <b style={{ marginTop: 6 }}>Samples</b>
            <div className="emoji-samples">
              {SAMPLES.map(([label, kind, value]) => (
                <button key={label} className="btn" onClick={() => { setFile(null); setSource(kind); setInput(value); }}>{label}</button>
              ))}
            </div>
          </>
        )}
        {mode === "hide" && (
          <>
            <b style={{ marginTop: 6 }}>Carrier</b>
            <div className="emoji-grid">
              {CARRIERS.map((glyph) => (
                <button key={glyph} className={carrierClean === glyph ? "on" : ""} onClick={() => setCarrier(glyph)} title={`U+${glyph.codePointAt(0).toString(16).toUpperCase()}`}>{glyph}</button>
              ))}
            </div>
            <label className="field">
              <span>Or paste any emoji or character</span>
              <input value={carrier} onChange={(event) => setCarrier(event.target.value)} />
            </label>
            {carrierClean !== carrier && carrier && <span className="muted">Selectors removed from the carrier so they don’t read as data: {carrierClean}</span>}
          </>
        )}
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Emoji</b>
          <span className="muted">{MODES.find(([id]) => id === mode)[2]} · reversible, byte for byte</span>
          <span style={{ flex: 1 }} />
          <span className={`emoji-badge ${exact && !payload.error ? "ok" : "bad"}`}>{payload.error ? "input error" : exact ? "round trip exact" : "round trip differs"}</span>
          <button className="btn" onClick={() => copy(output, "the output")}>Copy output</button>
          {encodeSide && <button className="btn" onClick={sendToReveal}>Send to Reveal</button>}
          <button className="btn on" disabled={!bytes.length} onClick={() => { onApply(applyGlyph(project, encodeGlyph(bytes, carrier))); say?.(project.stack === "mern" ? "Added a Glyph page at /glyph" : "Placed the glyph with a Reveal button"); }}>Place in project</button>
        </div>
        <div className="tool-body">
          {encodeSide ? (
            <div className="card emoji-card">
              <div className="row">
                <b>Input</b>
                <div className="seg">
                  {[["text", "Text"], ["hex", "Hex"], ...(mode === "dna" ? [["dna", "DNA → bytes"]] : [])].map(([id, label]) => (
                    <button key={id} className={source === id && !file ? "on" : ""} onClick={() => { setFile(null); setSource(id); }}>{label}</button>
                  ))}
                  <button className={file ? "on" : ""} onClick={() => fileInput.current?.click()}>File…</button>
                </div>
                <span style={{ flex: 1 }} />
                <span className="muted">{payload.bytes.length} bytes{file ? ` · ${file.name}` : ""}</span>
              </div>
              {file ? (
                <div className="note blue">Encoding {file.name} ({file.bytes.length} bytes). <button className="btn" onClick={() => setFile(null)}>Use text instead</button></div>
              ) : (
                <textarea className="emoji-input" value={input} spellCheck={false} onChange={(event) => setInput(event.target.value)} placeholder={source === "hex" ? "B8 0A 00 00 00 …" : source === "dna" ? "ACGT…" : "Type the message"} />
              )}
              {mode === "zero" && (
                <label className="field">
                  <span>Cover sentence — what people see</span>
                  <input value={cover} onChange={(event) => setCover(event.target.value)} />
                </label>
              )}
              {mode === "hide" && (
                <div className="row">
                  <span className="muted">Layout</span>
                  <div className="seg">
                    {[["one", "One carrier"], ["each", "One per byte (v13)"], ["meaning", "Words pick emoji"]].map(([id, label]) => (
                      <button key={id} className={spread === id ? "on" : ""} onClick={() => setSpread(id)}>{label}</button>
                    ))}
                  </div>
                  {spread === "meaning" && <span className="muted">{usedMeanings.length ? usedMeanings.map(([word, glyph]) => `${word} ${glyph}`).join(" · ") : `no known words, using ${carrierClean}`}</span>}
                </div>
              )}
              <input ref={fileInput} type="file" hidden onChange={pickFile} />
            </div>
          ) : (
            <div className="card emoji-card">
              <div className="row">
                <b>Paste a message</b>
                <span style={{ flex: 1 }} />
                <span className="muted">{reveal ? `found ${KIND_LABEL[payload.kind]} · ${payload.bytes.length} bytes${payload.carriers.length ? ` · ${payload.carriers.length} visible characters` : ""}` : "waiting for input"}</span>
              </div>
              <textarea className="emoji-input" value={reveal} spellCheck={false} onChange={(event) => setReveal(event.target.value)} placeholder="Paste a glyph, DNA, or zero-width text" />
            </div>
          )}

          {payload.error && <div className="note">{payload.error}</div>}
          {tooBig && <div className="note">Only the first {MAX_BYTES} bytes are encoded.</div>}

          <div className="card emoji-card">
            <div className="row">
              <b>{mode === "reveal" ? "Decoded" : "Output"}</b>
              <span style={{ flex: 1 }} />
              <span className="muted">{outPoints} code points · {output.length} UTF-16 units · {textBytes(output).length} UTF-8 bytes</span>
            </div>
            <div className={`emoji-out ${mode === "dna" || mode === "reveal" ? "mono" : ""}`}>
              {mode === "reveal" && mask ? "•".repeat([...output].length) : output || <span className="muted">Nothing yet</span>}
            </div>
            {mode === "reveal" && !utf8 && bytes.length > 0 && <span className="muted">These bytes aren’t valid UTF-8 text — use the Hex or x86 view.</span>}
            {mode === "hide" && <span className="muted">Looks like {spread === "each" ? `${bytes.length} × ${carrierClean}` : spread === "meaning" ? "a row of emoji" : `one ${carrierClean}`}. Every byte rides on an invisible selector.</span>}
            {mode === "zero" && <span className="muted">Looks like “{cover}”. {bytes.length * 8} invisible characters are hidden after its first letter.</span>}
          </div>

          <div className="card emoji-card">
            <div className="row">
              <b>Selector breakdown</b>
              <span style={{ flex: 1 }} />
              <span className="muted">{bytes.length > 64 ? `first 64 of ${bytes.length} bytes` : `${bytes.length} bytes`}</span>
            </div>
            <div className="emoji-table-wrap">
              <table className="emoji-table">
                <thead><tr><th>#</th><th>Byte</th><th>Hex</th><th>Selector</th><th>DNA</th><th>Bits</th><th>Char</th></tr></thead>
                <tbody>
                  {breakdown.map((byte, index) => (
                    <tr key={index}>
                      <td>{index}</td>
                      <td>{byte}</td>
                      <td>{byte.toString(16).padStart(2, "0").toUpperCase()}</td>
                      <td>{codepoints(toVS(byte))[0]}</td>
                      <td className="dna">{bytesToDna([byte])}</td>
                      <td>{byte.toString(2).padStart(8, "0")}</td>
                      <td>{byte >= 32 && byte < 127 ? String.fromCharCode(byte) : "·"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <aside className="tool-side">
        <b>Proof</b>
        <div className="emoji-proof">
          <span className="muted">sha256 in</span><code>{hashes.input.slice(0, 32)}…</code>
          <span className="muted">sha256 back</span><code>{hashes.trip.slice(0, 32)}…</code>
          <span className="muted">fnv1a-64</span><code>{fnv1a64(bytes)}</code>
        </div>
        <div className={`emoji-badge ${exact ? "ok" : "bad"}`}>{exact ? `decode(encode(x)) = x · ${bytes.length} bytes` : "the decoded bytes differ"}</div>
        <b style={{ marginTop: 6 }}>Views</b>
        <div className="emoji-views">
          {VIEW_TABS.map(([id, label]) => (
            <button key={id} className={`btn${view === id ? " on" : ""}`} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        <pre className="emoji-view">{viewText || " "}</pre>
        <button className="btn" onClick={() => copy(viewText, `the ${view} view`)}>Copy view</button>
        <b style={{ marginTop: 6 }}>Download</b>
        <div className="row">
          <button className="btn" onClick={() => download(`fraymus-${mode}.txt`, output, "text/plain;charset=utf-8")}>Output .txt</button>
          <button className="btn" onClick={() => download("fraymus-dna.txt", allViews.dna, "text/plain")}>DNA .txt</button>
          <button className="btn" onClick={() => download("fraymus-payload.bin", bytes, "application/octet-stream")}>Bytes .bin</button>
          <button className="btn" onClick={() => download("FrayGlyph.java", javaSource(bytes, carrier), "text/x-java;charset=utf-8")}>FrayGlyph.java</button>
        </div>
        <span className="muted">FrayGlyph.java carries this payload, re-encodes it, checks the round trip and the hashes, and writes glyph.txt. Run it with javac FrayGlyph.java &amp;&amp; java FrayGlyph.</span>
        <div className="note blue">Bytes 0–15 use U+FE00–FE0F and bytes 16–255 use U+E0100–E01EF. DNA uses A=00 C=01 G=10 T=11, high bits first. Zero-width uses U+200B for 0 and U+200D for 1. Everything runs here in the browser and nothing is sent anywhere.</div>
      </aside>
    </div>
  );
}

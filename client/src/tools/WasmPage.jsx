import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { base64, decodeGlyph, encodeGlyph, hex } from "./emojiCodec.js";
import EmojiSelect from "./EmojiSelect.jsx";
import {
  ISA, assemble, canCompile, compileToWasm, disassemble, forge, frayHeader,
  fromBytecode, getCompilationTier, readCustomSections, readWasmOutput, recoverProgram, runGolden, runProgram, toBytecode, trueMerkle
} from "./frayvm.js";

const SRC_KEY = "fraymus.wasm.src";
// Each preset is a complete, tested FrayVM program. "out" is its exact output, verified in Node.
export const PRESETS = [
  ["Basics", [
    ["Add 10 + 5", "PUSH 10\nPUSH 5\nADD\nPOP_PRINT\nHALT", "15 "],
    ["Arithmetic (6*7-2)", "PUSH 6\nPUSH 7\nMUL\nPUSH 2\nSUB\nHALT", "compiles to WASM"],
    ["Say Hi!", "PUSH 72  EMIT\nPUSH 105 EMIT\nPUSH 33 EMIT\nPUSH 10 EMIT\nHALT", "Hi!"]
  ]],
  ["Sequences", [
    ["Count down 3..1", "PUSH 3\nloop: DUP POP_PRINT DEC DUP JZ end JUMP loop\nend: DROP HALT", "3 2 1 "],
    ["Fibonacci < 100", "PUSH 0\nPUSH 1\nloop: OVER PUSH 100 LT JZ end\nOVER POP_PRINT\nSWAP OVER ADD\nJUMP loop\nend: HALT", "0 1 1 2 3 5 8 13 21 34 55 89 "],
    ["Powers of 2 < 1000", "PUSH 1\nloop: DUP PUSH 1000 LT JZ end\nDUP POP_PRINT\nPUSH 2 MUL\nJUMP loop\nend: DROP HALT", "1 2 4 8 ... 512 "],
    ["Squares 1..5", "PUSH 1\nloop: DUP DUP MUL POP_PRINT INC DUP PUSH 6 LT JZ end JUMP loop\nend: DROP HALT", "1 4 9 16 25 "]
  ]],
  ["Number theory", [
    ["Primes up to 40", "PUSH 40\nPUSH 2\nouter: OVER OVER GE JZ done\nDUP PUSH 2\ninner: OVER OVER GT JZ yes\nOVER OVER MOD JZ no\nINC\nJUMP inner\nyes: 2DROP PUSH 1 JUMP after\nno: 2DROP PUSH 0 JUMP after\nafter: JZ skip\nDUP POP_PRINT\nskip: INC\nJUMP outer\ndone: HALT", "2 3 5 7 11 ... 37 "],
    ["Factors of 24", "PUSH 24\nPUSH 1\nloop: OVER OVER GE JZ end\nOVER OVER MOD JZ hit\nJUMP next\nhit: DUP POP_PRINT\nnext: INC\nJUMP loop\nend: HALT", "1 2 3 4 6 8 12 24 "],
    ["Factorial 5", "PUSH 1\nPUSH 5\nloop: DUP PUSH 1 GT JZ end\nOVER OVER MUL ROT DROP SWAP DEC\nJUMP loop\nend: DROP POP_PRINT HALT", "120 "],
    ["Sum 1..10", "PUSH 0\nPUSH 1\nloop: DUP PUSH 10 LE JZ end\nOVER OVER ADD ROT DROP SWAP INC\nJUMP loop\nend: DROP POP_PRINT HALT", "55 "],
    ["GCD(48, 36)", "PUSH 48\nPUSH 36\nloop: DUP JZ end\nDUP ROT SWAP MOD\nJUMP loop\nend: DROP POP_PRINT HALT", "12 "]
  ]]
];
const SAMPLES = Object.fromEntries(PRESETS.flatMap(([, items]) => items.map(([name, src]) => [name, src])));

// ---- document nodes: a labelled token whose single emoji invisibly carries a whole program ----
const DOC_KEY = "fraymus.wasm.doc";
const NODE_CARRIER = "🧩";
// ⟦label⟧ followed by one carrier code point plus its trailing variation selectors (the hidden bytes).
const NODE_RE = /⟦([^⟧]+)⟧(.[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]*)/gu;

function nodeToken(label, src) {
  return `⟦${label}⟧${encodeGlyph(toBytecode(assemble(src)), NODE_CARRIER)}`;
}

function resolveDoc(text) {
  const nodes = [];
  for (const match of text.matchAll(NODE_RE)) {
    const label = match[1];
    const glyph = match[2];
    try {
      const bytes = decodeGlyph(glyph).bytes;
      if (!bytes.length) continue;
      const code = fromBytecode(bytes);
      const asm = disassemble(code).replace(/^\d+:\s*/gm, "");
      nodes.push({ label, glyph, visible: label.length + 2 + [...glyph].length, hidden: bytes.length, instructions: code.length, asm, out: runProgram(code).output });
    } catch (error) { nodes.push({ label, glyph, error: error.message }); }
  }
  return nodes;
}

function defaultDoc() {
  try {
    const picks = ["Fibonacci < 100", "Primes up to 40"];
    const body = picks.map((name) => `${name}\n${nodeToken(name, SAMPLES[name])}`).join("\n\n");
    return `# A document woven from compressed program nodes.\n# Each line below has a label, then ONE emoji that invisibly carries the whole program.\n# Click "Resolve" to expand every node back into its full block and run it.\n\n${body}\n`;
  } catch { return ""; }
}

function download(name, data, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const hexDump = (bytes) => hex(bytes).replace(/((?:[0-9a-f]{2} ){16})/g, "$1\n").trim();

export function applyWasm(project, bytes, label) {
  const b64 = base64(bytes);
  const loaderHtml = `<div class="fray-wasm" data-wasm="${b64}">
  <button onclick="(async()=>{const b=Uint8Array.from(atob(this.parentNode.dataset.wasm),c=>c.charCodeAt(0));const{instance}=await WebAssembly.instantiate(b);const ex=instance.exports;const fn=ex.execute||ex.main||Object.values(ex).find(v=>typeof v==='function');this.nextElementSibling.textContent=fn?('result: '+fn(fn===ex.execute?42:undefined)):'no callable export';})()">Run ${label}</button>
  <pre>not run yet</pre>
</div>`;
  if (project.stack !== "mern") return { ...project, html: `${project.html || ""}\n${loaderHtml}\n` };
  const next = ensureMern(project);
  const file = "client/src/pages/Wasm.jsx";
  const pages = next.pages.some((page) => page.name === "Wasm") ? next.pages : [...next.pages, { name: "Wasm", path: "/wasm", file, auth: false }];
  const source = `import React, { useState } from "react";
const B64 = ${JSON.stringify(b64)};
export default function Wasm() {
  const [out, setOut] = useState("not run yet");
  async function run() {
    const bytes = Uint8Array.from(atob(B64), (c) => c.charCodeAt(0));
    const { instance } = await WebAssembly.instantiate(bytes);
    const ex = instance.exports;
    const fn = ex.execute || ex.main || Object.values(ex).find((v) => typeof v === "function");
    setOut(fn ? "result: " + fn(fn === ex.execute ? 42 : undefined) : "no callable export");
  }
  return (
    <main className="page">
      <button onClick={run}>Run ${label}</button>
      <pre>{out}</pre>
    </main>
  );
}
`;
  return { ...next, pages, files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) } };
}

export default function WasmPage({ project, say, onApply }) {
  const [src, setSrc] = useState(() => localStorage.getItem(SRC_KEY) || SAMPLES["Count down 3..1"]);
  const [view, setView] = useState("run");
  const [built, setBuilt] = useState(null);
  const [probe, setProbe] = useState(null);
  const [carrier, setCarrier] = useState("🧩");
  const [glyph, setGlyph] = useState("");
  const [doc, setDoc] = useState(() => localStorage.getItem(DOC_KEY) || defaultDoc());
  const probeRef = useRef(null);

  useEffect(() => { localStorage.setItem(SRC_KEY, src); }, [src]);
  useEffect(() => { localStorage.setItem(DOC_KEY, doc); }, [doc]);

  const nodes = useMemo(() => resolveDoc(doc), [doc]);
  const nodeStats = useMemo(() => {
    const good = nodes.filter((node) => !node.error);
    return {
      count: nodes.length,
      visible: good.reduce((sum, node) => sum + node.visible, 0),
      asmChars: good.reduce((sum, node) => sum + node.asm.length, 0),
      bytes: good.reduce((sum, node) => sum + node.hidden, 0)
    };
  }, [nodes]);

  function insertNode(name) {
    try { setDoc((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${name}\n${nodeToken(name, SAMPLES[name])}\n`); say?.(`Wove "${name}" into the document as one ${NODE_CARRIER}`); }
    catch (error) { say?.(error.message); }
  }

  const assembled = useMemo(() => {
    try { return { code: assemble(src), error: null }; }
    catch (error) { return { code: null, error: error.message }; }
  }, [src]);

  const result = useMemo(() => (assembled.code ? runProgram(assembled.code) : null), [assembled.code]);
  const golden = useMemo(() => runGolden(), []);
  const goldenPass = golden.filter((test) => test.pass).length;
  const compilable = assembled.code ? canCompile(assembled.code) : false;
  const bytecode = assembled.code ? toBytecode(assembled.code) : new Uint8Array();
  const merkle = useMemo(() => trueMerkle(src), [src]);

  async function compile() {
    if (!assembled.code) return;
    try {
      const bytes = compileToWasm(assembled.code);
      const tier = getCompilationTier(assembled.code);
      const { instance } = await WebAssembly.instantiate(bytes);
      const value = instance.exports.main();
      const stdout = readWasmOutput(instance);
      const note = stdout
        ? `main() = ${value} · stdout = "${stdout.replace(/\n/g, "\\n")}" · tier = ${tier}`
        : `main() = ${value} · tier = ${tier}`;
      setBuilt({ kind: "compiled", bytes, main: value, stdout, tier, exports: Object.keys(instance.exports), note });
      setView("build");
      say?.(`Compiled ${assembled.code.length} instructions (${tier}) to a ${bytes.length}-byte module · ${note}`);
    } catch (error) { say?.(error.message); }
  }

  async function forgeModule() {
    if (!assembled.code) return;
    const forged = await forge(assembled.code, { source: src.slice(0, 200) });
    const { instance } = await WebAssembly.instantiate(forged.bytes);
    const selfTest = instance.exports.execute(42) === 42;
    const recovered = recoverProgram(forged.bytes);
    const reran = recovered ? runProgram(recovered).output : "";
    setBuilt({ kind: "forged", bytes: forged.bytes, ledger: forged.ledger, baseline: forged.baseline, exports: Object.keys(instance.exports), selfTest, reran, note: `execute(42) = ${instance.exports.execute(42)} · recovered ${recovered?.length ?? 0} instructions` });
    setView("build");
    say?.(`Forged a ${forged.bytes.length}-byte self-running module · execute(42)=${instance.exports.execute(42)} · program recovered and re-ran to "${reran}"`);
  }

  async function runProbe(bytes, name) {
    try {
      if (!WebAssembly.validate(bytes)) { setProbe({ name, valid: false }); return; }
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module);
      const exports = WebAssembly.Module.exports(module);
      const sections = readCustomSections(bytes);
      const calls = [];
      for (const entry of exports) {
        if (entry.kind !== "function") continue;
        const fn = instance.exports[entry.name];
        for (const arg of [42, 0]) {
          try { calls.push(`${entry.name}(${arg}) = ${fn(arg)}`); break; }
          catch { try { calls.push(`${entry.name}() = ${fn()}`); break; } catch (error) { calls.push(`${entry.name}: ${error.message.slice(0, 40)}`); break; } }
        }
      }
      const stdout = readWasmOutput(instance);
      if (stdout) calls.push(`stdout = "${stdout.replace(/\n/g, "\\n")}"`);
      const recovered = recoverProgram(bytes);
      setProbe({ name, valid: true, bytes: bytes.length, exports: exports.map((entry) => `${entry.name} (${entry.kind})`), sections: Object.keys(sections), calls, recovered: recovered ? disassemble(recovered) : null });
      setView("probe");
    } catch (error) { setProbe({ name, valid: false, error: error.message }); setView("probe"); }
  }

  function embed() {
    if (!bytecode.length) return;
    setGlyph(encodeGlyph(bytecode, carrier));
    say?.(`${bytecode.length} bytecode bytes hidden in one ${carrier}`);
  }

  function revealGlyph() {
    const bytes = decodeGlyph(glyph).bytes;
    if (!bytes.length) return say?.("No hidden bytes in that glyph");
    const code = fromBytecode(bytes);
    setSrc(disassemble(code).replace(/^\d+:\s*/gm, ""));
    say?.(`Recovered ${code.length} instructions from the glyph`);
  }

  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); say?.(`Copied ${label}`); }
    catch { say?.("Clipboard is blocked here — use Download instead"); }
  }

  return (
    <div className="tool wasm">
      <aside className="tool-side">
        <b>FrayVM program</b>
        <span className="muted">A 53-opcode dual-stack machine. Assemble it, run it, compile any program (straight-line or Turing-complete JUMP/JZ loops) to real WebAssembly, or forge a self-running module.</span>
        <label className="field">
          <span>Programs</span>
          <select value="" onChange={(event) => { if (event.target.value) setSrc(SAMPLES[event.target.value]); }}>
            <option value="">load a preset…</option>
            {PRESETS.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map(([name, , out]) => <option key={name} value={name} title={`→ ${out}`}>{name} · {out}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <b style={{ marginTop: 6 }}>Instruction set · {ISA.length}</b>
        <div className="wasm-isa">
          {ISA.map(([name, op, desc]) => (
            <button key={op} className="wasm-op" title={desc} onClick={() => setSrc((current) => `${current}${current.endsWith("\n") || !current ? "" : "\n"}${name}${[0x80, 0xa0, 0xa1].includes(op) ? " 0" : ""}`)}>
              <code>{name}</code><small>0x{op.toString(16).padStart(2, "0")}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Self-running WASM</b>
          <span className="muted">{assembled.code ? `${assembled.code.length} instructions · ${bytecode.length} bytecode bytes` : "parse error"} · golden {goldenPass}/{golden.length}</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={compile} disabled={!compilable} title="Compile to real WebAssembly (Direct Stack or Turing-Complete CFG)">Compile</button>
          <button className="btn" onClick={forgeModule} disabled={!assembled.code}>Forge</button>
          <button className="btn on" disabled={!built} onClick={() => { onApply(applyWasm(project, built.bytes, built.kind === "forged" ? "forged module" : "compiled module")); say?.(project.stack === "mern" ? "Added a WASM page at /wasm" : "Added a WASM loader to the HTML"); }}>Place in project</button>
        </div>
        <div className="wasm-body">
          <div className="coder-edit">
            <div className="webjs-head"><b>Assembly</b><span className="muted">{src.split("\n").length} lines · ; for comments · name: for labels</span></div>
            <textarea className="coder-src wasm-src" value={src} spellCheck={false} onChange={(event) => setSrc(event.target.value)} aria-label="FrayVM assembly" />
            {assembled.error && <div className="wasm-err">{assembled.error}</div>}
          </div>
          <div className="coder-view">
            <div className="webjs-head">
              <div className="seg">
                {[["run", "Run"], ["build", "Build"], ["probe", "Probe"], ["nodes", "Nodes"], ["merkle", "Merkle"], ["golden", "Golden"]].map(([id, label]) => (
                  <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="wasm-out">
              {view === "run" && result && (
                <div className="stack">
                  <div className="wasm-screen">{result.output || "(no output)"}</div>
                  <span className="muted">stack [{result.stack.join(", ")}] · {result.steps} steps{result.steps >= 20000 ? " · hit the 20,000-step limit" : ""}</span>
                  <b>Bytecode</b>
                  <pre className="wasm-hex">{hexDump(bytecode) || "—"}</pre>
                  <b>Disassembly</b>
                  <pre className="wasm-hex">{assembled.code ? disassemble(assembled.code) : assembled.error}</pre>
                </div>
              )}
              {view === "build" && (built ? (
                <div className="stack">
                  <span className={`wasm-badge ${built.kind}`}>{built.kind === "forged" ? "Forged self-running module" : "Compiled WebAssembly"} · {built.bytes.length} B · valid</span>
                  <span className="muted">{built.note}</span>
                  <span className="muted">exports: {built.exports.join(", ")}</span>
                  {built.kind === "forged" && <span className="muted">self-test execute(42)=42: {built.selfTest ? "✓" : "✕"} · recovered program re-ran to "{built.reran}"</span>}
                  {built.ledger && <pre className="wasm-hex">{JSON.stringify(built.ledger, null, 2)}</pre>}
                  <b>Module bytes</b>
                  <pre className="wasm-hex">{hexDump(built.bytes)}</pre>
                  <div className="row">
                    <button className="btn" onClick={() => download(`${built.kind}.wasm`, built.bytes, "application/wasm")}>Download .wasm</button>
                    <button className="btn" onClick={() => copy(base64(built.bytes), "the module as base64")}>Copy base64</button>
                    <button className="btn" onClick={() => runProbe(built.bytes, `${built.kind}.wasm`)}>Probe it</button>
                  </div>
                </div>
              ) : <span className="muted">Compile or Forge to build a module.</span>)}
              {view === "probe" && (probe ? (
                probe.valid ? (
                  <div className="stack">
                    <span className="wasm-badge compiled">{probe.name} · {probe.bytes} B · valid WebAssembly</span>
                    <span className="muted">exports: {probe.exports.join(", ") || "none"}</span>
                    <span className="muted">custom sections: {probe.sections.join(", ") || "none"}</span>
                    <b>Trial calls</b>
                    <pre className="wasm-hex">{probe.calls.join("\n") || "no callable exports"}</pre>
                    {probe.recovered && <><b>Recovered FrayVM program</b><pre className="wasm-hex">{probe.recovered}</pre></>}
                  </div>
                ) : <div className="wasm-err">{probe.name} is not valid WebAssembly{probe.error ? `: ${probe.error}` : ""}</div>
              ) : (
                <div className="stack">
                  <span className="muted">Load any .wasm to validate it, instantiate it, list its exports, and call them. If it was forged here, the FrayVM program is recovered from its custom section.</span>
                  <label className="btn">Load .wasm…<input ref={probeRef} type="file" accept=".wasm,application/wasm" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) file.arrayBuffer().then((buffer) => runProbe(new Uint8Array(buffer), file.name)); event.target.value = ""; }} /></label>
                </div>
              ))}
              {view === "nodes" && (
                <div className="stack">
                  <span className="muted">A node is a whole program compressed into one emoji. Drop nodes into a document, and each huge block collapses to a single labelled glyph — invisible bytes, recoverable on demand, nothing to read if you only see the carrier.</span>
                  <b>Palette — click to weave a node in</b>
                  <div className="wasm-palette">
                    {PRESETS.flatMap(([, items]) => items).map(([name]) => (
                      <button key={name} className="btn" onClick={() => insertNode(name)} title={`Insert ${name} as one ${NODE_CARRIER}`}>{NODE_CARRIER} {name}</button>
                    ))}
                  </div>
                  <div className="webjs-head"><b>Document</b><span className="muted">{[...doc].length} code points</span></div>
                  <textarea className="dispatch-code" rows={6} value={doc} spellCheck={false} onChange={(event) => setDoc(event.target.value)} aria-label="Node document" />
                  <div className="row">
                    <button className="btn" onClick={() => copy(doc, "the document")}>Copy document</button>
                    <button className="btn" onClick={() => setDoc(defaultDoc())}>Reset</button>
                    <button className="btn" onClick={() => setDoc("")}>Clear</button>
                  </div>
                  {nodes.length > 0 && (
                    <span className="wasm-badge compiled">{nodeStats.count} nodes · {nodeStats.visible} visible chars carry {nodeStats.bytes} bytes = {nodeStats.asmChars} chars of assembly{nodeStats.visible ? ` · ${(nodeStats.asmChars / nodeStats.visible).toFixed(1)}× denser` : ""}</span>
                  )}
                  <b>Resolved nodes</b>
                  {nodes.length === 0 && <span className="muted">No nodes found. Click the palette above to weave one in.</span>}
                  {nodes.map((node, index) => (
                    <div key={index} className="stack wasm-node">
                      {node.error ? (
                        <div className="wasm-err">⟦{node.label}⟧ — {node.error}</div>
                      ) : (
                        <>
                          <div className="row"><code>⟦{node.label}⟧ {node.glyph}</code><small className="muted">{node.hidden} B → {node.instructions} instructions · runs to "{node.out}"</small></div>
                          <pre className="wasm-hex">{node.asm}</pre>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {view === "merkle" && (
                <div className="stack">
                  <span className="muted">True Merkle 41: the source text becomes DNA, 8192 bases, 256 words, 32 FaceBlock hashes, 8 parents, 1 root — all FNV-1a 64-bit.</span>
                  <span className="wasm-badge compiled">root 0x{merkle.root.toString(16).padStart(16, "0")}</span>
                  <span className="muted">{merkle.bytesLen} bytes in · {merkle.words} words · {merkle.hashCount} hashes (32 + 8 + 1)</span>
                  <b>FRAY 64-byte header + bytecode</b>
                  <pre className="wasm-hex">{assembled.code ? hexDump(frayHeader(assembled.code, merkle.root)) : "parse error"}</pre>
                  <b>FaceBlock hashes (first 8 of 32)</b>
                  <pre className="wasm-hex">{merkle.blockHashes.slice(0, 8).map((hash, index) => `${index}: 0x${hash.toString(16).padStart(16, "0")}`).join("\n")}</pre>
                </div>
              )}
              {view === "golden" && (
                <div className="stack">
                  <span className="muted">The archive's 13 golden tests, verified live on both FrayVM and compiled WebAssembly (TURING_CFG).</span>
                  {golden.map((test) => (
                    <div key={test.name} className={`wasm-golden ${test.pass ? "ok" : "bad"}`}>
                      <span>{test.pass ? "✓" : "✕"}</span>
                      <code>{test.name}</code>
                      <small className="muted">
                        VM={JSON.stringify(test.output)} · WASM({test.wasmBytes}B, main={test.wasmMain})={JSON.stringify(test.wasmOutput)}
                        {test.pass ? "" : ` ≠ ${JSON.stringify(test.expect)}`}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="tool-side">
        <b>WASM in one emoji</b>
        <span className="muted">Hide the bytecode behind one carrier (variation-selector codec), then recover and disassemble it.</span>
        <div className="row">
          <EmojiSelect value={carrier} onChange={setCarrier} label="Carrier emoji" />
          <button className="btn on" disabled={!bytecode.length} onClick={embed}>Embed {bytecode.length} B</button>
        </div>
        {glyph && (
          <>
            <div className="coder-glyph"><span>{glyph}</span><small className="muted">{[...glyph].length} code points · hides {decodeGlyph(glyph).bytes.length} B</small></div>
            <div className="row">
              <button className="btn" onClick={() => copy(glyph, "the glyph")}>Copy glyph</button>
              <button className="btn" onClick={revealGlyph}>Reveal to editor</button>
            </div>
          </>
        )}
        <label className="field" style={{ marginTop: 6 }}>
          <span>Paste a glyph to reveal</span>
          <textarea className="dispatch-code" rows={2} value={glyph} onChange={(event) => setGlyph(event.target.value)} placeholder="🧩︎︎…" spellCheck={false} />
        </label>
        <b style={{ marginTop: 6 }}>The idea</b>
        <span className="muted">WASM-MY-POCKET: one visible emoji is the whole interface; the program is invisible, recoverable, and runs client-side with no server. The FRAY header, True Merkle, and VM come from your archive; here every step actually runs.</span>
      </aside>
    </div>
  );
}

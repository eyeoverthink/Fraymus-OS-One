import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { base64, cleanCarrier, decodeGlyph, encodeGlyph, textBytes } from "./emojiCodec.js";
import { CATEGORIES, weigh } from "./emojiCatalog.js";
import EmojiSelect from "./EmojiSelect.jsx";
import { OPERATORS, PALETTE, PRESETS, PREVIEW_CSS, REGISTRY, SAMPLE, TARGETS, buildWasm, classifyKey, compileParts, describeEntry, emit, parseStyleDeclarations, parseStylesheet, styleText } from "./emojiMarkup.js";

const SOURCE_KEY = "fraymus.emojicoder.source";
const KEYS_KEY = "fraymus.emojicoder.keys";
const SHEET_KEY = "fraymus.emojicoder.sheet";
const FILES = { html: "index.html", jsdom: "page.js", jsx: "Page.jsx", java: "EmojiPage.java", pug: "page.pug", md: "page.md", json: "page.json", wasm: "page.wasm", emoji: "page.emoji.txt" };
const KIND_LABEL = { tag: "element", style: "css", macro: "combo" };
const BIND_MODES = [["macro", "Combination"], ["tag", "Element"], ["style", "CSS"]];
const SAMPLE_SHEET = `.btn-primary { background: #3dff9a; color: #0b0d0b; padding: 10px 18px; border-radius: 10px; font-weight: 700; }
.glass { background: rgba(20,30,60,.72); color: #fff; border: 1px solid rgba(255,255,255,.18); border-radius: 16px; padding: 18px; }
.title-xl { font-size: 40px; font-weight: 800; letter-spacing: -.02em; }
.muted-text { color: #6b7280; font-size: 14px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 600px) { .grid-3 { grid-template-columns: 1fr; } }`;
const OPERATOR_EXAMPLES = {
  ">": "📦 > 📄{inside}  →  <div><p>inside</p></div>",
  "+": "📄{a}+📄{b}  →  <p>a</p><p>b</p>",
  "*3": "📄{x}*3  →  three <p>x</p>",
  "( )": "(📦 > 📄{x})*2  →  repeat a whole group",
  "{ }": "🔘{Click me}  →  <button>Click me</button>",
  ".cls": "📦.card  →  <div class=\"card\">",
  "#id": "📦#main  →  <div id=\"main\">"
};
const AUTO_POOL = ["🦄", "🐙", "🦋", "🐝", "🦊", "🐳", "🌵", "🍀", "🍄", "🌻", "🍋", "🍇", "🍩", "🧁", "🏰", "🏯", "🗼", "🚀", "🛸", "⚓", "🎈", "🎨", "🧩", "🪁", "💎", "🔮", "🪐", "🌋", "🧊", "🔥"];

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
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

function reactStyle(style) {
  return Object.fromEntries(Object.entries(style).map(([prop, value]) => [
    prop.startsWith("--") ? prop : prop.replace(/^-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^(webkit|moz|ms)/, (prefix) => prefix[0].toUpperCase() + prefix.slice(1)),
    value
  ]));
}

function keyMeaning(expansion) {
  const kind = classifyKey(expansion);
  if (kind.type === "tag") return `<${kind.tag}>`;
  if (kind.type === "style") return styleText(kind.style);
  return expansion;
}

function projectCss(project) {
  if (project?.css) return project.css;
  return Object.entries(project?.files || {}).filter(([name]) => name.endsWith(".css")).map(([, text]) => text).join("\n");
}

export function applyEmojiCode(project, parts) {
  if (project.stack !== "mern") {
    return {
      ...project,
      html: `${project.html || ""}\n${parts.split.html}`,
      css: `${project.css || ""}\n${parts.split.css}`
    };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Coded.jsx";
  const pages = next.pages.some((page) => page.name === "Coded")
    ? next.pages
    : [...next.pages, { name: "Coded", path: "/coded", file, auth: false }];
  const source = `import React from "react";
export default function Coded() {
  return (
    <main className="page">
${parts.jsx}    </main>
  );
}
`;
  return {
    ...next,
    pages,
    files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) }
  };
}

function Window({ title, onClose, children, wide }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ width: wide ? "min(1040px, 100%)" : "min(820px, 100%)" }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Weight({ glyph }) {
  const weight = weigh(glyph);
  return (
    <span className="muted">
      {weight.hex} · {weight.codePoints} code point{weight.codePoints > 1 ? "s" : ""} · {weight.utf16} UTF-16 units · {weight.utf8} UTF-8 bytes{weight.sequence ? " · a sequence" : ""}
    </span>
  );
}

function EmojiWindow({ keys, purpose, onClose, onInsert, onKey, onCarrier, onAssign }) {
  const registryTabs = useMemo(() => {
    const groups = { el: [], sty: [], mod: [] };
    for (const [glyph, entry] of Object.entries(REGISTRY)) groups[entry.t].push(glyph);
    return [["elements", "HTML elements", [...groups.el, ...groups.mod]], ["styles", "CSS styles", groups.sty]];
  }, []);
  const tabs = [...registryTabs, ["mine", "My keys", Object.keys(keys)], ...CATEGORIES];
  const [tab, setTab] = useState(purpose?.rule != null || purpose === "carrier" || purpose === "key" ? "animals" : "elements");
  const [heavy, setHeavy] = useState(false);
  const [picked, setPicked] = useState("");
  const [typed, setTyped] = useState("");
  const list = tabs.find(([id]) => id === tab)?.[2] || [];
  const shown = heavy ? [...list].sort((a, b) => weigh(b).utf8 - weigh(a).utf8) : list;
  const meaning = picked && (REGISTRY[picked] ? describeEntry(REGISTRY[picked]) : keys[picked] ? { kind: `My key · ${KIND_LABEL[classifyKey(keys[picked]).type]}`, text: keyMeaning(keys[picked]) } : null);

  function primary(glyph) {
    if (purpose?.rule != null) onAssign(glyph);
    else if (purpose === "carrier") onCarrier(glyph);
    else if (purpose === "key") onKey(glyph);
    else onInsert(glyph);
  }

  return (
    <Window title={purpose?.rule != null ? `Emoji for ${purpose.selector}` : "Emoji window"} onClose={onClose} wide>
      <div className="ew">
        <div className="ew-tabs">
          {tabs.map(([id, label, items]) => (
            <button key={id} className={`ptab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{label} <small>{items.length}</small></button>
          ))}
        </div>
        <div className="row">
          <span className="muted" style={{ flex: 1 }}>
            {tab === "elements" ? "Each glyph is a real HTML tag." : tab === "styles" ? "Each glyph is a set of CSS declarations. Put them right after an element." : tab === "mine" ? "Your own bindings: combinations, elements, and CSS." : "Free glyphs. Bind any of them to CSS, an element, or a combination, or use one as a carrier."}
            {" "}Click to select, double-click to {purpose?.rule != null ? "assign" : purpose === "carrier" ? "use as carrier" : purpose === "key" ? "bind" : "insert"}.
          </span>
          <input className="coder-emoji" value={typed} onChange={(event) => { setTyped(event.target.value); setPicked(event.target.value.trim()); }} placeholder="type or paste any emoji" aria-label="Type or paste any emoji" />
          <div className="seg">
            <button className={heavy ? "" : "on"} onClick={() => setHeavy(false)}>Default order</button>
            <button className={heavy ? "on" : ""} onClick={() => setHeavy(true)}>Heaviest first</button>
          </div>
        </div>
        <div className="ew-grid">
          {shown.map((glyph) => (
            <button key={glyph} className={picked === glyph ? "on" : ""} title={weigh(glyph).hex} onClick={() => setPicked(glyph)} onDoubleClick={() => primary(glyph)}>{glyph}</button>
          ))}
          {shown.length === 0 && <span className="muted">Nothing bound yet. Pick a glyph from another tab and press Bind as my key.</span>}
        </div>
        <div className="ew-detail">
          {picked ? (
            <>
              <span className="ew-big">{picked}</span>
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <b>{meaning ? `${meaning.kind}: ${meaning.text}` : "Unbound — free to define"}</b>
                <Weight glyph={picked} />
                <span className="muted">Capacity: as a carrier it hides any number of bytes, one invisible selector per byte. A heavier glyph costs more to display but does not hold more.</span>
              </div>
              <div className="stack">
                {purpose?.rule != null
                  ? <button className="btn on" onClick={() => onAssign(picked)}>Assign to {purpose.selector}</button>
                  : <>
                      <button className="btn on" onClick={() => onInsert(picked)}>Insert into markup</button>
                      <button className="btn" onClick={() => onKey(picked)}>Bind as my key</button>
                      <button className="btn" onClick={() => onCarrier(picked)}>Use as carrier</button>
                    </>}
              </div>
            </>
          ) : <span className="muted">Select a glyph to see what it means, what it weighs, and what you can do with it.</span>}
        </div>
      </div>
    </Window>
  );
}

function LegendTable({ rows, onInsert }) {
  return (
    <table className="legend-table">
      <tbody>
        {rows.map(([glyph, kind, text]) => (
          <tr key={glyph} onClick={() => onInsert(glyph)} title="Click to insert">
            <td className="legend-glyph">{glyph}</td><td className="muted">{kind}</td><td><code>{text}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LegendWindow({ keys, onClose, onInsert }) {
  const entries = Object.entries(REGISTRY).map(([glyph, entry]) => [glyph, describeEntry(entry)]);
  const section = (kind) => entries.filter(([, info]) => info.kind === kind);
  const mine = Object.entries(keys);
  return (
    <Window title="Legend" onClose={onClose} wide>
      <div className="stack">
        <div className="coder-help">
          <b>How a line reads.</b> An element glyph opens a tag. Style glyphs right after it add CSS to that tag. <code>{"{text}"}</code> fills it, <code>&gt;</code> nests the next element inside, <code>+</code> places one beside it, <code>*3</code> repeats, and <code>( )</code> groups. <code>.name</code> and <code>#id</code> add a class or id. Each line is one top-level element.
          <br /><br />
          <code>📦.card 🔲 ⭕ 📏 &gt; 2️⃣{"{Title}"}+📄{"{Body}"}</code> becomes <code>{'<div class="card" style="border…;border-radius:12px;padding:14px"><h2>Title</h2><p>Body</p></div>'}</code>
        </div>
        <b>Operators</b>
        <LegendTable onInsert={(label) => onInsert(OPERATORS.find((op) => op[1] === label)[0].trim())} rows={OPERATORS.map(([, label, hint]) => [label, hint, OPERATOR_EXAMPLES[label]])} />
        <b>Elements · {section("Element").length}</b>
        <LegendTable onInsert={onInsert} rows={section("Element").map(([glyph, info]) => [glyph, "tag", info.text])} />
        <b>Styles · {section("Style").length}</b>
        <LegendTable onInsert={onInsert} rows={section("Style").map(([glyph, info]) => [glyph, "css", info.text])} />
        <b>Actions</b>
        <LegendTable onInsert={onInsert} rows={section("Action").map(([glyph, info]) => [glyph, "event", info.text])} />
        <b>My keys · {mine.length}</b>
        {mine.length ? <LegendTable onInsert={onInsert} rows={mine.map(([glyph, expansion]) => [glyph, KIND_LABEL[classifyKey(expansion).type], keyMeaning(expansion)])} /> : <span className="muted">None yet. Open the emoji window or the CSS sheet to define your own.</span>}
        <div className="coder-help">
          <b>Three kinds of key.</b> A <b>combination</b> expands to more emoji markup, so one glyph can stand for a whole nav bar or card. An <b>element</b> (<code>=dialog</code>) adds a real tag. A <b>CSS</b> key holds full declarations (<code>background: …; color: …</code>) and works exactly like the built-in style glyphs, stacked after any element.
        </div>
        <div className="coder-help">
          <b>Does a bigger emoji store more?</b> No. A family or flag takes more bytes to display (🧠 is 4 UTF-8 bytes, 👨‍👩‍👧‍👦 is 25), but hiding data works the same on every carrier: each hidden byte becomes one invisible variation selector after it (3 UTF-8 bytes for values 0–15, 4 for 16–255). Any carrier holds as much as you want, up to the 64 KB limit here. Pick a carrier for how it looks.
        </div>
      </div>
    </Window>
  );
}

function SheetWindow({ sheet, setSheet, assigned, setAssigned, project, keys, onClose, onBindAll, onPickFor }) {
  const rules = useMemo(() => parseStylesheet(sheet), [sheet]);

  function autoPick() {
    const taken = new Set([...Object.keys(REGISTRY), ...Object.keys(keys), ...Object.values(assigned)]);
    const pool = AUTO_POOL.filter((glyph) => !taken.has(glyph));
    const next = { ...assigned };
    rules.forEach((_, index) => { if (!next[index] && pool.length) next[index] = pool.shift(); });
    setAssigned(next);
  }

  const ready = rules.map((rule, index) => [assigned[index], rule]).filter(([glyph]) => glyph);
  return (
    <Window title="CSS → Emoji" onClose={onClose} wide>
      <div className="sheet">
        <div className="stack">
          <span className="muted">Paste a full stylesheet. Every rule becomes a CSS key you can bind to any emoji. @media and other at-rules are skipped because a single glyph carries one set of declarations.</span>
          <textarea className="sheet-src" value={sheet} onChange={(event) => setSheet(event.target.value)} spellCheck={false} aria-label="Stylesheet" />
          <div className="row">
            <button className="btn" onClick={() => { setSheet(SAMPLE_SHEET); setAssigned({}); }}>Sample sheet</button>
            <button className="btn" disabled={!projectCss(project)} onClick={() => { setSheet(projectCss(project)); setAssigned({}); }}>Load this project's CSS</button>
            <button className="btn" onClick={() => { setSheet(""); setAssigned({}); }}>Clear</button>
          </div>
        </div>
        <div className="stack">
          <div className="row">
            <b style={{ flex: 1 }}>{rules.length} rule{rules.length === 1 ? "" : "s"}</b>
            <button className="btn" onClick={autoPick} disabled={!rules.length}>Auto-pick emoji</button>
            <button className="btn on" disabled={!ready.length} onClick={() => onBindAll(ready)}>Bind {ready.length}</button>
          </div>
          <div className="sheet-rules">
            {rules.map((rule, index) => (
              <div key={`${rule.selector}-${index}`} className="sheet-rule">
                <EmojiSelect value={assigned[index]} onChange={(glyph) => setAssigned((current) => ({ ...current, [index]: glyph }))} label={`Emoji for ${rule.selector}`} />
                <button className="btn" onClick={() => onPickFor(index, rule.selector)} title="Open the full emoji window">⋯</button>
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <code>{rule.selector}</code>
                  <small className="muted">{Object.keys(rule.style).length} declarations · {styleText(rule.style)}</small>
                </div>
                <div className="swatch" style={reactStyle(rule.style)}>Aa</div>
              </div>
            ))}
            {!rules.length && <span className="muted">No rules found yet. A rule looks like <code>{".name { color: red; }"}</code>.</span>}
          </div>
        </div>
      </div>
    </Window>
  );
}

export default function EmojiCoderPage({ project, say, onApply }) {
  const [source, setSource] = useState(() => readJson(SOURCE_KEY, SAMPLE));
  const [keys, setKeys] = useState(() => readJson(KEYS_KEY, {}));
  const [target, setTarget] = useState("css");
  const [view, setView] = useState("preview");
  const [keyEmoji, setKeyEmoji] = useState("");
  const [keyExp, setKeyExp] = useState("");
  const [bindMode, setBindMode] = useState("macro");
  const [carrier, setCarrier] = useState("🧠");
  const [payloadKind, setPayloadKind] = useState("src");
  const [glyph, setGlyph] = useState("");
  const [revealed, setRevealed] = useState(null);
  const [wasm, setWasm] = useState(null);
  const [windowOpen, setWindowOpen] = useState(null);
  const [picker, setPicker] = useState(null);
  const [sheet, setSheet] = useState(() => readJson(SHEET_KEY, SAMPLE_SHEET));
  const [assigned, setAssigned] = useState({});
  const editor = useRef(null);
  const deferred = useDeferredValue(source);

  useEffect(() => { localStorage.setItem(SOURCE_KEY, JSON.stringify(source)); }, [source]);
  useEffect(() => { localStorage.setItem(SHEET_KEY, JSON.stringify(sheet)); }, [sheet]);
  useEffect(() => { localStorage.setItem(KEYS_KEY, JSON.stringify(keys)); }, [keys]);

  const parts = useMemo(() => compileParts(deferred, keys), [deferred, keys]);
  const output = useMemo(() => (target === "wasm" ? "" : emit(deferred, keys, target)), [deferred, keys, target]);

  useEffect(() => {
    if (target !== "wasm") return undefined;
    let alive = true;
    buildWasm(deferred, parts.html).then((built) => { if (alive) setWasm(built); });
    return () => { alive = false; };
  }, [target, deferred, parts.html]);

  const shown = revealed ?? parts.html;
  const previewDoc = `<!doctype html><meta charset="utf-8"><style>${PREVIEW_CSS}</style>${shown}`;
  const exportText = target === "wasm"
    ? wasm ? `// ${wasm.bytes.length} byte .wasm — magic 00 61 73 6d — export execute(i32) -> i32\n// custom section fraymus.emojicoder carries the source as base64, so it is reversible\n\n${JSON.stringify(wasm.ledger, null, 2)}` : "Building…"
    : output;
  const lines = exportText.split("\n").length;
  const draftStyle = bindMode === "style" ? parseStyleDeclarations(keyExp) : {};

  function insert(text) {
    const node = editor.current;
    const start = node?.selectionStart ?? source.length;
    const end = node?.selectionEnd ?? source.length;
    const next = source.slice(0, start) + text + source.slice(end);
    setSource(next);
    setRevealed(null);
    requestAnimationFrame(() => {
      if (!node) return;
      node.focus();
      node.selectionStart = node.selectionEnd = start + text.length;
    });
  }

  function bind() {
    const emoji = keyEmoji.trim();
    let expansion = keyExp.trim();
    if (!emoji || !expansion) return;
    if (bindMode === "tag") expansion = `=${expansion.replace(/^=|[<>/\s]/g, "")}`;
    if (bindMode === "style") {
      const style = parseStyleDeclarations(expansion);
      if (!Object.keys(style).length) {
        say?.("No CSS declarations found — write them as property: value;");
        return;
      }
      expansion = styleText(style);
    }
    const kind = classifyKey(expansion).type;
    if (kind !== bindMode) {
      say?.(`That reads as a ${KIND_LABEL[kind]} key, not ${KIND_LABEL[bindMode]}`);
      return;
    }
    setKeys((current) => ({ ...current, [emoji]: expansion }));
    setKeyEmoji("");
    setKeyExp("");
    say?.(`${emoji} is now a ${KIND_LABEL[kind]} key: ${keyMeaning(expansion).slice(0, 60)}`);
  }

  function bindRules(rows) {
    setKeys((current) => {
      const next = { ...current };
      for (const [emoji, rule] of rows) next[emoji] = styleText(rule.style);
      return next;
    });
    setWindowOpen(null);
    setAssigned({});
    say?.(`Bound ${rows.length} CSS rule${rows.length === 1 ? "" : "s"} to emoji: ${rows.map(([emoji]) => emoji).join(" ")}`);
  }

  function forge() {
    const text = payloadKind === "html" ? parts.html : source;
    const next = encodeGlyph(textBytes(text), carrier);
    setGlyph(next);
    say?.(`${cleanCarrier(carrier)} now hides ${textBytes(text).length} bytes`);
  }

  function reveal() {
    if (!glyph) return;
    const text = new TextDecoder().decode(decodeGlyph(glyph).bytes);
    setRevealed(/<[a-z]/i.test(text) ? text : compileParts(text, keys).html);
    setView("preview");
    say?.("Rendered the hidden page from the glyph");
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      say?.(`Copied ${label}`);
    } catch {
      say?.("Clipboard is blocked here — use Download instead");
    }
  }

  function save() {
    if (target === "wasm") {
      if (wasm) download(FILES.wasm, wasm.bytes, "application/wasm");
      return;
    }
    if (target === "css") {
      download("styles.css", parts.split.css, "text/css");
      download("index.html", `<!doctype html>\n<html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body>\n${parts.split.html}</body></html>\n`, "text/html");
      return;
    }
    download(FILES[target], output);
  }

  const glyphBytes = glyph ? decodeGlyph(glyph).bytes.length : 0;
  const glyphWeight = glyph ? new TextEncoder().encode(glyph).length : 0;
  const carrierWeight = weigh(cleanCarrier(carrier) || "🧠").utf8;
  const keyList = Object.entries(keys);
  const closePicker = () => setPicker(null);

  return (
    <div className="tool coder">
      <aside className="tool-side">
        <b>Palette</b>
        <div className="row">
          <button className="btn on" onClick={() => setPicker("insert")}>Emoji window</button>
          <button className="btn" onClick={() => setWindowOpen("legend")}>Legend</button>
          <button className="btn" onClick={() => setWindowOpen("sheet")}>CSS → Emoji</button>
        </div>
        <span className="muted">Click to insert. Elements take styles right after them, with or without spaces. The emoji window has every glyph, sorted into tabs.</span>
        {keyList.length > 0 && (
          <div className="coder-group">
            <span className="fh">My keys</span>
            <div className="coder-keys">
              {keyList.map(([emoji, expansion]) => (
                <button key={emoji} className="coder-key" title={keyMeaning(expansion)} onClick={() => insert(`${emoji} `)}>{emoji}<small>{classifyKey(expansion).type === "tag" ? keyMeaning(expansion) : KIND_LABEL[classifyKey(expansion).type]}</small></button>
              ))}
            </div>
          </div>
        )}
        {PALETTE.map(([group, items]) => (
          <div key={group} className="coder-group">
            <span className="fh">{group}</span>
            <div className="coder-keys">
              {items.map((item) => {
                const [emoji, ...label] = item.split(" ");
                const entry = REGISTRY[emoji];
                return <button key={item} className="coder-key" onClick={() => insert(`${emoji} `)} title={entry ? describeEntry(entry).text : emoji}>{emoji}{label.length > 0 && <small>{label.join(" ")}</small>}</button>;
              })}
            </div>
          </div>
        ))}
        <b style={{ marginTop: 6 }}>Make your own key</b>
        <div className="seg">
          {BIND_MODES.map(([id, label]) => <button key={id} className={bindMode === id ? "on" : ""} onClick={() => { setBindMode(id); setKeyExp(""); }}>{label}</button>)}
        </div>
        <span className="muted">
          {bindMode === "macro" && "One emoji that expands to more emoji markup — a whole card, nav bar, or section."}
          {bindMode === "tag" && "One emoji that becomes a real HTML element, such as dialog, aside, or details."}
          {bindMode === "style" && "One emoji that carries full CSS. Put it after any element, like the built-in style glyphs."}
        </span>
        <div className="row">
          <EmojiSelect value={keyEmoji} onChange={setKeyEmoji} label="Emoji to bind" />
          <input className="coder-emoji" value={keyEmoji} onChange={(event) => setKeyEmoji(event.target.value)} placeholder="or type" aria-label="Emoji to bind" />
          {bindMode === "macro" && (
            <select value="" onChange={(event) => { if (event.target.value) setKeyExp(PRESETS[event.target.value]); }} aria-label="Preset">
              <option value="">preset…</option>
              {Object.keys(PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
        </div>
        <label className="field">
          <span>{bindMode === "macro" ? "Expands to" : bindMode === "tag" ? "Tag name" : "CSS declarations"}</span>
          <textarea
            rows={bindMode === "style" ? 4 : 2}
            value={keyExp}
            onChange={(event) => setKeyExp(event.target.value)}
            placeholder={bindMode === "macro" ? "📦.card 🔲 > 2️⃣{Title}+📄{Body}" : bindMode === "tag" ? "dialog" : "background: linear-gradient(90deg,#ff4d8d,#7ec8ff);\ncolor: #fff;\nborder-radius: 20px;"}
            spellCheck={false}
          />
        </label>
        {bindMode === "style" && Object.keys(draftStyle).length > 0 && <div className="swatch wide" style={reactStyle(draftStyle)}>{keyEmoji || "🌟"} preview · {Object.keys(draftStyle).length} declarations</div>}
        <button className="btn on" onClick={bind}>Bind</button>
        {keyList.map(([emoji, expansion]) => (
          <div key={emoji} className="coder-bound">
            <span>{emoji}</span>
            <small className="muted">{KIND_LABEL[classifyKey(expansion).type]}</small>
            <code title={expansion}>{keyMeaning(expansion)}</code>
            <button className="btn" onClick={() => setKeys((current) => { const next = { ...current }; delete next[emoji]; return next; })} aria-label={`Remove ${emoji}`}>✕</button>
          </div>
        ))}
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Emoji Coder</b>
          <span className="muted">emoji → HTML · CSS · JS · Java · {parts.nodes.length} top-level elements · {parts.split.count} style classes · {keyList.length} keys</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => setWindowOpen("legend")}>Legend</button>
          <button className="btn" onClick={() => { setSource(SAMPLE); setRevealed(null); }}>Sample</button>
          <button className="btn" onClick={() => { setSource(""); setRevealed(null); }}>Clear</button>
          <button className="btn on" onClick={() => { onApply(applyEmojiCode(project, parts)); say?.(project.stack === "mern" ? "Added a Coded page at /coded" : "Appended the HTML and its CSS classes to the project"); }}>Place in project</button>
        </div>
        <div className="coder-body">
          <div className="coder-edit">
            <div className="webjs-head"><b>Emoji markup</b><span className="muted">{[...source].length} code points · {source.split("\n").length} lines</span></div>
            <textarea ref={editor} className="coder-src" value={source} spellCheck={false} onChange={(event) => { setSource(event.target.value); setRevealed(null); }} placeholder="🧭 🎯 > 🔗{Home}+🔗{About}+🔗{Contact}" aria-label="Emoji markup" />
            <div className="coder-ops">
              {OPERATORS.map(([text, label, hint]) => <button key={label} className="btn" title={hint} onClick={() => insert(text)}>{label}</button>)}
              <button className="btn" onClick={() => insert("\n")} title="new top-level element">⏎ line</button>
            </div>
          </div>
          <div className="coder-view">
            <div className="webjs-head">
              <div className="seg">
                {[["preview", "Live preview"], ["html", "HTML"], ["css", "CSS"]].map(([id, label]) => (
                  <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}</button>
                ))}
              </div>
              {revealed != null ? <button className="btn" onClick={() => setRevealed(null)}>Back to editor output</button> : <span className="muted">{parts.html.length} chars</span>}
            </div>
            {view === "preview"
              ? <div className="webjs-stage"><iframe className="webjs-frame" style={{ width: "100%" }} title="Emoji Coder preview" sandbox="allow-scripts" srcDoc={previewDoc} /></div>
              : <pre className="coder-code">{view === "css" ? parts.split.css : shown || "<!-- empty -->"}</pre>}
          </div>
        </div>
      </section>

      <aside className="tool-side">
        <b>Export</b>
        <div className="emoji-views">
          {TARGETS.map(([id, label]) => (
            <button key={id} className={`btn${target === id ? " on" : ""}`} onClick={() => setTarget(id)}>{label}</button>
          ))}
        </div>
        <span className="muted">{target === "wasm" && wasm ? `${wasm.bytes.length} B · Copy gives base64` : `${lines} lines · ${exportText.length} chars`}</span>
        <pre className="emoji-view coder-export">{exportText}</pre>
        <div className="row">
          <button className="btn" onClick={() => copy(target === "wasm" ? (wasm ? base64(wasm.bytes) : "") : exportText, TARGETS.find(([id]) => id === target)[1])}>Copy</button>
          <button className="btn" onClick={save}>{target === "css" ? "styles.css + index.html" : `Download ${FILES[target]}`}</button>
        </div>
        {target === "java" && <span className="muted">JDK 15+, no dependencies: javac EmojiPage.java &amp;&amp; java EmojiPage writes page.html.</span>}
        <b style={{ marginTop: 6 }}>Embed in one emoji</b>
        <span className="muted">Each byte becomes one invisible selector after the carrier — the same codec as the Emoji tab and FrayGlyph.java.</span>
        <div className="row">
          <EmojiSelect value={cleanCarrier(carrier)} onChange={(next) => { setCarrier(next); setGlyph(""); }} label="Carrier emoji" />
          <div className="seg">
            {[["src", "Source"], ["html", "HTML"]].map(([id, label]) => (
              <button key={id} className={payloadKind === id ? "on" : ""} onClick={() => setPayloadKind(id)}>{label}</button>
            ))}
          </div>
        </div>
        <span className="muted">Carrier {cleanCarrier(carrier) || "🧠"} weighs {carrierWeight} UTF-8 bytes. Every carrier holds the same: unlimited bytes, one selector each.</span>
        <div className="row">
          <button className="btn on" onClick={forge}>Embed</button>
          <button className="btn" disabled={!glyph} onClick={() => copy(glyph, "the glyph")}>Copy glyph</button>
          <button className="btn" disabled={!glyph} onClick={reveal}>Reveal</button>
        </div>
        {glyph && (
          <div className="coder-glyph">
            <span>{glyph}</span>
            <small className="muted">hides {glyphBytes} bytes · {[...glyph].length} code points · {glyphWeight} UTF-8 bytes on the wire</small>
          </div>
        )}
      </aside>

      {windowOpen === "legend" && <LegendWindow keys={keys} onClose={() => setWindowOpen(null)} onInsert={(glyphText) => { insert(`${glyphText} `); setWindowOpen(null); }} />}
      {windowOpen === "sheet" && (
        <SheetWindow
          sheet={sheet}
          setSheet={setSheet}
          assigned={assigned}
          setAssigned={setAssigned}
          project={project}
          keys={keys}
          onClose={() => setWindowOpen(null)}
          onBindAll={bindRules}
          onPickFor={(index, selector) => setPicker({ rule: index, selector })}
        />
      )}
      {picker && (
        <EmojiWindow
          keys={keys}
          purpose={picker}
          onClose={closePicker}
          onInsert={(glyphText) => { insert(`${glyphText} `); closePicker(); }}
          onKey={(glyphText) => { setKeyEmoji(glyphText); closePicker(); say?.(`Picked ${glyphText} — now define what it means`); }}
          onCarrier={(glyphText) => { setCarrier(glyphText); setGlyph(""); closePicker(); }}
          onAssign={(glyphText) => { setAssigned((current) => ({ ...current, [picker.rule]: glyphText })); closePicker(); }}
        />
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";

const STAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#101210;color:#e7eee8;font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}
main{padding:18px} h1{margin:0 0 8px} .lede{color:#8b978e}
button{background:#3dff9a;color:#062214;border:0;border-radius:999px;padding:8px 12px}
.card{margin-top:12px;padding:12px;border:1px solid #343b34;border-radius:12px}
</style></head><body>
<main id="stage"><h1 id="title">DOM stage</h1><p class="lede" id="copy">Commands land on this document.</p><button id="go">Go</button></main>
<script>
window.addEventListener("message", function(event){
  var data = event.data || {};
  if (data.fray !== "repl") return;
  var result, ok = true;
  try { result = (0, eval)(data.code); if (typeof result === "object") { try { result = JSON.stringify(result); } catch(e) { result = String(result); } } }
  catch (error) { ok = false; result = String(error); }
  parent.postMessage({ fray: "repl-result", id: data.id, ok: ok, result: String(result) }, "*");
});
</script>
</body></html>`;

const COMMANDS = [
  ["help", "help [name]", "List commands, or show one.", "help query"],
  ["clear", "clear", "Clear the REPL log.", "clear"],
  ["query", "query(selector)", "First matching element.", "query('#title')"],
  ["queryAll", "queryAll(selector)", "Every match, as a count plus tags.", "queryAll('p,button')"],
  ["text", "text(selector, value?)", "Read or set textContent.", "text('#copy', 'Updated')"],
  ["html", "html(selector, value?)", "Read or set innerHTML.", "html('#stage')"],
  ["style", "style(selector, prop, value?)", "Read or set one CSS property.", "style('#title', 'color', '#3dff9a')"],
  ["class", "class(selector, name, on?)", "Toggle, add, or remove a class.", "class('#title', 'hot', true)"],
  ["attr", "attr(selector, name, value?)", "Read or set an attribute.", "attr('#go', 'data-role', 'action')"],
  ["create", "create(tag, parent?)", "Make an element and append it.", "create('p', '#stage')"],
  ["append", "append(selector, text)", "Append a text node.", "append('#copy', ' more')"],
  ["remove", "remove(selector)", "Remove the element.", "remove('#go')"],
  ["click", "click(selector)", "Fire a click.", "click('#go')"],
  ["focus", "focus(selector)", "Focus an element.", "focus('#go')"],
  ["box", "box(selector)", "Read x, y, width, height.", "box('#title')"],
  ["tree", "tree", "Outline the stage tags.", "tree"],
  ["keys", "keys(objectExpr)", "Object.keys of an expression.", "keys({a:1,b:2})"],
  ["json", "json(value)", "JSON.stringify a value.", "json([1,2,3])"],
  ["range", "range(n)", "Array of 0..n-1.", "range(5)"],
  ["sum", "sum(a,b,...)", "Add numbers.", "sum(1, 2, 3.5)"],
  ["now", "now", "Current time.", "now"],
  ["typeof", "typeof expr", "JavaScript typeof.", "typeof document"]
];

const PREMADE = [
  { id: "fade", name: "Fade title", code: "style('#title', 'opacity', '0.45')" },
  { id: "accent", name: "Accent title", code: "style('#title', 'color', '#3dff9a')" },
  { id: "card", name: "Insert card", code: "create('div', '#stage'); class('#stage div:last-child', 'card', true); text('#stage .card', 'Dropped in from the bin')" },
  { id: "grid", name: "Grid the stage", code: "style('#stage', 'display', 'grid'); style('#stage', 'gap', '8px')" },
  { id: "rename", name: "Rename heading", code: "text('#title', 'Fraymus stage')" }
];

function tokenize(line) {
  const parts = [];
  let current = "";
  let quote = "";
  for (const char of line.trim()) {
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === " " || char === "," || char === "(" || char === ")") {
      if (current) parts.push(current);
      current = "";
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function describe(doc, selector) {
  const node = doc.querySelector(selector);
  if (!node) throw new Error("No element for " + selector);
  return node;
}

function runLine(line, doc) {
  const parts = tokenize(line);
  const name = parts[0];
  const args = parts.slice(1);
  if (!name) return "";
  if (name === "help") {
    if (!args[0]) return COMMANDS.map((item) => item[1]).join("\n");
    const found = COMMANDS.find((item) => item[0] === args[0]);
    return found ? `${found[1]}\n${found[2]}\nexample: ${found[3]}` : "Unknown command";
  }
  if (name === "tree") return [...doc.body.querySelectorAll("*")].map((node) => node.tagName.toLowerCase() + (node.id ? "#" + node.id : "")).join("\n");
  if (name === "now") return new Date().toLocaleString();
  if (name === "range") return JSON.stringify([...Array(Number(args[0]) || 0).keys()]);
  if (name === "sum") return String(args.reduce((total, value) => total + Number(value), 0));
  if (name === "typeof") return typeof doc.defaultView.eval(line.replace(/^\s*typeof\s+/, ""));
  if (name === "keys") return JSON.stringify(Object.keys(doc.defaultView.eval("(" + line.replace(/^\s*keys\s*/, "") + ")")));
  if (name === "json") return JSON.stringify(doc.defaultView.eval("(" + line.replace(/^\s*json\s*/, "") + ")"));
  if (name === "query") return describe(doc, args[0]).tagName.toLowerCase();
  if (name === "queryAll") return String(doc.querySelectorAll(args[0] || "*").length);
  if (name === "text") {
    const node = describe(doc, args[0]);
    if (args.length > 1) node.textContent = args.slice(1).join(" ");
    return node.textContent;
  }
  if (name === "html") {
    const node = describe(doc, args[0]);
    if (args.length > 1) node.innerHTML = args.slice(1).join(" ");
    return node.innerHTML.slice(0, 400);
  }
  if (name === "style") {
    const node = describe(doc, args[0]);
    if (args[2] != null) node.style[args[1]] = args.slice(2).join(" ");
    return node.style[args[1]] || getComputedStyle(node)[args[1]] || "";
  }
  if (name === "class") {
    const node = describe(doc, args[0]);
    if (args[2] === "true") node.classList.add(args[1]);
    else if (args[2] === "false") node.classList.remove(args[1]);
    else node.classList.toggle(args[1]);
    return node.className;
  }
  if (name === "attr") {
    const node = describe(doc, args[0]);
    if (args.length > 2) node.setAttribute(args[1], args.slice(2).join(" "));
    return node.getAttribute(args[1]);
  }
  if (name === "create") {
    const node = doc.createElement(args[0] || "div");
    node.textContent = args[0] || "div";
    describe(doc, args[1] || "#stage").appendChild(node);
    return "created " + node.tagName.toLowerCase();
  }
  if (name === "append") {
    describe(doc, args[0]).append(args.slice(1).join(" "));
    return "appended";
  }
  if (name === "remove") {
    describe(doc, args[0]).remove();
    return "removed";
  }
  if (name === "click") {
    describe(doc, args[0]).click();
    return "clicked";
  }
  if (name === "focus") {
    describe(doc, args[0]).focus();
    return "focused";
  }
  if (name === "box") {
    const rect = describe(doc, args[0]).getBoundingClientRect();
    return JSON.stringify({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
  }
  return String(doc.defaultView.eval(line));
}

export default function ReplPage() {
  const frame = useRef(null);
  const [input, setInput] = useState("help");
  const [log, setLog] = useState([]);
  const [helpQuery, setHelpQuery] = useState("");
  const [selected, setSelected] = useState(COMMANDS[0]);
  const [strip, setStrip] = useState([]);
  const [methods, setMethods] = useState(() => {
    try { return [...PREMADE, ...JSON.parse(localStorage.getItem("fraymus-repl-methods") || "[]")]; }
    catch { return [...PREMADE]; }
  });
  const [draft, setDraft] = useState({ name: "", code: "text('#title', 'Hello')" });
  const history = useRef([]);
  const cursor = useRef(0);

  const helpItems = useMemo(() => COMMANDS.filter((item) => (item[0] + item[2]).toLowerCase().includes(helpQuery.toLowerCase())), [helpQuery]);

  function push(kind, text) {
    setLog((list) => [...list.slice(-80), { id: Date.now() + Math.random(), kind, text: String(text) }]);
  }

  function execute(line) {
    const doc = frame.current?.contentDocument;
    if (!doc) { push("error", "Stage is still loading"); return; }
    if (line.trim() === "clear") { setLog([]); return; }
    history.current.push(line);
    cursor.current = history.current.length;
    for (const part of line.split(";").map((item) => item.trim()).filter(Boolean)) {
      try { push("ok", runLine(part, doc)); }
      catch (error) { push("error", error.message); }
    }
  }

  function onKey(event) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); execute(input); setInput(""); }
    if (event.key === "ArrowUp") { event.preventDefault(); cursor.current = Math.max(0, cursor.current - 1); setInput(history.current[cursor.current] || ""); }
    if (event.key === "ArrowDown") { event.preventDefault(); cursor.current = Math.min(history.current.length, cursor.current + 1); setInput(history.current[cursor.current] || ""); }
  }

  function addMethod() {
    if (!draft.name.trim() || !draft.code.trim()) return;
    const next = [...methods, { id: "m" + Date.now(), name: draft.name.trim(), code: draft.code.trim(), custom: true }];
    setMethods(next);
    localStorage.setItem("fraymus-repl-methods", JSON.stringify(next.filter((item) => item.custom)));
    setDraft({ name: "", code: "" });
  }

  useEffect(() => {
    function onMessage(event) {
      if (event.data?.fray === "repl-result") push(event.data.ok ? "ok" : "error", event.data.result);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="tool">
      <aside className="tool-side">
        <p className="fh">Bin</p>
        <p className="muted">Drag a method onto the strip, or click it to run.</p>
        {methods.map((method) => (
          <button
            key={method.id}
            className="chip"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", method.code)}
            onClick={() => execute(method.code)}
          >
            <b>{method.name}</b>
            <span className="muted">{method.code}</span>
          </button>
        ))}
        <div className="stack">
          <input value={draft.name} placeholder="Method name" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <textarea rows={3} value={draft.code} placeholder="text('#title', 'Mine')" onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
          <button className="btn" onClick={addMethod}>Design method</button>
        </div>
      </aside>
      <section className="tool-main">
        <div className="codebar"><b>REPL</b><span className="muted">JavaScript · DOM · drag methods</span></div>
        <iframe ref={frame} title="DOM stage" className="stage-frame" sandbox="allow-scripts allow-same-origin" srcDoc={STAGE} />
        <div
          className="strip"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const code = event.dataTransfer.getData("text/plain"); if (code) setStrip((list) => [...list, code]); }}
        >
          {strip.length === 0 && <span className="muted">Drop methods here</span>}
          {strip.map((code, index) => (
            <span key={index} className="chip" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", code)}>
              {code}
              <button className="icon" onClick={() => setStrip(strip.filter((_, i) => i !== index))}>✕</button>
            </span>
          ))}
          {strip.length > 0 && <button className="btn on" onClick={() => strip.forEach(execute)}>Run strip</button>}
        </div>
        <div className="logs" style={{ flex: 1 }}>
          {log.map((entry) => <div key={entry.id} className={`clog ${entry.kind === "error" ? "error" : "ok"}`}>{entry.text}</div>)}
        </div>
        <form className="console form" onSubmit={(event) => event.preventDefault()} style={{ height: "auto" }}>
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKey} placeholder="query('#title')  ·  help" spellCheck={false} />
          <button className="btn" type="button" onClick={() => { execute(input); setInput(""); }}>Run</button>
        </form>
      </section>
      <aside className="tool-side">
        <p className="fh">Help</p>
        <input value={helpQuery} placeholder="Search commands" onChange={(event) => setHelpQuery(event.target.value)} />
        <div className="items">
          {helpItems.map((item) => (
            <button key={item[0]} className={`card ${selected[0] === item[0] ? "on" : ""}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", item[3])} onClick={() => { setSelected(item); setInput(item[3]); }}>
              <b>{item[1]}</b>
              <span className="muted">{item[2]}</span>
            </button>
          ))}
        </div>
        <div className="note blue">{selected[3]}</div>
      </aside>
    </div>
  );
}

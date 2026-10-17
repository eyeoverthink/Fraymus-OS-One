import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import { STARTERS } from "./webjsStarters.js";

const DRAFT_KEY = "fraymus.webjs.draft";
const DEVICES = [["fill", "Fill"], ["390", "Phone"], ["768", "Tablet"], ["1280", "Desktop"]];

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (saved && typeof saved.html === "string" && typeof saved.js === "string") return saved;
  } catch {
    /* fall through to the starter */
  }
  return { html: STARTERS[0].html, js: STARTERS[0].js, starter: STARTERS[0].id };
}

function bridge(run) {
  return `<script>(function(){var RUN=${run};function fmt(v){if(typeof v==="string")return v;if(v instanceof Error)return v.name+": "+v.message;try{return JSON.stringify(v)}catch(e){return String(v)}}
function send(level,args){try{parent.postMessage({fray:"webjs",run:RUN,level:level,text:[].map.call(args,fmt).join(" ")},"*")}catch(e){}}
["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);return o.apply(console,arguments)}});
window.addEventListener("error",function(e){send("error",[(e.message||"Error")+"@@"+(e.lineno||0)])});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("error",["Unhandled promise: "+(r&&r.message?r.message:fmt(r))])});})();<\/script>`;
}

export function buildDocument(html, js, run = 0) {
  const script = `<script>\n${js.replace(/<\/script/gi, "<\\/script")}\n<\/script>`;
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${run ? bridge(run) : ""}`;
  let doc;
  if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) {
    doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (tag) => tag + head) : html.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${head}</head>`);
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${script}\n</body>`) : `${doc}\n${script}`;
  } else {
    doc = `<!doctype html>\n<html><head>${head}</head><body>\n${html}\n${script}\n</body></html>`;
  }
  const before = doc.slice(0, doc.indexOf(script)).split("\n").length;
  return { doc, jsLine: before + 1 };
}

export function applyWebJs(project, html, js) {
  if (project.stack !== "mern") {
    return {
      ...project,
      html: `${project.html || ""}\n${html}\n`,
      js: `${project.js || ""}\n${js}\n`
    };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Live.jsx";
  const pages = next.pages.some((page) => page.name === "Live")
    ? next.pages
    : [...next.pages, { name: "Live", path: "/live", file, auth: false }];
  const doc = buildDocument(html, js).doc;
  const source = `import React from "react";
const DOC = ${JSON.stringify(doc)};
export default function Live() {
  return (
    <main className="page">
      <p className="kicker">HTML · JS</p>
      <h1>Live</h1>
      <iframe title="Live" sandbox="allow-scripts allow-modals allow-forms" srcDoc={DOC} style={{ width: "100%", height: "70vh", border: 0, borderRadius: 12, background: "#fff" }} />
    </main>
  );
}
`;
  return {
    ...next,
    pages,
    files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) }
  };
}

function Pane({ label, value, onChange, onRun, accent }) {
  const gutter = useRef(null);
  const lines = value.split("\n").length;
  return (
    <div className="pane webjs-pane">
      <div className="webjs-head"><b style={{ color: accent }}>{label}</b><span className="muted">{lines} lines · {value.length} chars</span></div>
      <div className="editor">
        <div className="gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => <div key={index}>{index + 1}</div>)}
        </div>
        <textarea
          className="pad"
          value={value}
          spellCheck={false}
          wrap="off"
          aria-label={label}
          onScroll={(event) => { if (gutter.current) gutter.current.scrollTop = event.target.scrollTop; }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onRun();
              return;
            }
            if (event.key !== "Tab") return;
            event.preventDefault();
            const node = event.target;
            const start = node.selectionStart;
            const end = node.selectionEnd;
            onChange(value.slice(0, start) + "  " + value.slice(end));
            requestAnimationFrame(() => { node.selectionStart = node.selectionEnd = start + 2; });
          }}
        />
      </div>
    </div>
  );
}

export default function WebJsPage({ project, say, onApply }) {
  const initial = useMemo(readDraft, []);
  const [html, setHtml] = useState(initial.html);
  const [js, setJs] = useState(initial.js);
  const [starter, setStarter] = useState(initial.starter || "");
  const [live, setLive] = useState(true);
  const [delay, setDelay] = useState(350);
  const [device, setDevice] = useState("fill");
  const [split, setSplit] = useState("rows");
  const [keepLog, setKeepLog] = useState(false);
  const [run, setRun] = useState(1);
  const [built, setBuilt] = useState(() => buildDocument(initial.html, initial.js, 1));
  const [logs, setLogs] = useState([]);
  const frameRef = useRef(null);
  const runRef = useRef(1);
  const jsLineRef = useRef(built.jsLine);
  const keepLogRef = useRef(keepLog);
  keepLogRef.current = keepLog;

  function rebuild(nextHtml = html, nextJs = js) {
    const id = runRef.current + 1;
    runRef.current = id;
    const next = buildDocument(nextHtml, nextJs, id);
    jsLineRef.current = next.jsLine;
    setRun(id);
    setBuilt(next);
    if (!keepLogRef.current) setLogs([]);
  }

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ html, js, starter }));
    if (!live) return undefined;
    const timer = setTimeout(() => rebuild(), delay);
    return () => clearTimeout(timer);
  }, [html, js, live, delay]);

  useEffect(() => {
    function onMessage(event) {
      const data = event.data;
      if (!data || data.fray !== "webjs" || data.run !== runRef.current) return;
      if (frameRef.current && event.source !== frameRef.current.contentWindow) return;
      let text = String(data.text);
      if (text.includes("@@")) {
        const [message, line] = text.split("@@");
        const jsLine = Number(line) - jsLineRef.current + 1;
        text = jsLine > 0 ? `${message} (JS line ${jsLine})` : Number(line) ? `${message} (document line ${line})` : message;
      }
      const ts = new Date().toLocaleTimeString([], { hour12: false });
      setLogs((current) => [...current.slice(-299), { level: data.level, text, ts }]);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function loadStarter(item) {
    setHtml(item.html);
    setJs(item.js);
    setStarter(item.id);
    rebuild(item.html, item.js);
    say?.(`Loaded ${item.name}`);
  }

  function exportDoc() {
    const blob = new Blob([buildDocument(html, js).doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(project?.name || "fraymus").replace(/[^\w.-]+/g, "-")}-html-js.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say?.("Exported one .html file");
  }

  function openTab() {
    const blob = new Blob([buildDocument(html, js).doc], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  async function copyDoc() {
    try {
      await navigator.clipboard.writeText(buildDocument(html, js).doc);
      say?.("Copied the single-file HTML");
    } catch {
      say?.("Clipboard is blocked here — use Export instead");
    }
  }

  const errors = logs.filter((item) => item.level === "error").length;
  const width = device === "fill" ? "100%" : `${device}px`;

  return (
    <div className="tool webjs">
      <aside className="tool-side">
        <b>Starters</b>
        <span className="muted">Styled after the hand-drawn 3D CSS kit. Loading one replaces both panes.</span>
        {STARTERS.map((item) => (
          <button key={item.id} className={`chip webjs-starter${starter === item.id ? " on" : ""}`} onClick={() => loadStarter(item)}>
            <b>{item.name}</b>
            <span className="muted">{item.note}</span>
          </button>
        ))}
        <b style={{ marginTop: 6 }}>Preview</b>
        <label className="field">
          <span>Live update delay · {delay} ms</span>
          <input type="range" min="0" max="1500" step="50" value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
        </label>
        <label className="field"><span>Live preview</span><input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} /></label>
        <label className="field"><span>Keep console between runs</span><input type="checkbox" checked={keepLog} onChange={(event) => setKeepLog(event.target.checked)} /></label>
        <div className="note blue">HTML and JavaScript only. Put any styling in a &lt;style&gt; tag inside the HTML. ⌘/Ctrl + Enter runs now.</div>
      </aside>
      <section className="tool-main">
        <div className="codebar row">
          <b>HTML · JS</b>
          <span className="muted">{live ? `live · ${delay} ms` : "paused"} · run {run}</span>
          <span style={{ flex: 1 }} />
          <div className="seg">
            {[["rows", "Stack"], ["cols", "Side by side"]].map(([id, label]) => (
              <button key={id} className={split === id ? "on" : ""} onClick={() => setSplit(id)}>{label}</button>
            ))}
          </div>
          <button className="btn" onClick={() => rebuild()}>Run</button>
          <button className="btn" onClick={copyDoc}>Copy</button>
          <button className="btn" onClick={exportDoc}>Export .html</button>
          <button className="btn" onClick={openTab}>Open in tab</button>
          <button className="btn on" onClick={() => { onApply(applyWebJs(project, html, js)); say?.(project.stack === "mern" ? "Added a Live page at /live" : "Appended HTML and JS to the project"); }}>Place in project</button>
        </div>
        <div className={`webjs-body ${split}`}>
          <div className="webjs-code">
            <Pane label="HTML" accent="var(--pink)" value={html} onChange={setHtml} onRun={() => rebuild()} />
            <Pane label="JavaScript" accent="var(--acc)" value={js} onChange={setJs} onRun={() => rebuild()} />
          </div>
          <div className="webjs-view">
            <div className="webjs-head">
              <b>Preview</b>
              <div className="seg">
                {DEVICES.map(([id, label]) => (
                  <button key={id} className={device === id ? "on" : ""} onClick={() => setDevice(id)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="webjs-stage">
              <iframe
                ref={frameRef}
                key={run}
                title="HTML and JS preview"
                className="webjs-frame"
                style={{ width }}
                sandbox="allow-scripts allow-modals allow-forms allow-pointer-lock"
                srcDoc={built.doc}
              />
            </div>
          </div>
        </div>
      </section>
      <aside className="tool-side">
        <div className="row">
          <b>Console</b>
          <span className={errors ? "chip-err" : "muted"}>{errors ? `${errors} error${errors > 1 ? "s" : ""}` : `${logs.length} lines`}</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => setLogs([])}>Clear</button>
        </div>
        <div className="logs webjs-logs">
          {logs.length ? logs.map((item, index) => (
            <div key={index} className={`clog ${item.level === "log" ? "" : item.level}`}><span className="ts">{item.ts}</span>{item.text}</div>
          )) : <div className="clog muted">console.log output and errors from the preview show up here.</div>}
        </div>
        <b>Size</b>
        <span className="muted">HTML {new Blob([html]).size} B · JS {new Blob([js]).size} B · single file {new Blob([built.doc]).size} B</span>
      </aside>
    </div>
  );
}

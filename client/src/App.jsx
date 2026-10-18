import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CrudPage from "./tools/CrudPage.jsx";
import ReplPage from "./tools/ReplPage.jsx";
import CanvasPage from "./tools/CanvasPage.jsx";
import PixelPage from "./tools/PixelPage.jsx";
import StudioPage from "./tools/StudioPage.jsx";
import WebJsPage from "./tools/WebJsPage.jsx";
import EmojiPage from "./tools/EmojiPage.jsx";
import EmojiCoderPage from "./tools/EmojiCoderPage.jsx";
import DispatchPage from "./tools/DispatchPage.jsx";
import SealPage from "./tools/SealPage.jsx";
import BrainPage from "./tools/BrainPage.jsx";
import WasmPage from "./tools/WasmPage.jsx";
import MailPage from "./tools/MailPage.jsx";
import {
  BRAND,
  PHI,
  TABS,
  addPage,
  applyLibraryItem,
  blankProject,
  buildPreview,
  byteSize,
  defaultPackage,
  demoWasmB64,
  deployFiles,
  ensureMern,
  fileValue,
  formatBytes,
  languageFor,
  libraryItems,
  lineCount,
  mernProject,
  pairTarget,
  projectFiles,
  removePage,
  searchScore,
  singleFileHtml,
  splitHtml,
  tidy,
  uid,
  updatePage,
  wasmInfo,
  withFile
} from "./model.js";

const PHI_LINE = `${BRAND.phi} — ${BRAND.seed}`;

async function api(path, body, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "site";
}

function previewProject(project) {
  if (project.stack === "react") return { ...project, stack: "static", reactMode: true };
  return project;
}

function bundleFiles(project, html) {
  const files = projectFiles(project.stack === "react" ? { ...project, stack: "static" } : project);
  if (html) files["preview.html"] = html;
  if (project.stack !== "mern" && html) files["index.html"] = html;
  return files;
}

function CodeEditor({ fileKey, value, onChange, fontSize, tabSize, wrap, register }) {
  const gutter = useRef(null);
  const lines = String(value || "").split("\n");
  return (
    <div className="editor">
      <div className="gutter" ref={gutter} aria-hidden="true">
        {lines.map((_, index) => <div key={index}>{index + 1}</div>)}
      </div>
      <textarea
        className="pad"
        ref={(node) => register(fileKey, node)}
        value={value}
        spellCheck={false}
        wrap={wrap ? "soft" : "off"}
        style={{ fontSize }}
        onScroll={(event) => { if (gutter.current) gutter.current.scrollTop = event.target.scrollTop; }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          event.preventDefault();
          const el = event.target;
          const pad = " ".repeat(tabSize);
          const next = value.slice(0, el.selectionStart) + pad + value.slice(el.selectionEnd);
          onChange(next);
          const cursor = el.selectionStart + pad.length;
          requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = cursor; });
        }}
      />
    </div>
  );
}

function Modal({ title, wide, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={wide ? { width: "min(920px, 100%)" } : undefined} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [ready, setReady] = useState(false);
  const [apiUp, setApiUp] = useState(false);
  const [modal, setModal] = useState(null);
  const [welcome, setWelcome] = useState(false);
  const [tab, setTab] = useState("Components");
  const [query, setQuery] = useState("");
  const [activeFile, setActiveFile] = useState("html");
  const [pairOn, setPairOn] = useState(false);
  const [pairFile, setPairFile] = useState("css");
  const [device, setDevice] = useState("desktop");
  const [libOpen, setLibOpen] = useState(true);
  const [mobilePane, setMobilePane] = useState("code");
  const [narrow, setNarrow] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [serverLogs, setServerLogs] = useState([]);
  const [consoleInput, setConsoleInput] = useState("");
  const [wasmExports, setWasmExports] = useState([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewRev, setPreviewRev] = useState(0);
  const [previewMode, setPreviewMode] = useState("sandbox");
  const [renderMs, setRenderMs] = useState(0);
  const [settings, setSettings] = useState(() => {
    try { return { delay: 350, tabSize: 2, fontSize: 13, theme: "dark", wrap: false, ...JSON.parse(localStorage.getItem("fraymus-settings") || "{}") }; }
    catch { return { delay: 350, tabSize: 2, fontSize: 13, theme: "dark", wrap: false }; }
  });
  const [snapshots, setSnapshots] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [system, setSystem] = useState(null);
  const [runtime, setRuntime] = useState({ live: false, running: false, port: null, profile: null });
  const [vm, setVm] = useState({ profile: "live", port: 4180, maxMemory: 512, restart: false });
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdIndex, setCmdIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("session");
  const [bottom, setBottom] = useState("console");
  const [workspace, setWorkspace] = useState("studio");
  const [pageName, setPageName] = useState("");
  const [envDraft, setEnvDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const editorRefs = useRef({});
  const iframeRef = useRef(null);
  const fileRef = useRef(null);
  const project = projects.find((item) => item.id === activeId) || null;

  useEffect(() => { document.documentElement.dataset.theme = settings.theme; localStorage.setItem("fraymus-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const say = useCallback((type, text) => {
    setConsoleLogs((list) => [...list.slice(-399), { id: uid("l"), type, time: new Date().toLocaleTimeString(), text: String(text).slice(0, 4000) }]);
  }, []);

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        await api("/api/health", null, "GET");
        if (gone) return;
        setApiUp(true);
        setSystem(await api("/api/system", null, "GET"));
        const list = await api("/api/projects", null, "GET");
        if (!list.length) setWelcome(true);
        else {
          setProjects(list);
          setActiveId(list[0].id);
          setActiveFile(list[0].stack === "mern" ? "client/src/pages/Home.jsx" : "html");
          setEnvDraft(Object.entries(list[0].pkg?.env || {}).map(([key, value]) => `${key}=${value}`).join("\n"));
        }
      } catch {
        if (!gone) { setApiUp(false); setWelcome(true); }
      } finally {
        if (!gone) setReady(true);
      }
    })();
    return () => { gone = true; };
  }, []);

  function patch(mutator) {
    setProjects((list) => list.map((item) => {
      if (item.id !== activeId) return item;
      const next = typeof mutator === "function" ? mutator(item) : { ...item, ...mutator };
      return { ...next, updatedAt: Date.now() };
    }));
    setDirty(true);
    setSaveState(apiUp ? "saving" : "local");
  }

  useEffect(() => {
    if (!ready || !apiUp || !project) return undefined;
    const handle = setTimeout(async () => {
      try {
        await api("/api/projects/" + project.id, project, "PUT");
        setSaveState("saved");
      } catch {
        try { await api("/api/projects", project); setSaveState("saved"); }
        catch { setSaveState("local"); }
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [projects, ready, apiUp]);

  useEffect(() => {
    if (!project || !ready) return undefined;
    const handle = setTimeout(() => {
      const started = performance.now();
      const apiBase = previewMode === "live" ? `/live/${project.id}` : "";
      const assets = previewMode === "node" ? "local" : "studio";
      const html = buildPreview(previewProject(project), { apiBase, assets });
      setPreviewHtml(html);
      setRenderMs(performance.now() - started);
      if (previewMode === "sandbox" || !apiUp) return;
      api("/api/runtime/sync", {
        id: project.id,
        name: project.name,
        previewHtml: html,
        files: bundleFiles(project, html)
      }).then(() => setPreviewRev((value) => value + 1)).catch((error) => say("warn", error.message));
    }, settings.delay);
    return () => clearTimeout(handle);
  }, [project, previewMode, settings.delay, ready, apiUp, say]);

  useEffect(() => {
    if (!dirty || !project) return undefined;
    const handle = setTimeout(() => {
      setSnapshots((list) => [{ id: uid("s"), label: project.name, time: new Date().toLocaleTimeString(), data: JSON.parse(JSON.stringify(project)) }, ...list].slice(0, 20));
      setDirty(false);
    }, 2000);
    return () => clearTimeout(handle);
  }, [dirty, project]);

  useEffect(() => {
    function onMessage(event) {
      const data = event.data;
      if (!data || typeof data !== "object" || !data.fray) return;
      if (data.fray === "log") say(data.type || "log", (data.args || []).join(" "));
      if (data.fray === "wasm") setWasmExports(data.exports || []);
      if (data.fray === "eval-result") say(data.ok ? "ok" : "error", data.result);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [say]);

  useEffect(() => {
    if (!activeId || !apiUp) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const status = await api("/api/runtime/" + activeId, null, "GET");
        const logs = await api("/api/runtime/" + activeId + "/logs", null, "GET");
        if (!stop) { setRuntime(status); setServerLogs(logs); }
      } catch { /* server offline */ }
    };
    tick();
    const handle = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(handle); };
  }, [activeId, apiUp]);

  const files = useMemo(() => {
    if (!project || project.stack !== "mern") return ["html", "css", "js", "wasm"];
    return Object.keys(project.files || {}).filter((file) => file !== ".env" && file !== "package.json").sort();
  }, [project]);

  const visibleLibrary = useMemo(() => {
    return libraryItems
      .filter((item) => item.tab === tab)
      .map((item) => ({ item, score: searchScore(query, `${item.name} ${item.desc} ${item.id}`) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);
  }, [tab, query]);

  async function create(next) {
    setProjects((list) => [...list, next]);
    setActiveId(next.id);
    setActiveFile(next.stack === "mern" ? "client/src/pages/Home.jsx" : "html");
    setWelcome(false);
    setModal(null);
    setEnvDraft(Object.entries(next.pkg?.env || defaultPackage().env).map(([key, value]) => `${key}=${value}`).join("\n"));
    if (apiUp) {
      try { await api("/api/projects", next); setSaveState("saved"); }
      catch { setSaveState("local"); }
    }
    say("ok", "New project: " + next.name);
  }

  function insertItem(item) {
    if (!project) return;
    const cursor = editorRefs.current[activeFile]?.selectionStart;
    try {
      patch((current) => applyLibraryItem(current, item, activeFile, cursor));
      if (item.template && item.tab !== "MERN") setActiveFile("html");
      if (item.tab === "MERN" || item.kind) {
        setActiveFile(item.file || "client/src/pages/Home.jsx");
      }
      say("ok", "Inserted " + item.name);
    } catch (error) {
      say("error", error.message);
    }
  }

  async function runProfile(profile) {
    if (!project) return;
    if (!apiUp) { setNotice("The studio server is offline. Run npm run dev, then reload."); return; }
    if (profile === "browser") {
      setPreviewMode("sandbox");
      setNotice("Preview is back in the browser sandbox.");
      return;
    }
    const mode = profile === "live" ? "live" : "node";
    const html = buildPreview(previewProject(project), {
      apiBase: mode === "live" ? `/live/${project.id}` : "",
      assets: mode === "live" ? "studio" : "local"
    });
    const files = bundleFiles(project, html);
    if (profile === "docker") Object.assign(files, deployFiles(project, slugify(project.name)));
    try {
      const status = await api("/api/runtime/start", {
        id: project.id,
        profile,
        stack: project.stack === "react" ? "static" : project.stack,
        port: Number(vm.port) || 4180,
        maxMemory: Number(vm.maxMemory) || 512,
        restart: vm.restart,
        env: project.pkg?.env || {},
        entry: project.stack === "mern" ? "server/index.js" : ".fraymus-static.cjs",
        files,
        previewHtml: html,
        name: project.name
      });
      setPreviewHtml(html);
      setPreviewMode(mode);
      setRuntime(status);
      setPreviewRev((value) => value + 1);
      setTimeout(() => setPreviewRev((value) => value + 1), 800);
      setNotice(profile === "live" ? `Live server: /live/${project.id}/` : `${profile} runtime: ${status.url}`);
      say("ok", profile + " started");
    } catch (error) {
      setNotice(error.message);
      say("error", error.message);
    }
  }

  async function stopProfile(profile) {
    if (!project || !apiUp) return;
    const status = await api("/api/runtime/stop", { id: project.id, profile });
    setRuntime(status);
    if (profile === "live" || previewMode !== "sandbox") setPreviewMode("sandbox");
    say("info", "Stopped " + (profile || "runtime"));
  }

  function runConsole() {
    const code = consoleInput.trim();
    if (!code) return;
    if (code === "fray") { say("ok", PHI_LINE); setConsoleInput(""); return; }
    iframeRef.current?.contentWindow?.postMessage({ fray: "eval", id: uid("e"), code }, "*");
    setConsoleInput("");
  }

  async function onImport(fileList) {
    if (!project) return;
    for (const file of fileList) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const text = ext === "wasm" ? "" : await file.text();
      if (ext === "wasm") {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        patch((current) => ({ ...current, wasmB64: btoa(binary), wasmName: file.name }));
        say("ok", "Loaded " + file.name);
      } else if (ext === "json") {
        const data = JSON.parse(text);
        if (data.format === "fraymus-studio/2") {
          patch(() => ({ ...data.project, id: project.id }));
        } else {
          patch((current) => ({
            ...current,
            name: data.name || current.name,
            html: data.html || "",
            css: data.css || "",
            js: data.js || "",
            wasmB64: data.wasmB64 || "",
            reactMode: !!data.reactMode,
            tailwind: !!data.tailwind
          }));
        }
        say("ok", "Imported " + file.name);
      } else if (ext === "html") {
        const parts = splitHtml(text);
        patch((current) => ({ ...current, ...parts, stack: "static" }));
        setActiveFile("html");
      } else if (ext === "css") patch((current) => withFile(current, "css", text));
      else if (["js", "jsx", "mjs"].includes(ext)) patch((current) => withFile(current, "js", text));
      else say("warn", "Skipped " + file.name);
    }
    setModal(null);
  }

  async function exportZip(kind) {
    if (!project) return;
    const html = singleFileHtml(previewProject(project));
    const files = kind === "static"
      ? { "index.html": html, "styles.css": project.css || "", "app.js": project.js || "" }
      : { ...bundleFiles(project, html), "index.html": html };
    if (kind === "publish") Object.assign(files, deployFiles(project, slugify(project.name)));
    const res = await fetch("/api/export/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: project.name + "-" + kind, files })
    });
    if (!res.ok) { setNotice("Export failed"); return; }
    download(slugify(project.name) + "-" + kind + ".zip", await res.blob(), "application/zip");
    say("ok", "Exported " + kind + " zip");
  }

  async function publish() {
    if (!project) return;
    const slug = slugify(project.name);
    const html = buildPreview(previewProject(project), { apiBase: "", assets: "local" });
    const files = { ...bundleFiles(project, html), ...deployFiles(project, slug), "index.html": singleFileHtml(previewProject(project)) };
    try {
      const result = await api("/api/publish", { slug, files });
      setNotice("Published to " + result.url);
      window.open(result.url, "_blank", "noopener");
      say("ok", "Published " + result.url);
    } catch (error) {
      setNotice(error.message);
    }
  }

  const actions = useMemo(() => {
    if (!project) return [];
    return [
      ["New static project", () => create(blankProject())],
      ["New MERN app", () => create(mernProject("mern-app"))],
      ["Duplicate", () => create({ ...JSON.parse(JSON.stringify(project)), id: uid(), name: project.name + " copy" })],
      ["Import…", () => setModal("import")],
      ["Export HTML", () => download(slugify(project.name) + ".html", singleFileHtml(previewProject(project)), "text/html")],
      ["Export JSON", () => download(slugify(project.name) + ".fraymus.json", JSON.stringify({ format: "fraymus-studio/2", project }, null, 2), "application/json")],
      ["Export static zip", () => exportZip("static")],
      ["Export project zip", () => exportZip("project")],
      ["Publish locally", publish],
      ["Start live server", () => runProfile("live")],
      ["Start Node", () => runProfile("node")],
      ["Browser sandbox", () => runProfile("browser")],
      ["Pair files", () => { setPairOn((value) => !value); setPairFile(pairTarget(project, activeFile)); }],
      ["Toggle Tailwind", () => patch((current) => ({ ...current, tailwind: !current.tailwind }))],
      ["Format pane", () => patch((current) => withFile(current, activeFile, tidy(fileValue(current, activeFile))))],
      ["Settings", () => setModal("settings")],
      ["Help", () => setModal("help")]
    ].map(([label, run]) => ({ id: label, label, run }));
  }, [project, activeFile]);

  const palette = useMemo(() => {
    const acts = actions.map((action) => ({ kind: "action", score: searchScore(cmdQuery, action.label), action }));
    const libs = libraryItems.map((item) => ({ kind: "lib", score: searchScore(cmdQuery, item.name + " " + item.tab), item }));
    return [...acts, ...libs].filter((entry) => entry.score >= 0).sort((a, b) => b.score - a.score).slice(0, 30);
  }, [actions, cmdQuery]);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("cmd"); setCmdQuery(""); setCmdIndex(0); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); setModal("export"); }
      else if (event.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let depth = 0;
    const enter = (event) => { event.preventDefault(); depth += 1; setDragging(true); };
    const leave = (event) => { event.preventDefault(); depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const over = (event) => event.preventDefault();
    const drop = (event) => { event.preventDefault(); depth = 0; setDragging(false); if (event.dataTransfer.files?.length) onImport(event.dataTransfer.files); };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave); window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
  }, [project]);

  function setStack(stack) {
    patch((current) => {
      if (stack === "mern") return { ...ensureMern(current), stack: "mern" };
      if (stack === "react") return { ...current, stack: "react", reactMode: true };
      return { ...current, stack: "static", reactMode: false };
    });
    setActiveFile(stack === "mern" ? "client/src/pages/Home.jsx" : "html");
  }

  const showLib = !narrow || mobilePane === "lib";
  const showCode = !narrow || mobilePane === "code";
  const showPreview = !narrow || mobilePane === "preview";
  const width = device === "tablet" ? "768px" : device === "mobile" ? "390px" : "100%";
  const size = project ? byteSize(JSON.stringify(project)) : 0;
  const wasm = project ? wasmInfo(project.wasmB64) : null;

  function pane(file, label) {
    if (!project) return null;
    return (
      <section className="pane" key={file}>
        <div className="codebar">
          <b>{label || file}</b>
          <span className="muted">{languageFor(file, project)} · {lineCount(fileValue(project, file))} ln</span>
          <span className="spacer" />
          <button className="icon" title="Format" onClick={() => patch((current) => withFile(current, file, tidy(fileValue(current, file))))}>Fmt</button>
          <button className="icon" title="Copy" onClick={() => navigator.clipboard.writeText(fileValue(project, file))}>Copy</button>
        </div>
        {file === "wasm" && (
          <div className="codebar">
            <button className="btn" onClick={() => fileRef.current?.click()}>Upload .wasm</button>
            <button className="btn" onClick={() => patch((current) => ({ ...current, wasmB64: demoWasmB64(), wasmName: "demo-b8.wasm" }))}>Load demo</button>
            <span className="muted">{wasm ? wasm.msg : "empty"}</span>
          </div>
        )}
        <CodeEditor
          fileKey={file}
          value={fileValue(project, file)}
          fontSize={settings.fontSize}
          tabSize={settings.tabSize}
          wrap={settings.wrap}
          register={(key, node) => { editorRefs.current[key] = node; }}
          onChange={(value) => patch((current) => file === "wasm" ? { ...current, wasmB64: value } : withFile(current, file, value))}
        />
      </section>
    );
  }

  return (
    <div className="studio">
      <div className="phi" />
      <header className="top">
        <a className="brand" href="#about" onClick={(event) => { event.preventDefault(); setModal("about"); }}>
          <span className="mark">◈</span>
          <div>
            <b>FRAYMUS <span>WEB STUDIO</span></b>
            <small className="hide-mobile">Static · React · MERN · live server</small>
          </div>
        </a>
        <input className="name" value={project?.name || ""} onChange={(event) => patch({ name: event.target.value })} spellCheck={false} aria-label="Project name" />
        <div className="seg" title="Stack">
          {["static", "react", "mern"].map((stack) => (
            <button key={stack} className={project?.stack === stack ? "on" : ""} onClick={() => setStack(stack)}>{stack}</button>
          ))}
        </div>
        <button className={`btn ${pairOn ? "on" : ""}`} onClick={() => { setPairOn((value) => !value); if (project) setPairFile(pairTarget(project, activeFile)); }}>Pair</button>
        <span className="spacer" />
        <button className="btn" onClick={() => setModal("import")}>Import</button>
        <button className="btn" onClick={() => setModal("export")}>Export</button>
        <button className="btn" onClick={() => setModal("publish")}>Publish</button>
        <button className={`btn ${previewMode === "live" ? "on" : ""}`} onClick={() => previewMode === "live" ? stopProfile("live") : runProfile("live")}><i className={`dot ${runtime.live ? "on" : ""}`} /> Live</button>
        <button className="btn" onClick={() => setModal("node")}>Node</button>
        <button className="btn" onClick={() => setModal("vm")}>VM</button>
        <button className="btn" onClick={() => { setModal("cmd"); setCmdQuery(""); }}>⌘K</button>
        <button className="icon" onClick={() => setModal("settings")} aria-label="Settings">⚙</button>
      </header>
      <div className="top" style={{ paddingTop: 0 }}>
        <div className="seg">
          {[["studio", "Code"], ["crud", "CRUD"], ["repl", "REPL"], ["canvas", "Canvas"], ["pixel", "8-bit"], ["production", "Production"], ["seal", "Seal"], ["brain", "Brain"], ["webjs", "HTML·JS"], ["emoji", "Emoji"], ["coder", "Emoji Coder"], ["dispatch", "Dispatch"], ["wasm", "WASM"], ["mail", "Mail"]].map(([id, label]) => (
            <button key={id} className={workspace === id ? "on" : ""} onClick={() => setWorkspace(id)}>{label}</button>
          ))}
        </div>
        <span className="muted">{workspace === "mail" ? "Gmail or the local mailbox: read, send, import, export" : workspace === "wasm" ? "FrayVM → bytecode → WebAssembly → one emoji" : workspace === "dispatch" ? "Signed emoji payloads: compose, verify, run, mail" : workspace === "brain" ? "Ouroboros 5-Stage Quantum RSI + Centripetal Memory + Wolfram Rule 30" : workspace === "seal" ? "Signed talking avatar + voice + Merkle proof inside one emoji" : workspace === "coder" ? "Emoji markup to HTML, CSS, JavaScript, and Java" : workspace === "emoji" ? "Text ↔ glyph ↔ DNA ↔ zero-width" : workspace === "webjs" ? "HTML and JavaScript, live preview" : workspace === "production" ? "Add a face, animate it with a voice, then add another face" : workspace === "pixel" ? "Photo to 8-bit character" : workspace === "canvas" ? "Blocks, cube grid, entity components" : workspace === "repl" ? "JavaScript and DOM" : workspace === "crud" ? "GET POST PUT PATCH DELETE" : "Editor"}</span>
      </div>
      {narrow && workspace === "studio" && (
        <div className="mobile-switch seg">
          {["lib", "code", "preview"].map((paneName) => <button key={paneName} className={mobilePane === paneName ? "on" : ""} onClick={() => setMobilePane(paneName)}>{paneName}</button>)}
        </div>
      )}
      {notice && <div className="note" style={{ margin: "8px 12px 0" }}>{notice}</div>}
      {workspace === "crud" && project && <CrudPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "repl" && <ReplPage />}
      {workspace === "canvas" && project && <CanvasPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "pixel" && <PixelPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "production" && <StudioPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "seal" && <SealPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "brain" && <BrainPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "webjs" && project && <WebJsPage project={project} say={say} onApply={(next) => next && patch(() => next)} />}
      {workspace === "emoji" && project && <EmojiPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "coder" && project && <EmojiCoderPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "dispatch" && project && <DispatchPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "wasm" && project && <WasmPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "mail" && project && <MailPage project={project} say={say} onApply={(next) => patch(() => next)} />}
      {workspace === "studio" && <div className="workspace">
        {showLib && libOpen && (
          <aside className="library">
            <div className="libhead">
              <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" />
            </div>
            <div className="tabs">{TABS.map((name) => <button key={name} className={`ltab ${tab === name ? "on" : ""}`} onClick={() => setTab(name)}>{name}</button>)}</div>
            <div className="items">
              {visibleLibrary.map(({ item }) => (
                <button key={item.id} className="lib-item" onClick={() => insertItem(item)}>
                  <b>{item.template ? "▣ " : "+ "}{item.name}</b>
                  <span>{item.desc}</span>
                </button>
              ))}
              {visibleLibrary.length === 0 && <div className="muted">No matches.</div>}
            </div>
          </aside>
        )}
        {showCode && project && (
          <section className="code">
            <div className="codebar">
              {project.stack === "mern" ? <span className="muted">MERN files</span> : (
                <div className="ptabs">
                  {files.map((file) => <button key={file} className={`ptab ${activeFile === file ? "on" : ""}`} onClick={() => setActiveFile(file)}>{file === "js" && project.stack === "react" ? "JSX" : file.toUpperCase()}</button>)}
                </div>
              )}
              <span className="spacer" />
              <button className="btn" onClick={() => setModal("projects")}>Projects</button>
              {project.stack === "mern" && <button className="btn" onClick={() => setModal("pages")}>Pages</button>}
              <button className="icon" title="Word wrap" onClick={() => setSettings((current) => ({ ...current, wrap: !current.wrap }))}>↵</button>
            </div>
            <div className="editors">
              {project.stack === "mern" && (
                <div className="tree">
                  {files.map((file) => <button key={file} className={file === activeFile ? "on" : ""} onClick={() => setActiveFile(file)}>{file}</button>)}
                </div>
              )}
              <div className={pairOn ? "editors pair" : "editors"} style={{ flex: 1 }}>
                {pane(activeFile, activeFile)}
                {pairOn && pane(pairFile, pairFile)}
              </div>
            </div>
            {pairOn && (
              <div className="codebar">
                <span className="muted">Paired with</span>
                <select className="search" style={{ width: 280 }} value={pairFile} onChange={(event) => setPairFile(event.target.value)}>
                  {files.filter((file) => file !== activeFile).map((file) => <option key={file}>{file}</option>)}
                </select>
              </div>
            )}
          </section>
        )}
        {showPreview && (
          <section className="preview">
            <div className="previewbar">
              <b>Preview</b>
              <span className="muted">{previewMode} · {device}</span>
              <span className="spacer" />
              <div className="seg">
                {["desktop", "tablet", "mobile"].map((name) => <button key={name} className={device === name ? "on" : ""} onClick={() => setDevice(name)}>{name[0].toUpperCase()}</button>)}
              </div>
              <button className="btn" onClick={() => setPreviewRev((value) => value + 1)}>Reload</button>
              <button className="btn" onClick={() => {
                const url = previewMode === "node" ? `http://127.0.0.1:${vm.port}/` : previewMode === "live" && project ? `/live/${project.id}/` : null;
                if (url) window.open(url, "_blank", "noopener");
                else {
                  const blob = URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
                  window.open(blob, "_blank", "noopener");
                }
              }}>Open</button>
            </div>
            <div className="stage">
              <div className="frame" style={{ width }}>
                {previewMode === "sandbox" ? (
                  <iframe ref={iframeRef} title="preview" sandbox="allow-scripts allow-same-origin allow-modals allow-popups" srcDoc={previewHtml} />
                ) : (
                  <iframe ref={iframeRef} title="preview" key={previewRev} src={previewMode === "live" && project ? `/live/${project.id}/?v=${previewRev}` : `http://127.0.0.1:${vm.port}/?v=${previewRev}`} />
                )}
              </div>
            </div>
            <div className="console">
              <div className="codebar">
                <button className={`ptab ${bottom === "console" ? "on" : ""}`} onClick={() => setBottom("console")}>Console</button>
                <button className={`ptab ${bottom === "server" ? "on" : ""}`} onClick={() => setBottom("server")}>Server</button>
                <span className="spacer" />
                {wasmExports.map((name) => (
                  <button key={name} className="btn" onClick={() => iframeRef.current?.contentWindow?.postMessage({ fray: "call", name, args: [] }, "*")}>{name}()</button>
                ))}
                <button className="icon" onClick={() => setConsoleLogs([])}>✕</button>
              </div>
              {bottom === "console" ? (
                <>
                  <div className="scroll">
                    {consoleLogs.length === 0 && <div className="muted" style={{ padding: 12 }}>Preview logs land here. Type fray and press Enter.</div>}
                    {consoleLogs.map((entry) => <div key={entry.id} className={`clog ${entry.type}`}><span className="ts">{entry.time}</span>{entry.text}</div>)}
                  </div>
                  <form onSubmit={(event) => { event.preventDefault(); runConsole(); }}>
                    <input value={consoleInput} onChange={(event) => setConsoleInput(event.target.value)} placeholder="eval in preview" spellCheck={false} />
                    <button className="btn" type="submit">Run</button>
                  </form>
                </>
              ) : (
                <div className="logs">
                  {serverLogs.length === 0 && <div className="muted">Server logs appear after Live, Node, or VM start.</div>}
                  {serverLogs.map((entry, index) => <div key={index} className="clog">{entry.line}</div>)}
                </div>
              )}
            </div>
          </section>
        )}
      </div>}
      <footer className="foot">
        <span>stack <b>{project?.stack || "—"}</b></span>
        <span>render <b>{renderMs.toFixed(1)}ms</b></span>
        <span>size <b>{formatBytes(size)}</b></span>
        <span>φ <b>{((size * PHI) % 1).toFixed(4)}</b></span>
        <span>errors <b>{consoleLogs.filter((entry) => entry.type === "error").length}</b></span>
        <span>{saveState === "saved" ? "saved to disk" : saveState === "saving" ? "saving" : apiUp ? "session" : "server offline"}</span>
        <span className="spacer" />
        <a href="#copyright" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.copyright}</a>
        <a href="#phi" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.phi}</a>
        <a href="#seed" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.seed}</a>
        <a href="#fray" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.hex}</a>
        <button className="btn" onClick={() => setModal("help")}>Help</button>
      </footer>
      <input ref={fileRef} hidden type="file" accept=".html,.css,.js,.jsx,.mjs,.json,.wasm" multiple onChange={(event) => { if (event.target.files?.length) onImport(event.target.files); event.target.value = ""; }} />
      {dragging && <div className="drop">Drop HTML, CSS, JS, JSON, or WASM</div>}

      {welcome && (
        <div className="modal-back">
          <div className="modal welcome">
            <div className="mark" style={{ fontSize: 36 }}>◈</div>
            <h2>Fraymus Web Studio</h2>
            <p className="muted">Pick a starting point. Projects save on disk while the studio server is running.</p>
            <p><a href="#copyright" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.copyright}</a> · <a href="#phi" onClick={(event) => { event.preventDefault(); setModal("about"); }}>{BRAND.phi}</a></p>
            <div className="welcome-grid">
              <button className="card" onClick={() => create(blankProject())}><b>Blank canvas</b><span className="muted">HTML, CSS, and JS</span></button>
              <button className="card" onClick={() => {
                const template = libraryItems.find((item) => item.id === "tpl-portfolio");
                const next = blankProject("portfolio");
                create(template ? applyLibraryItem(next, template, "html") : next);
              }}><b>Portfolio</b><span className="muted">Template from your library</span></button>
              <button className="card" onClick={() => create(mernProject("mern-app"))}><b>MERN app</b><span className="muted">Pages, Express, Mongo model</span></button>
            </div>
          </div>
        </div>
      )}

      {modal === "export" && project && (
        <Modal title="Export" onClose={() => setModal(null)}>
          <div className="stack export-list">
            <button className="btn" onClick={() => download(slugify(project.name) + ".html", singleFileHtml(previewProject(project)), "text/html")}>Single-file HTML</button>
            <button className="btn" onClick={() => download(slugify(project.name) + ".fraymus.json", JSON.stringify({ format: "fraymus-studio/2", project }, null, 2), "application/json")}>Project JSON</button>
            <button className="btn" onClick={() => exportZip("static")}>Static site zip</button>
            <button className="btn" onClick={() => exportZip("project")}>Full project zip</button>
            <button className="btn" onClick={() => exportZip("publish")}>Publish bundle — Vercel, Netlify, Docker, nginx</button>
          </div>
        </Modal>
      )}

      {modal === "publish" && project && (
        <Modal title="Publish" onClose={() => setModal(null)}>
          <div className="stack">
            <p className="note blue">Local publish writes the site under /published and opens it. The MERN API still needs Node or the live server; a static host serves the page only.</p>
            <div className="field"><span>Slug</span><input value={slugify(project.name)} readOnly /></div>
            <button className="btn" onClick={publish}>Publish locally and open</button>
            <button className="btn" onClick={() => exportZip("publish")}>Download deploy bundle</button>
            <pre className="logs">{deployFiles(project, slugify(project.name))["DEPLOY.txt"]}</pre>
          </div>
        </Modal>
      )}

      {modal === "node" && project && (
        <Modal title="Node" wide onClose={() => setModal(null)}>
          <div className="stack">
            <div className="grid-2">
              <div className="card"><b>Node</b><span className="muted">{system?.node || "…"}</span></div>
              <div className="card"><b>npm</b><span className="muted">{system?.npm || "…"}</span></div>
              <div className="card"><b>Process</b><span className="muted">{runtime.running && runtime.profile === "node" ? `pid ${runtime.pid} · :${runtime.port}` : "stopped"}</span></div>
              <div className="card"><b>Mongo</b><span className="muted">{system?.mongo || "off"} — set MONGODB_URI to connect</span></div>
            </div>
            <div className="field">
              <span>Environment</span>
              <textarea rows={5} value={envDraft} onChange={(event) => setEnvDraft(event.target.value)} onBlur={() => {
                const env = {};
                envDraft.split("\n").forEach((line) => {
                  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
                  if (match) env[match[1]] = match[2];
                });
                patch((current) => ({ ...current, pkg: { ...(current.pkg || defaultPackage(current.name)), env } }));
              }} />
            </div>
            <div className="field">
              <span>Scripts</span>
              <textarea rows={4} value={JSON.stringify(project.pkg?.scripts || {}, null, 2)} onChange={(event) => {
                try { patch((current) => ({ ...current, pkg: { ...(current.pkg || defaultPackage()), scripts: JSON.parse(event.target.value) } })); }
                catch { /* wait for valid json */ }
              }} />
            </div>
            <div className="top" style={{ padding: 0 }}>
              <button className="btn on" onClick={() => runProfile("node")}>Start Node app</button>
              <button className="btn" onClick={() => stopProfile("node")}>Stop</button>
              <button className="btn" onClick={async () => {
                try {
                  const html = buildPreview(previewProject(project), { assets: "local" });
                  await api("/api/runtime/sync", { id: project.id, name: project.name, previewHtml: html, files: bundleFiles(project, html) });
                  await api("/api/node/install", { id: project.id });
                  say("info", "npm install started");
                } catch (error) { say("error", error.message); }
              }}>npm install</button>
              {Object.keys(project.pkg?.scripts || {}).map((script) => (
                <button key={script} className="btn" onClick={() => api("/api/node/script", { id: project.id, script }).catch((error) => say("error", error.message))}>npm run {script}</button>
              ))}
            </div>
            <p className="note">MERN runs server/index.js with Express. Static and React projects get a small file server. Page edits reload with the preview. Restart Node after server file edits. Dependencies resolve from the studio install; npm install writes a local node_modules too.</p>
            <div className="logs">{serverLogs.slice(-40).map((entry, index) => <div key={index}>{entry.line}</div>)}</div>
          </div>
        </Modal>
      )}

      {modal === "vm" && project && (
        <Modal title="VM" wide onClose={() => setModal(null)}>
          <div className="stack">
            <div className="cards">
              {[
                ["browser", "Browser", "Sandboxed iframe. No process."],
                ["live", "Live server", "This app serves the preview and a demo API."],
                ["node", "Node process", "A local Node process on the port below."],
                ["docker", "Docker", system?.docker ? system.docker : "Docker not found"]
              ].map(([id, title, copy]) => (
                <button key={id} className={`card ${vm.profile === id ? "on" : ""}`} onClick={() => setVm((current) => ({ ...current, profile: id }))}>
                  <b>{title}</b><span className="muted">{copy}</span>
                </button>
              ))}
            </div>
            <div className="grid-2">
              <label className="field">Port<input type="number" value={vm.port} min={1024} max={65535} onChange={(event) => setVm((current) => ({ ...current, port: Number(event.target.value) }))} /></label>
              <label className="field">Memory {vm.maxMemory} MB<input type="range" min={128} max={2048} step={128} value={vm.maxMemory} onChange={(event) => setVm((current) => ({ ...current, maxMemory: Number(event.target.value) }))} /></label>
            </div>
            <label className="muted"><input type="checkbox" checked={vm.restart} onChange={(event) => setVm((current) => ({ ...current, restart: event.target.checked }))} /> Restart the Node process if it exits</label>
            <div className="top" style={{ padding: 0 }}>
              <button className="btn on" onClick={() => runProfile(vm.profile)}>Start {vm.profile}</button>
              <button className="btn" onClick={() => stopProfile(vm.profile === "live" ? "live" : "node")}>Stop</button>
            </div>
            <p className="note blue">These runtimes stay on 127.0.0.1. Docker publishes the same way. Memory is Node’s old-space limit, not a hardware VM.</p>
            <div className="logs">{serverLogs.slice(-30).map((entry, index) => <div key={index}>{entry.line}</div>)}</div>
          </div>
        </Modal>
      )}

      {modal === "pages" && project?.stack === "mern" && (
        <Modal title="MERN pages" onClose={() => setModal(null)}>
          <div className="stack">
            <p className="note">Adding or removing a page rewrites the nav in client/src/App.jsx. Page files stay editable.</p>
            {project.pages.map((page) => (
              <div key={page.name} className="card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <b style={{ width: 110 }}>{page.name}</b>
                <input value={page.path} onChange={(event) => patch((current) => updatePage(current, page.name, { path: event.target.value }))} />
                <label className="muted"><input type="checkbox" checked={page.auth} onChange={(event) => patch((current) => updatePage(current, page.name, { auth: event.target.checked }))} /> auth</label>
                <button className="btn danger" onClick={() => { try { patch((current) => removePage(current, page.name)); } catch (error) { say("error", error.message); } }}>Remove</button>
              </div>
            ))}
            <form className="top" style={{ padding: 0 }} onSubmit={(event) => {
              event.preventDefault();
              try { patch((current) => addPage(current, pageName)); setPageName(""); say("ok", "Added " + pageName); }
              catch (error) { say("error", error.message); }
            }}>
              <input value={pageName} onChange={(event) => setPageName(event.target.value)} placeholder="Reports" />
              <button className="btn" type="submit">Add page</button>
            </form>
          </div>
        </Modal>
      )}

      {modal === "projects" && (
        <Modal title="Projects" onClose={() => setModal(null)}>
          <div className="stack">
            {projects.map((item) => (
              <div key={item.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button className="btn" onClick={() => { setActiveId(item.id); setActiveFile(item.stack === "mern" ? "client/src/pages/Home.jsx" : "html"); setModal(null); }}>{item.id === activeId ? "● " : "○ "}{item.name}</button>
                <span className="muted">{item.stack}</span>
                <button className="btn danger" disabled={projects.length < 2} onClick={async () => {
                  setProjects((list) => list.filter((entry) => entry.id !== item.id));
                  if (item.id === activeId) {
                    const rest = projects.find((entry) => entry.id !== item.id);
                    setActiveId(rest?.id || null);
                  }
                  if (apiUp) await api("/api/projects/" + item.id, null, "DELETE").catch(() => {});
                }}>Delete</button>
              </div>
            ))}
            <div className="top" style={{ padding: 0 }}>
              <button className="btn" onClick={() => create(blankProject())}>New static</button>
              <button className="btn" onClick={() => create(mernProject("mern-app"))}>New MERN</button>
              <button className="btn" onClick={() => setModal("snaps")}>Snapshots</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "snaps" && (
        <Modal title="Snapshots" onClose={() => setModal(null)}>
          <div className="stack">
            {snapshots.length === 0 && <div className="muted">Snapshots are kept for this session, about two seconds after an edit.</div>}
            {snapshots.map((snap) => (
              <div key={snap.id} className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{snap.label} <span className="muted">{snap.time}</span></span>
                <button className="btn" onClick={() => { patch(() => ({ ...snap.data, id: activeId })); setModal(null); say("ok", "Restored snapshot"); }}>Restore</button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="Import" onClose={() => setModal(null)}>
          <div className="stack">
            <p className="note blue">Files stay on this machine. HTML is split into panes. JSON accepts this studio’s format and the original Fraymus project file.</p>
            <button className="btn" onClick={() => fileRef.current?.click()}>Choose files</button>
          </div>
        </Modal>
      )}

      {modal === "settings" && (
        <Modal title="Settings" onClose={() => setModal(null)}>
          <div className="stack">
            <label className="field">Render delay {settings.delay}ms<input type="range" min={100} max={1000} step={50} value={settings.delay} onChange={(event) => setSettings((current) => ({ ...current, delay: Number(event.target.value) }))} /></label>
            <label className="field">Tab size {settings.tabSize}<input type="range" min={2} max={8} step={2} value={settings.tabSize} onChange={(event) => setSettings((current) => ({ ...current, tabSize: Number(event.target.value) }))} /></label>
            <label className="field">Font size {settings.fontSize}px<input type="range" min={11} max={20} value={settings.fontSize} onChange={(event) => setSettings((current) => ({ ...current, fontSize: Number(event.target.value) }))} /></label>
            <div className="seg">
              <button className={settings.theme === "dark" ? "on" : ""} onClick={() => setSettings((current) => ({ ...current, theme: "dark" }))}>Dark</button>
              <button className={settings.theme === "light" ? "on" : ""} onClick={() => setSettings((current) => ({ ...current, theme: "light" }))}>Light</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "help" && (
        <Modal title="Help" onClose={() => setModal(null)}>
          <div className="stack">
            <div><span className="kbd">⌘/Ctrl K</span> command palette</div>
            <div><span className="kbd">⌘/Ctrl S</span> export</div>
            <div><span className="kbd">Esc</span> close a panel</div>
            <p>Static and React edit HTML, CSS, and JS with a live sandbox. MERN adds pages, an Express API, and a Mongoose Item model. Live serves that preview from this app. Node runs it as its own process. VM picks browser, live, Node, or Docker.</p>
            <p className="muted">Start the studio with npm run dev. The UI is on port 5173 and the API is on 4177.</p>
            <p>{BRAND.copyright} · {PHI_LINE} · {BRAND.hex}</p>
          </div>
        </Modal>
      )}

      {modal === "about" && (
        <Modal title="Fraymus" onClose={() => setModal(null)}>
          <div className="stack">
            <p id="copyright"><b>{BRAND.copyright}</b></p>
            <p id="phi">{BRAND.phi}</p>
            <p id="seed">{BRAND.seed}</p>
            <p id="fray">{BRAND.hex}</p>
            <p className="muted">The mark is ◈. The seed line is the studio brand. FRAY is the four bytes 0x46 0x52 0x41 0x59.</p>
            <div className="row">
              <a className="btn" href="#code" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("studio"); }}>Code</a>
              <a className="btn" href="#crud" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("crud"); }}>CRUD</a>
              <a className="btn" href="#repl" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("repl"); }}>REPL</a>
              <a className="btn" href="#canvas" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("canvas"); }}>Canvas</a>
              <a className="btn" href="#pixel" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("pixel"); }}>8-bit</a>
              <a className="btn" href="#webjs" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("webjs"); }}>HTML·JS</a>
              <a className="btn" href="#emoji" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("emoji"); }}>Emoji</a>
              <a className="btn" href="#coder" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("coder"); }}>Emoji Coder</a>
              <a className="btn" href="#dispatch" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("dispatch"); }}>Dispatch</a>
              <a className="btn" href="#wasm" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("wasm"); }}>WASM</a>
              <a className="btn" href="#mail" onClick={(event) => { event.preventDefault(); setModal(null); setWorkspace("mail"); }}>Mail</a>
              <a className="btn" href="#help" onClick={(event) => { event.preventDefault(); setModal("help"); }}>Help</a>
              <a className="btn" href="https://cursor.com/codebase/vaughn-scott/fraymus-css" target="_blank" rel="noreferrer">Repository</a>
            </div>
          </div>
        </Modal>
      )}

      {modal === "cmd" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <input autoFocus className="search" value={cmdQuery} placeholder="Search actions and library" onChange={(event) => { setCmdQuery(event.target.value); setCmdIndex(0); }} onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setCmdIndex((value) => Math.min(palette.length - 1, value + 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setCmdIndex((value) => Math.max(0, value - 1)); }
              if (event.key === "Enter" && palette[cmdIndex]) {
                const entry = palette[cmdIndex];
                setModal(null);
                if (entry.kind === "action") entry.action.run();
                else insertItem(entry.item);
              }
            }} />
            <div className="items">
              {palette.map((entry, index) => (
                <button key={entry.kind + (entry.action?.id || entry.item?.id)} className="lib-item" style={index === cmdIndex ? { borderColor: "var(--acc)" } : undefined} onMouseEnter={() => setCmdIndex(index)} onClick={() => { setModal(null); entry.kind === "action" ? entry.action.run() : insertItem(entry.item); }}>
                  <b>{entry.kind === "action" ? entry.action.label : entry.item.name}</b>
                  <span>{entry.kind === "action" ? "action" : entry.item.tab}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

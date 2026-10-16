import library from "./library.json";
import serverIndex from "./scaffold/server-index.js?raw";
import routesApi from "./scaffold/routes-api.js?raw";
import modelItem from "./scaffold/model-item.js?raw";
import pageHome from "./scaffold/page-home.jsx?raw";
import pageDashboard from "./scaffold/page-dashboard.jsx?raw";
import pageLogin from "./scaffold/page-login.jsx?raw";
import pageSettings from "./scaffold/page-settings.jsx?raw";
import siteCss from "./scaffold/site.css?raw";

export const TABS = ["Components", "CSS", "Tailwind", "Shadcn", "Graphics", "3D", "Templates", "Assets", "MERN"];
export const DEMO_WASM = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 127, 3, 2, 1, 0, 7, 8, 1, 4, 109, 97, 105, 110, 0, 0, 10, 9, 1, 7, 0, 65, 10, 65, 5, 106, 11];
export const PHI = 1.61803398875;
export const BRAND = {
  name: "Fraymus Web Studio",
  mark: "◈",
  copyright: "© 2026 Fraymus Web Studio",
  phi: "φ^75 = 4721424167835376.00",
  seed: "One Seed = Reborn",
  hex: "FRAY 0x46524159"
};

const MERN_PAGES = [
  { name: "Home", path: "/", file: "client/src/pages/Home.jsx", auth: false },
  { name: "Dashboard", path: "/dashboard", file: "client/src/pages/Dashboard.jsx", auth: true },
  { name: "Login", path: "/login", file: "client/src/pages/Login.jsx", auth: false },
  { name: "Settings", path: "/settings", file: "client/src/pages/Settings.jsx", auth: false }
];

export function uid(prefix = "p") {
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function demoWasmB64() {
  return btoa(String.fromCharCode(...DEMO_WASM));
}

export function wasmInfo(b64) {
  if (!b64) return null;
  try {
    const raw = atob(b64.replace(/\s/g, ""));
    const ok = raw.charCodeAt(0) === 0 && raw.charCodeAt(1) === 97 && raw.charCodeAt(2) === 115 && raw.charCodeAt(3) === 109;
    return { ok, size: raw.length, msg: ok ? `valid wasm · ${raw.length} bytes · magic 00 61 73 6d` : "invalid wasm magic — expected 00 61 73 6d" };
  } catch {
    return { ok: false, size: 0, msg: "not decodable base64" };
  }
}

export function defaultPackage(name = "fraymus-app") {
  return {
    name: String(name).toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "fraymus-app",
    scripts: {
      start: "node server/index.js",
      dev: "node server/index.js"
    },
    dependencies: {
      express: "^4.21.2",
      mongoose: "^8.9.5"
    },
    env: {
      PORT: "4180",
      MONGODB_URI: "",
      NODE_ENV: "development"
    }
  };
}

export function blankProject(name = "untitled-φ") {
  return {
    id: uid(),
    name,
    stack: "static",
    html: library.starters.html,
    css: library.starters.css,
    js: library.starters.js,
    wasmB64: "",
    wasmName: "",
    tailwind: false,
    reactMode: false,
    files: {},
    pages: [],
    pkg: defaultPackage(name),
    updatedAt: Date.now()
  };
}

export function buildAppSource(pages) {
  const list = pages.length ? pages : MERN_PAGES;
  const imports = list.map((page) => `import ${page.name} from "./pages/${page.name}.jsx";`).join("\n");
  const entries = list.map((page) => `  { path: "${page.path}", label: "${page.name}", name: "${page.name}", auth: ${page.auth ? "true" : "false"} }`).join(",\n");
  return `import React from "react";
${imports}

const PAGES = [
${entries}
];

export default function App() {
  const [route, setRoute] = React.useState(window.location.hash.replace(/^#/, "") || "/");
  React.useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const page = PAGES.find((item) => item.path === route) || PAGES[0];
  const authed = window.sessionStorage.getItem("fray-token");
  const MAP = { ${list.map((page) => page.name).join(", ")} };
  const Comp = page.auth && !authed ? Login : MAP[page.name] || Home;
  return (
    <div className="app">
      <nav className="nav">
        <a className="brand" href="#/">◈ {window.FRAY_NAME || "Fraymus"}</a>
        <div className="links">
          {PAGES.map((item) => (
            <a key={item.path} href={"#" + item.path} className={route === item.path ? "on" : ""}>{item.label}</a>
          ))}
        </div>
      </nav>
      <Comp />
      <footer className="ft">
        <a href="#/">◈ Fraymus</a>
        <span>${BRAND.copyright}</span>
        <a href="#/">${BRAND.phi}</a>
        <span>${BRAND.seed}</span>
        <span>${BRAND.hex}</span>
      </footer>
    </div>
  );
}
`;
}

export function pageSource(name) {
  return `import React from "react";

export default function ${name}() {
  return (
    <main className="page">
      <p className="kicker">Page</p>
      <h1>${name}</h1>
      <p className="lede">Added in Fraymus. Edit this JSX, then reload the preview.</p>
    </main>
  );
}
`;
}

export function mernFiles(pages = MERN_PAGES) {
  return {
    "server/index.js": serverIndex,
    "server/routes/api.js": routesApi,
    "server/models/Item.js": modelItem,
    "client/src/pages/Home.jsx": pageHome,
    "client/src/pages/Dashboard.jsx": pageDashboard,
    "client/src/pages/Login.jsx": pageLogin,
    "client/src/pages/Settings.jsx": pageSettings,
    "client/src/styles.css": siteCss,
    "client/src/App.jsx": buildAppSource(pages)
  };
}

export function mernProject(name = "mern-app") {
  const pages = MERN_PAGES.map((page) => ({ ...page }));
  return {
    ...blankProject(name),
    stack: "mern",
    pages,
    files: mernFiles(pages),
    pkg: defaultPackage(name)
  };
}

export function ensureMern(project) {
  if (project.files?.["server/index.js"] && project.pages?.length) return project;
  const seeded = mernProject(project.name);
  return {
    ...project,
    stack: "mern",
    pages: project.pages?.length ? project.pages : seeded.pages,
    files: { ...seeded.files, ...(project.files || {}) },
    pkg: project.pkg?.dependencies ? project.pkg : seeded.pkg
  };
}

export const libraryItems = [
  ...library.items,
  {
    id: "mern-starter",
    tab: "MERN",
    name: "Full MERN app",
    desc: "Home, Dashboard, Login, Settings, Express API, and an Item model.",
    kind: "files",
    template: true
  },
  {
    id: "mern-home",
    tab: "MERN",
    name: "Page — Home",
    desc: "Landing page with links into the API-backed app.",
    kind: "file",
    file: "client/src/pages/Home.jsx",
    source: pageHome
  },
  {
    id: "mern-dashboard",
    tab: "MERN",
    name: "Page — Dashboard",
    desc: "Create and remove records through /api/items.",
    kind: "file",
    file: "client/src/pages/Dashboard.jsx",
    source: pageDashboard
  },
  {
    id: "mern-login",
    tab: "MERN",
    name: "Page — Login",
    desc: "Email-only local demo sign-in. No password is stored.",
    kind: "file",
    file: "client/src/pages/Login.jsx",
    source: pageLogin
  },
  {
    id: "mern-settings",
    tab: "MERN",
    name: "Page — Settings",
    desc: "Shows whether the API is on memory or Mongo.",
    kind: "file",
    file: "client/src/pages/Settings.jsx",
    source: pageSettings
  },
  {
    id: "mern-api",
    tab: "MERN",
    name: "Express API routes",
    desc: "Items CRUD plus local demo login.",
    kind: "file",
    file: "server/routes/api.js",
    source: routesApi
  },
  {
    id: "mern-model",
    tab: "MERN",
    name: "Mongoose Item model",
    desc: "Title and status schema used when MONGODB_URI is set.",
    kind: "file",
    file: "server/models/Item.js",
    source: modelItem
  },
  {
    id: "mern-server",
    tab: "MERN",
    name: "Express server entry",
    desc: "Node entry that serves the API, vendor scripts, and preview.",
    kind: "file",
    file: "server/index.js",
    source: serverIndex
  }
];

export function fileValue(project, key) {
  if (key === "html") return project.html || "";
  if (key === "css") return project.css || "";
  if (key === "js") return project.js || "";
  if (key === "wasm") return project.wasmB64 || "";
  return project.files?.[key] || "";
}

export function withFile(project, key, value) {
  if (key === "html") return { ...project, html: value };
  if (key === "css") return { ...project, css: value };
  if (key === "js") return { ...project, js: value };
  if (key === "wasm") return { ...project, wasmB64: value };
  return { ...project, files: { ...(project.files || {}), [key]: value } };
}

export function addPage(project, rawName) {
  const name = String(rawName || "").trim();
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error("Page names start with a capital letter and use only letters and numbers.");
  }
  const next = ensureMern(project);
  if (next.pages.some((page) => page.name === name)) throw new Error("That page already exists.");
  const page = { name, path: "/" + name.toLowerCase(), file: `client/src/pages/${name}.jsx`, auth: false };
  const pages = [...next.pages, page];
  return {
    ...next,
    stack: "mern",
    pages,
    files: {
      ...next.files,
      [page.file]: pageSource(name),
      "client/src/App.jsx": buildAppSource(pages)
    }
  };
}

export function updatePage(project, name, patch) {
  const pages = project.pages.map((page) => (page.name === name ? { ...page, ...patch, name: page.name, file: page.file } : page));
  return {
    ...project,
    pages,
    files: { ...project.files, "client/src/App.jsx": buildAppSource(pages) }
  };
}

export function removePage(project, name) {
  if (project.pages.length <= 1) throw new Error("Keep at least one page.");
  const pages = project.pages.filter((page) => page.name !== name);
  const files = { ...project.files };
  delete files[`client/src/pages/${name}.jsx`];
  files["client/src/App.jsx"] = buildAppSource(pages);
  return { ...project, pages, files };
}

function splice(source, insert, at) {
  const index = at == null ? source.length : at;
  const gap = source && !source.endsWith("\n") ? "\n" : "";
  return source.slice(0, index) + gap + insert + (insert.endsWith("\n") ? "" : "\n") + source.slice(index);
}

export function applyLibraryItem(project, item, activeFile, cursor) {
  if (item.id === "mern-starter" || (item.kind === "files" && item.template)) {
    const seeded = mernProject(project.name);
    return { ...project, ...seeded, id: project.id, name: project.name };
  }
  if (item.kind === "file") {
    const next = ensureMern({ ...project, stack: "mern" });
    const files = { ...next.files, [item.file]: item.source };
    const pageName = item.file.match(/pages\/([A-Za-z0-9]+)\.jsx$/)?.[1];
    let pages = next.pages;
    if (pageName && !pages.some((page) => page.name === pageName)) {
      pages = [...pages, { name: pageName, path: "/" + pageName.toLowerCase(), file: item.file, auth: pageName === "Dashboard" }];
      files["client/src/App.jsx"] = buildAppSource(pages);
    }
    return { ...next, files, pages };
  }
  if (item.template) {
    return { ...project, stack: "static", html: item.html || "", css: item.css || "", js: item.js || "" };
  }
  if (project.stack === "mern" && activeFile?.endsWith(".jsx") && item.html) {
    const files = { ...(project.files || {}) };
    files[activeFile] = splice(files[activeFile] || "", item.html, cursor);
    if (item.css) files["client/src/styles.css"] = (files["client/src/styles.css"] || "") + "\n" + item.css;
    return { ...project, files };
  }
  return {
    ...project,
    html: item.html ? splice(project.html || "", item.html, activeFile === "html" ? cursor : null) : project.html,
    css: item.css ? splice(project.css || "", item.css, activeFile === "css" ? cursor : null) : project.css,
    js: item.js ? splice(project.js || "", item.js, activeFile === "js" ? cursor : null) : project.js
  };
}

export function projectFiles(project) {
  if (project.stack === "mern") {
    const files = { ...(project.files || {}) };
    files["package.json"] = JSON.stringify({
      name: project.pkg?.name || "fraymus-app",
      private: true,
      version: "1.0.0",
      scripts: project.pkg?.scripts || defaultPackage().scripts,
      dependencies: project.pkg?.dependencies || defaultPackage().dependencies
    }, null, 2);
    const env = project.pkg?.env || {};
    files[".env"] = Object.entries(env).map(([key, value]) => `${key}=${value ?? ""}`).join("\n") + "\n";
    return files;
  }
  return {
    "styles.css": project.css || "",
    "app.js": project.js || "",
    "index.html": singleFileHtml(project)
  };
}

export function languageFor(key, project) {
  if (key === "js") return project.reactMode ? "jsx" : "javascript";
  if (key === "html") return "html";
  if (key === "css") return "css";
  if (key === "wasm") return "wasm";
  if (key.endsWith(".jsx")) return "jsx";
  if (key.endsWith(".css")) return "css";
  if (key.endsWith(".json")) return "json";
  if (key.endsWith(".js")) return "javascript";
  return "text";
}

export function pairTarget(project, file) {
  if (project.stack === "mern") {
    if (file.includes("/pages/")) return "server/routes/api.js";
    if (file.includes("/models/")) return "server/routes/api.js";
    if (file.includes("/routes/")) return "client/src/pages/Dashboard.jsx";
    if (file.endsWith("App.jsx")) return "client/src/styles.css";
    if (file.endsWith(".css")) return "client/src/pages/Home.jsx";
    return "client/src/pages/Home.jsx";
  }
  if (file === "html") return "css";
  if (file === "css") return "js";
  if (file === "js") return "html";
  return "html";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function previewize(source) {
  return String(source || "")
    .replace(/^\s*import\s+[^;]+;?\s*$/gm, "")
    .replace(/export\s+default\s+function/g, "function")
    .replace(/export\s+function/g, "function")
    .replace(/export\s+default\s+/g, "");
}

const BRIDGE = `<script>
(function(){
  ["log","info","warn","error"].forEach(function(type){
    var orig = console[type].bind(console);
    console[type] = function(){
      var args = Array.prototype.slice.call(arguments).map(function(v){ try { return typeof v === "string" ? v : JSON.stringify(v); } catch(e){ return String(v); } });
      try { parent.postMessage({fray:"log", type:type === "log" ? "log" : type, args:args}, "*"); } catch(e){}
      return orig.apply(null, arguments);
    };
  });
  window.addEventListener("error", function(event){
    try { parent.postMessage({fray:"log", type:"error", args:[event.message]}, "*"); } catch(e){}
  });
  window.addEventListener("message", function(event){
    var data = event.data || {};
    if (data.fray === "eval") {
      try {
        var result = (0, eval)(data.code);
        parent.postMessage({fray:"eval-result", id:data.id, ok:true, result:String(result)}, "*");
      } catch (error) {
        parent.postMessage({fray:"eval-result", id:data.id, ok:false, result:String(error)}, "*");
      }
    }
    if (data.fray === "call" && window.frayWasm) {
      try {
        var fn = window.frayWasm.exports[data.name];
        var out = fn.apply(null, data.args || []);
        parent.postMessage({fray:"log", type:"ok", args:[data.name+"() → "+out]}, "*");
      } catch (error) {
        parent.postMessage({fray:"log", type:"error", args:[String(error)]}, "*");
      }
    }
  });
  try { parent.postMessage({fray:"ready"}, "*"); } catch (e) {}
})();
</script>`;

function assetTags(assets) {
  const origin = assets === "local" || typeof window === "undefined" ? "" : window.location.origin;
  const base = assets === "local" ? "/.vendor" : `${origin}/vendor`;
  return `<script src="${base}/react.js"></script>
<script src="${base}/react-dom.js"></script>
<script src="${base}/babel.js"></script>`;
}

function babelRunner(source) {
  const json = JSON.stringify(source).replace(/</g, "\\u003c");
  return `<script>
  try {
    if (typeof Babel === "undefined" || typeof React === "undefined") throw new Error("Preview scripts did not load");
    var out = Babel.transform(${json}, { presets: [["react", { runtime: "classic" }]] }).code;
    var el = document.createElement("script");
    el.text = out;
    document.body.appendChild(el);
  } catch (error) {
    try { parent.postMessage({fray:"log", type:"error", args:[String(error && error.message || error)]}, "*"); } catch (e) {}
  }
</script>`;
}

export function buildPreview(project, { apiBase = "", assets = "studio" } = {}) {
  if (project.stack === "mern") {
    const pages = project.pages?.length ? project.pages : MERN_PAGES;
    const sources = pages.map((page) => project.files?.[page.file] || "").concat(project.files?.["client/src/App.jsx"] || buildAppSource(pages));
    const js = sources.map(previewize).join("\n") + "\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));\n";
    const css = project.files?.["client/src/styles.css"] || siteCss;
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(project.name)}</title>
<style>${css}</style></head><body>
<div id="root"></div>
<script>window.FRAY_API=${JSON.stringify(apiBase)};window.FRAY_NAME=${JSON.stringify(project.name)};</script>
${assetTags(assets)}
${BRIDGE}
${babelRunner(js)}
</body></html>`;
  }

  const css = project.css || "";
  const js = project.js || "";
  const tailwind = project.tailwind ? `<script src="https://cdn.tailwindcss.com"></script>` : "";
  const react = project.reactMode ? `${assetTags(assets)}` : "";
  const script = project.reactMode ? babelRunner(js) : `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
  const wasm = project.wasmB64 ? `<script>
    (function(){
      try {
        var raw = atob(${JSON.stringify(project.wasmB64.replace(/\s/g, ""))});
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        WebAssembly.instantiate(bytes).then(function(res){
          window.frayWasm = res.instance;
          var names = Object.keys(res.instance.exports || {});
          parent.postMessage({fray:"wasm", exports:names}, "*");
        }).catch(function(error){
          parent.postMessage({fray:"log", type:"error", args:[String(error)]}, "*");
        });
      } catch (error) {
        parent.postMessage({fray:"log", type:"error", args:[String(error)]}, "*");
      }
    })();
  </script>` : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(project.name)}</title>
${tailwind}
<style>${css}</style></head><body>
${project.html || ""}
${wasm}
${react}
${BRIDGE}
${script}
</body></html>`;
}

export function singleFileHtml(project) {
  return buildPreview({ ...project, stack: project.stack === "mern" ? "mern" : project.stack }, { apiBase: "", assets: "cdn" }).replace(
    assetTags("studio"),
    `<script crossorigin src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.2/babel.min.js"></script>`
  );
}

export function deployFiles(project, slug) {
  const safe = slug || "site";
  return {
    "vercel.json": JSON.stringify({
      version: 2,
      name: safe,
      builds: project.stack === "mern" ? [{ src: "server/index.js", use: "@vercel/node" }] : [{ src: "index.html", use: "@vercel/static" }],
      routes: [{ src: "/(.*)", dest: project.stack === "mern" ? "server/index.js" : "index.html" }]
    }, null, 2),
    "netlify.toml": project.stack === "mern"
      ? `[build]\ncommand = "npm install"\npublish = "."\n\n[build.environment]\nNODE_VERSION = "22"\n`
      : `[build]\npublish = "."\n\n[[redirects]]\nfrom = "/*"\nto = "/index.html"\nstatus = 200\n`,
    Dockerfile: project.stack === "mern"
      ? `FROM node:22-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm install --omit=dev\nCOPY . .\nENV PORT=4180\nEXPOSE 4180\nCMD ["node", "server/index.js"]\n`
      : `FROM nginx:1.27-alpine\nCOPY index.html /usr/share/nginx/html/index.html\nEXPOSE 80\n`,
    "docker-compose.yml": project.stack === "mern"
      ? `services:\n  web:\n    build: .\n    ports:\n      - "127.0.0.1:\${PORT:-4180}:4180"\n    environment:\n      PORT: 4180\n      MONGODB_URI: \${MONGODB_URI:-}\n`
      : `services:\n  web:\n    build: .\n    ports:\n      - "127.0.0.1:\${PORT:-8080}:80"\n`,
    "nginx.conf": `server {\n  listen 80;\n  server_name ${safe}.example.com;\n  root /opt/fraymus/sites/${safe};\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n`,
    "DEPLOY.txt": `Fraymus publish bundle: ${project.name}\n\nLocal studio URL after Publish:\n  /published/${safe}/\n\nNode:\n  npm install\n  npm start\n\nDocker:\n  docker compose up --build\n\nVercel:\n  npx vercel --prod\n\nStatic files are self-contained HTML. The MERN API runs with Node, not from a static host.\n`
  };
}

export function tidy(value) {
  return String(value || "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
}

export function lineCount(value) {
  if (!value) return 0;
  return String(value).split("\n").length;
}

export function byteSize(value) {
  return new Blob([value || ""]).size;
}

export function formatBytes(size) {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

export function splitHtml(source) {
  try {
    const doc = new DOMParser().parseFromString(source, "text/html");
    const css = [...doc.querySelectorAll("style")].map((node) => node.textContent || "").join("\n");
    const js = [...doc.querySelectorAll("script")].filter((node) => !node.src).map((node) => node.textContent || "").join("\n");
    doc.querySelectorAll("style,script,link[rel=stylesheet]").forEach((node) => node.remove());
    return { html: (doc.body?.innerHTML || "").trim(), css: css.trim(), js: js.trim() };
  } catch {
    return { html: source, css: "", js: "" };
  }
}

export function searchScore(query, text) {
  const hay = text.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 1;
  const at = hay.indexOf(needle);
  if (at >= 0) return 100 - at;
  let index = 0;
  for (const char of needle) {
    index = hay.indexOf(char, index);
    if (index < 0) return -1;
    index += 1;
  }
  return 1;
}

export function staticServerSource() {
  return `const http = require("http");
const fs = require("fs");
const path = require("path");
const port = Number(process.env.PORT) || 4180;
const root = path.resolve(__dirname);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = url === "/" ? "/index.html" : url;
  const target = path.resolve(root, "." + rel);
  if (!target.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log("static server http://127.0.0.1:" + port));
`;
}

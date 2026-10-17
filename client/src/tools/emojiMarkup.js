import { base64, fnv1a64, sha256, textBytes } from "./emojiCodec.js";

const C = { red: "#e0392e", orange: "#e8830c", amber: "#e0b400", green: "#0a9d54", blue: "#2a74d6", purple: "#8a4fd0", black: "#111418", white: "#ffffff" };

const BASE_REG = {
  "📦": { t: "el", tag: "div" }, "🧭": { t: "el", tag: "nav" }, "📋": { t: "el", tag: "ul" }, "•": { t: "el", tag: "li" }, "📝": { t: "el", tag: "form" },
  "📄": { t: "el", tag: "p" }, "🔗": { t: "el", tag: "a" }, "🔘": { t: "el", tag: "button" }, "⌨️": { t: "el", tag: "input" }, "🖼️": { t: "el", tag: "img" },
  "💪": { t: "el", tag: "strong" }, "✨": { t: "el", tag: "em" }, "➖": { t: "el", tag: "hr" },
  "1️⃣": { t: "el", tag: "h1" }, "2️⃣": { t: "el", tag: "h2" }, "3️⃣": { t: "el", tag: "h3" }, "4️⃣": { t: "el", tag: "h4" },
  "🗂️": { t: "el", tag: "section" }, "🔝": { t: "el", tag: "header" }, "🔻": { t: "el", tag: "footer" }, "📰": { t: "el", tag: "article" },
  "🔡": { t: "el", tag: "span" }, "🏷️": { t: "el", tag: "label" }, "📊": { t: "el", tag: "table" }, "🧾": { t: "el", tag: "pre" }, "🎬": { t: "el", tag: "video" }, "📑": { t: "el", tag: "select" },
  "👆": { t: "mod", attrs: { onclick: "this.classList.toggle('on')" } },
  "🔴": { t: "sty", s: { color: C.red } }, "🟠": { t: "sty", s: { color: C.orange } }, "🟡": { t: "sty", s: { color: C.amber } }, "🟢": { t: "sty", s: { color: C.green } },
  "🔵": { t: "sty", s: { color: C.blue } }, "🟣": { t: "sty", s: { color: C.purple } }, "⚫": { t: "sty", s: { color: C.black } },
  "🟥": { t: "sty", s: { background: C.red } }, "🟧": { t: "sty", s: { background: C.orange } }, "🟨": { t: "sty", s: { background: C.amber } }, "🟩": { t: "sty", s: { background: C.green } },
  "🟦": { t: "sty", s: { background: C.blue } }, "🟪": { t: "sty", s: { background: C.purple } }, "⬛": { t: "sty", s: { background: C.black } },
  "↔️": { t: "sty", s: { display: "flex", "flex-direction": "row", gap: "12px" } }, "↕️": { t: "sty", s: { display: "flex", "flex-direction": "column", gap: "8px" } },
  "🎯": { t: "sty", s: { "text-align": "center", "align-items": "center", "justify-content": "center" } },
  "🔲": { t: "sty", s: { border: "1px solid #cbd2db" } }, "⭕": { t: "sty", s: { "border-radius": "12px" } }, "🌑": { t: "sty", s: { "box-shadow": "0 6px 18px rgba(0,0,0,.14)" } }, "📏": { t: "sty", s: { padding: "14px" } },
  "🅱️": { t: "sty", s: { "font-weight": "700" } }, "🔠": { t: "sty", s: { "text-transform": "uppercase", "letter-spacing": ".04em" } }, "🆙": { t: "sty", s: { "font-size": "22px" } }, "🔎": { t: "sty", s: { "font-size": "13px", opacity: ".8" } },
  "🌈": { t: "sty", s: { background: `linear-gradient(135deg,${C.blue},${C.purple})`, color: C.white } }, "🧵": { t: "sty", s: { "font-family": "ui-monospace,Menlo,monospace" } }, "📐": { t: "sty", s: { width: "100%" } }
};

export const REGISTRY = BASE_REG;

export function describeEntry(entry) {
  if (entry.t === "el") return { kind: "Element", text: `<${entry.tag}>` };
  if (entry.t === "mod") return { kind: "Action", text: "click toggles .on" };
  return { kind: "Style", text: styleText(entry.s) };
}

export const PALETTE = [
  ["Structure", ["📦 div", "🧭 nav", "🗂️ section", "🔝 header", "🔻 footer", "📰 article", "📋 ul", "• li", "📝 form"]],
  ["Text", ["1️⃣ h1", "2️⃣ h2", "3️⃣ h3", "📄 p", "🔗 a", "💪 strong", "✨ em", "🔡 span", "🏷️ label", "➖ hr"]],
  ["Interactive", ["🔘 button", "⌨️ input", "🖼️ img", "📑 select", "👆 onclick"]],
  ["Color", ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫"]],
  ["Background", ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛"]],
  ["Layout", ["↔️ row", "↕️ col", "🎯 center", "🔲 border", "⭕ round", "🌑 shadow", "📏 pad", "📐 full"]],
  ["Type", ["🅱️ bold", "🔠 caps", "🆙 big", "🔎 small", "🌈 grad", "🧵 mono"]]
];

export const OPERATORS = [["> ", ">", "child"], ["+ ", "+", "sibling"], ["*3", "*3", "repeat"], ["( )", "( )", "group"], ["{text}", "{ }", "text"], [".name", ".cls", "class"], ["#id", "#id", "id"]];

export const PRESETS = {
  "nav bar": "🧭 ↔️ 🎯 📏 > 🔗{Home}+🔗{Docs}+🔗{Pricing}+🔗{Login}",
  hero: "📦.hero 🌈 🎯 ↕️ 📏 ⭕ > 1️⃣ 🆙{Big Title}+📄{A short tagline that sells it.}+🔘👆{Get started}",
  card: "📦.card 🔲 ⭕ 📏 🌑 ↕️ > 2️⃣{Card title}+📄{Body copy here.}+🔘👆{Action}",
  "3 cards": "📦 ↔️ > (📦.card 🔲 ⭕ 📏 ↕️ > 2️⃣{Item}+📄{Description.})*3",
  form: "📝 ↕️ 📏 🔲 ⭕ > 1️⃣{Sign up}+⌨️+⌨️+🔘👆{Submit}",
  footer: "🔻 🎯 📏 > 📄 🔎{© 2026 Fraymus Web Studio}"
};

export const SAMPLE = [
  "🧭 🎯 📏 > 🔗{Home}+🔗{Docs}+🔗{Pricing}",
  "📦.hero 🌈 🎯 ↕️ 📏 ⭕ > 1️⃣ 🆙{Build with emoji}+📄{Type glyphs, watch real HTML appear.}+🔘👆{Get started}",
  "📦 ↔️ > (📦.card 🔲 ⭕ 📏 ↕️ > 2️⃣{Feature}+📄{One vocabulary. Real code.})*3",
  "🔻 🎯 📏 > 📄 🔎{© 2026 Fraymus Web Studio}"
].join("\n");

export const PREVIEW_CSS = "body{font:15px/1.55 system-ui,sans-serif;margin:0;padding:18px;color:#1a1e24;background:#fff}nav{display:flex;gap:18px;padding:8px 0 12px;border-bottom:1px solid #e3e6ea;margin-bottom:14px;flex-wrap:wrap}nav a{color:#d8542e;text-decoration:none;font-weight:600}h1{font-size:24px;margin:.15em 0}h2{font-size:19px}.card{border:1px solid #e3e6ea;border-radius:14px;padding:18px;max-width:360px}button{background:#d8542e;color:#fff;border:0;border-radius:9px;padding:9px 15px;font:inherit;font-weight:600;cursor:pointer}button.on{box-shadow:0 0 0 3px rgba(216,84,46,.35)}input{padding:9px 11px;border:1px solid #cfd4db;border-radius:8px;font:inherit}ul{padding-left:20px}img{border-radius:8px}p{max-width:60ch}hr{border:0;border-top:1px solid #e3e6ea;margin:14px 0}";

const VOID = new Set(["img", "input", "br", "hr"]);
const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' rx='8' fill='%23cbd5e1'/%3E%3C/svg%3E";
const TAG_KEY = /^=([a-zA-Z][\w-]*)$/;
const DECL = /^-?[a-z][a-z-]*\s*:/i;

export function parseStyleDeclarations(text) {
  const style = {};
  for (const part of String(text).replace(/[{}]/g, "").split(";")) {
    const at = part.indexOf(":");
    if (at < 1) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (/^-?[a-z][a-z-]*$/.test(prop) && value) style[prop] = value;
  }
  return style;
}

export function parseStylesheet(text) {
  const css = String(text).replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let depth = 0;
  let head = "";
  let body = "";
  let skip = false;
  for (const ch of css) {
    if (ch === "{") {
      if (depth === 0) skip = head.trim().startsWith("@");
      else if (!skip) body += ch;
      depth++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        const style = parseStyleDeclarations(body);
        if (!skip && Object.keys(style).length) rules.push({ selector: head.trim().replace(/\s+/g, " "), style });
        head = "";
        body = "";
        skip = false;
      } else if (!skip) body += ch;
    } else if (depth === 0) head = ch === ";" ? "" : head + ch;
    else if (!skip) body += ch;
  }
  return rules;
}

export const styleText = (style) => Object.entries(style).map(([prop, value]) => `${prop}: ${value}`).join("; ");

export function classifyKey(expansion) {
  const trimmed = String(expansion).trim();
  const tag = TAG_KEY.exec(trimmed);
  if (tag) return { type: "tag", tag: tag[1] };
  if (DECL.test(trimmed)) {
    const style = parseStyleDeclarations(trimmed);
    if (Object.keys(style).length) return { type: "style", style };
  }
  return { type: "macro" };
}

const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const camel = (name) => name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
const clone = (node) => ({ ...node, cls: [...node.cls], attrs: { ...node.attrs }, style: { ...node.style }, children: node.children.map(clone) });

function styleOf(style) {
  const next = { ...style };
  if (next.background && !next.padding) next.padding = "10px 14px";
  return next;
}

function styStr(style) {
  return Object.entries(styleOf(style)).map(([key, value]) => `${key}:${value}`).join(";");
}

export function createCompiler(keys = {}) {
  const reg = { ...BASE_REG };
  for (const [emoji, expansion] of Object.entries(keys)) {
    const kind = classifyKey(expansion);
    if (kind.type === "tag") reg[emoji] = { t: "el", tag: kind.tag };
    if (kind.type === "style") reg[emoji] = { t: "sty", s: kind.style };
  }
  const order = Object.keys(reg).sort((a, b) => b.length - a.length);
  const matchAt = (line, index) => order.find((key) => line.startsWith(key, index)) || null;

  function expand(source) {
    let out = source;
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const [emoji, expansion] of Object.entries(keys)) {
        if (classifyKey(expansion).type !== "macro" || !out.includes(emoji)) continue;
        out = out.split(emoji).join(expansion);
        changed = true;
      }
      if (!changed) break;
    }
    return out;
  }

  function tokenize(line) {
    const tokens = [];
    const n = line.length;
    let i = 0;
    const name = () => {
      let j = i;
      while (j < n && /[\w-]/.test(line[j])) j++;
      const value = line.slice(i, j);
      i = j;
      return value;
    };
    while (i < n) {
      const ch = line[i];
      if (ch === " " || ch === "\t") { i++; continue; }
      if (">+()".includes(ch)) { tokens.push({ t: ch }); i++; continue; }
      if (ch === "*") {
        i++;
        let j = i;
        while (j < n && /\d/.test(line[j])) j++;
        tokens.push({ t: "*", n: Math.min(parseInt(line.slice(i, j) || "1", 10) || 1, 200) });
        i = j;
        continue;
      }
      const emoji = matchAt(line, i);
      if (emoji && reg[emoji].t === "el") {
        i += emoji.length;
        const node = { tag: reg[emoji].tag, emoji, cls: [], id: null, text: null, attrs: {}, style: {}, children: [] };
        while (i < n) {
          const c = line[i];
          if (c === ".") { i++; node.cls.push(name()); }
          else if (c === "#") { i++; node.id = name(); }
          else if (c === "{") {
            i++;
            let j = line.indexOf("}", i);
            if (j < 0) j = n;
            node.text = line.slice(i, j);
            i = j < n ? j + 1 : n;
          } else {
            const mod = matchAt(line, i);
            const entry = mod && reg[mod];
            if (entry?.t === "mod") { Object.assign(node.attrs, entry.attrs); i += mod.length; }
            else if (entry?.t === "sty") { Object.assign(node.style, entry.s); i += mod.length; }
            else if (c === " " && (line[i + 1] === "{" || (matchAt(line, i + 1) && reg[matchAt(line, i + 1)].t !== "el"))) i++;
            else break;
          }
        }
        tokens.push({ t: "el", node });
      } else i++;
    }
    return tokens;
  }

  function parse(tokens) {
    let p = 0;
    const peek = () => tokens[p];
    const eat = () => tokens[p++];
    function primary() {
      let nodes;
      if (peek()?.t === "(") {
        eat();
        nodes = sequence();
        if (peek()?.t === ")") eat();
      } else if (peek()?.t === "el") nodes = [eat().node];
      else {
        if (peek()) eat();
        nodes = [];
      }
      if (peek()?.t === "*") {
        const count = eat().n;
        const base = nodes;
        nodes = [];
        for (let r = 0; r < count; r++) for (const node of base) nodes.push(r === 0 ? node : clone(node));
      }
      return nodes;
    }
    function sequence() {
      const root = { children: [] };
      let current = root;
      const first = primary();
      current.children.push(...first);
      let last = first[first.length - 1] || null;
      while (peek() && (peek().t === ">" || peek().t === "+")) {
        const op = eat().t;
        if (op === ">" && last) current = last;
        const next = primary();
        current.children.push(...next);
        if (next.length) last = next[next.length - 1];
      }
      return root.children;
    }
    return sequence();
  }

  function ast(source) {
    const nodes = [];
    for (const line of expand(source).split("\n")) if (line.trim()) nodes.push(...parse(tokenize(line)));
    return nodes;
  }

  return { ast, expand };
}

function baseAttrs(node, className = "class") {
  let out = "";
  if (node.id) out += ` id="${attr(node.id)}"`;
  if (node.cls.length) out += ` ${className}="${attr(node.cls.join(" "))}"`;
  if (node.tag === "a") out += ' href="#"';
  if (node.tag === "img") out += ` src="${IMG}" alt=""`;
  if (node.tag === "input") out += ' type="text" placeholder="…"';
  return out;
}

export function genHTML(nodes, indent = 0, classOf = null) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const node of nodes) {
    const extra = classOf ? classOf(node) : "";
    const merged = extra ? { ...node, cls: [...node.cls, extra] } : node;
    let at = baseAttrs(merged);
    for (const [key, value] of Object.entries(node.attrs)) at += ` ${key}="${attr(value)}"`;
    if (!classOf && Object.keys(node.style).length) at += ` style="${attr(styStr(node.style))}"`;
    if (VOID.has(node.tag)) { out += `${pad}<${node.tag}${at}>\n`; continue; }
    const inner = node.text != null ? esc(node.text) : "";
    out += node.children.length
      ? `${pad}<${node.tag}${at}>${inner}\n${genHTML(node.children, indent + 1, classOf)}${pad}</${node.tag}>\n`
      : `${pad}<${node.tag}${at}>${inner}</${node.tag}>\n`;
  }
  return out;
}

export function genCSS(nodes) {
  const rules = new Map();
  const classOf = (node) => {
    const keys = Object.keys(node.style);
    if (!keys.length) return "";
    const body = styStr(node.style);
    if (!rules.has(body)) rules.set(body, `fx-${fnv1a64(textBytes(body)).slice(0, 6)}`);
    return rules.get(body);
  };
  const html = genHTML(nodes, 0, classOf);
  const css = [...rules.entries()].map(([body, name]) => `.${name} {\n${body.split(";").map((decl) => `  ${decl.replace(":", ": ")};`).join("\n")}\n}`).join("\n\n");
  return { html, css: css ? `${css}\n` : "/* no emoji styles in this source */\n", count: rules.size };
}

function genJSX(nodes, indent) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const node of nodes) {
    let at = baseAttrs(node, "className");
    if (node.attrs.onclick) at += ' onClick={(e) => e.currentTarget.classList.toggle("on")}';
    const style = styleOf(node.style);
    const keys = Object.keys(node.style).length ? Object.keys(style) : [];
    if (keys.length) at += ` style={{ ${keys.map((key) => `${camel(key)}: ${JSON.stringify(style[key])}`).join(", ")} }}`;
    if (VOID.has(node.tag)) { out += `${pad}<${node.tag}${at} />\n`; continue; }
    const inner = node.text != null ? `{${JSON.stringify(node.text)}}` : "";
    out += node.children.length
      ? `${pad}<${node.tag}${at}>${inner}\n${genJSX(node.children, indent + 1)}${pad}</${node.tag}>\n`
      : `${pad}<${node.tag}${at}>${inner}</${node.tag}>\n`;
  }
  return out;
}

function genPug(nodes, indent) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const node of nodes) {
    let head = node.tag;
    if (node.id) head += `#${node.id}`;
    if (node.cls.length) head += `.${node.cls.join(".")}`;
    const parts = [];
    if (node.tag === "a") parts.push('href="#"');
    if (node.tag === "img") parts.push(`src="${IMG}"`, 'alt=""');
    if (node.tag === "input") parts.push('type="text"');
    if (Object.keys(node.style).length) parts.push(`style="${styStr(node.style)}"`);
    if (parts.length) head += `(${parts.join(", ")})`;
    out += `${pad}${head}${node.text != null ? ` ${node.text}` : ""}\n`;
    if (node.children.length) out += genPug(node.children, indent + 1);
  }
  return out;
}

function genMD(nodes) {
  let out = "";
  for (const node of nodes) {
    const tag = node.tag;
    const text = node.text ?? "";
    if (/^h[1-6]$/.test(tag)) out += `${"#".repeat(+tag[1])} ${text}\n\n`;
    else if (tag === "p") out += `${text}\n\n`;
    else if (tag === "strong") out += `**${text}**\n\n`;
    else if (tag === "em") out += `*${text}*\n\n`;
    else if (tag === "a") out += `[${text || "link"}](#)\n\n`;
    else if (tag === "li") out += `- ${text}\n`;
    else if (tag === "hr") out += "---\n\n";
    else if (tag === "button") out += `\`[${text || "button"}]\`\n\n`;
    else if (text) out += `${text}\n\n`;
    if (node.children.length) out += genMD(node.children);
    if (tag === "ul") out += "\n";
  }
  return out;
}

function genJSDOM(nodes) {
  const lines = [];
  let count = 0;
  function walk(node, parent) {
    const name = `el${++count}`;
    lines.push(`const ${name} = document.createElement(${JSON.stringify(node.tag)});`);
    if (node.id) lines.push(`${name}.id = ${JSON.stringify(node.id)};`);
    if (node.cls.length) lines.push(`${name}.className = ${JSON.stringify(node.cls.join(" "))};`);
    if (node.tag === "a") lines.push(`${name}.href = "#";`);
    if (node.tag === "img") lines.push(`${name}.src = ${JSON.stringify(IMG)};`);
    if (node.tag === "input") lines.push(`${name}.type = "text";`, `${name}.placeholder = "…";`);
    if (node.attrs.onclick) lines.push(`${name}.addEventListener("click", () => ${name}.classList.toggle("on"));`);
    if (Object.keys(node.style).length) lines.push(`${name}.style.cssText = ${JSON.stringify(styStr(node.style))};`);
    if (node.text) lines.push(`${name}.append(${JSON.stringify(node.text)});`);
    lines.push(`${parent}.appendChild(${name});`);
    for (const child of node.children) walk(child, name);
  }
  for (const node of nodes) walk(node, "app");
  return `const app = document.getElementById("app") || document.body;\n${lines.join("\n")}\n`;
}

function javaText(value) {
  return value.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""');
}

function genJava(source, html, css) {
  return `import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Emoji Coder page, compiled to plain HTML + CSS. JDK 15+ only, no dependencies. */
public final class EmojiPage {
    static final String SOURCE = """
${javaText(source)}
""";

    static final String CSS = """
${javaText(css)}""";

    static final String BODY = """
${javaText(html)}""";

    static String html() {
        return "<!doctype html>\\n<html><head><meta charset=\\"utf-8\\"><style>\\n" + CSS + "</style></head><body>\\n" + BODY + "</body></html>\\n";
    }

    public static void main(String[] args) throws Exception {
        Path out = Path.of(args.length > 0 ? args[0] : "page.html");
        Files.writeString(out, html(), StandardCharsets.UTF_8);
        System.out.println("wrote " + out + " (" + html().length() + " chars from " + SOURCE.codePointCount(0, SOURCE.length()) + " source code points)");
    }
}
`;
}

function leb(value) {
  const out = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    out.push(byte);
  } while (value);
  return out;
}

const section = (id, body) => [id, ...leb(body.length), ...body];
const wasmString = (text) => {
  const bytes = textBytes(text);
  return [...leb(bytes.length), ...bytes];
};

export async function buildWasm(source, html) {
  const srcBytes = textBytes(source);
  const ledger = {
    tool: "emoji-coder/1.0", file_type: "emojicoder", encoding: "base64", algo: "sha-256", sha256: await sha256(srcBytes),
    size: srcBytes.length, reversible: true, source_b64: base64(srcBytes), html_b64: base64(textBytes(html)), created: new Date().toISOString()
  };
  const bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f]),
    ...section(3, [0x01, 0x00]),
    ...section(7, [0x01, ...wasmString("execute"), 0x00, 0x00]),
    ...section(10, [0x01, ...leb(4), 0x00, 0x20, 0x00, 0x0b]),
    ...section(0, [...wasmString("fraymus.emojicoder"), ...textBytes(JSON.stringify(ledger))])
  ]);
  return { bytes, ledger };
}

export function readWasmLedger(bytes) {
  let i = 8;
  while (i < bytes.length) {
    const id = bytes[i++];
    let size = 0;
    let shift = 0;
    let byte;
    do {
      byte = bytes[i++];
      size |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    const end = i + size;
    if (id === 0) {
      const nameLen = bytes[i];
      const name = new TextDecoder().decode(bytes.slice(i + 1, i + 1 + nameLen));
      if (name === "fraymus.emojicoder") return JSON.parse(new TextDecoder().decode(bytes.slice(i + 1 + nameLen, end)));
    }
    i = end;
  }
  return null;
}

export const TARGETS = [
  ["html", "HTML"], ["css", "CSS + HTML"], ["jsdom", "JavaScript (DOM)"], ["jsx", "JSX / React"], ["java", "Java"],
  ["pug", "Pug"], ["md", "Markdown"], ["json", "JSON (source + AST + keys)"], ["wasm", "WASM (reversible)"], ["emoji", "Emoji source"]
];

export function emit(source, keys, target) {
  const { ast } = createCompiler(keys);
  const nodes = ast(source);
  const html = genHTML(nodes);
  if (target === "css") {
    const split = genCSS(nodes);
    return `/* styles.css — ${split.count} classes from emoji */\n${split.css}\n<!-- index.html -->\n${split.html}`;
  }
  if (target === "jsdom") return genJSDOM(nodes);
  if (target === "jsx") return `export default function Page() {\n  return (\n    <>\n${genJSX(nodes, 3)}    </>\n  );\n}\n`;
  if (target === "java") {
    const split = genCSS(nodes);
    return genJava(source, split.html, split.css);
  }
  if (target === "pug") return genPug(nodes, 0);
  if (target === "md") return `${genMD(nodes).replace(/\n{3,}/g, "\n\n").trim()}\n`;
  if (target === "json") return JSON.stringify({ tool: "emoji-coder", source, keys, ast: nodes, html }, null, 2);
  if (target === "emoji") return source;
  return html;
}

export function compileParts(source, keys) {
  const nodes = createCompiler(keys).ast(source);
  return { nodes, html: genHTML(nodes), split: genCSS(nodes), jsx: genJSX(nodes, 3) };
}

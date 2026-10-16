import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
export const dataDir = path.join(root, "data");
export const projectDir = path.join(dataDir, "projects");
export const runtimeDir = path.join(dataDir, "runtime");
export const publishedDir = path.join(dataDir, "published");

export const sessions = new Map();
const runs = new Map();

export function ensureDirs() {
  for (const dir of [projectDir, runtimeDir, publishedDir]) fs.mkdirSync(dir, { recursive: true });
}

export function safeJoin(base, rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0")) throw new Error("Bad path");
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.split("/").some((part) => part === ".." || part === ".")) {
    if (cleaned.split("/").includes("..")) throw new Error("Bad path");
  }
  if (path.isAbsolute(rel)) throw new Error("Bad path");
  const target = path.resolve(base, cleaned);
  const baseResolved = path.resolve(base);
  if (target !== baseResolved && !target.startsWith(baseResolved + path.sep)) throw new Error("Bad path");
  return target;
}

export function writeTree(dest, files) {
  fs.mkdirSync(dest, { recursive: true });
  for (const [rel, content] of Object.entries(files || {})) {
    if (typeof content !== "string") continue;
    if (rel.split("/").includes("..")) continue;
    const target = safeJoin(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

export function vendorSources() {
  const nm = path.join(root, "node_modules");
  return {
    "react.js": path.join(nm, "react/umd/react.production.min.js"),
    "react-dom.js": path.join(nm, "react-dom/umd/react-dom.production.min.js"),
    "babel.js": path.join(nm, "@babel/standalone/babel.min.js")
  };
}

export function copyVendor(dest) {
  const dir = path.join(dest, ".vendor");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, src] of Object.entries(vendorSources())) {
    if (!fs.existsSync(src)) throw new Error("Missing " + name + ". Run npm install in the studio.");
    fs.copyFileSync(src, path.join(dir, name));
  }
}

function bucket(id) {
  if (!runs.has(id)) runs.set(id, { logs: [], proc: null, profile: null, port: null, docker: false, restarts: 0 });
  return runs.get(id);
}

function pushLog(id, line) {
  const rec = bucket(id);
  String(line).split(/\r?\n/).filter(Boolean).forEach((entry) => {
    rec.logs.push({ time: Date.now(), line: entry.slice(0, 2000) });
  });
  if (rec.logs.length > 500) rec.logs.splice(0, rec.logs.length - 500);
}

export function logsFor(id) {
  return bucket(id).logs;
}

export function isRunning(rec) {
  return !!(rec?.proc && rec.proc.exitCode == null && !rec.proc.killed);
}

export function runtimeStatus(id) {
  const rec = bucket(id);
  return {
    live: sessions.has(id),
    profile: rec.profile,
    port: rec.port,
    running: isRunning(rec) || rec.docker,
    pid: rec.proc?.pid || null,
    docker: rec.docker
  };
}

export function stopRuntime(id) {
  const rec = bucket(id);
  rec.restarts = 99;
  if (rec.proc && isRunning(rec)) rec.proc.kill("SIGTERM");
  rec.proc = null;
  if (rec.docker) {
    const cwd = path.join(runtimeDir, id);
    const child = spawn("docker", ["compose", "down"], { cwd });
    child.stdout?.on("data", (buf) => pushLog(id, buf));
    child.stderr?.on("data", (buf) => pushLog(id, buf));
    rec.docker = false;
  }
  rec.profile = null;
}

export function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export function startNode(id, { port, maxMemory, env, entry, restart }) {
  const cwd = path.join(runtimeDir, id);
  const rec = bucket(id);
  rec.profile = "node";
  rec.port = port;
  rec.docker = false;
  rec.restarts = 0;
  const args = [];
  const memory = Number(maxMemory) || 0;
  if (memory >= 128 && memory <= 4096) args.push(`--max-old-space-size=${memory}`);
  args.push(entry);
  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      NODE_PATH: path.join(root, "node_modules")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  rec.proc = child;
  pushLog(id, `node ${args.join(" ")} on 127.0.0.1:${port}`);
  child.stdout.on("data", (buf) => pushLog(id, buf));
  child.stderr.on("data", (buf) => pushLog(id, buf));
  child.on("exit", (code) => {
    pushLog(id, `process exited ${code}`);
    if (rec.proc !== child) return;
    if (restart && rec.restarts < 4 && code) {
      rec.restarts += 1;
      pushLog(id, `restart ${rec.restarts}/4`);
      setTimeout(() => startNode(id, { port, maxMemory, env, entry, restart: true }), 700);
    }
  });
  return rec;
}

export function startTask(id, command, args) {
  const cwd = path.join(runtimeDir, id);
  const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  pushLog(id, [command, ...args].join(" "));
  child.stdout.on("data", (buf) => pushLog(id, buf));
  child.stderr.on("data", (buf) => pushLog(id, buf));
  child.on("exit", (code) => pushLog(id, `${command} exited ${code}`));
  return child;
}

export function startDocker(id, port) {
  const cwd = path.join(runtimeDir, id);
  const rec = bucket(id);
  rec.profile = "docker";
  rec.port = port;
  const child = spawn("docker", ["compose", "up", "--build", "-d"], {
    cwd,
    env: { ...process.env, PORT: String(port) }
  });
  rec.proc = child;
  pushLog(id, `docker compose up --build -d (host port ${port})`);
  child.stdout.on("data", (buf) => pushLog(id, buf));
  child.stderr.on("data", (buf) => pushLog(id, buf));
  child.on("exit", (code) => {
    rec.docker = code === 0;
    rec.proc = null;
    pushLog(id, code === 0 ? "docker compose is up" : `docker compose failed (${code})`);
  });
}

export function commandVersion(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 4000 }, (error, stdout, stderr) => {
      if (error) return resolve("");
      resolve((stdout || stderr || "").trim().split("\n")[0]);
    });
  });
}

export const STATIC_SERVER = `const http = require("http");
const fs = require("fs");
const path = require("path");
const port = Number(process.env.PORT) || 4180;
const root = path.resolve(__dirname);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = url === "/" ? "/index.html" : url;
  const target = path.resolve(root, "." + rel);
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log("static server http://127.0.0.1:" + port));
`;

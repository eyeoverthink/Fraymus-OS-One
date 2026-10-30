// Smoke test: starts the portal over stdio and over HTTP, calls every tool
// against a running studio (npm start in the repo root), and prints a table of
// what worked, what failed and why. Run: node test/smoke.mjs
// Env: FRAYMUS_STUDIO_URL (default http://127.0.0.1:4177), SMOKE_SKIP_RENDER=1
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { verifyLedger } from "../src/receipts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalDir = path.resolve(here, "..");
const repo = path.resolve(portalDir, "..");
const receipts = path.join(os.tmpdir(), `portal-smoke-${Date.now()}.jsonl`);
const photo = path.join(repo, "docs/showcase/8bit-photo.jpg");
const env = { ...process.env, PORTAL_RECEIPTS: receipts };

const slug = `portal-smoke-${Date.now().toString(36)}`;
const projectId = `portalsmoke${Date.now().toString(36)}`;
const plan = [
  ["studio_health", {}],
  ["brain_status", {}],
  ["brain_memory_get", {}],
  ["brain_think", { goal: "8 / 2" }],
  ["brain_think", { goal: "14 - 9", persist: true }],
  ["brain_cortex_chat", { prompt: "Say hello in five words." }],
  ["opeg_protocol", {}],
  ["opeg_execute", { goal: "Find the exceptional point of the PT-symmetric 3x3 Hamiltonian", g: 1, gamma: 1.4142135623730951, epsilon: 1e-9 }],
  ["project_create", { id: projectId, name: "portal smoke", html: "<h1>Fraymus Portal</h1>", css: "h1{color:#3dff9a}", js: "console.log('portal')" }],
  ["project_list", {}],
  ["project_get", { id: projectId }],
  ["site_publish", { slug, project_id: projectId }],
  ["export_zip", { project_id: projectId, name: "portal-smoke" }],
  ["pixel_convert", { path: photo }],
  ["pixel_video", { path: photo }],
  ["mail_list", {}]
];
if (!process.env.SMOKE_SKIP_RENDER) plan.push(["pixel_render", { image_path: photo, mode: "real", seed: 7 }]);

function parse(result) {
  const text = result.content?.find((c) => c.type === "text")?.text || "";
  try { return JSON.parse(text); } catch { return { text }; }
}

function brief(name, data) {
  if (data.error) return data.error.slice(0, 160);
  switch (name) {
    case "studio_health": return `node ${data.system?.node} on ${data.system?.platform}`;
    case "brain_status": return `ollamaOnline=${data.ollamaOnline} models=${data.models?.length}`;
    case "brain_memory_get": return `orbits=${data.orbitCount ?? "-"} mind=${data.mind ? JSON.stringify(data.mind.opcodes) : "none"}`;
    case "brain_think": return `${data.verdict} got=${data.got} expected=${data.expected} persisted=${data.persisted} table=${JSON.stringify(data.opcodes)}`;
    case "opeg_protocol": return `enforced=${data.ok}`;
    case "opeg_execute": return `status=${data.status} receipt=${data.R_san?.receipt_id || "-"}`;
    case "project_list": return `${data.projects?.length} projects`;
    case "project_get": return `name=${data.name} stack=${data.stack}`;
    case "project_create": return `id=${data.id}`;
    case "site_publish": return data.fullUrl;
    default: return data.path ? `${data.path} (${data.bytes} B)` : JSON.stringify(data).slice(0, 160);
  }
}

async function runPlan(client, label) {
  const rows = [];
  for (const [name, args] of plan) {
    const t0 = Date.now();
    let data;
    let isError = false;
    try {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 200000 });
      data = parse(res);
      isError = Boolean(res.isError);
    } catch (error) {
      data = { error: error.message };
      isError = true;
    }
    rows.push({ via: label, tool: name, ok: !isError, ms: Date.now() - t0, detail: brief(name, data) });
  }
  return rows;
}

// 1. stdio
const stdio = new Client({ name: "portal-smoke", version: "0.1.0" });
await stdio.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(portalDir, "src/server.js")], env, stderr: "ignore" }));
const listed = await stdio.listTools();
console.log(`stdio: ${listed.tools.length} tools: ${listed.tools.map((t) => t.name).join(", ")}`);
const rows = await runPlan(stdio, "stdio");
await stdio.close();

// 2. HTTP with a throwaway token
const token = crypto.randomBytes(16).toString("hex");
const port = 4190 + Math.floor(Math.random() * 50);
const child = spawn(process.execPath, [path.join(portalDir, "src/server.js"), "--http"], {
  env: { ...env, PORTAL_TOKEN: token, PORTAL_PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"]
});
await new Promise((resolve, reject) => {
  child.stderr.on("data", (d) => { if (String(d).includes("HTTP on")) resolve(); });
  child.on("exit", (code) => reject(new Error(`portal exited ${code}`)));
  setTimeout(() => reject(new Error("portal HTTP did not start")), 8000);
});
const base = `http://127.0.0.1:${port}`;
const httpChecks = [];
const noAuth = await fetch(`${base}/tools`);
httpChecks.push(["/tools without token is 401", noAuth.status === 401]);
const badHost = await new Promise((resolve) => {
  const req = http.request({ host: "127.0.0.1", port, path: "/health", headers: { authorization: `Bearer ${token}`, host: "evil.example" } }, (r) => { r.resume(); resolve({ status: r.statusCode }); });
  req.on("error", () => resolve({ status: 0 }));
  req.end();
});
httpChecks.push(["foreign Host header is refused", badHost.status === 403]);
const jsonTools = await (await fetch(`${base}/tools`, { headers: { authorization: `Bearer ${token}` } })).json();
httpChecks.push([`/tools lists ${jsonTools.tools?.length} tools`, jsonTools.tools?.length === listed.tools.length]);
const jsonCall = await (await fetch(`${base}/tools/brain_think`, {
  method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ goal: "6 * 7" })
})).json();
httpChecks.push([`POST /tools/brain_think 6 * 7 -> ${jsonCall.result?.verdict} ${jsonCall.result?.got}`, jsonCall.ok && jsonCall.result?.got === 42]);
const remote = new Client({ name: "portal-smoke-http", version: "0.1.0" });
await remote.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
const remoteTools = await remote.listTools();
const opeg = parse(await remote.callTool({ name: "opeg_protocol", arguments: {} }));
httpChecks.push([`MCP over HTTP: ${remoteTools.tools.length} tools, opeg_protocol enforced=${opeg.ok}`, remoteTools.tools.length === listed.tools.length && opeg.ok === true]);
await remote.close();
const chain = await (await fetch(`${base}/receipts/verify`, { headers: { authorization: `Bearer ${token}` } })).json();
child.kill();

// 3. receipts
const ledger = verifyLedger(receipts);
const lines = fs.readFileSync(receipts, "utf8").trim().split("\n");
const leaked = lines.some((line) => line.includes(token) || line.includes("Fraymus Portal"));

console.log("\nTool calls");
console.table(rows.map(({ via, tool, ok, ms, detail }) => ({ via, tool, ok, ms, detail })));
console.log("HTTP checks");
for (const [label, pass] of httpChecks) console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
console.log(`Receipts: ${ledger.count} lines, chain ${ledger.ok ? "intact" : "BROKEN " + ledger.reason}, head ${String(ledger.head).slice(0, 16)}; HTTP verify ok=${chain.ok}; raw args in file: ${leaked ? "YES (bad)" : "no"}`);
console.log(`Receipt file: ${receipts}`);
const hardFail = !ledger.ok || leaked || httpChecks.some(([, pass]) => !pass);
process.exit(hardFail ? 1 : 0);

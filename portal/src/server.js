#!/usr/bin/env node
// Fraymus Portal. Default: MCP over stdio. --http: MCP over streamable HTTP at
// /mcp plus a plain JSON endpoint at /tools, bound to 127.0.0.1 only.
import http from "node:http";
import crypto from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TOOLS } from "./tools.js";
import { buildMcpServer, callTool, log, RECEIPTS_FILE } from "./portal.js";
import { verifyLedger } from "./receipts.js";
import { studioBase, studioToken } from "./studio.js";
import { z } from "zod";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORTAL_PORT) || 4191; // 4190 is on the WHATWG fetch blocked-port list
const TOKEN = process.env.PORTAL_TOKEN || "";
const LOCAL_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`,
  ...String(process.env.PORTAL_ALLOWED_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean)]);

function authorized(req) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : String(req.headers["x-portal-token"] || "");
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function toolList() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(z.object(t.input)) }));
}

async function handle(req, res) {
  // DNS-rebinding guard: only loopback Host headers, and no foreign browser Origins.
  if (!LOCAL_HOSTS.has(String(req.headers.host || ""))) return send(res, 403, { error: "Host not allowed" });
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return send(res, 403, { error: "Origin not allowed" });
  if (!authorized(req)) return send(res, 401, { error: "Missing or wrong portal token" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/health" && req.method === "GET") {
    return send(res, 200, { ok: true, studio: studioBase(), tools: TOOLS.length, auth: Boolean(TOKEN), studioToken: Boolean(studioToken()) });
  }
  if (url.pathname === "/receipts/verify" && req.method === "GET") {
    return send(res, 200, verifyLedger(RECEIPTS_FILE));
  }
  if (url.pathname === "/tools" && req.method === "GET") return send(res, 200, { tools: toolList() });
  const m = url.pathname.match(/^\/tools\/([a-z_]+)$/);
  if (m && req.method === "POST") {
    try {
      const out = await callTool(m[1], await readJson(req));
      return send(res, out.ok ? 200 : 502, { ok: out.ok, result: out.data, image: out.image, receipt: out.receipt });
    } catch (error) {
      return send(res, error.status || 400, { ok: false, error: error.issues ? error.issues : error.message });
    }
  }
  if (url.pathname === "/mcp") {
    if (req.method !== "POST") return send(res, 405, { error: "Stateless MCP: POST only" });
    let body;
    try { body = await readJson(req); } catch (error) { return send(res, error.status || 400, { error: error.message }); }
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }
  send(res, 404, { error: "Not found" });
}

async function main() {
  const httpMode = process.argv.includes("--http");
  if (httpMode) {
    http.createServer((req, res) => {
      handle(req, res).catch((error) => {
        log("request failed:", error.message);
        if (!res.headersSent) send(res, 500, { error: "Internal error" });
      });
    }).listen(PORT, HOST, () => {
      log(`HTTP on http://${HOST}:${PORT} (MCP at /mcp, JSON at /tools) studio=${studioBase()} auth=${TOKEN ? "on" : "off"}`);
    });
  }
  if (!httpMode || process.argv.includes("--stdio")) {
    await buildMcpServer().connect(new StdioServerTransport());
    log(`stdio ready, studio=${studioBase()}, ${TOOLS.length} tools`);
  }
}

main().catch((error) => {
  log("fatal:", error.message);
  process.exit(1);
});

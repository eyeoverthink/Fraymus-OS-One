/**
 * Local dispatch hub for the email watcher.
 * Binds 127.0.0.1:8787 and accepts the three routes the watcher posts to.
 *
 * © 2026 Fraymus Web Studio · FRAY 0x46524159
 */
import http from "node:http";

const FX_NUMBER = /^fx-[0-9a-f]{4}(-[0-9a-f]{4}){3}$/;
const PORT = Number(process.env.HUB_PORT || 8787);
const HOST = "127.0.0.1";
const ROUTES = new Set(["/api/dispatch", "/api/fraynix/feel", "/api/mail/forward"]);

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || !ROUTES.has(req.url)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { body = { raw: Buffer.concat(chunks).toString("utf8") }; }
  const to = body.dispatchTo || body.to || "";
  if (req.url === "/api/dispatch" && to !== "BROADCAST" && !FX_NUMBER.test(to)) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "recipient must be a FRAYMUS number fx-xxxx-xxxx-xxxx-xxxx" }));
    return;
  }
  console.log(`${new Date().toISOString()} ${req.url} from=${body.from || "?"} to=${to || "?"} subject=${body.subject || ""}`);
  const reply = req.url === "/api/fraynix/feel"
    ? { ok: true, quick: "received", primary: `felt ${to}`, intensity: 1 }
    : { ok: true, to, accepted: true };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(reply));
});

server.listen(PORT, HOST, () => {
  console.log(`Fraymus hub http://${HOST}:${PORT}`);
});

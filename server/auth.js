// Studio login. On by default: every /api and /live request needs the studio token,
// sent as "Authorization: Bearer <token>", "X-Studio-Token: <token>", or the
// fraymus_studio cookie that /login sets. Requests must use a loopback Host, and a
// browser Origin must be one of the studio's own (4177 and the Vite UI on 5173).
//
//   STUDIO_TOKEN            use this token instead of the generated one
//   STUDIO_TOKEN_FILE       where the generated token lives (default data/studio-token, mode 600, git-ignored)
//   STUDIO_AUTH=off         turn the login off (prints a warning)
//   STUDIO_ALLOWED_ORIGINS  extra comma-separated browser origins
//   STUDIO_ALLOWED_HOSTS    extra comma-separated Host headers (host:port)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const COOKIE = "fraymus_studio";
export const TOKEN_FILE = path.resolve(process.env.STUDIO_TOKEN_FILE || path.join("data", "studio-token"));

function list(value) {
  return String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function loadToken() {
  if (process.env.STUDIO_TOKEN) return { token: process.env.STUDIO_TOKEN, source: "STUDIO_TOKEN" };
  try {
    const saved = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (saved.length >= 16) return { token: saved, source: TOKEN_FILE };
  } catch { /* make one below */ }
  const token = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600 });
  return { token, source: `${TOKEN_FILE} (new)` };
}

function same(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return "";
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

function safeNext(value) {
  const next = String(value || "/");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

function loginPage(next, failed) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fraymus studio login</title><style>body{font:15px system-ui,sans-serif;background:#0b0f14;color:#d8e2ec;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#121a23;padding:28px;border-radius:12px;width:min(420px,90vw)}input{width:100%;box-sizing:border-box;padding:10px;margin:12px 0;border-radius:8px;border:1px solid #2a3a4a;background:#0b0f14;color:inherit;font-family:monospace}
button{padding:10px 18px;border:0;border-radius:8px;background:#3dff9a;color:#04110a;font-weight:600;cursor:pointer}.err{color:#ff7a7a}code{color:#9fd}</style></head>
<body><form method="post" action="/login"><h2>Fraymus studio</h2>
<p>Paste the studio token. It is in <code>data/studio-token</code> in the repo (or your <code>STUDIO_TOKEN</code>).</p>
${failed ? "<p class=\"err\">That token is not right.</p>" : ""}
<input type="password" name="token" autocomplete="current-password" autofocus required placeholder="studio token">
<input type="hidden" name="next" value="${escapeHtml(next)}"><button type="submit">Open the studio</button></form></body></html>`;
}

export function installAuth(app, { port, uiPorts = [5173] }) {
  const enabled = !/^(off|0|false|no)$/i.test(String(process.env.STUDIO_AUTH || "on"));
  const ports = [port, ...uiPorts];
  const origins = new Set([...ports.flatMap((p) => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]), ...list(process.env.STUDIO_ALLOWED_ORIGINS)]);
  const hosts = new Set([...ports.flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`]), ...list(process.env.STUDIO_ALLOWED_HOSTS)]);
  const { token, source } = enabled ? loadToken() : { token: "", source: "off" };
  // The cookie carries a value derived from the token, not the token itself.
  const session = enabled ? crypto.createHmac("sha256", token).update("fraymus-studio-session").digest("hex") : "";

  const originAllowed = (origin) => !origin || origins.has(origin);

  // DNS-rebinding and cross-origin guard, before CORS and auth.
  app.use((req, res, next) => {
    if (!hosts.has(String(req.headers.host || ""))) return res.status(403).json({ error: "Host not allowed" });
    if (!originAllowed(req.headers.origin)) return res.status(403).json({ error: "Origin not allowed" });
    next();
  });

  // Tight CORS: only the studio's own origins, never "accept any".
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type,Authorization,X-Studio-Token");
        res.setHeader("Access-Control-Max-Age", "600");
        return res.status(204).end();
      }
    }
    next();
  });

  const authed = (req) => {
    if (!enabled) return true;
    const header = String(req.headers.authorization || "");
    if (header.startsWith("Bearer ") && same(header.slice(7), token)) return true;
    if (req.headers["x-studio-token"] && same(req.headers["x-studio-token"], token)) return true;
    return same(readCookie(req, COOKIE), session);
  };

  const setCookie = (res) => res.setHeader("Set-Cookie",
    `${COOKIE}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 3600}`);

  app.get("/login", (req, res) => {
    const next = safeNext(req.query.next);
    if (!enabled || authed(req)) return res.redirect(next);
    res.type("html").send(loginPage(next, false));
  });

  app.post("/login", (req, res, next) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
    req.on("end", () => {
      const form = new URLSearchParams(raw);
      const dest = safeNext(form.get("next"));
      if (!enabled) return res.redirect(303, dest);
      if (!same(String(form.get("token") || "").trim(), token)) return res.status(401).type("html").send(loginPage(dest, true));
      setCookie(res);
      res.redirect(303, dest);
    });
    req.on("error", next);
  });

  app.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  // Open: liveness, published sites, vendored libraries, built UI assets.
  const open = (p) => p === "/api/health" || p === "/api/auth/status" || p.startsWith("/published/") || p.startsWith("/vendor/") || p.startsWith("/assets/") || p === "/favicon.ico";

  app.get("/api/auth/status", (req, res) => res.json({ enabled, authed: authed(req), login: "/login" }));

  app.use((req, res, next) => {
    if (open(req.path) || authed(req)) return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/live")) {
      return res.status(401).json({ error: "Studio login required. Open /login or send the studio token.", auth: "required", login: "/login" });
    }
    if (req.method === "GET" && String(req.headers.accept || "").includes("text/html")) {
      return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    res.status(401).json({ error: "Studio login required.", auth: "required", login: "/login" });
  });

  return { enabled, source, tokenFile: TOKEN_FILE };
}

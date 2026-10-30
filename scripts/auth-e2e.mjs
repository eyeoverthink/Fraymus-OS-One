// Studio login checks against a running server (npm start). Never prints the token.
// Run: node scripts/auth-e2e.mjs   Env: STUDIO_URL (default http://127.0.0.1:4177)
import fs from "node:fs";
import http from "node:http";

const base = process.env.STUDIO_URL || "http://127.0.0.1:4177";
const token = (process.env.STUDIO_TOKEN || fs.readFileSync(process.env.STUDIO_TOKEN_FILE || "data/studio-token", "utf8")).trim();
let failed = 0;
const check = (label, pass) => { console.log(`${pass ? "PASS" : "FAIL"}  ${label}`); if (!pass) failed += 1; };
const raw = (path, headers) => new Promise((resolve) => {
  const u = new URL(base + path);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, headers }, (r) => { r.resume(); resolve(r.statusCode); });
  req.on("error", () => resolve(0));
  req.end();
});

check("GET /api/health is open", (await fetch(`${base}/api/health`)).status === 200);
const no = await fetch(`${base}/api/projects`);
check(`GET /api/projects without token -> ${no.status}`, no.status === 401 && (await no.json()).auth === "required");
check("wrong bearer -> 401", (await fetch(`${base}/api/projects`, { headers: { Authorization: "Bearer nope" } })).status === 401);
check("bearer token -> 200", (await fetch(`${base}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })).status === 200);
check("X-Studio-Token -> 200", (await fetch(`${base}/api/projects`, { headers: { "X-Studio-Token": token } })).status === 200);
check("foreign Origin -> 403", (await fetch(`${base}/api/projects`, { headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example" } })).status === 403);
check("other local port Origin -> 403", (await fetch(`${base}/api/projects`, { headers: { Authorization: `Bearer ${token}`, Origin: "http://127.0.0.1:9999" } })).status === 403);
const ok5173 = await fetch(`${base}/api/projects`, { headers: { Authorization: `Bearer ${token}`, Origin: "http://127.0.0.1:5173" } });
check("Vite UI Origin -> 200 with exact CORS echo", ok5173.status === 200 && ok5173.headers.get("access-control-allow-origin") === "http://127.0.0.1:5173");
check("foreign Host (DNS rebinding) -> 403", (await raw("/api/health", { host: "evil.example:4177" })) === 403);
check("/live without login -> 401", (await fetch(`${base}/live/abcd/api/health`)).status === 401);
const page = await fetch(`${base}/login`);
check("GET /login serves the form", page.status === 200 && (await page.text()).includes("name=\"token\""));
const bad = await fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "token=wrong&next=/" });
check("POST /login wrong token -> 401, no cookie", bad.status === 401 && !bad.headers.get("set-cookie"));
const good = await fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token, next: "//evil.example" }).toString() });
const cookie = (good.headers.get("set-cookie") || "").split(";")[0];
check("POST /login right token -> 303 + HttpOnly SameSite=Strict cookie, open redirect blocked",
  good.status === 303 && good.headers.get("location") === "/" && /HttpOnly/.test(good.headers.get("set-cookie")) && /SameSite=Strict/.test(good.headers.get("set-cookie")));
check("cookie does not contain the token", !cookie.includes(token));
check("cookie session -> /api/projects 200", (await fetch(`${base}/api/projects`, { headers: { cookie } })).status === 200);
const status = await (await fetch(`${base}/api/auth/status`, { headers: { cookie } })).json();
check("/api/auth/status authed with cookie", status.enabled === true && status.authed === true);
console.log(failed ? `\n${failed} failed` : "\nall studio auth checks passed");
process.exitCode = failed ? 1 : 0;

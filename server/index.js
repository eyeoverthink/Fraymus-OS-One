import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import express from "express";
import cors from "cors";
import archiver from "archiver";
import mongoose from "mongoose";
import { createGmail } from "./gmailBox.js";
import { createStore } from "./mailbox.js";
import {
  STATIC_SERVER,
  commandVersion,
  copyVendor,
  ensureDirs,
  logsFor,
  portFree,
  projectDir,
  publishedDir,
  runtimeDir,
  runtimeStatus,
  safeJoin,
  sessions,
  startDocker,
  startNode,
  startTask,
  stopRuntime,
  vendorSources,
  writeTree
} from "./runtime.js";

ensureDirs();
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "12mb" }));

const PORT = Number(process.env.FRAYMUS_PORT) || 4177;
let ProjectModel = null;
let mongoState = "off";

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    mongoState = "connected";
    ProjectModel = mongoose.models.StudioProject || mongoose.model("StudioProject", new mongoose.Schema({
      projectId: { type: String, unique: true },
      doc: mongoose.Schema.Types.Mixed,
      updatedAt: Date
    }, { collection: "fraymus_projects" }));
    console.log("studio mongo connected");
  }).catch((error) => {
    mongoState = "error";
    console.warn("studio mongo skipped:", error.message);
  });
}

function validId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{4,80}$/.test(id);
}

function readProjects() {
  return fs.readdirSync(projectDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(projectDir, name), "utf8")))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function writeProject(doc) {
  if (!validId(doc.id)) throw new Error("Bad project id");
  const file = safeJoin(projectDir, `${doc.id}.json`);
  const next = { ...doc, updatedAt: Date.now() };
  const raw = JSON.stringify(next);
  if (raw.length > 8_000_000) throw new Error("Project is too large");
  fs.writeFileSync(file, raw);
  if (ProjectModel) {
    ProjectModel.findOneAndUpdate(
      { projectId: next.id },
      { projectId: next.id, doc: next, updatedAt: new Date(next.updatedAt) },
      { upsert: true }
    ).catch(() => {});
  }
  return next;
}

function cleanEnv(input) {
  const env = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue;
    if (["PATH", "NODE_OPTIONS", "LD_PRELOAD", "NODE_PATH"].includes(key)) continue;
    env[key] = String(value ?? "").slice(0, 800);
  }
  return env;
}

function sessionOr404(req, res) {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Live server is not running for this project." });
    return null;
  }
  return session;
}

const PIXEL_SPACE = process.env.FRAYMUS_PIXEL_SPACE || "prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast";
const PIXEL_STYLE = "8-bit pixel art bust portrait, chunky square pixels, hard black outlines, flat cel shading, "
  + "limited retro palette, solid black background, head and shoulders centered, straight-on camera, "
  + "small glowing cyan highlight pixels on the edges like a cyberpunk game sprite";
const PIXEL_SKIN = "Keep the person's exact natural skin tone, complexion and ethnicity from the photo, same depth and warmth; do not lighten, whiten or darken the skin";
let pixelClient = null;

function hfToken() {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN.trim();
  const file = path.join(process.cwd(), "hf-token.txt");
  try {
    const raw = fs.readFileSync(file, "utf8");
    const match = raw.match(/hf_[A-Za-z0-9]+/);
    return match ? match[0] : undefined;
  } catch {
    return undefined;
  }
}

function base64Image(value) {
  if (typeof value !== "string") return null;
  const raw = value.includes(",") ? value.split(",").pop() : value;
  if (!/^[A-Za-z0-9+/=]+$/.test(raw) || raw.length > 9_000_000) return null;
  return raw;
}

function pixelPrompt(mode, hasStyle, extra) {
  const note = String(extra || "").replace(/[\r\n]+/g, " ").slice(0, 240);
  const style = hasStyle ? `Match the drawing style of image 2 only. ${PIXEL_STYLE}.` : `${PIXEL_STYLE}.`;
  const look = mode === "avatar"
    ? "Give the person a dark gray fedora, black sunglasses with small cyan highlights, and a navy jacket with glowing cyan trim. Keep their face shape, beard and hair."
    : "Keep their real clothes, hat, hair, beard and any shirt graphics exactly as in the photo.";
  return `Convert the person in image 1 into an ${style} Remove the room and background completely. ${look} ${PIXEL_SKIN}. ${note}`.trim();
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 45000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).trim()));
      else resolve(stdout);
    });
  });
}

app.post("/api/pixel/convert", express.raw({ type: () => true, limit: "60mb" }), async (req, res) => {
  if (!req.body?.length) return res.status(400).json({ error: "The file was empty." });
  const name = String(req.get("x-file-name") || "upload").replace(/[^\w.\-]+/g, "_").slice(-80);
  const ext = path.extname(name).toLowerCase() || ".bin";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fraymus-convert-"));
  const input = path.join(dir, `in${ext}`);
  const output = path.join(dir, "out.png");
  fs.writeFileSync(input, req.body);
  try {
    let made = false;
    if (process.platform === "darwin") {
      try {
        const dims = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", input]).catch(() => "");
        const side = Math.max(...[...dims.matchAll(/pixel(?:Width|Height):\s*(\d+)/g)].map((m) => Number(m[1])), 0);
        const resize = side > 2048 ? ["-Z", "2048"] : [];
        await run("sips", ["-s", "format", "png", ...resize, input, "--out", output]);
        made = fs.existsSync(output) && fs.statSync(output).size > 0;
      } catch {}
      if (!made) {
        await run("qlmanage", ["-t", "-s", "1600", "-o", dir, input]).catch(() => {});
        const thumb = fs.readdirSync(dir).find((file) => file.startsWith("in") && file.endsWith(".png"));
        if (thumb) {
          fs.renameSync(path.join(dir, thumb), output);
          made = true;
        }
      }
    }
    if (!made) throw new Error(`Could not read ${ext.slice(1).toUpperCase() || "that"} files on this machine.`);
    res.json({ image: `data:image/png;base64,${fs.readFileSync(output).toString("base64")}` });
  } catch (error) {
    res.status(415).json({ error: error.message });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

app.post("/api/pixel/render", async (req, res) => {
  const photo = base64Image(req.body?.image);
  if (!photo) return res.status(400).json({ error: "Send the photo as a base64 image." });
  const style = base64Image(req.body?.style);
  const mode = req.body?.mode === "avatar" ? "avatar" : "real";
  const seed = Number.isInteger(req.body?.seed) ? req.body.seed : Math.floor(Math.random() * 100000);
  try {
    const { Client } = await import("@gradio/client");
    const token = hfToken();
    if (!pixelClient) pixelClient = await Client.connect(PIXEL_SPACE, token ? { token } : {});
    const images = style ? [photo, style] : [photo];
    const result = await pixelClient.predict("/edit_image", {
      images_b64_json: JSON.stringify(images),
      prompt: pixelPrompt(mode, Boolean(style), req.body?.note),
      seed,
      randomize_seed: false,
      width: 1024,
      height: 1024,
      steps: 4,
      guidance_scale: 1.0
    });
    const image = result?.data?.[0]?.image;
    if (typeof image !== "string") throw new Error("The model returned no image.");
    res.json({ image: image.startsWith("data:") ? image : `data:image/png;base64,${image}`, seed, mode });
  } catch (error) {
    pixelClient = null;
    const message = error?.message || String(error);
    const quota = /quota|GPU|exceeded/i.test(message);
    res.status(quota ? 429 : 502).json({
      error: quota ? "The free AI queue is out of GPU time. Put your Hugging Face token in hf-token.txt or try again later." : message
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, mongo: mongoState, port: PORT });
});

const mailDir = path.join(process.cwd(), "data", "mailbox");
const mailbox = createStore(mailDir);
const gmail = createGmail(mailDir);
const mailFail = (res, error) => res.status(error.status || 500).json({ error: error.message || "Mail request failed" });

app.get("/api/mail/status", (_req, res) => {
  res.json(mailbox.status());
});

app.get("/api/mail/messages", (req, res) => {
  try { res.json({ messages: mailbox.list(String(req.query.folder || "inbox"), req.query.q) }); }
  catch (error) { mailFail(res, error); }
});

app.get("/api/mail/messages/:id", (req, res) => {
  try { res.json(mailbox.get(req.params.id)); }
  catch (error) { mailFail(res, error); }
});

app.post("/api/mail/messages", (req, res) => {
  try { res.status(201).json(mailbox.add(req.body || {}, req.body?.folder)); }
  catch (error) { mailFail(res, error); }
});

app.patch("/api/mail/messages/:id", (req, res) => {
  try { res.json(mailbox.patch(req.params.id, req.body || {})); }
  catch (error) { mailFail(res, error); }
});

app.delete("/api/mail/messages/:id", (req, res) => {
  try { res.json(mailbox.remove(req.params.id)); }
  catch (error) { mailFail(res, error); }
});

app.post("/api/mail/import", (req, res) => {
  try { res.json(mailbox.importText(req.body?.text, req.body?.folder || "inbox")); }
  catch (error) { mailFail(res, error); }
});

app.get("/api/mail/gmail/status", async (_req, res) => {
  try { res.json(await gmail.status()); }
  catch (error) { mailFail(res, error); }
});

app.post("/api/mail/gmail/connect", async (req, res) => {
  try { res.json(await gmail.connect(req.body?.user, req.body?.pass)); }
  catch (error) { mailFail(res, error); }
});

app.delete("/api/mail/gmail/connect", (_req, res) => {
  res.json(gmail.disconnect());
});

app.get("/api/mail/gmail/messages", async (req, res) => {
  try { res.json({ messages: await gmail.list(String(req.query.folder || "inbox"), req.query.q) }); }
  catch (error) { mailFail(res, error); }
});

app.get("/api/mail/gmail/messages/:id", async (req, res) => {
  try { res.json(await gmail.get(req.params.id)); }
  catch (error) { mailFail(res, error); }
});

app.post("/api/mail/gmail/messages", async (req, res) => {
  try { res.status(201).json(await gmail.add(req.body || {}, req.body?.folder)); }
  catch (error) { mailFail(res, error); }
});

app.patch("/api/mail/gmail/messages/:id", async (req, res) => {
  try { res.json(await gmail.patch(req.params.id, req.body || {})); }
  catch (error) { mailFail(res, error); }
});

app.delete("/api/mail/gmail/messages/:id", async (req, res) => {
  try { res.json(await gmail.remove(req.params.id)); }
  catch (error) { mailFail(res, error); }
});

app.post("/api/mail/gmail/import", async (req, res) => {
  try { res.json(await gmail.importText(req.body?.text, req.body?.folder || "inbox")); }
  catch (error) { mailFail(res, error); }
});

app.get("/api/mail/gmail/export", async (req, res) => {
  try {
    const file = await gmail.exportText({ id: req.query.id, folder: String(req.query.folder || "inbox"), format: String(req.query.format || "mbox") });
    res.setHeader("Content-Type", `${file.type}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  } catch (error) { mailFail(res, error); }
});

app.get("/api/mail/export", (req, res) => {
  try {
    const file = mailbox.exportText({ id: req.query.id, folder: String(req.query.folder || "inbox"), format: String(req.query.format || "mbox") });
    res.setHeader("Content-Type", `${file.type}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  } catch (error) { mailFail(res, error); }
});

app.get("/api/system", async (req, res) => {
  const [npm, docker] = await Promise.all([
    commandVersion("npm", ["-v"]),
    commandVersion("docker", ["--version"])
  ]);
  const vendor = vendorSources();
  res.json({
    node: process.version,
    npm: npm || "not found",
    docker: docker || "",
    platform: process.platform,
    mongo: mongoState,
    vendor: Object.fromEntries(Object.entries(vendor).map(([name, file]) => [name, fs.existsSync(file)]))
  });
});

app.get("/api/projects", (req, res) => {
  res.json(readProjects());
});

app.post("/api/projects", (req, res) => {
  try {
    res.status(201).json(writeProject(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/projects/:id", (req, res) => {
  try {
    if (req.params.id !== req.body?.id) return res.status(400).json({ error: "Id mismatch" });
    res.json(writeProject(req.body));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
  const file = path.join(projectDir, `${req.params.id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  stopRuntime(req.params.id);
  sessions.delete(req.params.id);
  res.json({ ok: true });
});

app.post("/api/runtime/sync", (req, res) => {
  try {
    const id = req.body?.id;
    if (!validId(id)) return res.status(400).json({ error: "Bad id" });
    const prev = sessions.get(id);
    sessions.set(id, keepSession(prev, {
      previewHtml: String(req.body.previewHtml || prev?.previewHtml || ""),
      name: req.body.name || prev?.name || "site"
    }));
    const dest = path.join(runtimeDir, id);
    writeTree(dest, req.body.files || {});
    if (req.body.previewHtml) fs.writeFileSync(path.join(dest, "preview.html"), req.body.previewHtml);
    res.json({ ok: true, live: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/runtime/start", async (req, res) => {
  try {
    const id = req.body?.id;
    if (!validId(id)) return res.status(400).json({ error: "Bad id" });
    const profile = req.body.profile;
    if (!["live", "node", "docker"].includes(profile)) return res.status(400).json({ error: "Unknown profile" });
    const port = Number(req.body.port) || 4180;
    if (port < 1024 || port > 65535 || port === PORT || port === 5173) {
      return res.status(400).json({ error: "Pick a port between 1024 and 65535, other than the studio ports." });
    }
    const dest = path.join(runtimeDir, id);
    fs.mkdirSync(dest, { recursive: true });
    if (req.body.files) writeTree(dest, req.body.files);
    if (req.body.previewHtml) {
      fs.writeFileSync(path.join(dest, "preview.html"), req.body.previewHtml);
      const session = sessions.get(id);
      sessions.set(id, keepSession(session, {
        previewHtml: req.body.previewHtml,
        name: req.body.name || "site"
      }));
    }
    if (profile === "live") {
      stopRuntime(id);
      return res.json({ ...runtimeStatus(id), url: `/live/${id}/` });
    }
    stopRuntime(id);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await portFree(port)) break;
      if (attempt === 7) return res.status(409).json({ error: `Port ${port} is already in use.` });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (req.body.stack === "mern") {
      try { copyVendor(dest); } catch (error) {
        if (profile !== "live") return res.status(400).json({ error: error.message });
      }
    }
    if (profile === "docker") {
      if (!fs.existsSync(path.join(dest, "docker-compose.yml"))) {
        return res.status(400).json({ error: "docker-compose.yml is missing. Start again from the VM panel." });
      }
      startDocker(id, port);
      return res.json({ ...runtimeStatus(id), url: `http://127.0.0.1:${port}/` });
    }
    if (req.body.stack !== "mern") {
      try { copyVendor(dest); } catch { /* static previews that need React fall back to the studio vendor */ }
    }
    const entry = req.body.entry === "server/index.js" ? "server/index.js" : ".fraymus-static.cjs";
    if (entry === ".fraymus-static.cjs") fs.writeFileSync(path.join(dest, entry), STATIC_SERVER);
    else if (!fs.existsSync(path.join(dest, "server/index.js"))) {
      return res.status(400).json({ error: "server/index.js is missing. Switch the project to MERN or reinsert the Express server." });
    }
    if (req.body.previewHtml && entry === ".fraymus-static.cjs") {
      fs.writeFileSync(path.join(dest, "index.html"), req.body.previewHtml);
    }
    startNode(id, {
      port,
      maxMemory: Number(req.body.maxMemory) || 512,
      env: cleanEnv(req.body.env),
      entry,
      restart: !!req.body.restart
    });
    res.json({ ...runtimeStatus(id), url: `http://127.0.0.1:${port}/` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/runtime/stop", (req, res) => {
  const id = req.body?.id;
  if (!validId(id)) return res.status(400).json({ error: "Bad id" });
  if (req.body.profile === "live") sessions.delete(id);
  else stopRuntime(id);
  res.json(runtimeStatus(id));
});

app.get("/api/runtime/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
  res.json(runtimeStatus(req.params.id));
});

app.get("/api/runtime/:id/logs", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
  res.json(logsFor(req.params.id));
});

app.post("/api/node/install", (req, res) => {
  const id = req.body?.id;
  if (!validId(id)) return res.status(400).json({ error: "Bad id" });
  const dest = path.join(runtimeDir, id);
  if (!fs.existsSync(path.join(dest, "package.json"))) {
    return res.status(400).json({ error: "Sync the project before installing. package.json is written for MERN projects." });
  }
  startTask(id, "npm", ["install"]);
  res.json({ ok: true });
});

app.post("/api/node/script", (req, res) => {
  const id = req.body?.id;
  const script = String(req.body?.script || "");
  if (!validId(id)) return res.status(400).json({ error: "Bad id" });
  if (!/^[\w:-]+$/.test(script)) return res.status(400).json({ error: "Bad script name" });
  startTask(id, "npm", ["run", script]);
  res.json({ ok: true });
});

app.post("/api/publish", (req, res) => {
  try {
    const slug = String(req.body?.slug || "").toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ error: "Slug uses lowercase letters, numbers, and hyphens." });
    const dest = path.join(publishedDir, slug);
    fs.rmSync(dest, { recursive: true, force: true });
    writeTree(dest, req.body.files || {});
    res.json({ ok: true, url: `/published/${slug}/` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/export/zip", (req, res) => {
  const name = String(req.body?.name || "fraymus").replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.zip"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => {
    console.error(error);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);
  for (const [file, content] of Object.entries(req.body?.files || {})) {
    if (typeof content !== "string" || file.split("/").includes("..")) continue;
    archive.append(content, { name: file });
  }
  archive.finalize();
});

function defaultItems() {
  return [
    { id: "1", title: "Welcome record", status: "live" },
    { id: "2", title: "Edit me from the dashboard", status: "draft" }
  ];
}

function keepSession(prev, patch) {
  const items = prev?.items || defaultItems();
  const resources = { ...(prev?.resources || {}), items };
  return {
    previewHtml: patch.previewHtml ?? prev?.previewHtml ?? "",
    items,
    resources,
    name: patch.name || prev?.name || "site"
  };
}

function ensureSession(id) {
  if (!sessions.has(id)) sessions.set(id, keepSession(null, {}));
  const session = sessions.get(id);
  if (!session.resources) session.resources = { items: session.items };
  session.resources.items = session.items;
  return session;
}

function resourceBag(session, name) {
  const key = String(name || "").toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,24}$/.test(key)) {
    const error = new Error("Resource names use lowercase letters, numbers, and hyphens.");
    error.status = 400;
    throw error;
  }
  if (key === "items") return session.items;
  if (!Array.isArray(session.resources[key])) session.resources[key] = [];
  return session.resources[key];
}

function cleanRecord(body) {
  const row = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,24}$/.test(key) || key === "id") continue;
    if (typeof value === "boolean" || typeof value === "number") row[key] = value;
    else row[key] = String(value ?? "").slice(0, 500);
  }
  return row;
}

function crudError(res, error) {
  res.status(error.status || 500).json({ error: error.message || "CRUD failed" });
}

app.get("/live/:id/api/r/:resource", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    res.json(bag);
  } catch (error) { crudError(res, error); }
});

app.get("/live/:id/api/r/:resource/:itemId", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    const row = bag.find((item) => item.id === req.params.itemId);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (error) { crudError(res, error); }
});

app.post("/live/:id/api/r/:resource", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    const row = { id: String(Date.now()), ...cleanRecord(req.body) };
    if (!Object.keys(row).some((key) => key !== "id" && String(row[key]).trim())) {
      return res.status(400).json({ error: "Add at least one field value." });
    }
    bag.unshift(row);
    if (bag.length > 200) bag.pop();
    res.status(201).json(row);
  } catch (error) { crudError(res, error); }
});

app.put("/live/:id/api/r/:resource/:itemId", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    const index = bag.findIndex((item) => item.id === req.params.itemId);
    if (index < 0) return res.status(404).json({ error: "Not found" });
    const next = { id: bag[index].id, ...cleanRecord(req.body) };
    bag[index] = next;
    res.json(next);
  } catch (error) { crudError(res, error); }
});

app.patch("/live/:id/api/r/:resource/:itemId", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    const row = bag.find((item) => item.id === req.params.itemId);
    if (!row) return res.status(404).json({ error: "Not found" });
    Object.assign(row, cleanRecord(req.body));
    res.json(row);
  } catch (error) { crudError(res, error); }
});

app.delete("/live/:id/api/r/:resource/:itemId", (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const bag = resourceBag(ensureSession(req.params.id), req.params.resource);
    const index = bag.findIndex((item) => item.id === req.params.itemId);
    if (index < 0) return res.status(404).json({ error: "Not found" });
    const [removed] = bag.splice(index, 1);
    res.json({ ok: true, removed });
  } catch (error) { crudError(res, error); }
});

app.get("/live/:id/api/health", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  res.json({ ok: true, runtime: "studio-live", mongo: mongoState === "connected" ? "studio-db" : "memory", port: "live" });
});

app.get("/live/:id/api/items", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  res.json(session.items);
});

app.post("/live/:id/api/items", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });
  const row = { id: String(Date.now()), title, status: String(req.body?.status || "draft") };
  session.items.unshift(row);
  res.status(201).json(row);
});

app.put("/live/:id/api/items/:itemId", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const row = session.items.find((item) => item.id === req.params.itemId);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (req.body?.title) row.title = String(req.body.title).slice(0, 200);
  if (req.body?.status) row.status = String(req.body.status).slice(0, 40);
  res.json(row);
});

app.delete("/live/:id/api/items/:itemId", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const index = session.items.findIndex((item) => item.id === req.params.itemId);
  if (index < 0) return res.status(404).json({ error: "Not found" });
  session.items.splice(index, 1);
  res.json({ ok: true });
});

app.post("/live/:id/api/auth/login", (req, res) => {
  const session = sessionOr404(req, res);
  if (!session) return;
  const email = String(req.body?.email || "").trim();
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Enter an email address. This demo does not use a password." });
  res.json({ ok: true, token: "local-demo", email, note: "Local demo session only." });
});

app.get("/live/:id/", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session?.previewHtml) return res.status(404).type("text").send("Start the live server for this project.");
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(session.previewHtml);
});

for (const [name, file] of Object.entries(vendorSources())) {
  app.get("/vendor/" + name, (req, res) => {
    if (!fs.existsSync(file)) return res.status(404).send("Run npm install");
    res.sendFile(file);
  });
}

app.use("/published", express.static(publishedDir, { index: "index.html" }));

const dist = path.resolve("client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/live") || req.path.startsWith("/vendor")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Fraymus studio server http://127.0.0.1:${PORT}`);
});

// Every tool here wraps a route that exists in server/index.js, or a module the
// studio already ships (brainMind.js). Nothing is simulated: if the studio or a
// dependency is missing, the tool returns the real error.
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { studio } from "./studio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "..", "..");
export const OUT_DIR = path.resolve(process.env.PORTAL_OUT_DIR || path.join(here, "..", "out"));

function readInputFile(file) {
  const resolved = path.resolve(file.replace(/^~(?=$|\/)/, os.homedir()));
  const root = process.env.PORTAL_FILE_ROOT ? path.resolve(process.env.PORTAL_FILE_ROOT) : null;
  if (root && !(resolved === root || resolved.startsWith(root + path.sep))) {
    throw new Error(`Path is outside PORTAL_FILE_ROOT.`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error("Not a file.");
  return { resolved, bytes: fs.readFileSync(resolved) };
}

function imageArg(args, pathKey, b64Key) {
  if (args[b64Key]) return String(args[b64Key]);
  if (args[pathKey]) return readInputFile(args[pathKey]).bytes.toString("base64");
  return null;
}

function saveOut(prefix, ext, bytes) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${prefix}-${Date.now()}.${ext}`);
  fs.writeFileSync(file, bytes);
  return file;
}

function dataUrlBytes(dataUrl) {
  const raw = String(dataUrl).split(",").pop();
  return Buffer.from(raw, "base64");
}

function summarizeProject(p) {
  return {
    id: p.id,
    name: p.name,
    stack: p.stack,
    reactMode: Boolean(p.reactMode),
    fileCount: Object.keys(p.files || {}).length,
    pages: (p.pages || []).map((page) => page.name || page),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null
  };
}

async function loadProject(id) {
  const all = await studio("GET", "/api/projects");
  const found = all.find((p) => p.id === id);
  if (!found) throw new Error(`No project with id ${id}.`);
  return found;
}

// A plain file set for a saved project. The studio's own exporter lives in
// client/src/model.js, which uses Vite ?raw imports and cannot load in Node, so
// this is a simpler version: static projects get index.html + styles.css + app.js,
// MERN projects get their file tree plus package.json. .env is never included.
function projectFileSet(p) {
  if (p.stack === "mern") {
    const files = { ...(p.files || {}) };
    delete files[".env"];
    files["package.json"] = JSON.stringify({
      name: p.pkg?.name || "fraymus-app",
      private: true,
      version: "1.0.0",
      scripts: p.pkg?.scripts || {},
      dependencies: p.pkg?.dependencies || {}
    }, null, 2);
    return files;
  }
  const html = String(p.html || "");
  const hasDoc = /<html[\s>]/i.test(html);
  const index = hasDoc ? html : [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    `<title>${String(p.name || "fraymus").replace(/[<>&"]/g, "")}</title>`,
    "<link rel=\"stylesheet\" href=\"styles.css\"></head>",
    `<body>\n${html}\n<script src="app.js"></script>\n</body></html>`
  ].join("\n");
  return { "index.html": index, "styles.css": String(p.css || ""), "app.js": String(p.js || ""), ...(p.files || {}) };
}

async function filesFrom(args) {
  if (args.files && Object.keys(args.files).length) return args.files;
  if (args.project_id) return projectFileSet(await loadProject(args.project_id));
  throw new Error("Pass files or project_id.");
}

// Staged dry-run mind. Dry runs learn too (a miss rewrites the operator table);
// the lesson is kept here, tied to the hash of the studio's saved mind. If the saved
// mind changes (the UI or a persist run), the stage is stale and is dropped.
export const STAGED_MIND = path.join(OUT_DIR, "staged-mind.json");

function mindHash(mind) {
  const { journal, ...rest } = mind || {};
  return crypto.createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

function readStaged(baseHash) {
  try {
    const doc = JSON.parse(fs.readFileSync(STAGED_MIND, "utf8"));
    return doc.baseHash === baseHash ? doc : null;
  } catch { return null; }
}

function writeStaged(doc) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(STAGED_MIND, JSON.stringify(doc, null, 2));
}

function clearStaged() {
  fs.rmSync(STAGED_MIND, { force: true });
}

let brainMindModule = null;
async function brainMind() {
  if (!brainMindModule) brainMindModule = await import(path.join(REPO_ROOT, "client/src/tools/brainMind.js"));
  return brainMindModule;
}

const filesShape = z.record(z.string(), z.string()).optional()
  .describe("Map of relative path to file text, for example {\"index.html\": \"<h1>hi</h1>\"}.");

export const TOOLS = [
  {
    name: "studio_health",
    description: "Check that the Fraymus OS One studio server is up. Returns /api/health and /api/system (node, npm, docker, platform, Mongo state).",
    input: {},
    async run() {
      const [health, system] = await Promise.all([studio("GET", "/api/health"), studio("GET", "/api/system")]);
      return { health, system };
    }
  },
  {
    name: "brain_status",
    description: "Brain status from /api/brain/status: whether local Ollama answers on 127.0.0.1:11434, its models, and how much continuity is saved.",
    input: {},
    run: () => studio("GET", "/api/brain/status", { timeout: 10000 })
  },
  {
    name: "brain_memory_get",
    description: "Read the Brain's saved continuity (orbits, shards, somatic markers, and the Think mind) from GET /api/brain/memory. Pass summary=false for the full document.",
    input: { summary: z.boolean().optional().describe("Default true: counts plus the mind's operator table instead of the whole document.") },
    async run({ summary = true }) {
      const doc = await studio("GET", "/api/brain/memory");
      const c = doc.continuity;
      if (!summary || !c) return doc;
      return {
        ok: doc.ok,
        updatedAt: c.updatedAt || null,
        orbitCount: (c.memoryNodes || []).length,
        shardCount: (c.collapsedShards || []).length,
        blackHoleHashes: (c.blackHoleHashes || []).length,
        mind: c.mind ? {
          opcodes: c.mind.opcodes,
          placement: c.mind.placement,
          cases: (c.mind.cases || []).length,
          facts: Object.keys(c.mind.facts || {}).length,
          fossils: (c.mind.fossils || []).length
        } : null
      };
    }
  },
  {
    name: "brain_think",
    description: "Run the studio's Think loop (client/src/tools/brainMind.js think()) on one goal: an integer expression like \"8 / 2\", \"remember name = value\", \"recall name\", or \"bind name value\". It compiles to FrayVM, checks against an independent evaluator, and rewrites the operator table on a miss. Starts from the mind saved in /api/brain/memory. A dry run (persist=false) never writes to the studio, but what it learns is staged in the portal (out/staged-mind.json) so the next dry run builds on it; persist=true writes the staged lessons plus this run to the studio. discard_staged=true drops the staged lessons first. No language model is involved.",
    input: {
      goal: z.string().min(1).max(500),
      persist: z.boolean().optional().describe("Save the updated mind (including staged dry-run lessons) to /api/brain/memory. Default false (dry run, staged in the portal only)."),
      discard_staged: z.boolean().optional().describe("Forget staged dry-run lessons and start from the saved mind.")
    },
    async run({ goal, persist = false, discard_staged = false }) {
      const { think, normalizeMind } = await brainMind();
      let saved = null;
      try { saved = (await studio("GET", "/api/brain/memory")).continuity; } catch (error) {
        if (persist) throw error;
      }
      const savedMind = normalizeMind(saved?.mind);
      const savedHash = mindHash(savedMind);
      if (discard_staged) clearStaged();
      const staged = readStaged(savedHash);
      const start = staged ? normalizeMind(staged.mind) : savedMind;
      const result = think(start, goal);
      // learned = a rule changed (operator table, placement, facts, binds); recorded cases alone don't count.
      const rules = (m) => JSON.stringify([m.opcodes, m.placement, m.facts, m.binds]);
      const learned = rules(normalizeMind(result.mind)) !== rules(start);
      let persisted = false;
      let stagedRuns = 0;
      if (persist) {
        const c = saved || {};
        await studio("POST", "/api/brain/memory", { json: {
          memoryNodes: c.memoryNodes || [],
          collapsedShards: c.collapsedShards || [],
          somaticMarkers: c.somaticMarkers || {},
          blackHoleHashes: c.blackHoleHashes || [],
          body: c.body ?? null,
          activeGenomeMeta: c.activeGenomeMeta ?? null,
          lastDnaPlasmid: c.lastDnaPlasmid ?? null,
          mind: result.mind
        } });
        persisted = true;
        clearStaged();
      } else {
        stagedRuns = (staged?.runs || 0) + 1;
        writeStaged({ baseHash: savedHash, runs: stagedRuns, updatedAt: new Date().toISOString(), mind: result.mind });
      }
      return {
        verdict: result.verdict,
        got: result.got ?? null,
        expected: result.expected ?? null,
        steps: result.steps,
        source: result.source ?? null,
        opcodes: result.mind.opcodes,
        startedFromSavedMind: Boolean(saved?.mind),
        startedFromStaged: Boolean(staged),
        learned,
        cases: (result.mind.cases || []).length,
        persisted,
        staged: persisted ? null : { runs: stagedRuns, file: STAGED_MIND, note: "Dry run: lessons are staged in the portal, not saved in the studio. Run brain_think with persist=true to save them." }
      };
    }
  },
  {
    name: "brain_cortex_chat",
    description: "Optional local LLM chat through POST /api/brain/think (the 'Think & Persist' cortex card). Needs Ollama on 127.0.0.1:11434 with the named model; fails cleanly if it is not running.",
    input: {
      prompt: z.string().min(1).max(4000),
      model: z.string().optional().describe("Ollama model name. Studio default: fraynix-dna:3b."),
      raw: z.boolean().optional().describe("Skip the Fraymus system prompt and guards.")
    },
    run: ({ prompt, model, raw }) => studio("POST", "/api/brain/think", { json: { prompt, model, rawUncoupled: Boolean(raw) }, timeout: 70000 })
  },
  {
    name: "opeg_protocol",
    description: "Read the OPEG protocol YAML and the Fraynix modelfile from GET /api/opeg/protocol. ok=true means the inference ban and sanitizer are present.",
    input: {},
    run: () => studio("GET", "/api/opeg/protocol")
  },
  {
    name: "opeg_execute",
    description: "Run a PT-symmetric 3x3 Hamiltonian goal through POST /api/opeg/execute and get the sanitized R_san receipt or HALT. Only pt_symmetric_3x3 is implemented.",
    input: {
      goal: z.string().min(1).max(2000),
      hamiltonianType: z.string().optional(),
      g: z.number().optional(),
      gamma: z.number().optional(),
      epsilon: z.number().optional()
    },
    run: (args) => studio("POST", "/api/opeg/execute", { json: args })
  },
  {
    name: "project_list",
    description: "List saved studio projects (GET /api/projects) as summaries: id, name, stack, file count, pages, updatedAt.",
    input: {},
    async run() {
      return { projects: (await studio("GET", "/api/projects")).map(summarizeProject) };
    }
  },
  {
    name: "project_get",
    description: "Return one saved studio project in full (html, css, js, files, pages).",
    input: { id: z.string() },
    run: ({ id }) => loadProject(id)
  },
  {
    name: "project_create",
    description: "Create or overwrite a studio project through POST /api/projects. Gives a static project with the html/css/js you pass; it then shows up in the studio's project list.",
    input: {
      name: z.string().min(1).max(80),
      id: z.string().regex(/^[a-zA-Z0-9_-]{4,80}$/).optional().describe("Defaults to a new id."),
      html: z.string().optional(),
      css: z.string().optional(),
      js: z.string().optional(),
      files: filesShape
    },
    async run({ name, id, html = "", css = "", js = "", files = {} }) {
      const doc = {
        id: id || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name, stack: "static", html, css, js, wasmB64: "", wasmName: "",
        tailwind: false, reactMode: false, files, pages: []
      };
      return summarizeProject(await studio("POST", "/api/projects", { json: doc }));
    }
  },
  {
    name: "site_publish",
    description: "Publish a site to the studio's local /published/<slug>/ (POST /api/publish, writes data/published/<slug>/). Local only, nothing goes to the internet. Pass files, or project_id to publish a saved project.",
    input: {
      slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
      project_id: z.string().optional(),
      files: filesShape
    },
    async run(args) {
      const files = await filesFrom(args);
      const out = await studio("POST", "/api/publish", { json: { slug: args.slug, files } });
      return { ...out, fullUrl: `${process.env.FRAYMUS_STUDIO_URL || `http://127.0.0.1:${process.env.FRAYMUS_PORT || 4177}`}${out.url}`, fileCount: Object.keys(files).length };
    }
  },
  {
    name: "export_zip",
    description: "Zip a file set through POST /api/export/zip and save it under portal/out/. Pass files, or project_id for a saved project (.env is left out).",
    input: {
      name: z.string().max(80).optional(),
      project_id: z.string().optional(),
      files: filesShape
    },
    async run(args) {
      const files = await filesFrom(args);
      const name = args.name || args.project_id || "fraymus";
      const { bytes } = await studio("POST", "/api/export/zip", { json: { name, files }, binary: true });
      const file = saveOut(String(name).replace(/[^\w.-]+/g, "_"), "zip", bytes);
      return { path: file, bytes: bytes.length, fileCount: Object.keys(files).length };
    }
  },
  {
    name: "pixel_convert",
    description: "Convert a still (HEIC, TIFF, etc.) to PNG via POST /api/pixel/convert. Uses macOS sips/qlmanage, so it only works when the studio runs on a Mac; elsewhere it returns 415.",
    input: { path: z.string().describe("Local image file.") },
    async run({ path: file }) {
      const { resolved, bytes } = readInputFile(file);
      const out = await studio("POST", "/api/pixel/convert", { raw: bytes, headers: { "x-file-name": path.basename(resolved) } });
      const saved = saveOut("convert", "png", dataUrlBytes(out.image));
      return { path: saved, bytes: fs.statSync(saved).size };
    }
  },
  {
    name: "pixel_video",
    description: "Convert a movie to 1280x720 H.264 MP4 via POST /api/pixel/video. Uses macOS avconvert: Mac only, 415 elsewhere.",
    input: { path: z.string().describe("Local movie file (MOV, MP4, ...).") },
    async run({ path: file }) {
      const { resolved, bytes } = readInputFile(file);
      const out = await studio("POST", "/api/pixel/video", { raw: bytes, headers: { "x-file-name": path.basename(resolved) }, binary: true, timeout: 200000 });
      const saved = saveOut("video", "mp4", out.bytes);
      return { path: saved, bytes: out.bytes.length };
    }
  },
  {
    name: "pixel_render",
    description: "AI Render: redraw a photo as an 8-bit pixel-art bust via POST /api/pixel/render (Hugging Face Space through @gradio/client). The studio needs internet, and HF_TOKEN or hf-token.txt for reliable GPU quota. Saves the returned PNG (768x1024 in testing) under portal/out/.",
    input: {
      image_path: z.string().optional().describe("Local photo file."),
      image_base64: z.string().optional(),
      style_path: z.string().optional().describe("Optional style reference image."),
      mode: z.enum(["real", "avatar"]).optional(),
      seed: z.number().int().optional(),
      note: z.string().max(240).optional(),
      inline: z.boolean().optional().describe("Also return the PNG as an MCP image block.")
    },
    async run(args) {
      const image = imageArg(args, "image_path", "image_base64");
      if (!image) throw new Error("Pass image_path or image_base64.");
      const style = args.style_path ? readInputFile(args.style_path).bytes.toString("base64") : undefined;
      const out = await studio("POST", "/api/pixel/render", {
        json: { image, style, mode: args.mode, seed: args.seed, note: args.note }, timeout: 180000
      });
      const bytes = dataUrlBytes(out.image);
      const saved = saveOut("render", "png", bytes);
      const result = { path: saved, bytes: bytes.length, seed: out.seed, mode: out.mode };
      return args.inline ? { ...result, __image: { data: bytes.toString("base64"), mimeType: "image/png" } } : result;
    }
  },
  {
    name: "mail_list",
    description: "Read the studio's local mailbox (GET /api/mail/status and /api/mail/messages). Read-only; sending is not exposed.",
    input: { folder: z.string().optional(), q: z.string().optional() },
    async run({ folder = "inbox", q }) {
      const qs = new URLSearchParams({ folder, ...(q ? { q } : {}) });
      const [status, list] = await Promise.all([studio("GET", "/api/mail/status"), studio("GET", `/api/mail/messages?${qs}`)]);
      return { status, messages: (list.messages || []).slice(0, 50) };
    }
  }
];

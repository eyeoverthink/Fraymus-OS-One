/**
 * FRAYMUS v16 — Email-Launched Payload Watcher
 * Polls Gmail (IMAP) for FRAYMUS-DEPLOY-* subjects, extracts the emoji payload,
 * runs the decode → verify pipeline, then dispatches to the right agent / runtime.
 *
 * © 2026 Fraymus Web Studio · FRAY 0x46524159
 *
 *   node watcher.mjs            # live: poll Gmail and dispatch
 *   node watcher.mjs --dry-run  # offline: route built-in fixtures through dispatchToAgent
 */
import { fileURLToPath } from "node:url";
import { decodePipeline } from "./decode.mjs";

// ─── Config (env-driven; localhost by default) ───
const HUB_URL = process.env.HUB_URL || "http://127.0.0.1:8787";
const IMAP_HOST = process.env.IMAP_HOST || "imap.gmail.com";
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || ""; // Gmail app password, never commit it
const SUBJECT_PREFIX = process.env.SUBJECT_PREFIX || "FRAYMUS-DEPLOY-";
const POLL_MS = Number(process.env.POLL_MS || 15000);
const DRY_RUN = process.argv.includes("--dry-run");

const log = (...args) => console.log(new Date().toISOString(), ...args);

// ─── Emoji extraction: pull the contiguous emoji run out of an email body ───
// decode.mjs silently skips unknown chars, but trimming to the emoji run keeps logs clean.
export function extractEmojiPayload(text) {
  if (!text) return "";
  const emoji = text.match(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F]+/gu);
  if (!emoji) return "";
  // The payload is the longest emoji run in the message.
  return emoji.sort((a, b) => b.length - a.length)[0];
}

// ───────────────────────────────────────────────────────────────────────────
// TODO(human) → implemented: the last mile.
// Takes a verified, decoded payload and delivers it to the right destination.
// Receives { ok, payload, checks, dispatchTo, canon, from }; returns { ok, reply?, error? }.
// ───────────────────────────────────────────────────────────────────────────
export async function dispatchToAgent(decoded) {
  // Fail closed: never route anything that didn't clear the pipeline.
  if (!decoded.ok) {
    const failed = Object.entries(decoded.checks || {}).filter(([, ok]) => !ok).map(([k]) => k);
    return { ok: false, error: `verification failed: ${failed.join(", ") || "unknown"}` };
  }

  const { payload, canon, dispatchTo } = decoded; // payload = full signed JSON (sig + pub); hub re-verifies.
  const post = (path, body) =>
    fetch(`${HUB_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path} → HTTP ${r.status}`))));

  try {
    // Email carrier: canon marks a mail-forward op → v13 mail system.
    if (typeof canon === "string" && canon.includes("COMMAND:EMAIL"))
      return { ok: true, reply: await post("/api/mail/forward", payload) };

    // FRAYNIX runtime direct → richer response (quick + primary + intensity).
    if (dispatchTo === "FRAYNIX")
      return { ok: true, reply: await post("/api/fraynix/feel", payload) };

    // Agent by name/fx, or BROADCAST fan-out → same signed endpoint.
    return { ok: true, reply: await post("/api/dispatch", { ...payload, to: dispatchTo || payload.to }) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ─── Process one email: decode → verify → dispatch ───
async function handleMessage({ subject, body }) {
  log(`→ ${subject}`);
  const emoji = extractEmojiPayload(body);
  if (!emoji) { log("  no emoji payload found, skipping"); return { ok: false, error: "no payload" }; }

  const decoded = await decodePipeline(emoji);
  const flags = Object.entries(decoded.checks || {}).map(([k, v]) => `${k}:${v ? "✓" : "✕"}`).join(" ");
  log(`  checks ${flags} · to=${decoded.dispatchTo ?? "?"}`);

  const result = await dispatchToAgent(decoded);
  log(result.ok ? `  ✓ dispatched → ${JSON.stringify(result.reply).slice(0, 160)}` : `  ✕ ${result.error}`);
  return result;
}

// ─── Live IMAP poll loop ───
async function watch() {
  if (!IMAP_USER || !IMAP_PASS) {
    console.error("Set IMAP_USER and IMAP_PASS (a Gmail app password) to run live, or use --dry-run.");
    process.exit(1);
  }
  const { ImapFlow } = await import("imapflow"); // lazy so --dry-run needs no install
  const client = new ImapFlow({ host: IMAP_HOST, port: IMAP_PORT, secure: true, auth: { user: IMAP_USER, pass: IMAP_PASS }, logger: false });
  await client.connect();
  log(`Connected to ${IMAP_HOST} as ${IMAP_USER} · watching "${SUBJECT_PREFIX}*" every ${POLL_MS}ms`);

  const poll = async () => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false, subject: SUBJECT_PREFIX }, { uid: true });
      for (const uid of uids || []) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg) continue;
        const subject = msg.envelope?.subject || "";
        if (!subject.startsWith(SUBJECT_PREFIX)) continue;
        await handleMessage({ subject, body: msg.source.toString("utf8") });
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  };

  await poll();
  setInterval(() => poll().catch((e) => log("poll error:", e.message)), POLL_MS);
}

// ─── Offline dry-run: exercise every routing branch without a live hub/IMAP ───
async function dryRun() {
  log("DRY RUN — routing fixtures through dispatchToAgent (no network calls made if hub is down)");
  const base = { pub: "x".repeat(64), sig: "y".repeat(96), merkle: { root: "r", proof: ["s"], leaf: "l..." }, prev: "p", ts: Date.now() };
  const fixtures = [
    ["agent fx", { ...base, to: "fx-4041@fraymus.world", canon: "v16|fx-4041" }],
    ["broadcast", { ...base, to: "BROADCAST", canon: "v16|BROADCAST" }],
    ["fraynix", { ...base, dispatchTo: "FRAYNIX", canon: "v16|FRAYNIX" }],
    ["email carrier", { ...base, to: "mailbox", canon: "COMMAND:EMAIL|to=ops@fraymus.world" }],
  ];
  for (const [name, payload] of fixtures) {
    const decoded = { ok: true, payload, checks: { decode: true, sig: true, merkle: true, ts: true }, dispatchTo: payload.dispatchTo || payload.to, canon: payload.canon, from: "test" };
    const res = await dispatchToAgent(decoded);
    log(`  ${name.padEnd(14)} → ${res.ok ? "ok" : "err: " + res.error}`);
  }
  // Fail-closed case
  const bad = await dispatchToAgent({ ok: false, checks: { decode: true, sig: false, merkle: true, ts: true } });
  log(`  ${"rejected".padEnd(14)} → ${bad.ok ? "ok (WRONG)" : bad.error}`);
}

// ─── Entry (only when run directly, not when imported for tests) ───
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (DRY_RUN) dryRun();
  else watch().catch((e) => { console.error("watcher error:", e); process.exit(1); });
}

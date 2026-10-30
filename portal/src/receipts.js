// SHA-256 chained receipts. One JSON line per tool call.
// Only hashes of the arguments and the result are stored, never the values,
// so a token or a photo passed to a tool never lands on disk here.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const GENESIS = "0".repeat(64);

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Stable JSON: object keys sorted, so the same args always hash the same.
export function canonical(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

function lineHash(entry) {
  const { hash, ...rest } = entry;
  return sha256(canonical(rest));
}

export function createLedger(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prev = GENESIS;
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
    if (lines.length) {
      try { prev = JSON.parse(lines[lines.length - 1]).hash || GENESIS; } catch { prev = GENESIS; }
    }
  }
  return {
    file,
    append(tool, args, result, ok) {
      const entry = {
        ts: new Date().toISOString(),
        tool,
        ok: Boolean(ok),
        args_hash: sha256(canonical(args ?? {})),
        result_hash: sha256(canonical(result ?? null)),
        prev_hash: prev
      };
      entry.hash = lineHash(entry);
      fs.appendFileSync(file, JSON.stringify(entry) + "\n");
      prev = entry.hash;
      return entry;
    }
  };
}

// Walks the file and reports the first broken link, if any.
export function verifyLedger(file) {
  if (!fs.existsSync(file)) return { ok: true, count: 0, head: GENESIS };
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  let prev = GENESIS;
  for (let i = 0; i < lines.length; i += 1) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { return { ok: false, count: i, brokenAt: i + 1, reason: "not JSON" }; }
    if (entry.prev_hash !== prev) return { ok: false, count: i, brokenAt: i + 1, reason: "prev_hash does not match the line before" };
    if (lineHash(entry) !== entry.hash) return { ok: false, count: i, brokenAt: i + 1, reason: "line was edited after it was written" };
    prev = entry.hash;
  }
  return { ok: true, count: lines.length, head: prev };
}

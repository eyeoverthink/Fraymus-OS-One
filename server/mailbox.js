import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const FOLDERS = ["inbox", "sent", "drafts", "archive", "junk", "trash"];

const LIMITS = { from: 200, to: 500, cc: 500, subject: 300, body: 500000 };

const SEED = [
  {
    folder: "inbox",
    from: "Fraymus Web Studio <studio@localhost>",
    to: "you@localhost",
    cc: "",
    subject: "Local mailbox is connected",
    body: "This message lives in data/mailbox on this machine.\n\nReply, move, flag, import, and export all read and write that same box.",
    unread: true,
    flagged: true
  },
  {
    folder: "inbox",
    from: "Dispatch <dispatch@localhost>",
    to: "you@localhost",
    cc: "",
    subject: "FRAYMUS-DEPLOY-local",
    body: "A payload can ride in a message like this one.\nThe mailbox keeps it as text until you export the folder.",
    unread: true,
    flagged: false
  }
];

const clip = (value, max) => String(value ?? "").slice(0, max);
const fold = (value) => clip(value, 500).replace(/[\r\n]+/g, " ").trim();

function blank(partial) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    folder: FOLDERS.includes(partial.folder) ? partial.folder : "inbox",
    from: clip(partial.from, LIMITS.from),
    to: clip(partial.to, LIMITS.to),
    cc: clip(partial.cc, LIMITS.cc),
    subject: clip(partial.subject || "(no subject)", LIMITS.subject),
    date: partial.date || now,
    body: clip(partial.body, LIMITS.body),
    unread: partial.unread !== false,
    flagged: Boolean(partial.flagged)
  };
}

export function parseHeaders(raw) {
  const headers = {};
  let key = null;
  for (const line of String(raw).split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && key) {
      headers[key] += ` ${line.trim()}`;
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    key = match[1].toLowerCase();
    headers[key] = match[2];
  }
  return headers;
}

export function parseEml(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/^\n+/, "");
  const split = normalized.indexOf("\n\n");
  const head = split < 0 ? normalized : normalized.slice(0, split);
  let body = split < 0 ? "" : normalized.slice(split + 2);
  body = body.replace(/^>From /gm, "From ");
  const headers = parseHeaders(head);
  if (!headers.from && !headers.to && !headers.subject && !body.trim()) return null;
  return blank({
    from: headers.from || "",
    to: headers.to || "",
    cc: headers.cc || "",
    subject: headers.subject || "(no subject)",
    date: headers.date || new Date().toISOString(),
    body,
    unread: headers["x-fraymus-unread"] !== "0",
    flagged: headers["x-fraymus-flagged"] === "1"
  });
}

export function parseMbox(text) {
  const chunks = String(text || "").split(/\n(?=From )/g).map((chunk) => chunk.replace(/^From [^\n]*\n/, ""));
  return chunks.map(parseEml).filter(Boolean);
}

export function toEml(message) {
  const body = String(message.body || "").replace(/^From /gm, ">From ");
  return [
    `From: ${fold(message.from)}`,
    `To: ${fold(message.to)}`,
    `Cc: ${fold(message.cc)}`,
    `Subject: ${fold(message.subject)}`,
    `Date: ${message.date}`,
    `Message-ID: <${message.id}@localhost>`,
    `X-Fraymus-Unread: ${message.unread ? "1" : "0"}`,
    `X-Fraymus-Flagged: ${message.flagged ? "1" : "0"}`,
    "",
    body
  ].join("\n");
}

export function toMbox(messages) {
  return messages.map((message) => `From studio@localhost ${new Date(message.date).toUTCString()}\n${toEml(message)}`).join("\n");
}

export function createStore(dir) {
  const file = path.join(dir, "box.json");

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && Array.isArray(parsed.messages)) return parsed;
    } catch { /* first run, or a torn write */ }
    const box = { account: "Local", seeded: true, messages: SEED.map((item) => blank({ ...item, unread: item.unread })) };
    save(box);
    return box;
  }

  function save(box) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(box, null, 2));
    fs.renameSync(tmp, file);
  }

  function counts(box) {
    return Object.fromEntries(FOLDERS.map((folder) => [folder, box.messages.filter((message) => message.folder === folder).length]));
  }

  return {
    file,
    status() {
      const box = load();
      return { ok: true, account: box.account, connected: true, path: "data/mailbox/box.json", total: box.messages.length, counts: counts(box) };
    },
    list(folder, query) {
      if (!FOLDERS.includes(folder)) throw Object.assign(new Error("Unknown folder"), { status: 400 });
      const needle = String(query || "").trim().toLowerCase();
      return load().messages
        .filter((message) => message.folder === folder)
        .filter((message) => !needle || `${message.from} ${message.to} ${message.subject} ${message.body}`.toLowerCase().includes(needle))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(({ body, ...rest }) => ({ ...rest, preview: body.slice(0, 140) }));
    },
    get(id) {
      const message = load().messages.find((item) => item.id === id);
      if (!message) throw Object.assign(new Error("Message not found"), { status: 404 });
      return message;
    },
    add(input, folder) {
      const target = folder || input.folder || "sent";
      if (!FOLDERS.includes(target)) throw Object.assign(new Error("Unknown folder"), { status: 400 });
      if (!clip(input.to, LIMITS.to).trim() && target !== "drafts") throw Object.assign(new Error("A message needs a recipient"), { status: 400 });
      const box = load();
      const message = blank({ ...input, folder: target, date: new Date().toISOString(), unread: target === "drafts" || target === "inbox" });
      box.messages.push(message);
      save(box);
      return message;
    },
    patch(id, input) {
      const box = load();
      const message = box.messages.find((item) => item.id === id);
      if (!message) throw Object.assign(new Error("Message not found"), { status: 404 });
      if (input.folder !== undefined) {
        if (!FOLDERS.includes(input.folder)) throw Object.assign(new Error("Unknown folder"), { status: 400 });
        message.folder = input.folder;
      }
      if (input.unread !== undefined) message.unread = Boolean(input.unread);
      if (input.flagged !== undefined) message.flagged = Boolean(input.flagged);
      if (input.subject !== undefined) message.subject = clip(input.subject, LIMITS.subject);
      if (input.body !== undefined) message.body = clip(input.body, LIMITS.body);
      if (input.to !== undefined) message.to = clip(input.to, LIMITS.to);
      if (input.cc !== undefined) message.cc = clip(input.cc, LIMITS.cc);
      save(box);
      return message;
    },
    remove(id) {
      const box = load();
      const message = box.messages.find((item) => item.id === id);
      if (!message) throw Object.assign(new Error("Message not found"), { status: 404 });
      if (message.folder === "trash") {
        box.messages = box.messages.filter((item) => item.id !== id);
        save(box);
        return { deleted: true, id };
      }
      message.folder = "trash";
      save(box);
      return { deleted: false, id, folder: "trash" };
    },
    importText(text, folder = "inbox") {
      if (!FOLDERS.includes(folder)) throw Object.assign(new Error("Unknown folder"), { status: 400 });
      const raw = String(text || "");
      if (!raw.trim()) throw Object.assign(new Error("Nothing to import"), { status: 400 });
      if (raw.length > 8_000_000) throw Object.assign(new Error("Import is over 8 MB"), { status: 400 });
      const parsed = raw.startsWith("From ") ? parseMbox(raw) : [parseEml(raw)].filter(Boolean);
      if (!parsed.length) throw Object.assign(new Error("No messages found in that file"), { status: 400 });
      const box = load();
      const added = parsed.map((item) => {
        const message = blank({ ...item, folder, id: undefined });
        box.messages.push(message);
        return message;
      });
      save(box);
      return { imported: added.length, ids: added.map((message) => message.id) };
    },
    exportText({ id, folder = "inbox", format = "mbox" }) {
      const box = load();
      if (format === "eml") {
        const message = box.messages.find((item) => item.id === id);
        if (!message) throw Object.assign(new Error("Message not found"), { status: 404 });
        return { filename: `${message.subject.replace(/[^\w.-]+/g, "_").slice(0, 40) || "message"}.eml`, type: "message/rfc822", body: toEml(message) };
      }
      if (format !== "mbox") throw Object.assign(new Error("Format must be eml or mbox"), { status: 400 });
      const messages = id
        ? box.messages.filter((item) => item.id === id)
        : box.messages.filter((item) => item.folder === folder);
      if (id && !messages.length) throw Object.assign(new Error("Message not found"), { status: 404 });
      if (!id && !FOLDERS.includes(folder)) throw Object.assign(new Error("Unknown folder"), { status: 400 });
      return { filename: `${folder}.mbox`, type: "application/mbox", body: toMbox(messages) };
    }
  };
}

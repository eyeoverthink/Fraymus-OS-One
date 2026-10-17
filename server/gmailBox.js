import fs from "node:fs";
import path from "node:path";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { FOLDERS, parseEml, parseMbox, toEml, toMbox } from "./mailbox.js";

const FALLBACK = {
  inbox: "INBOX",
  sent: "[Gmail]/Sent Mail",
  drafts: "[Gmail]/Drafts",
  junk: "[Gmail]/Spam",
  trash: "[Gmail]/Trash",
  archive: "[Gmail]/All Mail"
};
const SPECIAL = { "\\Inbox": "inbox", "\\Sent": "sent", "\\Drafts": "drafts", "\\Junk": "junk", "\\Trash": "trash", "\\All": "archive" };
const LIMIT = 40;

const fail = (message, status) => Object.assign(new Error(message), { status });
const addressList = (list) => (list || []).map((item) => (item.name ? `${item.name} <${item.address}>` : item.address)).filter(Boolean).join(", ");
const encodeId = (mailbox, uid) => Buffer.from(`${mailbox}\n${uid}`).toString("base64url");
const decodeId = (id) => {
  const text = Buffer.from(String(id), "base64url").toString("utf8");
  const split = text.lastIndexOf("\n");
  const uid = Number(text.slice(split + 1));
  if (split < 1 || !Number.isInteger(uid)) throw fail("Unknown message", 404);
  return { mailbox: text.slice(0, split), uid };
};

export function createGmail(dir) {
  const file = path.join(dir, "gmail.json");
  let chain = Promise.resolve();
  const exclusive = (task) => {
    const run = chain.then(task, task);
    chain = run.then(() => {}, () => {});
    return run;
  };

  function readConfig() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed?.user && parsed?.pass) return { user: String(parsed.user), pass: String(parsed.pass) };
    } catch { /* not connected yet */ }
    return null;
  }

  function writeConfig(config) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ user: config.user, pass: config.pass }), { mode: 0o600 });
    fs.renameSync(tmp, file);
    fs.chmodSync(file, 0o600);
  }

  async function open(config) {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: config.user, pass: config.pass },
      logger: false
    });
    try {
      await client.connect();
    } catch (error) {
      const auth = error.authenticationFailed || error.serverResponseCode === "AUTHENTICATIONFAILED" || /auth|invalid credentials|application-specific/i.test(`${error.message} ${error.response || ""}`);
      throw fail(auth ? "Gmail refused that login. Use a Google app password, not the normal account password." : `Gmail connection failed: ${error.message}`, auth ? 401 : 502);
    }
    return client;
  }

  async function folders(client) {
    const paths = { ...FALLBACK };
    for (const box of await client.list()) {
      const key = SPECIAL[box.specialUse];
      if (key) paths[key] = box.path;
    }
    return paths;
  }

  async function readMessage(client, mailbox, uid, folder) {
    const fetched = await client.fetchOne(uid, { envelope: true, source: true, flags: true, uid: true }, { uid: true });
    if (!fetched) throw fail("Message not found", 404);
    const parsed = parseEml(fetched.source.toString("utf8")) || {};
    const flags = fetched.flags || new Set();
    return {
      id: encodeId(mailbox, uid),
      folder,
      from: parsed.from || addressList(fetched.envelope?.from),
      to: parsed.to || addressList(fetched.envelope?.to),
      cc: parsed.cc || addressList(fetched.envelope?.cc),
      subject: parsed.subject || fetched.envelope?.subject || "(no subject)",
      date: fetched.envelope?.date ? new Date(fetched.envelope.date).toISOString() : parsed.date,
      body: parsed.body || "",
      unread: !flags.has("\\Seen"),
      flagged: flags.has("\\Flagged")
    };
  }

  async function withClient(task) {
    const config = readConfig();
    if (!config) throw fail("Gmail is not connected", 409);
    return exclusive(async () => {
      const client = await open(config);
      try { return await task(client, config, await folders(client)); }
      finally { await client.logout().catch(() => {}); }
    });
  }

  return {
    status() {
      const config = readConfig();
      if (!config) return { ok: true, account: "Gmail", configured: false, connected: false, user: "", path: "imap.gmail.com", total: 0, counts: {} };
      return exclusive(async () => {
        const client = await open(config);
        try {
          const paths = await folders(client);
          const counts = {};
          for (const folder of FOLDERS) {
            const box = await client.status(paths[folder], { messages: true });
            counts[folder] = box.messages || 0;
          }
          const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
          return { ok: true, account: "Gmail", configured: true, connected: true, user: config.user, path: "imap.gmail.com", total, counts };
        } finally { await client.logout().catch(() => {}); }
      });
    },
    async connect(user, pass) {
      const cleanUser = String(user || "").trim().toLowerCase();
      const cleanPass = String(pass || "").replace(/\s+/g, "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanUser)) throw fail("Enter the Gmail address", 400);
      if (cleanPass.length < 8) throw fail("Enter the Google app password", 400);
      const client = await open({ user: cleanUser, pass: cleanPass });
      await client.logout().catch(() => {});
      writeConfig({ user: cleanUser, pass: cleanPass });
      return { ok: true, account: "Gmail", configured: true, connected: true, user: cleanUser };
    },
    disconnect() {
      fs.rmSync(file, { force: true });
      return { ok: true, configured: false, connected: false };
    },
    list(folder, query) {
      if (!FOLDERS.includes(folder)) throw fail("Unknown folder", 400);
      return withClient(async (client, _config, paths) => {
        const lock = await client.getMailboxLock(paths[folder]);
        try {
          const uids = await client.search(query ? { gmraw: String(query) } : { all: true }, { uid: true });
          const slice = (uids || []).slice(-LIMIT);
          if (!slice.length) return [];
          const messages = [];
          for await (const item of client.fetch(slice, { uid: true, envelope: true, flags: true }, { uid: true })) {
            const flags = item.flags || new Set();
            messages.push({
              id: encodeId(paths[folder], item.uid),
              folder,
              from: addressList(item.envelope?.from),
              to: addressList(item.envelope?.to),
              cc: addressList(item.envelope?.cc),
              subject: item.envelope?.subject || "(no subject)",
              date: item.envelope?.date ? new Date(item.envelope.date).toISOString() : "",
              unread: !flags.has("\\Seen"),
              flagged: flags.has("\\Flagged"),
              preview: ""
            });
          }
          return messages.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        } finally { lock.release(); }
      });
    },
    get(id) {
      return withClient(async (client, _config, paths) => {
        const { mailbox, uid } = decodeId(id);
        const folder = Object.entries(paths).find(([, value]) => value === mailbox)?.[0] || "inbox";
        const lock = await client.getMailboxLock(mailbox);
        try { return await readMessage(client, mailbox, uid, folder); }
        finally { lock.release(); }
      });
    },
    add(input, folder = "sent") {
      if (!FOLDERS.includes(folder)) throw fail("Unknown folder", 400);
      return withClient(async (client, config, paths) => {
        const to = String(input.to || "").trim();
        if (!to && folder !== "drafts") throw fail("A message needs a recipient", 400);
        const message = {
          id: "draft",
          from: config.user,
          to,
          cc: String(input.cc || ""),
          subject: String(input.subject || "(no subject)"),
          date: new Date().toISOString(),
          body: String(input.body || ""),
          unread: false,
          flagged: false
        };
        if (folder === "drafts") {
          await client.append(paths.drafts, toEml(message), ["\\Draft", "\\Seen"]);
          return { ...message, folder: "drafts" };
        }
        const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: config.user, pass: config.pass } });
        try {
          await transport.sendMail({ from: config.user, to: message.to, cc: message.cc || undefined, subject: message.subject, text: message.body });
        } catch (error) {
          throw fail(`Gmail did not send that message: ${error.message}`, 502);
        } finally { transport.close(); }
        return { ...message, folder: "sent" };
      });
    },
    patch(id, input) {
      return withClient(async (client, _config, paths) => {
        const { mailbox, uid } = decodeId(id);
        if (input.folder && !FOLDERS.includes(input.folder)) throw fail("Unknown folder", 400);
        const lock = await client.getMailboxLock(mailbox);
        let released = false;
        try {
          if (input.unread === true) await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
          if (input.unread === false) await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          if (input.flagged === true) await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
          if (input.flagged === false) await client.messageFlagsRemove(uid, ["\\Flagged"], { uid: true });
          if (input.folder && paths[input.folder] !== mailbox) {
            const moved = await client.messageMove(uid, paths[input.folder], { uid: true });
            const map = moved?.uidMap;
            const nextUid = map?.get?.(uid) || map?.[uid];
            lock.release();
            released = true;
            if (!nextUid) return { id, folder: input.folder, from: "", to: "", cc: "", subject: "", date: "", body: "", unread: false, flagged: false };
            const next = await client.getMailboxLock(paths[input.folder]);
            try { return await readMessage(client, paths[input.folder], nextUid, input.folder); }
            finally { next.release(); }
          }
          const folder = Object.entries(paths).find(([, value]) => value === mailbox)?.[0] || "inbox";
          return readMessage(client, mailbox, uid, folder);
        } finally { if (!released) lock.release(); }
      });
    },
    remove(id) {
      return withClient(async (client, _config, paths) => {
        const { mailbox, uid } = decodeId(id);
        const lock = await client.getMailboxLock(mailbox);
        try {
          if (mailbox === paths.trash) {
            await client.messageDelete(uid, { uid: true });
            return { deleted: true, id };
          }
          await client.messageMove(uid, paths.trash, { uid: true });
          return { deleted: false, id, folder: "trash" };
        } finally { lock.release(); }
      });
    },
    importText(text, folder = "inbox") {
      if (!FOLDERS.includes(folder)) throw fail("Unknown folder", 400);
      const raw = String(text || "");
      if (!raw.trim()) throw fail("Nothing to import", 400);
      const parsed = raw.startsWith("From ") ? parseMbox(raw) : [parseEml(raw)].filter(Boolean);
      if (!parsed.length) throw fail("No messages found in that file", 400);
      return withClient(async (client, _config, paths) => {
        for (const message of parsed) await client.append(paths[folder], toEml({ ...message, unread: true, flagged: false }), message.unread === false ? ["\\Seen"] : []);
        return { imported: parsed.length };
      });
    },
    exportText({ id, folder = "inbox", format = "mbox" }) {
      return withClient(async (client, _config, paths) => {
        if (format === "eml") {
          const { mailbox, uid } = decodeId(id);
          const lock = await client.getMailboxLock(mailbox);
          try {
            const message = await readMessage(client, mailbox, uid, folder);
            return { filename: `${message.subject.replace(/[^\w.-]+/g, "_").slice(0, 40) || "message"}.eml`, type: "message/rfc822", body: toEml(message) };
          } finally { lock.release(); }
        }
        if (format !== "mbox") throw fail("Format must be eml or mbox", 400);
        if (!FOLDERS.includes(folder)) throw fail("Unknown folder", 400);
        const lock = await client.getMailboxLock(paths[folder]);
        try {
          const uids = await client.search({ all: true }, { uid: true });
          const slice = (uids || []).slice(-LIMIT);
          const messages = [];
          for (const uid of slice) messages.push(await readMessage(client, paths[folder], uid, folder));
          return { filename: `${folder}.mbox`, type: "application/mbox", body: toMbox(messages) };
        } finally { lock.release(); }
      });
    }
  };
}

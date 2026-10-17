import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore, parseEml } from "../server/mailbox.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fraymus-mail-"));
const store = createStore(dir);
let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed += 1;
};

const status = store.status();
check("seeded inbox", status.counts.inbox === 2, `inbox=${status.counts.inbox}`);
check("connected", status.connected === true);

const sent = store.add({ from: "Fraymus Web Studio <studio@localhost>", to: "you@localhost", subject: "E2E reply", body: "Round trip." }, "sent");
check("send lands in sent", store.list("sent").some((message) => message.id === sent.id));

store.patch(sent.id, { folder: "archive", flagged: true, unread: false });
const archived = store.get(sent.id);
check("move to archive", archived.folder === "archive" && archived.flagged && archived.unread === false);

const exported = store.exportText({ folder: "archive", format: "mbox" });
check("export mbox contains the reply", exported.body.includes("E2E reply") && exported.body.startsWith("From "));

const imported = store.importText(exported.body, "inbox");
check("import mbox", imported.imported >= 1);
const brought = store.get(imported.ids[0]);
check("imported body survived", brought.body.includes("Round trip.") && brought.subject === "E2E reply");

const eml = store.exportText({ id: brought.id, format: "eml" });
const parsed = parseEml(eml.body);
check("eml round trip", parsed.subject === "E2E reply" && parsed.body.includes("Round trip."));

store.remove(brought.id);
check("trash is not a purge", store.get(brought.id).folder === "trash");
store.remove(brought.id);
let gone = false;
try { store.get(brought.id); } catch { gone = true; }
check("second delete purges", gone);

let rejected = false;
try { store.importText("   ", "inbox"); } catch (error) { rejected = error.status === 400; }
check("empty import rejected", rejected);

console.log(failed ? `\n${failed} failed` : "\nstore checks passed");
process.exitCode = failed ? 1 : 0;

if (process.argv.includes("--http")) {
  const base = process.env.MAIL_URL || "http://127.0.0.1:4177";
  const stamp = `e2e-${Date.now()}`;
  const res = await fetch(`${base}/api/mail/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "studio@localhost", to: "you@localhost", subject: stamp, body: "from the API", folder: "sent" })
  });
  const created = await res.json();
  const listed = await (await fetch(`${base}/api/mail/messages?folder=sent&q=${encodeURIComponent(stamp)}`)).json();
  const file = await (await fetch(`${base}/api/mail/export?format=eml&id=${created.id}`)).text();
  const live = res.status === 201 && listed.messages?.some((message) => message.id === created.id) && file.includes(stamp);
  console.log(`${live ? "PASS" : "FAIL"}  live API ${base}`);
  if (!live) process.exitCode = 1;
  await fetch(`${base}/api/mail/messages/${created.id}`, { method: "DELETE" });
  await fetch(`${base}/api/mail/messages/${created.id}`, { method: "DELETE" });
}

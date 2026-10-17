import React, { useCallback, useEffect, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";

const FOLDERS = [
  ["inbox", "Inbox"],
  ["sent", "Sent"],
  ["drafts", "Drafts"],
  ["archive", "Archive"],
  ["junk", "Junk"],
  ["trash", "Trash"]
];

const EMPTY_DRAFT = { from: "Fraymus Web Studio <studio@localhost>", to: "", cc: "", subject: "", body: "" };
const ACCOUNT_KEY = "fraymus.mail.account";

const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const when = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

async function mail(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = options.raw ? await res.text() : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Mail request failed (${res.status})`);
  return data;
}

export function applyMail(project, messages) {
  const rows = (messages || []).map((message) => `<article class="fray-mail-item">
  <h2>${esc(message.subject)}</h2>
  <p>${esc(message.from)} · ${esc(message.date)}</p>
  <pre>${esc(message.preview || message.body || "")}</pre>
</article>`).join("\n");
  const html = `<section class="fray-mail">\n${rows || "<p>The local mailbox is empty.</p>"}\n</section>`;
  const css = `.fray-mail { display: grid; gap: 12px; } .fray-mail-item { border: 1px solid #262b26; padding: 12px; } .fray-mail-item pre { white-space: pre-wrap; }`;
  if (project.stack !== "mern") return { ...project, html: `${project.html || ""}\n${html}\n`, css: `${project.css || ""}\n${css}\n` };
  const next = ensureMern(project);
  const file = "client/src/pages/Mail.jsx";
  const pages = next.pages.some((page) => page.name === "Mail") ? next.pages : [...next.pages, { name: "Mail", path: "/mail", file, auth: false }];
  const source = `import React from "react";
const MESSAGES = ${JSON.stringify(messages || [])};
export default function Mail() {
  return (
    <main className="page">
      <h1>Local mailbox</h1>
      {MESSAGES.map((message) => (
        <article key={message.id}>
          <h2>{message.subject}</h2>
          <p>{message.from}</p>
          <pre>{message.preview || ""}</pre>
        </article>
      ))}
    </main>
  );
}
`;
  return { ...next, pages, files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) } };
}

export default function MailPage({ project, say, onApply }) {
  const [account, setAccount] = useState(() => localStorage.getItem(ACCOUNT_KEY) || "gmail");
  const [loginUser, setLoginUser] = useState("eyeoverthink@gmail.com");
  const [loginPass, setLoginPass] = useState("");
  const [status, setStatus] = useState(null);
  const [folder, setFolder] = useState("inbox");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [composing, setComposing] = useState(false);
  const [moveTo, setMoveTo] = useState("archive");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const root = account === "gmail" ? "/api/mail/gmail" : "/api/mail";
  const api = useCallback((path, options) => mail(`${root}${path}`, options), [root]);

  useEffect(() => { localStorage.setItem(ACCOUNT_KEY, account); }, [account]);

  const refresh = useCallback(async (nextFolder = folder, nextQuery = query) => {
    const box = await api("/status");
    setStatus(box);
    if (box.configured === false) { setMessages([]); return []; }
    const list = await api(`/messages?folder=${encodeURIComponent(nextFolder)}&q=${encodeURIComponent(nextQuery)}`);
    setMessages(list.messages);
    return list.messages;
  }, [folder, query, api]);

  useEffect(() => {
    refresh().catch((error) => say?.("err", error.message));
  }, [folder, account]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openMessage(id) {
    const message = await api(`/messages/${id}`);
    setComposing(false);
    if (message.unread) {
      const read = await api(`/messages/${id}`, { method: "PATCH", body: { unread: false } });
      setOpen(read);
      refresh();
    } else {
      setOpen(message);
    }
  }

  function startDraft(next) {
    setDraft({ ...EMPTY_DRAFT, from: account === "gmail" && status?.user ? status.user : EMPTY_DRAFT.from, ...next });
    setComposing(true);
  }

  function reply(all) {
    if (!open) return;
    const quoted = open.body.split("\n").map((line) => `> ${line}`).join("\n");
    startDraft({
      to: open.from,
      cc: all ? [open.to, open.cc].filter(Boolean).join(", ") : "",
      subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`,
      body: `\n\nOn ${when(open.date)}, ${open.from} wrote:\n${quoted}`
    });
  }

  function forward() {
    if (!open) return;
    startDraft({
      to: "",
      subject: open.subject.startsWith("Fwd:") ? open.subject : `Fwd: ${open.subject}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${open.from}\nTo: ${open.to}\nSubject: ${open.subject}\n\n${open.body}`
    });
  }

  async function storeDraft(target) {
    setBusy(true);
    try {
      const saved = await api("/messages", { method: "POST", body: { ...draft, folder: target } });
      setComposing(false);
      setDraft(EMPTY_DRAFT);
      setOpen(null);
      if (target === "sent") setFolder("sent");
      else setFolder("drafts");
      await refresh(target, "");
      say?.("ok", target === "sent" ? (account === "gmail" ? `Delivered through Gmail to ${saved.to}` : `Sent to ${saved.to}`) : "Draft saved");
    } catch (error) {
      say?.("err", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function change(id, body, note) {
    await api(`/messages/${id}`, { method: "PATCH", body });
    if (open?.id === id) setOpen(await api(`/messages/${id}`));
    await refresh();
    if (note) say?.("ok", note);
  }

  async function remove(id) {
    const result = await api(`/messages/${id}`, { method: "DELETE" });
    if (open?.id === id) setOpen(null);
    await refresh();
    say?.("ok", result.deleted ? "Deleted" : "Moved to Trash");
  }

  async function importText(text) {
    const result = await api("/import", { method: "POST", body: { text, folder } });
    setPaste("");
    await refresh();
    say?.("ok", `Imported ${result.imported} message${result.imported === 1 ? "" : "s"} into ${folder}`);
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { await importText(await file.text()); }
    catch (error) { say?.("err", error.message); }
  }

  async function exportBox(format) {
    const params = new URLSearchParams({ format, folder });
    if (format === "eml") {
      if (!open) return say?.("err", "Open a message to export .eml");
      params.set("id", open.id);
    }
    const res = await fetch(`${root}/export?${params}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return say?.("err", data.error || "Export failed");
    }
    const blob = await res.blob();
    const name = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || (format === "eml" ? "message.eml" : `${folder}.mbox`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say?.("ok", `Exported ${name}`);
  }

  async function connectGmail() {
    setBusy(true);
    try {
      await api("/connect", { method: "POST", body: { user: loginUser, pass: loginPass } });
      setLoginPass("");
      await refresh();
      say?.("ok", `Connected ${loginUser}`);
    } catch (error) { say?.("err", error.message); }
    finally { setBusy(false); }
  }

  async function disconnectGmail() {
    await mail("/api/mail/gmail/connect", { method: "DELETE" });
    setStatus(null);
    setMessages([]);
    setOpen(null);
    await refresh();
    say?.("ok", "Gmail disconnected");
  }

  const field = (key, label, extra) => (
    <label className="field">
      <span>{label}</span>
      <input {...extra} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
    </label>
  );
  const gmailReady = account !== "gmail" || status?.configured !== false;

  return (
    <div className="tool mail">
      <aside className="tool-side">
        <div className="seg">
          <button className={account === "gmail" ? "on" : ""} onClick={() => { setAccount("gmail"); setOpen(null); setComposing(false); }}>Gmail</button>
          <button className={account === "local" ? "on" : ""} onClick={() => { setAccount("local"); setOpen(null); setComposing(false); }}>Local</button>
        </div>
        <b>{account === "gmail" ? (status?.user || "Gmail") : "Local mailbox"}</b>
        <span className={`mail-link ${status?.connected ? "on" : ""}`}>{status?.connected ? "Connected" : status?.configured === false ? "Not connected" : "Connecting…"} · {status?.path || (account === "gmail" ? "imap.gmail.com" : "data/mailbox")}</span>
        <span className="muted">{account === "gmail" ? (status?.connected ? `${status.user} · send delivers through Gmail` : "Connect once with a Google app password") : (status ? `${status.total} messages on this machine` : "Waiting for the studio API")}</span>
        {account === "gmail" && status?.configured && <button className="btn" onClick={() => disconnectGmail().catch((error) => say?.("err", error.message))}>Disconnect</button>}
        <div className="stack">
          {FOLDERS.map(([id, label]) => (
            <button key={id} className={`card ${folder === id ? "on" : ""}`} onClick={() => { setFolder(id); setOpen(null); }}>
              <b>{label}</b>
              <span className="muted">{status?.counts?.[id] ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="tool-main">
        <div className="codebar row">
          <b>Mail</b>
          <span className="muted">{FOLDERS.find(([id]) => id === folder)?.[1]} · {messages.length}</span>
          <span style={{ flex: 1 }} />
          <button className="btn on" disabled={!gmailReady} onClick={() => startDraft({})}>Compose</button>
          <button className="btn" disabled={!open} onClick={() => reply(false)}>Reply</button>
          <button className="btn" disabled={!open} onClick={() => reply(true)}>Reply all</button>
          <button className="btn" disabled={!open} onClick={forward}>Forward</button>
          <button className="btn" disabled={!messages.length} onClick={() => onApply(applyMail(project, messages))}>Place in project</button>
        </div>
        <div className="tool-body mail-body">
          {account === "gmail" && status?.configured === false ? (
            <div className="stack mail-connect">
              <b>Connect Gmail</b>
              <span className="muted">Inbox, Sent, and Send use eyeoverthink@gmail.com through imap.gmail.com and smtp.gmail.com. The app password stays in data/mailbox on this machine and is not committed.</span>
              <label className="field"><span>Gmail address</span><input value={loginUser} onChange={(event) => setLoginUser(event.target.value)} autoComplete="off" /></label>
              <label className="field"><span>App password</span><input type="password" value={loginPass} onChange={(event) => setLoginPass(event.target.value)} autoComplete="off" /></label>
              <div className="row">
                <button className="btn on" disabled={busy} onClick={connectGmail}>Connect</button>
                <a className="btn" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Get an app password</a>
              </div>
            </div>
          ) : (
          <>
          <input className="search" value={query} placeholder="Search this folder" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") refresh().catch((error) => say?.("err", error.message)); }} />
          <div className="mail-split">
            <div className="mail-list">
              {messages.length === 0 && <span className="muted">Nothing in this folder.</span>}
              {messages.map((message) => (
                <button key={message.id} className={`card ${open?.id === message.id ? "on" : ""} ${message.unread ? "mail-unread" : ""}`} onClick={() => openMessage(message.id).catch((error) => say?.("err", error.message))}>
                  <b>{message.flagged ? "★ " : ""}{message.subject}</b>
                  <span className="muted">{message.from} · {when(message.date)}</span>
                </button>
              ))}
            </div>
            <div className="mail-read">
              {open ? (
                <div className="stack">
                  <b>{open.subject}</b>
                  <span className="muted">From {open.from}</span>
                  <span className="muted">To {open.to}{open.cc ? ` · Cc ${open.cc}` : ""} · {when(open.date)}</span>
                  <pre className="mail-letter">{open.body}</pre>
                  <div className="row">
                    <button className="btn" onClick={() => change(open.id, { flagged: !open.flagged }, open.flagged ? "Flag removed" : "Flagged")}> {open.flagged ? "Unflag" : "Flag"}</button>
                    <button className="btn" onClick={() => change(open.id, { unread: !open.unread }, open.unread ? "Marked read" : "Marked unread")}>{open.unread ? "Mark read" : "Mark unread"}</button>
                    <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)} aria-label="Move to">
                      {FOLDERS.filter(([id]) => id !== open.folder).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <button className="btn" onClick={() => change(open.id, { folder: moveTo }, `Moved to ${moveTo}`)}>Move</button>
                    <button className="btn danger" onClick={() => remove(open.id)}>{open.folder === "trash" ? "Delete" : "Trash"}</button>
                  </div>
                </div>
              ) : <span className="muted">{account === "gmail" ? "Open a message, or compose one. Send delivers it through Gmail." : "Open a message, or compose a new one. Sent mail stays in the local mailbox."}</span>}
            </div>
          </div>
          </>
          )}
        </div>
      </section>

      <aside className="tool-side">
        {composing ? (
          <>
            <b>{draft.subject.startsWith("Re:") ? "Reply" : draft.subject.startsWith("Fwd:") ? "Forward" : "New message"}</b>
            {field("from", "From", account === "gmail" ? { readOnly: true } : undefined)}
            {field("to", "To")}
            {field("cc", "Cc")}
            {field("subject", "Subject")}
            <label className="field">
              <span>Message</span>
              <textarea className="dispatch-code" rows={10} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <div className="row">
              <button className="btn on" disabled={busy} onClick={() => storeDraft("sent")}>Send</button>
              <button className="btn" disabled={busy} onClick={() => storeDraft("drafts")}>Save draft</button>
              <button className="btn" onClick={() => setComposing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <b>Import / export</b>
            <span className="muted">Bring in .eml or .mbox, or take this folder back out. Files land in the folder you have open.</span>
            <label className="btn">Import file…<input type="file" accept=".eml,.mbox,.txt,message/rfc822" hidden onChange={onFile} /></label>
            <label className="field">
              <span>Or paste a message</span>
              <textarea className="dispatch-code" rows={6} value={paste} placeholder={"From: a@localhost\nTo: you@localhost\nSubject: Hello\n\nBody"} onChange={(event) => setPaste(event.target.value)} />
            </label>
            <button className="btn" disabled={!paste.trim()} onClick={() => importText(paste).catch((error) => say?.("err", error.message))}>Import pasted text</button>
            <div className="row">
              <button className="btn" disabled={!open} onClick={() => exportBox("eml")}>Export .eml</button>
              <button className="btn" onClick={() => exportBox("mbox")}>Export folder .mbox</button>
            </div>
            {open && (
              <>
                <b>This message</b>
                <span className="muted">{open.folder} · {open.unread ? "unread" : "read"} · {open.flagged ? "flagged" : "not flagged"}</span>
                <span className="muted">{open.id}</span>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

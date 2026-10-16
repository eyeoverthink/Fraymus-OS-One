import React, { useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";
import resourcesSource from "../scaffold/routes-resources.js?raw";

const STEPS = [
  ["schema", "Schema", "Name the resource and its fields."],
  ["create", "Create", "POST a new record."],
  ["read", "Read", "GET the collection or one record."],
  ["update", "Update", "PUT replaces a record. PATCH changes fields."],
  ["delete", "Delete", "DELETE removes a record."],
  ["compile", "Compile", "Package the page and the Express router."]
];

const METHODS = [
  { id: "GET", step: "read", label: "GET collection", hint: "List every record" },
  { id: "GET_ONE", step: "read", label: "GET one", hint: "Read a single id" },
  { id: "POST", step: "create", label: "POST", hint: "Create" },
  { id: "PUT", step: "update", label: "PUT", hint: "Replace the whole record" },
  { id: "PATCH", step: "update", label: "PATCH", hint: "Change only the fields you send" },
  { id: "DELETE", step: "delete", label: "DELETE", hint: "Remove by id" }
];

function pageSource(resource, fields) {
  const defaults = fields.map((field) => `${field.name}: ${field.type === "number" ? "0" : field.type === "boolean" ? "false" : '""'}`).join(", ");
  return `import React from "react";

export default function Records() {
  const resource = ${JSON.stringify(resource)};
  const api = ((typeof window !== "undefined" && window.FRAY_API) || "") + "/api/r/" + resource;
  const [rows, setRows] = React.useState([]);
  const [form, setForm] = React.useState({ ${defaults} });
  const [editId, setEditId] = React.useState("");
  const [error, setError] = React.useState("");

  async function load() {
    const res = await fetch(api);
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Read failed"); return; }
    setRows(data);
    setError("");
  }
  React.useEffect(() => { load(); }, []);

  async function send(method, path, body) {
    const res = await fetch(api + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || method + " failed");
    else setError("");
    await load();
    return data;
  }

  return (
    <main className="page">
      <p className="kicker">CRUD · {resource}</p>
      <h1>{resource}</h1>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); send(editId ? "PUT" : "POST", editId ? "/" + editId : "", form); setEditId(""); }}>
        ${fields.map((field) => field.type === "boolean"
          ? `<label key="${field.name}"><input type="checkbox" checked={!!form.${field.name}} onChange={(event) => setForm({ ...form, ${field.name}: event.target.checked })} /> ${field.name}</label>`
          : `<label key="${field.name}">${field.name}<input type="${field.type === "number" ? "number" : "text"}" value={form.${field.name}} onChange={(event) => setForm({ ...form, ${field.name}: ${field.type === "number" ? "Number(event.target.value)" : "event.target.value"} })} /></label>`
        ).join("\n        ")}
        <button className="btn" type="submit">{editId ? "PUT update" : "POST create"}</button>
      </form>
      {error && <p className="warn">{error}</p>}
      <ul className="list">
        {rows.map((row) => (
          <li key={row.id}>
            <div><strong>{row.title || row.name || row.id}</strong><span>{row.id}</span></div>
            <div className="row">
              <button type="button" onClick={() => { setEditId(row.id); setForm({ ${fields.map((field) => `${field.name}: row.${field.name} ?? form.${field.name}`).join(", ")} }); }}>Edit</button>
              <button type="button" onClick={() => send("PATCH", "/" + row.id, { status: "patched" })}>PATCH</button>
              <button type="button" onClick={() => send("DELETE", "/" + row.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
`;
}

export function applyCrud(project, resource, fields) {
  const next = project.stack === "mern" ? ensureMern(project) : { ...project };
  const html = `<section class="crud-card"><h2>${resource}</h2><form id="crudForm"></form><ul id="crudList"></ul></section>`;
  const js = `var api="/live/${project.id}/api/r/${resource}";`;
  if (next.stack !== "mern") {
    return { ...next, html: (next.html || "") + "\n" + html, js: (next.js || "") + "\n" + js };
  }
  const file = "client/src/pages/Records.jsx";
  const pages = next.pages.some((page) => page.name === "Records")
    ? next.pages
    : [...next.pages, { name: "Records", path: "/records", file, auth: false }];
  let server = next.files["server/index.js"] || "";
  if (server && !server.includes("/api/r")) {
    server = server.replace(
      'app.use("/api", require("./routes/api"));',
      'app.use("/api", require("./routes/api"));\napp.use("/api/r", require("./routes/resources"));'
    );
  }
  return {
    ...next,
    pages,
    files: {
      ...next.files,
      [file]: pageSource(resource, fields),
      "server/routes/resources.js": resourcesSource,
      ...(server ? { "server/index.js": server } : {}),
      "client/src/App.jsx": buildAppSource(pages)
    }
  };
}

export default function CrudPage({ project, onApply, say }) {
  const [step, setStep] = useState("schema");
  const [resource, setResource] = useState("items");
  const [fields, setFields] = useState([
    { name: "title", type: "string" },
    { name: "status", type: "string" }
  ]);
  const [values, setValues] = useState({ title: "", status: "draft" });
  const [recordId, setRecordId] = useState("");
  const [rows, setRows] = useState([]);
  const [log, setLog] = useState([]);

  function note(entry) {
    setLog((list) => [{ id: Date.now() + Math.random(), ...entry }, ...list].slice(0, 40));
  }

  async function call(method) {
    if (!project) return;
    const base = `/live/${project.id}/api/r/${resource}`;
    const path = method === "GET" || method === "POST" ? base : `${base}/${recordId}`;
    if ((method === "GET_ONE" || method === "PUT" || method === "PATCH" || method === "DELETE") && !recordId) {
      note({ ok: false, method, path, text: "Choose a record id first." });
      return;
    }
    const verb = method === "GET_ONE" ? "GET" : method;
    const body = verb === "GET" || verb === "DELETE" ? null : values;
    try {
      const res = await fetch(method === "GET_ONE" ? `${base}/${recordId}` : path, {
        method: verb,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      note({ ok: res.ok, method: verb, path: method === "GET_ONE" ? `${base}/${recordId}` : path, text: JSON.stringify(data, null, 2) });
      if (verb === "POST" && data.id) setRecordId(data.id);
      if (verb === "GET" && method !== "GET_ONE" && Array.isArray(data)) setRows(data);
      if (!res.ok) say?.("error", data.error || verb + " failed");
      else say?.("ok", verb + " " + resource);
    } catch (error) {
      note({ ok: false, method: verb, path, text: error.message });
    }
  }

  return (
    <div className="tool">
      <aside className="tool-side">
        <p className="fh">Process</p>
        {STEPS.map(([id, label, copy]) => (
          <button key={id} className={`card ${step === id ? "on" : ""}`} onClick={() => setStep(id)}>
            <b>{label}</b>
            <span className="muted">{copy}</span>
          </button>
        ))}
      </aside>
      <section className="tool-main">
        <div className="codebar">
          <b>CRUD</b>
          <span className="muted">GET · POST · PUT · PATCH · DELETE</span>
        </div>
        <div className="tool-body">
          <label className="field">Resource
            <input value={resource} onChange={(event) => setResource(event.target.value.toLowerCase())} spellCheck={false} />
          </label>
          {step === "schema" && (
            <div className="stack">
              {fields.map((field, index) => (
                <div key={index} className="row">
                  <input value={field.name} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, name: event.target.value.replace(/[^A-Za-z0-9_]/g, "") } : item))} />
                  <select value={field.type} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <button className="btn danger" onClick={() => setFields(fields.filter((_, i) => i !== index))} disabled={fields.length < 2}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => setFields([...fields, { name: "field", type: "string" }])}>Add field</button>
            </div>
          )}
          {step !== "schema" && step !== "compile" && (
            <div className="stack">
              {fields.map((field) => (
                <label key={field.name} className="field">{field.name}
                  {field.type === "boolean"
                    ? <input type="checkbox" checked={!!values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.checked })} />
                    : <input type={field.type === "number" ? "number" : "text"} value={values[field.name] ?? ""} onChange={(event) => setValues({ ...values, [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value })} />}
                </label>
              ))}
              <label className="field">Record id
                <input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="from the list" />
              </label>
              <div className="row">
                {METHODS.filter((method) => method.step === step).map((method) => (
                  <button key={method.id} className="btn on" title={method.hint} onClick={() => call(method.id)}>{method.label}</button>
                ))}
              </div>
              {rows.length > 0 && (
                <div className="stack">
                  {rows.map((row) => (
                    <button key={row.id} className={`card ${recordId === row.id ? "on" : ""}`} onClick={() => { setRecordId(row.id); setValues({ ...values, ...row }); }}>
                      <b>{row.title || row.name || row.id}</b>
                      <span className="muted">{row.id} · {row.status || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === "compile" && (
            <div className="stack">
              <p className="note blue">Compile writes a Records page and mounts GET, POST, PUT, PATCH, and DELETE at /api/r/{resource}. Restart Node after compiling server files.</p>
              <button className="btn on" onClick={() => { onApply(applyCrud(project, resource, fields)); say?.("ok", "CRUD packaged into the project"); }}>Package into project</button>
            </div>
          )}
        </div>
      </section>
      <aside className="tool-side">
        <p className="fh">Responses</p>
        <div className="logs" style={{ maxHeight: "none", flex: 1 }}>
          {log.length === 0 && <div className="muted">Run a method. The status and JSON land here.</div>}
          {log.map((entry) => (
            <div key={entry.id} className={`clog ${entry.ok ? "ok" : "error"}`}>
              <b>{entry.method}</b> {entry.path}
              <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{entry.text}</pre>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

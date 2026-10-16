import React, { useMemo, useState } from "react";
import { buildAppSource, ensureMern } from "../model.js";

const BLOCKS = [
  { kind: "text", label: "Text", hint: "A paragraph" },
  { kind: "image", label: "Image", hint: "URL picture" },
  { kind: "link", label: "Link", hint: "Anchor" },
  { kind: "note", label: "Note", hint: "Callout" },
  { kind: "stack", label: "Stack", hint: "Vertical group" }
];

const FACES = ["Front", "Right", "Back", "Left", "Top", "Bottom"];

function uid() {
  return "e" + Math.random().toString(36).slice(2, 8);
}

function blankEntity(kind, x, y, z) {
  return {
    id: uid(),
    kind,
    x, y, z,
    components: {
      content: { text: kind === "text" ? "Write here" : kind === "note" ? "A note" : kind === "stack" ? "Stacked line" : "" },
      media: { src: kind === "image" ? "https://picsum.photos/seed/fraymus/480/320" : "", alt: "" },
      link: { href: kind === "link" ? "https://example.com" : "", label: kind === "link" ? "Open" : "" },
      style: { color: "#dcddde", align: "left", size: "m" },
      layout: { span: 1 }
    }
  };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

export function renderCanvas(doc) {
  const layers = [...Array(doc.size)].map((_, z) => {
    const cells = doc.entities.filter((entity) => entity.z === z);
    const inner = cells.map((entity) => {
      const style = entity.components.style || {};
      const span = entity.components.layout?.span || 1;
      const css = `grid-column:${entity.x + 1} / span ${span};grid-row:${entity.y + 1};color:${style.color || "inherit"};text-align:${style.align || "left"};font-size:${style.size === "l" ? "1.8rem" : style.size === "s" ? ".85rem" : "1rem"}`;
      let body = "";
      if (entity.components.media?.src) body += `<img alt="${esc(entity.components.media.alt)}" src="${esc(entity.components.media.src)}">`;
      if (entity.components.link?.href) body += `<a href="${esc(entity.components.link.href)}">${esc(entity.components.link.label || "Link")}</a>`;
      if (entity.components.content?.text) body += `<p>${esc(entity.components.content.text)}</p>`;
      return `<article class="cube-cell kind-${entity.kind}" style="${css}">${body}</article>`;
    }).join("");
    return `<section class="cube-layer" data-face="${z}" style="display:grid;grid-template-columns:repeat(${doc.size},1fr);gap:12px">${inner}</section>`;
  }).join("\n");
  const css = `.cube-layer{margin:24px 0}.cube-cell{background:#262626;border:1px solid #333;border-radius:12px;padding:14px;min-height:72px}.cube-cell img{width:100%;border-radius:8px}.cube-cell a{color:#a99bf7}`;
  return { html: `<div class="cube-doc">${layers}</div>`, css };
}

export function applyCanvas(project, doc) {
  const { html, css } = renderCanvas(doc);
  if (project.stack !== "mern") {
    return { ...project, html: (project.html || "") + "\n" + html, css: (project.css || "") + "\n" + css };
  }
  const next = ensureMern(project);
  const file = "client/src/pages/Board.jsx";
  const pages = next.pages.some((page) => page.name === "Board")
    ? next.pages
    : [...next.pages, { name: "Board", path: "/board", file, auth: false }];
  const source = `import React from "react";
export default function Board() {
  return <main className="page" dangerouslySetInnerHTML={{ __html: \`${html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\` }} />;
}
`;
  return {
    ...next,
    pages,
    files: {
      ...next.files,
      [file]: source,
      "client/src/styles.css": (next.files["client/src/styles.css"] || "") + "\n" + css,
      "client/src/App.jsx": buildAppSource(pages)
    }
  };
}

function BlockView({ entity }) {
  const text = entity.components.content?.text;
  const src = entity.components.media?.src;
  const link = entity.components.link;
  return (
    <div>
      {src && <img alt="" src={src} />}
      {link?.href && <a href={link.href} onClick={(event) => event.preventDefault()}>{link.label || "Link"}</a>}
      {text && <p>{text}</p>}
    </div>
  );
}

export default function CanvasPage({ project, onApply, say }) {
  const [size, setSize] = useState(3);
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState("grid");
  const [entities, setEntities] = useState(() => [blankEntity("text", 0, 0, 0), blankEntity("note", 1, 1, 0)]);
  const [selected, setSelected] = useState(null);
  const current = entities.find((entity) => entity.id === selected) || null;
  const face = entities.filter((entity) => entity.z === layer);

  const doc = useMemo(() => ({ size, entities }), [size, entities]);

  function dropKind(kind, x, y) {
    const entity = blankEntity(kind, x, y, layer);
    setEntities((list) => [...list.filter((item) => !(item.x === x && item.y === y && item.z === layer)), entity]);
    setSelected(entity.id);
  }

  function moveEntity(id, x, y) {
    setEntities((list) => list.map((entity) => entity.id === id ? { ...entity, x, y, z: layer } : entity));
  }

  function patchComponent(group, key, value) {
    setEntities((list) => list.map((entity) => entity.id === selected ? {
      ...entity,
      components: { ...entity.components, [group]: { ...entity.components[group], [key]: value } }
    } : entity));
  }

  function onCellDrop(event, x, y) {
    event.preventDefault();
    const kind = event.dataTransfer.getData("application/fray-kind");
    const id = event.dataTransfer.getData("application/fray-id");
    if (kind) dropKind(kind, x, y);
    else if (id) moveEntity(id, x, y);
  }

  return (
    <div className="tool obs">
      <aside className="tool-side">
        <p className="fh">Bin</p>
        {BLOCKS.map((block) => (
          <button
            key={block.kind}
            className="chip"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("application/fray-kind", block.kind)}
          >
            <b>{block.label}</b>
            <span className="muted">{block.hint}</span>
          </button>
        ))}
        <p className="fh">Cube</p>
        <div className="row">
          {[2, 3, 4].map((value) => (
            <button key={value} className={`btn ${size === value ? "on" : ""}`} onClick={() => { setSize(value); setLayer(0); }}>{value}×{value}</button>
          ))}
        </div>
        <div className="row">
          {FACES.slice(0, size === 2 ? 2 : size).map((name, index) => (
            <button key={name} className={`btn ${layer === index ? "on" : ""}`} onClick={() => setLayer(index)}>{name}</button>
          ))}
        </div>
      </aside>
      <section className="tool-main">
        <div className="codebar">
          <b>Canvas</b>
          <span className="muted">{mode === "grid" ? "Grid face" : "Stack"} · layer {layer + 1}</span>
          <span className="spacer" />
          <div className="seg">
            <button className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")}>Grid</button>
            <button className={mode === "stack" ? "on" : ""} onClick={() => setMode("stack")}>Stack</button>
          </div>
          <button className="btn on" onClick={() => { onApply(applyCanvas(project, doc)); say?.("ok", "Canvas compiled into the project"); }}>Compile</button>
        </div>
        {mode === "grid" ? (
          <div className="cube" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size * size }, (_, index) => {
              const x = index % size;
              const y = Math.floor(index / size);
              const entity = face.find((item) => item.x === x && item.y === y);
              return (
                <div
                  key={index}
                  className={`cube-drop ${entity?.id === selected ? "on" : ""}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onCellDrop(event, x, y)}
                  onClick={() => entity && setSelected(entity.id)}
                >
                  {entity ? (
                    <article
                      className="obs-card"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("application/fray-id", entity.id)}
                    >
                      <span className="muted">{entity.kind}</span>
                      <BlockView entity={entity} />
                    </article>
                  ) : <span className="muted">{x},{y}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="stack-bin"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const kind = event.dataTransfer.getData("application/fray-kind");
              if (kind) dropKind(kind, 0, face.length);
            }}
          >
            {face.length === 0 && <p className="muted">Drop blocks from the bin. The stack is this face, top to bottom.</p>}
            {[...face].sort((a, b) => a.y - b.y).map((entity, index) => (
              <article
                key={entity.id}
                className={`obs-card ${entity.id === selected ? "on" : ""}`}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("application/fray-id", entity.id)}
                onClick={() => setSelected(entity.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.stopPropagation(); moveEntity(event.dataTransfer.getData("application/fray-id"), 0, index); }}
              >
                <BlockView entity={entity} />
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="tool-side">
        <p className="fh">Components</p>
        {!current && <p className="muted">Select a block. Each block is an entity. Content, media, link, style, and layout are its components.</p>}
        {current && (
          <div className="stack">
            <b>{current.kind}</b>
            <label className="field">Text
              <textarea rows={3} value={current.components.content?.text || ""} onChange={(event) => patchComponent("content", "text", event.target.value)} />
            </label>
            <label className="field">Image URL
              <input value={current.components.media?.src || ""} onChange={(event) => patchComponent("media", "src", event.target.value)} />
            </label>
            <label className="field">Link
              <input value={current.components.link?.href || ""} onChange={(event) => patchComponent("link", "href", event.target.value)} placeholder="https://" />
            </label>
            <label className="field">Link label
              <input value={current.components.link?.label || ""} onChange={(event) => patchComponent("link", "label", event.target.value)} />
            </label>
            <label className="field">Color
              <input value={current.components.style?.color || ""} onChange={(event) => patchComponent("style", "color", event.target.value)} />
            </label>
            <label className="field">Align
              <select value={current.components.style?.align || "left"} onChange={(event) => patchComponent("style", "align", event.target.value)}>
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </select>
            </label>
            <label className="field">Size
              <select value={current.components.style?.size || "m"} onChange={(event) => patchComponent("style", "size", event.target.value)}>
                <option value="s">small</option>
                <option value="m">medium</option>
                <option value="l">large</option>
              </select>
            </label>
            <button className="btn danger" onClick={() => { setEntities(entities.filter((entity) => entity.id !== current.id)); setSelected(null); }}>Remove entity</button>
          </div>
        )}
      </aside>
    </div>
  );
}

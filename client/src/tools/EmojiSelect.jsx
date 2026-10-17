import React, { useEffect, useRef, useState } from "react";
import { CATEGORIES, weigh } from "./emojiCatalog.js";

export default function EmojiSelect({ value, onChange, extra = [], label = "Choose emoji", placeholder = "＋" }) {
  const groups = [...extra.filter(([, , items]) => items.length), ...CATEGORIES];
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(groups[0]?.[0] || "smileys");
  const [place, setPlace] = useState({});
  const root = useRef(null);

  function toggle() {
    if (open) return setOpen(false);
    const rect = root.current.getBoundingClientRect();
    const height = 320;
    const below = window.innerHeight - rect.bottom > height;
    setPlace({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)), ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const items = (groups.find(([id]) => id === group) || groups[0])?.[2] || [];
  return (
    <div className="esel" ref={root}>
      <button type="button" className="esel-btn" onClick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label={label} title={value ? weigh(value).hex : label}>
        <span>{value || placeholder}</span><small>▾</small>
      </button>
      {open && (
        <div className="esel-pop" style={place} role="listbox" aria-label={label}>
          <select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Emoji category">
            {groups.map(([id, name, list]) => <option key={id} value={id}>{name} ({list.length})</option>)}
          </select>
          <div className="esel-grid">
            {items.map((glyph) => (
              <button type="button" key={glyph} role="option" aria-selected={glyph === value} className={glyph === value ? "on" : ""} title={weigh(glyph).hex} onClick={() => { onChange(glyph); setOpen(false); }}>{glyph}</button>
            ))}
          </div>
          {value && <span className="muted esel-foot">{value} · {weigh(value).utf8} UTF-8 bytes · {weigh(value).hex}</span>}
        </div>
      )}
    </div>
  );
}

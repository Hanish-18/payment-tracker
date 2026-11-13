import { useState, useEffect, useRef } from "react";

/* Colour themes. Choosing one changes buttons, headers, cards and the sidebar everywhere. */
export const ACCENTS = {
  Blue:   { pri: "#1d62f0", pri2: "#3b82ff", d: "#0a47d6", deep: "#0a1f6b", side: ["#0c2257", "#0a1b47", "#0b2a6e"], w1: "#153f9a", w2: "#1f66f2" },
  Purple: { pri: "#6d3fd9", pri2: "#9b6bf2", d: "#4b21b8", deep: "#24105f", side: ["#26115e", "#1d0d4a", "#3a1c86"], w1: "#4a2a9a", w2: "#7a4df0" },
  Green:  { pri: "#0f9d58", pri2: "#34c77b", d: "#0a7a43", deep: "#053d22", side: ["#0a3a24", "#072b1a", "#0b5a36"], w1: "#0c5a36", w2: "#1fbf6b" },
  Orange: { pri: "#f26a1b", pri2: "#ff9a4d", d: "#c2500c", deep: "#5a2205", side: ["#4a1e08", "#381504", "#7a3510"], w1: "#8a3a0e", w2: "#f26a1b" },
  Pink:   { pri: "#e11d74", pri2: "#f472b6", d: "#b3135b", deep: "#52062b", side: ["#4a0a2a", "#38071f", "#7a1346"], w1: "#8a1a50", w2: "#e11d74" },
  Teal:   { pri: "#0e9aa7", pri2: "#35c4d0", d: "#0a727c", deep: "#04373d", side: ["#06373d", "#052a2f", "#0a5a63"], w1: "#0a5a63", w2: "#12b5c3" },
};
const KEY = "splitpay-accent";

export function getAccent() {
  try {
    const v = localStorage.getItem(KEY);
    return ACCENTS[v] ? v : "Blue";
  } catch {
    return "Blue";
  }
}

export function applyAccent(name) {
  const a = ACCENTS[name] || ACCENTS.Blue;
  const r = document.documentElement.style;
  r.setProperty("--pri", a.pri);
  r.setProperty("--pri2", a.pri2);
  r.setProperty("--pri-d", a.d);
  r.setProperty("--hero", `linear-gradient(170deg, ${a.deep} 0%, ${a.d} 55%, ${a.pri} 100%)`);
  r.setProperty("--bal-bg", `linear-gradient(135deg, ${a.d}, ${a.pri2})`);
  r.setProperty("--side-bg", `linear-gradient(180deg, ${a.side[0]} 0%, ${a.side[1]} 72%, ${a.side[2]} 100%)`);
  r.setProperty("--wave1", a.w1);
  r.setProperty("--wave2", a.w2);
  r.setProperty("--tile", "color-mix(in srgb, var(--pri) 9%, var(--card))");
  r.setProperty("--tile2", "color-mix(in srgb, var(--pri) 18%, var(--card))");
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", a.pri);
}

export function setAccent(name) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // storage blocked: colour still changes for this visit
  }
  applyAccent(name);
  window.dispatchEvent(new Event("splitpay-accent"));
}

// Runs once when the app opens, so the saved colour is applied immediately
applyAccent(getAccent());

export function useAccent() {
  const [name, setName] = useState(getAccent());
  useEffect(() => {
    const on = () => setName(getAccent());
    window.addEventListener("splitpay-accent", on);
    return () => window.removeEventListener("splitpay-accent", on);
  }, []);
  return name;
}

/* Row of colour circles. Used in Settings. */
export function AccentPicker() {
  const cur = useAccent();
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {Object.entries(ACCENTS).map(([name, a]) => (
        <button
          key={name}
          type="button"
          onClick={() => setAccent(name)}
          aria-label={name}
          style={{
            width: 58, border: 0, background: "transparent", padding: 0, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: "var(--ink)", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center",
              background: `linear-gradient(135deg, ${a.d}, ${a.pri2})`, color: "#fff", fontSize: 20,
              boxShadow: cur === name ? `0 0 0 3px var(--card), 0 0 0 5px ${a.pri}` : "none",
            }}
          >
            {cur === name ? "✓" : ""}
          </span>
          {name}
        </button>
      ))}
    </div>
  );
}

/* Small floating button for the computer view, so colours can be changed there too */
export function ThemeFab() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 900 }}>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, bottom: 56, background: "var(--card)", color: "var(--ink)",
            border: "1px solid var(--cardline)", borderRadius: 18, padding: 16, width: 230,
            boxShadow: "0 12px 40px rgba(10,25,70,.25)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Theme colour</div>
          <AccentPicker />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Theme colour"
        style={{
          width: 46, height: 46, borderRadius: "50%", border: 0, cursor: "pointer", fontSize: 20,
          background: "linear-gradient(135deg, var(--pri-d, #0a47d6), var(--pri2))", color: "#fff",
          boxShadow: "0 8px 22px rgba(0,0,0,.25)",
        }}
      >
        🎨
      </button>
    </div>
  );
}

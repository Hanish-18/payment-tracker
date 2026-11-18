/* Dynamic Island style pill + QR scanner button.
   This file starts itself when the app loads (it is imported by MobileAnalytics.jsx), so App.jsx needs no change.
   - Shows a pill at the top when an expense or a friend is saved, or when something is marked settled.
   - Adds a QR scanner button to the left of the bell on the Home screen.
   Other files can also call:  island({ title, sub, kind })  and  openScanner() */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./dynamic-island.css";
import { supabase } from "./supabaseClient";
import QrScanner from "./QrScanner";

const bus = new EventTarget();
export function island(opts) { bus.dispatchEvent(new CustomEvent("show", { detail: opts || {} })); }
island.hide = () => bus.dispatchEvent(new Event("hide"));
export function openScanner() { bus.dispatchEvent(new Event("scan")); }

const money = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

function Right({ kind }) {
  if (kind === "spinner") return <span className="di-spin" />;
  if (kind === "chart") {
    return (
      <svg className="di-chart" width="30" height="24" viewBox="0 0 30 24" fill="none" stroke="#3b82ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 19l8-8 5 5 10-11M20 5h6v6" />
      </svg>
    );
  }
  return (
    <span className="di-ok">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}

function Island() {
  const [cur, setCur] = useState(null);
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(11);
  const timer = useRef(null);

  useEffect(() => {
    const p = document.createElement("div");
    p.style.cssText = "position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(p);
    const inset = parseFloat(getComputedStyle(p).paddingTop) || 0;
    p.remove();
    setTop(inset >= 54 ? 11 : inset + 8);
  }, []);

  useEffect(() => {
    const close = () => {
      clearTimeout(timer.current);
      setOpen(false);
      timer.current = setTimeout(() => setCur(null), 480);
    };
    const show = (e) => {
      const o = e.detail || {};
      clearTimeout(timer.current);
      setCur({ id: Date.now(), ...o });
      setOpen(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
      const d = o.duration === 0 ? 0 : o.duration || 3400;
      if (d) timer.current = setTimeout(close, d);
    };
    bus.addEventListener("show", show);
    bus.addEventListener("hide", close);
    return () => {
      bus.removeEventListener("show", show);
      bus.removeEventListener("hide", close);
      clearTimeout(timer.current);
    };
  }, []);

  if (!cur) return null;
  return (
    <div className={"di" + (open ? " open" : "")} style={{ top }} role="status" aria-live="polite">
      <div className="di-in">
        <span className="di-app">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <rect x="3.5" y="9" width="11" height="11" rx="3" /><rect x="9.5" y="3.5" width="11" height="11" rx="3" />
          </svg>
        </span>
        <span className="di-tx">
          <b>{cur.title || "SplitPay"}</b>
          {cur.sub && <small>{cur.sub}</small>}
        </span>
        <Right kind={cur.kind} />
      </div>
    </div>
  );
}

function Overlays() {
  const [scan, setScan] = useState(false);
  useEffect(() => {
    const on = () => setScan(true);
    bus.addEventListener("scan", on);
    return () => bus.removeEventListener("scan", on);
  }, []);
  return (
    <>
      <Island />
      {scan && <QrScanner notify={island} onClose={() => setScan(false)} />}
    </>
  );
}

/* ---- Announce when something is saved (no other file needs to call this) ---- */
function wrapThen(b, ok) {
  const t = b.then.bind(b);
  b.then = (res, rej) => t((r) => {
    try { if (r && !r.error) ok(); } catch (e) { /* ignore */ }
    return res ? res(r) : r;
  }, rej);
}

if (typeof window !== "undefined" && !supabase.__spIslandPatched) {
  supabase.__spIslandPatched = true;
  const origFrom = supabase.from.bind(supabase);
  supabase.from = (table) => {
    const q = origFrom(table);
    if (table !== "entries" && table !== "friends") return q;
    if (q.insert) {
      const oi = q.insert.bind(q);
      q.insert = (rows, ...rest) => {
        const b = oi(rows, ...rest);
        wrapThen(b, () => {
          const list = [].concat(rows || []);
          if (table === "entries") {
            const sum = list.reduce((s, r) => s + Number(r.amount || 0), 0);
            const who = list.length === 1 ? list[0].friend : `${list.length} people`;
            island({ title: "SplitPay", sub: `Expense added • ${money(sum)}${who ? " • " + who : ""}`, kind: "check" });
          } else {
            island({ title: "SplitPay", sub: list.length === 1 ? `Friend added • ${list[0].name || ""}` : `${list.length} friends added`, kind: "check" });
          }
        });
        return b;
      };
    }
    if (table === "entries" && q.update) {
      const ou = q.update.bind(q);
      q.update = (vals, ...rest) => {
        const b = ou(vals, ...rest);
        if (vals && vals.status === "Settled") wrapThen(b, () => island({ title: "SplitPay", sub: "Marked as settled", kind: "check" }));
        return b;
      };
    }
    return q;
  };
}

/* ---- Start the overlays and add the scan button next to the bell ---- */
if (typeof document !== "undefined" && !window.__spOverlays) {
  window.__spOverlays = true;
  const host = document.createElement("div");
  host.id = "sp-overlays";
  document.body.appendChild(host);
  createRoot(host).render(<Overlays />);

  const ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/></svg>';
  let queued = false;
  const inject = () => {
    queued = false;
    const bell = document.querySelector(".mb-top .sp-bell");
    const title = document.querySelector(".mb-top .mb-ttl h1");
    const old = document.getElementById("sp-scan-btn");
    const isHome = title && /^\s*Hi,/i.test(title.textContent || "");
    if (!bell || !isHome) { if (old) old.remove(); return; }
    const spot = bell.closest(".sp-ib") || bell;
    if (old && old.nextElementSibling === spot) return;
    if (old) old.remove();
    const b = document.createElement("button");
    b.id = "sp-scan-btn";
    b.type = "button";
    b.className = "sp-bell sp-scan";
    b.setAttribute("aria-label", "Scan QR");
    b.innerHTML = ICON;
    b.addEventListener("click", openScanner);
    spot.parentNode.insertBefore(b, spot);
  };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(inject);
  }).observe(document.body, { childList: true, subtree: true });
  inject();
}

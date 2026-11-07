import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ---------- helpers ---------- */
export const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const todayLocal = () => new Date().toLocaleDateString("en-CA");
export const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
const toDate = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
export const fmtShort = (s) => toDate(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const fmtLong = (s) => toDate(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const UPI_RE = /^[\w.\-]{2,}@[A-Za-z]{2,}$/;
export const first = (n) => String(n || "").trim().split(" ")[0] || "";
export const myUpi = () => localStorage.getItem("upiId") || "";

export function cleanPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d;
}
export function waLink(phone, text) {
  const p = cleanPhone(phone);
  return (p ? "https://wa.me/" + p : "https://wa.me/") + "?text=" + encodeURIComponent(text);
}

export const CAT_ICON = { "Food & Dining": "🍴", Travel: "🚗", Accommodation: "🛏️", Shopping: "🛍️", Others: "🧾" };
export const CAT_COLOR = { "Food & Dining": "#4f7cff", Travel: "#2e9bff", Accommodation: "#ffa940", Shopping: "#43d17a", Others: "#c9ced6" };

export function categoryOf(note) {
  const t = String(note || "").toLowerCase();
  const has = (words) => words.some((w) => t.includes(w));
  if (has(["food", "lunch", "dinner", "breakfast", "cafe", "coffee", "tea", "restaurant", "pizza", "burger", "snack", "zomato", "swiggy", "biryani", "drinks", "party"])) return "Food & Dining";
  if (has(["cab", "taxi", "uber", "ola", "auto", "flight", "train", "bus", "metro", "fuel", "petrol", "diesel", "toll", "trip", "ticket", "travel", "ride"])) return "Travel";
  if (has(["hotel", "room", "stay", "rent", "airbnb", "hostel", "resort", "booking"])) return "Accommodation";
  if (has(["shop", "shopping", "clothes", "amazon", "flipkart", "grocer", "gift", "mall", "market", "dress"])) return "Shopping";
  return "Others";
}

export function friendBalance(entries, name) {
  let net = 0;
  entries.forEach((e) => {
    if (e.friend === name && e.status !== "Settled") net += Number(e.amount) * (e.paid_by === "me" ? 1 : -1);
  });
  return Math.round(net * 100) / 100;
}

export function reminderText({ name, amount, title, due }) {
  const lines = [`Hi ${first(name)}! 👋`, "Payment reminder from SplitPay.", "", `💸 ${rupee(amount)}${title ? " for " + title : ""}`];
  if (due) lines.push(`📅 Please pay by ${fmtLong(due)}`);
  if (myUpi()) lines.push("", `Pay via UPI: ${myUpi()}`);
  return lines.join("\n");
}

export function settledText({ from, to, amount, title, method }) {
  return [
    "✅ *Payment Settled* · SplitPay",
    `${from || "I"} has sent you ${rupee(amount)}`,
    "",
    `🧾 Expense: ${title}`,
    `💰 Amount: ${rupee(amount)}`,
    `💳 Paid via: ${method}`,
    "📌 Status: Settled ✅",
    "",
    `Hey ${first(to)}! 🙌 I've settled ${rupee(amount)} for "${title}" on SplitPay. Thanks! 🙏`,
  ].join("\n");
}

/* ---------- data hook ---------- */
export function useLedger(sync) {
  const [s, setS] = useState({ entries: [], friends: [], me: { id: null, name: "" }, loading: true, error: "" });

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session ? sess.session.user : null;
    const meta = (user && user.user_metadata) || {};
    const me = { id: user ? user.id : null, name: meta.name || meta.full_name || "" };
    const [e, f, p] = await Promise.all([
      supabase.from("entries").select("*").order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("friends").select("*").order("name"),
      supabase.from("profiles").select("id, name"),
    ]);
    if (e.error || f.error) {
      setS((x) => ({ ...x, loading: false, error: (e.error || f.error).message }));
      return;
    }
    const names = {};
    (p.data || []).forEach((r) => (names[r.id] = r.name));
    const local = {};
    f.data.forEach((r) => {
      if (r.linked_user_id) local[r.linked_user_id] = r.name;
    });
    const entries = e.data.map((en) =>
      en.user_id === me.id
        ? en
        : { ...en, friend: local[en.user_id] || names[en.user_id] || "Friend", paid_by: en.paid_by === "me" ? "friend" : "me", shared: true }
    );
    setS({ entries, friends: f.data, me, loading: false, error: "" });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(async () => {
    await load();
    if (sync) sync();
  }, [load, sync]);

  return { ...s, reload };
}

/* ---------- small shared components ---------- */
export function Avatar({ name, size = 46 }) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="kt-ava" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${h} 62% 52%)` }}>
      {String(name).charAt(0).toUpperCase()}
    </span>
  );
}

export function Head({ title, onBack }) {
  return (
    <div className="kt-head">
      <button className="kt-back" onClick={onBack} aria-label="Back">←</button>
      <div className="kt-title">{title}</div>
      <span className="kt-head-gap" />
    </div>
  );
}

export function BalanceText({ net }) {
  if (net > 0) return <span className="kt-get">You get {rupee(net)}</span>;
  if (net < 0) return <span className="kt-owe">You owe {rupee(-net)}</span>;
  return <span className="kt-set">Settled</span>;
}

export function Err({ text }) {
  return text ? <div className="kt-err">{text}</div> : null;
}

/* ---------- styles for all mobile screens ---------- */
export const CSS = `
.kt-x{color:var(--ink);font-family:"Plus Jakarta Sans","Inter",-apple-system,"Segoe UI",Roboto,sans-serif;--bg1:#eaf0ff;--bg2:#f8faff;--card:#fff;--ink:#0f172a;--muted:#64748b;--line:#e5ebf7;--blue:#2563eb;--blue2:#3b82f6;--chip:#eaf0ff;--field:#f5f8ff;--green:#16a34a;--green-bg:#e3f7ea;--red:#dc2626;--red-bg:#fde8e8;--shadow:0 6px 24px rgba(37,99,235,.1)}
.kt-x.kt-dark{--bg1:#0b1020;--bg2:#080b13;--card:#0f1521;--ink:#f5f7fb;--muted:#8b95ab;--line:#1c2538;--chip:#16254a;--field:#121a29;--green:#4ade80;--green-bg:#0f2c1b;--red:#ff5a6e;--red-bg:#341018;--shadow:0 8px 28px rgba(0,0,0,.45)}
.kt-x *,.kt-x *::before,.kt-x *::after{box-sizing:border-box}
.kt-x button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.kt-shell{max-width:520px;margin:0 auto;padding:0 0 140px}
@keyframes spIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.kt-head{display:flex;align-items:center;gap:12px;padding:6px 0 14px}
.kt-back{width:42px;height:42px;border-radius:50%;background:var(--card);border:1px solid var(--line);font-size:20px;color:var(--ink);box-shadow:var(--shadow)}
.kt-title{flex:1;text-align:center;font-size:21px;font-weight:800;letter-spacing:-.4px}
.kt-head-gap{width:42px}
.kt-sub,.kt-muted,.kt-meta{color:var(--muted);font-size:13px;font-weight:500}
.kt-sub{text-align:center;margin:-6px 0 14px}
.kt-center{text-align:center}
.kt-err{background:var(--red-bg);color:var(--red);padding:12px 14px;border-radius:14px;font-weight:700;font-size:14px;margin-bottom:12px}
.kt-grow{flex:1;min-width:0}
.kt-name{font-weight:700;font-size:16px}
.kt-sec{font-weight:800;font-size:17px;margin:6px 0 10px}
.kt-search{display:flex;gap:10px}
.kt-input{flex:1;height:50px;padding:0 16px;border-radius:16px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:15px;font-family:inherit;outline:none;box-shadow:none;width:auto}
.kt-fab{width:50px;height:50px;border-radius:50%;border:none;background:var(--blue);color:#fff;font-size:22px;box-shadow:0 10px 20px rgba(37,99,235,.35)}
.kt-chips{display:flex;gap:8px;margin:14px 0}
.kt-chip{padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-weight:700;font-size:13px;color:var(--ink)}
.kt-chip.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.kt-list{background:var(--card);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.kt-row{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:none;border:none;border-bottom:1px solid var(--line);text-align:left;color:var(--ink)}
.kt-row:last-child{border-bottom:none}
.kt-ava{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex-shrink:0}
.kt-get{color:var(--green);font-weight:700;font-size:14px}
.kt-owe{color:var(--red);font-weight:700;font-size:14px}
.kt-set{color:var(--muted);font-weight:600;font-size:14px}
.kt-chev{color:var(--muted);font-size:24px}
.kt-hero{text-align:center;margin-bottom:6px}
.kt-hname{font-size:22px;font-weight:800;margin-top:8px;letter-spacing:-.4px}
.kt-hero-row{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.kt-pill{display:inline-block;margin-top:8px;padding:6px 16px;border-radius:999px;font-weight:800;font-size:14px}
.kt-pill.get{background:var(--green-bg);color:var(--green)}
.kt-pill.owe{background:var(--red-bg);color:var(--red)}
.kt-pill.set{background:var(--chip);color:var(--muted)}
.kt-tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--chip);border-radius:14px;padding:4px;margin:16px 0}
.kt-tab{padding:11px 6px;border:none;border-radius:11px;background:transparent;font-weight:700;font-size:14px;color:var(--muted)}
.kt-tab.on{background:var(--card);color:var(--blue);box-shadow:0 4px 12px rgba(37,99,235,.15)}
.kt-h{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)}
.kt-h:last-child{border-bottom:none}
.kt-h.done{opacity:.55}
.kt-ico{width:42px;height:42px;border-radius:50%;background:var(--chip);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}
.kt-plus{color:var(--green);font-weight:800}
.kt-minus{color:var(--red);font-weight:800}
.kt-card{background:var(--card);border-radius:22px;padding:18px;box-shadow:var(--shadow);margin-bottom:14px}
.kt-label{font-size:13px;font-weight:700;color:var(--muted);margin:16px 0 8px}
.kt-field{display:flex;align-items:center;gap:10px;background:var(--field);border:1px solid var(--line);border-radius:16px;padding:0 14px;height:54px}
.kt-field input{flex:1;min-width:0;height:100%;border:none;background:transparent;box-shadow:none;border-radius:0;padding:0;font-size:17px;font-weight:700;color:var(--ink);outline:none;font-family:inherit;width:auto}
.kt-max{border:none;background:var(--chip);color:var(--blue);font-weight:800;border-radius:10px;padding:7px 14px;font-size:13px}
.kt-qchips{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.kt-q{padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-weight:700;font-size:13px;color:var(--ink)}
.kt-q.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.kt-opt{display:flex;align-items:center;gap:14px;width:100%;padding:16px;background:var(--card);border:1.5px solid var(--line);border-radius:16px;margin-bottom:10px;text-align:left;color:var(--ink);font-weight:700;font-size:15px}
.kt-opt small{color:var(--muted);font-weight:500;font-size:13px}
.kt-opt.on{border-color:var(--blue);background:var(--chip)}
.kt-opt-ico{font-size:22px}
.kt-check{margin-left:auto;width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.kt-radio{margin-left:auto;width:24px;height:24px;border-radius:50%;border:2px solid var(--muted);flex-shrink:0}
.kt-togrow{display:flex;align-items:center;gap:12px;font-weight:700}
.kt-wa-ico{width:42px;height:42px;border-radius:12px;background:var(--green-bg);display:flex;align-items:center;justify-content:center;font-size:20px}
.kt-switch{width:52px;height:30px;border-radius:999px;background:#cbd5e1;border:none;position:relative;flex-shrink:0;transition:background .2s}
.kt-switch::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.kt-switch.on{background:var(--blue)}
.kt-switch.on::after{transform:translateX(22px)}
.kt-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kt-seg button{padding:13px;border-radius:14px;border:1.5px solid var(--line);background:var(--card);font-weight:700;color:var(--ink);font-size:14px}
.kt-seg button.on{border-color:var(--blue);background:var(--chip);color:var(--blue)}
.kt-sum{display:flex;justify-content:space-between;gap:12px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;border-radius:22px;padding:20px;box-shadow:0 16px 32px rgba(37,99,235,.35)}
.kt-sum span{display:block;font-size:13px;opacity:.9;font-weight:600}
.kt-sum b{display:block;font-size:30px;font-weight:800;letter-spacing:-1px;margin-top:4px}
.kt-kv{display:flex;justify-content:space-between;gap:12px;padding:10px 0;font-size:14px;font-weight:600}
.kt-kv span:first-child{color:var(--muted)}
.kt-kv b{font-weight:800;text-align:right}
.kt-planeic{width:84px;height:84px;border-radius:50%;background:var(--chip);display:flex;align-items:center;justify-content:center;font-size:38px;margin:6px auto 12px}
.kt-big{text-align:center;font-size:21px;font-weight:800;letter-spacing:-.4px;margin:6px 0 14px}
.kt-ok{width:92px;height:92px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:48px;display:flex;align-items:center;justify-content:center;margin:10px auto 14px;box-shadow:0 0 0 12px rgba(34,197,94,.16)}
.kt-notice{display:flex;align-items:center;gap:12px;background:var(--green-bg);color:var(--green);font-weight:700;font-size:14px;box-shadow:none}
.kt-qr{display:flex;justify-content:center;margin:12px 0}
.kt-qr>div{background:#fff;padding:12px;border-radius:18px;box-shadow:var(--shadow);line-height:0}
.kt-actions{position:fixed;left:0;right:0;bottom:calc(86px + env(safe-area-inset-bottom));z-index:50;padding:0 16px}
.kt-actions-in{max-width:520px;margin:0 auto;display:flex;gap:12px}
.kt-btn{flex:1;height:54px;border-radius:16px;border:none;font-weight:800;font-size:16px}
.kt-btn.primary{background:linear-gradient(90deg,#1d4ed8,#3b82f6);color:#fff;box-shadow:0 12px 24px rgba(37,99,235,.35)}
.kt-btn.outline{background:var(--card);color:var(--blue);border:1.5px solid var(--blue2)}
.kt-btn.wa{background:var(--green-bg);color:var(--green)}
.kt-btn:disabled{opacity:.55}
.kt-stack{display:flex;flex-direction:column;gap:10px}
.kt-nav{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;max-width:520px;margin:0 auto;background:var(--card);border-radius:24px 24px 0 0;box-shadow:0 -8px 30px rgba(37,99,235,.12);padding:10px 6px calc(10px + env(safe-area-inset-bottom));z-index:3}
.kt-nav-item{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:700;color:var(--muted);padding:4px 0}
.kt-nav-item.on{color:var(--blue)}
.kt-nav-ico{font-size:20px;line-height:1;padding:4px 12px;border-radius:12px}
.kt-nav-item.on .kt-nav-ico{background:var(--chip)}
.kt-sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80}
.kt-sheet{position:fixed;left:0;right:0;bottom:0;z-index:90;max-width:520px;margin:0 auto;background:var(--card);border-radius:26px 26px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom))}
.kt-total{font-size:34px;font-weight:800;letter-spacing:-1px}
.kt-trend{font-size:13px;font-weight:700;color:var(--green)}
.kt-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.kt-tile{border-radius:18px;padding:16px}
.kt-tile.g{background:var(--green-bg);color:var(--green)}
.kt-tile.r{background:var(--red-bg);color:var(--red)}
.kt-tile span{display:block;font-size:13px;font-weight:700}
.kt-tile b{display:block;font-size:22px;font-weight:800;margin-top:4px}
.kt-select{height:42px;padding:0 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:700;font-size:14px;font-family:inherit;width:auto;box-shadow:none}
.kt-legend{list-style:none;margin:10px 0 0;padding:0}
.kt-legend li{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:14px;font-weight:600}
.kt-legend i{width:10px;height:10px;border-radius:50%}
.kt-legend b{margin-left:auto}
.kt-donut{position:relative;width:200px;height:200px;margin:6px auto}
.kt-donut-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.kt-donut-mid b{font-size:20px;font-weight:800}
.kt-donut-mid span{font-size:12px;color:var(--muted);font-weight:600}
:where(.kt-x) button{box-shadow:none;margin:0;min-height:0;width:auto;text-transform:none;letter-spacing:normal}
.kt-linkbtn{display:block;width:100%;margin:0 0 12px;padding:13px;border-radius:14px;border:1px dashed var(--blue2);background:var(--chip);color:var(--blue);font-weight:700;font-size:14px}
`;
/* wrapper that gives the screens their own colours and styles */
export function Wrap({ dark, children }) {
  return (
    <div className={"kt-x" + (dark ? " kt-dark" : "")}>
      <style>{CSS}</style>
      {children}
    </div>
  );
}

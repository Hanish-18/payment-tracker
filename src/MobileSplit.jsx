/* Phone "Split & Expense" screen (matches the mockup).
   The real split form (SplitHub) opens inside it when you tap an action. */
import { useState } from "react";
import "./mobile-split.css";
import { hue, ini } from "./DesktopHome";

const money = (n) => "₹" + Math.abs(Number(n)).toLocaleString("en-IN");

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" /></>),
  wallet: (<><path d="M4 7a2 2 0 0 1 2-2h11v3" /><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M16 13.5h5" /></>),
  bill: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14c3 0 5 1.6 5 4.5" /></>),
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  groups: (<><circle cx="12" cy="7.5" r="2.8" /><circle cx="5.5" cy="10" r="2.2" /><circle cx="18.5" cy="10" r="2.2" /><path d="M7 19c0-3 2.2-5 5-5s5 2 5 5M2 18c0-2 1.5-3.5 3.5-3.5M22 18c0-2-1.5-3.5-3.5-3.5" /></>),
  settle: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chev: <path d="M9 5l7 7-7 7" />,
  up: <path d="M12 19V6M6 12l6-6 6 6" />,
  down: <path d="M12 5v13M6 12l6 6 6-6" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  scan: (<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></>),
};
function Ic({ n, s = 24 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

function Wallet() {
  return (
    <svg className="mp-wallet" viewBox="0 0 190 160" aria-hidden="true">
      <defs>
        <linearGradient id="mpw1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a8bff" />
          <stop offset="1" stopColor="#1240c8" />
        </linearGradient>
        <linearGradient id="mpw2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#f0a416" />
        </linearGradient>
      </defs>
      <rect x="34" y="34" width="124" height="96" rx="22" fill="url(#mpw1)" />
      <rect x="34" y="34" width="124" height="96" rx="22" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <rect x="46" y="44" width="92" height="40" rx="16" fill="rgba(255,255,255,0.12)" />
      <rect x="132" y="68" width="42" height="34" rx="15" fill="#2a5fe0" />
      <circle cx="150" cy="85" r="6.5" fill="#d6e5ff" />
      <ellipse cx="146" cy="22" rx="16" ry="6" fill="#ffc94d" transform="rotate(-18 146 22)" />
      <ellipse cx="30" cy="104" rx="14" ry="5" fill="#ffc94d" transform="rotate(-18 30 104)" />
      <ellipse cx="160" cy="142" rx="18" ry="6.5" fill="url(#mpw2)" />
      <ellipse cx="160" cy="138" rx="18" ry="6.5" fill="#ffc94d" />
    </svg>
  );
}

const ago = (x) => {
  const t = new Date(x).getTime();
  if (!t) return "";
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function MobileSplit({ entries, friends, go, splitHub }) {
  const [view, setView] = useState(null); // null = hub, otherwise the title of the form

  const open = entries.filter((e) => e.status !== "Settled");
  const youGet = open.filter((e) => e.paid_by === "me").reduce((s, e) => s + Number(e.amount), 0);
  const youOwe = open.filter((e) => e.paid_by === "friend").reduce((s, e) => s + Number(e.amount), 0);
  const net = youGet - youOwe;

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const inMonth = (e, d) => {
    const x = new Date(e.payment_date || e.created_at);
    return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear();
  };
  const thisMonth = entries.filter((e) => inMonth(e, now)).reduce((s, e) => s + Number(e.amount), 0);
  const lastMonth = entries.filter((e) => inMonth(e, prev)).reduce((s, e) => s + Number(e.amount), 0);
  const pct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const recent = entries.slice(0, 3);
  const faces = friends.slice(0, 3);

  if (view) {
    return (
      <div className="ms mp">
        <div className="ms-bar">
          <button type="button" className="ms-ib" onClick={() => setView(null)} aria-label="Back"><Ic n="back" s={22} /></button>
          <h2>{view}</h2>
          <span className="ms-ib ghost" />
        </div>
        {splitHub}
      </div>
    );
  }

  const actions = [
    ["bill", "Split Bill", () => setView("Split Bill")],
    ["receipt", "Add Expense", () => setView("Add Expense")],
    ["groups", "New Group", () => setView("New Group")],
    ["settle", "Settle Up", () => go("Settlements")],
  ];

  return (
    <div className="ms mp">
      <div className="ms-bar">
        <button type="button" className="ms-ib" onClick={() => go("Dashboard")} aria-label="Back"><Ic n="back" s={22} /></button>
        <h2>Split &amp; Expense</h2>
        <button type="button" className="ms-ib" onClick={() => go("Profile")} aria-label="Settings"><Ic n="gear" s={22} /></button>
      </div>

      {/* Total Balance */}
      <button type="button" className="mp-bal" onClick={() => go("Settlements")}>
        <span className="mp-bal-lbl"><Ic n="wallet" s={22} /> Total Balance</span>
        <span className="mp-bal-amt">{net < 0 ? "-" : ""}{money(net)}</span>
        <span className="mp-bal-sub">
          <i><Ic n="up" s={16} /></i>
          You get {money(youGet)} · You owe {money(youOwe)}
        </span>
        <Wallet />
      </button>

      {/* Quick actions */}
      <div className="mp-qa">
        {actions.map(([ic, label, fn]) => (
          <button key={label} type="button" onClick={fn}>
            <Ic n={ic} s={32} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Split with Friends banner */}
      <div className="mp-banner">
        <div className="mp-banner-txt">
          <h3>Split with Friends</h3>
          <p>Easily divide expenses with your group.</p>
          <button type="button" onClick={() => setView("Split Bill")}>Start Splitting <Ic n="arrow" s={18} /></button>
        </div>
        <div className="mp-faces">
          {(faces.length ? faces.map((f) => f.name) : ["You"]).map((n, i) => (
            <i key={i} style={{ background: hue(n), zIndex: 3 - i, marginLeft: i ? -18 : 0, width: i === 1 ? 74 : 64, height: i === 1 ? 74 : 64 }}>{ini(n)}</i>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mp-head">
        <h2>Recent Activity</h2>
        <button type="button" onClick={() => go("Payments")}>See all →</button>
      </div>
      {recent.length === 0 ? (
        <p className="mp-empty">No expenses yet. Tap Start Splitting to add one.</p>
      ) : (
        <div className="mp-act">
          {recent.map((e) => (
            <button type="button" className="mp-row" key={e.id} onClick={() => go("Payments")}>
              <span className="mp-row-ic"><Ic n="receipt" s={24} /></span>
              <span className="mp-row-mid">
                <b>{e.note || e.mode || "Payment"}</b>
                <small>{e.paid_by === "me" ? "You paid" : `${e.friend} paid`} {money(e.amount)} • with {e.friend}</small>
              </span>
              <span className="mp-chip">{ago(e.created_at || e.payment_date)}</span>
              <Ic n="chev" s={18} />
            </button>
          ))}
        </div>
      )}

      {/* This month */}
      <div className="mp-month">
        <span className="mp-month-ic"><Ic n="chart" s={26} /></span>
        <span className="mp-month-mid">
          <small>This Month's Expenses</small>
          <b>{money(thisMonth)}</b>
        </span>
        {pct !== null && (
          <span className={"mp-pct " + (pct <= 0 ? "dn" : "up")}>
            <Ic n={pct <= 0 ? "down" : "up"} s={14} /> {Math.abs(pct)}%
          </span>
        )}
        <span className="mp-bars" aria-hidden="true"><i /><i /><i /><i /></span>
      </div>

      {/* Scan & Split */}
      <button type="button" className="mp-scan" onClick={() => setView("Split Bill")}>
        <Ic n="scan" s={28} />
        <span>Scan &amp; Split</span>
      </button>
    </div>
  );
}

/* Phone home screen (matches the mockup): hero, Total Balance, Add Expense, quick actions, friends, recent activity */
import "./mobile-home-v2.css";
import { Cover, kindFor } from "./DesktopHome";

const money = (n) => "₹" + Math.abs(Number(n)).toLocaleString("en-IN");

const ICONS = {
  split: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  settle: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bill: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14c3 0 5 1.6 5 4.5" /></>),
  groups: (<><circle cx="12" cy="7.5" r="2.8" /><circle cx="5.5" cy="10" r="2.2" /><circle cx="18.5" cy="10" r="2.2" /><path d="M7 19c0-3 2.2-5 5-5s5 2 5 5M2 18c0-2 1.5-3.5 3.5-3.5M22 18c0-2-1.5-3.5-3.5-3.5" /></>),
  details: <path d="M5 20V11M12 20V4M19 20v-6" />,
};

function Ic({ name, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Wallet() {
  return (
    <svg className="mh-wallet" viewBox="0 0 190 160" aria-hidden="true">
      <defs>
        <linearGradient id="mhw1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82ff" />
          <stop offset="1" stopColor="#1240c8" />
        </linearGradient>
        <linearGradient id="mhw2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#f0a416" />
        </linearGradient>
      </defs>
      <rect x="40" y="14" width="88" height="46" rx="10" fill="#2f6fed" transform="rotate(-8 84 37)" />
      <rect x="52" y="12" width="84" height="44" rx="8" fill="#eaf1ff" transform="rotate(-8 94 34)" />
      <rect x="62" y="22" width="30" height="6" rx="3" fill="#9dbaf5" transform="rotate(-8 77 25)" />
      <rect x="30" y="40" width="140" height="100" rx="20" fill="url(#mhw1)" />
      <rect x="30" y="40" width="140" height="100" rx="20" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
      <circle cx="92" cy="90" r="24" fill="rgba(255,255,255,0.14)" />
      <text x="92" y="100" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">₹</text>
      <rect x="140" y="74" width="40" height="34" rx="14" fill="#2a5fe0" />
      <circle cx="156" cy="91" r="6" fill="#cfe0ff" />
      <ellipse cx="38" cy="140" rx="26" ry="9" fill="url(#mhw2)" />
      <ellipse cx="38" cy="134" rx="26" ry="9" fill="#ffc94d" />
      <ellipse cx="72" cy="150" rx="24" ry="8" fill="url(#mhw2)" />
      <ellipse cx="72" cy="145" rx="24" ry="8" fill="#ffc94d" />
    </svg>
  );
}

export default function MobileHome({ entries, go, friends = [] }) {
  const open = entries.filter((e) => e.status !== "Settled");
  const youGet = open.filter((e) => e.paid_by === "me").reduce((s, e) => s + Number(e.amount), 0);
  const youOwe = open.filter((e) => e.paid_by === "friend").reduce((s, e) => s + Number(e.amount), 0);
  const net = youGet - youOwe;
  const recent = entries.slice(0, 6);

  const actions = [
    ["bill", "Split Bill", "Expenses"],
    ["groups", "Friends", "Friends"],
    ["settle", "Settle Up", "Settlements"],
    ["details", "Analytics", "Analytics"],
  ];

  return (
    <div className="mh">
      {/* Hero */}
      <div className="mh-hero">
        <div className="mh-hero-txt">
          <h1>Split. Track.<br />Settle. Together.</h1>
          <p>Manage group expenses and daily spends with your friends.</p>
        </div>
        <Wallet />
      </div>

      {/* Total Balance card */}
      <button type="button" className="mh-bal" onClick={() => go("Settlements")}>
        <svg className="mh-wave" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 80V58c25-6 40-26 65-24s38 18 60 8 40-30 75-34v72z" />
        </svg>
        <span className="mh-bal-lbl">Total Balance</span>
        <span className="mh-bal-amt">{net < 0 ? "-" : ""}{money(net)}</span>
        <span className="mh-bal-sub">
          You get {money(youGet)} · You owe {money(youOwe)}
        </span>
        <span className="mh-bal-go"><Ic name="arrow" size={20} /></span>
      </button>

      {/* Add Expense */}
      <button type="button" className="mh-add" onClick={() => go("Expenses")}>
        <Ic name="plus" size={24} />
        <span>Add Expense</span>
      </button>

      {/* Quick actions */}
      <div className="mh-qa mh-qa2">
        {actions.map(([ic, label, page]) => (
          <button key={label} type="button" onClick={() => go(page)}>
            <span className="mh-qa-ic"><Ic name={ic} size={26} /></span>
            <span className="mh-qa-lbl">{label}</span>
          </button>
        ))}
      </div>

      {/* Your Friends */}
      <div className="mh-head">
        <h2>Your Friends</h2>
        <button type="button" onClick={() => go("Friends")}>See All →</button>
      </div>
      <div className="mh-groups">
        {friends.slice(0, 6).map((f, i) => {
          const count = entries.filter((e) => e.friend === f.name).length;
          return (
            <button type="button" className="mh-gc" key={f.id} onClick={() => go("Friends")}>
              <span className="mh-gc-cover"><Cover kind={kindFor(f.name, i)} uid={"h" + f.id} /></span>
              <b>{f.name}</b>
              <small>{count} expense{count === 1 ? "" : "s"}</small>
            </button>
          );
        })}
        <button type="button" className="mh-gc mh-gc-new" onClick={() => go("Groups")}>
          <span className="mh-gc-plus"><Ic name="plus" size={26} /></span>
          <b>Add<br />Friend</b>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="mh-head">
        <h2>Recent Activity</h2>
        <button type="button" onClick={() => go("Payments")}>See All →</button>
      </div>

      {recent.length === 0 && (
        <p className="mh-empty">No expenses yet. Tap Add Expense to add your first one.</p>
      )}

      {recent.length > 0 && (
        <div className="mh-act">
          {recent.map((e) => {
            const mine = e.paid_by === "me";
            const settled = e.status === "Settled";
            return (
              <div className="mh-row" key={e.id}>
                <span className="mh-row-ic"><Ic name="split" size={22} /></span>
                <div className="mh-row-mid">
                  <b>{e.note || e.mode || "Payment"}</b>
                  <small>
                    {mine ? "You paid" : `Paid by ${e.friend}`} · {new Date(e.payment_date || e.created_at).toLocaleDateString("en-IN")}
                  </small>
                </div>
                <div className="mh-row-end">
                  <b className={settled ? "mut" : mine ? "pos" : "neg"}>
                    {mine ? "+" : "-"}{money(e.amount)}
                  </b>
                  <small>{settled ? "Settled" : e.friend}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

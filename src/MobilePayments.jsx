/* Phone "Payments" flow (matches the mockup):
   Payments home  ->  Add Payment form  ->  Payment Details
   The old PaymentsHub (full history, reminders) opens from "See All" and "Request". */
import { useState } from "react";
import "./mobile-payments.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";

export const money = (n) => "₹" + Math.abs(Number(n)).toLocaleString("en-IN");
export const dtext = (x) => new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  up: <path d="M12 19V6M6 12l6-6 6 6" />,
  down: <path d="M12 5v13M6 12l6 6 6-6" />,
  send: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3M20 14v.01M14 20h3M20 17v3" /></>),
  card: (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></>),
  food: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11" />,
  travel: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  stay: (<><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>),
  transport: (<><path d="M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2A2 2 0 0 1 17.5 11L19 16M4 16h16v3H4zM7.5 19v1.5M16.5 19v1.5" /></>),
  other: (<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>),
  pen: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  cal: (<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  note: (<><path d="M6 4h12v16H6z" /><path d="M9 9h6M9 13h4" /></>),
  share: (<><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  vdots: (<><circle cx="12" cy="5" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="19" r="1.5" fill="currentColor" /></>),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  cdown: <path d="M6 9l6 6 6-6" />,
};
export function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

function Wallet() {
  return (
    <svg className="pm-wallet" viewBox="0 0 190 160" aria-hidden="true">
      <defs>
        <linearGradient id="pmw1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a8bff" />
          <stop offset="1" stopColor="#1240c8" />
        </linearGradient>
      </defs>
      <rect x="52" y="14" width="86" height="44" rx="8" fill="#ffc94d" transform="rotate(-10 94 36)" />
      <rect x="46" y="20" width="86" height="44" rx="8" fill="#3fc7a8" transform="rotate(-6 90 42)" />
      <rect x="44" y="28" width="86" height="44" rx="8" fill="#eaf1ff" transform="rotate(-3 90 50)" />
      <rect x="28" y="46" width="130" height="96" rx="20" fill="url(#pmw1)" />
      <rect x="28" y="46" width="130" height="96" rx="20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <rect x="128" y="76" width="44" height="34" rx="15" fill="#2a5fe0" />
      <circle cx="146" cy="93" r="6.5" fill="#d6e5ff" />
    </svg>
  );
}

/* ---- category helpers (category is kept inside the note, so no database change is needed) ---- */
const CATS = ["Food", "Travel", "Stay", "Transport", "Other"];
const KEYS = [
  ["Food", /dinner|lunch|breakfast|cafe|chai|tea|coffee|food|pizza|restaurant|meal|snack|biryani|burger/i],
  ["Travel", /trip|travel|flight|train|bus|manali|goa|tour/i],
  ["Stay", /hotel|stay|room|rent|hostel|airbnb/i],
  ["Transport", /cab|uber|ola|fuel|petrol|diesel|auto|metro|taxi|transport/i],
];
export function parseNote(note, mode) {
  const raw = String(note || "").trim();
  let cat = null;
  let title = raw;
  for (const c of CATS) {
    if (raw.startsWith(c + " · ")) { cat = c; title = raw.slice(c.length + 3); break; }
  }
  if (!cat) {
    for (const [c, re] of KEYS) if (re.test(raw)) { cat = c; break; }
  }
  title = title.replace(/^split:\s*/i, "").replace(/\s*\(\d+ people[^)]*\)/, "").replace(/\s+—\s+.*$/, "").trim();
  return { cat: cat || "Other", title: title || mode || "Payment" };
}
export const catIcon = (c) => ({ Food: "food", Travel: "travel", Stay: "stay", Transport: "transport" }[c] || "card");

export const ago = (x) => {
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

/* Works out the people and the total of a split, from the saved entries */
export function splitInfo(e, entries) {
  const note = String(e.note || "");
  const isSplit = /split:/i.test(note);
  const sibs = isSplit
    ? entries.filter((x) => x.note === e.note && x.payment_date === e.payment_date && x.paid_by === e.paid_by)
    : [e];
  const m = note.match(/\((\d+) people(?:, (custom|percentage))?(?:, total ([\d.]+))?\)/);
  const count = m ? Number(m[1]) : sibs.length + 1;
  const kind = m && m[2] ? m[2] : "equal";
  const sum = sibs.reduce((t, x) => t + Number(x.amount), 0);
  let total;
  if (m && m[3]) total = Number(m[3]);
  else if (!isSplit) total = Number(e.amount);
  else if (e.paid_by === "me") total = sum + Number(e.amount);
  else total = Number(e.amount) * count;
  return { sibs, total, isSplit, count, kind };
}

const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* ============================ Add Payment ============================ */
function AddPayment({ friends, myName, myId, onBack, onDone, setError, go }) {
  const [tab, setTab] = useState("exp");
  const [payer, setPayer] = useState("me");
  const [cat, setCat] = useState("Food");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [sel, setSel] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const toggle = (id) => setSel((s) => (s.map(String).includes(String(id)) ? s.filter((x) => String(x) !== String(id)) : [...s, id]));
  const payerFriend = payer === "me" ? null : friends.find((f) => String(f.id) === String(payer));
  const others = [
    ...friends.filter((f) => sel.map(String).includes(String(f.id)) && (!payerFriend || f.id !== payerFriend.id)),
    ...(payerFriend ? [payerFriend] : []),
  ];
  const count = others.length + 1;

  async function save(rows) {
    let last = null;
    for (const mode of ["UPI", "Cash", "Other"]) {
      const { error } = await supabase.from("entries").insert(rows.map((r) => ({ ...r, mode })));
      if (!error) return null;
      last = error;
      if (!/mode|check/i.test(error.message)) return error;
    }
    return last;
  }

  async function submit() {
    setMsg("");
    const amt = Number(amount);
    if (!title.trim()) { setMsg("Please enter a title."); return; }
    if (!(amt > 0)) { setMsg("Please enter an amount."); return; }
    if (others.length === 0) { setMsg("Pick at least one friend to split with."); return; }
    const share = Math.round((amt / count) * 100) / 100;
    const note =
      (cat !== "Other" ? cat + " · " : "") +
      `Split: ${title.trim()} (${count} people)` +
      (extra.trim() ? ` — ${extra.trim()}` : "");
    const base = { user_id: myId, note, payment_date: date, status: "Pending" };
    const rows = payerFriend
      ? [{ ...base, friend: payerFriend.name, paid_by: "friend", amount: share }]
      : others.map((f) => ({ ...base, friend: f.name, paid_by: "me", amount: share }));
    setBusy(true);
    const error = await save(rows);
    setBusy(false);
    if (error) { setError(error.message); setMsg(error.message); return; }
    setError("");
    onDone();
  }

  return (
    <div className="ms pm">
      <div className="ms-bar">
        <button type="button" className="ms-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2>Add Payment</h2>
        <span className="ms-ib ghost" />
      </div>

      <div className="pm-seg">
        <button type="button" className={tab === "exp" ? "on" : ""} onClick={() => setTab("exp")}><Ic n="card" s={20} /> Expense</button>
        <button type="button" className={tab === "inc" ? "on" : ""} onClick={() => setTab("inc")}><Ic n="down" s={20} /> Income</button>
      </div>

      {tab === "inc" ? (
        <div className="pm-info">
          <b>Money received from a friend?</b>
          <p>Record it with Settle Up so both balances stay correct.</p>
          <button type="button" className="pm-cta" onClick={() => go("Settlements")}>Open Settle Up</button>
        </div>
      ) : (
        <>
          <label className="pm-lbl">Paid by</label>
          <div className="pm-field">
            <span className="pm-av" style={{ background: payerFriend ? hue(payerFriend.name) : "#12327f" }}>{ini(payerFriend ? payerFriend.name : myName)}</span>
            <select value={payer} onChange={(e) => setPayer(e.target.value)}>
              <option value="me">You ({myName})</option>
              {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <label className="pm-lbl">For</label>
          <div className="pm-cats">
            {CATS.map((c) => (
              <button key={c} type="button" className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
                <Ic n={c === "Other" ? "other" : catIcon(c)} s={24} />
                <span>{c}</span>
              </button>
            ))}
          </div>

          <label className="pm-lbl">Title / Description</label>
          <div className="pm-field">
            <Ic n="pen" s={20} />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Domino's" />
          </div>

          <label className="pm-lbl">Amount</label>
          <div className="pm-field">
            <b className="pm-rs">₹</b>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="450" inputMode="decimal" />
          </div>

          <label className="pm-lbl">Split with</label>
          {friends.length === 0 ? (
            <div className="pm-field"><span className="pm-mut">No friends yet.</span><button type="button" className="pm-link" onClick={() => go("Groups")}>Add friends →</button></div>
          ) : (
            <div className="pm-split">
              <div className="pm-chips">
                {friends.map((f) => {
                  const on = sel.map(String).includes(String(f.id)) || (payerFriend && payerFriend.id === f.id);
                  return (
                    <button key={f.id} type="button" className={on ? "on" : ""} onClick={() => toggle(f.id)}>
                      <i style={{ background: hue(f.name) }}>{ini(f.name)}</i>{f.name}
                    </button>
                  );
                })}
              </div>
              <span className="pm-count">{count} {count === 1 ? "person" : "people"}</span>
            </div>
          )}

          <label className="pm-lbl">Date</label>
          <div className="pm-field">
            <Ic n="cal" s={20} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <label className="pm-lbl">Note (optional)</label>
          <div className="pm-field">
            <Ic n="note" s={20} />
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add a note..." />
          </div>

          {msg && <p className="pm-err">{msg}</p>}
          <button type="button" className="pm-cta pm-sticky" onClick={submit} disabled={busy}>{busy ? "Saving..." : "Add Payment"}</button>
        </>
      )}
    </div>
  );
}

/* ============================ Payment Details ============================ */
export function Detail({ e, entries, onBack, go }) {
  const [copied, setCopied] = useState(false);
  const { cat, title } = parseNote(e.note, e.mode);
  const youPaid = e.paid_by === "me";
  const { sibs, total } = splitInfo(e, entries);

  const rows = youPaid
    ? [{ n: "You (Paid)", a: total, paid: true, hueName: "You" }, ...sibs.map((x) => ({ n: x.friend, a: x.amount, hueName: x.friend, done: x.status === "Settled" }))]
    : [{ n: `${e.friend} (Paid)`, a: total, paid: true, hueName: e.friend }, { n: "You", a: e.amount, hueName: "You", done: e.status === "Settled" }];

  const pending = rows.filter((r) => !r.paid && !r.done).length;
  const allDone = pending === 0;

  async function share() {
    const text = `${title} - ${money(total)} on ${dtext(e.payment_date || e.created_at)}\n` +
      rows.map((r) => `${r.n.replace(" (Paid)", "")}: ${money(r.a)}${r.paid ? " (paid)" : ""}`).join("\n");
    try {
      if (navigator.share) { await navigator.share({ title, text }); return; }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { /* cancelled */ }
  }

  return (
    <div className="ms pm">
      <div className="ms-bar">
        <button type="button" className="ms-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2>Payment Details</h2>
        <span className="ms-ib ghost" />
      </div>

      <div className="pm-top">
        <span className="pm-top-ic"><Ic n={catIcon(cat)} s={28} /></span>
        <span className="pm-top-mid">
          <b>{title}</b>
          <small>{cat === "Other" ? e.mode || "Payment" : cat} · {dtext(e.payment_date || e.created_at)}</small>
        </span>
        <span className="pm-top-amt">{money(total)}</span>
      </div>

      <h3 className="pm-h3">Split Details</h3>
      <div className="pm-people">
        {rows.map((r, i) => (
          <div className="pm-person" key={i}>
            <span className="pm-av big" style={{ background: r.hueName === "You" ? "#12327f" : hue(r.hueName) }}>{ini(r.hueName === "You" ? "You" : r.hueName)}</span>
            <b>{r.n}</b>
            <span className={"pm-amt" + (r.paid ? " paid" : "")}>{money(r.a)}</span>
          </div>
        ))}
      </div>

      <div className={"pm-status " + (allDone ? "ok" : "wait")}>
        <span className="pm-status-ic"><Ic n={allDone ? "check" : "clock"} s={24} /></span>
        <span>
          <b>{allDone ? "All Settled" : "Pending"}</b>
          <small>{allDone ? "Everyone has paid their share." : `${pending} ${pending === 1 ? "person has" : "people have"} not settled yet.`}</small>
        </span>
      </div>

      {!allDone && <button type="button" className="pm-cta" onClick={() => go("Settlements")}>Settle Up</button>}
      <button type="button" className="pm-share" onClick={share}><Ic n="share" s={22} /> {copied ? "Copied!" : "Share in Group"}</button>
    </div>
  );
}

/* ============================ Payments home ============================ */
export default function MobilePayments({ entries, friends, go, reload, setError, myId, myName, header, paymentsHub }) {
  const [view, setView] = useState({ t: "hub" });
  const [flash, setFlash] = useState("");

  if (view.t === "add") {
    return (
      <AddPayment
        friends={friends}
        myName={myName}
        myId={myId}
        go={go}
        setError={setError}
        onBack={() => setView({ t: "hub" })}
        onDone={() => {
          reload();
          setView({ t: "hub" });
          setFlash("Payment added ✓");
          setTimeout(() => setFlash(""), 2500);
        }}
      />
    );
  }

  if (view.t === "detail") {
    const e = entries.find((x) => x.id === view.id);
    if (!e) { setView({ t: "hub" }); return null; }
    return <Detail e={e} entries={entries} go={go} onBack={() => setView({ t: "hub" })} />;
  }

  if (view.t === "all") {
    return (
      <div className="ms pm">
        <div className="ms-bar">
          <button type="button" className="ms-ib" onClick={() => setView({ t: "hub" })} aria-label="Back"><Ic n="back" /></button>
          <h2>All Payments</h2>
          <span className="ms-ib ghost" />
        </div>
        {paymentsHub}
      </div>
    );
  }

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

  const recent = entries.slice(0, 5);

  const actions = [
    ["plus", "Add Payment", () => setView({ t: "add" }), true],
    ["send", "Pay Now", () => go("Settlements")],
    ["down", "Request", () => setView({ t: "all" })],
    ["qr", "Scan UPI", () => go("MerchantPay")],
  ];

  return (
    <div className="ms pm">
      {header}
      {flash && <div className="pm-flash">{flash}</div>}

      <button type="button" className="pm-bal" onClick={() => go("Settlements")}>
        <span className="pm-bal-lbl">Your Balance</span>
        <span className="pm-bal-amt">{net < 0 ? "-" : ""}{money(net)}</span>
        <span className="pm-bal-chip">
          <Ic n={pct !== null && pct < 0 ? "down" : "up"} s={16} />
          {pct !== null ? `${pct >= 0 ? "+" : "-"}${Math.abs(pct)}% this month` : `${money(thisMonth)} this month`}
        </span>
        <Wallet />
      </button>

      <div className="pm-qa">
        {actions.map(([ic, label, fn, hi]) => (
          <button key={label} type="button" className={hi ? "hi" : ""} onClick={fn}>
            <Ic n={ic} s={26} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="pm-head">
        <h2>Recent Payments</h2>
        <button type="button" onClick={() => setView({ t: "all" })}>See All →</button>
      </div>

      {recent.length === 0 ? (
        <p className="pm-empty">No payments yet. Tap Add Payment to record your first one.</p>
      ) : (
        <div className="pm-list">
          {recent.map((e) => {
            const { cat, title } = parseNote(e.note, e.mode);
            return (
              <button type="button" className="pm-row" key={e.id} onClick={() => setView({ t: "detail", id: e.id })}>
                <span className="pm-row-ic"><Ic n={catIcon(cat)} s={24} /></span>
                <span className="pm-row-mid">
                  <b>{title}</b>
                  <small>{e.paid_by === "me" ? "You paid" : `${e.friend} paid`} {money(e.amount)} · with {e.friend}</small>
                </span>
                <span className="pm-ago">{ago(e.created_at || e.payment_date)}</span>
                <Ic n="chev" s={18} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

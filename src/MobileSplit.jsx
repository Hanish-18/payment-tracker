/* Phone "Split & Expense" flow (matches the mockup):
   1) Split & Expense home  ->  2) Split an Expense form  ->  3) Expense Created!
   Data is saved in the same `entries` table the Payments tab uses. */
import { useState } from "react";
import "./mobile-split.css"; // keeps the shared .ms-bar styles used by the Payments screens
import "./mobile-split-expense.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";

const money = (n) => "₹" + Math.abs(Number(n)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round(n * 100) / 100;

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.01" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  down: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  bill: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  cart: (<><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>),
  fuel: (<><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M15 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V9l-3-3" /><path d="M7.5 8h5" /></>),
  food: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11" />,
  plane: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  dots: (<><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></>),
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

/* ---------- helpers to read entries as "expenses" ---------- */
const cleanTitle = (note, mode) => {
  let t = String(note || "").trim();
  t = t.replace(/^(Food|Travel|Stay|Transport|Other) · /, "");
  t = t.replace(/^split:\s*/i, "");
  t = t.replace(/\s*\(\d+ people\).*$/i, "");
  return t || mode || "Payment";
};
const iconFor = (t) =>
  /dinner|lunch|breakfast|cafe|chai|tea|coffee|food|pizza|meal|snack|biryani|burger/i.test(t) ? "food"
  : /trip|travel|flight|train|ticket|bus|tour/i.test(t) ? "plane"
  : /fuel|petrol|diesel|cab|uber|ola|auto|taxi/i.test(t) ? "fuel"
  : "cart";
const toneFor = (ic) => ({ food: "red", plane: "violet", fuel: "green", cart: "blue" }[ic]);

const dayKey = (e) => String(e.payment_date || e.created_at || "").slice(0, 10);
const todayKey = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dayLabel = (k) => {
  const t = todayKey();
  const y = new Date(new Date(t + "T00:00:00").getTime() - 86400000);
  const yk = new Date(y.getTime() - y.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (k === t) return "Today";
  if (k === yk) return "Yesterday";
  return new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function groupExpenses(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = [e.note, dayKey(e), e.paid_by, e.created_at || ""].join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.values()].map((rows) => {
    const f = rows[0];
    const isSplit = /split:/i.test(String(f.note || ""));
    const m = String(f.note || "").match(/\((\d+) people\)/i);
    const n = m ? Number(m[1]) : rows.length + 1;
    const sum = rows.reduce((s, x) => s + Number(x.amount), 0);
    let total = sum;
    if (isSplit) total = f.paid_by === "me" ? (sum * n) / Math.max(1, n - 1) : Number(f.amount) * n;
    const title = cleanTitle(f.note, f.mode);
    return {
      id: f.id,
      title,
      icon: iconFor(title),
      total: Math.round(total),
      paidByMe: f.paid_by === "me",
      payer: f.paid_by === "me" ? "You" : f.friend,
      people: [...new Set(rows.map((x) => x.friend))],
      settled: rows.every((x) => x.status === "Settled"),
      day: dayKey(f),
      isSplit,
    };
  });
}

/* ============================ Step 2: Split an Expense ============================ */
function SplitForm({ friends, myName, myId, onBack, onCreated, setError, go }) {
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState("me");
  const [sel, setSel] = useState([]);
  const [type, setType] = useState("equal");
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const payerFriend = payer === "me" ? null : friends.find((f) => String(f.id) === String(payer));
  const isOn = (f) => sel.includes(String(f.id)) || (payerFriend && payerFriend.id === f.id);
  const toggle = (f) => {
    if (payerFriend && payerFriend.id === f.id) return;
    const k = String(f.id);
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  const people = [
    { key: "me", name: myName },
    ...friends.filter(isOn).map((f) => ({ key: String(f.id), name: f.name })),
  ];
  const count = people.length;
  const amt = Number(amount) || 0;
  const shareOf = (p) =>
    type === "equal" ? r2(amt / count)
    : type === "custom" ? Number(vals[p.key]) || 0
    : r2((amt * (Number(vals[p.key]) || 0)) / 100);

  const changeType = (t) => { setType(t); setVals({}); setMsg(""); };

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
    if (!(amt > 0)) { setMsg("Enter the amount."); return; }
    if (!title.trim()) { setMsg("Enter what the expense was for."); return; }
    if (count < 2) { setMsg("Pick at least one person to split with."); return; }
    if (type === "custom") {
      const sum = r2(people.reduce((s, p) => s + shareOf(p), 0));
      if (Math.abs(sum - amt) > 0.01) { setMsg(`Amounts add up to ${money(sum)}. They should add up to ${money(amt)}.`); return; }
    }
    if (type === "pct") {
      const sum = people.reduce((s, p) => s + (Number(vals[p.key]) || 0), 0);
      if (Math.abs(sum - 100) > 0.01) { setMsg(`Percentages add up to ${r2(sum)}%. They should add up to 100%.`); return; }
    }
    const me = people[0];
    const note = `Split: ${title.trim()} (${count} people)`;
    const base = { user_id: myId, note, payment_date: todayKey(), status: "Pending" };
    let rows;
    if (payerFriend) {
      const mine = shareOf(me);
      if (!(mine > 0)) { setMsg("Your share is ₹0, so there is nothing to record."); return; }
      rows = [{ ...base, friend: payerFriend.name, paid_by: "friend", amount: mine }];
    } else {
      rows = people.slice(1).map((p) => ({ ...base, friend: p.name, paid_by: "me", amount: shareOf(p) })).filter((r) => r.amount > 0);
    }
    setBusy(true);
    const error = await save(rows);
    setBusy(false);
    if (error) { setError(error.message); setMsg(error.message); return; }
    setError("");
    onCreated({ title: title.trim(), amt, count, type, each: r2(amt / count), payer: payerFriend ? payerFriend.name : "You" });
  }

  return (
    <div className="se se-pad">
      <div className="se-bar">
        <button type="button" className="se-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2>Split an Expense</h2>
        <span className="se-ib" aria-hidden="true"><Ic n="info" /></span>
      </div>

      <div className="se-amt">
        <span className="se-amt-ic"><Ic n="receipt" s={34} /></span>
        <span className="se-amt-mid">
          <label className="se-rs"><b>₹</b>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1,200" inputMode="decimal" aria-label="Amount" />
          </label>
          <input className="se-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Cafe" aria-label="What was it for" />
        </span>
      </div>

      <h3 className="se-h3">Paid by</h3>
      <label className="se-payer">
        <i style={{ background: payerFriend ? hue(payerFriend.name) : "#12327f" }}>{ini(payerFriend ? payerFriend.name : myName)}</i>
        <span>{payerFriend ? payerFriend.name : "You"}</span>
        <Ic n="down" s={18} />
        <select value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Paid by">
          <option value="me">You ({myName})</option>
          {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>

      <div className="se-row">
        <h3 className="se-h3">Split with</h3>
        <span className="se-cnt">{count} {count === 1 ? "person" : "people"}</span>
      </div>
      <div className="se-faces">
        <span className="se-face on static">
          <i style={{ background: "#12327f" }}>{ini(myName)}</i>
          <small>You</small>
        </span>
        {friends.map((f) => (
          <button key={f.id} type="button" className={"se-face" + (isOn(f) ? " on" : "")} onClick={() => toggle(f)} aria-pressed={isOn(f)}>
            <i style={{ background: hue(f.name) }}>{ini(f.name)}{isOn(f) && <em><Ic n="check" s={12} /></em>}</i>
            <small>{f.name.split(" ")[0]}</small>
          </button>
        ))}
        <button type="button" className="se-face add" onClick={() => go("Groups")} aria-label="Add a friend">
          <i><Ic n="plus" s={22} /></i>
          <small>Add</small>
        </button>
      </div>

      <h3 className="se-h3">Split Type</h3>
      <div className="se-types">
        {[["equal", "Equal"], ["custom", "Custom"], ["pct", "Percentage"]].map(([k, l]) => (
          <button key={k} type="button" className={type === k ? "on" : ""} onClick={() => changeType(k)}>{l}</button>
        ))}
      </div>

      {type !== "equal" && (
        <div className="se-shares">
          {people.map((p) => (
            <label key={p.key} className="se-share">
              <i style={{ background: p.key === "me" ? "#12327f" : hue(p.name) }}>{ini(p.name)}</i>
              <b>{p.key === "me" ? "You" : p.name}</b>
              <span className="se-inp">
                {type === "custom" && <em>₹</em>}
                <input
                  value={vals[p.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                  placeholder={type === "custom" ? String(r2(amt / count) || 0) : String(r2(100 / count))}
                  inputMode="decimal"
                />
                {type === "pct" && <em>%</em>}
              </span>
            </label>
          ))}
        </div>
      )}
      {type === "equal" && amt > 0 && count > 1 && (
        <p className="se-hint">{money(r2(amt / count))} each</p>
      )}

      {msg && <p className="se-err" role="alert">{msg}</p>}
      <button type="button" className="se-cta" onClick={submit} disabled={busy}>
        {busy ? "Saving..." : <>Create Expense <Ic n="back" s={20} /></>}
      </button>
    </div>
  );
}

/* ============================ Step 3: Expense Created ============================ */
function Done({ r, onBack, onAgain, go }) {
  const how =
    r.type === "equal" ? `₹${r.amt.toLocaleString("en-IN")} split equally among ${r.count} people (${money(r.each)} each)`
    : r.type === "custom" ? `₹${r.amt.toLocaleString("en-IN")} split by custom amounts among ${r.count} people`
    : `₹${r.amt.toLocaleString("en-IN")} split by percentage among ${r.count} people`;
  const ic = iconFor(r.title);
  return (
    <div className="se se-pad">
      <div className="se-bar">
        <button type="button" className="se-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2 />
        <span className="se-ib ghost" />
      </div>

      <div className="se-ok" aria-hidden="true">
        <span className="se-ok-ring"><span className="se-ok-dot"><Ic n="check" s={44} /></span></span>
      </div>
      <h1 className="se-done-h">Expense Created!</h1>
      <p className="se-done-p">{how}</p>

      <div className="se-card">
        <span className={"se-row-ic " + toneFor(ic)}><Ic n={ic} s={24} /></span>
        <span className="se-card-mid">
          <b>{r.title}</b>
          <small>{r.payer === "You" ? "You paid" : `${r.payer} paid`} · {r.count} people</small>
        </span>
        <b className="se-card-amt">{money(r.amt)}</b>
      </div>

      <button type="button" className="se-cta" onClick={() => go("Payments")}>View Details</button>
      <button type="button" className="se-ghost" onClick={onAgain}>Add Another Expense</button>
    </div>
  );
}

/* ============================ Step 1: Split & Expense home ============================ */
export default function MobileSplit({ entries, friends, go, reload, setError, myId, myName, header }) {
  const [step, setStep] = useState("home");
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState(null);
  const [formKey, setFormKey] = useState(0);

  if (step === "form") {
    return (
      <SplitForm
        key={formKey}
        friends={friends}
        myName={myName}
        myId={myId}
        go={go}
        setError={setError}
        onBack={() => setStep("home")}
        onCreated={(r) => { setResult(r); reload(); setStep("done"); }}
      />
    );
  }
  if (step === "done" && result) {
    return (
      <Done
        r={result}
        go={go}
        onBack={() => setStep("home")}
        onAgain={() => { setFormKey((k) => k + 1); setStep("form"); }}
      />
    );
  }

  const all = groupExpenses(entries);
  const shown = all.filter((g) =>
    filter === "me" ? g.paidByMe
    : filter === "owe" ? !g.paidByMe && !g.settled
    : filter === "settled" ? g.settled
    : true
  ).slice(0, 30);

  const days = [];
  shown.forEach((g) => {
    let d = days.find((x) => x.k === g.day);
    if (!d) { d = { k: g.day, items: [] }; days.push(d); }
    d.items.push(g);
  });

  const chips = [["all", "All"], ["me", "Paid by me"], ["owe", "To be paid"], ["settled", "Settled"]];
  const start = () => { setFormKey((k) => k + 1); setStep("form"); };

  return (
    <div className="se">
      {header}

      <div className="se-big">
        <button type="button" className="se-big-a" onClick={start}>
          <span className="se-big-ic"><Ic n="plus" s={26} /></span>
          <span><b>Split Bill</b><small>Add a new expense</small></span>
        </button>
        <button type="button" className="se-big-b" onClick={() => go("Payments")}>
          <span className="se-big-ic2"><Ic n="receipt" s={30} /></span>
          <span><b>Add Expense</b><small>Record payment</small></span>
        </button>
      </div>

      <div className="se-chips" role="tablist">
        {chips.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="se-empty">
          <b>{filter === "all" ? "No expenses yet" : "Nothing here"}</b>
          <p>{filter === "all" ? "Tap Split Bill to add your first shared expense." : "Expenses that match this filter will show up here."}</p>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.k}>
            <h4 className="se-day">{dayLabel(d.k)}</h4>
            <div className="se-list">
              {d.items.map((g) => (
                <button type="button" className="se-item" key={g.id} onClick={() => go("Payments")}>
                  <span className={"se-row-ic " + toneFor(g.icon)}><Ic n={g.icon} s={24} /></span>
                  <span className="se-item-mid">
                    <b>{g.title}</b>
                    <small>{g.paidByMe ? "You paid" : `${g.payer} paid`} · {g.isSplit ? "Split" : "Payment"}{g.settled ? " · Settled" : ""}</small>
                  </span>
                  <span className="se-item-r">
                    <b>{money(g.total)}</b>
                    <span className="se-stack">
                      {g.people.slice(0, 2).map((n) => <i key={n} style={{ background: hue(n) }}>{ini(n)}</i>)}
                      {g.people.length > 2 && <i className="more">+{g.people.length - 2}</i>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <button type="button" className="se-fab" onClick={start} aria-label="Split a new bill"><Ic n="plus" s={30} /></button>
    </div>
  );
}

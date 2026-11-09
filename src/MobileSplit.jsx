/* Phone "Split & Expense" flow (matches the mockup):
   1) Split & Expense list   2) Split an Expense form   3) Expense Created!  (+ Payment Details)  */
import React, { useState } from "react";
import "./mobile-split.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";
import { Detail, Ic, parseNote, catIcon, money, splitInfo } from "./MobilePayments";
import MobileUdhaar from "./MobileUdhaar";
import SplitHub from "./SplitHub";

/* Shows the error on screen instead of a blank page */
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <p className="sx-err" style={{ margin: 16 }}>
          Something went wrong: {String(this.state.err.message || this.state.err)}
        </p>
      );
    }
    return this.props.children;
  }
}

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const localDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dayLabel = (k) => {
  const now = new Date();
  const y = new Date(now.getTime() - 86400000);
  if (k === localDay(now)) return "Today";
  if (k === localDay(y)) return "Yesterday";
  return new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const kindText = (k) => (k === "custom" ? "Split custom" : k === "percentage" ? "Split by %" : "Split equally");

/* One row per split (the saved entries of one split are joined together) */
function groupEntries(entries) {
  const map = new Map();
  const out = [];
  for (const e of entries) {
    if (/split:/i.test(String(e.note || ""))) {
      const k = `${e.note}|${e.payment_date}|${e.paid_by}`;
      if (map.has(k)) { map.get(k).members.push(e); continue; }
      const g = { key: k, e, members: [e] };
      map.set(k, g);
      out.push(g);
    } else {
      out.push({ key: "i" + e.id, e, members: [e] });
    }
  }
  return out;
}

function Faces({ names }) {
  const show = names.slice(0, 2);
  const more = names.length - show.length;
  return (
    <span className="sx-avs">
      {show.map((n, i) => (
        <i key={i} style={{ background: n === "You" ? "#12327f" : hue(n), marginLeft: i ? -8 : 0 }}>{ini(n)}</i>
      ))}
      {more > 0 && <em>+{more}</em>}
    </span>
  );
}

/* ============================ Step 2: Split an Expense ============================ */
function SplitForm({ friends, myName, myId, onBack, onDone, setError, go }) {
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState("me");
  const [sel, setSel] = useState([]);
  const [kind, setKind] = useState("equal");
  const [vals, setVals] = useState({});
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const payerFriend = payer === "me" ? null : friends.find((f) => String(f.id) === String(payer));
  const chosen = friends.filter((f) => sel.map(String).includes(String(f.id)) || (payerFriend && f.id === payerFriend.id));
  const people = [{ key: "me", name: "You" }, ...chosen.map((f) => ({ key: String(f.id), name: f.name }))];
  const count = people.length;
  const amt = Number(amount) || 0;
  const toggle = (id) => setSel((s) => (s.map(String).includes(String(id)) ? s.filter((x) => String(x) !== String(id)) : [...s, id]));

  const shares = {};
  people.forEach((p) => {
    if (kind === "equal") shares[p.key] = r2(amt / count);
    else if (kind === "custom") shares[p.key] = r2(vals[p.key] || 0);
    else shares[p.key] = r2((amt * (Number(vals[p.key]) || 0)) / 100);
  });
  const sumVals = people.reduce((t, p) => t + (Number(vals[p.key]) || 0), 0);

  async function save(rows) {
    let last = null;
    for (const mode of ["UPI", "Cash", "Other"]) {
      const { data, error } = await supabase.from("entries").insert(rows.map((r) => ({ ...r, mode }))).select("id");
      if (!error) return { id: data && data[0] ? data[0].id : null };
      last = error;
      if (!/mode|check/i.test(error.message)) return { error };
    }
    return { error: last };
  }

  async function submit() {
    setMsg("");
    const t = title.trim();
    if (!(amt > 0)) { setMsg("Please enter the amount."); return; }
    if (!t) { setMsg("Please enter what the expense is for."); return; }
    if (count < 2) { setMsg("Pick at least one friend to split with."); return; }
    if (kind === "custom" && Math.abs(sumVals - amt) > 0.01) { setMsg(`Custom amounts must add up to ${money(amt)}.`); return; }
    if (kind === "percentage" && Math.abs(sumVals - 100) > 0.01) { setMsg("Percentages must add up to 100%."); return; }

    const note = kind === "equal"
      ? `Split: ${t} (${count} people)`
      : `Split: ${t} (${count} people, ${kind}, total ${amt})`;
    const base = { user_id: myId, note, payment_date: localDay(new Date()), status: "Pending" };
    let rows;
    if (payerFriend) {
      if (!(shares.me > 0)) { setMsg("Your share is 0, so there is nothing to record."); return; }
      rows = [{ ...base, friend: payerFriend.name, paid_by: "friend", amount: shares.me }];
    } else {
      rows = people.filter((p) => p.key !== "me" && shares[p.key] > 0).map((p) => ({ ...base, friend: p.name, paid_by: "me", amount: shares[p.key] }));
      if (rows.length === 0) { setMsg("Nobody has a share to pay."); return; }
    }
    setBusy(true);
    const res = await save(rows);
    setBusy(false);
    if (res.error) { setError(res.error.message); setMsg(res.error.message); return; }
    setError("");
    onDone({ id: res.id, title: t, total: amt, count, kind, each: r2(amt / count), youPaid: !payerFriend });
  }

  const typeBtn = (k, label) => (
    <button type="button" className={kind === k ? "on" : ""} onClick={() => { setKind(k); setVals({}); }}>{label}</button>
  );

  return (
    <div className="ms sx">
      <div className="ms-bar">
        <button type="button" className="ms-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2>Split an Expense</h2>
        <button type="button" className="ms-ib" onClick={() => setHint(!hint)} aria-label="Info"><Ic n="info" /></button>
      </div>
      {hint && <p className="sx-hint">Enter the amount, who paid, who is in and how to split it.</p>}

      <div className="sx-amt">
        <span className="sx-amt-ic"><Ic n="receipt" s={34} /></span>
        <div className="sx-amt-body">
          <div className="sx-amt-row">
            <b>₹</b>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1,200" inputMode="decimal" />
          </div>
          <input className="sx-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Cafe" />
        </div>
      </div>

      <h3 className="sx-lbl">Paid by</h3>
      <label className="sx-payer">
        <span className="sx-av" style={{ background: payerFriend ? hue(payerFriend.name) : "#12327f" }}>{ini(payerFriend ? payerFriend.name : myName)}</span>
        <select value={payer} onChange={(e) => setPayer(e.target.value)}>
          <option value="me">You</option>
          {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <Ic n="cdown" s={18} />
      </label>

      <div className="sx-lbl-row">
        <h3 className="sx-lbl">Split with</h3>
        <span className="sx-cnt">{count} {count === 1 ? "person" : "people"}</span>
      </div>
      <div className="sx-faces">
        <span className="sx-face on">
          <i style={{ background: "#12327f" }}>{ini(myName)}</i>
          <small>You</small>
        </span>
        {friends.map((f) => {
          const on = sel.map(String).includes(String(f.id)) || (payerFriend && payerFriend.id === f.id);
          return (
            <button type="button" key={f.id} className={"sx-face" + (on ? " on" : "")} onClick={() => toggle(f.id)}>
              <i style={{ background: hue(f.name) }}>{ini(f.name)}</i>
              <small>{String(f.name).split(" ")[0]}</small>
            </button>
          );
        })}
        <button type="button" className="sx-face add" onClick={() => go("Groups")}>
          <i><Ic n="plus" s={22} /></i>
          <small>Add</small>
        </button>
      </div>

      <h3 className="sx-lbl">Split Type</h3>
      <div className="sx-type">
        {typeBtn("equal", "Equal")}
        {typeBtn("custom", "Custom")}
        {typeBtn("percentage", "Percentage")}
      </div>

      {kind !== "equal" && (
        <div className="sx-custom">
          {people.map((p) => (
            <div className="sx-crow" key={p.key}>
              <i style={{ background: p.key === "me" ? "#12327f" : hue(p.name) }}>{ini(p.name)}</i>
              <b>{p.name}</b>
              <span className="sx-cin">
                {kind === "custom" && <u>₹</u>}
                <input value={vals[p.key] || ""} inputMode="decimal" placeholder="0"
                  onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value.replace(/[^0-9.]/g, "") }))} />
                {kind === "percentage" && <u>%</u>}
              </span>
            </div>
          ))}
          <p className="sx-left">
            {kind === "custom"
              ? `${money(Math.abs(amt - sumVals))} ${amt - sumVals >= 0 ? "left to assign" : "over"}`
              : `${r2(Math.abs(100 - sumVals))}% ${100 - sumVals >= 0 ? "left to assign" : "over"}`}
          </p>
        </div>
      )}

      {kind === "equal" && amt > 0 && count > 1 && (
        <p className="sx-each">{money(r2(amt / count))} each</p>
      )}

      {msg && <p className="sx-err">{msg}</p>}
      <button type="button" className="sx-cta sx-sticky" onClick={submit} disabled={busy}>
        {busy ? "Saving..." : <>Create Expense <Ic n="arrow" s={20} /></>}
      </button>
    </div>
  );
}

/* ============================ Main ============================ */
export default function MobileSplit({ entries, friends, go, reload, setError, myId, myName, header, splitHub, paymentsHub, udhaar }) {
  const [view, setView] = useState({ t: "hub" });
  const [pill, setPill] = useState("All");

  if (view.t === "form") {
    return (
      <SplitForm
        key={view.n || 0}
        friends={friends}
        myName={myName}
        myId={myId}
        go={go}
        setError={setError}
        onBack={() => setView({ t: "hub" })}
        onDone={(d) => { reload(); setView({ t: "done", d }); }}
      />
    );
  }

  if (view.t === "done") {
    const d = view.d;
    const ready = d.id && entries.some((x) => String(x.id) === String(d.id));
    const cat = parseNote(d.title).cat;
    return (
      <div className="ms sx">
        <div className="ms-bar">
          <button type="button" className="ms-ib" onClick={() => setView({ t: "hub" })} aria-label="Back"><Ic n="back" /></button>
          <span className="ms-ib ghost" />
        </div>
        <div className="sx-ok">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
              <line key={a} x1="80" y1="6" x2="80" y2={i % 2 ? 14 : 18} stroke={i % 2 ? "#7ddf9e" : "#1fa774"} strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} 80 80)`} />
            ))}
            <circle cx="80" cy="80" r="58" fill="rgba(34,197,94,0.16)" />
            <circle cx="80" cy="80" r="44" fill="#1fa774" />
            <path d="M60 81l14 14 27-29" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="sx-ok-h">Expense Created!</h2>
        <p className="sx-ok-p">
          {d.kind === "equal"
            ? `${money(d.total)} split equally among ${d.count} people (${money(d.each)} each)`
            : `${money(d.total)} split among ${d.count} people`}
        </p>
        <div className="sx-sum">
          <span className={"sx-ic c-" + cat}><Ic n={catIcon(cat)} s={24} /></span>
          <span className="sx-mid"><b>{d.title}</b><small>{d.youPaid ? "You paid" : "Paid by a friend"} · {d.count} people</small></span>
          <b className="sx-sum-amt">{money(d.total)}</b>
        </div>
        <button type="button" className="sx-cta" disabled={!ready} onClick={() => setView({ t: "detail", id: d.id })}>
          {ready ? "View Details" : "Loading..."}
        </button>
        <button type="button" className="sx-ghost" onClick={() => setView({ t: "form", n: Date.now() })}>Add Another Expense</button>
      </div>
    );
  }

  if (view.t === "detail") {
    const e = entries.find((x) => String(x.id) === String(view.id));
    if (!e) { setView({ t: "hub" }); return null; }
    return <Detail e={e} entries={entries} go={go} onBack={() => setView({ t: "hub" })} />;
  }

  if (view.t === "record") {
    /* Same Add Expense (Udhaar) screen that the Home button opens */
    const udhaarList = udhaar || entries.filter((e) => e.verification && e.verification !== "verified");
    return (
      <Boundary>
        <MobileUdhaar
          friends={friends}
          udhaar={udhaarList}
          myId={myId}
          reload={reload}
          setError={setError}
          go={go}
          onClose={() => setView({ t: "hub" })}
        />
      </Boundary>
    );
  }

  if (view.t === "groups") {
    const hubProps = { entries, friends, reload, setError, goFriends: () => go("Groups"), myName };
    return (
      <div className="ms sx">
        <div className="ms-bar">
          <button type="button" className="ms-ib" onClick={() => setView({ t: "hub" })} aria-label="Back"><Ic n="back" /></button>
          <h2>Groups &amp; Quick split</h2>
          <span className="ms-ib ghost" />
        </div>
        <Boundary>{splitHub || <SplitHub {...hubProps} />}</Boundary>
      </div>
    );
  }

  /* ---- Step 1: Split & Expense list ---- */
  const groups = groupEntries(entries).filter((g) => {
    if (pill === "Paid by me") return g.e.paid_by === "me";
    if (pill === "To be paid") return g.members.some((m) => m.status !== "Settled");
    if (pill === "Settled") return g.members.every((m) => m.status === "Settled");
    return true;
  });
  const days = [];
  groups.forEach((g) => {
    const k = String(g.e.payment_date || g.e.created_at || "").slice(0, 10);
    let d = days.find((x) => x.k === k);
    if (!d) { d = { k, list: [] }; days.push(d); }
    d.list.push(g);
  });

  return (
    <div className="ms sx">
      {header}

      <div className="sx-cards">
        <button type="button" className="sx-card hi" onClick={() => setView({ t: "form" })}>
          <span className="sx-card-ic"><Ic n="plus" s={24} /></span>
          <span><b>Split Bill</b><small>Add a new expense</small></span>
        </button>
        <button type="button" className="sx-card" onClick={() => setView({ t: "record" })}>
          <span className="sx-card-ic"><Ic n="receipt" s={26} /></span>
          <span><b>Add Expense</b><small>Record payment</small></span>
        </button>
      </div>

      <div className="sx-pills">
        {["All", "Paid by me", "To be paid", "Settled"].map((p) => (
          <button key={p} type="button" className={pill === p ? "on" : ""} onClick={() => setPill(p)}>{p}</button>
        ))}
      </div>

      {days.length === 0 && <p className="sx-empty">{entries.length === 0 ? "No expenses yet. Tap Split Bill to add one." : "Nothing here."}</p>}

      {days.map((d) => (
        <div key={d.k}>
          <h3 className="sx-day">{dayLabel(d.k)}</h3>
          {d.list.map((g) => {
            const e = g.e;
            const { cat, title } = parseNote(e.note, e.mode);
            const info = splitInfo(e, entries);
            const youPaid = e.paid_by === "me";
            const names = youPaid ? ["You", ...g.members.map((m) => m.friend)] : [e.friend, "You"];
            return (
              <button type="button" className="sx-row" key={g.key} onClick={() => setView({ t: "detail", id: e.id })}>
                <span className={"sx-ic c-" + cat}><Ic n={catIcon(cat)} s={24} /></span>
                <span className="sx-mid">
                  <b>{title}</b>
                  <small>{youPaid ? "You paid" : `${e.friend} paid`} · {info.isSplit ? kindText(info.kind) : e.mode || "Payment"}</small>
                </span>
                <span className="sx-end">
                  <b>{money(info.total)}</b>
                  <Faces names={names} />
                </span>
                <span className="sx-dots"><Ic n="vdots" s={18} /></span>
              </button>
            );
          })}
        </div>
      ))}

      <button type="button" className="sx-link" onClick={() => setView({ t: "groups" })}>Groups &amp; Quick split →</button>

      <button type="button" className="sx-fab" onClick={() => setView({ t: "form" })} aria-label="Split bill"><Ic n="plus" s={28} /></button>
    </div>
  );
}

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "./supabaseClient";
import {
  useLedger, rupee, friendBalance, first, todayLocal, isMobile, UPI_RE, waLink, reminderText,
  settledText, Avatar, Head, Err,
} from "./spkit";

const METHODS = [
  { id: "UPI", title: "UPI", sub: "(GPay, PhonePe, Paytm)", ico: "📲" },
  { id: "Card", title: "Card", sub: "(Debit / Credit)", ico: "💳" },
  { id: "Cash", title: "Cash", sub: "(Mark as Paid)", ico: "💵" },
];

function quick(limit) {
  const arr = [0.25, 0.5, 0.75].map((f) => Math.max(1, Math.round((limit * f) / 10) * 10)).filter((v) => v < limit);
  return [...new Set([...arr, limit])];
}

export default function SettleScreen({ goto, onBack, param, sync }) {
  const { entries, friends, me, loading, error, reload } = useLedger(sync);
  const [step, setStep] = useState("select"); // select | details | confirm | done | request
  const [tab, setTab] = useState("settle");
  const [chip, setChip] = useState("owe");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [notify, setNotify] = useState(true);
  const [upi, setUpi] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);

  const names = [...new Set([...friends.map((f) => f.name), ...entries.map((e) => e.friend)])];
  const rows = names
    .map((n) => ({ name: n, net: friendBalance(entries, n), count: entries.filter((e) => e.friend === n && e.status !== "Settled").length }))
    .filter((r) => r.net !== 0);
  const totalOwe = rows.reduce((s, r) => (r.net < 0 ? s - r.net : s), 0);
  const totalGet = rows.reduce((s, r) => (r.net > 0 ? s + r.net : s), 0);
  const net = name ? friendBalance(entries, name) : 0;
  const limit = Math.abs(net);
  const friendRow = friends.find((f) => f.name === name);
  const amt = Number(amount);

  async function loadUpi(n) {
    const row = friends.find((f) => f.name === n);
    if (!row) return;
    if (row.upi_id) return setUpi(row.upi_id);
    const { data, error: e } = await supabase.rpc("friend_upi", { p_friend_id: row.id });
    if (!e && data && data[0] && data[0].out_upi) setUpi(data[0].out_upi);
  }

  function startFor(n) {
    const nt = friendBalance(entries, n);
    setName(n);
    setWaiting(false);
    setErr("");
    if (nt === 0) return setErr(`You and ${n} are all settled up.`);
    setAmount(String(Math.abs(nt)));
    if (nt < 0) {
      setStep("details");
      loadUpi(n);
    } else setStep("request");
  }

  useEffect(() => {
    if (!loading && !started && param && param.friend) {
      setStarted(true);
      startFor(param.friend);
    }
  }, [loading]);

  function proceed() {
    if (!(amt > 0) || amt > limit + 0.001) return setErr(`Enter an amount between ₹1 and ${rupee(limit)}.`);
    setErr("");
    setStep("confirm");
  }

  const upiLink = () =>
    `upi://pay?pa=${encodeURIComponent(upi.trim())}&pn=${encodeURIComponent(name)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent("SplitPay settle up")}`;

  function pay() {
    setErr("");
    if (method !== "UPI") return finish("paid");
    if (!UPI_RE.test(upi.trim())) return setErr("Enter a valid UPI ID, like name@bank");
    setWaiting(true);
    if (isMobile()) window.location.href = upiLink();
  }

  // kind: "paid" (I paid them) or "received" (they paid me)
  async function finish(kind) {
    setBusy(true);
    setErr("");
    const mine = kind === "paid";
    const { data, error: e } = await supabase
      .from("entries")
      .insert({
        friend: name, amount: amt, note: mine ? "Settlement payment" : "Settlement received",
        mode: mine ? method : "Cash", paid_by: mine ? "me" : "friend", payment_date: todayLocal(),
      })
      .select()
      .single();
    if (e) {
      setBusy(false);
      return setErr(e.message);
    }
    const pending = entries.filter((x) => x.friend === name && x.status !== "Settled");
    const left = Math.round((limit - amt) * 100) / 100;
    if (left <= 0 && !pending.some((x) => x.shared)) {
      await supabase.from("entries").update({ status: "Settled" }).in("id", [...pending.map((x) => x.id), data.id]);
    }
    if (mine && method === "UPI" && friendRow && !friendRow.upi_id && !friendRow.linked_user_id && UPI_RE.test(upi.trim())) {
      await supabase.from("friends").update({ upi_id: upi.trim() }).eq("id", friendRow.id);
    }
    const title = (pending.find((x) => x.paid_by === (mine ? "friend" : "me") && x.note) || {}).note || "shared expenses";
    setResult({ kind, name, amount: amt, method: mine ? method : "Cash", title, when: new Date(), full: left <= 0, left, notify: mine && notify });
    await reload();
    setBusy(false);
    setWaiting(false);
    setStep("done");
  }

  function sendRequest() {
    const text = reminderText({ name, amount: amt, title: "your pending balance", due: null });
    window.open(waLink(friendRow && friendRow.phone, text), "_blank");
  }

  function viewInWhatsApp() {
    const text = settledText({ from: me.name, to: name, amount: result.amount, title: result.title, method: result.method });
    window.open(waLink(friendRow && friendRow.phone, text), "_blank");
  }

  if (loading) return <p className="kt-muted">Loading...</p>;

  const shown = rows.filter((r) => chip === "all" || (chip === "owe" && r.net < 0) || (chip === "get" && r.net > 0));

  const AmountBox = (
    <>
      <div className="kt-label">Enter Amount</div>
      <div className="kt-field">
        <span>₹</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="kt-max" onClick={() => setAmount(String(limit))}>Max</button>
      </div>
      <div className="kt-qchips">
        {quick(limit).map((v) => (
          <button key={v} className={"kt-q" + (amt === v ? " on" : "")} onClick={() => setAmount(String(v))}>₹{v}</button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <Err text={err || error} />

      {step === "select" && (
        <>
          <Head title="Settle Up" onBack={onBack} />
          <div className="kt-sub">Clear dues and keep your friends in sync</div>
          <div className="kt-tabs">
            <button className={"kt-tab" + (tab === "settle" ? " on" : "")} onClick={() => { setTab("settle"); setChip("owe"); }}>Settle (Pay Back)</button>
            <button className={"kt-tab" + (tab === "request" ? " on" : "")} onClick={() => { setTab("request"); setChip("get"); }}>Request (Get Paid)</button>
          </div>
          <div className="kt-sum">
            <div><span>Total You Owe</span><b>{rupee(totalOwe)}</b></div>
            <div style={{ textAlign: "right" }}><span>Total You Get</span><b>{rupee(totalGet)}</b></div>
          </div>
          <div className="kt-chips">
            {[["all", "All"], ["owe", "You Owe"], ["get", "You Get"]].map(([id, label]) => (
              <button key={id} className={"kt-chip" + (chip === id ? " on" : "")} onClick={() => setChip(id)}>{label}</button>
            ))}
          </div>
          <div className="kt-list">
            {shown.length === 0 && <p className="kt-muted" style={{ padding: 18 }}>Nothing to settle here. 🎉</p>}
            {shown.map((r) => (
              <button key={r.name} className="kt-row" onClick={() => startFor(r.name)}>
                <Avatar name={r.name} />
                <div className="kt-grow">
                  <div className="kt-name">{r.name}</div>
                  <div className="kt-meta">{r.count} transaction{r.count === 1 ? "" : "s"}</div>
                </div>
                <span className={"kt-pill " + (r.net < 0 ? "owe" : "get")} style={{ marginTop: 0 }}>
                  {r.net < 0 ? `You owe ${rupee(-r.net)}` : `You get ${rupee(r.net)}`}
                </span>
                <span className="kt-chev">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "details" && (
        <>
          <Head title={`Settle with ${first(name)}`} onBack={() => setStep("select")} />
          <div className="kt-hero-row">
            <Avatar name={name} size={64} />
            <div>
              <div className="kt-hname" style={{ marginTop: 0 }}>{name}</div>
              <span className="kt-pill owe">You owe {rupee(limit)}</span>
            </div>
          </div>
          {AmountBox}
          <div className="kt-label">Payment Method</div>
          {METHODS.map((m) => (
            <button key={m.id} className={"kt-opt" + (method === m.id ? " on" : "")} onClick={() => setMethod(m.id)}>
              <span className="kt-opt-ico">{m.ico}</span>
              <span>{m.title} <small>{m.sub}</small></span>
              {method === m.id ? <span className="kt-check">✓</span> : <span className="kt-radio" />}
            </button>
          ))}
          <div className="kt-label">Send Payment Reminder</div>
          <div className="kt-card kt-togrow">
            <span className="kt-wa-ico">💬</span>
            <div className="kt-grow">
              <div>Notify {first(name)} on WhatsApp</div>
              <div className="kt-meta">after payment</div>
            </div>
            <button className={"kt-switch" + (notify ? " on" : "")} onClick={() => setNotify(!notify)} aria-label="Toggle WhatsApp notice" />
          </div>
          <div className="kt-actions"><div className="kt-actions-in"><button className="kt-btn primary" onClick={proceed}>Proceed to Pay →</button></div></div>
        </>
      )}

      {step === "confirm" && (
        <>
          <Head title="Confirm Settlement" onBack={() => { setWaiting(false); setStep("details"); }} />
          <div className="kt-planeic">✈️</div>
          <div className="kt-big">You're about to pay {rupee(amt)} to {name}</div>
          <div className="kt-card">
            <div className="kt-kv"><span>Amount</span><b>{rupee(amt)}</b></div>
            <div className="kt-kv"><span>Payment Method</span><b>{method}</b></div>
            <div className="kt-kv"><span>Settle For</span><b>{name}</b></div>
            <div className="kt-kv"><span>Notify on WhatsApp</span><b>{notify ? "✓ Yes" : "No"}</b></div>
          </div>

          {method === "UPI" && (
            <div className="kt-card">
              <div className="kt-label" style={{ marginTop: 0 }}>{first(name)}'s UPI ID</div>
              <div className="kt-field"><input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" /></div>
              {waiting && !isMobile() && UPI_RE.test(upi.trim()) && (
                <>
                  <p className="kt-meta" style={{ marginTop: 12 }}>Scan this QR with any UPI app on your phone:</p>
                  <div className="kt-qr"><div><QRCodeSVG value={upiLink()} size={170} /></div></div>
                </>
              )}
              {waiting && <p className="kt-meta" style={{ marginTop: 10 }}>Finish the payment in your UPI app, then tap "I've paid". SplitPay cannot see your bank, so you confirm it here.</p>}
            </div>
          )}

          <div className="kt-actions">
            <div className="kt-actions-in">
              {waiting ? (
                <>
                  <button className="kt-btn outline" onClick={() => setWaiting(false)}>Cancel</button>
                  <button className="kt-btn primary" onClick={() => finish("paid")} disabled={busy}>{busy ? "Saving..." : "I've paid ✓"}</button>
                </>
              ) : (
                <button className="kt-btn primary" onClick={pay} disabled={busy}>
                  {method === "UPI" ? `Pay ${rupee(amt)} ↗` : busy ? "Saving..." : "Mark as paid"}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {step === "request" && (
        <>
          <Head title={`Request from ${first(name)}`} onBack={() => setStep("select")} />
          <div className="kt-hero-row">
            <Avatar name={name} size={64} />
            <div>
              <div className="kt-hname" style={{ marginTop: 0 }}>{name}</div>
              <span className="kt-pill get">You get {rupee(limit)}</span>
            </div>
          </div>
          {AmountBox}
          <div className="kt-card" style={{ marginTop: 16 }}>
            <div className="kt-meta">
              The WhatsApp request includes your UPI ID{localStorage.getItem("upiId") ? ` (${localStorage.getItem("upiId")})` : ""}. Save your UPI ID in Profile to include it.
            </div>
          </div>
          <div className="kt-actions">
            <div className="kt-actions-in">
              <button className="kt-btn outline" onClick={() => finish("received")} disabled={busy}>Mark {rupee(amt || 0)} received</button>
              <button className="kt-btn primary" onClick={sendRequest}>💬 Send request</button>
            </div>
          </div>
        </>
      )}

      {step === "done" && result && (
        <>
          <div className="kt-ok">✓</div>
          <div className="kt-big">{result.kind === "paid" ? "Payment Successful!" : "Payment Received!"}</div>
          <p className="kt-center kt-muted">
            {result.kind === "paid"
              ? `You've ${result.full ? "settled" : "paid"} ${rupee(result.amount)} with ${result.name}.`
              : `${rupee(result.amount)} marked as received from ${result.name}.`}
            {!result.full && ` ${rupee(result.left)} is still pending.`}
          </p>
          <div className="kt-card">
            <div className="kt-sec">Transaction Details</div>
            <div className="kt-kv"><span>Amount</span><b>{rupee(result.amount)}</b></div>
            <div className="kt-kv"><span>Paid via</span><b>{result.method}</b></div>
            <div className="kt-kv"><span>Date & Time</span><b>{result.when.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></div>
            <div className="kt-kv"><span>Status</span><b>{result.full ? "Settled ✅" : "Partly settled"}</b></div>
          </div>
          {result.notify && (
            <div className="kt-card kt-notice">
              <span>💬</span><span>Confirmation for {first(result.name)} is ready on WhatsApp ✓</span>
            </div>
          )}
          <div className="kt-stack">
            {result.notify && <button className="kt-btn outline" onClick={viewInWhatsApp}>💬 View in WhatsApp →</button>}
            <button className="kt-btn primary" onClick={() => { setStep("select"); setResult(null); setErr(""); }}>Back to Settle Up</button>
          </div>
        </>
      )}
    </>
  );
}
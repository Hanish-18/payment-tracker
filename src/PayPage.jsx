import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "./supabaseClient";

const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");
const UPI_RE = /^[\w.\-]{2,}@[A-Za-z]{2,}$/;
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const fmtDate = (s) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function statusLabel(p, incoming) {
  if (p.status === "initiated") return "Opened UPI app";
  if (p.status === "cancelled") return "Cancelled";
  if (p.status === "failed") return "Failed";
  if (p.status === "confirmed") return "Confirmed";
  if (p.friend_user_id) return incoming ? "Waiting for your confirmation" : "Paid · waiting for confirmation";
  return "Paid · self-reported";
}

function PayPanel({ target, friends, setError, onPaid, onClose }) {
  const friendRow = friends.find((f) => f.name === target.friend);
  const amount = target.amount ?? target.entries.reduce((s, e) => s + Number(e.amount), 0);
  const [upi, setUpi] = useState("");
  const [payee, setPayee] = useState(target.friend);
  const [payId, setPayId] = useState(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [back, setBack] = useState(false);

  // UPI app se wapas aane par "Payment kiya?" popup
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && opened) setBack(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [opened]);

  useEffect(() => {
    if (!friendRow) return;
    supabase.rpc("friend_upi", { p_friend_id: friendRow.id }).then(({ data }) => {
      if (data && data[0] && data[0].out_upi) {
        setUpi(data[0].out_upi);
        setPayee(data[0].out_name || target.friend);
      }
    });
  }, []);

  const valid = UPI_RE.test(upi.trim());
  const qs = valid
    ? `pa=${encodeURIComponent(upi.trim())}&pn=${encodeURIComponent(payee)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("SplitPay settle up")}`
    : "";
  const links = {
    upi: `upi://pay?${qs}`,
    gpay: `tez://upi/pay?${qs}`,
    phonepe: `phonepe://pay?${qs}`,
    paytm: `paytmmp://pay?${qs}`,
  };

  async function ensureRow() {
    if (payId) return payId;
    const { data, error } = await supabase
      .from("app_payments")
      .insert({
        friend_name: target.friend,
        amount,
        method: "upi_app",
        status: "initiated",
        entry_ids: target.entries.map((e) => e.id),
        payee_upi: upi.trim(),
        note: "SplitPay settle up",
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return null;
    }
    setPayId(data.id);
    if (friendRow && !friendRow.linked_user_id && friendRow.upi_id !== upi.trim()) {
      await supabase.from("friends").update({ upi_id: upi.trim() }).eq("id", friendRow.id);
    }
    return data.id;
  }

  async function openApp(url) {
    if (!valid) {
      setError("Enter a valid UPI ID, like name@bank");
      return;
    }
    setBusy(true);
    const id = await ensureRow();
    setBusy(false);
    if (!id) return;
    setError("");
    setOpened(true);
    window.location.href = url;
  }

  async function iPaid() {
    if (!valid) {
      setError("Enter a valid UPI ID, like name@bank");
      return;
    }
    setBusy(true);
    const id = await ensureRow();
    if (id) {
      const ok = await onPaid(
        {
          id,
          entry_ids: target.entries.map((e) => e.id),
          reference: null,
          friend_name: target.friend,
          amount,
          payee_upi: upi.trim(),
        },
        ref.trim()
      );
      if (ok) onClose();
    }
    setBusy(false);
  }

  async function cancel() {
    if (payId) await supabase.from("app_payments").update({ status: "cancelled" }).eq("id", payId);
    onClose();
  }

  return (
    <div className="card">
      <h3>Pay {rupee(amount)} to {target.friend}</h3>
      {target.entries.length > 0 && (
        <p className="sub" style={{ margin: "8px 0 0" }}>
          {target.entries.length} payment{target.entries.length === 1 ? "" : "s"} included.
        </p>
      )}

      <label>{target.friend}'s UPI ID</label>
      <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />

      {valid && isMobile() && (
        <>
          <label>Which app do you want to pay with?</label>
          <div className="seg">
            <button type="button" disabled={busy} onClick={() => openApp(links.upi)}>Any UPI app</button>
            <button type="button" disabled={busy} onClick={() => openApp(links.gpay)}>Google Pay</button>
            <button type="button" disabled={busy} onClick={() => openApp(links.phonepe)}>PhonePe</button>
            <button type="button" disabled={busy} onClick={() => openApp(links.paytm)}>Paytm</button>
          </div>
        </>
      )}

      {valid && !isMobile() && (
        <>
          <p className="sub" style={{ margin: "16px 0 0" }}>
            UPI apps open on phones. Scan this QR with any UPI app on your phone to pay{" "}
            {rupee(amount)}.
          </p>
          <div className="qr-box">
            <QRCodeSVG value={links.upi} size={180} />
          </div>
        </>
      )}

      {back && (
        <div className="card notify" style={{ marginTop: 16 }}>
          <strong>Payment kiya? {rupee(amount)} to {target.friend}</strong>
          <div className="actions">
            <button className="small" type="button" disabled={busy} onClick={iPaid}>Haan, paid</button>
            <button className="ghost" type="button" onClick={() => setBack(false)}>Nahi</button>
          </div>
        </div>
      )}

      <label>UPI reference number (optional)</label>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="12-digit UTR from your app" />

      <p className="sub" style={{ margin: "14px 0 0" }}>
        The app cannot see your bank, so after you pay, come back and tell us.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button className="small" type="button" disabled={busy} onClick={iPaid}>I paid</button>
        <button className="ghost" type="button" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

function NewPay({ friends, onStart }) {
  const [friend, setFriend] = useState("");
  const [amt, setAmt] = useState("");
  const ok = friend && Number(amt) > 0;
  return (
    <div className="card">
      <h3>Pay someone</h3>
      <label>Friend</label>
      <select value={friend} onChange={(e) => setFriend(e.target.value)}>
        <option value="">Choose a friend</option>
        {friends.map((f) => (
          <option key={f.id} value={f.name}>{f.name}</option>
        ))}
      </select>
      <label>Amount (₹)</label>
      <input
        type="number"
        inputMode="decimal"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        placeholder="500"
      />
      <div style={{ marginTop: 16 }}>
        <button
          className="small"
          type="button"
          disabled={!ok}
          onClick={() => onStart(friend, Number(amt))}
        >
          Pay
        </button>
      </div>
    </div>
  );
}

export default function PayPage({ entries, friends, reload, setError }) {
  const [myId, setMyId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [names, setNames] = useState({});
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState("");

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    setMyId(s.session ? s.session.user.id : null);
    const [p, pr] = await Promise.all([
      supabase.from("app_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name"),
    ]);
    const err = p.error || pr.error;
    if (err) {
      setError(err.message);
      return;
    }
    const map = {};
    pr.data.forEach((r) => (map[r.id] = r.name));
    setNames(map);
    setPayments(p.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function finishPayment(p, ref) {
    const { error } = await supabase
      .from("app_payments")
      .update({ status: "paid", reference: ref || p.reference || null })
      .eq("id", p.id);
    if (error) {
      setError(error.message);
      return false;
    }

    if (p.entry_ids && p.entry_ids.length > 0) {
      const mine = entries
        .filter((e) => p.entry_ids.includes(e.id) && !e.shared)
        .map((e) => e.id);
      if (mine.length) await supabase.from("entries").update({ status: "Settled" }).in("id", mine);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data: row, error: entErr } = await supabase
        .from("entries")
        .insert({
          user_id: u.user.id,
          friend: p.friend_name,
          amount: p.amount,
          paid_by: "me",
          status: "Settled",
          payment_date: new Date().toISOString().slice(0, 10),
          note: "Paid via UPI" + (p.payee_upi ? " to " + p.payee_upi : ""),
        })
        .select()
        .single();
      if (entErr) {
        setError("Payment saved, but entry could not be added: " + entErr.message);
      } else {
        await supabase.from("app_payments").update({ entry_ids: [row.id] }).eq("id", p.id);
      }
    }

    setError("");
    setNotice("Payment saved in your history.");
    await reload();
    await load();
    return true;
  }

  async function cancelPayment(p) {
    await supabase.from("app_payments").update({ status: "cancelled" }).eq("id", p.id);
    load();
  }

  async function confirmReceived(p) {
    const { data, error } = await supabase.rpc("confirm_app_payment", { p_id: p.id });
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setNotice(data);
    await reload();
    load();
  }

  const waiting = new Set(
    payments
      .filter((p) => p.user_id === myId && p.status === "paid")
      .flatMap((p) => p.entry_ids || [])
  );
  const owed = {};
  entries
    .filter((e) => e.paid_by === "friend" && e.status !== "Settled")
    .forEach((e) => {
      (owed[e.friend] = owed[e.friend] || []).push(e);
    });

  return (
    <>
      <h1>Pay</h1>
      <p className="sub">Pay with your UPI app. Every payment is saved in your history.</p>

      {notice && (
        <div className="card notify">
          <strong>{notice}</strong>
          <div className="actions">
            <button className="ghost" onClick={() => setNotice("")}>OK</button>
          </div>
        </div>
      )}

      {target && (
        <PayPanel
          target={target}
          friends={friends}
          setError={setError}
          onPaid={finishPayment}
          onClose={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      {!target && (
        <NewPay
          friends={friends}
          onStart={(friend, amount) => setTarget({ friend, entries: [], amount })}
        />
      )}

      <h2>You owe</h2>
      {Object.keys(owed).length === 0 && <p className="sub">You don't owe anything right now.</p>}
      {Object.entries(owed).map(([friend, list]) => {
        const payable = list.filter((e) => !waiting.has(e.id));
        const total = payable.reduce((s, e) => s + Number(e.amount), 0);
        return (
          <div className="card" key={friend}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3>{friend}</h3>
              {payable.length > 0 && (
                <button className="small" onClick={() => setTarget({ friend, entries: payable })}>
                  Pay all {rupee(total)}
                </button>
              )}
            </div>
            {list.map((e) => (
              <div className="entry" key={e.id}>
                <div>
                  <div className="entry-name">{rupee(e.amount)}</div>
                  <div className="entry-meta">
                    {new Date(e.payment_date).toLocaleDateString("en-IN")}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                {waiting.has(e.id) ? (
                  <span className="entry-meta">Waiting for confirmation</span>
                ) : (
                  <button className="ghost" onClick={() => setTarget({ friend, entries: [e] })}>
                    Pay
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <h2>Payment history</h2>
      {payments.length === 0 && <p className="sub">No app payments yet.</p>}
      {payments.map((p) => {
        const incoming = p.friend_user_id === myId && p.user_id !== myId;
        const who = incoming ? names[p.user_id] || "A friend" : p.friend_name;
        return (
          <div className="entry" key={p.id}>
            <div>
              <div className="entry-name">
                {incoming ? `${who} paid you` : `You paid ${who}`}
                <span className="badge">{p.method === "api" ? "API payment" : "UPI app"}</span>
              </div>
              <div className="entry-meta">
                {fmtDate(p.created_at)} · {statusLabel(p, incoming)}
                {p.payee_upi && !incoming ? ` · ${p.payee_upi}` : ""}
                {p.reference ? ` · Ref ${p.reference}` : ""}
              </div>
            </div>
            <div className="entry-right">
              <div className="entry-amount">{rupee(p.amount)}</div>
              {!incoming && p.status === "initiated" && (
                <>
                  <button className="remind" onClick={() => finishPayment(p, "")}>I paid</button>
                  {" · "}
                  <button className="del" onClick={() => cancelPayment(p)}>Cancel</button>
                </>
              )}
              {incoming && p.status === "paid" && (
                <button className="remind" onClick={() => confirmReceived(p)}>Confirm received</button>
              )}
            </div>
          </div>
        );
      })}

      <div className="card">
        <h3>API payments</h3>
        <p className="sub" style={{ margin: "8px 0 0" }}>
          Payments made through a payment gateway will appear in this history with an "API payment"
          label, and will be confirmed automatically. A gateway is not connected yet.
        </p>
      </div>
    </>
  );
}

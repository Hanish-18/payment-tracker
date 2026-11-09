/* Phone "Udhaar" flow (matches the mockup):
   Add Expense (I Paid / Friend Paid) -> Review & Send -> Expense Added (verification pending)
   The friend gets a verification request and approves or rejects it.
   Needs the one-time database setup in udhaar_setup.sql (the app still works without it,
   but then nothing is sent for verification). */
import { useState } from "react";
import "./mobile-udhaar.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";

const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayStr = () => iso(new Date());
const plusDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const dlong = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const dshort = (s) => new Date(String(s).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  out: <path d="M7 17L17 7M9 7h8v8" />,
  inn: <path d="M17 7L7 17M15 17H7V9" />,
  chev: <path d="M9 5l7 7-7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  calc: (<><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 8h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></>),
  card: (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></>),
  cash: (<><rect x="2.5" y="6" width="19" height="12" rx="3" /><circle cx="12" cy="12" r="2.6" /></>),
  dots: (<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>),
  upi: <path d="M7 4l5 8-5 8M13 4l5 8-5 8" />,
  cal: (<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>),
  clip: <path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.6 1.6 0 0 1-2.4-2.4L14 7.6" />,
  send: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  shield: (<><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>),
  chat: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />,
  user: (<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.8 3-6 7-6s7 2.2 7 6" /></>),
  note: (<><path d="M6 4h12v16H6z" /><path d="M9 9h6M9 13h4" /></>),
  rupee: <path d="M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 6" />,
  food: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11" />,
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

function Logo() {
  return (
    <span className="ud-logo">
      <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" rx="11" fill="#2f74ff" />
        <path d="M13 24c0-4 3-6 7-6s7 2 7 6M13 17c0-3 3-5 7-5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <b>SplitPay</b>
    </span>
  );
}

function Avatar({ name, size = 44 }) {
  return <i className="ud-av" style={{ background: hue(name), width: size, height: size, fontSize: size * 0.36 }}>{ini(name)}</i>;
}

function waLink(phone, text) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/* a date box that shows "Fri, 03 Oct 2026" but opens the phone's date picker */
function DateBox({ icon, value, min, onChange, label }) {
  return (
    <label className="ud-date">
      <Ic n={icon} s={20} />
      <span>{dlong(value)}</span>
      <Ic n="down" s={16} />
      <input type="date" value={value} min={min} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={label} />
    </label>
  );
}

export default function MobileUdhaar({ friends, udhaar = [], myId, reload, setError, go, presetFriendId, onClose }) {
  const [view, setView] = useState("form"); // form | review | done | requests
  const [kind, setKind] = useState("me");
  const [fid, setFid] = useState(presetFriendId || null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [date, setDate] = useState(todayStr());
  const [rem, setRem] = useState(plusDays(todayStr(), 4));
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [recUrl, setRecUrl] = useState(null);

  const friend = friends.find((f) => f.id === fid) || null;
  const linked = Boolean(friend && friend.linked_user_id);
  const first = friend ? friend.name.split(" ")[0] : "";
  const amt = Number(amount) || 0;

  const incoming = udhaar.filter((e) => e.shared && e.verification === "pending");
  const outgoing = udhaar.filter((e) => !e.shared);
  const reqCount = incoming.length + outgoing.length;

  const exit = () => (onClose ? onClose() : go("Dashboard"));

  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setMsg("Receipt is too big. Please pick an image under 5 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMsg("");
  }
  function dropFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
  }

  function toReview() {
    setMsg("");
    if (!friend) { setMsg("Select a friend."); return; }
    if (!(amt > 0)) { setMsg("Enter the amount."); return; }
    if (rem < date) { setMsg("Reminder date can't be before the payment date."); return; }
    setView("review");
  }

  async function send() {
    setBusy(true);
    setMsg("");
    let path = null;
    let warn = "";
    if (file) {
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const p = `${myId}/${Date.now()}-${safe}`;
      const { error: ue } = await supabase.storage.from("receipts").upload(p, file, { contentType: file.type });
      if (ue) warn = "The receipt could not be uploaded, so it was saved without it.";
      else path = p;
    }
    const base = {
      user_id: myId, friend: friend.name, paid_by: kind, amount: amt,
      note: note.trim() || "Udhaar", payment_date: date, due_date: rem || null, status: "Pending",
    };
    const full = { ...base, verification: linked ? "pending" : "verified" };
    if (path) full.receipt_path = path;
    const modes = [...new Set([method, "Other", "UPI", "Cash"])];
    let ok = false;
    let last = null;
    let usedBase = false;
    outer: for (const mode of modes) {
      for (const variant of [full, base]) {
        const { error } = await supabase.from("entries").insert({ ...variant, mode });
        if (!error) { ok = true; usedBase = variant === base; break outer; }
        last = error;
        if (/column|schema cache|verification|receipt_path/i.test(error.message)) continue;
        if (/mode|check/i.test(error.message)) break;
        break outer;
      }
    }
    setBusy(false);
    if (!ok) { setError(last.message); setMsg(last.message); return; }
    setError("");
    let verified = !linked;
    if (usedBase && linked) {
      verified = true;
      warn = "Saved without verification, because the one-time database setup is not done yet. " + warn;
    } else if (usedBase && path) {
      warn = "The receipt could not be stored (database setup is not done yet). " + warn;
    }
    reload();
    setRes({ friend, amt, kind, verified, warn: warn.trim(), at: new Date(), note: note.trim() || "Udhaar", rem });
    setView("done");
  }

  function remind(f, text) {
    window.open(waLink(f && f.phone, text), "_blank");
  }

  async function answer(e, accept) {
    setBusyId(e.id);
    setMsg("");
    const { error } = await supabase.rpc("respond_udhaar", { p_id: String(e.id), p_accept: accept });
    setBusyId(null);
    if (error) { setMsg(error.message); return; }
    reload();
  }
  async function removeReq(e) {
    setBusyId(e.id);
    const { error } = await supabase.from("entries").delete().eq("id", e.id);
    setBusyId(null);
    if (error) { setMsg(error.message); return; }
    reload();
  }
  async function showReceipt(e) {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(e.receipt_path, 300);
    if (error || !data) { setMsg("Could not open the receipt."); return; }
    setRecUrl({ id: e.id, url: data.signedUrl });
  }

  function resetForm() {
    dropFile();
    setAmount(""); setNote(""); setKind("me"); setMethod("UPI");
    setDate(todayStr()); setRem(plusDays(todayStr(), 4));
    setRes(null); setMsg("");
    setView("form");
  }

  /* ============ Requests ============ */
  if (view === "requests") {
    return (
      <div className="ud ud-pad">
        <div className="ud-bar">
          <button type="button" className="ud-ib" onClick={() => setView("form")} aria-label="Back"><Ic n="back" /></button>
          <Logo />
          <span className="ud-ib ghost" />
        </div>
        <h1 className="ud-h1">Verification requests</h1>

        <h3 className="ud-h3">Waiting for your approval</h3>
        {incoming.length === 0 ? (
          <p className="ud-none">Nothing waiting for you.</p>
        ) : incoming.map((e) => (
          <div className="ud-req" key={e.id}>
            <div className="ud-req-top">
              <Avatar name={e.friend} size={42} />
              <span>
                <b>{e.paid_by === "friend" ? `${e.friend} paid ${money(e.amount)} for you` : `${e.friend} says you paid ${money(e.amount)}`}</b>
                <small>{e.note} · {dshort(e.payment_date || e.created_at)}</small>
              </span>
            </div>
            {e.receipt_path && (
              recUrl && recUrl.id === e.id
                ? <a className="ud-link" href={recUrl.url} target="_blank" rel="noreferrer">Open receipt ↗</a>
                : <button type="button" className="ud-link" onClick={() => showReceipt(e)}>View receipt</button>
            )}
            <div className="ud-req-btns">
              <button type="button" className="yes" disabled={busyId === e.id} onClick={() => answer(e, true)}>{busyId === e.id ? "Please wait..." : "Approve"}</button>
              <button type="button" className="no" disabled={busyId === e.id} onClick={() => answer(e, false)}>Reject</button>
            </div>
          </div>
        ))}

        <h3 className="ud-h3">Sent by you</h3>
        {outgoing.length === 0 ? (
          <p className="ud-none">You have no open requests.</p>
        ) : outgoing.map((e) => {
          const f = friends.find((x) => x.name === e.friend);
          return (
            <div className="ud-req" key={e.id}>
              <div className="ud-req-top">
                <Avatar name={e.friend} size={42} />
                <span>
                  <b>{money(e.amount)} · {e.friend}</b>
                  <small>{e.note} · {dshort(e.payment_date || e.created_at)}</small>
                </span>
                <em className={"ud-pill " + (e.verification === "rejected" ? "bad" : "wait")}>{e.verification === "rejected" ? "Rejected" : "Pending"}</em>
              </div>
              <div className="ud-req-btns">
                {e.verification === "pending" && (
                  <button type="button" className="out" onClick={() => remind(f, `Hi ${e.friend.split(" ")[0]}, I added an expense of ${money(e.amount)} (${e.note}) on SplitPay. Please open SplitPay and confirm it.`)}>
                    <Ic n="chat" s={18} /> Remind
                  </button>
                )}
                <button type="button" className="no" disabled={busyId === e.id} onClick={() => removeReq(e)}>{e.verification === "rejected" ? "Remove" : "Cancel request"}</button>
              </div>
            </div>
          );
        })}
        {msg && <p className="ud-err" role="alert">{msg}</p>}
      </div>
    );
  }

  /* ============ Step 3: Expense Added ============ */
  if (view === "done" && res) {
    const time = res.at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const dd = res.at.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    return (
      <div className="ud ud-pad">
        <div className="ud-bar">
          <button type="button" className="ud-ib" onClick={exit} aria-label="Close"><Ic n="close" /></button>
          <span />
          <span className="ud-ib ghost" />
        </div>

        <div className="ud-hero" aria-hidden="true">
          <svg viewBox="0 0 200 150" width="190" height="142">
            <ellipse cx="92" cy="78" rx="62" ry="50" fill="#dcf5e6" />
            <rect x="58" y="22" width="84" height="100" rx="14" fill="#fff" stroke="#e1e9f8" strokeWidth="2" />
            <rect x="72" y="40" width="46" height="9" rx="4.5" fill="#2f74ff" />
            <rect x="72" y="60" width="56" height="6" rx="3" fill="#e1e9f8" />
            <rect x="72" y="74" width="40" height="6" rx="3" fill="#e1e9f8" />
            <rect x="72" y="88" width="48" height="6" rx="3" fill="#e1e9f8" />
            <circle cx="134" cy="104" r="22" fill="#18b25d" />
            <path d="M124 104l8 8 14-16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="ud-done-h">Expense Added!</h1>
        <p className="ud-done-p">
          {res.verified ? `Saved to your balance with ${res.friend.name}.` : `Verification request has been sent to ${res.friend.name}.`}
        </p>

        <div className="ud-sum">
          <span className="ud-sum-ic"><Ic n={res.kind === "me" ? "out" : "inn"} s={26} /></span>
          <span className="ud-sum-mid"><b>{money(res.amt)}</b><small>{res.kind === "me" ? "Paid by You" : `Paid by ${res.friend.name.split(" ")[0]}`}</small></span>
          <span className={"ud-status " + (res.verified ? "ok" : "wait")}>
            <Ic n={res.verified ? "check" : "clock"} s={20} />
            {res.verified ? "Saved" : <>Pending<br />Verification</>}
          </span>
        </div>

        <div className="ud-tl">
          <div className="done"><i><Ic n="check" s={14} /></i><span><b>Expense Created</b><small>{dd} · {time}</small></span></div>
          {res.verified ? (
            <div className="done"><i><Ic n="check" s={14} /></i><span><b>Added to your balance</b><small>{linked ? "Verification is not set up yet." : `${res.friend.name} isn't linked on SplitPay, so no approval is needed.`}</small></span></div>
          ) : (
            <>
              <div className="now"><i /><span><b>Verification Pending</b><small>Waiting for {res.friend.name}'s approval</small></span></div>
              <div className="next"><i /><span><b>Verified</b><small>Will be added to your balance after approval</small></span></div>
            </>
          )}
        </div>
        {res.warn && <p className="ud-warn" role="status">{res.warn}</p>}

        <button type="button" className="ud-wa" onClick={() => remind(res.friend, `Hi ${res.friend.name.split(" ")[0]}, I added an expense of ${money(res.amt)} (${res.note}) on SplitPay${res.verified ? "" : ". Please open SplitPay and confirm it"}. Thanks!`)}>
          <Ic n="chat" s={22} /> Remind on WhatsApp
        </button>
        <button type="button" className="ud-ghost" onClick={() => (res.verified ? exit() : setView("requests"))}>View Expense Details</button>
        <button type="button" className="ud-link center" onClick={resetForm}>Add another expense</button>
      </div>
    );
  }

  /* ============ Step 2: Review & Send ============ */
  if (view === "review" && friend) {
    return (
      <div className="ud ud-pad">
        <div className="ud-bar">
          <button type="button" className="ud-ib" onClick={() => setView("form")} aria-label="Back"><Ic n="back" /></button>
          <Logo />
          <span className="ud-ib ghost" />
        </div>
        <h1 className="ud-h1">Review &amp; Send</h1>
        <p className="ud-sub">Confirm the details{linked ? " and send a verification request to your friend" : ""}.</p>

        <div className="ud-rev">
          <div className="ud-rev-top">
            <span className="ud-sum-ic"><Ic n={kind === "me" ? "out" : "inn"} s={26} /></span>
            <span className="ud-rev-mid"><b>{kind === "me" ? "I Paid" : "Friend Paid"}</b><small>{kind === "me" ? `${friend.name} will pay you back` : `You will pay ${friend.name} back`}</small></span>
            <em className="ud-pill blue">Udhaar</em>
          </div>
          {[
            ["user", "Friend", friend.name],
            ["food", "Note", note.trim() || "Udhaar"],
            ["rupee", "Amount", money(amt)],
            ["card", "Payment Method", method],
            ["cal", "Payment Date", dlong(date)],
            ["bell", "Reminder Date", dlong(rem)],
          ].map(([ic, l, v]) => (
            <div className="ud-rev-row" key={l}><span><Ic n={ic} s={20} /> {l}</span><b>{v}</b></div>
          ))}
          <div className="ud-rev-row"><span><Ic n="receipt" s={20} /> Receipt</span>
            {preview ? <img src={preview} alt="Receipt preview" className="ud-thumb" /> : <b>None</b>}
          </div>
        </div>

        <div className="ud-verify">
          <span><Ic n="shield" s={34} /></span>
          <div>
            <b>{linked ? "Send Verification Request" : "Save Expense"}</b>
            <p>{linked ? `${friend.name} will get a request to confirm this payment.` : `${friend.name} isn't linked on SplitPay yet, so this is saved straight to your balance.`}</p>
          </div>
        </div>
        {msg && <p className="ud-err" role="alert">{msg}</p>}
        <button type="button" className="ud-cta" onClick={send} disabled={busy}>
          {busy ? "Sending..." : <><Ic n="send" s={20} /> {linked ? "Send Request" : "Save Expense"}</>}
        </button>
      </div>
    );
  }

  /* ============ Step 1: Add Expense ============ */
  return (
    <div className="ud ud-pad">
      <div className="ud-bar">
        <button type="button" className="ud-ib" onClick={exit} aria-label="Back"><Ic n="back" /></button>
        <Logo />
        <span className="ud-ib ghost" />
      </div>

      <div className="ud-titlerow">
        <h1 className="ud-h1">Add Expense</h1>
        <em className="ud-pill blue">Udhaar</em>
      </div>
      <p className="ud-sub">Record a payment between you and a friend.</p>
      {reqCount > 0 && (
        <button type="button" className="ud-reqbtn" onClick={() => setView("requests")}>
          <Ic n="shield" s={18} /> Verification requests <b>{reqCount}</b> <Ic n="chev" s={16} />
        </button>
      )}

      <div className="ud-kind">
        <button type="button" className={kind === "me" ? "on" : ""} onClick={() => setKind("me")} aria-pressed={kind === "me"}>
          <span className="ud-kind-ic"><Ic n="out" s={24} /></span>
          <span><b>I Paid</b><small>I paid for my friend<br />(They owe me)</small></span>
          {kind === "me" && <i className="ud-tick"><Ic n="check" s={13} /></i>}
        </button>
        <button type="button" className={kind === "friend" ? "on" : ""} onClick={() => setKind("friend")} aria-pressed={kind === "friend"}>
          <span className="ud-kind-ic gray"><Ic n="inn" s={24} /></span>
          <span><b>Friend Paid</b><small>My friend paid for me<br />(I owe them)</small></span>
          {kind === "friend" && <i className="ud-tick"><Ic n="check" s={13} /></i>}
        </button>
      </div>

      <label className="ud-lbl">Select Friend <em>*</em></label>
      <button type="button" className="ud-friend" onClick={() => setPicker(true)}>
        {friend ? <Avatar name={friend.name} size={40} /> : <span className="ud-ph"><Ic n="user" s={20} /></span>}
        <b>{friend ? friend.name : "Choose a friend"}</b>
        <Ic n="chev" s={18} />
      </button>

      <label className="ud-lbl">Amount <em>*</em></label>
      <div className="ud-amt">
        <b>₹</b>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" aria-label="Amount" />
        <Ic n="calc" s={22} />
      </div>
      <div className="ud-chips">
        {[500, 800, 1000, 2000].map((v) => (
          <button key={v} type="button" className={amt === v ? "on" : ""} onClick={() => setAmount(String(v))}>₹{v.toLocaleString("en-IN")}</button>
        ))}
      </div>

      <label className="ud-lbl">Payment Method <em>*</em></label>
      <div className="ud-methods">
        {[["UPI", "upi"], ["Card", "card"], ["Cash", "cash"], ["Other", "dots"]].map(([k, ic]) => (
          <button key={k} type="button" className={method === k ? "on" : ""} onClick={() => setMethod(k)} aria-pressed={method === k}>
            <Ic n={ic} s={26} /><span>{k}</span>
            {method === k && <i className="ud-tick"><Ic n="check" s={13} /></i>}
          </button>
        ))}
      </div>

      <div className="ud-dates">
        <div>
          <label className="ud-lbl">Payment Date <em>*</em></label>
          <DateBox icon="cal" value={date} label="Payment date" onChange={(v) => { setDate(v); if (rem < v) setRem(v); }} />
        </div>
        <div>
          <label className="ud-lbl">Reminder Date</label>
          <DateBox icon="bell" value={rem} min={date} label="Reminder date" onChange={setRem} />
        </div>
      </div>

      <label className="ud-lbl">Add Note <small>(Optional)</small></label>
      <div className="ud-note">
        <textarea value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Paid for dinner at Café." rows={2} aria-label="Note" />
        <small>{note.length}/200</small>
      </div>

      <label className="ud-attach">
        <Ic n="clip" s={20} />
        <span><b>Attach Receipt</b> <small>(Optional)</small></span>
        {preview ? <img src={preview} alt="Receipt preview" className="ud-thumb" /> : <Ic n="chev" s={18} />}
        <input type="file" accept="image/*" onChange={pickFile} hidden />
      </label>
      {preview && <button type="button" className="ud-link" onClick={dropFile}>Remove receipt</button>}

      {msg && <p className="ud-err" role="alert">{msg}</p>}
      <button type="button" className="ud-cta" onClick={toReview}>Continue <Ic n="send" s={18} /></button>

      {picker && (
        <div className="ud-sheet-bg" onClick={() => setPicker(false)}>
          <div className="ud-sheet" role="dialog" aria-label="Select friend" onClick={(e) => e.stopPropagation()}>
            <h3>Select Friend</h3>
            {friends.length === 0 ? (
              <p className="ud-none">You have no friends yet. <button type="button" className="ud-link" onClick={() => go("Groups")}>Add a friend →</button></p>
            ) : (
              <div className="ud-flist">
                {friends.map((f) => (
                  <button key={f.id} type="button" onClick={() => { setFid(f.id); setPicker(false); }}>
                    <Avatar name={f.name} size={42} />
                    <b>{f.name}</b>
                    {!f.linked_user_id && <small>Not on SplitPay</small>}
                    {f.id === fid && <i className="ud-tick on"><Ic n="check" s={13} /></i>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

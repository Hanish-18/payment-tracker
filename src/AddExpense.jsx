import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { buildMessage, openWhatsApp } from "./reminder";
import "./addexpense.css";

const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
const longDate = (s) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short", day: "2-digit", month: "short", year: "numeric",
      })
    : "";
const CATS = [
  ["Food & Drinks", "🍴"], ["Travel", "🚗"], ["Accommodation", "🛏️"], ["Shopping", "🛒"], ["Others", "🧾"],
];
const METHODS = [
  ["UPI", "GPay, PhonePe", "📲"], ["Card", "Debit / Credit", "💳"], ["Cash", "", "💵"], ["Other", "", "⋯"],
];
const WHO = [
  ["me", "I Paid", "(for a friend)", "🙋"],
  ["friend", "Friend Paid", "(for me)", "🤝"],
  ["both", "Split & Paid", "(we paid together)", "👥"],
];
const VIA = [["whatsapp", "WhatsApp", "(Recommended)", "💬"], ["app", "In-App Notification", "", "🔔"], ["email", "Email", "", "✉️"]];
const DRAFT_KEY = "splitpay-expense-draft";

const blank = () => ({
  who: "me", friend: "", title: "", category: "Food & Drinks", desc: "",
  method: "UPI", amount: "", date: new Date().toLocaleDateString("en-CA"), ref: "",
  split: "equal", friendShare: "",
  remind: true, remindDate: plusDays(3), via: ["whatsapp"], verify: true,
});

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function Switch({ on, onChange }) {
  return (
    <button type="button" className={"ae-sw" + (on ? " on" : "")} onClick={() => onChange(!on)} aria-pressed={on}>
      <span />
    </button>
  );
}

export default function AddExpense({ entries = [], friends = [], reload = () => {}, setError = () => {}, myName = "", go = () => {} }) {
  const [f, setF] = useState(blank());
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);
  const [restored, setRestored] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setF(d);
      setRestored(true);
    }
  }, []);

  const total = Number(f.amount) || 0;
  const friendRow = friends.find((x) => x.name === f.friend);
  const linked = !!(friendRow && friendRow.linked_user_id);
  const friendShare = f.split === "equal" ? total / 2 : Number(f.friendShare) || 0;
  const myShare = total - friendShare;
  const verifying = f.verify && linked;
  const catIcon = (CATS.find((c) => c[0] === f.category) || CATS[4])[1];

  let step = 1;
  if (f.friend && f.title.trim()) step = 2;
  if (step === 2 && total > 0) step = 3;
  if (step === 3 && (!f.remind || f.remindDate)) step = 4;

  const approvals = entries.filter((e) => e.shared && e.verification === "pending");

  function check() {
    if (!f.friend) return setError("Choose a friend first."), false;
    if (!f.title.trim()) return setError("Enter the expense title."), false;
    if (!(total > 0)) return setError("Enter the amount."), false;
    if (f.split === "custom" && !(friendShare >= 0 && friendShare <= total))
      return setError("The friend's share cannot be more than the amount."), false;
    setError("");
    return true;
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
      setNotice("Draft saved on this device.");
    } catch {
      setNotice("Could not save the draft.");
    }
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setF(blank());
    setReceipt(null);
    setRestored(false);
  }

  async function save() {
    if (!check()) return;
    setBusy(true);
    const owed = f.who === "friend" ? myShare : friendShare;
    const base = {
      friend: f.friend,
      amount: round2(owed),
      note: f.title.trim(),
      mode: f.method,
      paid_by: f.who === "friend" ? "friend" : "me",
      payment_date: f.date,
      due_date: f.remind ? f.remindDate : null,
    };
    if (f.who === "both") base.status = "Settled";
    const extra = {
      category: f.category,
      description: f.desc.trim() || null,
      reference: f.ref.trim() || null,
      verification: verifying ? "pending" : "none",
      remind_via: f.remind ? f.via.join(",") : null,
    };
    let { data, error } = await supabase.from("entries").insert({ ...base, ...extra }).select().single();
    if (error && /column/i.test(error.message)) {
      // Extra columns not created yet: save the basics so nothing is lost
      const note = base.note + (f.desc.trim() ? " · " + f.desc.trim() : "");
      ({ data, error } = await supabase.from("entries").insert({ ...base, note }).select().single());
    }
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setDone({ entry: data, friend: f.friend, who: f.who, whatsapp: f.remind && f.via.includes("whatsapp") });
    setF(blank());
    setReceipt(null);
    setRestored(false);
    reload();
  }

  function remindNow() {
    try {
      const e = done.entry;
      const text = buildMessage({ friend: done.friend, entries: [...entries, e], entry: e, myName });
      const row = friends.find((x) => x.name === done.friend);
      openWhatsApp(row && row.phone, text);
    } catch {
      setError("Could not open WhatsApp.");
    }
  }

  async function decide(id, ok) {
    const { data, error } = await supabase.rpc("verify_entry", { p_id: id, p_ok: ok });
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setNotice(data);
    reload();
  }

  function toggleVia(k) {
    set("via", f.via.includes(k) ? f.via.filter((x) => x !== k) : [...f.via, k]);
  }

  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Receipt must be 5 MB or smaller.");
    setReceipt({ name: file.name, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
  }

  const paidByLabel = f.who === "friend" ? f.friend || "Friend" : f.who === "both" ? "Both of us" : "You";

  return (
    <div className="ae">
      {/* Header + stepper */}
      <div className="ae-head">
        <div className="ae-title">
          <button type="button" className="ae-back" onClick={() => go("Dashboard")} aria-label="Back">←</button>
          <div>
            <h1>Add Expense</h1>
            <p>Record an expense, split it with friends, set a reminder, and get it verified.</p>
          </div>
        </div>
        <div className="ae-steps">
          {[["Details"], ["Split"], ["Reminder"], ["Verify & Add"]].map(([label], i) => (
            <div key={label} className={"ae-step" + (step > i + 1 ? " done" : "") + (step === i + 1 ? " on" : "")}>
              <span>{step > i + 1 ? "✓" : i + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </div>

      {restored && (
        <div className="ae-note">
          Draft restored from this device.
          <button type="button" onClick={discardDraft}>Discard</button>
        </div>
      )}
      {notice && (
        <div className="ae-note">
          {notice}
          <button type="button" onClick={() => setNotice("")}>OK</button>
        </div>
      )}
      {done && (
        <div className="ae-note ok">
          Expense added ✅ {done.entry && done.entry.verification === "pending" ? `Waiting for ${done.friend} to approve.` : ""}
          {done.whatsapp && done.who !== "friend" && (
            <button type="button" onClick={remindNow}>Send reminder on WhatsApp</button>
          )}
          <button type="button" onClick={() => setDone(null)}>Dismiss</button>
        </div>
      )}

      {approvals.length > 0 && (
        <div className="ae-card ae-approve">
          <div className="ae-hd"><b>!</b><h3>Needs your approval</h3></div>
          <div className="ae-bd">
            {approvals.map((e) => (
              <div className="ae-ap" key={e.id}>
                <div>
                  <strong>{e.friend}</strong> says they paid for you
                  <div className="ae-sub">{e.note || "Expense"} · {rupee(e.amount)}</div>
                </div>
                <div className="ae-apb">
                  <button type="button" className="ae-ok" onClick={() => decide(e.id, true)}>Confirm</button>
                  <button type="button" className="ae-no" onClick={() => decide(e.id, false)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ae-grid">
        {/* 1. Expense details */}
        <div className="ae-card ae-c1">
          <div className="ae-hd"><b>1</b><h3>Expense Details</h3></div>
          <div className="ae-bd">
            <label className="ae-l">Who paid for this expense?</label>
            <div className="ae-who">
              {WHO.map(([k, t, s, ic]) => (
                <button key={k} type="button" className={f.who === k ? "on" : ""} onClick={() => set("who", k)}>
                  {f.who === k && <i>✓</i>}
                  <span className="ic">{ic}</span>
                  <strong>{t}</strong>
                  <small>{s}</small>
                </button>
              ))}
            </div>

            <label className="ae-l">Select Friend <em>*</em></label>
            <select value={f.friend} onChange={(e) => set("friend", e.target.value)}>
              <option value="">Choose a friend</option>
              {friends.map((x) => (
                <option key={x.id} value={x.name}>{x.name}</option>
              ))}
            </select>
            {friends.length === 0 && <p className="ae-hint">No friends yet. Add one in Friends first.</p>}

            <label className="ae-l">Expense Title <em>*</em></label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Dinner at Café" maxLength={60} />

            <label className="ae-l">Category <em>*</em></label>
            <select value={f.category} onChange={(e) => set("category", e.target.value)}>
              {CATS.map(([c, ic]) => (
                <option key={c} value={c}>{ic} {c}</option>
              ))}
            </select>

            <label className="ae-l">Description / Note <span>(Optional)</span></label>
            <textarea value={f.desc} onChange={(e) => set("desc", e.target.value.slice(0, 200))} rows={4} placeholder="Team dinner after class." />
            <div className="ae-cnt">{f.desc.length}/200</div>
          </div>
        </div>

        {/* 2. Payment + 3. Split */}
        <div className="ae-c2">
          <div className="ae-card">
            <div className="ae-hd"><b>2</b><h3>Payment &amp; Amount</h3></div>
            <div className="ae-bd">
              <label className="ae-l">Payment Method <em>*</em></label>
              <div className="ae-meth">
                {METHODS.map(([k, s, ic]) => (
                  <button key={k} type="button" className={f.method === k ? "on" : ""} onClick={() => set("method", k)}>
                    {f.method === k && <i>✓</i>}
                    <span className="ic">{ic}</span>
                    <strong>{k}</strong>
                    {s && <small>({s})</small>}
                  </button>
                ))}
              </div>

              <label className="ae-l">Amount <em>*</em></label>
              <div className="ae-amt"><span>₹</span>
                <input type="number" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="800" />
              </div>

              <label className="ae-l">Date of Payment <em>*</em></label>
              <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />

              <label className="ae-l">Transaction ID / Reference <span>(Optional)</span></label>
              <input value={f.ref} onChange={(e) => set("ref", e.target.value)} placeholder="UPI1234567890" />

              <label className="ae-l">Attach Receipt <span>(Optional)</span></label>
              <div className="ae-rc">
                {receipt && (
                  <div className="ae-thumb">
                    {receipt.url ? <img src={receipt.url} alt="Receipt" /> : <span>📄</span>}
                    <button type="button" onClick={() => setReceipt(null)} aria-label="Remove receipt">×</button>
                  </div>
                )}
                <label className="ae-add">
                  +<input type="file" accept="image/*,application/pdf" onChange={onFile} hidden />
                </label>
                <small>JPG, PNG or PDF (Max 5 MB). Kept on this device for now.</small>
              </div>
            </div>
          </div>

          <div className="ae-card">
            <div className="ae-hd"><b>3</b><h3>Split Expense</h3></div>
            <div className="ae-bd">
              <div className="ae-split">
                <button type="button" className={f.split === "equal" ? "on" : ""} onClick={() => set("split", "equal")}>
                  <span className="rd" /><div><strong>Split Equally</strong><small>({rupee(total / 2)} each)</small></div>
                </button>
                <button type="button" className={f.split === "custom" ? "on" : ""} onClick={() => set("split", "custom")}>
                  <span className="rd" /><div><strong>Custom Split</strong><small>(Set different amounts)</small></div>
                </button>
              </div>
              {f.split === "custom" && (
                <>
                  <label className="ae-l">{f.friend || "Friend"}&rsquo;s share (₹)</label>
                  <input type="number" inputMode="decimal" value={f.friendShare} onChange={(e) => set("friendShare", e.target.value)} placeholder={String(total / 2 || 0)} />
                </>
              )}
              <div className="ae-people">
                <b>People (2)</b>
                <div>
                  <span className="pv"><i>{(myName || "Y").charAt(0).toUpperCase()}</i>You<br /><em>{rupee(myShare)}</em></span>
                  <span className="pv"><i>{(f.friend || "F").charAt(0).toUpperCase()}</i>{f.friend || "Friend"}<br /><em>{rupee(friendShare)}</em></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Reminder + verification */}
        <div className="ae-card ae-c3">
          <div className="ae-hd"><b>4</b><h3>Reminder &amp; Verification</h3></div>
          <div className="ae-bd">
            <div className="ae-row"><strong>Add Payment Reminder</strong><Switch on={f.remind} onChange={(v) => set("remind", v)} /></div>
            {f.remind && (
              <>
                <label className="ae-l">Reminder Date <em>*</em></label>
                <input type="date" value={f.remindDate} onChange={(e) => set("remindDate", e.target.value)} />

                <label className="ae-l">Remind via</label>
                <div className="ae-via">
                  {VIA.map(([k, t, s, ic]) => (
                    <button key={k} type="button" onClick={() => toggleVia(k)}>
                      <span className="ic">{ic}</span>
                      <span><strong>{t}</strong> {s && <small>{s}</small>}</span>
                      <span className={"ck" + (f.via.includes(k) ? " on" : "")}>{f.via.includes(k) ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="ae-row" style={{ marginTop: 22 }}><strong>Send for Verification</strong><Switch on={f.verify} onChange={(v) => set("verify", v)} /></div>
            <p className="ae-hint">
              {f.verify
                ? linked
                  ? `Ask ${f.friend} to confirm that this payment was made.`
                  : f.friend
                  ? `${f.friend} is not linked on SplitPay, so they cannot verify in the app. Use a WhatsApp reminder.`
                  : "Choose a friend to see how verification works."
                : "The expense will be added to balances right away."}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="ae-side">
          <div className="ae-card">
            <div className="ae-hd"><h3>Expense Summary</h3></div>
            <div className="ae-bd">
              <div className="ae-sum-top">
                <span className="ic">{catIcon}</span>
                <div>
                  <strong>{f.title.trim() || "Expense title"}</strong>
                  <div className="ae-sub">{f.category}</div>
                  <span className="chip">{verifying ? "⏳ Pending Verification" : "Ready to add"}</span>
                </div>
              </div>
              <dl className="ae-dl">
                <dt>Paid By</dt><dd>{paidByLabel}</dd>
                <dt>For</dt><dd>{f.friend || "-"}</dd>
                <dt>Amount</dt><dd>{rupee(total)}</dd>
                <dt>Payment Method</dt><dd>{f.method}</dd>
                <dt>Date</dt><dd>{longDate(f.date)}</dd>
                <dt>Reminder</dt><dd>{f.remind ? longDate(f.remindDate) : "Off"}</dd>
              </dl>
            </div>
          </div>

          <div className="ae-card">
            <div className="ae-hd"><h3>Verification Flow</h3></div>
            <div className="ae-bd">
              <ol className="ae-flow">
                <li className="on"><i /><div><strong>Expense Created</strong><small>{longDate(f.date)}</small></div></li>
                <li className={verifying ? "on" : ""}><i /><div><strong>Verification Pending</strong><small>{verifying ? `Waiting for ${f.friend}'s approval` : "Skipped"}</small></div></li>
                <li><i /><div><strong>Verified &amp; Added</strong><small>Will be added to balances after approval</small></div></li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="ae-foot">
        <button type="button" className="ae-draft" onClick={saveDraft}>🗒️ Save as Draft</button>
        <button type="button" className="ae-send" disabled={busy} onClick={save}>
          {busy ? "Saving..." : verifying ? "Send for Verification" : "Add Expense"}
        </button>
      </div>
    </div>
  );
}

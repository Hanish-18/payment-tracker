import { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  useLedger, rupee, friendBalance, categoryOf, CAT_ICON, todayLocal, inDays, fmtShort, fmtLong,
  first, waLink, reminderText, Avatar, Head, BalanceText, Err,
} from "./spkit";

const sum = (list) => list.reduce((s, e) => s + Number(e.amount), 0);

function FriendList({ names, entries, reload, onBack, onPick, setErr, onManage }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("all");
  const [adding, setAdding] = useState(false);
  const [nn, setNn] = useState("");
  const [np, setNp] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = names
    .map((n) => ({ name: n, net: friendBalance(entries, n) }))
    .filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((r) => chip === "all" || (chip === "owe" && r.net < 0) || (chip === "get" && r.net > 0))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));

  async function add(e) {
    e.preventDefault();
    const n = nn.trim();
    if (!n) return;
    setBusy(true);
    const { error } = await supabase.from("friends").insert({ name: n, phone: np.trim() || null });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setErr("");
    setNn("");
    setNp("");
    setAdding(false);
    await reload();
  }

  return (
    <>
      <Head title="Friends" onBack={onBack} />
      <div className="kt-search">
        <input className="kt-input" placeholder="Search friend" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="kt-fab" onClick={() => setAdding(true)} aria-label="Add friend">＋</button>
      </div>
      <div className="kt-chips">
        {[["all", "All Friends"], ["owe", "You Owe"], ["get", "Owe You"]].map(([id, label]) => (
          <button key={id} className={"kt-chip" + (chip === id ? " on" : "")} onClick={() => setChip(id)}>{label}</button>
        ))}
      </div>
      {onManage && (
        <button className="kt-linkbtn" onClick={onManage}>🔗 Connect with friends (ID, QR or invite code)</button>
      )}
      <div className="kt-list">
        {rows.length === 0 && <p className="kt-muted" style={{ padding: 18 }}>No friends found.</p>}
        {rows.map((r) => (
          <button key={r.name} className="kt-row" onClick={() => onPick(r.name)}>
            <Avatar name={r.name} />
            <div className="kt-grow">
              <div className="kt-name">{r.name}</div>
              <BalanceText net={r.net} />
            </div>
            <span className="kt-chev">›</span>
          </button>
        ))}
      </div>

      {adding && (
        <>
          <div className="kt-sheet-bg" onClick={() => setAdding(false)} />
          <form className="kt-sheet" onSubmit={add}>
            <div className="kt-sec">Add a friend</div>
            <div className="kt-label">Name</div>
            <div className="kt-field"><input value={nn} onChange={(e) => setNn(e.target.value)} placeholder="Friend's name" /></div>
            <div className="kt-label">WhatsApp number (optional)</div>
            <div className="kt-field"><input inputMode="tel" value={np} onChange={(e) => setNp(e.target.value)} placeholder="9876543210" /></div>
            <div className="kt-stack" style={{ marginTop: 16 }}>
              <button className="kt-btn primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Add Friend"}</button>
            </div>
          </form>
        </>
      )}
    </>
  );
}

function FriendDetail({ name, entries, onBack, onAdd, onSettle }) {
  const [tab, setTab] = useState("history");
  const list = entries.filter((e) => e.friend === name);
  const net = friendBalance(entries, name);
  const youPaid = sum(list.filter((e) => e.paid_by === "me"));
  const theyPaid = sum(list.filter((e) => e.paid_by === "friend"));

  return (
    <>
      <Head title="" onBack={onBack} />
      <div className="kt-hero">
        <Avatar name={name} size={78} />
        <div className="kt-hname">{name}</div>
        <span className={"kt-pill " + (net > 0 ? "get" : net < 0 ? "owe" : "set")}>
          {net > 0 ? `You get ${rupee(net)}` : net < 0 ? `You owe ${rupee(-net)}` : "Settled"}
        </span>
      </div>

      <div className="kt-tabs">
        <button className={"kt-tab" + (tab === "history" ? " on" : "")} onClick={() => setTab("history")}>History</button>
        <button className={"kt-tab" + (tab === "summary" ? " on" : "")} onClick={() => setTab("summary")}>Summary</button>
      </div>

      {tab === "history" ? (
        <>
          <div className="kt-sec">Payment History</div>
          <div className="kt-list">
            {list.length === 0 && <p className="kt-muted" style={{ padding: 18 }}>No payments with {name} yet.</p>}
            {list.map((e) => (
              <div className={"kt-h" + (e.status === "Settled" ? " done" : "")} key={e.id}>
                <span className="kt-ico">{CAT_ICON[categoryOf(e.note)]}</span>
                <div className="kt-grow">
                  <div className="kt-name">{e.note || `${e.mode} payment`}</div>
                  <div className="kt-meta">
                    {e.paid_by === "me" ? "You paid" : `${first(name)} paid`} · {fmtShort(e.payment_date)}
                    {e.status === "Settled" ? " · Settled" : ""}
                  </div>
                </div>
                <div className={e.paid_by === "me" ? "kt-plus" : "kt-minus"}>
                  {e.paid_by === "me" ? "+" : "−"}{rupee(e.amount)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="kt-card">
          <div className="kt-kv"><span>You paid for {first(name)}</span><b>{rupee(youPaid)}</b></div>
          <div className="kt-kv"><span>{first(name)} paid for you</span><b>{rupee(theyPaid)}</b></div>
          <div className="kt-kv"><span>Payments</span><b>{list.length}</b></div>
          <div className="kt-kv"><span>Pending balance</span><b>{net === 0 ? "Settled" : net > 0 ? `${first(name)} owes ${rupee(net)}` : `You owe ${rupee(-net)}`}</b></div>
        </div>
      )}

      <div className="kt-actions">
        <div className="kt-actions-in">
          <button className="kt-btn outline" onClick={onAdd}>＋ Add Expense</button>
          <button className="kt-btn primary" onClick={onSettle}>➤ Settle Now</button>
        </div>
      </div>
    </>
  );
}

function AddExpense({ name, friendRow, reload, onBack, setErr }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [paidBy, setPaidBy] = useState("me");
  const [mode, setMode] = useState("UPI");
  const [remind, setRemind] = useState(true);
  const [due, setDue] = useState(inDays(7));
  const [channel, setChannel] = useState("whatsapp");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const amt = Number(amount);

  function back() {
    if (step === 1 || step === 4) onBack();
    else setStep(step - 1);
  }
  function next1() {
    if (!title.trim()) return setErr("Enter what the expense was for.");
    if (!(amt > 0)) return setErr("Enter an amount above 0.");
    setErr("");
    setStep(2);
  }
  function next2() {
    if (paidBy === "me") setStep(3);
    else save();
  }
  async function save() {
    setBusy(true);
    setErr("");
    const row = {
      friend: name, amount: amt, note: title.trim(), mode, paid_by: paidBy, payment_date: date,
      due_date: paidBy === "me" && remind ? due : null,
    };
    const { error } = await supabase.from("entries").insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    await reload();
    setSaved({ ...row, remind: paidBy === "me" && remind, channel });
    setStep(4);
  }
  function sendReminder() {
    const text = reminderText({ name, amount: saved.amount, title: saved.note, due: saved.due_date });
    if (saved.channel === "whatsapp") window.open(waLink(friendRow && friendRow.phone, text), "_blank");
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      setErr("Reminder text copied. Paste it in any app.");
    }
  }
  function another() {
    setTitle("");
    setAmount("");
    setSaved(null);
    setErr("");
    setStep(1);
  }

  return (
    <>
      <Head title={step === 2 ? "Payment Method" : step === 3 ? "Set Reminder" : step === 4 ? "" : "Add Expense"} onBack={back} />

      {step === 1 && (
        <>
          <div className="kt-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={name} size={44} />
            <div>
              <div className="kt-meta">Adding expense for</div>
              <div className="kt-name">{name}</div>
            </div>
          </div>
          <div className="kt-label">Expense Title</div>
          <div className="kt-field"><span>🍴</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Cafe" /></div>
          <div className="kt-label">Amount (₹)</div>
          <div className="kt-field"><span>₹</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="600" /></div>
          <div className="kt-label">Date</div>
          <div className="kt-field"><span>📅</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="kt-label">Who paid?</div>
          <div className="kt-seg">
            <button className={paidBy === "me" ? "on" : ""} onClick={() => setPaidBy("me")}>You paid</button>
            <button className={paidBy === "friend" ? "on" : ""} onClick={() => setPaidBy("friend")}>{first(name)} paid</button>
          </div>
          <div className="kt-actions"><div className="kt-actions-in"><button className="kt-btn primary" onClick={next1}>Next →</button></div></div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="kt-sec">How did you pay for this expense?</div>
          {[["UPI", "UPI Payment", "📲"], ["Card", "Card Payment", "💳"], ["Cash", "Cash Payment", "💵"]].map(([id, label, ico]) => (
            <button key={id} className={"kt-opt" + (mode === id ? " on" : "")} onClick={() => setMode(id)}>
              <span className="kt-opt-ico">{ico}</span>{label}
              {mode === id ? <span className="kt-check">✓</span> : <span className="kt-radio" />}
            </button>
          ))}
          <div className="kt-actions"><div className="kt-actions-in"><button className="kt-btn primary" onClick={next2} disabled={busy}>{paidBy === "me" ? "Continue" : busy ? "Saving..." : "Add Expense"}</button></div></div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="kt-planeic">🔔</div>
          <div className="kt-big">Remind {name} to pay you</div>
          <div className="kt-card kt-togrow">
            <div className="kt-grow">Add Reminder</div>
            <button className={"kt-switch" + (remind ? " on" : "")} onClick={() => setRemind(!remind)} aria-label="Toggle reminder" />
          </div>
          {remind && (
            <>
              <div className="kt-label">Due Date</div>
              <div className="kt-field"><span>📅</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
              <div className="kt-label">Reminder Channel</div>
              {[["whatsapp", "WhatsApp", "💬"], ["other", "Other App", "📤"]].map(([id, label, ico]) => (
                <button key={id} className={"kt-opt" + (channel === id ? " on" : "")} onClick={() => setChannel(id)}>
                  <span className="kt-opt-ico">{ico}</span>{label}
                  {channel === id ? <span className="kt-check">✓</span> : <span className="kt-radio" />}
                </button>
              ))}
            </>
          )}
          <div className="kt-actions"><div className="kt-actions-in"><button className="kt-btn primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Add Expense"}</button></div></div>
        </>
      )}

      {step === 4 && saved && (
        <>
          <div className="kt-ok">✓</div>
          <div className="kt-big">Expense Added!</div>
          <p className="kt-center kt-muted">{rupee(saved.amount)} has been added for {name}.</p>
          <div className="kt-card">
            <div className="kt-kv"><span>{saved.note}</span><b>{rupee(saved.amount)}</b></div>
            <div className="kt-kv"><span>Paid by</span><b>{saved.paid_by === "me" ? "You" : name}</b></div>
            <div className="kt-kv"><span>Payment Method</span><b>{saved.mode}</b></div>
            <div className="kt-kv"><span>Date</span><b>{fmtLong(saved.payment_date)}</b></div>
            {saved.due_date && <div className="kt-kv"><span>Reminder</span><b>{fmtLong(saved.due_date)}</b></div>}
          </div>
          <div className="kt-stack">
            {saved.remind && (
              <button className="kt-btn wa" onClick={sendReminder}>
                {saved.channel === "whatsapp" ? "💬 Send Reminder on WhatsApp" : "📤 Share Reminder"}
              </button>
            )}
            <button className="kt-btn outline" onClick={another}>Add Another Expense</button>
            <button className="kt-btn outline" onClick={onBack}>Back to {first(name)}</button>
          </div>
        </>
      )}
    </>
  );
}

export default function FriendsScreen({ goto, onBack, param, manage, sync }) {
  const { entries, friends, loading, error, reload } = useLedger(sync);
  const [view, setView] = useState(param && param.friend ? "detail" : "list");
  const [name, setName] = useState(param && param.friend ? param.friend : "");
  const [err, setErr] = useState("");

  const names = useMemo(() => {
    const set = new Set(friends.map((f) => f.name));
    entries.forEach((e) => set.add(e.friend));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [friends, entries]);
  const friendRow = friends.find((f) => f.name === name);

  if (loading) return <p className="kt-muted">Loading...</p>;

  return (
    <>
      <Err text={err || error} />
      {view === "list" && (
        <FriendList names={names} entries={entries} reload={reload} onBack={onBack} setErr={setErr}
          onManage={manage ? () => setView("manage") : null}
          onPick={(n) => { setName(n); setErr(""); setView("detail"); }} />
      )}
      {view === "manage" && (
        <>
          <Head title="Connect friends" onBack={() => { setView("list"); reload(); }} />
          {manage}
        </>
      )}
      {view === "detail" && (
        <FriendDetail name={name} entries={entries} onBack={() => setView("list")}
          onAdd={() => { setErr(""); setView("add"); }} onSettle={() => goto("settle", { friend: name })} />
      )}
      {view === "add" && (
        <AddExpense name={name} friendRow={friendRow} reload={reload} setErr={setErr} onBack={() => { setErr(""); setView("detail"); }} />
      )}
    </>
  );
}
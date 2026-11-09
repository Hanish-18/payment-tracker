/* Phone "Friends" flow (matches the mockup):
   Friends list -> Friend detail (history, summary, Settle Now, Add Expense)
   Add Expense -> Payment Method -> Set Reminder -> Expense Added (send WhatsApp reminder) */
import { useState } from "react";
import "./mobile-friends-analytics.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";
import MobileUdhaar from "./MobileUdhaar";

const money = (n) => "₹" + Math.abs(Number(n)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const sum = (l) => l.reduce((s, e) => s + Number(e.amount), 0);
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayStr = () => iso(new Date());
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const day = (x) => new Date(String(x).slice(0, 10) + "T00:00:00");
const fdate = (x) => day(x).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fdateY = (x) => day(x).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  adduser: (<><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M19 7v6M16 10h6" /></>),
  chev: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  send: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  card: (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></>),
  cash: (<><rect x="2.5" y="6" width="19" height="12" rx="3" /><circle cx="12" cy="12" r="2.6" /></>),
  cal: (<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  chat: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />,
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  food: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11" />,
  plane: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  fuel: (<><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M15 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V9l-3-3" /><path d="M7.5 8h5" /></>),
  cart: (<><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>),
  ticket: (<><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z" /><path d="M13 6v12" /></>),
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

const cleanTitle = (note, mode) => {
  let t = String(note || "").trim();
  t = t.replace(/^(Food|Travel|Stay|Transport|Other) · /, "");
  t = t.replace(/^split:\s*/i, "");
  t = t.replace(/\s*\(\d+ people\).*$/i, "");
  return t || mode || "Payment";
};
const iconFor = (t) =>
  /dinner|lunch|breakfast|cafe|chai|tea|coffee|food|pizza|meal|snack|biryani|burger/i.test(t) ? "food"
  : /trip|travel|flight|train|bus|tour/i.test(t) ? "plane"
  : /movie|ticket|show/i.test(t) ? "ticket"
  : /fuel|petrol|diesel|cab|uber|ola|auto|taxi|airport/i.test(t) ? "fuel"
  : "cart";
const toneFor = (ic) => ({ food: "blue", plane: "violet", ticket: "violet", fuel: "blue", cart: "green" }[ic]);

const balanceOf = (name, entries) => {
  const open = entries.filter((e) => e.friend === name && e.status !== "Settled");
  return sum(open.filter((e) => e.paid_by === "me")) - sum(open.filter((e) => e.paid_by === "friend"));
};

function Avatar({ name, size = 48 }) {
  return (
    <i className="fr-av" style={{ background: hue(name), width: size, height: size, fontSize: size * 0.34 }}>{ini(name)}</i>
  );
}

function waLink(phone, text) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
async function shareText(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    alert("Reminder copied. Paste it in any app.");
  } catch (e) { /* cancelled */ }
}

/* ============================ Friend detail ============================ */
function Detail({ f, entries, friends, udhaar, onBack, go, reload, setError, myId }) {
  const first = f.name.split(" ")[0];
  const [tab, setTab] = useState("history");
  const [view, setView] = useState("main");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (view === "add") {
    return (
      <MobileUdhaar
        friends={friends}
        udhaar={udhaar}
        myId={myId}
        reload={reload}
        setError={setError}
        go={go}
        presetFriendId={f.id}
        onClose={() => setView("main")}
      />
    );
  }

  const list = entries.filter((e) => e.friend === f.name);
  const net = balanceOf(f.name, entries);
  const open = list.filter((e) => e.status !== "Settled");
  const iPaid = list.filter((e) => e.paid_by === "me");
  const theyPaid = list.filter((e) => e.paid_by === "friend");

  async function markSettled() {
    setMsg("");
    const ids = open.map((e) => e.id);
    if (ids.length === 0) { setSheet(false); return; }
    setBusy(true);
    const { data, error } = await supabase.from("entries").update({ status: "Settled" }).in("id", ids).select("id");
    setBusy(false);
    if (error) { setError(error.message); setMsg(error.message); return; }
    setError("");
    const n = data ? data.length : 0;
    reload();
    if (n === ids.length) { setSheet(false); setMsg(""); }
    else setMsg(`${n} of ${ids.length} marked as settled. The rest were added by ${f.name}, so only they can settle them.`);
  }

  function remindNow() {
    const text = `Hi ${first}, a quick reminder: you owe me ${money(net)} on SplitPay. Please pay when you can. Thanks!`;
    window.open(waLink(f.phone, text), "_blank");
  }

  return (
    <div className="fr fr-pad">
      <div className="fr-bar">
        <button type="button" className="fr-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2 />
        <span className="fr-ib ghost" />
      </div>

      <div className="fr-hero">
        <Avatar name={f.name} size={76} />
        <h1>{f.name}</h1>
        <span className={"fr-chip " + (net > 0 ? "pos" : net < 0 ? "neg" : "")}>
          {net > 0 ? `You get ${money(net)}` : net < 0 ? `You owe ${money(net)}` : "All settled"}
        </span>
      </div>

      <div className="fr-tabs">
        <button type="button" className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>History</button>
        <button type="button" className={tab === "summary" ? "on" : ""} onClick={() => setTab("summary")}>Summary</button>
      </div>

      {tab === "history" ? (
        <>
          <h3 className="fr-h3">Payment History</h3>
          {list.length === 0 ? (
            <div className="fr-empty"><b>No payments with {first} yet</b><p>Tap Add Expense to record the first one.</p></div>
          ) : (
            <div className="fr-hist">
              {list.map((e) => {
                const title = cleanTitle(e.note, e.mode);
                const ic = iconFor(title);
                const mine = e.paid_by === "me";
                const settled = e.status === "Settled";
                return (
                  <div className={"fr-h" + (settled ? " done" : "")} key={e.id}>
                    <span className={"fr-ic " + toneFor(ic)}><Ic n={ic} s={22} /></span>
                    <span className="fr-hm">
                      <b>{title}</b>
                      <small>{mine ? "You paid" : `${first} paid`} · {fdate(e.payment_date || e.created_at)}{settled ? " · Settled" : ""}</small>
                    </span>
                    <b className={"fr-amt " + (mine ? "pos" : "neg")}>{mine ? "+" : "−"}{money(e.amount)}</b>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <h3 className="fr-h3">Summary</h3>
          <div className="fr-stats">
            <div className="pos"><small>You paid for {first}</small><b>{money(sum(iPaid))}</b></div>
            <div className="neg"><small>{first} paid for you</small><b>{money(sum(theyPaid))}</b></div>
            <div><small>Pending payments</small><b>{open.length}</b></div>
            <div><small>Settled payments</small><b>{list.length - open.length}</b></div>
          </div>
          <div className="fr-card fr-now">
            <small>Right now</small>
            <b>{net > 0 ? `${f.name} owes you ${money(net)}` : net < 0 ? `You owe ${f.name} ${money(net)}` : "You are all settled up"}</b>
          </div>
        </>
      )}

      <div className="fr-dock">
        <button type="button" className="fr-out" onClick={() => setView("add")}><Ic n="plus" s={18} /> Add Expense</button>
        <button type="button" className="fr-fill" onClick={() => { setMsg(""); setSheet(true); }} disabled={open.length === 0}>
          <Ic n="send" s={18} /> {open.length === 0 ? "All Settled" : "Settle Now"}
        </button>
      </div>

      {sheet && (
        <div className="fr-sheet-bg" onClick={() => !busy && setSheet(false)}>
          <div className="fr-sheet" role="dialog" aria-label={`Settle with ${f.name}`} onClick={(e) => e.stopPropagation()}>
            <h3>Settle with {f.name}</h3>
            <p>{net > 0 ? `${first} owes you ${money(net)}` : net < 0 ? `You owe ${first} ${money(net)}` : "Nothing is pending."}</p>
            {net < 0 && <button type="button" className="fr-cta" onClick={() => go("Settlements")}>Pay {money(net)} now</button>}
            {net > 0 && <button type="button" className="fr-wa" onClick={remindNow}><Ic n="chat" s={20} /> Remind on WhatsApp</button>}
            <button type="button" className="fr-out wide" onClick={markSettled} disabled={busy}>
              {busy ? "Saving..." : net > 0 ? `Mark ${money(net)} as received` : "Mark everything as settled"}
            </button>
            {msg && <p className="fr-err" role="alert">{msg}</p>}
            <button type="button" className="fr-link" onClick={() => setSheet(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Friends list ============================ */
export default function MobileFriends({ entries, friends, udhaar = [], go, reload, setError, myId }) {
  const [selId, setSelId] = useState(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  const sel = friends.find((x) => x.id === selId);
  if (sel) {
    return <Detail f={sel} entries={entries} friends={friends} udhaar={udhaar} go={go} reload={reload} setError={setError} myId={myId} onBack={() => setSelId(null)} />;
  }

  const rows = friends
    .map((f) => ({ f, net: balanceOf(f.name, entries) }))
    .filter((r) => r.f.name.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((r) => (tab === "owe" ? r.net < 0 : tab === "get" ? r.net > 0 : true))
    .sort((a, b) => (a.net === 0) - (b.net === 0) || Math.abs(b.net) - Math.abs(a.net));

  const tabs = [["all", "All Friends"], ["owe", "You Owe"], ["get", "Owe You"]];

  return (
    <div className="fr fr-pad">
      <div className="fr-bar">
        <button type="button" className="fr-ib" onClick={() => go("Dashboard")} aria-label="Back"><Ic n="back" /></button>
        <h2>Friends</h2>
        <span className="fr-ib ghost" />
      </div>

      <div className="fr-searchrow">
        <label className="fr-search">
          <Ic n="search" s={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friend" aria-label="Search friend" />
        </label>
        <button type="button" className="fr-addf" onClick={() => go("Groups")} aria-label="Add a friend"><Ic n="adduser" s={22} /></button>
      </div>

      <div className="fr-tabs3" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {friends.length === 0 ? (
        <div className="fr-empty"><b>No friends yet</b><p>Tap the add friend button to connect with someone.</p></div>
      ) : rows.length === 0 ? (
        <div className="fr-empty"><b>No friends here</b><p>Try a different search or filter.</p></div>
      ) : (
        <div className="fr-list">
          {rows.map(({ f, net }) => (
            <button type="button" className="fr-item" key={f.id} onClick={() => setSelId(f.id)}>
              <Avatar name={f.name} size={50} />
              <span className="fr-im">
                <b>{f.name}</b>
                <small className={net > 0 ? "pos" : net < 0 ? "neg" : ""}>
                  {net > 0 ? `You get ${money(net)}` : net < 0 ? `You owe ${money(net)}` : "Settled"}
                </small>
              </span>
              <Ic n="chev" s={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

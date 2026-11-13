/* Friends screen (matches the mockup): Your Friends on SplitPay, tiles, All Friends / Mutuals / Requests, balances. */
import { useEffect, useState } from "react";
import "./mobile-friendsv2.css";
import { supabase } from "./supabaseClient";
import MobileAddFriends from "./MobileAddFriends";
import { hue, ini } from "./DesktopHome";

const money = (n) => "₹" + Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-IN");
const dshort = (s) => new Date(String(s).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const P = {
  back: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  scan: <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />,
  addf: (<><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6" /><path d="M19 8v6M16 11h6" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><path d="M14 14h2v2h-2zM18 18h2M18 14h2" /></>),
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  chev: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chat: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />,
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
  );
}

export default function MobileFriendsV2({ friends = [], entries = [], reload, setError, go }) {
  const [view, setView] = useState({ t: "list" });
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [uid, setUid] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [conns, setConns] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const u = await supabase.auth.getUser();
    setUid(u.data && u.data.user ? u.data.user.id : null);
    const [p, c] = await Promise.all([
      supabase.from("profiles").select("id, name, friend_code"),
      supabase.from("connections").select("*"),
    ]);
    if (p.data) setProfiles(p.data);
    if (c.data) setConns(c.data);
  }
  useEffect(() => { load(); }, []);

  const refresh = () => { if (reload) reload(); load(); };
  const nameOf = (id) => (profiles.find((x) => x.id === id) || {}).name || "Someone";
  const incoming = conns.filter((c) => c.status === "pending" && c.addressee === uid);
  const outgoing = conns.filter((c) => c.status === "pending" && c.requester === uid);

  const bal = (f) => {
    const open = entries.filter((e) => e.friend === f.name && e.status !== "Settled");
    const get = open.filter((e) => e.paid_by === "me").reduce((s, e) => s + Number(e.amount), 0);
    const owe = open.filter((e) => e.paid_by === "friend").reduce((s, e) => s + Number(e.amount), 0);
    return get - owe;
  };
  const handle = (f) => {
    if (f.linked_user_id) {
      const p = profiles.find((x) => x.id === f.linked_user_id);
      return p && p.friend_code ? "@" + String(p.friend_code).toLowerCase() : "On SplitPay";
    }
    return f.phone ? f.phone : "Not on SplitPay yet";
  };

  const term = q.trim().toLowerCase();
  const all = friends.filter((f) => !term || f.name.toLowerCase().includes(term) || handle(f).toLowerCase().includes(term));
  const shown = tab === "mutuals" ? all.filter((f) => f.linked_user_id) : all;

  async function respond(id, accept) {
    const { data, error } = await supabase.rpc("respond_friend_request", { p_id: id, p_accept: accept });
    if (error) { setMsg(error.message); return; }
    setMsg(String(data));
    refresh();
  }

  /* ---------------- Add Friends screen ---------------- */
  if (view.t === "add") {
    return (
      <MobileAddFriends
        key={view.tab}
        initialTab={view.tab}
        friends={friends}
        reload={refresh}
        setError={setError || (() => {})}
        onBack={() => { setView({ t: "list" }); load(); }}
      />
    );
  }

  /* ---------------- Friend detail ---------------- */
  if (view.t === "detail") {
    const f = friends.find((x) => x.id === view.id);
    if (!f) { setView({ t: "list" }); return null; }
    const list = entries.filter((e) => e.friend === f.name);
    const net = bal(f);
    const phone = String(f.phone || "").replace(/\D/g, "");
    const wa = phone ? `https://wa.me/${phone.length === 10 ? "91" + phone : phone}?text=${encodeURIComponent(`Hi ${f.name.split(" ")[0]}, a reminder from SplitPay: you owe me ${money(net)}.`)}` : "";
    async function remove() {
      if (!window.confirm(`Remove ${f.name} from your friends?`)) return;
      const { error } = await supabase.from("friends").delete().eq("id", f.id);
      if (error) { setMsg(error.message); return; }
      setView({ t: "list" });
      refresh();
    }
    return (
      <div className="ff">
        <div className="ff-bar">
          <button type="button" className="ff-ib" onClick={() => setView({ t: "list" })} aria-label="Back"><Ic n="back" /></button>
          <span className="ff-ib ghost" />
        </div>
        <div className="ff-dhead">
          <i className="ff-av big" style={{ background: hue(f.name) }}>{ini(f.name)}</i>
          <h1>{f.name}</h1>
          <p>{handle(f)}</p>
          <span className={"ff-chip " + (net > 0 ? "get" : net < 0 ? "owe" : "ok")}>
            {net > 0 ? <><small>You get</small><b>{money(net)}</b></> : net < 0 ? <><small>You owe</small><b>{money(net)}</b></> : <>Settled <Ic n="check" s={16} /></>}
          </span>
          {net > 0 && wa && (
            <a className="ff-wa" href={wa} target="_blank" rel="noreferrer"><Ic n="chat" s={20} /> Remind on WhatsApp</a>
          )}
        </div>

        <h2 className="ff-h2">Expenses</h2>
        {list.length === 0 && <p className="ff-empty">No expenses with {f.name} yet.</p>}
        <div className="ff-list">
          {list.map((e) => (
            <div className="ff-row static" key={e.id}>
              <span className="ff-mid">
                <b>{String(e.note || e.mode || "Payment").replace(/^split:\s*/i, "")}</b>
                <small>{e.paid_by === "me" ? "You paid" : `${f.name} paid`} · {dshort(e.payment_date || e.created_at)}</small>
              </span>
              <span className="ff-end">
                <b className={e.status === "Settled" ? "mut" : e.paid_by === "me" ? "pos" : "neg"}>{money(e.amount)}</b>
                <small>{e.status === "Settled" ? "Settled" : "Pending"}</small>
              </span>
            </div>
          ))}
        </div>
        {msg && <p className="ff-err">{msg}</p>}
        <button type="button" className="ff-remove" onClick={remove}>Remove friend</button>
      </div>
    );
  }

  /* ---------------- Friends list ---------------- */
  const tiles = [
    ["addf", "Add Friend", "contacts", "blue"],
    ["qr", "Scan QR", "qr", "violet"],
    ["code", "Invite Code", "invite", "green"],
    ["link", "Share Link", "share", "orange"],
  ];

  return (
    <div className="ff">
      <div className="ff-top">
        <span className="ff-brand"><i>S</i>SplitPay</span>
        <span className="ff-topbtns">
          <button type="button" className="ff-ib" onClick={() => setTab("requests")} aria-label="Requests">
            <Ic n="bell" />{incoming.length > 0 && <u />}
          </button>
          <button type="button" className="ff-ib primary" onClick={() => setView({ t: "add", tab: "contacts" })} aria-label="Add friend"><Ic n="plus" /></button>
        </span>
      </div>

      <div className="ff-hero">
        <div>
          <small>Friends</small>
          <h1>Your Friends on SplitPay</h1>
          <p>Connect, split, and settle expenses easily.</p>
        </div>
        <svg viewBox="0 0 120 100" aria-hidden="true">
          <circle cx="38" cy="30" r="14" fill="#3b82ff" /><path d="M12 82c0-20 11-30 26-30s26 10 26 30z" fill="#3b82ff" />
          <circle cx="76" cy="24" r="17" fill="#6ea0ff" /><path d="M44 86c0-25 14-38 32-38s32 13 32 38z" fill="#2f74ff" />
        </svg>
      </div>

      <label className="ff-search">
        <Ic n="search" s={22} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends by name or @SplitPay ID" aria-label="Search friends" />
        <button type="button" onClick={() => setView({ t: "add", tab: "qr" })} aria-label="Scan QR"><Ic n="scan" s={24} /></button>
      </label>

      <div className="ff-tiles">
        {tiles.map(([ic, label, to, color]) => (
          <button key={label} type="button" className={"ff-tile " + color} onClick={() => setView({ t: "add", tab: to })}>
            <Ic n={ic} s={30} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="ff-tabs">
        <button type="button" className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>All Friends</button>
        <button type="button" className={tab === "mutuals" ? "on" : ""} onClick={() => setTab("mutuals")}>Mutuals</button>
        <button type="button" className={tab === "requests" ? "on" : ""} onClick={() => setTab("requests")}>
          Requests {incoming.length > 0 && <u>{incoming.length}</u>}
        </button>
      </div>

      {msg && <div className="ff-note"><span>{msg}</span><button type="button" onClick={() => setMsg("")}>OK</button></div>}

      {tab !== "requests" && (
        <>
          {shown.length === 0 && (
            <p className="ff-empty">
              {friends.length === 0 ? "No friends yet. Tap Add Friend to invite someone." : tab === "mutuals" ? "None of your friends are linked on SplitPay yet." : "Nothing found."}
            </p>
          )}
          <div className="ff-list">
            {shown.map((f) => {
              const net = bal(f);
              return (
                <button type="button" className="ff-row" key={f.id} onClick={() => setView({ t: "detail", id: f.id })}>
                  <i className="ff-av" style={{ background: hue(f.name) }}>{ini(f.name)}</i>
                  <span className="ff-mid"><b>{f.name}</b><small>{handle(f)}</small></span>
                  <span className={"ff-chip " + (net > 0 ? "get" : net < 0 ? "owe" : "ok")}>
                    {net > 0 ? <><small>You get</small><b>{money(net)}</b></> : net < 0 ? <><small>You owe</small><b>{money(net)}</b></> : <>Settled <Ic n="check" s={16} /></>}
                  </span>
                  <Ic n="chev" s={18} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "requests" && (
        <div className="ff-list">
          {incoming.length === 0 && outgoing.length === 0 && <p className="ff-empty">No pending requests.</p>}
          {incoming.map((c) => (
            <div className="ff-row static" key={c.id}>
              <i className="ff-av" style={{ background: hue(nameOf(c.requester)) }}>{ini(nameOf(c.requester))}</i>
              <span className="ff-mid"><b>{nameOf(c.requester)}</b><small>wants to be your friend</small></span>
              <button type="button" className="ff-yes" onClick={() => respond(c.id, true)}>Accept</button>
              <button type="button" className="ff-no" onClick={() => respond(c.id, false)}>Decline</button>
            </div>
          ))}
          {outgoing.map((c) => (
            <div className="ff-row static" key={c.id}>
              <i className="ff-av" style={{ background: hue(nameOf(c.addressee)) }}>{ini(nameOf(c.addressee))}</i>
              <span className="ff-mid"><b>{nameOf(c.addressee)}</b><small>Waiting for them to accept</small></span>
              <em className="ff-pend">Pending</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

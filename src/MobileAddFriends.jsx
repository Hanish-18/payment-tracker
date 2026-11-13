/* Add Friends screen (matches the mockup). Uses your existing Invite Code and QR code tools inside the new design. */
import { useEffect, useState } from "react";
import "./mobile-addfriends.css";
import { supabase } from "./supabaseClient";
import InviteClaim from "./InviteClaim";
import FriendScan from "./FriendScan";
import { hue, ini } from "./DesktopHome";

const P = {
  back: <path d="M15 5l-7 7 7 7" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  invite: (<><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6" /><path d="M19 8v6M16 11h6" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><path d="M14 14h2v2h-2zM18 18h2M18 14h2" /></>),
  contacts: (<><rect x="5" y="3" width="14" height="18" rx="3" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c.6-2 2.2-3 4-3s3.4 1 4 3" /></>),
  share: (<><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
  );
}

const TABS = [["invite", "Invite Code", "invite"], ["qr", "QR Scan", "qr"], ["contacts", "Contacts", "contacts"], ["share", "Share Link", "share"]];

export default function MobileAddFriends({ friends, reload, setError, onBack, initialTab }) {
  const [tab, setTab] = useState(initialTab || "invite");
  const [q, setQ] = useState("");
  const [uid, setUid] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [conns, setConns] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

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

  const me = profiles.find((x) => x.id === uid);
  const myCode = me ? me.friend_code : "";
  const nameOf = (id) => (profiles.find((x) => x.id === id) || {}).name || "Someone";
  const incoming = conns.filter((c) => c.status === "pending" && c.addressee === uid);
  const outgoing = conns.filter((c) => c.status === "pending" && c.requester === uid);
  const term = q.trim();
  const matches = term ? friends.filter((f) => f.name.toLowerCase().includes(term.toLowerCase())).slice(0, 4) : [];
  const canContacts = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  async function sendCode(code) {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("send_friend_request", { p_code: code.trim() });
    setBusy(false);
    if (error) { setError(error.message); setNotice(error.message); return; }
    setError("");
    setNotice(String(data));
    setQ("");
    load();
    reload();
  }
  async function respond(id, accept) {
    const { data, error } = await supabase.rpc("respond_friend_request", { p_id: id, p_accept: accept });
    if (error) { setError(error.message); setNotice(error.message); return; }
    setError("");
    setNotice(String(data));
    load();
    reload();
  }
  async function addManual(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("friends").insert({ name: n, phone: phone.trim() || null });
    if (error) { setError(error.message); setNotice(error.message); return; }
    setError("");
    setNotice(`${n} added to your friends.`);
    setName(""); setPhone("");
    reload();
  }
  async function pickContacts() {
    try {
      const list = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const rows = list
        .map((c) => ({ name: (c.name && c.name[0]) || "", phone: (c.tel && c.tel[0]) || null }))
        .filter((r) => r.name);
      if (rows.length === 0) return;
      const { error } = await supabase.from("friends").insert(rows);
      if (error) { setNotice(error.message); return; }
      setNotice(`${rows.length} contact${rows.length > 1 ? "s" : ""} added as friends.`);
      reload();
    } catch (err) {
      /* the person closed the picker */
    }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(myCode); setNotice("Your SplitPay ID is copied."); } catch (e) { setNotice("Your ID: " + myCode); }
  }
  async function shareLink() {
    const text = `Add me on SplitPay! My SplitPay ID: ${myCode}`;
    const url = window.location.origin;
    if (navigator.share) {
      try { await navigator.share({ title: "SplitPay", text, url }); } catch (e) { /* closed */ }
    } else {
      try { await navigator.clipboard.writeText(`${text} ${url}`); setNotice("Invite message copied. Paste it in any chat."); } catch (e) { setNotice(`${text} ${url}`); }
    }
  }

  return (
    <div className="af">
      <div className="af-bar">
        <button type="button" className="af-back" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <span className="af-brand"><i>S</i>SplitPay</span>
        <span className="af-back ghost" />
      </div>

      <div className="af-hero">
        <div>
          <h1>Add <em>Friends</em></h1>
          <p>Connect, split and settle expenses together on SplitPay.</p>
        </div>
        <svg viewBox="0 0 150 130" aria-hidden="true">
          <circle cx="52" cy="54" r="40" fill="#2f74ff" /><circle cx="52" cy="40" r="13" fill="#fff" /><path d="M28 78c3-14 14-20 24-20s21 6 24 20z" fill="#fff" />
          <circle cx="104" cy="66" r="32" fill="#1d62f0" /><circle cx="104" cy="55" r="10" fill="#fff" /><path d="M86 86c2-11 10-15 18-15s16 4 18 15z" fill="#fff" />
          <circle cx="84" cy="100" r="17" fill="#1250d8" stroke="#fff" strokeWidth="4" /><path d="M84 92v16M76 100h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <path d="M96 12l5-8M110 16l9-5M120 28l9-2" stroke="#2f74ff" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>

      <form className="af-search" onSubmit={(e) => { e.preventDefault(); if (!matches.length) sendCode(term); }}>
        <Ic n="search" s={22} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SplitPay ID" aria-label="Search" />
        {term && !matches.length && <button type="submit" disabled={busy} aria-label="Send request"><Ic n="arrow" s={18} /></button>}
      </form>
      {term && (
        <div className="af-found">
          {matches.map((f) => (
            <div key={f.id}><i style={{ background: hue(f.name) }}>{ini(f.name)}</i><b>{f.name}</b><small>Already your friend</small></div>
          ))}
          {!matches.length && (
            <button type="button" disabled={busy} onClick={() => sendCode(term)}>
              <Ic n="invite" s={20} /> Send friend request to ID “{term}”
            </button>
          )}
        </div>
      )}

      <div className="af-tabs">
        {TABS.map(([k, label, ic]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            <Ic n={ic} s={30} /><span>{label}</span>
          </button>
        ))}
      </div>

      {notice && (
        <div className="af-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>OK</button>
        </div>
      )}

      {tab === "invite" && (
        <div className="af-blue">
          <InviteClaim reload={() => { reload(); load(); }} setError={setError} />
        </div>
      )}

      {tab === "qr" && (
        <div className="af-card af-embed">
          <FriendScan profiles={profiles} myId={uid} reload={() => { reload(); load(); }} setError={setError} />
        </div>
      )}

      {tab === "contacts" && (
        <div className="af-card">
          <h3>Add from contacts</h3>
          {canContacts ? (
            <button type="button" className="af-main" onClick={pickContacts}><Ic n="contacts" s={22} /> Choose contacts</button>
          ) : (
            <p className="af-hint">This browser can't open your phone contacts. Add a friend by name below instead.</p>
          )}
          <form onSubmit={addManual} className="af-manual">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend's name" />
            <label>WhatsApp number (for reminders)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" inputMode="tel" />
            <button type="submit" className="af-main" disabled={!name.trim()}><Ic n="plus" s={20} /> Add friend</button>
          </form>
        </div>
      )}

      {tab === "share" && (
        <div className="af-card">
          <h3>Share your invite</h3>
          <p className="af-hint">Send your SplitPay ID. Your friend can paste it in Add Friends to connect with you.</p>
          <div className="af-code">{myCode || "..."}</div>
          <div className="af-two">
            <button type="button" className="af-soft" onClick={copyCode} disabled={!myCode}><Ic n="copy" s={20} /> Copy ID</button>
            <button type="button" className="af-main" onClick={shareLink} disabled={!myCode}><Ic n="share" s={20} /> Share</button>
          </div>
        </div>
      )}

      <div className="af-card af-me">
        <div>
          <h3>Your SplitPay ID</h3>
          <p>Share this ID so others can add you as a friend.</p>
        </div>
        <b>{myCode || "..."}</b>
      </div>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="af-card">
          <div className="af-sh"><h3>Friend requests</h3></div>
          {incoming.map((c) => (
            <div className="af-req" key={c.id}>
              <i style={{ background: hue(nameOf(c.requester)) }}>{ini(nameOf(c.requester))}</i>
              <span><b>{nameOf(c.requester)}</b><small>On SplitPay</small></span>
              <button type="button" className="yes" onClick={() => respond(c.id, true)}>Accept</button>
              <button type="button" className="no" onClick={() => respond(c.id, false)}>Decline</button>
            </div>
          ))}
          {outgoing.map((c) => (
            <div className="af-req" key={c.id}>
              <i style={{ background: hue(nameOf(c.addressee)) }}>{ini(nameOf(c.addressee))}</i>
              <span><b>{nameOf(c.addressee)}</b><small>Waiting for them to accept</small></span>
              <em>Pending</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Phone screens that match the mockup: My Groups, Group detail, Expense Details, Profile. */
import { useState } from "react";
import MobileFriendsV2 from "./MobileFriendsV2";
import { supabase } from "./supabaseClient";
import { Cover, kindFor, hue, ini, R } from "./DesktopHome";

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  more: (<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" /></>),
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  logout: (<><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M15 8l4 4-4 4M19 12H9" /></>),
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}
function Avs({ names, s = 40 }) {
  return (
    <span className="ms-avs">
      {names.map((n, i) => (
        <i key={i} style={{ width: s, height: s, fontSize: s * 0.4, marginLeft: i ? -s * 0.28 : 0, background: n === "You" ? "#12327f" : hue(n) }}>
          {ini(n)}
        </i>
      ))}
    </span>
  );
}
const dt = (x) => new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const sumA = (l) => l.reduce((s, e) => s + Number(e.amount), 0);

/* The Groups tab now shows the new Friends screen */
export function MobileGroups(props) {
  return <MobileFriendsV2 {...props} />;
}

export function MobileProfile({ session, name, entries, requests, owes, go, settingsPage, dark, onTheme }) {
  const [view, setView] = useState("main");
  const email = session.user.email || session.user.phone || "";
  const open = entries.filter((e) => e.status !== "Settled");
  const youOwe = sumA(open.filter((e) => e.paid_by === "friend"));
  const youGet = sumA(open.filter((e) => e.paid_by === "me"));

  if (view !== "main") {
    const titles = { settings: "Settings", notif: "Notifications", help: "Help & Support", about: "About SplitPay" };
    return (
      <div className="ms">
        <div className="ms-bar">
          <button type="button" className="ms-ib" onClick={() => setView("main")} aria-label="Back"><Ic n="back" /></button>
          <h2>{titles[view]}</h2>
          <span className="ms-ib ghost" />
        </div>
        {view === "settings" && settingsPage}
        {view === "notif" && (
          <div className="ms-card">
            {requests === 0 && owes.length === 0 && <p className="ms-empty">You are all caught up.</p>}
            {requests > 0 && (
              <button type="button" className="ms-row" onClick={() => go("Groups")}>
                <span className="ms-row-ic"><Ic n="bell" /></span>
                <span className="ms-row-mid"><b>{requests} friend request{requests > 1 ? "s" : ""}</b><small>Tap to review</small></span>
                <Ic n="chev" s={18} />
              </button>
            )}
            {owes.map((e) => (
              <button type="button" className="ms-row" key={e.id} onClick={() => go("Settlements")}>
                <span className="ms-row-ic"><Ic n="swap" /></span>
                <span className="ms-row-mid"><b>You owe {e.friend} {R(e.amount)}</b><small>{e.note || "Pending payment"}</small></span>
                <Ic n="chev" s={18} />
              </button>
            ))}
          </div>
        )}
        {view === "help" && (
          <div className="ms-card ms-text">
            <p><b>Add a friend:</b> open the Groups tab, tap +, then use an invite code, scan a QR, or add by name.</p>
            <p><b>Add an expense:</b> tap the blue + button in the bottom bar.</p>
            <p><b>Settle up:</b> open Settlements from this page, or tap Settle Up on the home screen.</p>
          </div>
        )}
        {view === "about" && (
          <div className="ms-card ms-text">
            <p><b>SplitPay</b></p>
            <p>Split. Track. Settle. Your group expenses, made effortless.</p>
          </div>
        )}
      </div>
    );
  }

  const rows = [
    ["swap", "Settlements", () => go("Settlements")],
    ["chart", "Analytics", () => go("Analytics")],
    ["gear", "Settings", () => setView("settings")],
    ["bell", "Notifications", () => setView("notif"), requests + owes.length || null],
    ["moon", dark ? "Light mode" : "Dark mode", onTheme],
    ["help", "Help & Support", () => setView("help")],
    ["info", "About SplitPay", () => setView("about")],
  ];

  return (
    <div className="ms">
      <div className="ms-prof">
        <button type="button" className="ms-ib r" onClick={() => setView("settings")} aria-label="Settings"><Ic n="gear" /></button>
        <span className="ms-prof-av">{ini(name)}</span>
        <h1>{name}</h1>
        <small>{email}</small>
      </div>
      <button type="button" className="ms-owed" onClick={() => go("Settlements")}>
        <span>Total Owed</span>
        <b>{R(youOwe)}</b>
        <em>You get {R(youGet)}</em>
        <i><Ic n="arrow" s={18} /></i>
      </button>
      <div className="ms-list">
        {rows.map(([ic, label, fn, badge]) => (
          <button type="button" key={label} onClick={fn}>
            <Ic n={ic} s={22} />
            <span>{label}</span>
            {badge ? <u>{badge}</u> : null}
            <Ic n="chev" s={18} />
          </button>
        ))}
      </div>
      <button type="button" className="ms-logout" onClick={() => supabase.auth.signOut()}>Log Out</button>
    </div>
  );
}

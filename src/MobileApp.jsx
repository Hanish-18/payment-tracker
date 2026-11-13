import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useTheme, setTheme } from "./ThemeToggle";
import { AccentPicker } from "./Accent";
import { buildMessage, openWhatsApp } from "./reminder";
import SplitHub from "./SplitHub";
import PaymentsHub from "./PaymentsHub";
import PayPage from "./PayPage";
import ProfilePage from "./ProfilePage";
import DeleteAccount from "./DeleteAccount";
import InviteClaim from "./InviteClaim";
import FriendScan from "./FriendScan";
import "./mobileapp.css";

/* ---------- helpers ---------- */
const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const todayISO = () => new Date().toLocaleDateString("en-CA");
const PAL = ["#4a6cf7", "#1aa0f6", "#f8a53a", "#3ccf6e", "#ef6a8a", "#14b8a6", "#8b5cf6"];
const colorOf = (s) => PAL[[...String(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const sum = (list) => list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
const byDate = (a, b) => new Date(b.payment_date || 0) - new Date(a.payment_date || 0) || b.id - a.id;

function ago(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : d + "d ago";
}

const CATS = [
  ["Food & Drinks", /food|dinner|lunch|breakfast|cafe|restaurant|pizza|meal|snack|tea|coffee|party|baga|biryani/i, "#ef6a8a", "🍴"],
  ["Travel", /trip|flight|ticket|hotel|stay|room|hostel|booking|travel|movie/i, "#2f8cf5", "✈️"],
  ["Transport", /cab|taxi|uber|ola|fuel|petrol|bus|train|metro|auto|scooty|rental|bike/i, "#f8a53a", "🚗"],
  ["Shopping", /shop|cloth|amazon|flipkart|mall|gift|buy|grocer/i, "#3ccf6e", "🛒"],
];
const OTHER = ["Others", null, "#c8ccd8", "🧾"];
const catOf = (e) =>
  CATS.find((c) => c[0] === e.category) || CATS.find((c) => c[1].test(e.note || "")) || OTHER;

function balances(entries) {
  let get = 0;
  let owe = 0;
  const per = {};
  entries.filter((e) => e.status !== "Settled").forEach((e) => {
    const a = Number(e.amount) || 0;
    if (e.paid_by === "friend") {
      owe += a;
      per[e.friend] = (per[e.friend] || 0) - a;
    } else if (e.paid_by === "me") {
      get += a;
      per[e.friend] = (per[e.friend] || 0) + a;
    }
  });
  return { get, owe, per };
}

const monthEntries = (entries, d) =>
  entries.filter((e) => {
    const x = new Date(e.payment_date || 0);
    return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear();
  });

const BKEY = "splitpay-budget";
const getBudget = () => {
  try {
    return Number(localStorage.getItem(BKEY)) || 25000;
  } catch {
    return 25000;
  }
};
const saveBudget = (n) => {
  try {
    localStorage.setItem(BKEY, String(n));
  } catch {
    // ignore
  }
};

/* ---------- small pieces ---------- */
const NAVI = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  split: (<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>),
  groups: (<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" /></>),
  payments: (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></>),
  travel: (<><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>),
};
const TABS = [["home", "Home"], ["split", "Split"], ["groups", "Groups"], ["payments", "Payments"], ["travel", "Travel"]];

function Avatar({ name, size = 40 }) {
  return (
    <span className="m-av" style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.42 }}>
      {String(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Screen({ title, sub, back, right, children }) {
  return (
    <div className="m-screen">
      <div className="m-hero">
        <div className="m-hero-top">
          {back ? <button type="button" className="m-back" onClick={back}>←</button> : <span />}
          <div className="m-hero-r">{right}</div>
        </div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="m-pull">{children}</div>
    </div>
  );
}

function Row({ icon, color, title, sub, right, onClick, chev = true }) {
  return (
    <button type="button" className="m-row" onClick={onClick}>
      <span className="m-ico" style={{ background: (color || "#4a6cf7") + "26" }}>{icon}</span>
      <span className="m-rt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right && <span className="m-rr">{right}</span>}
      {chev && <span className="m-chev">›</span>}
    </button>
  );
}

function Chips({ items, value, onChange }) {
  return (
    <div className="m-chips2">
      {items.map((i) => (
        <button key={i} type="button" className={value === i ? "on" : ""} onClick={() => onChange(i)}>{i}</button>
      ))}
    </div>
  );
}

function Ring({ pct, size = 76, stroke = 9, children }) {
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  return (
    <div className="m-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" strokeWidth={stroke} style={{ stroke: "var(--line)" }} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" strokeWidth={stroke} strokeLinecap="round"
          style={{ stroke: "var(--pri)" }} strokeDasharray={`${(C * pct) / 100} ${C}`} />
      </svg>
      <div className="m-ring-in">{children}</div>
    </div>
  );
}

function Legacy({ children }) {
  return <div className="sp-content m-legacy">{children}</div>;
}

/* ---------- main ---------- */
export default function MobileApp({ session }) {
  const myId = session.user.id;
  const meta = session.user.user_metadata || {};
  const name = meta.name || meta.full_name || (session.user.email || "").split("@")[0] || "there";
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);
  const [entries, setEntries] = useState([]);
  const [friends, setFriends] = useState([]);
  const [connections, setConnections] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsOk, setGroupsOk] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const [e, f, cn, p, g] = await Promise.all([
      supabase.from("entries").select("*").order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("friends").select("*").order("name"),
      supabase.from("connections").select("*"),
      supabase.from("profiles").select("id, name, friend_code"),
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
    ]);
    const err = e.error || f.error || cn.error || p.error;
    if (err) {
      setError(err.message);
      return;
    }
    const names = {};
    p.data.forEach((x) => (names[x.id] = x.name));
    const local = {};
    f.data.forEach((x) => {
      if (x.linked_user_id) local[x.linked_user_id] = x.name;
    });
    setFriends(f.data);
    setConnections(cn.data);
    setProfiles(p.data);
    setGroupsOk(!g.error);
    setGroups(g.error ? [] : g.data);
    setEntries(
      e.data.map((en) =>
        en.user_id === myId
          ? en
          : { ...en, friend: local[en.user_id] || names[en.user_id] || "Friend", paid_by: en.paid_by === "me" ? "friend" : "me", shared: true }
      )
    );
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session.access_token]);

  const open = (n, p = {}) => {
    setStack((s) => [...s, { n, p }]);
    window.scrollTo(0, 0);
  };
  const back = () => setStack((s) => s.slice(0, -1));
  const go = (t) => {
    setStack([]);
    setTab(t);
    window.scrollTo(0, 0);
  };
  const c = { entries, friends, connections, profiles, groups, groupsOk, myId, name, session, reload: load, setError, open, back, go };

  const v = stack[stack.length - 1];
  let screen;
  if (v) screen = <View v={v} c={c} />;
  else if (tab === "home") screen = <Home c={c} />;
  else if (tab === "split") screen = <SplitTab c={c} />;
  else if (tab === "groups") screen = <GroupsTab c={c} />;
  else if (tab === "payments") screen = <PaymentsTab c={c} />;
  else screen = <TravelTab c={c} />;

  return (
    <div className="m-app">
      {error && (
        <div className="m-err" onClick={() => setError("")}>{error}</div>
      )}
      {screen}
      <nav className="m-nav">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={"m-nb" + (tab === k ? " on" : "")} onClick={() => go(k)}>
            <span className="m-nbi">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {NAVI[k]}
              </svg>
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- pushed screens ---------- */
function View({ v, c }) {
  const { n, p } = v;
  if (n === "add") return <AddExpenseM c={c} groupId={p.groupId} />;
  if (n === "settle") return <SettleUp c={c} />;
  if (n === "request") return <RequestMoney c={c} />;
  if (n === "budget") return <Budget c={c} />;
  if (n === "friends") return <FriendsScreen c={c} />;
  if (n === "creategroup") return <CreateGroup c={c} kind={p.kind} />;
  if (n === "group") return <GroupDetail c={c} id={p.id} />;
  if (n === "trips") return <TripList c={c} />;
  if (n === "me") return <MeScreen c={c} />;
  if (n === "settings") return <SettingsScreen c={c} />;
  if (n === "help") return <HelpScreen c={c} />;
  const legacy = {
    split: ["Split a Bill", "Divide an expense among friends.", <SplitHub key="s" entries={c.entries} friends={c.friends} reload={c.reload} setError={c.setError} goFriends={() => c.open("friends")} myName={c.name} />],
    pay: ["Pay", "Pay with any UPI app or scan a QR.", <PayPage key="p" entries={c.entries} friends={c.friends} reload={c.reload} setError={c.setError} />],
    payments: ["All Transactions", "Your payment history.", <PaymentsHub key="h" entries={c.entries} friends={c.friends} reload={c.reload} setError={c.setError} goFriends={() => c.open("friends")} myName={c.name} />],
    account: ["My Account", c.session.user.email, <ProfilePage key="a" session={c.session} profiles={c.profiles} />],
  }[n];
  if (!legacy) return null;
  return (
    <Screen title={legacy[0]} sub={legacy[1]} back={c.back}>
      <Legacy>{legacy[2]}</Legacy>
    </Screen>
  );
}

/* ---------- Home ---------- */
function Home({ c }) {
  const { entries, name, open } = c;
  const { get, owe } = balances(entries);
  const net = get - owe;
  const budget = getBudget();
  const spent = sum(monthEntries(entries, new Date()));
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const recent = [...entries].sort(byDate).slice(0, 4);
  const requests = c.connections.filter((x) => x.status === "pending" && x.addressee === c.myId).length;

  return (
    <div className="m-screen">
      <div className="m-hero m-home">
        <div className="m-hero-top">
          <div className="m-logo"><i>S</i>SplitPay</div>
          <div className="m-hero-r">
            <button type="button" className="m-ic" onClick={() => open("friends")} aria-label="Notifications">
              🔔{requests > 0 && <b className="m-dot" />}
            </button>
            <button type="button" className="m-ic m-me" onClick={() => open("me")}>{name.charAt(0).toUpperCase()}</button>
          </div>
        </div>
        <h1>Hi, {name} 👋</h1>
        <p>Track, split and settle expenses with friends.</p>
      </div>

      <div className="m-pull">
        <div className="m-card m-total">
          <div className="m-total-h"><span>Total Balance</span>
            <button type="button" onClick={() => open("settle")} aria-label="Settle up">→</button>
          </div>
          <div className="m-big">{net < 0 ? "-" : ""}{rupee(Math.abs(net))}</div>
          <div className="m-two">
            <span className="g">You get<br /><b>{rupee(get)}</b></span>
            <span className="r">You owe<br /><b>{rupee(owe)}</b></span>
          </div>
        </div>

        <div className="m-qa">
          {[["+", "Add Expense", "add", true], ["⊞", "Split Bill", "split"], ["⇄", "Settle Up", "settle"], ["▣", "Scan UPI", "pay"]].map(([ic, label, key, solid]) => (
            <button key={key} type="button" className={solid ? "solid" : ""} onClick={() => open(key)}>
              <span>{ic}</span>{label}
            </button>
          ))}
        </div>

        <button type="button" className="m-card m-month" onClick={() => open("budget")}>
          <div className="m-h">This Month</div>
          <div className="m-month-r">
            <Ring pct={pct}><b>{pct}%</b><small>Spent</small></Ring>
            <div><div className="m-amt">{rupee(spent)}</div><small>of {rupee(budget)} budget</small></div>
            <span className="m-chev">›</span>
          </div>
        </button>

        <div className="m-sec"><h3>Recent Activity</h3><button type="button" onClick={() => open("payments")}>See All</button></div>
        <div className="m-card m-list">
          {recent.length === 0 && <div className="m-empty">No expenses yet. Tap + Add Expense.</div>}
          {recent.map((e) => {
            const k = catOf(e);
            return (
              <Row key={e.id} icon={k[3]} color={k[2]} title={e.note || e.friend}
                sub={`${e.paid_by === "me" ? "You paid" : e.friend + " paid"} ${rupee(e.amount)}`}
                right={ago(e.created_at)} chev={false} onClick={() => open("payments")} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Split ---------- */
function SplitTab({ c }) {
  const { entries, open } = c;
  const recent = [...entries].sort(byDate).slice(0, 5);
  return (
    <Screen title="Split" sub="Share a bill with friends">
      <div className="m-card m-list">
        <Row icon="⊞" color="#1d62f0" title="Split a Bill" sub="Divide an expense" onClick={() => open("split")} />
        <Row icon="＋" color="#1d62f0" title="Add Expense" sub="Record a payment" onClick={() => open("add")} />
      </div>
      <div className="m-sec"><h3>Recent Splits</h3><button type="button" onClick={() => open("payments")}>See All</button></div>
      <div className="m-card m-list">
        {recent.length === 0 && <div className="m-empty">Nothing split yet.</div>}
        {recent.map((e) => {
          const k = catOf(e);
          return <Row key={e.id} icon={k[3]} color={k[2]} title={e.note || e.friend} sub={`${rupee(e.amount)} · with ${e.friend}`} onClick={() => open("payments")} />;
        })}
      </div>
    </Screen>
  );
}

/* ---------- Groups ---------- */
function GroupsTab({ c }) {
  const { groups, groupsOk, entries, open } = c;
  const [f, setF] = useState("All");
  const list = groups.filter((g) => g.kind !== "trip").filter((g) => f === "All" || (f === "Active" ? !g.archived : g.archived));
  const total = (g) => sum(entries.filter((e) => e.group_id === g.id));
  return (
    <Screen
      title="Groups"
      sub="Manage group expenses and balances"
      right={<button type="button" className="m-plus" onClick={() => open("creategroup", { kind: "group" })} aria-label="New group">+</button>}
    >
      <Chips items={["All", "Active", "Archived", "Friends"]} value={f} onChange={setF} />
      {f === "Friends" ? (
        <FriendsBlock c={c} />
      ) : (
        <div className="m-card m-list">
          {!groupsOk && <div className="m-empty">Groups need a one-time database setup (run the Groups SQL).</div>}
          {groupsOk && list.length === 0 && <div className="m-empty">No groups here yet. Tap + to create one.</div>}
          {list.map((g) => (
            <Row key={g.id} icon={g.emoji || "👥"} color={colorOf(g.name)} title={g.name}
              sub={`${(g.members || []).length} members · ${rupee(total(g))}`} onClick={() => open("group", { id: g.id })} />
          ))}
        </div>
      )}
    </Screen>
  );
}

function CreateGroup({ c, kind }) {
  const trip = kind === "trip";
  const EMOJI = trip ? ["🏔️", "🏖️", "🌴", "🚆", "✈️", "🏕️"] : ["👥", "🏠", "🎓", "🍽️", "💼", "🎉"];
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (n) => setMembers((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));

  async function save() {
    if (!name.trim()) return c.setError("Enter a name.");
    setBusy(true);
    const { error } = await supabase.from("groups").insert({ name: name.trim(), kind, emoji, members });
    setBusy(false);
    if (error) return c.setError(/relation|groups/i.test(error.message) ? "Run the Groups SQL in Supabase first." : error.message);
    c.setError("");
    await c.reload();
    c.back();
  }

  return (
    <Screen title={trip ? "Create Trip" : "Create Group"} sub={trip ? "Plan a new trip" : "Split expenses with a group"} back={c.back}>
      <div className="m-card m-form">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={trip ? "Goa Trip" : "Roommates"} />
        <label>Icon</label>
        <div className="m-emo">
          {EMOJI.map((e) => (
            <button key={e} type="button" className={emoji === e ? "on" : ""} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
        <label>Members</label>
        <div className="m-pick">
          {c.friends.length === 0 && <small>Add friends first (Groups → Friends).</small>}
          {c.friends.map((f) => (
            <button key={f.id} type="button" className={members.includes(f.name) ? "on" : ""} onClick={() => toggle(f.name)}>
              <Avatar name={f.name} size={46} />{f.name}
            </button>
          ))}
        </div>
        <button type="button" className="m-cta" disabled={busy} onClick={save}>{busy ? "Saving..." : "Create"}</button>
      </div>
    </Screen>
  );
}

function GroupDetail({ c, id }) {
  const [tab, setTab] = useState("Expenses");
  const g = c.groups.find((x) => x.id === id);
  if (!g) return <Screen title="Group" back={c.back}><div className="m-card m-empty">Group not found.</div></Screen>;
  const list = c.entries.filter((e) => e.group_id === g.id).sort(byDate);
  const per = balances(list).per;

  async function archive() {
    await supabase.from("groups").update({ archived: !g.archived }).eq("id", g.id);
    await c.reload();
  }
  async function remove() {
    if (!window.confirm("Delete this group? Expenses stay in your history.")) return;
    await supabase.from("groups").delete().eq("id", g.id);
    await c.reload();
    c.back();
  }

  return (
    <Screen title={`${g.name} ${g.emoji || ""}`} sub={`${(g.members || []).length} members · ${rupee(sum(list))}`} back={c.back}>
      <div className="m-avs">{(g.members || []).map((n) => <Avatar key={n} name={n} size={40} />)}</div>
      <Chips items={["Expenses", "Balances", "Details"]} value={tab} onChange={setTab} />
      <div className="m-card m-list">
        {tab === "Expenses" && (
          <>
            {list.length === 0 && <div className="m-empty">No expenses in this group yet.</div>}
            {list.map((e) => {
              const k = catOf(e);
              return <Row key={e.id} icon={k[3]} color={k[2]} title={e.note || e.friend} sub={`${e.paid_by === "me" ? "Paid by you" : "Paid by " + e.friend}`} right={rupee(e.amount)} chev={false} />;
            })}
          </>
        )}
        {tab === "Balances" && (
          <>
            {Object.keys(per).length === 0 && <div className="m-empty">All settled.</div>}
            {Object.entries(per).map(([n, v]) => (
              <Row key={n} icon={n.charAt(0).toUpperCase()} color={colorOf(n)} title={n}
                sub={v > 0 ? `Owes you ${rupee(v)}` : `You owe ${rupee(-v)}`} chev={false} />
            ))}
          </>
        )}
        {tab === "Details" && (
          <div className="m-form">
            <label>Type</label><p>{g.kind === "trip" ? "Trip" : "Group"}</p>
            <label>Members</label><p>{(g.members || []).join(", ") || "-"}</p>
            <button type="button" className="m-ghost" onClick={archive}>{g.archived ? "Unarchive group" : "Archive group"}</button>
            <button type="button" className="m-danger" onClick={remove}>Delete group</button>
          </div>
        )}
      </div>
      <button type="button" className="m-cta" onClick={() => c.open("add", { groupId: g.id })}>+ Add Group Expense</button>
    </Screen>
  );
}

/* ---------- Payments ---------- */
function PaymentsTab({ c }) {
  const { entries, open } = c;
  const [f, setF] = useState("All");
  const list = [...entries].sort(byDate).filter((e) => f === "All" || (f === "Paid by me" ? e.paid_by === "me" : e.paid_by === "friend" && e.status !== "Settled")).slice(0, 8);
  return (
    <Screen title="Payments" sub="Pay, request and track payments">
      <div className="m-qa m-qa4">
        {[["+", "Add Payment", () => open("payments")], ["➤", "Pay Now", () => open("pay")], ["⤓", "Request", () => open("request")], ["▣", "Scan UPI", () => open("pay")]].map(([ic, label, fn]) => (
          <button key={label} type="button" onClick={fn}><span>{ic}</span>{label}</button>
        ))}
      </div>
      <Chips items={["All", "Paid by me", "To be paid"]} value={f} onChange={setF} />
      <div className="m-card m-list">
        {list.length === 0 && <div className="m-empty">No payments here yet.</div>}
        {list.map((e) => {
          const k = catOf(e);
          return (
            <Row key={e.id} icon={k[3]} color={k[2]} title={e.note || e.friend}
              sub={`${e.paid_by === "me" ? "You paid" : e.friend + " paid"} · ${e.mode || "UPI"}`}
              right={<span className="m-pr">{rupee(e.amount)}<small>{e.status === "Settled" ? "Settled" : "Pending"}</small></span>}
              chev={false} onClick={() => open("payments")} />
          );
        })}
      </div>
      <button type="button" className="m-link" onClick={() => open("payments")}>See All Transactions →</button>
    </Screen>
  );
}

function RequestMoney({ c }) {
  const { entries, friends, name } = c;
  const per = balances(entries).per;
  const owing = Object.entries(per).filter(([, v]) => v > 0);
  function remind(n) {
    const e = entries.find((x) => x.friend === n && x.paid_by === "me" && x.status !== "Settled");
    try {
      const f = friends.find((x) => x.name === n);
      openWhatsApp(f && f.phone, buildMessage({ friend: n, entries, entry: e, myName: name }));
    } catch {
      c.setError("Could not open WhatsApp.");
    }
  }
  return (
    <Screen title="Request" sub="Remind friends who owe you" back={c.back}>
      <div className="m-card m-list">
        {owing.length === 0 && <div className="m-empty">Nobody owes you right now.</div>}
        {owing.map(([n, v]) => (
          <Row key={n} icon={n.charAt(0).toUpperCase()} color={colorOf(n)} title={n} sub={`Owes you ${rupee(v)}`}
            right={<span className="m-mini">Remind</span>} chev={false} onClick={() => remind(n)} />
        ))}
      </div>
    </Screen>
  );
}

/* ---------- Settle up ---------- */
function SettleUp({ c }) {
  const { entries, reload, setError, open } = c;
  const { get, owe, per } = balances(entries);
  const rows = Object.entries(per).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [sel, setSel] = useState([]);
  const [msg, setMsg] = useState("");
  const toggle = (n) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  const total = sel.reduce((s, n) => s + (per[n] || 0), 0);

  async function settle() {
    const ids = entries.filter((e) => !e.shared && e.status !== "Settled" && sel.includes(e.friend)).map((e) => e.id);
    if (!ids.length) {
      setMsg("These entries were added by your friends, so they mark them settled.");
      return;
    }
    const { error } = await supabase.from("entries").update({ status: "Settled" }).in("id", ids);
    if (error) return setError(error.message);
    setMsg(`Marked ${ids.length} entr${ids.length > 1 ? "ies" : "y"} as settled.`);
    setSel([]);
    reload();
  }

  return (
    <Screen title="Settle Up" sub="Clear balances with friends in one tap." back={c.back}>
      <div className="m-two big">
        <span className="g">You Get<br /><b>{rupee(get)}</b></span>
        <span className="r">You Pay<br /><b>{rupee(owe)}</b></span>
      </div>
      <div className="m-sec"><h3>Settle With</h3></div>
      <div className="m-card m-list">
        {rows.length === 0 && <div className="m-empty">All settled up. 🎉</div>}
        {rows.map(([n, v]) => (
          <div className="m-row m-srow" key={n}>
            <Avatar name={n} size={42} />
            <span className="m-rt"><b>{n}</b><small className={v > 0 ? "pos" : "neg"}>{v > 0 ? "You get" : "You pay"} {rupee(Math.abs(v))}</small></span>
            {v < 0 && <button type="button" className="m-mini" onClick={() => open("pay")}>Pay</button>}
            <button type="button" className={"m-chk" + (sel.includes(n) ? " on" : "")} onClick={() => toggle(n)} aria-label="Select">{sel.includes(n) ? "✓" : ""}</button>
          </div>
        ))}
      </div>
      {msg && <div className="m-note">{msg}</div>}
      <button type="button" className="m-cta" disabled={!sel.length} onClick={settle}>
        Settle ({rupee(Math.abs(total))})
      </button>
    </Screen>
  );
}

/* ---------- Add expense ---------- */
function AddExpenseM({ c, groupId }) {
  const { friends, groups } = c;
  const group = groups.find((g) => g.id === groupId);
  const pool = group ? friends.filter((f) => (group.members || []).includes(f.name)) : friends;
  const [who, setWho] = useState("me");
  const [sel, setSel] = useState([]);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [method, setMethod] = useState("UPI");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const toggle = (n) => setSel((s) => (who === "friend" ? [n] : s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  const pickWho = (w) => {
    setWho(w);
    if (w === "friend") setSel((s) => s.slice(0, 1));
  };

  async function save() {
    const total = Number(amount);
    if (!sel.length) return c.setError(who === "friend" ? "Choose the friend who paid." : "Choose at least one friend.");
    if (!(total > 0)) return c.setError("Enter the amount.");
    if (!title.trim()) return c.setError("Enter a title.");
    setBusy(true);
    const share = round2(who === "me" ? total / (sel.length + 1) : total / 2);
    const rows = sel.map((n) => ({
      friend: n, amount: share, note: title.trim(), mode: method,
      paid_by: who === "me" ? "me" : "friend", payment_date: date,
      ...(group ? { group_id: group.id } : {}),
    }));
    let { error } = await supabase.from("entries").insert(rows);
    if (error && /group_id|column/i.test(error.message)) {
      ({ error } = await supabase.from("entries").insert(rows.map(({ group_id, ...r }) => r)));
    }
    setBusy(false);
    if (error) return c.setError(error.message);
    c.setError("");
    await c.reload();
    c.back();
  }

  return (
    <Screen title="Add Expense" sub={group ? `In ${group.name}` : "Record a payment"} back={c.back}>
      <div className="m-card m-form">
        <div className="m-seg">
          <button type="button" className={who === "me" ? "on" : ""} onClick={() => pickWho("me")}>I Paid<small>(for others)</small></button>
          <button type="button" className={who === "friend" ? "on" : ""} onClick={() => pickWho("friend")}>Friend Paid<small>(for me)</small></button>
        </div>

        <label>For Friend(s) <em>*</em></label>
        <div className="m-pick">
          {pool.map((f) => (
            <button key={f.id} type="button" className={sel.includes(f.name) ? "on" : ""} onClick={() => toggle(f.name)}>
              <Avatar name={f.name} size={48} />{f.name}
            </button>
          ))}
          <button type="button" onClick={() => c.open("friends")}><span className="m-addc">+</span>Add</button>
        </div>

        <label>Amount <em>*</em></label>
        <div className="m-amt-in"><span>₹</span><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2,400" /></div>
        {sel.length > 0 && Number(amount) > 0 && (
          <small className="m-hint">Each friend's share: {rupee(round2(who === "me" ? Number(amount) / (sel.length + 1) : Number(amount) / 2))}</small>
        )}

        <label>Title <em>*</em></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Baga" />

        <label>Payment Method</label>
        <div className="m-meth">
          {[["UPI", "📲"], ["Card", "💳"], ["Cash", "💵"], ["Other", "⋯"]].map(([k, ic]) => (
            <button key={k} type="button" className={method === k ? "on" : ""} onClick={() => setMethod(k)}><span>{ic}</span>{k}</button>
          ))}
        </div>

        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <button type="button" className="m-cta" disabled={busy} onClick={save}>{busy ? "Saving..." : "Add Expense"}</button>
      </div>
    </Screen>
  );
}

/* ---------- Travel ---------- */
function TravelTab({ c }) {
  const trips = c.groups.filter((g) => g.kind === "trip");
  const t = trips[0];
  const total = t ? sum(c.entries.filter((e) => e.group_id === t.id)) : 0;
  return (
    <Screen title="Travel" sub="Plan trips, track group expenses and settle easily">
      {t && (
        <button type="button" className="m-trip" onClick={() => c.open("group", { id: t.id })}>
          <b>{t.name} {t.emoji}</b>
          <small>{(t.members || []).length} members · {rupee(total)}</small>
          <span>→</span>
        </button>
      )}
      <div className="m-card m-list">
        <Row icon="✈️" color="#1d62f0" title="Create Trip" sub="Plan a new trip" onClick={() => c.open("creategroup", { kind: "trip" })} />
        <Row icon="🗺️" color="#1d62f0" title="My Trips" sub={`${trips.length} trip${trips.length === 1 ? "" : "s"}`} onClick={() => c.open("trips")} />
        <Row icon="🧳" color="#8a94b8" title="Trip Templates" sub="Ready-made trip plans" right={<span className="m-mini">Soon</span>} chev={false} />
      </div>
    </Screen>
  );
}

function TripList({ c }) {
  const trips = c.groups.filter((g) => g.kind === "trip");
  return (
    <Screen title="My Trips" sub="View and manage trips" back={c.back}>
      <div className="m-card m-list">
        {trips.length === 0 && <div className="m-empty">No trips yet.</div>}
        {trips.map((g) => (
          <Row key={g.id} icon={g.emoji || "🏔️"} color={colorOf(g.name)} title={g.name}
            sub={`${(g.members || []).length} members · ${rupee(sum(c.entries.filter((e) => e.group_id === g.id)))}`}
            onClick={() => c.open("group", { id: g.id })} />
        ))}
      </div>
    </Screen>
  );
}

/* ---------- Budget & insights ---------- */
function Budget({ c }) {
  const [off, setOff] = useState(0);
  const [budget, setBudget] = useState(getBudget());
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const list = monthEntries(c.entries, d);
  const total = sum(list);
  const sums = {};
  list.forEach((e) => {
    const k = catOf(e);
    sums[k[0]] = sums[k[0]] || { v: 0, color: k[2], icon: k[3] };
    sums[k[0]].v += Number(e.amount) || 0;
  });
  const parts = Object.entries(sums).sort((a, b) => b[1].v - a[1].v);
  const pct = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0;
  const R = 78;
  const C = 2 * Math.PI * R;
  let acc = 0;

  function edit() {
    const v = window.prompt("Monthly budget (₹)", String(budget));
    const n = Number(v);
    if (v !== null && n > 0) {
      setBudget(n);
      saveBudget(n);
    }
  }

  return (
    <Screen title="Budget & Insights" sub="Track limits, spending and trends" back={c.back}>
      <div className="m-month-nav">
        <button type="button" onClick={() => setOff(off - 1)}>‹</button>
        <b>{d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b>
        <button type="button" onClick={() => setOff(off + 1)} disabled={off >= 0}>›</button>
      </div>
      <div className="m-card m-budget">
        <div className="m-donut">
          <svg width="190" height="190" viewBox="0 0 190 190" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="95" cy="95" r={R} fill="none" strokeWidth="20" style={{ stroke: "var(--line)" }} />
            {budget > 0 && parts.map(([n, p]) => {
              const len = Math.min(p.v / budget, 1) * C;
              const el = <circle key={n} cx="95" cy="95" r={R} fill="none" strokeWidth="20" stroke={p.color} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
              acc += len;
              return el;
            })}
          </svg>
          <div className="m-donut-in"><b>{pct}%</b><small>budget spent</small></div>
        </div>
        <div className="m-amt big">{rupee(total)}</div>
        <button type="button" className="m-edit" onClick={edit}>of {rupee(budget)} total budget ✎</button>
        <div className="m-cats">
          {parts.length === 0 && <div className="m-empty">No spending this month.</div>}
          {parts.map(([n, p]) => (
            <div key={n}>
              <span className="m-ico" style={{ background: p.color + "26" }}>{p.icon}</span>
              <b>{n}</b>
              <span>{rupee(p.v)} · {Math.round((p.v / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <small className="m-hint center">Budget is saved on this device.</small>
    </Screen>
  );
}

/* ---------- Friends ---------- */
function FriendsBlock({ c }) {
  const { friends, connections, profiles, myId, reload, setError } = c;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const nameOf = (id) => (profiles.find((p) => p.id === id) || {}).name || "Someone";
  const incoming = connections.filter((x) => x.status === "pending" && x.addressee === myId);

  async function sendRequest() {
    if (!code.trim()) return;
    const { data, error } = await supabase.rpc("send_friend_request", { p_code: code.trim() });
    if (error) return setError(error.message);
    setError("");
    setNotice(data);
    setCode("");
    reload();
  }
  async function respond(id, ok) {
    const { data, error } = await supabase.rpc("respond_friend_request", { p_id: id, p_accept: ok });
    if (error) return setError(error.message);
    setNotice(data);
    reload();
  }
  async function addManual() {
    if (!name.trim()) return;
    const { error } = await supabase.from("friends").insert({ name: name.trim(), phone: phone.trim() || null });
    if (error) return setError(error.message);
    setName("");
    setPhone("");
    reload();
  }
  async function remove(id) {
    await supabase.from("friends").delete().eq("id", id);
    reload();
  }

  return (
    <>
      {notice && <div className="m-note" onClick={() => setNotice("")}>{notice}</div>}
      {incoming.length > 0 && (
        <div className="m-card m-list">
          {incoming.map((x) => (
            <div className="m-row m-srow" key={x.id}>
              <Avatar name={nameOf(x.requester)} size={42} />
              <span className="m-rt"><b>{nameOf(x.requester)}</b><small>wants to connect</small></span>
              <button type="button" className="m-mini" onClick={() => respond(x.id, true)}>Accept</button>
              <button type="button" className="m-mini ghost" onClick={() => respond(x.id, false)}>No</button>
            </div>
          ))}
        </div>
      )}
      <div className="m-card m-list">
        {friends.length === 0 && <div className="m-empty">No friends yet. Add one below.</div>}
        {friends.map((f) => (
          <div className="m-row m-srow" key={f.id}>
            <Avatar name={f.name} size={42} />
            <span className="m-rt"><b>{f.name}{f.linked_user_id ? " ✓" : ""}</b><small>{f.phone || "No WhatsApp number"}</small></span>
            <button type="button" className="m-mini ghost" onClick={() => remove(f.id)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="m-card m-form">
        <label>Add a friend by SplitPay ID</label>
        <div className="m-inline"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A3F9C21B" /><button type="button" className="m-mini" onClick={sendRequest}>Send</button></div>
        <label>Add a friend without an account</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend's name" />
        <div className="m-inline"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number" inputMode="tel" /><button type="button" className="m-mini" onClick={addManual}>Add</button></div>
      </div>
      <Legacy>
        <InviteClaim reload={reload} setError={setError} />
        <FriendScan profiles={profiles} myId={myId} reload={reload} setError={setError} />
      </Legacy>
    </>
  );
}

function FriendsScreen({ c }) {
  return (
    <Screen title="Friends" sub="Connect and manage your friends" back={c.back}>
      <FriendsBlock c={c} />
    </Screen>
  );
}

/* ---------- Profile, settings, help ---------- */
function MeScreen({ c }) {
  const { name, session, open } = c;
  return (
    <div className="m-screen">
      <div className="m-hero m-center">
        <div className="m-hero-top"><button type="button" className="m-back" onClick={c.back}>←</button>
          <div className="m-hero-r"><button type="button" className="m-ic" onClick={() => open("settings")} aria-label="Settings">⚙️</button></div></div>
        <span className="m-big-av">{name.charAt(0).toUpperCase()}</span>
        <h1>{name}</h1>
        <p>{session.user.email}</p>
      </div>
      <div className="m-pull">
        <div className="m-card m-list">
          <Row icon="👤" color="#1d62f0" title="My Account" onClick={() => open("account")} />
          <Row icon="💳" color="#1d62f0" title="Payment Methods" sub="UPI, Cards, Bank Accounts" onClick={() => open("account")} />
          <Row icon="🎯" color="#1d62f0" title="Budgets" sub="Set and track your limits" onClick={() => open("budget")} />
          <Row icon="📊" color="#1d62f0" title="Reports & Insights" sub="Spending, groups, travel" onClick={() => open("budget")} />
          <Row icon="⚙️" color="#1d62f0" title="Settings" sub="Theme colour, dark mode" onClick={() => open("settings")} />
          <Row icon="❓" color="#1d62f0" title="Help & Support" onClick={() => open("help")} />
        </div>
        <button type="button" className="m-danger" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>
    </div>
  );
}

function SettingsScreen({ c }) {
  const { mode } = useTheme();
  return (
    <Screen title="Settings" sub="Make SplitPay look the way you like" back={c.back}>
      <div className="m-card m-form">
        <h3>Appearance</h3>
        <div className="m-seg three">
          {[["light", "☀️ Light"], ["dark", "🌙 Dark"], ["system", "Auto"]].map(([k, label]) => (
            <button key={k} type="button" className={mode === k ? "on" : ""} onClick={() => setTheme(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="m-card m-form">
        <h3>Theme colour</h3>
        <small className="m-hint">Changes buttons, headers and cards across the app.</small>
        <div style={{ marginTop: 14 }}><AccentPicker /></div>
      </div>
      <Legacy><DeleteAccount /></Legacy>
    </Screen>
  );
}

function HelpScreen({ c }) {
  return (
    <Screen title="Help & Support" sub="Quick answers" back={c.back}>
      <div className="m-card m-form">
        <h3>Add an expense</h3><p>Tap + Add Expense, choose who paid and the friends involved, enter the amount and save.</p>
        <h3>Settle up</h3><p>Open Settle Up, tick the friends you have settled with and tap Settle. Use Pay to send money by UPI.</p>
        <h3>Groups and trips</h3><p>Create them from the Groups and Travel tabs and add expenses inside.</p>
      </div>
    </Screen>
  );
}

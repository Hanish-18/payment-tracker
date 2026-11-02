import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import QRSection from "./QRSection";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getUpi, buildMessage, openWhatsApp, shareQR } from "./reminder";
import Split from "./Split";
   import AuthChoice from "./AuthChoice";
   import PaymentsHub from "./PaymentsHub";
   import SplitHub from "./SplitHub";
      import FriendScan from "./FriendScan";
         import InviteClaim from "./InviteClaim";
   import PaymentsPage from "./PaymentsPage";
   import ProfilePage from "./ProfilePage";
   import "./room.css";
const MODES = ["Card", "UPI", "Cash", "Other"];
const PAGES = ["Dashboard", "Payments", "Friends", "Split", "Profile"];
const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");
const todayLocal = () => new Date().toLocaleDateString("en-CA");
const sumAmt = (list) => list.reduce((s, e) => s + Number(e.amount), 0);

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <p style={{ padding: 40 }}>Loading...</p>;
     return session ? <Shell session={session} /> : <AuthChoice emailForm={<Auth />} />;
}

function Auth() {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="topbar"><span className="brand">SplitPay</span></div>
      <div className="auth">
        <h1>{mode === "signup" ? "Create your ledger" : "Welcome back"}</h1>
        <p className="sub">
          Email and password only. Your data stays private to this account.
        </p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {message && <p className="error">{message}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="switch">
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button className="link" type="button"
            onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }}>
            {mode === "signup" ? "Log in" : "Create account"}
          </button>
        </p>
      </div>
    </>
  );
}

function Shell({ session }) {
  const myId = session.user.id;
  const [page, setPage] = useState("Payments");
  const [entries, setEntries] = useState([]);
  const [friends, setFriends] = useState([]);
  const [connections, setConnections] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const [e, f, c, p] = await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("friends").select("*").order("name"),
      supabase.from("connections").select("*"),
      supabase.from("profiles").select("id, name, friend_code"),
    ]);
    const err = e.error || f.error || c.error || p.error;
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
    setConnections(c.data);
    setProfiles(p.data);
    setEntries(
      e.data.map((en) =>
        en.user_id === myId
          ? en
          : {
              ...en,
              friend: local[en.user_id] || names[en.user_id] || "Friend",
              paid_by: en.paid_by === "me" ? "friend" : "me",
              shared: true,
            }
      )
    );
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session.access_token]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">SplitPay</div>
        <nav>
          {PAGES.map((p) => (
            <button key={p}
              className={"nav" + (page === p ? " active" : "")}
              onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </nav>
        <button className="ghost logout" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </aside>

      <main className="main">
        {error && <p className="error">{error}</p>}
        {page === "Dashboard" && <Dashboard entries={entries} session={session} />}
        {page === "Payments" && (
             <PaymentsHub
            entries={entries}
            friends={friends}
            reload={load}
            setError={setError}
            goFriends={() => setPage("Friends")}
            myName={session.user.user_metadata?.name}
          />
        )}
        {page === "Friends" && (
          <Friends
            friends={friends}
            connections={connections}
            profiles={profiles}
            entries={entries}
            myId={myId}
            reload={load}
            setError={setError}
          />
        )}
        {page === "Split" && (
          <>
            <h1>Split</h1>
               <SplitHub
              entries={entries}
              friends={friends}
              reload={load}
              setError={setError}
              goFriends={() => setPage("Friends")}
              myName={session.user.user_metadata?.name}
            />
          </>
        )}
           {page === "Profile" && <ProfilePage session={session} profiles={profiles} />}
      </main>
    </div>
  );
}

function Dashboard({ entries, session }) {
  const name = session.user.user_metadata?.name;
  const map = {};
  entries
    .filter((e) => e.status !== "Settled")
    .forEach((e) => {
      const amt = Number(e.amount) * (e.paid_by === "friend" ? -1 : 1);
      map[e.friend] = (map[e.friend] || 0) + amt;
    });
  const rows = Object.entries(map).filter(([, v]) => v !== 0);
  const owedToYou = rows.reduce((s, [, v]) => (v > 0 ? s + v : s), 0);
  const youOwe = rows.reduce((s, [, v]) => (v < 0 ? s - v : s), 0);

  return (
    <>
      <h1>{name ? `Hi, ${name}` : "Dashboard"}</h1>
      <p className="sub">Here is where you stand with your friends.</p>
      <div className="stats">
        <div className="stat">
          <div className="label">Friends owe you</div>
          <div className="value pos">{rupee(owedToYou)}</div>
        </div>
        <div className="stat">
          <div className="label">You owe</div>
          <div className="value neg">{rupee(youOwe)}</div>
        </div>
        <div className="stat">
          <div className="label">Net</div>
          <div className="value">{rupee(owedToYou - youOwe)}</div>
        </div>
      </div>
      <SpendingChart entries={entries} />
      <PaidSummary entries={entries} />
      <h2>Balances</h2>
      {rows.length === 0 && <p className="sub">All settled up.</p>}
      {rows.map(([friend, v]) => (
        <div className="entry" key={friend}>
          <div className="entry-name">{friend}</div>
          <div className={"entry-amount " + (v > 0 ? "pos" : "neg")}>
            {v > 0 ? `owes you ${rupee(v)}` : `you owe ${rupee(-v)}`}
          </div>
        </div>
      ))}
    </>
  );
}

function Payments({ entries, friends, reload, setError, goFriends, myName }) {
  const [friend, setFriend] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [paidBy, setPaidBy] = useState("me");
  const [mode, setMode] = useState("UPI");
  const [filter, setFilter] = useState("All");
  const [lastAdded, setLastAdded] = useState(null);

  async function add(e) {
    e.preventDefault();
    if (!friend || !amount) return;
    const { data, error } = await supabase
      .from("entries")
      .insert({
        friend,
        amount: Number(amount),
        note,
        mode,
        paid_by: paidBy,
        payment_date: date,
        due_date: due || null,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setAmount("");
    setNote("");
    setDue("");
    await reload();
    setLastAdded(paidBy === "me" ? { id: data.id } : null);
  }

  function remind(en) {
    const f = friends.find((x) => x.name === en.friend);
    const text = buildMessage({ friend: en.friend, entries, entry: en, myName });
    openWhatsApp(f && f.phone, text);
  }

  async function sendQR() {
    const upi = getUpi();
    if (!upi.id) {
      setError("First save your UPI ID in Profile.");
      return;
    }
    await shareQR(upi.id, upi.name);
  }

  async function toggle(en) {
    await supabase
      .from("entries")
      .update({ status: en.status === "Settled" ? "Pending" : "Settled" })
      .eq("id", en.id);
    reload();
  }

  async function remove(id) {
    await supabase.from("entries").delete().eq("id", id);
    reload();
  }

  const added = lastAdded && entries.find((x) => x.id === lastAdded.id);
  const shown = entries.filter((e) => filter === "All" || e.mode === filter);
  const total = sumAmt(shown);

  return (
    <>
      <h1>Payments</h1>
      <p className="sub">Record payments and keep track of what you owe each other.</p>

      {added && (
        <div className="card notify">
          <h3>Payment added ✅</h3>
          <p className="sub" style={{ margin: "8px 0 0" }}>
            Send {added.friend} a reminder on WhatsApp?
          </p>
          <div className="actions">
            <button className="small" onClick={() => remind(added)}>
              Send on WhatsApp
            </button>
            <button className="ghost" onClick={sendQR}>Get QR image</button>
            <button className="ghost" onClick={() => setLastAdded(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <form className="card" onSubmit={add}>
        <h3>Add a payment</h3>

        <label>Friend</label>
        <select value={friend} onChange={(e) => setFriend(e.target.value)} required>
          <option value="">Select a friend</option>
          {friends.map((f) => (
            <option key={f.id} value={f.name}>{f.name}</option>
          ))}
        </select>
        {friends.length === 0 && (
          <p className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
            No friends yet.{" "}
            <button type="button" className="link" onClick={goFriends}>
              Add a friend first
            </button>
          </p>
        )}

        <div className="row2">
          <div>
            <label>Amount (₹)</label>
            <input type="number" placeholder="500" value={amount}
              onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label>Payment date</label>
            <input type="date" value={date}
              onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        <label>Pay me back by (optional)</label>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />

        <label>Description</label>
        <input placeholder="Lunch, movie tickets, cab..." value={note}
          onChange={(e) => setNote(e.target.value)} />

        <label>Who paid?</label>
        <div className="seg">
          <button type="button" className={paidBy === "me" ? "on" : ""}
            onClick={() => setPaidBy("me")}>I paid</button>
          <button type="button" className={paidBy === "friend" ? "on" : ""}
            onClick={() => setPaidBy("friend")}>Friend paid</button>
        </div>

        <label>Paid via</label>
        <div className="seg">
          {MODES.map((m) => (
            <button key={m} type="button" className={mode === m ? "on" : ""}
              onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>

        <button className="primary" type="submit">Add Payment</button>
      </form>

      <h2>Payment history</h2>
      <div className="tabs">
        {["All", ...MODES].map((m) => (
          <button key={m}
            className={"tab" + (filter === m ? " active" : "")}
            onClick={() => setFilter(m)}>
            {m}
          </button>
        ))}
      </div>
      <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
        {filter} total: {rupee(total)}
      </p>

      {shown.length === 0 && <p className="sub">No payments here yet.</p>}
      {shown.map((en) => (
        <div className={"entry" + (en.status === "Settled" ? " settled" : "")} key={en.id}>
          <div>
            <div className="entry-name">{en.friend}</div>
            <div className="entry-meta">
              {new Date(en.payment_date).toLocaleDateString("en-IN")} · {en.mode}
              {en.note ? ` · ${en.note}` : ""}
              {en.due_date
                ? ` · Due ${new Date(en.due_date + "T00:00:00").toLocaleDateString("en-IN")}`
                : ""}
            </div>
          </div>
          <div className="entry-right">
            <div className={"entry-amount " + (en.paid_by === "me" ? "pos" : "neg")}>
              {en.paid_by === "me" ? "You paid " : `${en.friend} paid `}
              {rupee(en.amount)}
            </div>
            {en.paid_by === "me" && en.status !== "Settled" && (
              <>
                <button className="remind" onClick={() => remind(en)}>Remind</button>
                {" · "}
              </>
            )}
            {en.shared ? (
              <span className="entry-meta">Added by {en.friend}</span>
            ) : (
              <>
                <button className="del muted" onClick={() => toggle(en)}>
                  {en.status === "Settled" ? "Mark pending" : "Mark settled"}
                </button>
                {" · "}
                <button className="del" onClick={() => remove(en.id)}>Delete</button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function Friends({ friends, connections, profiles, entries, myId, reload, setError }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id) => (profiles.find((p) => p.id === id) || {}).name || "Someone";
  const incoming = connections.filter((c) => c.status === "pending" && c.addressee === myId);
  const outgoing = connections.filter((c) => c.status === "pending" && c.requester === myId);

  async function sendRequest(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("send_friend_request", {
      p_code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setNotice(data);
    setCode("");
    reload();
  }

  async function respond(id, accept) {
    const { data, error } = await supabase.rpc("respond_friend_request", {
      p_id: id,
      p_accept: accept,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setNotice(data);
    reload();
  }

  async function addManual(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase
      .from("friends")
      .insert({ name: n, phone: phone.trim() || null });
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setName("");
    setPhone("");
    reload();
  }

  async function remove(id) {
    await supabase.from("friends").delete().eq("id", id);
    reload();
  }

  const selected = friends.find((f) => f.id === selectedId);

  if (selected) {
    const list = entries.filter((e) => e.friend === selected.name);
    const iPaid = list.filter((e) => e.paid_by === "me");
    const theyPaid = list.filter((e) => e.paid_by === "friend");
    const pendingMine = sumAmt(iPaid.filter((e) => e.status !== "Settled"));
    const pendingTheirs = sumAmt(theyPaid.filter((e) => e.status !== "Settled"));
    const net = pendingMine - pendingTheirs;

    return (
      <>
        <button className="back" onClick={() => setSelectedId(null)}>← All friends</button>
        <h1>
          {selected.name}
          {selected.linked_user_id && <span className="badge">Linked</span>}
        </h1>
        <p className="sub">{selected.phone || "No WhatsApp number saved"}</p>

        <div className="stats">
          <div className="stat">
            <div className="label">You paid for them</div>
            <div className="value pos">{rupee(sumAmt(iPaid))}</div>
          </div>
          <div className="stat">
            <div className="label">They paid for you</div>
            <div className="value neg">{rupee(sumAmt(theyPaid))}</div>
          </div>
          <div className="stat">
            <div className="label">Right now</div>
            <div className={"value " + (net > 0 ? "pos" : net < 0 ? "neg" : "")}
              style={{ fontSize: 22 }}>
              {net > 0
                ? `${selected.name} owes you ${rupee(net)}`
                : net < 0
                ? `You owe ${selected.name} ${rupee(-net)}`
                : "All settled up"}
            </div>
          </div>
        </div>

        <h2>History</h2>
        {list.length === 0 && <p className="sub">No payments with {selected.name} yet.</p>}
        {list.map((en) => (
          <div className={"entry" + (en.status === "Settled" ? " settled" : "")} key={en.id}>
            <div>
              <div className="entry-name">
                {new Date(en.payment_date).toLocaleDateString("en-IN")} · {en.mode}
              </div>
              <div className="entry-meta">
                {en.note || "No description"}
                {en.due_date
                  ? ` · Due ${new Date(en.due_date + "T00:00:00").toLocaleDateString("en-IN")}`
                  : ""}
                {en.shared ? ` · Added by ${en.friend}` : ""}
              </div>
            </div>
            <div className="entry-right">
              <div className={"entry-amount " + (en.paid_by === "me" ? "pos" : "neg")}>
                {en.paid_by === "me" ? "You paid " : `${selected.name} paid `}
                {rupee(en.amount)}
              </div>
              <div className="entry-meta">{en.status === "Settled" ? "Settled" : "Pending"}</div>
            </div>
          </div>
        ))}
      </>
    );
  }

  const shownFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <h1>Friends</h1>
      <p className="sub">Connect with friends using their SplitPay ID, or add people by name.</p>

      {notice && (
        <div className="card notify">
          <strong>{notice}</strong>
          <div className="actions">
            <button className="ghost" onClick={() => setNotice("")}>OK</button>
          </div>
        </div>
      )}

            <InviteClaim reload={reload} setError={setError} />
         <FriendScan profiles={profiles} myId={myId} reload={reload} setError={setError} />
      <form className="card" onSubmit={sendRequest}>
        <h3>Add a friend by SplitPay ID</h3>
        <label>Their ID</label>
        <input value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="Example: A3F9C21B" />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Please wait..." : "Send request"}
        </button>
      </form>

      {incoming.length > 0 && (
        <div className="card">
          <h3>Requests for you</h3>
          {incoming.map((c) => (
            <div className="entry" key={c.id}>
              <div className="entry-name">{nameOf(c.requester)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="small" onClick={() => respond(c.id, true)}>Accept</button>
                <button className="ghost" onClick={() => respond(c.id, false)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="card">
          <h3>Waiting for them to accept</h3>
          {outgoing.map((c) => (
            <div className="entry" key={c.id}>
              <div className="entry-name">{nameOf(c.addressee)}</div>
              <span className="badge warn">Pending</span>
            </div>
          ))}
        </div>
      )}

      <h2>Your friends</h2>
      <input placeholder="Search by name" value={query}
        onChange={(e) => setQuery(e.target.value)} />
      {shownFriends.length === 0 && <p className="sub">No friends found.</p>}
      {shownFriends.map((f) => (
        <div className="entry row-click" key={f.id} onClick={() => setSelectedId(f.id)}>
          <div>
            <div className="entry-name">
              {f.name}
              {f.linked_user_id && <span className="badge">Linked</span>}
            </div>
            <div className="entry-meta">{f.phone || "No WhatsApp number"}</div>
          </div>
          <button className="del"
            onClick={(e) => { e.stopPropagation(); remove(f.id); }}>
            Delete
          </button>
        </div>
      ))}

      <form className="card" onSubmit={addManual}>
        <h3>Add a friend without an account</h3>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Friend's name" required />
        <label>WhatsApp number (for reminders)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="9876543210" inputMode="tel" />
        <button className="primary" type="submit">Add Friend</button>
      </form>
    </>
  );
}

function Profile({ session, profiles }) {
  const me = profiles.find((p) => p.id === session.user.id);
  const code = me ? me.friend_code : "";
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function share() {
    openWhatsApp(
      null,
      `Add me on SplitPay! My ID is ${code}. Open Friends and paste my ID.`
    );
  }

  return (
    <>
      <h1>Profile</h1>
      <p className="sub">
        {session.user.user_metadata?.name || "Your account"} · {session.user.email}
      </p>

      <div className="card">
        <h3>Your SplitPay ID</h3>
        <p className="sub" style={{ margin: "8px 0 0" }}>
          Share this with friends so they can connect with you.
        </p>
        <div className="idbox">{code || "..."}</div>
        <div className="actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="small" onClick={copy} disabled={!code}>
            {copied ? "Copied!" : "Copy ID"}
          </button>
          <button className="ghost" onClick={share} disabled={!code}>
            Share on WhatsApp
          </button>
        </div>
      </div>

      <QRSection />
      <button className="ghost" style={{ marginTop: 24 }}
        onClick={() => supabase.auth.signOut()}>
        Log out
      </button>
    </>
  );
}

        const COLORS = ["#3fdc8c", "#2f9aa6", "#3b9fcb", "#5df2a2", "#ffd166", "#ff9bb0", "#8aa7ff"];

function SpendingChart({ entries }) {
  const [by, setBy] = useState("mode");

  const totals = {};
  entries.forEach((e) => {
    const key = by === "mode" ? e.mode : e.friend;
    totals[key] = (totals[key] || 0) + Number(e.amount);
  });
  const data = Object.entries(totals).map(([name, value]) => ({ name, value }));

  return (
    <div className="card">
      <h3>Payment breakdown</h3>
      <div className="seg" style={{ marginTop: 12 }}>
        <button type="button" className={by === "mode" ? "on" : ""}
          onClick={() => setBy("mode")}>By payment mode</button>
        <button type="button" className={by === "friend" ? "on" : ""}
          onClick={() => setBy("friend")}>By friend</button>
      </div>

      {data.length === 0 ? (
        <p className="sub" style={{ marginTop: 16 }}>Add payments to see the chart.</p>
      ) : (
        <div style={{ width: "100%", height: 320, marginTop: 8 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => rupee(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PaidSummary({ entries }) {
  const iPaid = {};
  const theyPaid = {};

  entries.forEach((e) => {
    const target = e.paid_by === "me" ? iPaid : theyPaid;
    if (!target[e.friend]) target[e.friend] = { total: 0, count: 0 };
    target[e.friend].total += Number(e.amount);
    target[e.friend].count += 1;
  });

  const mine = Object.entries(iPaid).sort((a, b) => b[1].total - a[1].total);
  const theirs = Object.entries(theyPaid).sort((a, b) => b[1].total - a[1].total);
  const sum = (list) => list.reduce((s, [, v]) => s + v.total, 0);

  function List({ list, cls }) {
    if (list.length === 0) return <p className="sub">No payments yet.</p>;
    return list.map(([name, v]) => (
      <div className="entry" key={name}>
        <div>
          <div className="entry-name">{name}</div>
          <div className="entry-meta">
            {v.count} payment{v.count > 1 ? "s" : ""}
          </div>
        </div>
        <div className={"entry-amount " + cls}>{rupee(v.total)}</div>
      </div>
    ));
  }

  return (
    <div className="two-col">
      <div className="card">
        <h3>You paid for</h3>
        <p className="sub" style={{ marginBottom: 8 }}>
          {mine.length} friend{mine.length === 1 ? "" : "s"} · total {rupee(sum(mine))}
        </p>
        <List list={mine} cls="pos" />
      </div>
      <div className="card">
        <h3>Paid for you</h3>
        <p className="sub" style={{ marginBottom: 8 }}>
          {theirs.length} friend{theirs.length === 1 ? "" : "s"} · total {rupee(sum(theirs))}
        </p>
        <List list={theirs} cls="neg" />
      </div>
    </div>
  );
}
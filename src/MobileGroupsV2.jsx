/* My Groups (matches the mockup): Create Group, All / Active / Archived, group list, group detail with "Add friend". */
import { useEffect, useState } from "react";
import "./mobile-groups.css";
import { supabase } from "./supabaseClient";
import { hue, ini } from "./DesktopHome";

const money = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const EMOJIS = ["🏖️", "🎓", "🏠", "💼", "🍽️", "✈️", "🎉", "🛒"];
const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: (<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}
const Dot = ({ name, s = 34 }) => (
  <i className="gv-dot" style={{ width: s, height: s, fontSize: s * 0.4, background: hue(name) }}>{ini(name)}</i>
);

export default function MobileGroupsV2({ friends, entries, reload, setError, goSplit, go }) {
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState({}); // groupId -> [friendId as string]
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState({ t: "list" });
  const [pill, setPill] = useState("All");
  const [sheet, setSheet] = useState(null); // "create" | "add"
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // create form
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [pick, setPick] = useState([]);
  // add friend form
  const [newName, setNewName] = useState("");

  async function load() {
    const g = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    if (g.error) {
      setMissing(/relation|does not exist|schema cache|groups/i.test(g.error.message));
      setMsg(g.error.message);
      setLoading(false);
      return;
    }
    const m = await supabase.from("group_members").select("*");
    const map = {};
    (m.data || []).forEach((r) => { (map[r.group_id] = map[r.group_id] || []).push(String(r.friend_id)); });
    setGroups(g.data);
    setMembers(map);
    setMissing(false);
    setMsg("");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const friendById = (id) => friends.find((f) => String(f.id) === String(id));
  const stats = (gid) => {
    const fr = (members[gid] || []).map(friendById).filter(Boolean);
    const names = fr.map((f) => f.name);
    const open = entries.filter((e) => names.includes(e.friend) && e.status !== "Settled");
    const get = open.filter((e) => e.paid_by === "me").reduce((s, e) => s + Number(e.amount), 0);
    const owe = open.filter((e) => e.paid_by === "friend").reduce((s, e) => s + Number(e.amount), 0);
    return { fr, total: get + owe, net: get - owe, open };
  };

  async function createGroup() {
    const n = name.trim();
    if (!n) { setMsg("Give the group a name."); return; }
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.from("groups").insert({ name: n, emoji }).select("id");
    if (error || !data || !data[0]) { setBusy(false); setMsg(error ? error.message : "Could not create the group."); return; }
    if (pick.length) {
      const { error: e2 } = await supabase.from("group_members").insert(pick.map((fid) => ({ group_id: data[0].id, friend_id: String(fid) })));
      if (e2) setMsg(e2.message);
    }
    setBusy(false);
    setSheet(null); setName(""); setPick([]); setEmoji(EMOJIS[0]);
    await load();
  }

  async function addMember(gid, fid) {
    const { error } = await supabase.from("group_members").insert({ group_id: gid, friend_id: String(fid) });
    if (error && !/duplicate|unique/i.test(error.message)) { setMsg(error.message); return; }
    await load();
  }
  async function addNewFriend(gid) {
    const n = newName.trim();
    if (!n) return;
    setBusy(true);
    const { data, error } = await supabase.from("friends").insert({ name: n, phone: null }).select("id");
    if (error || !data || !data[0]) { setBusy(false); setMsg(error ? error.message : "Could not add the friend."); return; }
    await addMember(gid, data[0].id);
    setBusy(false);
    setNewName("");
    if (reload) reload();
  }
  async function removeMember(gid, fid) {
    await supabase.from("group_members").delete().eq("group_id", gid).eq("friend_id", String(fid));
    await load();
  }
  async function setArchived(g, v) {
    await supabase.from("groups").update({ archived: v }).eq("id", g.id);
    setMenu(false);
    await load();
  }
  async function deleteGroup(g) {
    if (!window.confirm(`Delete the group "${g.name}"? Your friends and expenses stay.`)) return;
    await supabase.from("groups").delete().eq("id", g.id);
    setMenu(false);
    setView({ t: "list" });
    await load();
  }

  /* ---------------- setup needed ---------------- */
  if (!loading && missing) {
    return (
      <div className="gv">
        <h1 className="gv-h">My Groups</h1>
        <div className="gv-card gv-warn">
          <b>One-time setup needed</b>
          <p>Groups need two small tables in your database. Open Supabase, go to SQL Editor, paste the contents of <b>groups_setup.sql</b> and press Run. Then reload this page.</p>
          <small>{msg}</small>
        </div>
      </div>
    );
  }

  /* ---------------- group detail ---------------- */
  const g = view.t === "detail" ? groups.find((x) => x.id === view.id) : null;
  if (view.t === "detail" && !g) { setView({ t: "list" }); return null; }
  if (g) {
    const st = stats(g.id);
    const notIn = friends.filter((f) => !(members[g.id] || []).includes(String(f.id)));
    return (
      <div className="gv">
        <div className="gv-bar">
          <button type="button" className="gv-ib" onClick={() => { setMenu(false); setView({ t: "list" }); }} aria-label="Back"><Ic n="back" /></button>
          <button type="button" className="gv-ib" onClick={() => setMenu(!menu)} aria-label="More"><Ic n="more" /></button>
          {menu && (
            <div className="gv-menu">
              <button type="button" onClick={() => setArchived(g, !g.archived)}>{g.archived ? "Unarchive group" : "Archive group"}</button>
              <button type="button" className="red" onClick={() => deleteGroup(g)}>Delete group</button>
            </div>
          )}
        </div>

        <div className="gv-top">
          <span className="gv-emoji big">{g.emoji}</span>
          <h1 className="gv-h">{g.name}</h1>
          <p className="gv-sub">{st.fr.length} member{st.fr.length === 1 ? "" : "s"} · {st.net === 0 ? "All settled" : st.net > 0 ? `You're owed ${money(st.net)}` : `You owe ${money(-st.net)}`}</p>
        </div>

        <div className="gv-head"><h2>Members</h2></div>
        <button type="button" className="gv-addfriend" onClick={() => { setMsg(""); setSheet("add"); }}>
          <span><Ic n="plus" s={20} /></span> Add friend
        </button>
        <div className="gv-list">
          <div className="gv-mem">
            <Dot name="You" s={42} /><b>You</b><small>Owner</small>
          </div>
          {st.fr.map((f) => {
            const open = entries.filter((e) => e.friend === f.name && e.status !== "Settled");
            const net = open.filter((e) => e.paid_by === "me").reduce((s, e) => s + Number(e.amount), 0) - open.filter((e) => e.paid_by === "friend").reduce((s, e) => s + Number(e.amount), 0);
            return (
              <div className="gv-mem" key={f.id}>
                <Dot name={f.name} s={42} />
                <b>{f.name}</b>
                <small className={net > 0 ? "get" : net < 0 ? "owe" : ""}>{net > 0 ? `owes you ${money(net)}` : net < 0 ? `you owe ${money(-net)}` : "settled"}</small>
                <button type="button" className="gv-x" onClick={() => removeMember(g.id, f.id)} aria-label={`Remove ${f.name}`}><Ic n="close" s={16} /></button>
              </div>
            );
          })}
        </div>

        {goSplit && <button type="button" className="gv-big" onClick={goSplit}>Split a Bill</button>}
        {msg && <p className="gv-err" role="alert">{msg}</p>}

        {sheet === "add" && (
          <div className="gv-bg" onClick={() => setSheet(null)}>
            <div className="gv-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add friend">
              <h3>Add friend to {g.name}</h3>
              {notIn.length > 0 && (
                <div className="gv-pickrow">
                  {notIn.map((f) => (
                    <button type="button" key={f.id} onClick={() => addMember(g.id, f.id)}>
                      <Dot name={f.name} s={40} /><span>{f.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              )}
              <label className="gv-lbl">Or add someone new by name</label>
              <div className="gv-new">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Friend's name" />
                <button type="button" disabled={busy || !newName.trim()} onClick={() => addNewFriend(g.id)}>Add</button>
              </div>
              <small className="gv-hint">To connect a friend who uses SplitPay, use their SplitPay ID or QR from the Friends page first, then add them here.</small>
              {go && <button type="button" className="gv-friendslink" onClick={() => { setSheet(null); go("Friends"); }}>Open Friends page →</button>}
              <button type="button" className="gv-done" onClick={() => setSheet(null)}>Done</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- list ---------------- */
  const shown = groups.filter((x) => (pill === "All" ? true : pill === "Active" ? !x.archived : x.archived));

  return (
    <div className="gv">
      <h1 className="gv-h">My Groups</h1>
      <p className="gv-sub">Manage group expenses and balances.</p>

      <button type="button" className="gv-big" onClick={() => { setMsg(""); setSheet("create"); }}>
        <Ic n="users" s={26} /> Create Group
      </button>

      {go && (
        <button type="button" className="gv-friendslink" onClick={() => go("Friends")}>Friends, invites &amp; QR →</button>
      )}

      <div className="gv-pills">
        {["All", "Active", "Archived"].map((p) => (
          <button key={p} type="button" className={pill === p ? "on" : ""} onClick={() => setPill(p)}>{p}</button>
        ))}
      </div>

      {loading && <p className="gv-empty">Loading...</p>}
      {!loading && shown.length === 0 && (
        <p className="gv-empty">{groups.length === 0 ? "No groups yet. Tap Create Group to make your first one." : "Nothing here."}</p>
      )}

      {shown.length > 0 && (
        <div className="gv-list">
          {shown.map((x) => {
            const st = stats(x.id);
            return (
              <button type="button" className="gv-row" key={x.id} onClick={() => { setMsg(""); setView({ t: "detail", id: x.id }); }}>
                <span className="gv-emoji">{x.emoji}</span>
                <span className="gv-mid">
                  <b>{x.name}</b>
                  <small>{st.fr.length + 1} members · {money(st.total)}</small>
                </span>
                <span className="gv-chev">›</span>
              </button>
            );
          })}
        </div>
      )}

      {sheet === "create" && (
        <div className="gv-bg" onClick={() => setSheet(null)}>
          <div className="gv-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create group">
            <h3>Create Group</h3>
            <label className="gv-lbl">Group name</label>
            <input className="gv-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa Trip" />
            <label className="gv-lbl">Pick an icon</label>
            <div className="gv-emojis">
              {EMOJIS.map((em) => (
                <button type="button" key={em} className={emoji === em ? "on" : ""} onClick={() => setEmoji(em)}>{em}</button>
              ))}
            </div>
            <label className="gv-lbl">Add friends</label>
            {friends.length === 0 ? (
              <small className="gv-hint">You have no friends yet. Create the group now, then add friends inside it.</small>
            ) : (
              <div className="gv-pickrow">
                {friends.map((f) => {
                  const on = pick.map(String).includes(String(f.id));
                  return (
                    <button type="button" key={f.id} className={on ? "on" : ""}
                      onClick={() => setPick(on ? pick.filter((x) => String(x) !== String(f.id)) : [...pick, f.id])}>
                      <Dot name={f.name} s={40} /><span>{f.name.split(" ")[0]}</span>
                      {on && <i className="gv-tick"><Ic n="check" s={11} /></i>}
                    </button>
                  );
                })}
              </div>
            )}
            {msg && <p className="gv-err" role="alert">{msg}</p>}
            <button type="button" className="gv-done" disabled={busy} onClick={createGroup}>{busy ? "Creating..." : "Create Group"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

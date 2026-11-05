/* Phone "Analytics" (matches the mockup): Overview / Monthly / Category.
   Everything is worked out from your saved entries. */
import { useState } from "react";
import "./mobile-friends-analytics.css";

const money = (n) => "₹" + Math.round(Math.abs(Number(n))).toLocaleString("en-IN");

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  cal: (<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  down: <path d="M6 9l6 6 6-6" />,
  bars: <path d="M5 20V10M12 20V4M19 20v-7" />,
  up: <path d="M12 19V6M6 12l6-6 6 6" />,
  dn: <path d="M12 5v13M6 12l6 6 6-6" />,
  user: (<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.8 3-6 7-6s7 2.2 7 6" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" /></>),
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

const CATS = ["Food", "Travel", "Stay", "Transport", "Other"];
const CAT_COLOR = { Food: "#f08a24", Travel: "#6a52e0", Stay: "#1c9a5b", Transport: "#2f6df0", Other: "#8a97b5" };
const KEYS = [
  ["Food", /dinner|lunch|breakfast|cafe|chai|tea|coffee|food|pizza|restaurant|meal|snack|biryani|burger|groceries/i],
  ["Travel", /trip|travel|flight|train|bus|manali|goa|tour|ticket|railway/i],
  ["Stay", /hotel|stay|room|rent|hostel|airbnb/i],
  ["Transport", /cab|uber|ola|fuel|petrol|diesel|auto|metro|taxi|transport|airport/i],
];
const catOf = (note, title) => {
  const raw = String(note || "");
  for (const c of CATS) if (raw.startsWith(c + " · ")) return c;
  for (const [c, re] of KEYS) if (re.test(title)) return c;
  return "Other";
};
const cleanTitle = (note, mode) => {
  let t = String(note || "").trim();
  t = t.replace(/^(Food|Travel|Stay|Transport|Other) · /, "");
  t = t.replace(/^split:\s*/i, "");
  t = t.replace(/\s*\(\d+ people\).*$/i, "");
  return t || mode || "Payment";
};

/* turn entries into whole expenses: total, your share, others' share */
function buildExpenses(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = [e.note, String(e.payment_date || e.created_at || "").slice(0, 10), e.paid_by, e.created_at || ""].join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.values()].map((rows) => {
    const f = rows[0];
    const note = String(f.note || "");
    const s = rows.reduce((a, x) => a + Number(x.amount), 0);
    const m = note.match(/\((\d+) people\)/i);
    const n = m ? Number(m[1]) : rows.length + 1;
    const isSplit = /split:/i.test(note);
    const merchant = /\(UPI via /i.test(note);
    let total = s;
    let mine = 0;
    if (merchant) { mine = s; }
    else if (isSplit) {
      if (f.paid_by === "me") { total = (s * n) / Math.max(1, n - 1); mine = total - s; }
      else { total = Number(f.amount) * n; mine = Number(f.amount); }
    } else if (f.paid_by !== "me") { mine = s; }
    const title = cleanTitle(note, f.mode);
    return {
      month: String(f.payment_date || f.created_at || "").slice(0, 7),
      day: String(f.payment_date || f.created_at || "").slice(0, 10),
      title,
      cat: catOf(note, title),
      total, mine, others: Math.max(0, total - mine),
    };
  });
}

const mkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const mlabel = (k, short) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", short ? { month: "short" } : { month: "short", year: "numeric" });
};
const dlabel = (x) => new Date(x + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function MobileAnalytics({ entries, go }) {
  const [tab, setTab] = useState("overview");
  const now = new Date();
  const curKey = mkey(now);
  const [sel, setSel] = useState(curKey);

  const exps = buildExpenses(entries);
  const months = [];
  for (let i = 0; i < 12; i++) months.push(mkey(new Date(now.getFullYear(), now.getMonth() - i, 1)));

  const agg = {};
  exps.forEach((x) => {
    const a = agg[x.month] || (agg[x.month] = { total: 0, mine: 0, others: 0, count: 0 });
    a.total += x.total; a.mine += x.mine; a.others += x.others; a.count += 1;
  });
  const get = (k) => agg[k] || { total: 0, mine: 0, others: 0, count: 0 };

  const [sy, sm] = sel.split("-").map(Number);
  const prevKey = mkey(new Date(sy, sm - 2, 1));
  const cur = get(sel);
  const prev = get(prevKey);
  const pct = prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null;
  const inSel = exps.filter((x) => x.month === sel).sort((a, b) => (a.day < b.day ? 1 : -1));
  const allTime = exps.reduce((s, x) => s + x.total, 0);

  const catTotals = CATS.map((c) => ({ c, v: inSel.filter((x) => x.cat === c).reduce((s, x) => s + x.total, 0) }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v);

  const last6 = months.slice(0, 6).reverse();
  const max6 = Math.max(1, ...last6.map((k) => get(k).total));

  const monthSelect = (
    <label className="an-sel">
      <Ic n="cal" s={20} />
      <span>{sel === curKey ? "This Month" : mlabel(sel)}</span>
      <Ic n="down" s={18} />
      <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Choose month">
        {months.map((k) => <option key={k} value={k}>{k === curKey ? "This Month" : mlabel(k)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fr an fr-pad">
      <div className="fr-bar">
        <button type="button" className="fr-ib" onClick={() => go("Dashboard")} aria-label="Back"><Ic n="back" /></button>
        <h2>Analytics</h2>
        <span className="fr-ib ghost" />
      </div>

      <div className="an-tabs" role="tablist">
        {[["overview", "Overview"], ["monthly", "Monthly"], ["category", "Category"]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab !== "monthly" && monthSelect}

      {tab === "overview" && (
        <>
          <div className="an-total">
            <div>
              <small>Total Expenses</small>
              <b>{money(cur.total)}</b>
              {pct !== null ? (
                <span className={"an-pct " + (pct > 0 ? "up" : "dn")}><Ic n={pct > 0 ? "up" : "dn"} s={14} /> {Math.abs(pct)}% {pct > 0 ? "more" : "less"} than {prevKey === mkey(new Date(now.getFullYear(), now.getMonth() - 1, 1)) && sel === curKey ? "last month" : mlabel(prevKey)}</span>
              ) : (
                <span className="an-pct">No data for the month before</span>
              )}
            </div>
            <span className="an-bars"><Ic n="bars" s={34} /></span>
          </div>

          <div className="an-two">
            <div className="an-share you"><span><Ic n="user" s={20} /> Your Share</span><b>{money(cur.mine)}</b></div>
            <div className="an-share others"><span><Ic n="users" s={20} /> Others' Share</span><b>{money(cur.others)}</b></div>
          </div>

          <p className="an-all">All time: <b>{money(allTime)}</b> across {exps.length} expense{exps.length === 1 ? "" : "s"}</p>

          <h3 className="fr-h3">{sel === curKey ? "This month's expenses" : `${mlabel(sel)} expenses`}</h3>
          {inSel.length === 0 ? (
            <div className="fr-empty"><b>No expenses in this month</b><p>Pick another month, or add an expense.</p></div>
          ) : (
            <div className="an-list">
              {inSel.slice(0, 8).map((x, i) => (
                <div className="an-row" key={i}>
                  <i style={{ background: CAT_COLOR[x.cat] }} />
                  <span><b>{x.title}</b><small>{x.cat} · {dlabel(x.day)}</small></span>
                  <b>{money(x.total)}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "monthly" && (
        <>
          <h3 className="fr-h3">Last 6 months</h3>
          <div className="an-chart" role="img" aria-label="Expenses for the last 6 months">
            {last6.map((k) => {
              const v = get(k).total;
              return (
                <button type="button" key={k} className={k === sel ? "on" : ""} onClick={() => setSel(k)}>
                  <small>{v > 0 ? money(v) : ""}</small>
                  <span style={{ height: `${Math.max(4, (v / max6) * 100)}%` }} />
                  <em>{mlabel(k, true)}</em>
                </button>
              );
            })}
          </div>

          <h3 className="fr-h3">Month by month</h3>
          <div className="an-list">
            {months.filter((k) => get(k).count > 0 || k === curKey).map((k) => {
              const a = get(k);
              const p = get(mkey(new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 2, 1)));
              const ch = p.total > 0 ? Math.round(((a.total - p.total) / p.total) * 100) : null;
              return (
                <button type="button" className={"an-mrow" + (k === sel ? " on" : "")} key={k} onClick={() => setSel(k)}>
                  <span><b>{k === curKey ? `${mlabel(k)} (this month)` : mlabel(k)}</b><small>{a.count} expense{a.count === 1 ? "" : "s"}{ch !== null ? ` · ${ch >= 0 ? "↑" : "↓"} ${Math.abs(ch)}%` : ""}</small></span>
                  <b>{money(a.total)}</b>
                </button>
              );
            })}
          </div>
          <p className="an-all">Selected: <b>{mlabel(sel)}</b> · Your share {money(cur.mine)} · Others' share {money(cur.others)}</p>
        </>
      )}

      {tab === "category" && (
        <>
          <div className="an-total small">
            <div><small>Total Expenses</small><b>{money(cur.total)}</b></div>
          </div>
          {catTotals.length === 0 ? (
            <div className="fr-empty"><b>No expenses in this month</b><p>Pick another month to see its categories.</p></div>
          ) : (
            <div className="an-cats">
              {catTotals.map(({ c, v }) => {
                const share = cur.total > 0 ? Math.round((v / cur.total) * 100) : 0;
                return (
                  <div key={c} className="an-cat">
                    <div><i style={{ background: CAT_COLOR[c] }} /><b>{c}</b><span>{money(v)}</span></div>
                    <div className="an-track"><span style={{ width: `${share}%`, background: CAT_COLOR[c] }} /></div>
                    <small>{share}% of this month</small>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

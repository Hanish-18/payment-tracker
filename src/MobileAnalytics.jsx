/* Analytics (matches the mockup): Dashboard, Categories, Groups, Trends.
   Numbers come from your real entries. This file also loads the Dynamic Island + QR scanner. */
import { useEffect, useState } from "react";
import "./DynamicIsland";
import { island } from "./DynamicIsland";
import "./mobile-analytics2.css";

const money = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const dateOf = (e) => new Date(e.payment_date || e.created_at || Date.now());
const mkey = (d) => d.getFullYear() * 12 + d.getMonth();
const sumA = (l) => l.reduce((s, e) => s + Number(e.amount), 0);

function monthList(n) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: mkey(d),
      short: d.toLocaleString("en-US", { month: "short" }),
      full: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
    });
  }
  return out;
}

const CATS = [
  ["Food & Dining", "🍽️", /food|dinner|lunch|breakfast|chai|tea|coffee|cafe|snack|pizza|burger|biryani|restaurant|meal|drink|zomato|swiggy|party/i, "#1d62f0", "#ffe8dc"],
  ["Travel", "✈️", /trip|travel|cab|taxi|uber|ola|flight|ticket|hotel|train|bus|fuel|petrol|metro|goa|stay|movie/i, "#6ea0ff", "#dfeaff"],
  ["Shopping", "🛍️", /shop|cloth|amazon|flipkart|mall|gift|grocer|market|buy|bill|rent/i, "#6a5cf0", "#fff1c9"],
  ["Others", "📦", /.*/, "#b9c3d8", "#e4e8f5"],
];
const catOf = (e) => {
  const t = [e.note, e.mode].join(" ");
  const c = CATS.find((x, i) => i < 3 && x[2].test(t));
  return c ? c[0] : "Others";
};

/* smooth line through points */
function smooth(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function TrendChart({ labels, vals }) {
  const W = 300, H = 150, L = 34, R = 10, T = 10, B = 24;
  const rawMax = Math.max(...vals, 1);
  const step = rawMax <= 1000 ? 250 : rawMax <= 5000 ? 1000 : rawMax <= 20000 ? 5000 : rawMax <= 60000 ? 10000 : 25000;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, vals.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const pts = vals.map((v, i) => [Math.round(x(i)), Math.round(y(v))]);
  const line = smooth(pts);
  const k = (v) => (v >= 1000 ? v / 1000 + "K" : String(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-trend" aria-hidden="true">
      <defs>
        <linearGradient id="anfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d62f0" stopOpacity="0.28" /><stop offset="1" stopColor="#1d62f0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" opacity="0.12" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{k(t)}</text>
        </g>
      ))}
      {line && <path d={`${line} L${pts[pts.length - 1][0]} ${y(0)} L${pts[0][0]} ${y(0)} Z`} fill="url(#anfill)" />}
      {line && <path d={line} fill="none" stroke="#1d62f0" strokeWidth="2.4" strokeLinecap="round" />}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.6" fill="#fff" stroke="#1d62f0" strokeWidth="2" />)}
      {labels.map((l, i) => (
        <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.65">{l}</text>
      ))}
    </svg>
  );
}

function Donut({ data, total }) {
  const C = 2 * Math.PI * 46;
  let acc = 0;
  return (
    <div className="an-donut">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="46" fill="none" stroke="var(--tile, #eef3ff)" strokeWidth="18" />
        {data.map((c) => {
          const len = total ? (c.value / total) * C : 0;
          const el = (
            <circle key={c.name} cx="60" cy="60" r="46" fill="none" stroke={c.color} strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div><b>{money(total)}</b><small>Total</small></div>
    </div>
  );
}

export default function MobileAnalytics({ entries = [], go }) {
  const months = monthList(6);
  const [tab, setTab] = useState("dashboard");
  const [mk, setMk] = useState(months[0].key);

  useEffect(() => {
    if (!window.__spAnalyticsIsland) {
      window.__spAnalyticsIsland = true;
      island({ title: "Analytics", sub: "Your monthly summary is ready", kind: "chart" });
    }
  }, []);

  const inMonth = (key) => entries.filter((e) => mkey(dateOf(e)) === key);
  const list = inMonth(mk);
  const total = sumA(list);
  const prevTotal = sumA(inMonth(mk - 1));
  const pct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const open = entries.filter((e) => e.status !== "Settled");
  const get = sumA(open.filter((e) => e.paid_by === "me"));
  const owe = sumA(open.filter((e) => e.paid_by === "friend"));
  const settled = sumA(list.filter((e) => e.status === "Settled"));

  const trendKeys = [4, 3, 2, 1, 0].map((i) => mk - i);
  const shortOf = (key) => {
    const y = Math.floor(key / 12);
    const m = key % 12;
    return new Date(y, m, 1).toLocaleString("en-US", { month: "short" });
  };
  const trendVals = trendKeys.map((k) => sumA(inMonth(k)));

  const cats = CATS.map(([name, icon, , color, tint]) => ({
    name, icon, color, tint,
    value: sumA(list.filter((e) => catOf(e) === name)),
  }));
  const catsSorted = [...cats].sort((a, b) => b.value - a.value);

  const byFriend = {};
  list.forEach((e) => { byFriend[e.friend] = (byFriend[e.friend] || 0) + Number(e.amount); });
  const friendRows = Object.entries(byFriend).sort((a, b) => b[1] - a[1]);
  const friendMax = Math.max(1, ...friendRows.map((r) => r[1]));

  const sixKeys = [5, 4, 3, 2, 1, 0].map((i) => mk - i);
  const sixVals = sixKeys.map((k) => sumA(inMonth(k)));
  const sixMax = Math.max(1, ...sixVals);
  const avg = sixVals.reduce((s, v) => s + v, 0) / 6;

  const empty = entries.length === 0;

  return (
    <div className="an">
      <div className="an-head">
        {go && <button type="button" className="an-back" onClick={() => go("Dashboard")} aria-label="Back">‹</button>}
        <label className="an-month">
          <select value={mk} onChange={(e) => setMk(Number(e.target.value))} aria-label="Month">
            {months.map((m) => <option key={m.key} value={m.key}>{m.full}</option>)}
          </select>
          <span>▾</span>
        </label>
      </div>

      <div className="an-tabs">
        {[["dashboard", "Dashboard"], ["categories", "Categories"], ["groups", "Groups"], ["trends", "Trends"]].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {empty && <p className="an-empty">Add an expense to see your analytics.</p>}

      {!empty && tab === "dashboard" && (
        <>
          <div className="an-total">
            <div>
              <small>Total Spent</small>
              <b>{money(total)}</b>
              <em className={pct === null ? "" : pct <= 0 ? "good" : "bad"}>
                {pct === null ? "No data for last month" : `${pct <= 0 ? "▼" : "▲"} ${Math.abs(pct)}% vs last month`}
              </em>
            </div>
            <svg viewBox="0 0 120 80" aria-hidden="true">
              <rect x="10" y="52" width="16" height="22" rx="3" fill="#9dbaff" /><rect x="36" y="40" width="16" height="34" rx="3" fill="#7aa4ff" />
              <rect x="62" y="28" width="16" height="46" rx="3" fill="#4f86ff" /><rect x="88" y="12" width="16" height="62" rx="3" fill="#1d62f0" />
              <path d="M8 40l28-14 24 8 40-24" fill="none" stroke="#1d62f0" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="an-grid">
            <div className="an-mini"><span className="ic blue">✔</span><div><small>Settled</small><b>{money(settled)}</b></div></div>
            <div className="an-mini"><span className="ic red">↗</span><div><small>You Owe</small><b>{money(owe)}</b></div></div>
            <div className="an-mini"><span className="ic green">↓</span><div><small>You Get</small><b>{money(get)}</b></div></div>
            <div className="an-mini"><span className="ic blue">⚖</span><div><small>Net Balance</small><b>{get - owe < 0 ? "-" : ""}{money(Math.abs(get - owe))}</b></div></div>
          </div>

          <section className="an-card">
            <h3>Spending Trend</h3>
            <TrendChart labels={trendKeys.map(shortOf)} vals={trendVals} />
          </section>

          <section className="an-card">
            <div className="an-sh"><h3>Top Categories</h3><button type="button" onClick={() => setTab("categories")}>See All →</button></div>
            {total === 0 ? <p className="an-empty">No spending in this month.</p> : (
              <div className="an-cat">
                <Donut data={cats} total={total} />
                <div className="an-legend">
                  {catsSorted.map((c) => (
                    <div key={c.name}>
                      <span style={{ background: c.tint }}>{c.icon}</span>
                      <b>{c.name}</b>
                      <em>{Math.round((c.value / total) * 100)}%</em>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {!empty && tab === "categories" && (
        <section className="an-card">
          <h3>Categories · {months.find((m) => m.key === mk).full}</h3>
          {total === 0 && <p className="an-empty">No spending in this month.</p>}
          {catsSorted.map((c) => (
            <div className="an-bar" key={c.name}>
              <div className="top"><span style={{ background: c.tint }}>{c.icon}</span><b>{c.name}</b><em>{money(c.value)}</em></div>
              <div className="track"><i style={{ width: (total ? (c.value / total) * 100 : 0) + "%", background: c.color }} /></div>
              <small>{total ? Math.round((c.value / total) * 100) : 0}% of this month</small>
            </div>
          ))}
        </section>
      )}

      {!empty && tab === "groups" && (
        <section className="an-card">
          <h3>By friend · {months.find((m) => m.key === mk).full}</h3>
          {friendRows.length === 0 && <p className="an-empty">No spending in this month.</p>}
          {friendRows.map(([name, v]) => (
            <div className="an-bar" key={name}>
              <div className="top"><span className="av">{String(name).charAt(0).toUpperCase()}</span><b>{name}</b><em>{money(v)}</em></div>
              <div className="track"><i style={{ width: (v / friendMax) * 100 + "%", background: "#1d62f0" }} /></div>
            </div>
          ))}
        </section>
      )}

      {!empty && tab === "trends" && (
        <section className="an-card">
          <h3>Last 6 months</h3>
          <p className="an-sub">Average {money(avg)} per month</p>
          <div className="an-cols">
            {sixKeys.map((k, i) => (
              <div key={k} className={k === mk ? "top" : ""}>
                <span className="v">{sixVals[i] ? money(sixVals[i]) : ""}</span>
                <u style={{ height: Math.max(4, (sixVals[i] / sixMax) * 100) + "%" }} />
                <small>{shortOf(k)}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

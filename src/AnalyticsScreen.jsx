import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useLedger, rupee, categoryOf, CAT_COLOR, Head } from "./spkit";

const sum = (list) => list.reduce((s, e) => s + Number(e.amount), 0);
const keyOf = (s) => String(s).slice(0, 7);
const nowKey = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const prevKey = (k) => {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};
const longMonth = (k) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const shortMonth = (k) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short" });
};

export default function AnalyticsScreen({ onBack }) {
  const { entries, loading, error } = useLedger();
  const cur = nowKey();
  const [tab, setTab] = useState("overview");
  const [month, setMonth] = useState(cur);

  const monthKeys = useMemo(() => {
    const set = new Set(entries.map((e) => keyOf(e.payment_date)));
    set.add(cur);
    return [...set].sort().reverse();
  }, [entries, cur]);

  if (loading) return <p className="kt-muted">Loading...</p>;

  const inRange = entries.filter((e) => month === "all" || keyOf(e.payment_date) === month);
  const total = sum(inRange);
  const byMe = sum(inRange.filter((e) => e.paid_by === "me"));
  const byOthers = sum(inRange.filter((e) => e.paid_by === "friend"));
  const prev = month === "all" ? 0 : sum(entries.filter((e) => keyOf(e.payment_date) === prevKey(month)));
  const pct = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;

  const byMonth = {};
  entries.forEach((e) => {
    const k = keyOf(e.payment_date);
    const b = (byMonth[k] = byMonth[k] || { total: 0, count: 0 });
    b.total += Number(e.amount);
    b.count += 1;
  });
  const monthRows = Object.keys(byMonth).sort().reverse();
  const last6 = Array.from({ length: 6 }, (_, i) => {
    let k = cur;
    for (let j = 0; j < 5 - i; j++) k = prevKey(k);
    return { k, label: shortMonth(k), total: byMonth[k] ? byMonth[k].total : 0 };
  });

  const cats = {};
  inRange.forEach((e) => {
    const c = categoryOf(e.note);
    cats[c] = (cats[c] || 0) + Number(e.amount);
  });
  const catData = Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <Head title="Analytics" onBack={onBack} />
      {error && <div className="kt-err">{error}</div>}

      <div className="kt-tabs" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {[["overview", "Overview"], ["monthly", "Monthly"], ["category", "Category"]].map(([id, label]) => (
          <button key={id} className={"kt-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab !== "monthly" && (
        <select className="kt-select" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginBottom: 14 }}>
          {monthKeys.map((k) => (
            <option key={k} value={k}>{k === cur ? "This Month" : longMonth(k)}</option>
          ))}
          <option value="all">All time</option>
        </select>
      )}

      {tab === "overview" && (
        <>
          <div className="kt-card">
            <div className="kt-meta">Total Expenses</div>
            <div className="kt-total">{rupee(total)}</div>
            {pct !== null && <div className="kt-trend">{pct >= 0 ? "↑" : "↓"} {Math.abs(pct)}% vs last month</div>}
            <div className="kt-tiles">
              <div className="kt-tile g"><span>You paid</span><b>{rupee(byMe)}</b></div>
              <div className="kt-tile r"><span>Others paid</span><b>{rupee(byOthers)}</b></div>
            </div>
          </div>
          <div className="kt-card">
            <div className="kt-sec">Last 6 months</div>
            <div style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer>
                <BarChart data={last6}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => rupee(v)} cursor={{ fill: "rgba(37,99,235,.08)" }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === "monthly" && (
        <>
          <div className="kt-card">
            <div className="kt-sec">Expenses by month</div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={last6}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => rupee(v)} cursor={{ fill: "rgba(37,99,235,.08)" }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="kt-sec">Month by month</div>
          <div className="kt-list">
            {monthRows.length === 0 && <p className="kt-muted" style={{ padding: 18 }}>No payments yet.</p>}
            {monthRows.map((k) => (
              <div className="kt-h" key={k}>
                <span className="kt-ico">🗓️</span>
                <div className="kt-grow">
                  <div className="kt-name">{longMonth(k)}</div>
                  <div className="kt-meta">{byMonth[k].count} payment{byMonth[k].count === 1 ? "" : "s"}</div>
                </div>
                <div className="kt-name">{rupee(byMonth[k].total)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "category" && (
        <div className="kt-card">
          <div className="kt-sec">Spending by category</div>
          {catData.length === 0 ? (
            <p className="kt-muted">No payments in this period.</p>
          ) : (
            <>
              <div className="kt-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                      {catData.map((d) => <Cell key={d.name} fill={CAT_COLOR[d.name]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="kt-donut-mid"><b>{rupee(total)}</b><span>Total Spend</span></div>
              </div>
              <ul className="kt-legend">
                {catData.map((d) => (
                  <li key={d.name}>
                    <i style={{ background: CAT_COLOR[d.name] }} />{d.name}
                    <b>{Math.round((d.value / total) * 100)}%</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
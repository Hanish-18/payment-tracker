import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

function clean(s) {
  let d = String(s || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export default function PhoneCard({ session }) {
  const uid = session.user.id;
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("profile_details")
      .select("phone")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.phone) setPhone(data.phone);
      });
  }, [uid]);

  async function save(e) {
    e.preventDefault();
    const d = clean(phone);
    if (d && !/^[6-9]\d{9}$/.test(d)) {
      setMsg("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profile_details")
      .upsert({ user_id: uid, phone: d || null, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setPhone(d);
    setMsg(d ? "Mobile number saved ✅" : "Mobile number removed.");
  }

  return (
    <form className="card" onSubmit={save}>
      <h3>Mobile number</h3>
      <p className="sub" style={{ margin: "8px 0 0" }}>
        Only you can see this. It is not shared with friends.
      </p>
      <label>Mobile number</label>
      <input
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="9876543210"
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save number"}
      </button>
      {msg && <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</p>}
    </form>
  );
}
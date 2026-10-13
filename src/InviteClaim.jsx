import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function InviteClaim({ reload, setError }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_friend_invite", {
      p_code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setError("");
    setStatus(data);
    setCode("");
    reload();
  }

  return (
    <form className="card" onSubmit={claim}>
      <h3>Have an invite code?</h3>
      <p className="sub" style={{ margin: "8px 0 0" }}>
        A friend sent you a code so their payments show in your account. Enter it here.
      </p>
      <label>Invite code</label>
      <input value={code} onChange={(e) => setCode(e.target.value)}
        placeholder="Example: 9F3A1C07B2" />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Please wait..." : "Connect"}
      </button>
      {status && (
        <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>{status}</p>
      )}
    </form>
  );
}
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function DeleteAccount({ session }) {
  const uid = session.user.id;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function remove() {
    if (text.trim() !== "DELETE") {
      setMsg("Type DELETE (in capital letters) to confirm.");
      return;
    }
    const ok = window.confirm(
      "This will permanently delete your account and all your data. This cannot be undone. Continue?"
    );
    if (!ok) return;

    setBusy(true);
    setMsg("");

    // remove uploaded files (profile photo and QR image)
    await supabase.storage.from("avatars").remove([`${uid}/avatar.jpg`]);
    await supabase.storage.from("qr").remove([`${uid}/qr.png`]);

    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setMsg(error.message);
      return;
    }

    ["upiId", "upiName", "qrMode", "qrPath"].forEach((k) => localStorage.removeItem(k));
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <div className="card">
      <h3>Delete account</h3>
      <p className="sub" style={{ margin: "8px 0 0" }}>
        Permanently delete your account and everything in it: payments, friends, groups and
        saved details. This cannot be undone.
      </p>

      {!open ? (
        <button className="ghost" style={{ marginTop: 16, color: "#c62828", borderColor: "#c62828" }}
          onClick={() => setOpen(true)}>
          Delete my account
        </button>
      ) : (
        <>
          <label>Type DELETE to confirm</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          {msg && <p className="error">{msg}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button
              className="small"
              style={{ background: "#c62828", color: "#fff", boxShadow: "none" }}
              disabled={busy}
              onClick={remove}
            >
              {busy ? "Deleting..." : "Permanently delete"}
            </button>
            <button className="ghost" disabled={busy}
              onClick={() => { setOpen(false); setText(""); setMsg(""); }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
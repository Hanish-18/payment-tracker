/* Login / sign up with a one-time code sent to your email (Gmail etc.) */
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function friendly(message) {
  const m = String(message || "");
  if (/rate limit|too many|security purposes|after \d+ seconds/i.test(m)) {
    return "Too many emails were sent. Please wait a few minutes and try again.";
  }
  if (/signups? not allowed|disabled/i.test(m)) {
    return "Email sign in is turned off in Supabase. Turn on the Email provider in Authentication → Providers.";
  }
  if (/expired|invalid/i.test(m)) {
    return "That code is wrong or has expired. Please check it or ask for a new one.";
  }
  return m;
}

export default function EmailOtpLogin() {
  const [step, setStep] = useState("enter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const mail = email.trim().toLowerCase();

  async function sendCode(e) {
    if (e) e.preventDefault();
    if (!validEmail(mail)) {
      setMsg("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: { shouldCreateUser: true, data: name.trim() ? { name: name.trim() } : {} },
    });
    setBusy(false);
    if (error) {
      setMsg(friendly(error.message));
      return;
    }
    setStep("verify");
    setCode("");
    setWait(60);
    setMsg(`Code sent to ${mail}. Check your inbox and the spam folder.`);
  }

  async function verify(e) {
    e.preventDefault();
    const t = code.replace(/\s/g, "");
    if (t.length < 6) {
      setMsg("Enter the 6 digit code from your email.");
      return;
    }
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.verifyOtp({ email: mail, token: t, type: "email" });
    setBusy(false);
    if (error) setMsg(friendly(error.message));
  }

  return (
    <div className="sa-form">
      <h1>{step === "enter" ? "Log in with email code" : "Enter the code"}</h1>
      <p className="sub">
        {step === "enter"
          ? "We will email you a one-time code. No password needed."
          : `Type the code sent to ${mail}.`}
      </p>

      {step === "enter" ? (
        <form onSubmit={sendCode}>
          <label>Your name (only for a new account)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Sharma" />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com" autoComplete="email" required />
          {msg && <p className="error">{msg}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Sending..." : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label>One-time code</label>
          <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={10}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} placeholder="123456" required />
          {msg && <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait..." : "Verify and log in"}
          </button>
          <p className="switch">
            <button className="link" type="button" disabled={wait > 0 || busy} onClick={sendCode}>
              {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
            {" · "}
            <button className="link" type="button" onClick={() => { setStep("enter"); setMsg(""); }}>
              Change email
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

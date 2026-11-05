import { useState } from "react";
import { supabase } from "./supabaseClient";
import PhoneLogin from "./PhoneLogin";
import ForgotPassword from "./ForgotPassword";
import "./auth.css";

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3.5" y="9" width="11" height="11" rx="3" />
      <rect x="9.5" y="3.5" width="11" height="11" rx="3" />
    </svg>
  );
}

/* Shown while the app checks if you are logged in */
export function Splash() {
  return (
    <div className="sa-splash">
      <div className="sa-logo"><LogoMark size={44} /></div>
      <h1 className="sa-name">SplitPay</h1>
      <p className="sa-tag">Split. Track. Settle.</p>
    </div>
  );
}

function Welcome({ onStart }) {
  const people = [["R", "#1d62f0", 12, 30], ["A", "#6a5cf0", 78, 14], ["P", "#0ea5a4", 4, 70], ["K", "#e0862b", 84, 66]];
  return (
    <div className="sa-page sa-welcome">
      <div className="sa-brand">
        <div className="sa-logo"><LogoMark size={40} /></div>
        <h1 className="sa-name">SplitPay</h1>
        <p className="sa-tag">Split. Track. Settle.</p>
      </div>

      <div className="sa-art" aria-hidden="true">
        <div className="sa-ring" />
        <svg viewBox="0 0 160 110" className="sa-card3d">
          <g transform="rotate(-16 80 55)">
            <rect x="22" y="20" width="116" height="72" rx="14" fill="url(#wc)" />
            <rect x="34" y="34" width="26" height="9" rx="4.5" fill="#fff" opacity="0.8" />
            <rect x="34" y="66" width="70" height="6" rx="3" fill="#fff" opacity="0.45" />
            <rect x="34" y="77" width="44" height="6" rx="3" fill="#fff" opacity="0.3" />
          </g>
          <defs>
            <linearGradient id="wc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b9bff" /><stop offset="1" stopColor="#1d62f0" /></linearGradient>
          </defs>
        </svg>
        {people.map(([c, bg, l, t]) => (
          <span key={c} className="sa-person" style={{ left: l + "%", top: t + "%", background: bg }}>{c}</span>
        ))}
      </div>

      <p className="sa-welcome-tx">Your group expenses,<br />made effortless.</p>
      <button type="button" className="sa-start" onClick={onStart}>Get Started →</button>
    </div>
  );
}

export default function AuthChoice({ emailForm }) {
  const [step, setStep] = useState("welcome");
  const [via, setVia] = useState("email");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      setMsg(error.message);
    }
  }

  if (step === "welcome") return <Welcome onStart={() => setStep("auth")} />;

  return (
    <div className="sa-page">
      <div className="sa-brand">
        <div className="sa-logo"><LogoMark size={40} /></div>
        <h1 className="sa-name">SplitPay</h1>
        <p className="sa-tag">Split. Track. Settle.</p>
      </div>

      <div className="sa-card">
        {via !== "forgot" && (
          <div className="sa-tabs">
            <button type="button" className={via === "email" ? "on" : ""} onClick={() => setVia("email")}>Email</button>
            <button type="button" className={via === "phone" ? "on" : ""} onClick={() => setVia("phone")}>Mobile OTP</button>
          </div>
        )}

        {via === "email" && emailForm}
        {via === "phone" && <PhoneLogin />}
        {via === "forgot" && <ForgotPassword onBack={() => setVia("email")} />}
      </div>

      {via !== "forgot" && (
        <div className="sa-more">
          {via === "email" && (
            <p className="sa-forgot">
              <button type="button" className="link" onClick={() => setVia("forgot")}>Forgot password?</button>
            </p>
          )}
          <div className="sa-or">or</div>
          <button type="button" className="sa-google" disabled={busy} onClick={google}>
            <GoogleG /> Continue with Google
          </button>
          {msg && <p className="error" style={{ marginTop: 14 }}>{msg}</p>}
        </div>
      )}

      <p className="sa-foot">Your group expenses, made effortless.</p>
    </div>
  );
}

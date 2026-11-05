/* Pay via UPI flow (matches the mockup):
   Pay Now hub -> Scan & Pay (camera) -> Choose UPI App -> Payment Initiated
   After paying, you confirm once and the payment is saved in your history.
   Needs:  npm install jsqr  */
import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import "./mobile-upi.css";
import { supabase } from "./supabaseClient";

const money = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const IC = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  scan: (<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></>),
  send: <path d="M21 4L3 11l7 3 3 7 8-17z" />,
  people: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14c3 0 5 1.6 5 4.5" /></>),
  store: (<><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3" /><path d="M10 20v-5h4v5" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M4 18l5-5 4 4 3-3 4 4" /></>),
  kbd: (<><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
};
function Ic({ n, s = 22 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>
  );
}

/* ---------- UPI apps ---------- */
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const IS_ANDROID = /android/i.test(ua);
const IS_IOS = /iphone|ipad|ipod/i.test(ua);

// pkg = Android package, ios = iOS URL scheme (apps without a known scheme use the generic upi://pay)
const APPS = [
  { id: "bhim", name: "BHIM", tile: "B", bg: "#f26b21", fg: "#fff", pkg: "in.org.npci.upiapp", ios: "upi://pay" },
  { id: "gpay", name: "Google Pay", tile: "G", bg: "#fff", fg: "#4285f4", pkg: "com.google.android.apps.nbu.paisa.user", ios: "gpay://upi/pay" },
  { id: "phonepe", name: "PhonePe", tile: "पे", bg: "#5f259f", fg: "#fff", pkg: "com.phonepe.app", ios: "phonepe://pay" },
  { id: "yono", name: "YONO SBI", tile: "yono", bg: "#1a9ad7", fg: "#fff", pkg: "com.sbi.lotusintouch", ios: "upi://pay", small: true },
  { id: "paytm", name: "Paytm", tile: "Paytm", bg: "#00b9f1", fg: "#fff", pkg: "net.one97.paytm", ios: "paytmmp://pay", small: true },
  { id: "cred", name: "CRED", tile: "C", bg: "#111", fg: "#fff", pkg: "com.dreamplug.androidapp", ios: "credpay://upi/pay" },
  { id: "navi", name: "Navi", tile: "N", bg: "#2b2b8f", fg: "#37e08a", pkg: "com.naviapp", ios: "upi://pay" },
  { id: "mobikwik", name: "MobiKwik", tile: "M", bg: "#1e6ff0", fg: "#fff", pkg: "com.mobikwik_new", ios: "upi://pay" },
];

function parseUpi(text) {
  const t = String(text || "").trim();
  if (!/^upi:\/\/pay\?/i.test(t)) return null;
  const p = {};
  new URLSearchParams(t.slice(t.indexOf("?") + 1)).forEach((v, k) => { p[k.toLowerCase()] = v; });
  return p.pa ? p : null;
}

function linkFor(app, query) {
  if (IS_ANDROID) return `intent://pay?${query}#Intent;scheme=upi;package=${app.pkg};end`;
  if (IS_IOS) return `${app.ios}?${query}`;
  return null;
}

/* ============================ Camera scanner ============================ */
function Scanner({ onCode, onManual, onBack }) {
  const vid = useRef(null);
  const cvs = useRef(null);
  const file = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream;
    let raf;
    let stop = false;
    let badAt = 0;
    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErr("Camera is not available here. Use Upload QR or Enter UPI ID.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = vid.current;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stop) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
            const c = cvs.current;
            const w = Math.min(640, v.videoWidth);
            const h = Math.round((w * v.videoHeight) / v.videoWidth);
            c.width = w; c.height = h;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(v, 0, 0, w, h);
            const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (r && r.data && Date.now() - badAt > 2000) {
              if (onCode(r.data)) return;
              badAt = Date.now();
              setErr("That QR is not a UPI payment QR. Try another one.");
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setErr("Camera permission was blocked. Allow camera access in your browser, or use Upload QR / Enter UPI ID.");
      }
    }
    start();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function fromFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1000 / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = cvs.current;
      c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
      URL.revokeObjectURL(img.src);
      if (!r || !r.data) { setErr("No QR code found in that image."); return; }
      if (!onCode(r.data)) setErr("That QR is not a UPI payment QR.");
    };
    img.onerror = () => setErr("Could not open that image.");
    img.src = URL.createObjectURL(f);
  }

  return (
    <div className="up">
      <div className="up-bar">
        <button type="button" className="up-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
        <h2>Scan &amp; Pay</h2>
        <span className="up-ib ghost" />
      </div>
      <div className="up-scan">
        <video ref={vid} playsInline muted />
        <canvas ref={cvs} hidden />
        <div className="up-frame" aria-hidden="true"><i /><i /><i /><i /><b /></div>
        <p className="up-scan-hint">Point your camera at a UPI QR code</p>
        <div className="up-scan-btns">
          <button type="button" onClick={() => file.current && file.current.click()}>
            <span><Ic n="image" s={26} /></span>Upload QR
          </button>
          <button type="button" onClick={onManual}>
            <span><Ic n="kbd" s={26} /></span>Enter UPI ID
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={fromFile} />
      </div>
      {err && <p className="up-err" role="alert">{err}</p>}
    </div>
  );
}

/* ============================ Main flow ============================ */
export default function MobileUpi({ start, header, go, myId, onBack, onSaved, setError }) {
  const [step, setStep] = useState(start === "scan" ? "scan" : "hub");
  const [from, setFrom] = useState("hub");
  const [pay, setPay] = useState(null);
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [payee, setPayee] = useState("");
  const [mAmt, setMAmt] = useState("");
  const [mNote, setMNote] = useState("");
  const [chosen, setChosen] = useState(null);
  const [link, setLink] = useState("");
  const [final, setFinal] = useState(0);
  const [returned, setReturned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  /* notice when the person comes back from the UPI app */
  useEffect(() => {
    if (step !== "done") return;
    let left = false;
    const h = () => {
      if (document.hidden) left = true;
      else if (left) setReturned(true);
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [step]);

  const merchant = pay ? pay.pn || pay.pa : "";
  const sub = pay ? (pay.tr ? `Order ID: ${pay.tr}` : `UPI ID: ${pay.pa}`) : "";

  function onCode(text) {
    const p = parseUpi(text);
    if (!p) return false;
    setPay(p);
    setAmount(p.am && Number(p.am) > 0 ? String(Number(p.am)) : "");
    setFrom("scan");
    setMsg("");
    setStep("apps");
    return true;
  }

  function submitManual() {
    setMsg("");
    const id = upiId.trim();
    const a = Number(mAmt);
    if (!/^[\w.\-]{2,}@[a-zA-Z][a-zA-Z0-9.\-]{1,}$/.test(id)) { setMsg("Enter a valid UPI ID, like name@bank."); return; }
    if (!(a > 0)) { setMsg("Enter the amount."); return; }
    setPay({ pa: id, pn: payee.trim() || id, am: a.toFixed(2), tn: mNote.trim(), cu: "INR" });
    setAmount(String(a));
    setFrom("manual");
    setStep("apps");
  }

  const amt = pay ? Number(pay.am && Number(pay.am) > 0 ? pay.am : amount) : 0;
  const locked = pay && pay.am && Number(pay.am) > 0;

  function openApp(app) {
    setMsg("");
    if (!(amt > 0)) { setMsg("Enter the amount first."); return; }
    const params = { ...pay, am: amt.toFixed(2), cu: pay.cu || "INR" };
    Object.keys(params).forEach((k) => { if (params[k] === "" || params[k] == null) delete params[k]; });
    const q = new URLSearchParams(params).toString().replace(/\+/g, "%20");
    const l = linkFor(app, q);
    if (!l) { setMsg("UPI apps open only on a phone. Open SplitPay on your phone to pay."); return; }
    setChosen(app);
    setLink(l);
    setFinal(amt);
    setReturned(false);
    setStep("done");
    setTimeout(() => { window.location.href = l; }, 80);
  }

  async function saveIt() {
    setBusy(true);
    const note = `${merchant} (UPI via ${chosen.name})${pay.tr ? ` · Ref ${pay.tr}` : ""}${pay.tn ? ` · ${pay.tn}` : ""}`;
    const row = { user_id: myId, friend: merchant, paid_by: "me", amount: final, note, payment_date: todayStr(), status: "Settled" };
    let last = null;
    let ok = false;
    for (const mode of ["UPI", "Cash", "Other"]) {
      const { error } = await supabase.from("entries").insert({ ...row, mode });
      if (!error) { ok = true; break; }
      last = error;
      if (!/mode|check/i.test(error.message)) break;
    }
    setBusy(false);
    if (!ok) { setError(last.message); setMsg(last.message); return; }
    setError("");
    onSaved();
  }

  /* ---------- Scan ---------- */
  if (step === "scan") {
    return <Scanner onCode={onCode} onManual={() => setStep("manual")} onBack={() => (start === "scan" ? onBack() : setStep("hub"))} />;
  }

  /* ---------- Enter UPI ID ---------- */
  if (step === "manual") {
    return (
      <div className="up">
        <div className="up-bar">
          <button type="button" className="up-ib" onClick={() => setStep("hub")} aria-label="Back"><Ic n="back" /></button>
          <h2>Pay via UPI</h2>
          <span className="up-ib ghost" />
        </div>
        <p className="up-sub">Send money to any UPI ID</p>
        <label className="up-lbl">UPI ID</label>
        <input className="up-in" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" autoCapitalize="none" autoCorrect="off" inputMode="email" />
        <label className="up-lbl">Name (optional)</label>
        <input className="up-in" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Who are you paying?" />
        <label className="up-lbl">Amount</label>
        <input className="up-in" value={mAmt} onChange={(e) => setMAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="₹ 500" inputMode="decimal" />
        <label className="up-lbl">Note (optional)</label>
        <input className="up-in" value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="What is this for?" />
        {msg && <p className="up-err" role="alert">{msg}</p>}
        <button type="button" className="up-cta" onClick={submitManual}>Continue</button>
      </div>
    );
  }

  /* ---------- Choose UPI app ---------- */
  if (step === "apps") {
    return (
      <div className="up">
        <div className="up-bar">
          <button type="button" className="up-ib" onClick={() => setStep(from === "manual" ? "manual" : "scan")} aria-label="Back"><Ic n="back" /></button>
          <h2>Pay via UPI</h2>
          <span className="up-ib ghost" />
        </div>
        <p className="up-sub">Choose your preferred UPI app</p>

        <div className="up-mcard">
          <span className="up-store"><Ic n="store" s={26} /></span>
          <span className="up-mmid"><b>{merchant}</b><small>{sub}</small></span>
          {locked && <b className="up-mamt">{money(amt)}</b>}
        </div>
        {!locked && (
          <label className="up-amt">
            <span>Enter amount</span>
            <b>₹</b>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" />
          </label>
        )}

        <div className="up-apps">
          {APPS.map((a) => (
            <button key={a.id} type="button" onClick={() => openApp(a)}>
              <span className="up-tile" style={{ background: a.bg, color: a.fg, fontSize: a.small ? 10 : 17 }}>{a.tile}</span>
              <b>{a.name}</b>
              <Ic n="chev" s={18} />
            </button>
          ))}
        </div>
        {msg && <p className="up-err" role="alert">{msg}</p>}
      </div>
    );
  }

  /* ---------- Payment initiated ---------- */
  if (step === "done" && pay && chosen) {
    return (
      <div className="up">
        <div className="up-bar">
          <button type="button" className="up-ib" onClick={onBack} aria-label="Back"><Ic n="back" /></button>
          <h2 />
          <span className="up-ib ghost" />
        </div>
        <div className="up-ok" aria-hidden="true"><span><Ic n="check" s={44} /></span></div>
        <h1 className="up-done-h">Payment Initiated!</h1>
        <p className="up-done-p">Complete the payment in your selected UPI app.</p>

        <div className="up-mcard">
          <span className="up-store"><Ic n="store" s={26} /></span>
          <span className="up-mmid"><b>{merchant}</b><small>{sub}</small></span>
          <b className="up-mamt">{money(final)}</b>
        </div>

        <div className={"up-confirm" + (returned ? " hot" : "")}>
          <b>{returned ? "Welcome back! Did the payment go through?" : "Finished paying?"}</b>
          <p>Confirm to save this payment in your SplitPay history.</p>
          <div>
            <button type="button" className="yes" onClick={saveIt} disabled={busy}>{busy ? "Saving..." : "Yes, I paid"}</button>
            <button type="button" className="no" onClick={onBack} disabled={busy}>No, cancel</button>
          </div>
        </div>
        {msg && <p className="up-err" role="alert">{msg}</p>}

        <button type="button" className="up-cta" onClick={() => { window.location.href = link; }}>
          Open UPI App <Ic n="open" s={20} />
        </button>
        <button type="button" className="up-ghost" onClick={onBack}>Back to SplitPay</button>
      </div>
    );
  }

  /* ---------- Hub ---------- */
  return (
    <div className="up">
      {header}
      <button type="button" className="up-backlink" onClick={onBack}><Ic n="back" s={18} /> Payments</button>

      <div className="up-hero">
        <span className="up-qr" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <rect width="64" height="64" rx="8" fill="#fff" />
            <g fill="#12327f">
              <rect x="8" y="8" width="18" height="18" rx="3" /><rect x="38" y="8" width="18" height="18" rx="3" /><rect x="8" y="38" width="18" height="18" rx="3" />
              <rect x="38" y="38" width="6" height="6" /><rect x="48" y="38" width="8" height="6" /><rect x="38" y="48" width="8" height="8" /><rect x="50" y="50" width="6" height="6" />
            </g>
            <g fill="#fff"><rect x="13" y="13" width="8" height="8" /><rect x="43" y="13" width="8" height="8" /><rect x="13" y="43" width="8" height="8" /></g>
          </svg>
        </span>
        <div>
          <h3>Pay a Merchant</h3>
          <p>Scan a shop's UPI QR and pay instantly.</p>
          <button type="button" onClick={() => setStep("scan")}><Ic n="scan" s={20} /> Scan QR</button>
        </div>
      </div>

      <button type="button" className="up-opt" onClick={() => setStep("manual")}>
        <span className="up-opt-ic"><Ic n="send" s={26} /></span>
        <span><b>Pay via UPI</b><small>Send money to any UPI ID</small></span>
        <Ic n="chev" s={20} />
      </button>
      <button type="button" className="up-opt" onClick={() => go("Settlements")}>
        <span className="up-opt-ic"><Ic n="people" s={26} /></span>
        <span><b>Pay Someone</b><small>Pay a friend and add to expenses</small></span>
        <Ic n="chev" s={20} />
      </button>
    </div>
  );
}

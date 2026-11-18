/* Full screen QR scanner: scan with the camera, upload a QR picture, or show your own QR.
   Reads UPI QR codes (add the payment as an expense or pay) and SplitPay friend codes. */
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "./supabaseClient";

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function parseQr(text) {
  const raw = String(text || "").trim();
  if (/^upi:\/\//i.test(raw)) {
    const qs = raw.split("?")[1] || "";
    const p = new URLSearchParams(qs);
    return { type: "upi", raw, pa: p.get("pa") || "", pn: p.get("pn") || "", am: p.get("am") || "", tn: p.get("tn") || "" };
  }
  const m = raw.match(/(?:code|add|id)=([A-Za-z0-9]{6,14})/i);
  if (m) return { type: "friend", raw, code: m[1] };
  if (/^[A-Za-z0-9]{6,14}$/.test(raw)) return { type: "friend", raw, code: raw };
  if (/^https?:\/\//i.test(raw)) return { type: "link", raw };
  return { type: "text", raw };
}

const Ic = ({ d, s = 24 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  back: <path d="M15 5l-7 7 7 7" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  image: (<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-5 4 4 3-3 4 4" /></>),
  scan: (<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><path d="M14 14h2v2h-2zM18 18h2M18 14h2" /></>),
};

export default function QrScanner({ notify, onClose }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [mode, setMode] = useState("scan");
  const [res, setRes] = useState(null);
  const [camErr, setCamErr] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [myCode, setMyCode] = useState("");
  const scanning = mode === "scan" && !res;

  /* announce scanning */
  useEffect(() => {
    if (scanning) notify({ title: "SplitPay", sub: "Scanning QR…", kind: "spinner", duration: 0 });
    return undefined;
  }, [scanning]);
  useEffect(() => () => notify.hide(), []);

  /* camera loop */
  useEffect(() => {
    if (!scanning) return undefined;
    let stream = null;
    let raf = 0;
    let stopped = false;
    let last = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    setCamErr("");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        const tick = (t) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (t - last < 120 || v.readyState < 2) return;
          last = t;
          const w = v.videoWidth;
          const h = v.videoHeight;
          if (!w) return;
          const k = Math.min(1, 640 / Math.max(w, h));
          canvas.width = Math.round(w * k);
          canvas.height = Math.round(h * k);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code && code.data) { stopped = true; found(code.data); }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setCamErr("The camera could not be opened. Allow camera access in your browser, or use Upload QR.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  function found(text) {
    const r = parseQr(text);
    setAmount(r.type === "upi" && r.am ? r.am : "");
    setMsg("");
    setRes(r);
    notify({ title: "SplitPay", sub: "QR scanned", kind: "check", duration: 2200 });
    if (navigator.vibrate) navigator.vibrate(40);
  }

  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height);
      URL.revokeObjectURL(url);
      if (code && code.data) found(code.data);
      else setMsg("No QR code found in that picture.");
    };
    img.onerror = () => { URL.revokeObjectURL(url); setMsg("That picture could not be opened."); };
    img.src = url;
  }

  async function showMine() {
    setMode("my");
    setRes(null);
    notify.hide();
    if (myCode) return;
    const u = await supabase.auth.getUser();
    if (!u.data || !u.data.user) return;
    const { data } = await supabase.from("profiles").select("friend_code").eq("id", u.data.user.id).maybeSingle();
    if (data && data.friend_code) setMyCode(data.friend_code);
  }

  async function addExpense() {
    const amt = Number(amount);
    if (!(amt > 0)) { setMsg("Enter the amount."); return; }
    setBusy(true);
    setMsg("");
    const u = await supabase.auth.getUser();
    const uid = u.data && u.data.user ? u.data.user.id : null;
    const who = res.pn || res.pa || "UPI payment";
    const base = {
      user_id: uid, friend: who, paid_by: "me", amount: amt,
      note: res.tn || `Paid via UPI QR to ${who}`, payment_date: today(), status: "Settled",
    };
    let err = null;
    for (const mode of ["UPI", "Other"]) {
      const { error } = await supabase.from("entries").insert({ ...base, mode });
      if (!error) { err = null; break; }
      err = error;
      if (!/mode|check/i.test(error.message)) break;
    }
    setBusy(false);
    if (err) { setMsg(err.message); return; }
    window.dispatchEvent(new Event("focus")); /* makes the app reload its data */
    onClose();
  }

  async function friendRequest() {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.rpc("send_friend_request", { p_code: res.code });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    notify({ title: "SplitPay", sub: String(data), kind: "check" });
    window.dispatchEvent(new Event("focus"));
    onClose();
  }

  const again = () => { setRes(null); setMsg(""); };

  return (
    <div className="qs" role="dialog" aria-label="Scan QR code">
      {scanning && <video ref={videoRef} className="qs-video" muted playsInline />}
      <div className="qs-shade" />

      <div className="qs-top">
        <button type="button" className="qs-ib" onClick={onClose} aria-label="Close"><Ic d={I.back} /></button>
        <h2>{mode === "my" ? "My QR" : "Scan QR Code"}</h2>
        <button type="button" className="qs-ib" aria-label="Info"
          onClick={() => notify({ title: "SplitPay", sub: "Scan a UPI QR to add an expense, or a friend's QR to add them.", kind: "check", duration: 4200 })}>
          <Ic d={I.info} />
        </button>
      </div>

      {mode === "scan" && (
        <div className="qs-mid">
          <div className="qs-frame">
            <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
            {scanning && !camErr && <u className="qs-line" />}
          </div>
          <p className="qs-hint">{camErr || msg || "Scan any UPI QR to add expense"}</p>
        </div>
      )}

      {mode === "my" && (
        <div className="qs-mid">
          <div className="qs-mine">
            {myCode ? <QRCodeSVG value={myCode} size={210} /> : <span>Loading...</span>}
          </div>
          <p className="qs-hint">{myCode ? `Your SplitPay ID: ${myCode}` : "Getting your QR..."}</p>
        </div>
      )}

      <div className="qs-bottom">
        <button type="button" onClick={() => fileRef.current && fileRef.current.click()}>
          <span><Ic d={I.image} s={26} /></span>Upload QR
        </button>
        <button type="button" className={mode === "scan" ? "on" : ""} onClick={() => { setMode("scan"); setRes(null); setMsg(""); }}>
          <span><Ic d={I.scan} s={26} /></span>Scan QR
        </button>
        <button type="button" className={mode === "my" ? "on" : ""} onClick={showMine}>
          <span><Ic d={I.qr} s={26} /></span>My QR
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
      </div>

      {res && (
        <div className="qs-bg">
          <div className="qs-sheet">
            {res.type === "upi" && (
              <>
                <h3>UPI payment</h3>
                <div className="qs-kv"><span>Pay to</span><b>{res.pn || "-"}</b></div>
                <div className="qs-kv"><span>UPI ID</span><b>{res.pa || "-"}</b></div>
                {res.tn && <div className="qs-kv"><span>Note</span><b>{res.tn}</b></div>}
                <label className="qs-amt">
                  <b>₹</b>
                  <input value={amount} inputMode="decimal" placeholder="Amount"
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                </label>
                {msg && <p className="qs-err">{msg}</p>}
                <button type="button" className="qs-main" disabled={busy} onClick={addExpense}>
                  {busy ? "Saving..." : `Add Expense${Number(amount) > 0 ? " · " + money(amount) : ""}`}
                </button>
                <button type="button" className="qs-soft" onClick={() => { window.location.href = res.raw; }}>Pay with UPI app</button>
              </>
            )}
            {res.type === "friend" && (
              <>
                <h3>SplitPay friend</h3>
                <p className="qs-p">Send a friend request to the ID <b>{res.code}</b>?</p>
                {msg && <p className="qs-err">{msg}</p>}
                <button type="button" className="qs-main" disabled={busy} onClick={friendRequest}>{busy ? "Sending..." : "Send friend request"}</button>
              </>
            )}
            {(res.type === "link" || res.type === "text") && (
              <>
                <h3>QR content</h3>
                <p className="qs-p qs-break">{res.raw}</p>
                {res.type === "link" && <button type="button" className="qs-main" onClick={() => window.open(res.raw, "_blank")}>Open link</button>}
              </>
            )}
            <button type="button" className="qs-soft" onClick={again}>Scan again</button>
          </div>
        </div>
      )}
    </div>
  );
}

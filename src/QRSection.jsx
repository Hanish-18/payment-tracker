import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRSection() {
  const [upiId, setUpiId] = useState(localStorage.getItem("upiId") || "");
  const [name, setName] = useState(localStorage.getItem("upiName") || "");
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(!!localStorage.getItem("upiId"));

  function save() {
    localStorage.setItem("upiId", upiId);
    localStorage.setItem("upiName", name);
    setSaved(true);
  }

  const link =
    "upi://pay?pa=" + encodeURIComponent(upiId) +
    "&pn=" + encodeURIComponent(name) +
    (amount ? "&am=" + amount : "") +
    "&cu=INR";

  return (
    <div style={{ border: "1px solid #888", padding: 12, marginTop: 12 }}>
      <h3>My payment QR</h3>
      {!saved ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Your UPI ID (like name@bank)" value={upiId}
            onChange={(e) => setUpiId(e.target.value)} />
          <input placeholder="Your name" value={name}
            onChange={(e) => setName(e.target.value)} />
          <button onClick={save}>Save and show QR</button>
        </div>
      ) : (
        <div>
          <input placeholder="Amount (optional)" type="number" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
          <div style={{ background: "white", padding: 12, display: "inline-block", marginTop: 8 }}>
            <QRCodeSVG value={link} size={180} />
          </div>
          <p>{upiId}</p>
          <button onClick={() => setSaved(false)}>Edit UPI ID</button>
        </div>
      )}
    </div>
  );
}
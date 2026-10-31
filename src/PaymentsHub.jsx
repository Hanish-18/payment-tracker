import { useState } from "react";
import PaymentsPage from "./PaymentsPage";
import PayPage from "./PayPage";

export default function PaymentsHub(props) {
  const [tab, setTab] = useState("payments");

  return (
    <>
      <div className="seg" style={{ marginBottom: 8 }}>
        <button type="button" className={tab === "payments" ? "on" : ""}
          onClick={() => setTab("payments")}>Payments</button>
        <button type="button" className={tab === "pay" ? "on" : ""}
          onClick={() => setTab("pay")}>Pay now</button>
      </div>

      {tab === "payments" ? <PaymentsPage {...props} /> : <PayPage {...props} />}
    </>
  );
}
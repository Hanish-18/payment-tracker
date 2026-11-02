import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ResetPassword from "./ResetPassword";

export default function RecoveryGate({ children }) {
  const [recovering, setRecovering] = useState(
    () => typeof window !== "undefined" && /type=recovery/.test(window.location.hash)
  );

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (recovering) return <ResetPassword onDone={() => setRecovering(false)} />;
  return children;
}
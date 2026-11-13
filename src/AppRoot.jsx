import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import App from "./App";
import MobileApp from "./MobileApp";
import { ThemeFab } from "./Accent";

// Phone (narrow screen): new app-style UI. Computer: the existing sidebar UI.
function useNarrow() {
  const q = "(max-width: 900px)";
  const [narrow, setNarrow] = useState(window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setNarrow(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return narrow;
}

export default function AppRoot() {
  const narrow = useNarrow();
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (narrow && session) return <MobileApp session={session} />;
  return (
    <>
      <App />
      {!narrow && session && <ThemeFab />}
    </>
  );
}

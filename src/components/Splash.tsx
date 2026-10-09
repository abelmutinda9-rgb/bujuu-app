import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import logo from "@/assets/bujuu-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

const KEY = "bujuu.splashed";
const OPEN_PATHS = ["/auth", "/reset-password", "/r/"];

/** Shown once per app launch: black screen + logo while the session is checked. */
export function Splash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "leaving">("hidden");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let launched = false;
    try {
      launched = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    if (launched) return;
    setPhase("show");
    const started = Date.now();

    // Check session on startup: if not logged in, route to the existing Signup screen inside the app
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data?.session && !OPEN_PATHS.some((p) => location.pathname.startsWith(p))) {
          void navigate({ to: "/auth", search: { mode: "signup" } });
        }
      })
      .finally(() => {
        const wait = Math.max(0, 900 - (Date.now() - started));
        setTimeout(() => {
          setPhase("leaving");
          setTimeout(() => setPhase("hidden"), 350);
        }, wait);
      });
    // launch-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "hidden") return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-ink transition-opacity duration-300 ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src={logo.url}
        alt="BUJUU"
        className="h-auto w-[42vw] max-w-[640px] min-w-[150px] animate-in fade-in duration-500 sm:w-[30vw] lg:w-[24vw]"
      />
    </div>
  );
}

import { useLocation, useNavigate } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "bujuu.splashed";

/** Shown once per app launch: obsidian background + animated BUJUU branding + tagline. */
export function Splash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "leaving">("hidden");

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

    // Guests can freely browse all catalog rows, search, and title details.
    // Sign-in is only required when triggering playback or saving to My List.
    const wait = Math.max(0, 1100 - (Date.now() - started));
    const timer = setTimeout(() => {
      setPhase("leaving");
      setTimeout(() => setPhase("hidden"), 350);
    }, wait);

    return () => clearTimeout(timer);
  }, []);

  if (phase === "hidden") return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B0B0F] transition-opacity duration-300 ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-900 shadow-2xl shadow-rose-600/40">
          <Play className="h-10 w-10 sm:h-12 sm:w-12 fill-current text-white translate-x-0.5" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.25em] text-white">
            BUJUU
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium tracking-wider text-zinc-400">
            Stream. Watch. Enjoy.
          </p>
        </div>
      </div>
    </div>
  );
}

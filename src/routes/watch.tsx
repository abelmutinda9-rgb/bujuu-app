import { App as CapApp } from "@capacitor/app";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Loader2, Lock, ShieldAlert, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useAccount } from "@/hooks/use-account";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { embedUrl, PROVIDERS, SERVER_COUNT } from "@/services/embeds";
import { detailsQuery, seasonQuery, stillUrl } from "@/services/tmdb";

const searchSchema = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.enum(["movie", "tv"]).default("movie"),
  season: z.coerce.number().default(1),
  episode: z.coerce.number().default(1),
});

export const Route = createFileRoute("/watch")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Now playing — bujuu" },
      { name: "description", content: "Full-screen playback on bujuu." },
      { property: "og:title", content: "Now playing — bujuu" },
      { property: "og:description", content: "Full-screen playback on bujuu." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Watch,
});

function Watch() {
  const { tmdbId, mediaType, season, episode } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate({ from: "/watch" });

  const { isPremium, loading: accountLoading, signedIn, state } = useAccount();
  const trial = useDeviceTrial();

  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState(0);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const isTv = mediaType === "tv";

  // Helper to awaken controls on any interaction and set auto-fade timeout
  const pingControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      window.clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      // Don't auto-hide if episodes drawer is currently open
      setShowControls(false);
    }, 4000);
  }, []);

  // Initial timer to hide controls after 4s
  useEffect(() => {
    pingControls();
    return () => {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [pingControls]);

  // Keep controls visible when episode drawer is open
  useEffect(() => {
    if (showEpisodes) {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    } else {
      pingControls();
    }
  }, [showEpisodes, pingControls]);

  // Strict entitlement check: only generate embed URL when actively subscribed and authorized
  const canPlay = trial.canStream || Boolean(isPremium && state?.status === "ACTIVE");
  const src = canPlay ? embedUrl({ tmdbId, mediaType, season, episode }, server) : null;

  // Reset loading state and set safety reveal timeout whenever the source changes
  useEffect(() => {
    setLoaded(false);
    if (!src) return;
    const timer = window.setTimeout(() => {
      setLoaded(true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [src]);

  // Silent fallback: if a server does not come up in time, move to the next one.
  const serverRef = useRef(server);
  serverRef.current = server;
  useEffect(() => {
    if (loaded || !src) return;
    const t = window.setTimeout(() => {
      if (serverRef.current < SERVER_COUNT - 1) setServer((s) => s + 1);
    }, 12000);
    return () => window.clearTimeout(t);
  }, [src, loaded]);

  // Reset server index whenever media title/season/episode changes
  useEffect(() => {
    setServer(0);
  }, [tmdbId, mediaType, season, episode]);

  const details = useQuery(detailsQuery(isTv ? tmdbId : null, "tv"));
  const seasonCount = details.data?.seasons ?? 1;
  const episodes = useQuery(seasonQuery(isTv ? tmdbId : null, season, isTv));

  const goTo = useCallback(
    (nextSeason: number, nextEpisode: number) => {
      void navigate({
        search: (prev) => ({ ...prev, season: nextSeason, episode: nextEpisode }),
        replace: true,
      });
      setShowEpisodes(false);
    },
    [navigate],
  );

  // Deterministic exit to home page or previous page
  const exitToHome = useCallback(() => {
    try {
      void navigate({ to: "/", replace: true });
    } catch {
      window.location.href = "/";
    }
    window.setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname.includes("/watch")) {
        window.location.href = "/";
      }
    }, 120);
  }, [navigate]);

  const back = useCallback(() => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      exitToHome();
    }
  }, [router, exitToHome]);

  // TV remote / keyboard / native back handling: Back or Exit exits to home
  useEffect(() => {
    const isExitKey = (e: KeyboardEvent) => {
      const exitKeys = ["Escape", "Backspace", "GoBack", "Exit", "MediaStop", "Clear"];
      const exitKeyCodes = [27, 8, 4, 111, 86, 28, 461, 10009, 10182];
      return exitKeys.includes(e.key) || exitKeyCodes.includes(e.keyCode);
    };

    const onKey = (e: KeyboardEvent) => {
      pingControls();
      if (isExitKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (showEpisodes) {
          setShowEpisodes(false);
        } else {
          exitToHome();
        }
      } else if (e.key === "ArrowLeft") {
        // Spatial Left on TV Remote: cycle server down if focused on servers
        const active = document.activeElement;
        if (active && active.getAttribute("data-tv-server") !== null) {
          e.preventDefault();
          setServer((s) => (s > 0 ? s - 1 : SERVER_COUNT - 1));
        }
      } else if (e.key === "ArrowRight") {
        // Spatial Right on TV Remote: cycle server up if focused on servers
        const active = document.activeElement;
        if (active && active.getAttribute("data-tv-server") !== null) {
          e.preventDefault();
          setServer((s) => (s < SERVER_COUNT - 1 ? s + 1 : 0));
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        // Any D-pad interaction also wakes up the controls
        setShowControls(true);
      }
    };

    // Listen for native Android TV back event dispatched from MainActivity
    const onNativeTvBack = () => {
      if (showEpisodes) {
        setShowEpisodes(false);
      } else {
        exitToHome();
      }
    };

    // Register Capacitor hardware back button listener for Android devices
    let removeCapBack: (() => void) | null = null;
    try {
      CapApp.addListener("backButton", () => {
        if (showEpisodes) {
          setShowEpisodes(false);
        } else {
          exitToHome();
        }
      }).then((handle) => {
        removeCapBack = () => {
          try {
            handle.remove();
          } catch {
            // ignore
          }
        };
      }).catch(() => {});
    } catch {
      // not in Capacitor environment
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("bujuu-tv-back", onNativeTvBack);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bujuu-tv-back", onNativeTvBack);
      if (removeCapBack) {
        removeCapBack();
      }
    };
  }, [showEpisodes, exitToHome, pingControls]);

  // 1. Account loading state
  if (accountLoading) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black p-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
          <p className="text-sm text-muted-foreground">Checking subscription status…</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated or unpaid locked state — strictly deny playback
  if (!canPlay) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="max-w-md space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {trial.status === "expired" || state?.status === "EXPIRED" ? "Free Trial Ended" : "Subscription Required"}
            </h2>
            <p className="text-sm text-zinc-400">
              {trial.status === "expired"
                ? "Your 3-day free trial has ended. Subscribe for KSh 150 (30 days) to continue streaming with zero ads."
                : "An active subscription (KSh 150 for 30 days) is required to watch movies and series on BUJUU."}
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              tabIndex={0}
              onClick={() => {
                void navigate({
                  to: "/subscribe",
                  search: {
                    redirect: `/watch?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`,
                  },
                });
              }}
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:scale-105 focus-visible:ring-4 focus-visible:ring-rose-400"
            >
              Unlock for KSh 150 (30 Days)
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={exitToHome}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800/60 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 focus-visible:scale-105 focus-visible:ring-4 focus-visible:ring-white"
            >
              Exit to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseMove={pingControls}
      onClick={pingControls}
      onTouchStart={pingControls}
      className="fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden bg-black p-0 select-none"
    >
      {src && (
        <iframe
          key={src}
          src={src}
          title="bujuu player"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; screen-wake-lock"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          onError={() => setServer((s) => (s < SERVER_COUNT - 1 ? s + 1 : s))}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {!loaded && (
        <div className="absolute inset-0 grid place-items-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            <p className="text-sm text-muted-foreground">Connecting stream...</p>
          </div>
        </div>
      )}

      {/* Tap-to-wake layer (Option 1): active when controls are hidden to reveal servers and UI on click/tap */}
      {!showControls && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Wake up player controls and server buttons"
          onClick={(e) => {
            e.stopPropagation();
            pingControls();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            pingControls();
          }}
          onMouseMove={pingControls}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        />
      )}

      {/* Top Left: Exit / Back Button with prominent TV focus */}
      <button
        type="button"
        onClick={exitToHome}
        tabIndex={0}
        aria-label="Exit to home"
        className={`absolute left-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white outline-none backdrop-blur-md transition-all duration-300 hover:bg-black/90 focus-visible:scale-110 focus-visible:ring-4 focus-visible:ring-rose-500 focus-visible:bg-black ${
          showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      {/* Top Right: TV Controls */}
      <div
        className={`absolute right-4 top-4 z-20 flex items-center gap-2 transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
      >
        {isTv && (
          <>
            <button
              type="button"
              onClick={() => setShowEpisodes(true)}
              tabIndex={0}
              className="flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-medium text-white outline-none backdrop-blur-md transition-all hover:bg-black/90 focus-visible:scale-110 focus-visible:ring-4 focus-visible:ring-rose-500"
            >
              <ListVideo className="h-5 w-5" /> Episodes
            </button>
            <button
              type="button"
              onClick={() => goTo(season, episode + 1)}
              tabIndex={0}
              className="flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-black outline-none transition-all hover:bg-white focus-visible:scale-110 focus-visible:ring-4 focus-visible:ring-rose-500"
            >
              <SkipForward className="h-4 w-4" /> Next episode
            </button>
          </>
        )}
      </div>

      {isTv && (
        <p
          className={`pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-center text-xs text-muted-foreground backdrop-blur-md transition-all duration-300 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          Tip: Press Back on remote anytime to exit to home.
        </p>
      )}

      {/* Bottom Center: Server Selector Pills with Auto-hide and Smooth Fade */}
      <div
        className={`absolute bottom-12 left-1/2 z-20 flex max-w-[92vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/85 p-2 backdrop-blur-md transition-all duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {PROVIDERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            tabIndex={showControls ? 0 : -1}
            data-tv-server={i}
            onClick={() => {
              setServer(i);
              pingControls();
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold outline-none transition-all focus-visible:scale-110 focus-visible:ring-4 focus-visible:ring-white ${
              server === i ? "bg-rose-600 text-white shadow-lg" : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isTv && showEpisodes && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-zinc-800 bg-black/95 backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
            <select
              value={season}
              onChange={(e) => goTo(Number(e.target.value), 1)}
              className="flex-1 rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-4 focus-visible:ring-rose-500"
              aria-label="Season"
            >
              {Array.from({ length: Math.max(seasonCount, 1) }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              tabIndex={0}
              onClick={() => setShowEpisodes(false)}
              aria-label="Close episodes"
              className="grid h-9 w-9 place-items-center rounded-full text-zinc-300 outline-none hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-rose-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {episodes.isLoading && (
              <p className="p-4 text-sm text-muted-foreground">Loading episodes…</p>
            )}
            {episodes.data?.map((ep) => {
              const still = stillUrl(ep.stillPath);
              const active = ep.episodeNumber === episode;
              return (
                <button
                  key={ep.episodeNumber}
                  type="button"
                  tabIndex={0}
                  onClick={() => goTo(season, ep.episodeNumber)}
                  className={`flex w-full items-center gap-3 rounded-md p-2 text-left outline-none transition-all focus-visible:ring-4 focus-visible:ring-rose-500 ${
                    active ? "bg-white/20" : "hover:bg-white/10"
                  }`}
                >
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded bg-card">
                    {still && (
                      <img
                        src={still}
                        alt={ep.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {ep.episodeNumber}. {ep.name}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{ep.overview}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

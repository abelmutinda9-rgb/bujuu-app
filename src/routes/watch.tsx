import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Loader2, Lock, ShieldAlert, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useAccount } from "@/hooks/use-account";
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

  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState(0);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const isTv = mediaType === "tv";

  // Strict entitlement check: only generate embed URL when actively subscribed and authorized
  const canPlay = !accountLoading && isPremium && state?.status === "ACTIVE";
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

  const back = useCallback(() => router.history.back(), [router]);

  // TV remote / keyboard: Back or Escape leaves the player or closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace" || e.keyCode === 461) {
        if (showEpisodes) setShowEpisodes(false);
        else back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEpisodes, back]);

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
  if (!isPremium || !canPlay) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="max-w-md space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {state?.status === "EXPIRED" ? "Subscription Expired" : "Subscription Required"}
            </h2>
            <p className="text-sm text-zinc-400">
              {state?.status === "EXPIRED"
                ? "Your 30-day BUJUU subscription has ended. Renew for KSh 150 to keep streaming."
                : "An active subscription (KSh 150 for 30 days) is required to watch movies and series on BUJUU."}
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                void navigate({
                  to: "/subscribe",
                  search: {
                    redirect: `/watch?tmdbId=${tmdbId}&mediaType=${mediaType}&season=${season}&episode=${episode}`,
                  },
                })
              }
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Unlock for KSh 150 (30 Days)
            </button>
            <button
              type="button"
              onClick={back}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800/60 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden bg-black p-0">
      {src && (
        <iframe
          key={src}
          src={src}
          title="bujuu player"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; screen-wake-lock"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" 
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
            <Loader2 className="h-10 w-10 animate-spin text-brand" />
            <p className="text-sm text-muted-foreground">Connecting stream...</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={back}
        tabIndex={0}
        aria-label="Go back"
        className="absolute left-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white outline-none backdrop-blur-md transition-transform hover:bg-black/80 focus:scale-105 focus:ring-4 focus:ring-brand"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {isTv && (
          <>
            <button
              type="button"
              onClick={() => setShowEpisodes(true)}
              tabIndex={0}
              className="flex h-10 items-center gap-2 rounded-full bg-black/60 px-4 text-sm font-medium text-white outline-none backdrop-blur-md transition-transform hover:bg-black/80 focus:scale-105 focus:ring-4 focus:ring-brand"
            >
              <ListVideo className="h-5 w-5" /> Episodes
            </button>
            <button
              type="button"
              onClick={() => goTo(season, episode + 1)}
              tabIndex={0}
              className="flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-black outline-none transition-transform hover:bg-white focus:scale-105 focus:ring-4 focus:ring-brand"
            >
              <SkipForward className="h-4 w-4" /> Next episode
            </button>
          </>
        )}
      </div>

      {isTv && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-center text-xs text-muted-foreground backdrop-blur-md">
          Tip: use the gear icon inside the player to switch audio tracks and dubs.
        </p>
      )}

      <div className="absolute bottom-16 left-1/2 z-20 flex max-w-[92vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/70 p-1.5 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PROVIDERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            tabIndex={0}
            onClick={() => setServer(i)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold outline-none transition-transform focus:scale-105 focus:ring-4 focus:ring-brand ${
              server === i ? "bg-rose-600 text-white" : "text-muted-foreground hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isTv && showEpisodes && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-border bg-black/95 backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <select
              value={season}
              onChange={(e) => goTo(Number(e.target.value), 1)}
              className="flex-1 rounded-md border border-border bg-black px-3 py-2 text-sm text-foreground outline-none focus:ring-4 focus:ring-brand"
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
              onClick={() => setShowEpisodes(false)}
              aria-label="Close episodes"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground outline-none hover:bg-white/10 focus:ring-4 focus:ring-brand"
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
                  className={`flex w-full items-center gap-3 rounded-md p-2 text-left outline-none transition-colors focus:ring-4 focus:ring-brand ${
                    active ? "bg-white/15" : "hover:bg-white/10"
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

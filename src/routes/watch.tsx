import { App as CapApp } from "@capacitor/app";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Loader2, Play, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Paywall, usePlaybackGate } from "@/components/Paywall";
import { useSession } from "@/hooks/use-account";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { supabase } from "@/integrations/supabase/client";
import { deviceLimitForPlan, getPersistentDeviceId, type SubscriptionPlan } from "@/lib/concurrency";
import { saveContinueWatching } from "@/lib/history";
import { fetchActivePlan } from "@/lib/subscription-plan";
import { tmdbQuery } from "@/lib/tmdb.functions";
import { resolveBackendStream, SERVERS, SERVER_COUNT } from "@/services/embeds";
import { detailsQuery, seasonQuery, stillUrl } from "@/services/tmdb";

const searchSchema = z.object({ tmdbId: z.coerce.number(), mediaType: z.enum(["movie", "tv"]).default("movie"), season: z.coerce.number().default(1), episode: z.coerce.number().default(1) });
export const Route = createFileRoute("/watch")({ validateSearch: searchSchema, component: Watch });

function Watch() {
  const { tmdbId, mediaType, season, episode } = Route.useSearch();
  const navigate = useNavigate({ from: "/watch" });
  const { gate, refresh, trial } = usePlaybackGate();
  const { session } = useSession();
  const userId = session?.user.id;
  const details = useQuery(detailsQuery(tmdbId, mediaType));
  const isTv = mediaType === "tv";
  const [server, setServer] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [trailerRequested, setTrailerRequested] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [activeDevices, setActiveDevices] = useState(0);
  const [controls, setControls] = useState(true);
  const [playHere, setPlayHere] = useState(false);
  const [deviceId] = useState(getPersistentDeviceId);
  const timer = useRef<number | null>(null);

  const planQuery = useQuery({
    queryKey: ["subscription-plan", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchActivePlan(userId!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const plan: SubscriptionPlan = planQuery.data?.plan ?? "solo";
  const planActive = Boolean(planQuery.data?.active);
  const canPlay = gate === "open" && !deviceBlocked;
  const stream = useQuery({
    queryKey: ["bujuu-backend-stream", tmdbId, mediaType, season, episode, server, trial.trial.deviceId],
    queryFn: () => resolveBackendStream({ tmdbId, mediaType, season, episode }, server),
    enabled: canPlay && Boolean(tmdbId), staleTime: 5 * 60 * 1000,
  });
  const src = stream.data?.streamUrl ?? null;
  const trailer = useQuery({
    queryKey: ["tmdb-trailer", mediaType, tmdbId],
    enabled: trailerRequested && gate !== "open",
    queryFn: async () => {
      const response = await tmdbQuery({ data: { path: `/${mediaType}/${tmdbId}/videos`, params: {} } }) as { results?: Array<{ key: string; site: string; type: string; official?: boolean }> };
      return response.results?.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official)?.key
        ?? response.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")?.key ?? null;
    },
  });
  const episodes = useQuery(seasonQuery(isTv ? tmdbId : null, season, isTv));
  const title = details.data?.title ?? "Untitled";

  // Realtime Presence is ephemeral: no heartbeat/device table is read or written.
  // Do not block playback until the active-plan lookup is complete.
  useEffect(() => {
    if (gate !== "open" || !userId || !planActive || !planQuery.data) {
      setDeviceBlocked(false);
      setActiveDevices(0);
      return;
    }

    let disposed = false;
    const channel = supabase.channel(`presence:${userId}`, {
      config: { presence: { key: deviceId } },
    });

    const handlePresenceSync = () => {
      if (disposed) return;
      const presence = channel.presenceState();
      const count = Object.keys(presence).length;
      setActiveDevices(count);
      setDeviceBlocked(!playHere && count > deviceLimitForPlan(plan));
    };

    channel.on("presence", { event: "sync" }, handlePresenceSync);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ deviceId, onlineAt: new Date().toISOString() });
        handlePresenceSync();
      }
    });

    return () => {
      disposed = true;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [gate, userId, deviceId, plan, planActive, planQuery.data, playHere]);

  useEffect(() => {
    if (!canPlay || !details.data) return;
    saveContinueWatching({ mediaId: tmdbId, type: mediaType, title: details.data.title, posterPath: details.data.posterPath, season: isTv ? season : undefined, episode: isTv ? episode : undefined });
    if (userId) void supabase.from("watch_history").insert({ user_id: userId, tmdb_id: tmdbId, media_type: mediaType, title: details.data.title, poster_path: details.data.posterPath, season: isTv ? season : null, episode: isTv ? episode : null, watched_at: new Date().toISOString() });
  }, [canPlay, details.data, tmdbId, mediaType, season, episode, isTv, userId]);

  useEffect(() => {
    setLoaded(false);
    if (!src) return;
    const id = window.setTimeout(() => setLoaded(true), 3500);
    return () => window.clearTimeout(id);
  }, [src]);
  useEffect(() => { setServer(0); }, [tmdbId, mediaType, season, episode]);
  useEffect(() => {
    if (!src || loaded) return;
    const id = window.setTimeout(() => setServer((index) => Math.min(index + 1, SERVER_COUNT - 1)), 12000);
    return () => window.clearTimeout(id);
  }, [src, loaded]);

  const goTo = useCallback((nextSeason: number, nextEpisode: number) => {
    void navigate({ search: (previous) => ({ ...previous, season: nextSeason, episode: nextEpisode }), replace: true });
    setShowEpisodes(false);
  }, [navigate]);
  const exit = useCallback(() => void navigate({ to: "/", replace: true }), [navigate]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["Escape", "Backspace"].includes(event.key)) { event.preventDefault(); exit(); }
      setControls(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setControls(false), 4000);
    };
    window.addEventListener("keydown", onKey);
    let remove: (() => void) | undefined;
    try { void CapApp.addListener("backButton", exit).then((handle) => { remove = () => void handle.remove(); }).catch(() => undefined); } catch { /* browser */ }
    return () => { window.removeEventListener("keydown", onKey); if (timer.current) window.clearTimeout(timer.current); remove?.(); };
  }, [exit]);

  if (gate === "loading") return <div className="fixed inset-0 z-50 grid place-items-center bg-black"><Loader2 className="h-10 w-10 animate-spin text-rose-500" /></div>;

  if (gate === "signin" || gate === "pay") {
    return <><div className="fixed inset-0 z-40 grid place-items-center bg-black p-5 text-center">
      <div className="w-full max-w-3xl space-y-5">
        {trailerRequested && trailer.isLoading && <p className="text-sm text-zinc-400">Loading official trailer…</p>}
        {trailer.data && <div className="aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"><iframe title={`${title} official trailer`} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.data)}`} allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div>}
        {trailerRequested && !trailer.isLoading && !trailer.data && <p className="text-sm text-zinc-400">No official trailer is available for this title.</p>}
        <button type="button" onClick={() => setTrailerRequested(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white hover:border-rose-500"><Play className="h-4 w-4 text-rose-500" />Watch Trailer</button>
      </div>
    </div><Paywall gate={gate} onPaid={refresh} /></>;
  }
  if (deviceBlocked) return <div className="fixed inset-0 z-50 grid place-items-center bg-black p-6 text-center"><div className="max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-7"><h1 className="text-xl font-bold text-white">Device limit reached</h1><p className="text-sm text-zinc-300">Someone else is watching on your account. Switch playback here or upgrade to Family (4 devices)?</p><p className="text-xs text-zinc-500">{activeDevices} active devices · {plan === "solo" ? "Solo limit: 1" : "Family limit: 4"}</p><button className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white" onClick={() => setPlayHere(true)}>Switch playback here</button>{plan === "solo" && <button className="ml-2 rounded-lg border border-zinc-700 px-4 py-2 text-white" onClick={() => void navigate({ to: "/subscribe" })}>Upgrade to Family</button>}</div></div>;

  return <main className="fixed inset-0 z-50 overflow-hidden bg-black" onMouseMove={() => setControls(true)} onTouchStart={() => setControls(true)}>
    {src && <iframe key={src} src={src} title="BUJUU player" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowFullScreen onLoad={() => setLoaded(true)} onError={() => setServer((value) => Math.min(value + 1, SERVER_COUNT - 1))} className={`absolute inset-0 h-full w-full border-0 ${loaded ? "opacity-100" : "opacity-0"}`} />}
    {!loaded && <div className="absolute inset-0 grid place-items-center bg-black"><Loader2 className="h-9 w-9 animate-spin text-rose-500" /></div>}
    {controls && <><button onClick={exit} aria-label="Back to home" className="absolute left-5 top-5 z-20 rounded-full bg-black/70 p-3 text-white"><ArrowLeft /></button>
      {isTv && <div className="absolute right-5 top-5 z-20 flex gap-2"><button onClick={() => setShowEpisodes(true)} className="flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-white"><ListVideo className="h-4 w-4"/>Episodes</button><button onClick={() => goTo(season, episode + 1)} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-black"><SkipForward className="h-4 w-4"/>Next episode</button></div>}
      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-black/80 p-2">{SERVERS.map((item, index) => <button key={item.id} onClick={() => setServer(index)} className={`rounded-full px-3 py-1 text-xs font-bold ${index === server ? "bg-rose-600 text-white" : "text-zinc-300"}`}>{item.label}</button>)}</div></>}
    {isTv && showEpisodes && <aside className="absolute inset-y-0 right-0 z-30 w-full max-w-md border-l border-zinc-800 bg-black p-4"><div className="flex gap-2"><select value={season} onChange={(event) => goTo(Number(event.target.value), 1)} className="flex-1 rounded bg-zinc-900 p-2 text-white">{Array.from({ length: Math.max(details.data?.seasons ?? 1, 1) }, (_, index) => <option key={index + 1} value={index + 1}>Season {index + 1}</option>)}</select><button onClick={() => setShowEpisodes(false)} aria-label="Close episodes" className="p-2 text-white"><X /></button></div><div className="mt-3 space-y-2 overflow-auto">{episodes.data?.map((item) => <button key={item.episodeNumber} onClick={() => goTo(season, item.episodeNumber)} className="flex w-full items-center gap-3 rounded-lg bg-zinc-900 p-2 text-left text-white"><img src={stillUrl(item.stillPath) ?? ""} alt="" className="h-14 w-24 rounded object-cover"/><span>{item.episodeNumber}. {item.name}</span></button>)}</div></aside>}
  </main>;
}

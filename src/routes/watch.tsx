import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Film, Loader2, RotateCcw, Tv } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { saveContinueWatching } from "@/lib/history";
import { detailsQuery, seasonQuery } from "@/services/tmdb";
import { resolveBackendStream, SERVER_COUNT, type StreamSource } from "@/services/embeds";

const searchSchema = z.object({
  tmdbId: z.coerce.number(),
  mediaType: z.enum(["movie", "tv"]).default("movie"),
  season: z.coerce.number().default(1),
  episode: z.coerce.number().default(1),
});

export const Route = createFileRoute("/watch")({
  validateSearch: (search) => searchSchema.parse(search),
  component: WatchPage,
});

function WatchPage() {
  const search = useSearch({ from: "/watch" });
  const navigate = useNavigate();
  const tmdbId = search.tmdbId;
  const mediaType = search.mediaType ?? "movie";
  const season = search.season ?? 1;
  const episode = search.episode ?? 1;

  // Internal server failover index (0 to 11) - hidden from viewer UI
  const [serverIndex, setServerIndex] = useState(0);
  const [streamSource, setStreamSource] = useState<StreamSource | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
  const [failoverAttempt, setFailoverAttempt] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch title metadata from TMDB
  const details = useQuery(detailsQuery(tmdbId, mediaType));

  // If TV show, fetch season episodes for episode selection
  const seasons = useQuery(seasonQuery(tmdbId, season, mediaType === "tv"));

  const media = details.data;
  const title = media?.title || (mediaType === "movie" ? "Movie" : "Series");

  // Save to continue watching in local storage
  useEffect(() => {
    if (!media) return;
    try {
      saveContinueWatching({
        mediaId: tmdbId,
        type: mediaType,
        title,
        posterPath: media.posterPath ?? null,
        ...(mediaType === "tv" ? { season, episode } : {}),
      });
    } catch (e) {
      console.warn("Failed to save continue watching:", e);
    }
  }, [media, tmdbId, mediaType, season, episode, title]);

  // Resolve stream source automatically when target or serverIndex changes
  useEffect(() => {
    let cancelled = false;
    setIframeLoading(true);

    resolveBackendStream(
      {
        tmdbId,
        mediaType,
        season,
        episode,
      },
      serverIndex
    ).then((source) => {
      if (!cancelled) {
        setStreamSource(source);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, season, episode, serverIndex]);

  // Automated Watchdog: If current provider doesn't load within 6.5s, silently failover
  useEffect(() => {
    if (!iframeLoading) return;

    const watchdog = setTimeout(() => {
      if (failoverAttempt < SERVER_COUNT - 1) {
        setServerIndex((prev) => (prev + 1) % SERVER_COUNT);
        setFailoverAttempt((prev) => prev + 1);
        setIframeLoading(true);
      }
    }, 6500);

    return () => clearTimeout(watchdog);
  }, [iframeLoading, serverIndex, failoverAttempt]);

  // Reset server index if user changes episode or title
  useEffect(() => {
    setServerIndex(0);
    setFailoverAttempt(0);
    setIframeLoading(true);
  }, [tmdbId, season, episode]);

  // Activity timer for auto-hiding the top bar during playback
  const handleUserActivity = () => {
    setHeaderVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, 3500);
  };

  useEffect(() => {
    handleUserActivity();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Manual alternative stream switch
  const handleNextServer = () => {
    setIframeLoading(true);
    setServerIndex((prev) => (prev + 1) % SERVER_COUNT);
    setFailoverAttempt((prev) => prev + 1);
    toast.info("Switching to alternative backup stream…");
  };

  const handleSelectEpisode = (epNum: number) => {
    setEpisodeDrawerOpen(false);
    void navigate({
      to: "/watch",
      search: {
        tmdbId,
        mediaType: "tv",
        season,
        episode: epNum,
      },
    });
  };

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white"
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      onClick={handleUserActivity}
    >
      {/* Top Floating Control Bar - Auto-hiding */}
      <header
        className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 sm:p-6 transition-opacity duration-300 ${
          headerVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                void navigate({ to: "/" });
              }
            }}
            className="h-10 w-10 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-white/20"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-white drop-shadow-md">
              {title}
            </h1>
            {mediaType === "tv" && (
              <p className="text-xs text-zinc-300 drop-shadow">
                Season {season} · Episode {episode}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* TV Episode Selector Button */}
          {mediaType === "tv" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEpisodeDrawerOpen((prev) => !prev)}
              className="border-zinc-700 bg-black/60 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20"
            >
              <Tv className="mr-1.5 h-3.5 w-3.5 text-rose-500" />
              Episodes
            </Button>
          )}

          {/* Quick Alternative Stream switch */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextServer}
            title="Try alternative stream"
            className="h-10 w-10 rounded-full bg-black/60 text-zinc-300 backdrop-blur-md hover:bg-white/20 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Cinema Viewport */}
      <div className="relative flex-1 w-full h-full bg-black">
        {/* Loading / Failover overlay */}
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            <p className="text-sm font-medium text-zinc-300">
              {failoverAttempt > 0 ? "Connecting to backup stream…" : "Connecting stream…"}
            </p>
          </div>
        )}

        {/* Video Player Iframe */}
        {streamSource?.streamUrl && (
          <iframe
            key={`${streamSource.streamUrl}-${failoverAttempt}`}
            src={streamSource.streamUrl}
            title={`${title} player`}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setIframeLoading(false)}
            onError={() => {
              // Immediate auto-advance on network load failure
              setServerIndex((prev) => (prev + 1) % SERVER_COUNT);
              setFailoverAttempt((prev) => prev + 1);
            }}
          />
        )}
      </div>

      {/* TV Episode Drawer / Overlay */}
      {episodeDrawerOpen && mediaType === "tv" && (
        <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm bg-zinc-950/95 p-6 backdrop-blur-xl border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-white">Season {season}</h2>
              <p className="text-xs text-zinc-400">Select an episode to watch</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEpisodeDrawerOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              Close
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
            {seasons.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              </div>
            ) : (
              seasons.data?.map((ep) => {
                const isCurrent = ep.episodeNumber === episode;
                return (
                  <button
                    key={ep.episodeNumber}
                    onClick={() => handleSelectEpisode(ep.episodeNumber)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isCurrent
                        ? "bg-rose-950/40 border-rose-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                    }`}
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black text-xs font-bold">
                      {ep.episodeNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{ep.name || `Episode ${ep.episodeNumber}`}</p>
                      {ep.overview && (
                        <p className="line-clamp-2 text-xs text-zinc-400 mt-0.5">{ep.overview}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

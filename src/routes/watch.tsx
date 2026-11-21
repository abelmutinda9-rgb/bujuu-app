import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Film, Loader2, RotateCcw, Tv } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { writeContinueWatching } from "@/lib/history";
import { tmdbMovie, tmdbTv, tmdbTvSeason } from "@/lib/tmdb.functions";
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

  // Fetch title metadata from TMDB
  const mediaQuery = useQuery({
    queryKey: ["watch-meta", mediaType, tmdbId],
    queryFn: async () => {
      if (mediaType === "tv") {
        return await tmdbTv(tmdbId);
      }
      return await tmdbMovie(tmdbId);
    },
    staleTime: 1000 * 60 * 10,
  });

  // If TV show, fetch season episodes for episode selection
  const seasonQuery = useQuery({
    queryKey: ["watch-season", tmdbId, season],
    enabled: mediaType === "tv",
    queryFn: async () => {
      return await tmdbTvSeason(tmdbId, season);
    },
    staleTime: 1000 * 60 * 10,
  });

  const media = mediaQuery.data;
  const title = (media as any)?.title || (media as any)?.name || (mediaType === "movie" ? "Movie" : "Series");

  // Save to continue watching in local storage
  useEffect(() => {
    if (!media) return;
    try {
      writeContinueWatching({
        tmdbId,
        mediaType,
        title,
        posterPath: (media as any).poster_path ?? null,
        backdropPath: (media as any).backdrop_path ?? null,
        season: mediaType === "tv" ? season : 1,
        episode: mediaType === "tv" ? episode : 1,
        updatedAt: Date.now(),
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

  // Reset server index if user changes episode or title
  useEffect(() => {
    setServerIndex(0);
    setFailoverAttempt(0);
  }, [tmdbId, season, episode]);

  // Silent automatic failover handler
  const handleNextServer = () => {
    setIframeLoading(true);
    setServerIndex((prev) => (prev + 1) % SERVER_COUNT);
    setFailoverAttempt((prev) => prev + 1);
    toast.info("Switching to optimized backup stream…");
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
      {/* Top Floating Control Bar */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 sm:p-6 transition-opacity duration-300">
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

          {/* Quick Reload / Failover button if stream hangs */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextServer}
            title="Reload or try alternative source"
            className="h-10 w-10 rounded-full bg-black/60 text-zinc-300 backdrop-blur-md hover:bg-white/20 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Cinema Viewport */}
      <div className="relative flex-1 w-full h-full bg-black">
        {/* Loading overlay */}
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            <p className="text-sm font-medium text-zinc-300">
              Connecting stream…
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
            {seasonQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              </div>
            ) : (
              seasonQuery.data?.episodes?.map((ep: any) => {
                const isCurrent = ep.episode_number === episode;
                return (
                  <button
                    key={ep.id || ep.episode_number}
                    onClick={() => handleSelectEpisode(ep.episode_number)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isCurrent
                        ? "bg-rose-950/40 border-rose-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                    }`}
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black text-xs font-bold">
                      {ep.episode_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{ep.name || `Episode ${ep.episode_number}`}</p>
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

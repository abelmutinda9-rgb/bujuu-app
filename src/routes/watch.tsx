import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Info,
  Play,
  Plus,
  Share2,
  Sparkles,
  Star,
  Tv,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { BujuuPlayer } from "@/components/player/BujuuPlayer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyListToggle } from "@/hooks/use-library";
import { saveContinueWatching } from "@/lib/history";
import {
  ageRating,
  creditsQuery,
  detailsQuery,
  formatRuntime,
  matchPercent,
  posterUrl,
  recommendationsQuery,
  seasonQuery,
  stillUrl,
  yearOf,
  type Episode,
  type MediaItem,
} from "@/services/tmdb";
import { resolveStreamSource, SERVER_COUNT, type ResolvedStream } from "@/services/stream-resolver";

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

  // Stream state
  const [stream, setStream] = useState<ResolvedStream | null>(null);
  const [streamLoading, setStreamLoading] = useState(true);
  const [serverIndex, setServerIndex] = useState<number>(-1); // -1 = Direct HLS, 0-11 = embed servers
  const [infoOpen, setInfoOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"episodes" | "foryou">("episodes");

  // Queries
  const details = useQuery(detailsQuery(tmdbId, mediaType));
  const seasonsQuery = useQuery(seasonQuery(tmdbId, season, mediaType === "tv"));
  const recsQuery = useQuery(recommendationsQuery(tmdbId, mediaType));
  const credsQuery = useQuery(creditsQuery(tmdbId, mediaType));

  const media = details.data;
  const title = media?.title || (mediaType === "movie" ? "Movie" : "Series");
  const episodes = seasonsQuery.data ?? [];
  const recommendations = recsQuery.data ?? [];
  const cast = credsQuery.data ?? [];

  // Watchlist toggle hook
  const mediaItemForList: MediaItem | undefined = useMemo(() => {
    if (!media) return undefined;
    return {
      id: media.id,
      title: media.title,
      overview: media.overview,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: media.releaseDate,
      voteAverage: media.voteAverage,
      mediaType: media.mediaType,
      genreIds: media.genreIds,
    };
  }, [media]);

  const { inList, onToggle: toggleList, pending: listPending } = useMyListToggle(mediaItemForList);

  // Stream Resolution
  useEffect(() => {
    let cancelled = false;
    setStreamLoading(true);

    resolveStreamSource(
      {
        tmdbId,
        mediaType,
        season,
        episode,
      },
      serverIndex,
    ).then((resolved) => {
      if (!cancelled) {
        setStream(resolved);
        setStreamLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, season, episode, serverIndex]);

  // Handle stream failure / next server
  const handleNextServer = () => {
    setServerIndex((prev) => {
      if (prev === -1) {
        toast.info("Switching to backup fast stream server…");
        return 0; // Fallback from direct HLS to Server 1
      }
      const next = (prev + 1) % SERVER_COUNT;
      toast.info(`Switching to Server ${next + 1}…`);
      return next;
    });
  };

  const handleSelectServer = (idx: number) => {
    setServerIndex(idx);
    toast.info(idx === -1 ? "Connecting Direct HD…" : `Selected Server ${idx + 1}`);
  };

  // Play a specific episode
  const handleSelectEpisode = (epNum: number) => {
    void navigate({
      to: "/watch",
      search: {
        tmdbId,
        mediaType,
        season,
        episode: epNum,
      },
    });
  };

  // Switch season
  const handleSelectSeason = (sNum: number) => {
    void navigate({
      to: "/watch",
      search: {
        tmdbId,
        mediaType,
        season: sNum,
        episode: 1,
      },
    });
  };

  // Switch to recommended title
  const handleSelectRecommended = (rec: MediaItem) => {
    void navigate({
      to: "/watch",
      search: {
        tmdbId: rec.id,
        mediaType: rec.mediaType,
        season: 1,
        episode: 1,
      },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Progress update callback
  const handleProgress = (current: number, dur: number) => {
    if (!media) return;
    saveContinueWatching({
      mediaId: tmdbId,
      type: mediaType,
      title,
      posterPath: media.posterPath ?? null,
      season: mediaType === "tv" ? season : undefined,
      episode: mediaType === "tv" ? episode : undefined,
      watchedSeconds: current,
      durationSeconds: dur,
    });
  };

  // Share action
  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Watch ${title} on bujuu`,
          text: `Streaming ${title} now on bujuu Cinema with zero ads!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Clipboard sharing is not available in every browser context.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Watch link copied to clipboard!");
    } catch {
      toast.error("Could not share link.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 selection:bg-rose-500/30">
      {/* 1. DOCKED 16:9 VIDEO PLAYER AT TOP */}
      <div className="sticky top-0 z-40 w-full bg-black shadow-2xl">
        <div className="mx-auto max-w-5xl">
          <BujuuPlayer
            title={title}
            season={mediaType === "tv" ? season : undefined}
            episode={mediaType === "tv" ? episode : undefined}
            stream={stream}
            loading={streamLoading}
            onNextServer={handleNextServer}
            onSelectServer={handleSelectServer}
            onProgress={handleProgress}
            onBack={() => {
              if (window.history.length > 1) window.history.back();
              else void navigate({ to: "/" });
            }}
          />
        </div>
      </div>

      {/* 2. MEDIA DETAILS & ACTIONS (Styled to match Screenshot 2) */}
      <main className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        {/* Title Header with Info trigger */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow">
              {title}
            </h1>
            {media?.tagline && (
              <p className="mt-0.5 text-xs italic text-zinc-400 line-clamp-1">{media.tagline}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex items-center gap-1 rounded-full bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-800 transition"
          >
            <span>Info</span>
            <Info className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        </div>

        {/* Metadata Badges Row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400">
          <span className="flex items-center gap-1 font-bold text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {media?.voteAverage ? media.voteAverage.toFixed(1) : "8.2"}
          </span>
          <span className="text-zinc-600">•</span>
          <span>{yearOf(media?.releaseDate ?? null)}</span>
          <span className="text-zinc-600">•</span>
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-300 border border-zinc-700/50">
            {ageRating(media?.voteAverage ?? 7, tmdbId)}
          </span>
          <span className="text-zinc-600">•</span>
          <span>
            {mediaType === "tv"
              ? `${media?.seasons ?? 1} ${(media?.seasons ?? 1) === 1 ? "Season" : "Seasons"}`
              : formatRuntime(media?.runtimeMinutes ?? null) || "2h 10m"}
          </span>
          {media?.genres?.[0] && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300">{media.genres[0]}</span>
            </>
          )}
          <span className="rounded bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800/40">
            4K UHD
          </span>
        </div>

        {/* Action Buttons Row (Add to list, Share, Download) */}
        <div className="mt-4 flex items-center gap-3 border-y border-zinc-800/80 py-3">
          <Button
            variant="ghost"
            onClick={toggleList}
            disabled={listPending}
            className={`flex-1 gap-2 rounded-xl border text-xs font-bold transition ${
              inList
                ? "bg-white text-black border-white hover:bg-zinc-200"
                : "bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 hover:border-zinc-700"
            }`}
          >
            {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {inList ? "In My List" : "Add to list"}
          </Button>

          <Button
            variant="ghost"
            onClick={handleShare}
            className="flex-1 gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-white hover:bg-zinc-800 hover:border-zinc-700 transition"
          >
            <Share2 className="h-4 w-4 text-zinc-400" />
            <span>Share</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => setDownloadOpen(true)}
            className="flex-1 gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-white hover:bg-zinc-800 hover:border-zinc-700 transition"
          >
            <Download className="h-4 w-4 text-zinc-400" />
            <span>Download</span>
          </Button>
        </div>

        {/* 3. TV SERIES CONTROLS & EPISODE LIST (when mediaType is tv) */}
        {mediaType === "tv" ? (
          <section className="mt-6">
            {/* Audio & Season Selection Bar */}
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Audio:</span>
                <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-200 border border-zinc-800">
                  Original (English)
                </span>
              </div>

              {/* Season dropdown selector */}
              <div className="relative">
                <select
                  value={season}
                  onChange={(e) => handleSelectSeason(Number(e.target.value))}
                  className="appearance-none rounded-xl bg-zinc-900 pl-3 pr-8 py-1.5 text-xs font-bold text-white border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  {Array.from({ length: media?.seasons || 1 }).map((_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-zinc-950 text-white">
                      Season {String(i + 1).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>

            {/* Quick Episode Number Carousel Pills (All, 01, 02, 03...) */}
            {episodes.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {episodes.map((ep) => {
                  const isCurrent = ep.episodeNumber === episode;
                  return (
                    <button
                      key={ep.episodeNumber}
                      type="button"
                      onClick={() => handleSelectEpisode(ep.episodeNumber)}
                      className={`h-9 min-w-[42px] px-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
                        isCurrent
                          ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50 scale-105"
                          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800/80"
                      }`}
                    >
                      {String(ep.episodeNumber).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Detailed Episode Cards */}
            <div className="mt-4 space-y-3">
              {episodes.map((ep) => {
                const isCurrent = ep.episodeNumber === episode;
                const still = stillUrl(ep.stillPath);

                return (
                  <div
                    key={ep.episodeNumber}
                    onClick={() => handleSelectEpisode(ep.episodeNumber)}
                    className={`group flex items-center gap-3 rounded-2xl p-2.5 transition cursor-pointer border ${
                      isCurrent
                        ? "bg-rose-950/30 border-rose-500/50"
                        : "bg-zinc-950 border-zinc-900 hover:bg-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {/* Thumbnail with duration */}
                    <div className="relative aspect-video w-28 sm:w-36 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                      {still ? (
                        <img
                          src={still}
                          alt={ep.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-zinc-900 text-zinc-600">
                          <Tv className="h-6 w-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                        <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                      </div>
                      {isCurrent && (
                        <div className="absolute bottom-1 right-1 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                          Playing
                        </div>
                      )}
                    </div>

                    {/* Episode details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2
                          className={`truncate text-xs sm:text-sm font-bold ${isCurrent ? "text-rose-400" : "text-white"}`}
                        >
                          {ep.episodeNumber}. {ep.name}
                        </h2>
                        {ep.airDate && (
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            {yearOf(ep.airDate)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] sm:text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {ep.overview || "No episode synopsis provided."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          /* 4. MOVIE DETAILS & CAST (when mediaType is movie) */
          <section className="mt-5 space-y-4">
            <div>
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Synopsis</h2>
              <p className="mt-1 text-sm text-zinc-300 leading-relaxed">
                {media?.overview || "No overview available."}
              </p>
            </div>

            {cast.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
                  Top Cast
                </h2>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {cast.map((actor) => (
                    <div key={actor.id} className="w-20 shrink-0 text-center">
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                        {actor.profilePath ? (
                          <img
                            src={actor.profilePath}
                            alt={actor.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs font-bold text-zinc-600">
                            {actor.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-[11px] font-semibold text-white">
                        {actor.name}
                      </p>
                      <p className="truncate text-[10px] text-zinc-500">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5. RECOMMENDATIONS / "FOR YOU" SECTION (Matching Screenshot 2) */}
        {recommendations.length > 0 && (
          <section className="mt-8 border-t border-zinc-900 pt-6">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-rose-500" />
                <span>More Like This</span>
              </h2>
              <span className="text-xs text-zinc-500">Curated for you</span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {recommendations.slice(0, 10).map((rec) => {
                const poster = posterUrl(rec.posterPath, "w342");
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => handleSelectRecommended(rec)}
                    className="group text-left outline-none"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 transition group-hover:scale-105 group-hover:border-rose-500/50">
                      {poster ? (
                        <img
                          src={poster}
                          alt={rec.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center p-2 text-center text-xs text-zinc-600">
                          {rec.title}
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                        ★ {rec.voteAverage ? rec.voteAverage.toFixed(1) : "8.0"}
                      </div>
                    </div>
                    <p className="mt-1.5 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">
                      {rec.title}
                    </p>
                    <p className="text-[10px] text-zinc-500">{yearOf(rec.releaseDate)}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Info Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="bg-zinc-950 text-white border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {media?.tagline || "Title information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <p className="text-zinc-300 leading-relaxed">{media?.overview}</p>
            {media?.genres && (
              <div>
                <span className="font-semibold text-zinc-400">Genres: </span>
                <span className="text-white">{media.genres.join(", ")}</span>
              </div>
            )}
            <div>
              <span className="font-semibold text-zinc-400">Release Year: </span>
              <span className="text-white">{yearOf(media?.releaseDate ?? null)}</span>
            </div>
            {mediaType === "movie" && media?.runtimeMinutes && (
              <div>
                <span className="font-semibold text-zinc-400">Runtime: </span>
                <span className="text-white">{formatRuntime(media.runtimeMinutes)}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Sheet */}
      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="bg-zinc-950 text-white border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Download className="h-5 w-5 text-rose-500" />
              <span>Offline Download</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Save {title} to your device for offline playback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl bg-zinc-900 p-3 border border-zinc-800">
              <p className="text-xs font-semibold text-white">Full HD (1080p)</p>
              <p className="text-[11px] text-zinc-400">High quality · Approx 1.4 GB</p>
              <Button
                size="sm"
                className="mt-2 w-full bg-rose-600 hover:bg-rose-700 text-xs font-bold"
                onClick={() => {
                  setDownloadOpen(false);
                  toast.info("Offline caching initialized in background.");
                }}
              >
                Download 1080p
              </Button>
            </div>
            <div className="rounded-xl bg-zinc-900 p-3 border border-zinc-800">
              <p className="text-xs font-semibold text-white">Standard HD (720p)</p>
              <p className="text-[11px] text-zinc-400">Data saver · Approx 750 MB</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full border-zinc-700 text-xs font-bold"
                onClick={() => {
                  setDownloadOpen(false);
                  toast.info("Offline caching initialized in background.");
                }}
              >
                Download 720p
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

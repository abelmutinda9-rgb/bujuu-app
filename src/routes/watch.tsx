import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Download,
  Film,
  Play,
  Plus,
  Share2,
  Tv,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DownloadSheet } from "@/components/media/DownloadSheet";
import { BujuuPlayer } from "@/components/player/BujuuPlayer";
import { Button } from "@/components/ui/button";
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
  type MediaItem,
} from "@/services/tmdb";
import { resolveStreamSource, type ResolvedStream } from "@/services/stream-resolver";

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
  const [downloadOpen, setDownloadOpen] = useState(false);

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
      overview: "",
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

    resolveStreamSource(
      {
        tmdbId,
        mediaType,
        season,
        episode,
      },
      (better) => {
        if (!cancelled && better) {
          setStream(better);
        }
      },
    ).then((resolved) => {
      if (!cancelled && resolved) {
        setStream(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, season, episode]);

  // Current episode details
  const currentEpisode = episodes.find((e) => e.episodeNumber === episode);
  const currentEpisodeTitle = currentEpisode?.name;

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

  // Share action
  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Watch ${title} on BUJUU`,
          text: `Streaming ${title} now on BUJUU Cinema with zero ads!`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Watch link copied to clipboard!");
    } catch {
      toast.error("Could not share link.");
    }
  };

  // Track continue watching
  useEffect(() => {
    if (!media) return;
    saveContinueWatching({
      mediaId: tmdbId,
      type: mediaType,
      title,
      posterPath: (media?.posterPath ?? null) as string | null,
      season: mediaType === "tv" ? season : undefined,
      episode: mediaType === "tv" ? episode : undefined,
      watchedSeconds: 60,
      durationSeconds: 3600,
    });
  }, [tmdbId, mediaType, season, episode, title, media]);

  return (
    <div className="min-h-screen bg-black text-white pb-24 selection:bg-rose-500/30">
      {/* 1. DOCKED VIDEO PLAYER AT TOP (MovieBox Style) */}
      <div className="sticky top-0 z-40 w-full bg-black shadow-2xl">
        <div className="mx-auto max-w-5xl">
          <BujuuPlayer
            title={title}
            season={mediaType === "tv" ? season : undefined}
            episode={mediaType === "tv" ? episode : undefined}
            episodeTitle={currentEpisodeTitle}
            stream={stream}
            hasPrevEpisode={episode > 1}
            hasNextEpisode={episode < episodes.length}
            onPrevEpisode={() => handleSelectEpisode(episode - 1)}
            onNextEpisode={() => handleSelectEpisode(episode + 1)}
            onDownload={() => setDownloadOpen(true)}
          />
        </div>
      </div>

      {/* 2. MEDIA DETAILS & ACTIONS */}
      <main className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-normal text-white drop-shadow">
              {title}
            </h1>
          </div>
        </div>

        {/* Badges metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400">
          <span className="text-emerald-400">{matchPercent(media?.voteAverage ?? 8)}% Match</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-300">{yearOf(media?.releaseDate)}</span>
          <span className="text-zinc-600">•</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300 border border-zinc-700">
            {ageRating(media?.voteAverage ?? 8, tmdbId)}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-300">
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

        {/* 3. TV SERIES CONTROLS & EPISODE LIST */}
        {mediaType === "tv" ? (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Audio:</span>
                <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-200 border border-zinc-800">
                  Original
                </span>
              </div>

              {/* Season dropdown selector */}
              <div className="relative">
                <select
                  aria-label="Select season"
                  value={season}
                  onChange={(e) => handleSelectSeason(Number(e.target.value))}
                  className="appearance-none rounded-xl bg-zinc-900 pl-3 pr-8 py-1.5 text-xs font-bold text-white border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  {media?.seasonsList && media.seasonsList.length > 0
                    ? media.seasonsList.map((s) => (
                        <option
                          key={s.seasonNumber}
                          value={s.seasonNumber}
                          className="bg-zinc-950 text-white"
                        >
                          {s.name} ({s.episodeCount} eps)
                        </option>
                      ))
                    : Array.from({ length: media?.seasons || 1 }).map((_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-zinc-950 text-white">
                          Season {String(i + 1).padStart(2, "0")}
                        </option>
                      ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>

            {/* Quick Episode Number Carousel Pills */}
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

            {/* Detailed Episode Cards (NO synopsis) */}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          /* 4. MOVIE CAST (when mediaType is movie - NO synopsis) */
          <section className="mt-5 space-y-4">
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

        {/* 5. RECOMMENDATIONS / "MORE LIKE THIS" */}
        {recommendations.length > 0 && (
          <section className="mt-8 border-t border-zinc-900 pt-6">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Film className="h-4 w-4 text-zinc-400" />
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
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-rose-500">
                      {poster ? (
                        <img
                          src={poster}
                          alt={rec.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-zinc-600">
                          {rec.title}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs font-semibold text-zinc-300 group-hover:text-white">
                      {rec.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* MovieBox Download Sheet */}
      <DownloadSheet
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        title={title}
        tmdbId={tmdbId}
        mediaType={mediaType}
        posterPath={media?.posterPath ?? undefined}
        seasons={media?.seasonsList?.map((s) => ({
          id: s.seasonNumber,
          season_number: s.seasonNumber,
          name: s.name,
          episode_count: s.episodeCount,
          poster_path: null,
          overview: "",
        }))}
        currentSeason={season}
        episodes={episodes.map((e) => ({
          id: e.episodeNumber,
          episode_number: e.episodeNumber,
          name: e.name,
          runtime: 45,
        }))}
        onSelectSeason={handleSelectSeason}
      />
    </div>
  );
}

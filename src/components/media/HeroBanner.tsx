import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Info, Plus, Play, Sparkles, Volume2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAccount } from "@/hooks/use-account";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { useProfile } from "@/context/profile-context";
import { useMyListToggle } from "@/hooks/use-library";
import type { MediaItem } from "@/services/tmdb";
import { backdropUrl } from "@/services/tmdb";

const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  18: "Drama", 14: "Fantasy", 27: "Horror", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 53: "Thriller", 10765: "Sci-Fi",
};

export function HeroBanner({
  item,
  items,
  onSelect,
}: {
  item?: MediaItem;
  items?: MediaItem[];
  onSelect?: (item: MediaItem) => void;
}) {
  const rotationItems = useMemo(
    () => (items?.length ? items.slice(0, 5) : item ? [item] : []),
    [items, item],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const currentItem = rotationItems[currentIndex] ?? item;
  const myList = useMyListToggle(currentItem);
  const trial = useDeviceTrial();
  const { isKids } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (rotationItems.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % rotationItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [rotationItems.length, isPaused]);

  if (!currentItem) return null;

  const title = currentItem.title ?? currentItem.name ?? "Featured Title";
  const bg = backdropUrl(currentItem.backdrop_path ?? currentItem.poster_path, "original");
  const year = (currentItem.release_date ?? currentItem.first_air_date)?.slice(0, 4);
  const mediaType = currentItem.media_type ?? (currentItem.title ? "movie" : "tv");
  const genres = (currentItem.genre_ids ?? [])
    .map((id) => GENRES[id])
    .filter(Boolean)
    .slice(0, 3);

  const handlePlay = () => {
    if (isKids && currentItem.adult) {
      toast.error("Adult title blocked in Kids profile.");
      return;
    }
    navigate({ to: "/watch", search: { tmdbId: currentItem.id, type: mediaType } });
  };

  return (
    <div
      className="relative aspect-[16/9] sm:aspect-[21/9] w-full max-h-[82vh] min-h-[480px] overflow-hidden select-none bg-zinc-950"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* High-res Atmospheric Backdrop with Multi-layered Gradient */}
      <img
        src={bg}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-1000 ease-out scale-100 hover:scale-105"
      />

      {/* Cinematic Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent w-full sm:w-2/3" />
      <div className="absolute inset-0 bg-radial-at-t from-transparent via-black/20 to-black/80" />

      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 lg:p-16 max-w-3xl space-y-4">
        {/* Quality Badges and Metadata Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black tracking-wider uppercase shadow-md shadow-rose-600/30">
            Top 10 Today
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-md">
            4K Ultra HD
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-md">
            Dolby Atmos
          </span>
          {year && (
            <span className="text-xs font-semibold text-zinc-300">
              {year}
            </span>
          )}
          {currentItem.vote_average ? (
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              ★ {currentItem.vote_average.toFixed(1)}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-2xl leading-[1.05]">
          {title}
        </h1>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            {genres.map((g, idx) => (
              <span key={g} className="flex items-center gap-2">
                {g}
                {idx < genres.length - 1 && <span className="text-zinc-600">•</span>}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        <p className="line-clamp-2 sm:line-clamp-3 text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed drop-shadow">
          {currentItem.overview}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handlePlay}
            className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-2xl bg-white text-black font-extrabold text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-xl shadow-white/10 active:scale-95"
          >
            <Play className="h-4 w-4 fill-black" />
            Watch Now
          </button>

          <button
            onClick={() => myList.toggle()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900/80 border border-zinc-700/80 text-white font-bold text-xs sm:text-sm hover:bg-zinc-800 transition-all backdrop-blur-md active:scale-95"
          >
            {myList.inList ? <Check className="h-4 w-4 text-emerald-400" /> : <Plus className="h-4 w-4" />}
            {myList.inList ? "In My List" : "My List"}
          </button>

          {onSelect && (
            <button
              onClick={() => onSelect(currentItem)}
              className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900/80 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all backdrop-blur-md"
              title="More info"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rotation Pagination Indicators */}
      {rotationItems.length > 1 && (
        <div className="absolute bottom-6 right-6 sm:right-12 hidden sm:flex items-center gap-1.5 z-10">
          {rotationItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? "w-6 bg-rose-500" : "w-1.5 bg-white/30 hover:bg-white/60"
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Check, Info, Plus, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const currentItem = rotationItems[currentIndex] ?? item;
  const myList = useMyListToggle(currentItem);

  useEffect(() => {
    setCurrentIndex(0);
  }, [rotationItems.map((media) => media.id).join(",")]);

  useEffect(() => {
    if (rotationItems.length < 2 || isPaused) return;
    const timer = window.setInterval(
      () => setCurrentIndex((index) => (index + 1) % rotationItems.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, [rotationItems.length, isPaused]);

  useEffect(() => {
    if (rotationItems.length < 2) return;
    const next = rotationItems[(currentIndex + 1) % rotationItems.length];
    const nextUrl = next?.backdropPath && backdropUrl(next.backdropPath, "w1280");
    if (nextUrl) {
      const image = new Image();
      image.src = nextUrl;
    }
  }, [currentIndex, rotationItems]);

  if (!currentItem) return <div className="h-[70vh] w-full animate-pulse bg-card lg:h-[80vh]" />;

  const background = currentItem.backdropPath
    ? backdropUrl(currentItem.backdropPath, "w1280")
    : undefined;
  const tags = currentItem.genreIds.map((id) => GENRES[id]).filter(Boolean).slice(0, 3);
  const year = currentItem.releaseDate ? new Date(currentItem.releaseDate).getFullYear() : undefined;

  return (
    <section
      className="group relative h-[72vh] min-h-[440px] max-h-[900px] w-full overflow-hidden bg-zinc-950 lg:h-[85vh]"
      aria-label="Featured titles"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
      }}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {rotationItems.map((media, index) => {
        const imageUrl = media.backdropPath ? backdropUrl(media.backdropPath, "w1280") : undefined;
        const failed = failedImages.has(media.id);
        return (
          <div
            key={`${media.mediaType}-${media.id}`}
            aria-hidden={index !== currentIndex}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${index === currentIndex ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}
          >
            {imageUrl && !failed ? (
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                loading={index === currentIndex ? "eager" : "lazy"}
                decoding="async"
                onError={() => setFailedImages((prev) => new Set(prev).add(media.id))}
                className={`h-full w-full object-cover object-center transition-transform duration-[9000ms] ease-out motion-reduce:transform-none ${index === currentIndex ? "scale-105" : "scale-100"}`}
              />
            ) : null}
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black via-black/55 to-black/15" />
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-black to-transparent" />

      <div className="relative z-30 flex h-full flex-col justify-end gap-3 px-4 pb-14 sm:px-6 sm:pb-16 lg:px-12 lg:pb-20">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white sm:text-xs">FEATURED</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">{currentItem.mediaType === "tv" ? "Series" : "Movie"}</span>
        </div>
        <h1 className="max-w-2xl text-2xl font-black leading-tight text-white drop-shadow-md sm:text-4xl lg:text-6xl">{currentItem.title}</h1>
        {(year || tags.length > 0) && (
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/80 sm:text-sm">
            {year && <span>{year}</span>}
            {year && tags.length > 0 && <span aria-hidden="true">•</span>}
            {tags.length > 0 && <span>{tags.join(" • ")}</span>}
          </p>
        )}
        {currentItem.overview && <p className="line-clamp-2 max-w-xl text-xs text-white/80 sm:line-clamp-3 sm:text-sm lg:text-base">{currentItem.overview}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            to="/watch"
            search={{ tmdbId: currentItem.id, mediaType: currentItem.mediaType, season: 1, episode: 1 }}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-black shadow-lg transition-transform hover:scale-105 active:scale-95 sm:px-6 sm:py-3 sm:text-sm"
          >
            <Play className="h-4 w-4 fill-black sm:h-5 sm:w-5" /> Play
          </Link>
          {onSelect && (
            <button type="button" onClick={() => onSelect(currentItem)} className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-white/30 sm:px-6 sm:py-3 sm:text-sm">
              <Info className="h-4 w-4 sm:h-5 sm:w-5" /> More Info
            </button>
          )}
          <button type="button" onClick={myList.onToggle} disabled={myList.pending} aria-label={myList.inList ? "Remove from My List" : "Add to My List"} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:px-5 sm:py-3 sm:text-sm">
            {myList.inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{myList.inList ? "In My List" : "My List"}</span>
          </button>
        </div>

        {rotationItems.length > 1 && (
          <div className="mt-2 flex items-center gap-2" role="group" aria-label="Featured title slides">
            {rotationItems.map((media, index) => (
              <button
                key={`${media.mediaType}-${media.id}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-label={`Show ${media.title}`}
                aria-current={index === currentIndex ? "true" : undefined}
                className={`h-2 rounded-full transition-all motion-reduce:transition-none ${index === currentIndex ? "w-7 bg-rose-500" : "w-2 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

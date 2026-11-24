import { useState } from "react";
import type { MediaItem } from "@/services/tmdb";
import { posterUrl } from "@/services/tmdb";

export function MediaCard({
  item,
  onSelect,
}: {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = posterUrl(item.posterPath, "w342");

  return (
    <button
      type="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onFocus={(e) =>
        e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
      }
      className="group w-28 shrink-0 snap-start rounded-xl text-left outline-none transition-transform focus:scale-105 focus:ring-2 focus:ring-rose-500 sm:w-36 lg:w-40"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/80 transition-transform duration-200 group-hover:scale-[1.03] group-hover:border-zinc-700">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-zinc-900" />}
        {src ? (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center px-2 text-center text-xs text-zinc-500">
            {item.title}
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-zinc-300 group-hover:text-white transition">
        {item.title}
      </p>
    </button>
  );
}

import type { MediaItem } from "@/services/tmdb";
import { posterUrl } from "@/services/tmdb";

export function MediaCard({ item, onSelect }: { item: MediaItem; onSelect: (item: MediaItem) => void }) {
  const src = posterUrl(item.posterPath);

  return (
    <button
      type="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onFocus={(e) =>
        e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
      }
      className="group w-28 shrink-0 snap-start rounded-md text-left outline-none transition-transform focus:scale-105 focus:ring-4 focus:ring-brand sm:w-36 lg:w-40"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-card ring-1 ring-border transition-transform duration-200 group-hover:scale-[1.04]">
        {src ? (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center px-2 text-center text-xs text-muted-foreground">
            {item.title}
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{item.title}</p>
    </button>
  );
}

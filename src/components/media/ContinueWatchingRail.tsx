import { Link } from "@tanstack/react-router";
import type { ContinueWatchingItem } from "@/hooks/use-library";
import { posterUrl } from "@/services/tmdb";

export function ContinueWatchingRail({ items }: { items: ContinueWatchingItem[] }) {
  if (!items.length) return null;

  return (
    <section className="mt-8" aria-label="Continue Watching">
      <h2 className="px-4 text-base font-semibold text-white lg:px-8 lg:text-xl">Continue Watching</h2>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:px-8 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const progress = item.duration_seconds
            ? Math.min(100, Math.max(4, (item.watched_seconds / item.duration_seconds) * 100))
            : 24;
          const poster = posterUrl(item.poster_path);
          return (
            <Link
              key={`${item.media_type}-${item.tmdb_id}`}
              to="/watch"
              search={{ tmdbId: item.tmdb_id, mediaType: item.media_type, season: item.season || 1, episode: item.episode || 1 }}
              aria-label={`Continue watching ${item.title}`}
              className="group relative w-36 shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left transition hover:border-rose-500 sm:w-44"
            >
              <div className="relative aspect-[2/3] bg-zinc-900">
                {poster && <img src={poster} alt={item.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
                {item.media_type === "tv" && (
                  <span className="absolute right-2 top-2 rounded bg-black/85 px-2 py-1 text-[10px] font-bold text-white">
                    S{item.season}:E{item.episode}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                  <div className="h-full bg-rose-600" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <p className="truncate px-3 py-2 text-xs font-semibold text-white">{item.title}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

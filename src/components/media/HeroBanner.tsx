import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";

import { useMyListToggle } from "@/hooks/use-library";

import type { MediaItem } from "@/services/tmdb";
import { backdropUrl } from "@/services/tmdb";

const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  18: "Drama",
  14: "Fantasy",
  27: "Horror",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10765: "Sci-Fi",
};

export function HeroBanner({ item }: { item: MediaItem | undefined }) {
  const myList = useMyListToggle(item);
  if (!item) {
    return <div className="h-[70vh] w-full animate-pulse bg-card lg:h-[80vh]" />;
  }

  const bg = backdropUrl(item.backdropPath, "original");
  const tags = item.genreIds
    .map((id) => GENRES[id])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <section className="relative h-[70vh] w-full lg:h-[85vh]">
      {bg && <img src={bg} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

      <div className="relative flex h-full flex-col justify-end gap-4 px-4 pb-14 lg:px-8 lg:pb-20">
        <h1 className="max-w-2xl text-3xl font-black leading-tight lg:text-6xl">{item.title}</h1>
        {tags.length > 0 && (
          <p className="text-xs font-medium text-muted-foreground lg:text-sm">{tags.join(" • ")}</p>
        )}
        <p className="hidden max-w-xl text-sm text-muted-foreground lg:line-clamp-3 lg:block">{item.overview}</p>

        <div className="flex items-center gap-3">
          <Link
            to="/watch"
            search={{ tmdbId: item.id, mediaType: item.mediaType, season: 1, episode: 1 }}
            className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-85"
          >
            <Play className="h-4 w-4 fill-black" /> Play
          </Link>
          <button
            type="button"
            onClick={myList.onToggle}
            disabled={myList.pending}
            className="inline-flex items-center gap-2 rounded-md bg-white/20 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            {myList.inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {myList.inList ? "In My List" : "My List"}
          </button>
        </div>
      </div>
    </section>
  );
}

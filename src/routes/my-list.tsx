import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { MediaCard } from "@/components/media/MediaCard";
import { useMyList } from "@/hooks/use-library";
import type { MediaItem } from "@/services/tmdb";

export const Route = createFileRoute("/my-list")({
  head: () => ({
    meta: [
      { title: "My List — BUJUU" },
      { name: "description", content: "Movies and shows you saved on BUJUU." },
      { property: "og:title", content: "My List — BUJUU" },
      { property: "og:description", content: "Movies and shows you saved on BUJUU." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyListPage,
});

function MyListPage() {
  const navigate = useNavigate();
  const list = useMyList();
  const items: MediaItem[] = (list.data ?? []).map((r) => ({
    id: r.tmdb_id,
    mediaType: r.media_type as MediaItem["mediaType"],
    title: r.title,
    overview: "",
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    releaseDate: null,
    voteAverage: 0,
    genreIds: [],
  }));

  const handleSelect = (item: MediaItem) => {
    void navigate({
      to: "/watch",
      search: {
        tmdbId: item.id,
        mediaType: item.mediaType,
        season: 1,
        episode: 1,
      },
    });
  };

  return (
    <AppShell>
      <div className="px-4 pt-24 pb-16 lg:px-8">
        <h1 className="text-2xl font-bold lg:text-3xl text-white">My List</h1>
        {list.isLoading ? (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-zinc-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">
            Nothing saved yet. Tap “Add to list” on any movie or TV series to keep it here.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 [&>button]:w-full">
            {items.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

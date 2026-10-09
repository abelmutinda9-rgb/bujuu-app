import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaDetail } from "@/components/media/MediaDetail";
import { useSession } from "@/hooks/use-account";
import { useMyList } from "@/hooks/use-library";
import type { MediaItem } from "@/services/tmdb";

export const Route = createFileRoute("/my-list")({
  head: () => ({
    meta: [
      { title: "My List — bujuu" },
      { name: "description", content: "Movies and shows you saved on bujuu." },
      { property: "og:title", content: "My List — bujuu" },
      { property: "og:description", content: "Movies and shows you saved on bujuu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyListPage,
});

function MyListPage() {
  const { session, ready } = useSession();
  const list = useMyList();
  const [selected, setSelected] = useState<MediaItem | null>(null);
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

  return (
    <AppShell>
      <div className="px-4 pt-24 pb-16 lg:px-8">
        <h1 className="text-2xl font-bold lg:text-3xl">My List</h1>
        {ready && !session ? (
          <div className="mt-6 max-w-md rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Sign in to save movies and shows to My List.</p>
            <Link
              to="/auth"
              search={{ redirect: "/my-list" }}
              className="mt-4 inline-flex rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground"
            >
              Sign in
            </Link>
          </div>
        ) : list.isLoading ? (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nothing saved yet. Tap “My List” on any title to keep it here.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 [&>button]:w-full">
            {items.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>
      <MediaDetail item={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </AppShell>
  );
}

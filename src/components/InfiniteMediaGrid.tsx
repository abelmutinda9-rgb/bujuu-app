import { useCallback, useEffect, useRef, useState } from "react";

import { MediaCard } from "@/components/media/MediaCard";
import { MediaDetail } from "@/components/media/MediaDetail";
import { fetchMediaPage, type MediaItem, type MediaType } from "@/services/tmdb";

export type FeedKind = "trending" | "movies" | "tv" | "genre";

interface InfiniteMediaGridProps {
  title?: string;
  kind: FeedKind;
  genreId?: number;
}

function endpointFor(kind: FeedKind, genreId?: number) {
  switch (kind) {
    case "movies":
      return { path: "/discover/movie", params: { sort_by: "popularity.desc" }, fallback: "movie" as MediaType };
    case "tv":
      return { path: "/discover/tv", params: { sort_by: "popularity.desc" }, fallback: "tv" as MediaType };
    case "genre":
      return {
        path: "/discover/movie",
        params: { with_genres: String(genreId ?? 28), sort_by: "popularity.desc" },
        fallback: "movie" as MediaType,
      };
    default:
      return { path: "/trending/all/week", params: {}, fallback: "movie" as MediaType };
  }
}

export function InfiniteMediaGrid({ title = "More to explore", kind, genreId }: InfiniteMediaGridProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const idsRef = useRef<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const pageRef = useRef(1);

  // Reset when the feed changes.
  useEffect(() => {
    idsRef.current = new Set();
    pageRef.current = 1;
    setItems([]);
    setPage(1);
    setTotalPages(1);
  }, [kind, genreId]);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const { path, params, fallback } = endpointFor(kind, genreId);
        const result = await fetchMediaPage(path, nextPage, params, fallback);
        const existingIds = idsRef.current;
        const fresh = result.items.filter((item) => {
          if (existingIds.has(item.id)) return false;
          existingIds.add(item.id);
          return true;
        });
        setItems((prev) => [...prev, ...fresh]);
        setTotalPages(result.totalPages);
        pageRef.current = nextPage;
        setPage(nextPage);
      } catch {
        // Silently ignore — the grid keeps whatever it already has.
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [kind, genreId],
  );

  // Initial page.
  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  // Window scroll listener: load the next page within 400px of the bottom.
  useEffect(() => {
    const onScroll = () => {
      if (loadingRef.current) return;
      if (pageRef.current >= totalPages) return;
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
      if (nearBottom) void loadPage(pageRef.current + 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadPage, totalPages]);

  return (
    <section className="mt-10 px-4 lg:px-8">
      <h2 className="text-base font-semibold lg:text-xl">{title}</h2>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={setSelected} />
        ))}

        {loading &&
          Array.from({ length: 12 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="aspect-[2/3] animate-pulse rounded-md bg-card" />
          ))}
      </div>

      {page >= totalPages && items.length > 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">You&apos;ve reached the end.</p>
      )}

      <MediaDetail item={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </section>
  );
}

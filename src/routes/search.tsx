import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaDetail } from "@/components/media/MediaDetail";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { GENRES, infiniteCatalog, peopleQuery, type MediaItem } from "@/services/tmdb";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — bujuu" },
      { name: "description", content: "Find movies and series to stream on bujuu." },
      { property: "og:title", content: "Search — bujuu" },
      { property: "og:description", content: "Find movies and series to stream on bujuu." },
    ],
  }),
  component: SearchPage,
});

const CHIPS = ["All", "Movies", "TV Shows", "Actors", "Genres"] as const;
type Chip = (typeof CHIPS)[number];

function SearchPage() {
  const [term, setTerm] = useState("");
  const [chip, setChip] = useState<Chip>("All");
  const [genre, setGenre] = useState<number | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const debounced = useDebouncedValue(term, 300);

  const catalog = useInfiniteQuery(infiniteCatalog(debounced));
  const people = useQuery(peopleQuery(debounced));

  const base = useMemo(() => {
    const source =
      chip === "Actors" ? (people.data ?? []) : (catalog.data?.pages.flatMap((p) => p.items) ?? []);
    const seen = new Set<string>();
    return source.filter((item) => {
      const key = `${item.mediaType}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chip, people.data, catalog.data]);

  const items = useMemo(() => {
    if (chip === "Movies") return base.filter((i) => i.mediaType === "movie");
    if (chip === "TV Shows") return base.filter((i) => i.mediaType === "tv");
    if (chip === "Genres" && genre != null) return base.filter((i) => i.genreIds.includes(genre));
    return base;
  }, [base, chip, genre]);

  const availableGenres = useMemo(() => {
    const ids = new Set<number>();
    base.forEach((i) => i.genreIds.forEach((g) => ids.add(g)));
    return [...ids].filter((id) => GENRES[id]).slice(0, 12);
  }, [base]);

  // Infinite scroll sentinel
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || chip === "Actors") return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && catalog.hasNextPage && !catalog.isFetchingNextPage) {
        void catalog.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [chip, catalog]);

  return (
    <AppShell>
      <div className="px-4 pt-20 lg:px-8">
        <div className="flex items-center gap-3 rounded-md bg-secondary px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search movies and series"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              tabIndex={0}
              onClick={() => {
                setChip(c);
                if (c !== "Genres") setGenre(null);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium outline-none transition-all focus:ring-4 focus:ring-brand ${
                chip === c
                  ? "bg-white text-black"
                  : "bg-secondary text-muted-foreground hover:bg-white/15"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {chip === "Genres" && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {availableGenres.map((id) => (
              <button
                key={id}
                type="button"
                tabIndex={0}
                onClick={() => setGenre((g) => (g === id ? null : id))}
                className={`shrink-0 rounded-full border border-border px-3 py-1 text-[11px] outline-none transition-all focus:ring-4 focus:ring-brand ${
                  genre === id ? "bg-white/20 text-foreground" : "text-muted-foreground"
                }`}
              >
                {GENRES[id]}
              </button>
            ))}
          </div>
        )}

        <h1 className="mt-6 text-base font-semibold">
          {debounced.trim().length > 1 ? "Results" : "Trending now"}
        </h1>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={setSelected} />
          ))}
        </div>

        <div ref={sentinel} className="grid h-20 place-items-center">
          {catalog.isFetchingNextPage && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <MediaDetail item={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </AppShell>
  );
}

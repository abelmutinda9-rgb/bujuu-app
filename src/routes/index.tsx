import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { FeaturedCarousel } from "@/components/media/FeaturedCarousel";
import { HeroBanner } from "@/components/media/HeroBanner";
import { MediaRow } from "@/components/media/MediaRow";
import { ContinueWatchingRail } from "@/components/media/ContinueWatchingRail";
import { Top10Row } from "@/components/media/Top10Row";
import { useContinueWatching } from "@/hooks/use-library";
import {
  dynamicGenreQuery,
  nowPlayingQuery,
  topTenQuery,
  trendingQuery,
  type MediaItem,
} from "@/services/tmdb";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUJUU — Stream movies and series" },
      {
        name: "description",
        content: "Watch trending movies, daily top 10, and all genres with zero ads on BUJUU.",
      },
      { property: "og:title", content: "BUJUU — Stream movies and series" },
      {
        property: "og:description",
        content: "Watch trending movies, daily top 10, and all genres with zero ads on BUJUU.",
      },
    ],
  }),
  component: Index,
});

function GenreRowSection({
  title,
  genreId,
  mediaType = "movie",
  onSelect,
}: {
  title: string;
  genreId: number;
  mediaType?: "movie" | "tv";
  onSelect: (item: MediaItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isVisible) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  const query = useQuery({
    ...dynamicGenreQuery(genreId, mediaType),
    enabled: isVisible,
  });

  return (
    <div ref={containerRef} className="min-h-[160px]">
      {isVisible ? (
        <MediaRow
          title={title}
          items={query.data}
          isLoading={query.isLoading}
          onSelect={onSelect}
        />
      ) : (
        <div className="mt-8 px-4 lg:px-8">
          <div className="h-5 w-40 rounded bg-zinc-900/60 animate-pulse mb-3" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-28 shrink-0 rounded-md bg-zinc-900/40 animate-pulse sm:w-36 lg:w-40"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Index() {
  const navigate = useNavigate();
  const continueWatching = useContinueWatching();
  const trending = useQuery(trendingQuery());
  const topTen = useQuery(topTenQuery());
  const nowPlaying = useQuery(nowPlayingQuery());

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

  const continueItems: MediaItem[] = useMemo(
    () =>
      (continueWatching.data ?? []).map((row) => ({
        id: row.tmdb_id,
        mediaType: row.media_type,
        title: row.title,
        overview: "",
        posterPath: row.poster_path,
        backdropPath: row.backdrop_path,
        releaseDate: null,
        voteAverage: 0,
        genreIds: [],
      })),
    [continueWatching.data],
  );

  const heroItems = trending.data?.slice(0, 10);

  return (
    <AppShell>
      <HeroBanner items={heroItems} item={heroItems?.[0]} onSelect={handleSelect} />
      <div className="relative z-10 -mt-10 space-y-4 pb-16">
        {continueItems.length > 0 && <ContinueWatchingRail items={continueWatching.data ?? []} />}
        <MediaRow
          title="🔥 Trending Today"
          items={trending.data?.slice(1)}
          isLoading={trending.isLoading}
          onSelect={handleSelect}
        />
        <MediaRow
          title="🎬 New Releases & In Theatres"
          items={nowPlaying.data}
          isLoading={nowPlaying.isLoading}
          onSelect={handleSelect}
        />
        <Top10Row
          title="Top 10 Movies Today"
          items={topTen.data}
          isLoading={topTen.isLoading}
          onSelect={handleSelect}
        />
        {/* Nollywood shelf */}
        <GenreRowSection title="🇳🇬 Nollywood Hits" genreId={9901} onSelect={handleSelect} />
        
        <FeaturedCarousel items={nowPlaying.data?.slice(0, 12)} onSelect={handleSelect} />

        <GenreRowSection title="💥 Action & Adventure" genreId={28} onSelect={handleSelect} />
        <GenreRowSection title="🚀 Sci-Fi & Fantasy" genreId={878} onSelect={handleSelect} />
        <GenreRowSection title="😱 Horror & Suspense" genreId={27} onSelect={handleSelect} />
        <GenreRowSection title="😂 Comedy Hits" genreId={35} onSelect={handleSelect} />
        <GenreRowSection title="⛩️ Anime & Animation" genreId={16} onSelect={handleSelect} />
        <GenreRowSection title="🔍 Crime & Thrillers" genreId={80} onSelect={handleSelect} />
        <GenreRowSection title="🎭 Top Drama" genreId={18} onSelect={handleSelect} />
        <GenreRowSection title="❤️ Romance" genreId={10749} onSelect={handleSelect} />
        <GenreRowSection title="👪 Family & Kids" genreId={10751} onSelect={handleSelect} />
        <GenreRowSection title="📜 Documentaries" genreId={99} onSelect={handleSelect} />
      </div>
    </AppShell>
  );
}

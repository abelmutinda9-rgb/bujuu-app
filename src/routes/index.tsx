import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { FeaturedCarousel } from "@/components/media/FeaturedCarousel";
import { HeroBanner } from "@/components/media/HeroBanner";
import { MediaDetail } from "@/components/media/MediaDetail";
import { MediaRow } from "@/components/media/MediaRow";
import { Top10Row } from "@/components/media/Top10Row";
import { useProfile } from "@/context/profile-context";
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
      { title: "bujuu — Stream movies and series" },
      {
        name: "description",
        content: "Watch trending movies, daily top 10, and all genres with zero ads on bujuu.",
      },
      { property: "og:title", content: "bujuu — Stream movies and series" },
      {
        property: "og:description",
        content: "Watch trending movies, daily top 10, and all genres with zero ads on bujuu.",
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
  const query = useQuery(dynamicGenreQuery(genreId, mediaType));
  if (!query.isLoading && (!query.data || query.data.length === 0)) return null;

  return (
    <MediaRow
      title={title}
      items={query.data}
      isLoading={query.isLoading}
      onSelect={onSelect}
    />
  );
}

function Index() {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const { isKids } = useProfile();

  const trending = useQuery(trendingQuery());
  const topTen = useQuery(topTenQuery());
  const nowPlaying = useQuery(nowPlayingQuery());

  const heroItems = trending.data?.slice(0, 10);

  return (
    <AppShell>
      <HeroBanner
        items={heroItems}
        item={heroItems?.[0]}
        onSelect={setSelected}
      />

      <div className="-mt-10 relative z-10 space-y-4 pb-16">
        {/* Real-time Trending Row */}
        <MediaRow
          title={isKids ? "🌟 Kids Favorites" : "🔥 Trending Today"}
          items={isKids ? nowPlaying.data?.filter(i => !i.adult) : trending.data?.slice(1)}
          isLoading={trending.isLoading}
          onSelect={setSelected}
        />

        {/* Brand New Releases In Theatres / Digital */}
        {!isKids && (
          <MediaRow
            title="🎬 New Releases & In Theatres"
            items={nowPlaying.data}
            isLoading={nowPlaying.isLoading}
            onSelect={setSelected}
          />
        )}

        {/* Global Top 10 */}
        <Top10Row
          title={isKids ? "Top 10 Kids Hits" : "Top 10 Movies Today"}
          items={topTen.data}
          isLoading={topTen.isLoading}
          onSelect={setSelected}
        />

        {/* Featured Showcase Rail */}
        <FeaturedCarousel items={nowPlaying.data?.slice(0, 12)} onSelect={setSelected} />

        {/* Kids Mode Specific Rails */}
        {isKids ? (
          <>
            <GenreRowSection title="👪 Family & Kids" genreId={10751} onSelect={setSelected} />
            <GenreRowSection title="⛩️ Animated Adventures" genreId={16} onSelect={setSelected} />
            <GenreRowSection title="😂 Funny & Laughs" genreId={35} onSelect={setSelected} />
            <GenreRowSection title="🚀 Sci-Fi & Magic" genreId={878} onSelect={setSelected} />
            <GenreRowSection title="📜 Nature & Wonder" genreId={99} onSelect={setSelected} />
          </>
        ) : (
          /* Adult Mode Full Comprehensive Movie & TV Genres */
          <>
            <GenreRowSection title="💥 Action & Adventure" genreId={28} onSelect={setSelected} />
            <GenreRowSection title="🚀 Sci-Fi & Fantasy" genreId={878} onSelect={setSelected} />
            <GenreRowSection title="😱 Horror & Suspense" genreId={27} onSelect={setSelected} />
            <GenreRowSection title="😂 Comedy Hits" genreId={35} onSelect={setSelected} />
            <GenreRowSection title="⛩️ Anime & Animation" genreId={16} onSelect={setSelected} />
            <GenreRowSection title="🔍 Crime & Thrillers" genreId={80} onSelect={setSelected} />
            <GenreRowSection title="🎭 Top Drama" genreId={18} onSelect={setSelected} />
            <GenreRowSection title="❤️ Romance" genreId={10749} onSelect={setSelected} />
            <GenreRowSection title="👪 Family & Kids" genreId={10751} onSelect={setSelected} />
            <GenreRowSection title="📜 Documentaries" genreId={99} onSelect={setSelected} />
          </>
        )}
      </div>

      <MediaDetail item={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </AppShell>
  );
}

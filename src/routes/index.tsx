import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { FeaturedCarousel } from "@/components/media/FeaturedCarousel";
import { HeroBanner } from "@/components/media/HeroBanner";
import { MediaDetail } from "@/components/media/MediaDetail";
import { MediaRow } from "@/components/media/MediaRow";
import { Top10Row } from "@/components/media/Top10Row";
import {
  popularActionQuery,
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
        content: "Watch trending movies, the daily top 10 and popular action titles on bujuu.",
      },
      { property: "og:title", content: "bujuu — Stream movies and series" },
      {
        property: "og:description",
        content: "Watch trending movies, the daily top 10 and popular action titles on bujuu.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const trending = useQuery(trendingQuery());
  const topTen = useQuery(topTenQuery());
  const action = useQuery(popularActionQuery());

  const heroItems = trending.data?.slice(0, 5);

  return (
    <AppShell>
      <HeroBanner
        items={heroItems}
        item={heroItems?.[0]}
        onSelect={setSelected}
      />

      <div className="-mt-10 relative z-10">
        <MediaRow
          title="Trending Now"
          items={trending.data?.slice(1)}
          isLoading={trending.isLoading}
          onSelect={setSelected}
        />
        <FeaturedCarousel items={action.data?.slice(0, 12)} onSelect={setSelected} />

        <Top10Row
          title="Top 10 Movies Today"
          items={topTen.data}
          isLoading={topTen.isLoading}
          onSelect={setSelected}
        />
        <MediaRow
          title="Popular Action"
          items={action.data}
          isLoading={action.isLoading}
          onSelect={setSelected}
        />
      </div>

      <MediaDetail item={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </AppShell>
  );
}

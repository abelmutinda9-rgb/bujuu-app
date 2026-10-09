import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { MediaDetail } from "@/components/media/MediaDetail";
import { MediaRow } from "@/components/media/MediaRow";
import { newAndHotQuery, trendingQuery, type MediaItem } from "@/services/tmdb";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New & Hot — bujuu" },
      { name: "description", content: "Coming soon and everyone's watching right now on bujuu." },
      { property: "og:title", content: "New & Hot — bujuu" },
      { property: "og:description", content: "Coming soon and everyone's watching right now on bujuu." },
    ],
  }),
  component: NewPage,
});

function NewPage() {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const upcoming = useQuery(newAndHotQuery());
  const trending = useQuery(trendingQuery());

  return (
    <AppShell>
      <div className="px-4 pt-20 lg:px-8">
        <h1 className="text-2xl font-bold">New &amp; Hot</h1>
      </div>
      <MediaRow
        title="Coming soon"
        items={upcoming.data}
        isLoading={upcoming.isLoading}
        onSelect={setSelected}
      />
      <MediaRow
        title="Everyone's watching"
        items={trending.data}
        isLoading={trending.isLoading}
        onSelect={setSelected}
      />
      <MediaDetail item={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </AppShell>
  );
}

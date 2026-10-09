import { createFileRoute } from "@tanstack/react-router";

import { GenreBar } from "@/components/GenreBar";
import { InfiniteMediaGrid } from "@/components/InfiniteMediaGrid";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "TV Shows — bujuu" },
      { name: "description", content: "Browse popular series and TV shows streaming on bujuu." },
      { property: "og:title", content: "TV Shows — bujuu" },
      { property: "og:description", content: "Browse popular series and TV shows streaming on bujuu." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  return (
    <AppShell>
      <div className="pt-20">
        <GenreBar />
        <h1 className="mt-6 px-4 text-2xl font-bold lg:px-8">TV Shows</h1>
        <InfiniteMediaGrid title="All series" kind="tv" />
      </div>
    </AppShell>
  );
}

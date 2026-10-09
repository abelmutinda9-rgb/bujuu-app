import { createFileRoute } from "@tanstack/react-router";

import { GenreBar } from "@/components/GenreBar";
import { InfiniteMediaGrid } from "@/components/InfiniteMediaGrid";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/movies")({
  head: () => ({
    meta: [
      { title: "Movies — bujuu" },
      { name: "description", content: "Browse thousands of popular movies streaming on bujuu." },
      { property: "og:title", content: "Movies — bujuu" },
      { property: "og:description", content: "Browse thousands of popular movies streaming on bujuu." },
    ],
  }),
  component: MoviesPage,
});

function MoviesPage() {
  return (
    <AppShell>
      <div className="pt-20">
        <GenreBar />
        <h1 className="mt-6 px-4 text-2xl font-bold lg:px-8">Movies</h1>
        <InfiniteMediaGrid title="All movies" kind="movies" />
      </div>
    </AppShell>
  );
}

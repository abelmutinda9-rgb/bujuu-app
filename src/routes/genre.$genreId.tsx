import { createFileRoute } from "@tanstack/react-router";

import { GenreBar } from "@/components/GenreBar";
import { InfiniteMediaGrid } from "@/components/InfiniteMediaGrid";
import { AppShell } from "@/components/layout/AppShell";
import { genreName } from "@/config/genres";

export const Route = createFileRoute("/genre/$genreId")({
  head: () => ({
    meta: [
      { title: "Browse by genre — bujuu" },
      { name: "description", content: "Browse movies and series by genre on bujuu." },
      { property: "og:title", content: "Browse by genre — bujuu" },
      { property: "og:description", content: "Browse movies and series by genre on bujuu." },
    ],
  }),
  component: GenreView,
});

function GenreView() {
  const { genreId } = Route.useParams();
  const id = Number(genreId);

  return (
    <AppShell>
      <div className="pt-20">
        <GenreBar activeGenreId={id} />
        <h1 className="mt-6 px-4 text-2xl font-bold lg:px-8">{genreName(id)}</h1>
        <InfiniteMediaGrid title={`Popular in ${genreName(id)}`} kind="genre" genreId={id} />
      </div>
    </AppShell>
  );
}

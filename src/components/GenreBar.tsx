import { Link } from "@tanstack/react-router";

import { GENRE_OPTIONS } from "@/config/genres";

export function GenreBar({ activeGenreId }: { activeGenreId?: number }) {
  return (
    <nav
      aria-label="Genres"
      className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:px-8 [&::-webkit-scrollbar]:hidden"
    >
      {GENRE_OPTIONS.map((g) => {
        const active = activeGenreId === g.id;
        return (
          <Link
            key={g.id}
            to="/genre/$genreId"
            params={{ genreId: String(g.id) }}
            tabIndex={0}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold outline-none transition-transform focus:scale-105 focus:ring-4 focus:ring-brand ${
              active
                ? "bg-rose-600 text-white"
                : "bg-secondary text-muted-foreground hover:bg-white/15"
            }`}
          >
            {g.name}
          </Link>
        );
      })}
    </nav>
  );
}

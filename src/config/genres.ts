export interface GenreOption {
  id: number;
  name: string;
}

/** Standard TMDB genre mappings used across the app. */
export const GENRE_OPTIONS: GenreOption[] = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Horror" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10749, name: "Romance" },
  { id: 16, name: "Animation" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
];

export function genreName(id: number) {
  return GENRE_OPTIONS.find((g) => g.id === id)?.name ?? "Genre";
}

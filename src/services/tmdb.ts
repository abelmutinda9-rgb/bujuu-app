import { queryOptions } from "@tanstack/react-query";

import { tmdbQuery } from "@/lib/tmdb.functions";

export const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
  mediaType: MediaType;
  genreIds: number[];
}

export interface MediaDetails extends MediaItem {
  genres: string[];
  runtimeMinutes: number | null;
  seasons: number | null;
  tagline: string | null;
}

export function posterUrl(path: string | null, size: "w342" | "w500" = "w342") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w780" | "w1280" | "original" = "w1280") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}


const TMDB_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_TMDB_API_KEY) ||
  "a0f3ec7ad97db59c00931e7a88a827da";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  try {
    const url = new URL("https://api.themoviedb.org/3" + path);
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("language", params["language"] ?? "en-US");
    for (const [k, v] of Object.entries(params)) {
      if (k !== "language") url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch (err) {
    console.warn("Direct TMDB fetch failed, falling back to server function:", err);
  }

  return (await tmdbQuery({ data: { path, params } })) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(raw: any, fallbackType: MediaType = "movie"): MediaItem {
  const mediaType: MediaType = raw.media_type === "tv" || raw.first_air_date ? "tv" : fallbackType;
  return {
    id: raw.id,
    title: raw.title ?? raw.name ?? "Untitled",
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    releaseDate: raw.release_date ?? raw.first_air_date ?? null,
    voteAverage: raw.vote_average ?? 0,
    mediaType,
    genreIds: raw.genre_ids ?? [],
  };
}

interface ListResponse {
  results: any[];
}

async function list(path: string, params?: Record<string, string>, fallback?: MediaType) {
  const data = await tmdbFetch<ListResponse>(path, params);
  return (data.results ?? [])
    .filter((r) => r.media_type !== "person")
    .map((r) => normalize(r, fallback ?? "movie"));
}

export const trendingQuery = () =>
  queryOptions({
    queryKey: ["tmdb", "trending"],
    queryFn: () => list("/trending/all/week"),
    staleTime: 1000 * 60 * 10,
  });

export const topTenQuery = () =>
  queryOptions({
    queryKey: ["tmdb", "top10"],
    queryFn: async () => (await list("/movie/popular", { page: "1" }, "movie")).slice(0, 10),
    staleTime: 1000 * 60 * 10,
  });

export const popularActionQuery = () =>
  queryOptions({
    queryKey: ["tmdb", "action"],
    queryFn: () => list("/discover/movie", { with_genres: "28", sort_by: "popularity.desc" }, "movie"),
    staleTime: 1000 * 60 * 10,
  });

export const newAndHotQuery = () =>
  queryOptions({
    queryKey: ["tmdb", "newAndHot"],
    queryFn: () => list("/movie/upcoming", { page: "1" }, "movie"),
    staleTime: 1000 * 60 * 10,
  });

export const searchQuery = (term: string) =>
  queryOptions({
    queryKey: ["tmdb", "search", term],
    queryFn: () => list("/search/multi", { query: term, include_adult: "false" }),
    enabled: term.trim().length > 1,
    staleTime: 1000 * 60 * 5,
  });

export const detailsQuery = (id: number | null, mediaType: MediaType) =>
  queryOptions({
    queryKey: ["tmdb", "details", mediaType, id],
    queryFn: async (): Promise<MediaDetails> => {
      const raw = await tmdbFetch<any>(`/${mediaType}/${id}`);
      const base = normalize(raw, mediaType);
      return {
        ...base,
        mediaType,
        genres: (raw.genres ?? []).map((g: any) => g.name),
        runtimeMinutes: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
        seasons: raw.number_of_seasons ?? null,
        tagline: raw.tagline || null,
      };
    },
    enabled: id != null,
    staleTime: 1000 * 60 * 30,
  });

export function matchPercent(voteAverage: number) {
  return Math.max(50, Math.min(99, Math.round(voteAverage * 10)));
}

export function yearOf(date: string | null) {
  return date ? date.slice(0, 4) : "—";
}

export function ageRating(voteAverage: number, id: number) {
  const ratings = ["TV-14", "TV-MA", "PG-13", "R", "TV-PG"];
  return ratings[(id + Math.round(voteAverage)) % ratings.length];
}

export function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string | null;
}

export const seasonQuery = (id: number | null, seasonNumber: number, enabled = true) =>
  queryOptions({
    queryKey: ["tmdb", "season", id, seasonNumber],
    queryFn: async (): Promise<Episode[]> => {
      const raw = await tmdbFetch<any>(`/tv/${id}/season/${seasonNumber}`);
      return (raw.episodes ?? []).map((e: any) => ({
        episodeNumber: e.episode_number,
        name: e.name ?? `Episode ${e.episode_number}`,
        overview: e.overview ?? "",
        stillPath: e.still_path ?? null,
        airDate: e.air_date ?? null,
      }));
    },
    enabled: enabled && id != null,
    staleTime: 1000 * 60 * 30,
  });

export function stillUrl(path: string | null) {
  return path ? `${IMAGE_BASE}/w300${path}` : null;
}




/* ---------- Infinite catalog / search ---------- */

export interface Page {
  items: MediaItem[];
  page: number;
  totalPages: number;
}

export async function fetchMediaPage(
  path: string,
  page: number,
  params: Record<string, string> = {},
  fallback: MediaType = "movie",
): Promise<Page> {
  const data = await tmdbFetch<any>(path, { ...params, page: String(page) });
  return {
    items: (data.results ?? [])
      .filter((r: any) => r.media_type !== "person")
      .map((r: any) => normalize(r, fallback)),
    page: data.page ?? page,
    totalPages: data.total_pages ?? page,
  };
}

export const infiniteCatalog = (term: string) => ({
  queryKey: ["tmdb", "infinite", term] as const,
  queryFn: ({ pageParam }: { pageParam: number }) =>
    term.trim().length > 1
      ? fetchMediaPage("/search/multi", pageParam, { query: term, include_adult: "false" })
      : fetchMediaPage("/trending/all/week", pageParam),
  initialPageParam: 1,
  getNextPageParam: (last: Page) => (last.page < last.totalPages ? last.page + 1 : undefined),
  staleTime: 1000 * 60 * 5,
});

/* ---------- People (Actors chip) ---------- */

export const peopleQuery = (term: string) =>
  queryOptions({
    queryKey: ["tmdb", "people", term],
    queryFn: async (): Promise<MediaItem[]> => {
      const raw = await tmdbFetch<any>("/search/person", { query: term, include_adult: "false" });
      const known = (raw.results ?? []).flatMap((p: any) => p.known_for ?? []);
      return known.map((k: any) => normalize(k));
    },
    enabled: term.trim().length > 1,
    staleTime: 1000 * 60 * 10,
  });

/* ---------- Genres ---------- */

export const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  27: "Horror",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
};

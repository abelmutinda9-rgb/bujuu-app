import type { MediaType } from "./tmdb";

export interface EmbedTarget {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
}

export interface EmbedProvider {
  id: string;
  label: string;
  build: (t: EmbedTarget) => string;
}

const s = (t: EmbedTarget) => t.season ?? 1;
const e = (t: EmbedTarget) => t.episode ?? 1;
const isTv = (t: EmbedTarget) => t.mediaType === "tv";

export const PROVIDERS: EmbedProvider[] = [
  {
    id: "vidfast",
    label: "Server 1",
    build: (t) =>
      isTv(t)
        ? `https://vidfast.pro/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://vidfast.pro/movie/${t.tmdbId}`,
  },
  {
    id: "vidy",
    label: "Server 2",
    build: (t) =>
      isTv(t)
        ? `https://vidy.st/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://vidy.st/movie/${t.tmdbId}`,
  },
  {
    id: "vidrock",
    label: "Server 3",
    build: (t) =>
      isTv(t)
        ? `https://vidrock.net/embed/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://vidrock.net/embed/movie/${t.tmdbId}`,
  },
  {
    id: "vidvault",
    label: "Server 4",
    build: (t) =>
      isTv(t)
        ? `https://vidvault.ru/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://vidvault.ru/movie/${t.tmdbId}`,
  },
  {
    id: "vidsrcmov",
    label: "Server 5",
    build: (t) =>
      isTv(t)
        ? `https://vidsrc.mov/embed/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://vidsrc.mov/embed/movie/${t.tmdbId}`,
  },
  {
    id: "vidzee",
    label: "Server 6",
    build: (t) =>
      isTv(t)
        ? `https://player.vidzee.wtf/embed/tv/${t.tmdbId}/${s(t)}/${e(t)}`
        : `https://player.vidzee.wtf/embed/movie/${t.tmdbId}`,
  },
];

export const SERVER_COUNT = PROVIDERS.length;

export function embedUrl(target: EmbedTarget, serverIndex = 0): string {
  const provider = PROVIDERS[serverIndex % PROVIDERS.length] ?? PROVIDERS[0]!;
  return provider.build(target);
}

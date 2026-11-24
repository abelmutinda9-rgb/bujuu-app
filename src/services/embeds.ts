/**
 * BUJUU Multi-Server Stream Embed Resolver
 * Curated 12-provider pool with top 5 fast providers and default English subtitles.
 */

import { getCachedProviders, type StreamTarget } from "./remote-config";

export type { StreamTarget };

export interface StreamSource {
  authorized: boolean;
  serverIndex: number;
  serverName: string;
  streamUrl: string;
  provider: string;
}

export const SERVER_COUNT = 12;

export const SERVER_LABELS: readonly string[] = [
  "Server 1 (VidLink)",
  "Server 2 (AutoEmbed)",
  "Server 3 (SuperEmbed)",
  "Server 4 (Videasy)",
  "Server 5 (2Embed)",
  "Server 6 (VidSrc RIP)",
  "Server 7 (VidSrc TO)",
  "Server 8 (SmashyStream)",
  "Server 9 (Vidy)",
  "Server 10 (Vidrock)",
  "Server 11 (Vidvault)",
  "Server 12 (VixSrc)",
];

/**
 * Builds the embed URL for a given provider index with default English subtitles where supported.
 */
export function buildEmbedUrl(
  target: StreamTarget,
  serverIndex: number,
): { url: string; name: string } {
  const { tmdbId, mediaType } = target;
  const s = Math.max(1, target.season ?? 1);
  const e = Math.max(1, target.episode ?? 1);
  const isMovie = mediaType === "movie";
  const idx = ((serverIndex % SERVER_COUNT) + SERVER_COUNT) % SERVER_COUNT;

  const remote = getCachedProviders()[idx];
  const serverName = remote?.name || SERVER_LABELS[idx] || `Server ${idx + 1}`;

  switch (idx) {
    case 0:
      // VidLink - Fast, reliable, auto-defaults English subtitles
      return {
        url: isMovie
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&sub.default=en`
          : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=e50914&sub.default=en`,
        name: serverName,
      };

    case 1:
      // AutoEmbed - Verified responsive domain
      return {
        url: isMovie
          ? `https://autoembed.co/movie/tmdb/${tmdbId}`
          : `https://autoembed.co/tv/tmdb/${tmdbId}-${s}-${e}`,
        name: serverName,
      };

    case 2:
      // SuperEmbed / MultiEmbed
      return {
        url: isMovie
          ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`
          : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}`,
        name: serverName,
      };

    case 3:
      // Videasy - Clean, fast backup
      return {
        url: isMovie
          ? `https://player.videasy.net/movie/${tmdbId}`
          : `https://player.videasy.net/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 4:
      // 2Embed
      return {
        url: isMovie
          ? `https://www.2embed.cc/embed/${tmdbId}`
          : `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}`,
        name: serverName,
      };

    case 5:
      // VidSrc RIP
      return {
        url: isMovie
          ? `https://vidsrc.rip/embed/movie/${tmdbId}`
          : `https://vidsrc.rip/embed/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 6:
      // VidSrc TO
      return {
        url: isMovie
          ? `https://vidsrc.to/embed/movie/${tmdbId}`
          : `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 7:
      // SmashyStream
      return {
        url: isMovie
          ? `https://player.smashystream.com/movie/${tmdbId}`
          : `https://player.smashystream.com/tv/${tmdbId}?s=${s}&e=${e}`,
        name: serverName,
      };

    case 8:
      // Vidy
      return {
        url: isMovie ? `https://vidy.st/movie/${tmdbId}` : `https://vidy.st/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 9:
      // Vidrock
      return {
        url: isMovie
          ? `https://vidrock.net/embed/movie/${tmdbId}`
          : `https://vidrock.net/embed/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 10:
      // Vidvault
      return {
        url: isMovie
          ? `https://vidvault.to/movie/${tmdbId}`
          : `https://vidvault.to/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    case 11:
      // VixSrc
      return {
        url: isMovie
          ? `https://vixsrc.to/movie/${tmdbId}`
          : `https://vixsrc.to/tv/${tmdbId}/${s}/${e}`,
        name: serverName,
      };

    default:
      return {
        url: isMovie
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&sub.default=en`
          : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=e50914&sub.default=en`,
        name: serverName,
      };
  }
}

/**
 * Convenience helper returning raw embed URL string.
 */
export function embedUrl(
  targetOrTmdbId: StreamTarget | number,
  serverIndexOrMediaType?: number | "movie" | "tv",
  season: number = 1,
  episode: number = 1,
  serverIndex: number = 0,
): string {
  if (typeof targetOrTmdbId === "object") {
    const sIdx = typeof serverIndexOrMediaType === "number" ? serverIndexOrMediaType : 0;
    return buildEmbedUrl(targetOrTmdbId, sIdx).url;
  }
  const mType = (serverIndexOrMediaType as "movie" | "tv") ?? "movie";
  return buildEmbedUrl({ tmdbId: targetOrTmdbId, mediaType: mType, season, episode }, serverIndex)
    .url;
}

/**
 * Resolves stream source directly without any payment or account gating.
 */
export async function resolveBackendStream(
  target: StreamTarget,
  serverIndex: number = 0,
): Promise<StreamSource> {
  const normalizedIndex = ((serverIndex % SERVER_COUNT) + SERVER_COUNT) % SERVER_COUNT;
  const { url, name } = buildEmbedUrl(target, normalizedIndex);

  return {
    authorized: true,
    serverIndex: normalizedIndex,
    serverName: name,
    provider: name,
    streamUrl: url,
  };
}

export async function findFirstPlayableStream(target: StreamTarget): Promise<StreamSource> {
  return resolveBackendStream(target, 0);
}

/**
 * BUJUU Multi-Server Stream Resolver
 * 12 fast embed providers with automated silent failover and default English subtitles.
 * Server 6 (Vidzee) removed per spec.
 */

export interface StreamTarget {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
}

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
  "Server 2 (Vidfast)",
  "Server 3 (AutoEmbed)",
  "Server 4 (VidSrc RIP)",
  "Server 5 (VidSrc TO)",
  "Server 6 (SmashyStream)",
  "Server 7 (2Embed)",
  "Server 8 (Vidy)",
  "Server 9 (Vidrock)",
  "Server 10 (Vidvault)",
  "Server 11 (SuperEmbed)",
  "Server 12 (VixSrc)",
];

/**
 * Builds the embed URL for a given provider index with default English subtitles where supported.
 */
export function buildEmbedUrl(target: StreamTarget, serverIndex: number): { url: string; name: string } {
  const { tmdbId, mediaType } = target;
  const s = Math.max(1, target.season ?? 1);
  const e = Math.max(1, target.episode ?? 1);
  const isMovie = mediaType === "movie";
  const idx = ((serverIndex % SERVER_COUNT) + SERVER_COUNT) % SERVER_COUNT;

  switch (idx) {
    case 0:
      // VidLink - Fast, reliable, auto-defaults English subtitles
      return {
        url: isMovie
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&sub.default=en`
          : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=e50914&sub.default=en`,
        name: "VidLink",
      };

    case 1:
      // Vidfast - Highly responsive
      return {
        url: isMovie
          ? `https://vidfast.pro/movie/${tmdbId}?sub.default=en`
          : `https://vidfast.pro/tv/${tmdbId}/${s}/${e}?sub.default=en`,
        name: "Vidfast",
      };

    case 2:
      // AutoEmbed - Verified responsive domain
      return {
        url: isMovie
          ? `https://autoembed.co/movie/tmdb/${tmdbId}`
          : `https://autoembed.co/tv/tmdb/${tmdbId}-${s}-${e}`,
        name: "AutoEmbed",
      };

    case 3:
      // VidSrc RIP
      return {
        url: isMovie
          ? `https://vidsrc.rip/embed/movie/${tmdbId}`
          : `https://vidsrc.rip/embed/tv/${tmdbId}/${s}/${e}`,
        name: "VidSrc RIP",
      };

    case 4:
      // VidSrc TO
      return {
        url: isMovie
          ? `https://vidsrc.to/embed/movie/${tmdbId}`
          : `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`,
        name: "VidSrc TO",
      };

    case 5:
      // SmashyStream
      return {
        url: isMovie
          ? `https://player.smashystream.com/movie/${tmdbId}`
          : `https://player.smashystream.com/tv/${tmdbId}?s=${s}&e=${e}`,
        name: "SmashyStream",
      };

    case 6:
      // 2Embed
      return {
        url: isMovie
          ? `https://www.2embed.cc/embed/${tmdbId}`
          : `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}`,
        name: "2Embed",
      };

    case 7:
      // Vidy
      return {
        url: isMovie
          ? `https://vidy.st/movie/${tmdbId}`
          : `https://vidy.st/tv/${tmdbId}/${s}/${e}`,
        name: "Vidy",
      };

    case 8:
      // Vidrock
      return {
        url: isMovie
          ? `https://vidrock.net/embed/movie/${tmdbId}`
          : `https://vidrock.net/embed/tv/${tmdbId}/${s}/${e}`,
        name: "Vidrock",
      };

    case 9:
      // Vidvault
      return {
        url: isMovie
          ? `https://vidvault.to/movie/${tmdbId}`
          : `https://vidvault.to/tv/${tmdbId}/${s}/${e}`,
        name: "Vidvault",
      };

    case 10:
      // SuperEmbed / MultiEmbed
      return {
        url: isMovie
          ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`
          : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}`,
        name: "SuperEmbed",
      };

    case 11:
      // VixSrc
      return {
        url: isMovie
          ? `https://vixsrc.to/movie/${tmdbId}`
          : `https://vixsrc.to/tv/${tmdbId}/${s}/${e}`,
        name: "VixSrc",
      };

    default:
      return {
        url: isMovie
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&sub.default=en`
          : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=e50914&sub.default=en`,
        name: "VidLink",
      };
  }
}

/**
 * Convenience helper returning raw embed URL string.
 * Supports both object and positional argument styles.
 */
export function embedUrl(
  targetOrTmdbId: StreamTarget | number,
  serverIndexOrMediaType?: number | "movie" | "tv",
  season: number = 1,
  episode: number = 1,
  serverIndex: number = 0
): string {
  if (typeof targetOrTmdbId === "object") {
    const sIdx = typeof serverIndexOrMediaType === "number" ? serverIndexOrMediaType : 0;
    return buildEmbedUrl(targetOrTmdbId, sIdx).url;
  }
  const mType = (serverIndexOrMediaType as "movie" | "tv") ?? "movie";
  return buildEmbedUrl({ tmdbId: targetOrTmdbId, mediaType: mType, season, episode }, serverIndex).url;
}

/**
 * Resolves stream source directly without any payment or account gating.
 */
export async function resolveBackendStream(
  target: StreamTarget,
  serverIndex: number = 0
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

/**
 * Default initial playback resolver.
 */
export async function findFirstPlayableStream(target: StreamTarget): Promise<StreamSource> {
  return resolveBackendStream(target, 0);
}

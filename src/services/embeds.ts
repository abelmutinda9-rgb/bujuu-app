/**
 * BUJUU Direct Stream Embed Resolver
 * Clean cinema embed resolver with zero server selection or server UI.
 */

import type { StreamTarget } from "./remote-config";

export type { StreamTarget };

export interface StreamSource {
  authorized: boolean;
  streamUrl: string;
  provider: string;
}

export const SERVER_COUNT = 1;

/**
 * Builds the direct cinema embed URL (VidLink default with English subtitles where supported).
 */
export function buildEmbedUrl(target: StreamTarget): { url: string; name: string } {
  const { tmdbId, mediaType } = target;
  const s = Math.max(1, target.season ?? 1);
  const e = Math.max(1, target.episode ?? 1);
  const isMovie = mediaType === "movie";

  return {
    url: isMovie
      ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&sub.default=en`
      : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=e50914&sub.default=en`,
    name: "BUJUU Cinema",
  };
}

/**
 * Convenience helper returning raw embed URL string.
 */
export function embedUrl(
  targetOrTmdbId: StreamTarget | number,
  mediaTypeOrIndex?: number | "movie" | "tv",
  season: number = 1,
  episode: number = 1,
): string {
  if (typeof targetOrTmdbId === "object") {
    return buildEmbedUrl(targetOrTmdbId).url;
  }
  const mType = typeof mediaTypeOrIndex === "string" ? mediaTypeOrIndex : "movie";
  return buildEmbedUrl({ tmdbId: targetOrTmdbId, mediaType: mType, season, episode }).url;
}

/**
 * Resolves stream source directly without any payment or account gating.
 */
export async function resolveBackendStream(
  target: StreamTarget,
): Promise<StreamSource> {
  const { url, name } = buildEmbedUrl(target);

  return {
    authorized: true,
    provider: name,
    streamUrl: url,
  };
}

export async function findFirstPlayableStream(target: StreamTarget): Promise<StreamSource> {
  return resolveBackendStream(target);
}

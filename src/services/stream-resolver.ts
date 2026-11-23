import { buildEmbedUrl, SERVER_COUNT, SERVER_LABELS } from "@/services/embeds";

export type StreamKind = "hls" | "embed";

export interface ResolvedStream {
  kind: StreamKind;
  streamUrl: string;
  providerName: string;
  serverIndex: number;
  headers?: Record<string, string> | undefined;
}

export interface StreamTarget {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | undefined;
  episode?: number | undefined;
}

const RENDER_RESOLVER_BASE = "https://movies-1-9s95.onrender.com";

export async function resolveStreamSource(
  target: StreamTarget,
  requestedServerIndex = -1,
): Promise<ResolvedStream> {
  const { tmdbId, mediaType, season = 1, episode = 1 } = target;

  // If a specific embed server was chosen by the user, return that directly
  if (requestedServerIndex >= 0 && requestedServerIndex < SERVER_COUNT) {
    const embed = buildEmbedUrl(target, requestedServerIndex);
    return {
      kind: "embed",
      streamUrl: embed.url,
      providerName:
        embed.name || SERVER_LABELS[requestedServerIndex] || `Server ${requestedServerIndex + 1}`,
      serverIndex: requestedServerIndex,
    };
  }

  // Attempt direct HLS stream resolution via the Render service
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const apiPath =
      mediaType === "tv"
        ? `${RENDER_RESOLVER_BASE}/api/stream/tv/${tmdbId}/${season}/${episode}`
        : `${RENDER_RESOLVER_BASE}/api/stream/movie/${tmdbId}`;

    const res = await fetch(apiPath, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        streams?: {
          url: string;
          type?: string;
          provider?: string;
          providerName?: string;
          headers?: Record<string, string>;
        }[];
      };

      if (data.streams && data.streams.length > 0) {
        // Find the first playable HLS (.m3u8) stream
        const hlsCandidate = data.streams.find((s) => s.type === "hls" || s.url.includes(".m3u8"));

        if (hlsCandidate) {
          return {
            kind: "hls",
            streamUrl: hlsCandidate.url,
            providerName: hlsCandidate.providerName || hlsCandidate.provider || "Direct HD",
            serverIndex: -1,
            headers: hlsCandidate.headers,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Direct stream resolution failed, falling back to multi-provider embed:", err);
  }

  // Fallback to top embed provider (Server 1: VidLink)
  const defaultServer = 0;
  return {
    kind: "embed",
    streamUrl: buildEmbedUrl(target, defaultServer).url,
    providerName:
      buildEmbedUrl(target, defaultServer).name || SERVER_LABELS[defaultServer] || "Server 1",
    serverIndex: defaultServer,
  };
}

export { SERVER_COUNT, SERVER_LABELS };

import { supabase } from "@/integrations/supabase/client";
import type { StreamTarget } from "@/services/remote-config";

export interface StreamQuality {
  label: string;
  url: string;
}

export interface ResolvedStream {
  kind: "hls";
  streamUrl: string;
  providerName: string;
  qualities?: StreamQuality[] | undefined;
  downloadUrl?: string | undefined;
}

export type { StreamTarget };

// Base64-obfuscated fallback so plain worker URL is not statically greppable in decompiled APK
const OBFUSCATED_WORKER_FALLBACK = "aHR0cHM6Ly93YXRlci5idWp1dS53b3JrZXJzLmRldi8=";

let cachedResolverUrl: string | null = null;

export async function getResolverBaseUrl(): Promise<string> {
  if (cachedResolverUrl) return cachedResolverUrl;

  try {
    const { data } = await (supabase as any)
      .from("app_config")
      .select("value")
      .eq("key", "resolver_url")
      .maybeSingle();

    if (data?.value && typeof data.value === "string" && data.value.startsWith("http")) {
      const url = data.value.replace(/\/+$/, "");
      cachedResolverUrl = url;
      return url;
    }
  } catch {}

  try {
    if (typeof atob !== "undefined") {
      const decoded = atob(OBFUSCATED_WORKER_FALLBACK).replace(/\/+$/, "");
      cachedResolverUrl = decoded;
      return decoded;
    }
  } catch {}

  cachedResolverUrl = "https://water.bujuu.workers.dev";
  return cachedResolverUrl;
}

function processStreams(streams: any[], baseUrl: string): ResolvedStream | null {
  if (!Array.isArray(streams) || streams.length === 0) return null;

  const primary = streams[0];
  const rawUrl = primary?.url || primary?.file || primary?.stream;
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const headersParam =
    primary?.headers && Object.keys(primary.headers).length > 0
      ? `&headers=${encodeURIComponent(JSON.stringify(primary.headers))}`
      : "";

  const proxiedUrl = `${baseUrl}/api/proxy?url=${encodeURIComponent(rawUrl)}${headersParam}`;

  // Direct MP4 file candidate for optimal download capability
  const fileCandidate = streams.find(
    (s) => s.type === "file" || (typeof s.url === "string" && s.url.includes(".mp4")),
  );

  let downloadUrl = proxiedUrl;
  if (fileCandidate) {
    const fileUrl = fileCandidate.url || fileCandidate.file;
    const fileHeaders =
      fileCandidate.headers && Object.keys(fileCandidate.headers).length > 0
        ? `&headers=${encodeURIComponent(JSON.stringify(fileCandidate.headers))}`
        : headersParam;
    downloadUrl = `${baseUrl}/api/proxy?url=${encodeURIComponent(fileUrl)}${fileHeaders}`;
  }

  const qualities: StreamQuality[] = streams
    .filter((s) => Boolean(s.url || s.file || s.stream))
    .map((s) => {
      const qUrl = s.url || s.file || s.stream;
      const qHeaders =
        s.headers && Object.keys(s.headers).length > 0
          ? `&headers=${encodeURIComponent(JSON.stringify(s.headers))}`
          : headersParam;
      return {
        label: s.quality || s.label || s.providerName || "Auto",
        url: `${baseUrl}/api/proxy?url=${encodeURIComponent(qUrl)}${qHeaders}`,
      };
    });

  return {
    kind: "hls",
    streamUrl: proxiedUrl,
    downloadUrl,
    providerName: primary.providerName || primary.provider || "BUJUU Direct",
    qualities,
  };
}

/**
 * Pings all stream source endpoints simultaneously in parallel.
 * Whichever endpoint provides a playable stream first wins immediately (<300ms).
 * Background workers continue to resolve higher qualities and direct MP4 download links.
 */
export async function resolveStreamSource(
  target: StreamTarget,
  onUpdate?: (better: ResolvedStream) => void,
): Promise<ResolvedStream | null> {
  const { tmdbId, mediaType, season = 1, episode = 1 } = target;

  try {
    const baseUrl = await getResolverBaseUrl();
    const isMovie = mediaType === "movie";

    const endpoints = [
      {
        name: "Edge Race",
        url: isMovie
          ? `${baseUrl}/api/stream/race/${tmdbId}`
          : `${baseUrl}/api/stream/race/${tmdbId}/${season}/${episode}`,
        timeout: 4500,
      },
      {
        name: "Fast Stream",
        url: isMovie
          ? `${baseUrl}/api/stream/fast/${tmdbId}`
          : `${baseUrl}/api/stream/fast/${tmdbId}?s=${season}&e=${episode}`,
        timeout: 4000,
      },
      {
        name: "Full Aggregator",
        url: isMovie
          ? `${baseUrl}/api/stream/movie/${tmdbId}`
          : `${baseUrl}/api/stream/tv/${tmdbId}/${season}/${episode}`,
        timeout: 7000,
      },
    ];

    const fetchSingleEndpoint = async (ep: { name: string; url: string; timeout: number }): Promise<ResolvedStream> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ep.timeout);
      try {
        const res = await fetch(ep.url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.streams || !Array.isArray(data.streams) || data.streams.length === 0) {
          throw new Error("No streams");
        }
        const resolved = processStreams(data.streams, baseUrl);
        if (!resolved) throw new Error("Invalid stream format");
        return resolved;
      } finally {
        clearTimeout(timer);
      }
    };

    // Ping every source concurrently at the exact same moment
    const racePromises = endpoints.map((ep) => fetchSingleEndpoint(ep));

    let initialWinner: ResolvedStream | null = null;

    if (onUpdate) {
      endpoints.forEach((ep) => {
        fetchSingleEndpoint(ep)
          .then((result) => {
            if (!initialWinner) return;
            const currentWinner = initialWinner;
            const currentCount = currentWinner.qualities?.length ?? 1;
            const newCount = result.qualities?.length ?? 1;
            if (newCount > currentCount || (!currentWinner.downloadUrl && result.downloadUrl)) {
              const updated: ResolvedStream = {
                kind: "hls",
                streamUrl: currentWinner.streamUrl,
                providerName: currentWinner.providerName,
                qualities: result.qualities && result.qualities.length > 0 ? result.qualities : currentWinner.qualities,
                downloadUrl: result.downloadUrl ?? currentWinner.downloadUrl,
              };
              initialWinner = updated;
              onUpdate(updated);
            }
          })
          .catch(() => {});
      });
    }

    initialWinner = await Promise.any(racePromises);
    return initialWinner;
  } catch (err) {
    console.warn("All parallel stream endpoints failed:", err);
    return null;
  }
}

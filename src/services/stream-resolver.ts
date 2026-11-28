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
  qualities?: StreamQuality[];
  downloadUrl?: string;
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
 * Resolves the primary video stream via Cloudflare Worker API only.
 * Completely removed any embed fallbacks: 100% native video streams.
 */
export async function resolveStreamSource(
  target: StreamTarget,
): Promise<ResolvedStream | null> {
  const { tmdbId, mediaType, season = 1, episode = 1 } = target;

  try {
    const baseUrl = await getResolverBaseUrl();

    // 1. Tier 1: Fast racing endpoint (~200ms)
    try {
      const fastEndpoint =
        mediaType === "movie"
          ? `${baseUrl}/api/stream/fast/${tmdbId}`
          : `${baseUrl}/api/stream/fast/${tmdbId}?s=${season}&e=${episode}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(fastEndpoint, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.streams && Array.isArray(data.streams) && data.streams.length > 0) {
          const resolved = processStreams(data.streams, baseUrl);
          if (resolved) return resolved;
        }
      }
    } catch {}

    // 2. Tier 2: Cloudflare Worker full route (/api/stream/movie/:id or /api/stream/tv/:id/:s/:e)
    try {
      const fullEndpoint =
        mediaType === "movie"
          ? `${baseUrl}/api/stream/movie/${tmdbId}`
          : `${baseUrl}/api/stream/tv/${tmdbId}/${season}/${episode}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(fullEndpoint, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.streams && Array.isArray(data.streams) && data.streams.length > 0) {
          const resolved = processStreams(data.streams, baseUrl);
          if (resolved) return resolved;
        }
      }
    } catch {}
  } catch {}

  return null;
}

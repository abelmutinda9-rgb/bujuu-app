import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl, SERVER_COUNT } from "@/services/embeds";
import type { StreamTarget } from "@/services/remote-config";

export type StreamKind = "hls" | "embed";

export interface ResolvedStream {
  kind: StreamKind;
  streamUrl: string;
  providerName: string;
  serverIndex: number;
  qualities?: { label: string; url: string }[];
}

export type { StreamTarget };

// Base64-obfuscated fallback so plain worker URL is not statically greppable in decompiled APK
const OBFUSCATED_WORKER_FALLBACK = "aHR0cHM6Ly93YXRlci5idWp1dS53b3JrZXJzLmRldi8=";

let cachedResolverUrl: string | null = null;

async function getResolverBaseUrl(): Promise<string> {
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

/**
 * Resolves the primary video stream.
 * Automatically tries the high-speed Worker resolver; if unavailable,
 * smoothly falls back to the resilient direct embed with zero server UI.
 */
export async function resolveStreamSource(
  target: StreamTarget,
  requestedIndex = 0,
): Promise<ResolvedStream> {
  const { tmdbId, mediaType, season = 1, episode = 1 } = target;

  try {
    const baseUrl = await getResolverBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);

    const endpoint =
      mediaType === "movie"
        ? `${baseUrl}/api/stream/fast/${tmdbId}`
        : `${baseUrl}/api/stream/fast/${tmdbId}?s=${season}&e=${episode}`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.streams) && data.streams.length > 0) {
        const primary = data.streams[0];
        const streamUrl = primary?.url || primary?.file || primary?.stream;
        if (streamUrl && typeof streamUrl === "string") {
          return {
            kind: "hls",
            streamUrl,
            providerName: "BUJUU Direct",
            serverIndex: 0,
            qualities: data.streams.map((s: any) => ({
              label: s.quality || s.label || "Auto",
              url: s.url || s.file || s.stream,
            })),
          };
        }
      }
    }
  } catch {}

  // Seamless fallback to resilient direct player
  const embed = buildEmbedUrl(target, requestedIndex);
  return {
    kind: "embed",
    streamUrl: embed.url,
    providerName: "BUJUU Cinema",
    serverIndex: requestedIndex,
  };
}

export { SERVER_COUNT };

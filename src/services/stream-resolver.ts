import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl } from "@/services/embeds";
import type { StreamTarget } from "@/services/remote-config";

export type StreamKind = "hls" | "embed";

export interface ResolvedStream {
  kind: StreamKind;
  streamUrl: string;
  providerName: string;
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
 * Direct cloud-accelerated HLS stream routed through high-speed Worker proxy;
 * automatically falls back to cinema direct player if unavailable.
 * Zero server selection or server UI.
 */
export async function resolveStreamSource(
  target: StreamTarget,
): Promise<ResolvedStream> {
  const { tmdbId, mediaType, season = 1, episode = 1 } = target;

  try {
    const baseUrl = await getResolverBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

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
        const rawStreamUrl = primary?.url || primary?.file || primary?.stream;
        if (rawStreamUrl && typeof rawStreamUrl === "string") {
          const headersParam =
            primary?.headers && Object.keys(primary.headers).length > 0
              ? `&headers=${encodeURIComponent(JSON.stringify(primary.headers))}`
              : "";
          const proxiedUrl = `${baseUrl}/api/proxy?url=${encodeURIComponent(rawStreamUrl)}${headersParam}`;

          return {
            kind: "hls",
            streamUrl: proxiedUrl,
            providerName: "BUJUU Direct",
            qualities: data.streams.map((s: any) => {
              const qUrl = s.url || s.file || s.stream;
              const qHeaders =
                s.headers && Object.keys(s.headers).length > 0
                  ? `&headers=${encodeURIComponent(JSON.stringify(s.headers))}`
                  : headersParam;
              return {
                label: s.quality || s.label || "Auto",
                url: `${baseUrl}/api/proxy?url=${encodeURIComponent(qUrl)}${qHeaders}`,
              };
            }),
          };
        }
      }
    }
  } catch {}

  // Seamless fallback to resilient direct cinema player
  const embed = buildEmbedUrl(target);
  return {
    kind: "embed",
    streamUrl: embed.url,
    providerName: "BUJUU Cinema",
  };
}

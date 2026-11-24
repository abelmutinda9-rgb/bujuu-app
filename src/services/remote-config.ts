import { supabase } from "@/integrations/supabase/client";

export interface StreamProvider {
  id: string;
  name: string;
  badge?: string;
  enabled: boolean;
  priority: number;
}

export interface StreamTarget {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number | undefined;
  episode?: number | undefined;
}

export const FALLBACK_PROVIDERS: StreamProvider[] = [
  { id: "vidlink", name: "Server 1 (VidLink)", badge: "Fast", enabled: true, priority: 1 },
  { id: "autoembed", name: "Server 2 (AutoEmbed)", badge: "HD", enabled: true, priority: 2 },
  { id: "superembed", name: "Server 3 (SuperEmbed)", badge: "Multi", enabled: true, priority: 3 },
  { id: "videasy", name: "Server 4 (Videasy)", badge: "Backup", enabled: true, priority: 4 },
  { id: "2embed", name: "Server 5 (2Embed)", badge: "Classic", enabled: true, priority: 5 },
  { id: "vidsrc_rip", name: "Server 6 (VidSrc RIP)", badge: "Alt", enabled: true, priority: 6 },
  { id: "vidsrc_to", name: "Server 7 (VidSrc TO)", badge: "Alt", enabled: true, priority: 7 },
  { id: "smashystream", name: "Server 8 (SmashyStream)", badge: "Alt", enabled: true, priority: 8 },
  { id: "vidy", name: "Server 9 (Vidy)", badge: "Alt", enabled: true, priority: 9 },
  { id: "vidrock", name: "Server 10 (Vidrock)", badge: "Alt", enabled: true, priority: 10 },
  { id: "vidvault", name: "Server 11 (Vidvault)", badge: "Alt", enabled: true, priority: 11 },
  { id: "vixsrc", name: "Server 12 (VixSrc)", badge: "Alt", enabled: true, priority: 12 },
];

let cachedProviders: StreamProvider[] = FALLBACK_PROVIDERS;
let fetchPromise: Promise<StreamProvider[]> | null = null;

// Initialize from local storage cache if available
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem("bujuu_remote_providers");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedProviders = parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
}

/**
 * Loads remote stream providers configuration from Supabase backend.
 * Falls back to local cache or defaults gracefully if network is unavailable.
 */
export async function getRemoteProviders(): Promise<StreamProvider[]> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("app_config")
        .select("value")
        .eq("key", "stream_providers")
        .maybeSingle();

      if (!error && data?.value && Array.isArray((data as any).value)) {
        const remoteList = (data as any).value as StreamProvider[];
        if (remoteList.length > 0) {
          cachedProviders = remoteList.filter((p) => p.enabled !== false);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("bujuu_remote_providers", JSON.stringify(cachedProviders));
            } catch {
              // ignore storage errors
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote app config from backend, using defaults:", err);
    }
    return cachedProviders;
  })();

  return fetchPromise;
}

export function getCachedProviders(): StreamProvider[] {
  return cachedProviders;
}

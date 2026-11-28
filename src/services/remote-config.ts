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
  { id: "bujuu_direct", name: "BUJUU Direct", badge: "Fast", enabled: true, priority: 1 },
  { id: "bujuu_cinema", name: "BUJUU Cinema", badge: "HD", enabled: true, priority: 2 },
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

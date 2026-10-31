import type { MediaType } from "./tmdb";
import { supabase } from "@/integrations/supabase/client";
import { getNativeDeviceId } from "@/hooks/use-device-trial";

export interface EmbedTarget {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
}

export interface StreamResolution {
  authorized: boolean;
  serverIndex: number;
  serverName: string;
  streamUrl: string | null;
  error?: string;
}

export const SERVER_COUNT = 6;

export const SERVERS = [
  { id: "s1", label: "Server 1" },
  { id: "s2", label: "Server 2" },
  { id: "s3", label: "Server 3" },
  { id: "s4", label: "Server 4" },
  { id: "s5", label: "Server 5" },
  { id: "s6", label: "Server 6" },
];

/**
 * Resolves video stream URL strictly from backend RPC.
 * Validates active device trial / subscription on the database before granting access.
 */
export async function resolveBackendStream(
  target: EmbedTarget,
  serverIndex = 0
): Promise<StreamResolution> {
  const deviceId = getNativeDeviceId();

  try {
    const { data, error } = await supabase.rpc("resolve_stream_source", {
      p_device_id: deviceId,
      p_tmdb_id: target.tmdbId,
      p_media_type: target.mediaType,
      p_season: target.season ?? 1,
      p_episode: target.episode ?? 1,
      p_server_index: serverIndex,
    });

    if (error) {
      console.warn("Backend stream resolution error:", error);
      return {
        authorized: false,
        serverIndex,
        serverName: `Server ${serverIndex + 1}`,
        streamUrl: null,
        error: error.message,
      };
    }

    const res = data as any;
    return {
      authorized: Boolean(res?.authorized),
      serverIndex: Number(res?.server_index ?? serverIndex),
      serverName: res?.server_name || `Server ${serverIndex + 1}`,
      streamUrl: res?.stream_url || null,
      error: res?.error,
    };
  } catch (err: any) {
    return {
      authorized: false,
      serverIndex,
      serverName: `Server ${serverIndex + 1}`,
      streamUrl: null,
      error: err?.message || "Stream resolution failed",
    };
  }
}

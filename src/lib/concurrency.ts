import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "bujuu_device_id";
const HEARTBEAT_INTERVAL_MS = 30_000;
const ACTIVE_WINDOW_MS = 60_000;

export type SubscriptionPlan = "solo" | "family";

export function getPersistentDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "ephemeral-device";
  }
}

/**
 * Refresh this device's activity using the existing devices table. The schema
 * has no separate heartbeat table, so last_seen_at is the authoritative signal.
 */
export async function sendDeviceHeartbeat(userId: string, deviceId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("devices")
    .update({ last_seen_at: now })
    .eq("id", deviceId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function countRecentlyActiveDevices(userId: string): Promise<number> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gte("last_seen_at", since);
  if (error) throw error;
  return new Set((data ?? []).map((device) => device.id)).size;
}

export function deviceHeartbeatInterval() {
  return HEARTBEAT_INTERVAL_MS;
}

export function deviceLimitForPlan(plan: SubscriptionPlan): number {
  return plan === "family" ? 4 : 1;
}

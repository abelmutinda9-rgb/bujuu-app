const DEVICE_KEY = "bujuu_device_id";
export type SubscriptionPlan = "solo" | "family";

/** Persistent per-browser/device key used as the Supabase Presence key. */
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
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function deviceLimitForPlan(plan: SubscriptionPlan): number {
  return plan === "family" ? 4 : 1;
}

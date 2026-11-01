import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeviceStatus {
  deviceId: string;
  status: "trial" | "active" | "expired" | "blocked";
  canStream: boolean;
  daysRemaining: number;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  phone?: string;
  recoveryToken?: string;
}

/**
 * Clean up any legacy or insecure entitlement keys from localStorage.
 * Under no circumstances is payment status or entitlement stored in localStorage.
 */
function cleanupLegacyEntitlements() {
  if (typeof window === "undefined") return;
  const insecureKeys = [
    "bujuu_sub_device",
    "bujuu_device_cache",
    "bujuu_device_trial_active",
    "bujuu_is_subscriber",
    "bujuu_subscription_active",
    "payment_status",
    "bujuu_access_token",
    "bujuu_mock_entitlement"
  ];
  for (const k of insecureKeys) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
}

/**
 * Returns a stable device identifier from Android native bridge or persistent local identity.
 * ONLY the identifier is persisted locally so the device can identify itself to the server.
 */
export function getNativeDeviceId(): string {
  if (typeof window !== "undefined" && (window as any).BujuuNative?.getDeviceId) {
    try {
      const id = (window as any).BujuuNative.getDeviceId();
      if (id && typeof id === "string" && id.length > 6) return id.trim();
    } catch {}
  }

  try {
    const stored = localStorage.getItem("bujuu_device_id");
    if (stored && stored.length > 8) return stored;
    const generated = "buj_dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("bujuu_device_id", generated);
    return generated;
  } catch {
    return "buj_dev_anon_" + Date.now().toString(36);
  }
}

export function useDeviceTrial() {
  const qc = useQueryClient();
  const deviceId = typeof window !== "undefined" ? getNativeDeviceId() : "buj_dev_init";

  useEffect(() => {
    cleanupLegacyEntitlements();
  }, []);

  const query = useQuery({
    queryKey: ["bujuu-server-device-handshake", deviceId],
    queryFn: async (): Promise<DeviceStatus> => {
      cleanupLegacyEntitlements();

      try {
        const platform = typeof navigator !== "undefined" 
          ? (navigator.userAgent.includes("Android") ? "Android" : "Web")
          : "Android";

        // Query authoritative Supabase backend RPC
        const { data, error } = await supabase.rpc("device_handshake", {
          p_device_id: deviceId,
          p_platform: platform,
        });

        if (error) {
          console.warn("[BUJUU Server Access] Handshake error:", error.message);
          return {
            deviceId,
            status: "expired",
            canStream: false,
            daysRemaining: 0,
          };
        }

        const res = data as any;
        return {
          deviceId,
          status: (res.status as DeviceStatus["status"]) || "expired",
          canStream: Boolean(res.can_stream),
          daysRemaining: Math.max(0, Number(res.days_remaining) || 0),
          trialEndsAt: res.trial_ends_at || undefined,
          subscriptionExpiresAt: res.subscription_expires_at || undefined,
          phone: res.phone || undefined,
          recoveryToken: res.recovery_token || undefined,
        };
      } catch (err) {
        console.warn("[BUJUU Server Access] Handshake network failure:", err);
        // Fail-closed strictly: never grant stream access on failure
        return {
          deviceId,
          status: "expired",
          canStream: false,
          daysRemaining: 0,
        };
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: (q) => (q.state.data?.canStream ? 5 * 60 * 1000 : 20 * 1000),
  });

  const refresh = useCallback(() => {
    return qc.invalidateQueries({ queryKey: ["bujuu-server-device-handshake"] });
  }, [qc]);

  /**
   * Transfer an existing subscription to this device using a recovery token (e.g. BUJ-XXXXXX)
   */
  const transferSubscription = useCallback(
    async (recoveryCode: string) => {
      if (!recoveryCode?.trim()) {
        throw new Error("Please enter your BUJUU recovery code.");
      }

      const { data, error } = await supabase.rpc("recover_subscription", {
        p_token: recoveryCode.trim().toUpperCase(),
        p_new_device_id: deviceId,
      });

      if (error) {
        throw new Error(error.message || "Failed to transfer subscription.");
      }

      const res = data as any;
      if (!res?.success) {
        throw new Error(res?.error || "Invalid or expired recovery code.");
      }

      await refresh();
      return res;
    },
    [deviceId, refresh],
  );

  return {
    ...query,
    canStream: Boolean(query.data?.canStream),
    status: query.data?.status ?? "expired",
    daysRemaining: query.data?.daysRemaining ?? 0,
    trialEndsAt: query.data?.trialEndsAt,
    subscriptionExpiresAt: query.data?.subscriptionExpiresAt,
    recoveryToken: query.data?.recoveryToken,
    phone: query.data?.phone,
    deviceId,
    refresh,
    transferSubscription,
  };
}

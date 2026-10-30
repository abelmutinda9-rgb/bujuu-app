import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
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
 * Returns a stable hardware identifier from Android native bridge or persistent local storage.
 */
export function getNativeDeviceId(): string {
  if (typeof window !== "undefined" && (window as any).BujuuNative?.getDeviceId) {
    try {
      const id = (window as any).BujuuNative.getDeviceId();
      if (id && id.length > 8) return id;
    } catch {}
  }
  // Persistent fallback for web / preview
  try {
    const stored = localStorage.getItem("bujuu_device_fingerprint");
    if (stored) return stored;
    const generated = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("bujuu_device_fingerprint", generated);
    return generated;
  } catch {
    return "dev_guest_" + Date.now();
  }
}

export function useDeviceTrial() {
  const qc = useQueryClient();
  const deviceId = getNativeDeviceId();

  const query = useQuery({
    queryKey: ["bujuu-device-handshake", deviceId],
    queryFn: async (): Promise<DeviceStatus> => {
      try {
        // Direct call to Supabase backend RPC
        const { data, error } = await supabase.rpc("device_handshake", {
          p_device_id: deviceId,
          p_platform: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Android",
        });

        if (error) {
          console.warn("Supabase handshake error, using local fallback:", error);
          throw error;
        }

        const res = data as any;
        const result: DeviceStatus = {
          deviceId,
          status: res.status || "trial",
          canStream: Boolean(res.can_stream),
          daysRemaining: Number(res.days_remaining) || 0,
          trialEndsAt: res.trial_ends_at,
          subscriptionExpiresAt: res.subscription_expires_at,
          phone: res.phone,
          recoveryToken: res.recovery_token,
        };

        // Persist to local cache for instant offline playback
        try {
          localStorage.setItem("bujuu_device_cache", JSON.stringify(result));
          if (res.can_stream) {
            localStorage.setItem(
              "bujuu_sub_device",
              JSON.stringify({
                isPremium: res.status === "active",
                canStream: true,
                status: res.status,
                expiresAt: res.subscription_expires_at || res.trial_ends_at,
                recoveryToken: res.recovery_token,
              })
            );
          }
        } catch {}

        return result;
      } catch (e) {
        // Safe offline / local fallback
        try {
          const cached = localStorage.getItem("bujuu_device_cache");
          if (cached) {
            return JSON.parse(cached) as DeviceStatus;
          }
        } catch {}

        return {
          deviceId,
          status: "trial",
          canStream: true,
          daysRemaining: 3,
        };
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      // Re-check every 5 minutes if active, or every 30 seconds if pending/expired
      return query.state.data?.canStream ? 5 * 60 * 1000 : 30 * 1000;
    },
  });

  const refresh = useCallback(() => {
    return qc.invalidateQueries({ queryKey: ["bujuu-device-handshake"] });
  }, [qc]);

  /** Confirm payment with Supabase and retrieve recovery token */
  const confirmPayment = useCallback(
    async (reference: string, phone: string, raw?: any) => {
      const { data, error } = await supabase.rpc("confirm_payment_success", {
        p_device_id: deviceId,
        p_reference: reference,
        p_phone: phone,
        p_raw: raw || {},
      });

      if (error) throw error;
      await refresh();
      return data;
    },
    [deviceId, refresh]
  );

  /** Transfer an existing subscription to this device using a recovery code */
  const transferSubscription = useCallback(
    async (recoveryToken: string) => {
      const { data, error } = await supabase.rpc("recover_subscription", {
        p_token: recoveryToken,
        p_new_device_id: deviceId,
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        throw new Error(res.error || "Failed to transfer subscription");
      }
      await refresh();
      return res;
    },
    [deviceId, refresh]
  );

  return {
    ...query,
    canStream: Boolean(query.data?.canStream),
    status: query.data?.status ?? "trial",
    daysRemaining: query.data?.daysRemaining ?? 3,
    trialEndsAt: query.data?.trialEndsAt,
    subscriptionExpiresAt: query.data?.subscriptionExpiresAt,
    recoveryToken: query.data?.recoveryToken,
    phone: query.data?.phone,
    deviceId,
    refresh,
    confirmPayment,
    transferSubscription,
  };
}

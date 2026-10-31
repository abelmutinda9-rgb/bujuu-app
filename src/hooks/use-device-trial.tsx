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
        // Direct call to authoritative Supabase backend RPC
        const { data, error } = await supabase.rpc("device_handshake", {
          p_device_id: deviceId,
          p_platform: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Android",
        });

        if (error) {
          console.warn("Supabase handshake error:", error);
          throw error;
        }

        const res = data as any;
        const result: DeviceStatus = {
          deviceId,
          status: res.status || "expired",
          canStream: Boolean(res.can_stream),
          daysRemaining: Number(res.days_remaining) || 0,
          trialEndsAt: res.trial_ends_at,
          subscriptionExpiresAt: res.subscription_expires_at,
          phone: res.phone,
          recoveryToken: res.recovery_token,
        };

        // Cache server-validated status
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
          } else {
            localStorage.removeItem("bujuu_sub_device");
          }
        } catch {}

        return result;
      } catch (e) {
        // Strict server check: Do NOT auto-grant 3 days on failure.
        // Read unexpired cached verification if available; otherwise block streaming until reconnected.
        try {
          const cached = localStorage.getItem("bujuu_device_cache");
          if (cached) {
            const parsed = JSON.parse(cached) as DeviceStatus;
            const expiry = parsed.subscriptionExpiresAt || parsed.trialEndsAt;
            if (expiry && new Date(expiry).getTime() > Date.now()) {
              return parsed;
            }
          }
        } catch {}

        return {
          deviceId,
          status: "expired",
          canStream: false,
          daysRemaining: 0,
        };
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
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

  /** Link/Transfer account directly using Google authenticated session */
  const transferViaGoogleAccount = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase.rpc("transfer_subscription_to_device", {
        p_user_id: userId,
        p_device_id: deviceId,
      });

      if (error) {
        console.warn("Google account subscription sync error:", error);
        return { success: false, error: error.message };
      }
      await refresh();
      return data;
    },
    [deviceId, refresh]
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
    confirmPayment,
    transferSubscription,
    transferViaGoogleAccount,
  };
}

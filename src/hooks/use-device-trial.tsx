import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getAccess, registerDevice } from "@/lib/bujuu.functions";

export interface DeviceStatus {
  deviceId: string;
  status: "trial" | "active" | "expired" | "transferred_out";
  canStream: boolean;
  daysRemaining: number;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  phone?: string;
}

export function getNativeDeviceId(): string {
  if (typeof window !== "undefined" && (window as any).BujuuNative?.getDeviceId) {
    try {
      const id = (window as any).BujuuNative.getDeviceId();
      if (id && id.length > 8) return id;
    } catch {}
  }
  // Persistent local fallback
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
    queryKey: ["bujuu-device-trial", deviceId],
    queryFn: async (): Promise<DeviceStatus> => {
      try {
        const res = await registerDevice({
          data: {
            deviceId,
            deviceSecret: "sec_" + deviceId.slice(0, 16),
            platform: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Android",
          },
        });

        // Calculate 3-day trial from registration or server response
        const now = Date.now();
        const storedTrial = localStorage.getItem("bujuu_trial_start_" + deviceId);
        let trialStart = storedTrial ? parseInt(storedTrial, 10) : now;
        if (!storedTrial) {
          try { localStorage.setItem("bujuu_trial_start_" + deviceId, String(now)); } catch {}
        }

        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        const trialRemainingMs = Math.max(0, (trialStart + THREE_DAYS) - now);
        const trialDaysLeft = Math.ceil(trialRemainingMs / (24 * 60 * 60 * 1000));
        const isTrialActive = trialRemainingMs > 0;

        // Check if paid subscription exists
        const isPaid = (res as any)?.active === true;
        const canStream = isPaid || isTrialActive;

        return {
          deviceId,
          status: isPaid ? "active" : isTrialActive ? "trial" : "expired",
          canStream,
          daysRemaining: isPaid ? ((res as any)?.daysRemaining ?? 30) : trialDaysLeft,
          trialEndsAt: new Date(trialStart + THREE_DAYS).toISOString(),
          subscriptionExpiresAt: (res as any)?.expiresAt,
        };
      } catch (e) {
        // Safe offline trial fallback
        const now = Date.now();
        const storedTrial = localStorage.getItem("bujuu_trial_start_" + deviceId);
        let trialStart = storedTrial ? parseInt(storedTrial, 10) : now;
        if (!storedTrial) {
          try { localStorage.setItem("bujuu_trial_start_" + deviceId, String(now)); } catch {}
        }
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        const trialRemainingMs = Math.max(0, (trialStart + THREE_DAYS) - now);
        const isTrialActive = trialRemainingMs > 0;
        return {
          deviceId,
          status: isTrialActive ? "trial" : "expired",
          canStream: isTrialActive,
          daysRemaining: Math.ceil(trialRemainingMs / (24 * 60 * 60 * 1000)),
        };
      }
    },
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    canStream: Boolean(query.data?.canStream),
    status: query.data?.status ?? "trial",
    daysRemaining: query.data?.daysRemaining ?? 3,
    deviceId,
    refresh: () => qc.invalidateQueries({ queryKey: ["bujuu-device-trial"] }),
  };
}

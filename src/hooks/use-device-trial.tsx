import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDeviceStatus, registerDevice, claimSubscription } from "@/lib/bujuu.functions";
import { useCallback } from "react";

export interface DeviceStatus {
  deviceId: string;
  deviceSecret: string;
  status: "trial" | "active" | "expired" | "blocked";
  canStream: boolean;
  daysRemaining: number;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  phone?: string;
  recoveryToken?: string;
}

/** Device credentials are provisioned by the backend and stored locally for this install. */
function loadDeviceCredentials(): { deviceId: string; deviceSecret: string } | null {
  try {
    const raw = localStorage.getItem("bujuu_device_credentials");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.deviceId === "string" && typeof parsed.deviceSecret === "string")
      return parsed;
  } catch {}
  return null;
}

export function useDeviceTrial() {
  const qc = useQueryClient();
  const credentials = typeof window !== "undefined" ? loadDeviceCredentials() : null;
  const deviceId = credentials?.deviceId ?? "";

  const query = useQuery({
    queryKey: ["bujuu-device-handshake"],
    queryFn: async (): Promise<DeviceStatus> => {
      let current = typeof window !== "undefined" ? loadDeviceCredentials() : null;
      if (!current) {
        const created = await registerDevice({
          data: {
            label:
              typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "BUJUU device",
          },
        });
        current = { deviceId: created.deviceId, deviceSecret: created.deviceSecret };
        try {
          localStorage.setItem("bujuu_device_credentials", JSON.stringify(current));
        } catch {}
      }
      const res = await getDeviceStatus({ data: current });
      return {
        deviceId: current.deviceId,
        deviceSecret: current.deviceSecret,
        status: res.status,
        canStream: Boolean(res.can_stream),
        daysRemaining: Number(res.days_remaining) || 0,
        ...(res.trial_ends_at ? { trialEndsAt: res.trial_ends_at } : {}),
        ...(res.subscription_expires_at
          ? { subscriptionExpiresAt: res.subscription_expires_at }
          : {}),
        ...(res.phone ? { phone: res.phone } : {}),
      };
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

  /** Transfer an existing subscription to this device using a recovery code */
  const transferSubscription = useCallback(
    async (phone: string) => {
      const current = typeof window !== "undefined" ? loadDeviceCredentials() : null;
      if (!current) throw new Error("This device is not registered yet.");
      const res = await claimSubscription({ data: { ...current, phone } });
      await refresh();
      return res;
    },
    [refresh],
  );

  return {
    ...query,
    canStream: Boolean(query.data?.canStream),
    status: query.data?.status ?? "blocked",
    daysRemaining: query.data?.daysRemaining ?? 0,
    trialEndsAt: query.data?.trialEndsAt,
    subscriptionExpiresAt: query.data?.subscriptionExpiresAt,
    recoveryToken: query.data?.recoveryToken,
    phone: query.data?.phone,
    deviceId,
    deviceSecret: query.data?.deviceSecret ?? credentials?.deviceSecret ?? "",
    refresh,
    transferSubscription,
  };
}

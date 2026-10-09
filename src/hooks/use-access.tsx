import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { getAccess, registerDevice } from "@/lib/bujuu.functions";

const KEY = "bujuu.device";
const PHONE_KEY = "subscribed_phone";

export interface DeviceCreds {
  deviceId: string;
  deviceSecret: string;
}

function readCreds(): DeviceCreds | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceCreds;
    return parsed.deviceId && parsed.deviceSecret ? parsed : null;
  } catch {
    return null;
  }
}

/** The number this device last claimed, remembered for quick re-claiming. */
export function savedPhone(): string {
  try {
    return localStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberPhone(phone: string) {
  try {
    localStorage.setItem(PHONE_KEY, phone);
  } catch {
    /* private browsing */
  }
}

/** Device identity for this browser/TV, created on first use. */
export function useDevice() {
  const [creds, setCreds] = useState<DeviceCreds | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const existing = readCreds();
    if (existing) {
      setCreds(existing);
      setReady(true);
      return;
    }
    void registerDevice({ data: { label: navigator.userAgent.slice(0, 80) } })
      .then((next) => {
        if (cancelled) return;
        localStorage.setItem(KEY, JSON.stringify(next));
        setCreds(next);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { creds, ready };
}

/**
 * Subscription state for this device, re-checked every 30 seconds so a device
 * that has been taken over elsewhere locks itself promptly.
 */
export function useAccess() {
  const { creds, ready } = useDevice();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["access", creds?.deviceId],
    enabled: Boolean(creds),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () => getAccess({ data: creds! }),
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["access"] });
  }, [queryClient]);

  return {
    creds,
    deviceReady: ready,
    access: query.data ?? null,
    premium: query.data?.active === true,
    lockedOut: query.data?.reason === "device_revoked",
    loading: !ready || query.isPending,
    refresh,
  };
}

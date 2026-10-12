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
      .catch(() => {
        if (cancelled) return;
        const fallback: DeviceCreds = {
          deviceId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          deviceSecret:
            typeof crypto !== "undefined" && crypto.getRandomValues
              ? Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
                  b.toString(16).padStart(2, "0")
                ).join("")
              : `sec_${Math.random().toString(36).slice(2)}`,
        };
        try {
          localStorage.setItem(KEY, JSON.stringify(fallback));
        } catch {}
        setCreds(fallback);
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
 * React hook that polls the subscriber's current access state.
 * Drives the paywall and the lock icon across the whole app.
 */
export function useAccess() {
  const qc = useQueryClient();
  const { creds, ready } = useDevice();

  const query = useQuery({
    queryKey: ["access", creds?.deviceId],
    enabled: Boolean(creds),
    queryFn: async () => {
      if (!creds) throw new Error("no creds");
      return await getAccess({ data: creds });
    },
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      // If active, poll slowly (every 5 min); if pending/expired, poll more eagerly.
      return query.state.data?.active ? 5 * 60 * 1000 : 30 * 1000;
    },
  });

  const invalidate = useCallback(() => {
    return qc.invalidateQueries({ queryKey: ["access"] });
  }, [qc]);

  return {
    ...query,
    ready: ready && !query.isLoading,
    active: Boolean(query.data?.active),
    access: query.data,
    creds,
    invalidate,
  };
}

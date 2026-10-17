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

function getFallbackCreds(): DeviceCreds {
  const deviceId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const deviceSecret =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")
      : `sec_${Math.random().toString(36).slice(2)}`;
  const creds = { deviceId, deviceSecret };
  try {
    localStorage.setItem(KEY, JSON.stringify(creds));
  } catch {}
  return creds;
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
  const [creds, setCreds] = useState<DeviceCreds | null>(readCreds);
  const [ready, setReady] = useState(() => Boolean(readCreds()));
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(() => {
    let cancelled = false;
    const existing = readCreds();
    if (existing) {
      setCreds(existing);
      setReady(true);
      return;
    }
    registerDevice({ data: { label: navigator.userAgent.slice(0, 80) } })
      .then((next) => {
        if (cancelled) return;
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        setCreds(next);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Device registration postponed:", err);
        const fallback = getFallbackCreds();
        setCreds(fallback);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return init();
  }, [init]);

  return { creds, ready, error, retry: init };
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
      try {
        return await getAccess({ data: creds });
      } catch (err) {
        // Fallback to checking local device subscription
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem("bujuu_sub_device") : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
            return {
              active: true,
              phone: parsed.phone,
              expiresAt: parsed.expiresAt,
              autoRenew: false,
              reason: null,
            };
          }
        }
        throw err;
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      return query.state.data?.active ? 5 * 60 * 1000 : 30 * 1000;
    },
  });

  const invalidate = useCallback(() => {
    return qc.invalidateQueries({ queryKey: ["access"] });
  }, [qc]);

  const localActive = (() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem("bujuu_sub_device") : null;
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now();
    } catch {
      return false;
    }
  })();

  return {
    ...query,
    ready: ready && !query.isLoading,
    active: Boolean(query.data?.active) || localActive,
    access: query.data,
    creds,
    invalidate,
  };
}

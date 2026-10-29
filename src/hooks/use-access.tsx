import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { getAccess, registerDevice } from "@/lib/bujuu.functions";

const KEY = "bujuu.device";
const PHONE_KEY = "subscribed_phone";

export interface DeviceCreds {
  deviceId: string;
  deviceSecret: string;
}


function getNativeDeviceId(): string | null {
  if (typeof window !== "undefined" && (window as any).BujuuNative?.getDeviceId) {
    try {
      const id = (window as any).BujuuNative.getDeviceId();
      if (id && id.length > 10) return id;
    } catch {}
  }
  return null;
}

function readCreds(): DeviceCreds | null {
  const nativeId = getNativeDeviceId();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceCreds;
      if (parsed.deviceId && parsed.deviceSecret) {
        if (nativeId && parsed.deviceId !== nativeId) {
          parsed.deviceId = nativeId;
          try { localStorage.setItem(KEY, JSON.stringify(parsed)); } catch {}
        }
        return parsed;
      }
    }
  } catch {}
  return null;
}

function getFallbackCreds(): DeviceCreds {
  const nativeId = getNativeDeviceId();
  const deviceId =
    nativeId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`);
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


export function useDevice() {
  const [creds, setCreds] = useState<DeviceCreds | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = readCreds();
    if (!active) {
      active = getFallbackCreds();
    }
    setCreds(active);
    setReady(true);
  }, []);

  return { creds, ready };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { useDevice } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { applyReferral, myStatus, syncAccount } from "@/lib/account.functions";

const REF_KEY = "bujuu.ref";

export function rememberReferral(code: string) {
  try {
    localStorage.setItem(REF_KEY, code);
  } catch {
    /* ignore */
  }
}

/** Signed-in session, kept in sync with auth changes. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    void supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

/**
 * Account + subscription + device state. Everything is decided on the server;
 * this only shows it. Re-checked every 30 seconds so a replaced device locks.
 */
export function useAccount() {
  const { session, ready: sessionReady } = useSession();
  const { creds, ready: deviceReady } = useDevice();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const sync = useQuery({
    queryKey: ["account-sync", userId, creds?.deviceId],
    enabled: Boolean(userId && creds),
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const platform = navigator.userAgent.slice(0, 120);
      const state = await syncAccount({ data: { ...creds!, platform } });
      try {
        const code = localStorage.getItem(REF_KEY);
        if (code) {
          await applyReferral({ data: { code } }).catch(() => undefined);
          localStorage.removeItem(REF_KEY);
        }
      } catch {
        /* ignore */
      }
      return state;
    },
  });

  const status = useQuery({
    queryKey: ["account-status", userId, creds?.deviceId],
    enabled: Boolean(userId && creds && sync.isSuccess),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () => myStatus({ data: { ...creds! } }),
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-status"] });
  }, [queryClient]);

  const state = status.data ?? sync.data ?? null;
  const hasSub = state ? state.status === "ACTIVE" || state.status === "DEVICE_NOT_AUTHORIZED" : false;

  return {
    session,
    signedIn: Boolean(session),
    email: session?.user.email ?? null,
    creds,
    state,
    isPremium: state?.isPremium === true,
    needsTransfer: Boolean(state && !state.deviceAuthorized && hasSub),
    loading: !sessionReady || !deviceReady || (Boolean(session) && !state && !sync.isError),
    error: sync.error ?? null,
    refresh,
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { useDevice } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { applyReferral, myStatus, syncAccount } from "@/lib/account.functions";
import type { AccountState } from "@/lib/account.server";

const REF_KEY = "bujuu.ref";

export function rememberReferral(code: string) {
  try {
    const clean = code.trim().toUpperCase();
    if (/^[A-Za-z0-9]{3,16}$/.test(clean)) {
      localStorage.setItem(REF_KEY, clean);
    }
  } catch {
    /* ignore */
  }
}

export function getPendingReferral(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}

/** Signed-in session, kept in sync with auth changes. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // Ensure user profile row exists in Supabase
        const displayName =
          s.user.user_metadata?.full_name ||
          s.user.user_metadata?.name ||
          s.user.email?.split("@")[0] ||
          null;
        void supabase.from("profiles").upsert(
          {
            id: s.user.id,
            email: s.user.email,
            display_name: displayName,
            provider: "google",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }
    });
    void supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

/**
 * Direct authoritative Supabase query for subscriber and subscription status.
 * Never trusts or checks client-editable localStorage.
 */
async function fetchClientAccountState(userId: string): Promise<AccountState> {
  try {
    const { data: subscriber, error: subError } = await supabase
      .from("subscribers")
      .select("id, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (subError || !subscriber) {
      return {
        status: "NO_SUBSCRIPTION",
        isPremium: false,
        phone: null,
        expiresAt: null,
        autoRenew: false,
        deviceAuthorized: false,
        subscriberId: null,
      };
    }

    const { data: sub, error: subsError } = await supabase
      .from("subscriptions")
      .select("expires_at, status, auto_renew")
      .eq("subscriber_id", subscriber.id)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subsError || !sub) {
      return {
        status: "NO_SUBSCRIPTION",
        isPremium: false,
        phone: subscriber.phone,
        expiresAt: null,
        autoRenew: false,
        deviceAuthorized: false,
        subscriberId: subscriber.id,
      };
    }

    const live = sub.status === "active" && new Date(sub.expires_at).getTime() > Date.now();
    return {
      status: live ? "ACTIVE" : "EXPIRED",
      isPremium: live,
      phone: subscriber.phone,
      expiresAt: sub.expires_at,
      autoRenew: sub.auto_renew === true,
      deviceAuthorized: live,
      subscriberId: subscriber.id,
    };
  } catch (err) {
    console.warn("Client Supabase accountState query error:", err);
    return {
      status: "NO_SUBSCRIPTION",
      isPremium: false,
      phone: null,
      expiresAt: null,
      autoRenew: false,
      deviceAuthorized: false,
      subscriberId: null,
    };
  }
}

/**
 * Account + subscription + device state. Works seamlessly across server functions
 * and direct authoritative Supabase queries without insecure local fallbacks.
 */
export function useAccount() {
  const { session, ready: sessionReady } = useSession();
  const { creds, ready: deviceReady } = useDevice();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;

  const sync = useQuery({
    queryKey: ["account-sync", userId, creds?.deviceId],
    enabled: Boolean(userId && creds),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const platform = navigator.userAgent.slice(0, 120);
      try {
        const state = await syncAccount({ data: { ...creds!, platform } });
        const code = getPendingReferral();
        if (code) {
          try {
            const res = await applyReferral({ data: { code } });
            if (res.ok) {
              clearPendingReferral();
            }
          } catch {
            /* ignore network hiccups */
          }
        }
        return state;
      } catch (err) {
        console.warn("syncAccount remote function failed; using authoritative Supabase queries:", err);
        return await fetchClientAccountState(userId!);
      }
    },
  });

  const status = useQuery({
    queryKey: ["account-status", userId, creds?.deviceId],
    enabled: Boolean(userId && creds && (sync.isSuccess || sync.data != null)),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        return await myStatus({ data: { ...creds! } });
      } catch {
        return await fetchClientAccountState(userId!);
      }
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-sync"] });
    void queryClient.invalidateQueries({ queryKey: ["account-status"] });
  }, [queryClient]);

  const state = status.data ?? sync.data ?? null;
  const isPremium = state?.isPremium === true && state?.status === "ACTIVE";
  const hasSub = state ? state.status === "ACTIVE" || state.status === "DEVICE_NOT_AUTHORIZED" : false;

  const loading = !sessionReady || !deviceReady || (Boolean(session) && !state && !sync.isError && sync.isLoading);

  return {
    session,
    signedIn: Boolean(session),
    email: session?.user.email ?? null,
    creds,
    state,
    isPremium,
    needsTransfer: Boolean(state && !state.deviceAuthorized && hasSub),
    loading,
    error: sync.error ?? null,
    refresh,
  };
}

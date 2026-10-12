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

/** Direct Supabase client query for subscriber and subscription status */
async function fetchClientAccountState(userId: string): Promise<AccountState> {
  // Check local verified subscription first
  try {
    const localRaw = localStorage.getItem(`bujuu_sub_${userId}`);
    if (localRaw) {
      const local = JSON.parse(localRaw);
      if (local && local.expiresAt && new Date(local.expiresAt).getTime() > Date.now()) {
        return {
          status: "ACTIVE",
          isPremium: true,
          phone: local.phone || null,
          expiresAt: local.expiresAt,
          autoRenew: false,
          deviceAuthorized: true,
          subscriberId: local.subscriberId || "local",
        };
      }
    }
  } catch {}

  try {
    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("id, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (!subscriber) {
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

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("expires_at, status, auto_renew")
      .eq("subscriber_id", subscriber.id)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
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
    console.warn("Client fallback accountState failed:", err);
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
 * Account + subscription + device state. Works seamlessly even when remote
 * server functions are offline or during static client-side APK execution.
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
      } catch (err) {
        console.warn("syncAccount remote function failed; using direct Supabase fallback:", err);
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

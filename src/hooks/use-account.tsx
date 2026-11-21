import type { Session } from "@supabase/supabase-js";
import { useDevice } from "@/hooks/use-access";
import type { AccountState } from "@/lib/account.server";

export function rememberReferral(_code: string) {}
export function getPendingReferral(): string | null { return null; }
export function clearPendingReferral() {}

export function useSession() {
  return { session: null as Session | null, ready: true };
}

export function useAccount() {
  const { creds } = useDevice();
  const freeState: AccountState = {
    status: "ACTIVE" as const,
    isPremium: true,
    phone: null,
    expiresAt: null,
    autoRenew: false,
    deviceAuthorized: true,
    subscriberId: "free",
  };

  return {
    session: null as Session | null,
    signedIn: true,
    email: null as string | null,
    creds,
    state: freeState,
    isPremium: true,
    needsTransfer: false,
    loading: false,
    error: null,
    refresh: () => {},
  };
}

import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const AFTER_KEY = "bujuu.after";

/** Only same-site paths are allowed as a return target. */
export function safePath(p?: string | null) {
  return p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/auth") ? p : "/";
}

/** Full sign-out: end session, clear cached data, verify nothing remains. */
export async function signOutSession(queryClient: QueryClient, go: () => void) {
  await queryClient.cancelQueries();
  await supabase.auth.signOut().catch(() => undefined);
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  queryClient.clear();
  try {
    sessionStorage.removeItem(AFTER_KEY);
  } catch {
    /* ignore */
  }
  toast.success("Signed out.");
  go();
}

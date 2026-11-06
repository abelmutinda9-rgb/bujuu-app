import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlan = "solo" | "family";

export interface ActivePlan {
  plan: SubscriptionPlan;
  active: boolean;
}

/** Read the latest, unexpired plan associated with this signed-in account. */
export async function fetchActivePlan(userId: string): Promise<ActivePlan> {
  // The backend schema includes `plan`; this client type may lag its migration.
  const db = supabase as any;
  const { data: subscriber, error: subscriberError } = await db
    .from("subscribers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (subscriberError) throw subscriberError;
  if (!subscriber) return { plan: "solo", active: false };

  const { data, error } = await db
    .from("subscriptions")
    .select("plan, status, expires_at")
    .eq("subscriber_id", subscriber.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  return {
    plan: data?.plan === "family" ? "family" : "solo",
    active: Boolean(data && (data.plan === "solo" || data.plan === "family")),
  };
}

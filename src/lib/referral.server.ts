/** Server-only referral logic. Rewards are created only after a verified payment. */
import { admin, audit, randomToken } from "@/lib/bujuu.server";

export const REFERRAL_REWARD = 30; // KSh per paying friend, paid out manually

export async function ensureReferralCode(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (data?.code) return data.code;
  for (let i = 0; i < 5; i++) {
    const code = randomToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || `B${i}`;
    const { error } = await db.from("referral_codes").insert({ user_id: userId, code });
    if (!error) return code;
    const again = await db.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
    if (again.data?.code) return again.data.code;
  }
  throw new Error("Could not create your invite link.");
}

/** Records who invited this account. Only once, never self, only before first payment. */
export async function attachReferral(userId: string, code: string) {
  const db = await admin();
  const { data: owner } = await db
    .from("referral_codes")
    .select("user_id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!owner || owner.user_id === userId) return false;
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "success");
  if ((count ?? 0) > 0) return false;
  const { error } = await db
    .from("referrals")
    .insert({ referrer_id: owner.user_id, referred_id: userId });
  if (!error) await audit("referral_attached", { referrer: owner.user_id });
  return !error;
}

/** Called after a payment is verified. Idempotent via unique constraints. */
export async function qualifyReferral(userId: string | null, paymentId: string) {
  if (!userId) return;
  const db = await admin();
  const { data: ref } = await db
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_id", userId)
    .maybeSingle();
  if (!ref || ref.status !== "pending") return;
  const { data: updated } = await db
    .from("referrals")
    .update({ status: "qualified", payment_id: paymentId })
    .eq("id", ref.id)
    .eq("status", "pending")
    .select("id");
  if (!updated?.length) return;
  await db
    .from("referral_ledger")
    .insert({ user_id: ref.referrer_id, referral_id: ref.id, amount: REFERRAL_REWARD, kind: "reward" });
  await audit("referral_qualified", { referralId: ref.id });
}

export async function referralSummary(userId: string) {
  const db = await admin();
  const code = await ensureReferralCode(userId);
  const { data: refs } = await db.from("referrals").select("status").eq("referrer_id", userId);
  const { data: ledger } = await db
    .from("referral_ledger")
    .select("amount, kind, payout_status")
    .eq("user_id", userId);
  const earned = (ledger ?? []).reduce((s, l) => s + (l.kind === "reward" ? l.amount : -l.amount), 0);
  return {
    code,
    invited: refs?.length ?? 0,
    paying: (refs ?? []).filter((r) => r.status === "qualified").length,
    earned,
    reward: REFERRAL_REWARD,
  };
}

/** Server-only referral withdrawal logic. Full-balance withdrawals only. */
import { admin, audit, normalizePhone, randomToken } from "@/lib/bujuu.server";

export const MIN_WITHDRAWAL = 100;

export function maskPhone(n: string): string {
  const local = n.startsWith("254") ? `0${n.slice(3)}` : n;
  return `${local.slice(0, 2)}••••••${local.slice(-2)}`;
}

const SAFE_FAILURE: Record<string, string> = {
  provider_not_configured: "Payouts are not available yet.",
};

export async function withdrawalSummary(userId: string) {
  const db = await admin();
  const [{ data: bal }, { data: rows }] = await Promise.all([
    db.rpc("referral_available_balance", { _user_id: userId }),
    db
      .from("referral_withdrawals")
      .select("id, amount, phone, status, created_at, processed_at, failure_reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const history = (rows ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    phone: maskPhone(r.phone),
    status: r.status as "pending" | "processing" | "paid" | "failed",
    createdAt: r.created_at,
    processedAt: r.processed_at,
    failure: r.status === "failed" ? (SAFE_FAILURE[r.failure_reason ?? ""] ?? "The payout could not be completed.") : null,
  }));
  return {
    available: Math.max(0, Number(bal ?? 0)),
    minimum: MIN_WITHDRAWAL,
    inProgress: history.some((h) => h.status === "pending" || h.status === "processing"),
    history,
  };
}

export async function requestWithdrawal(userId: string, rawPhone: string, requestKey: string) {
  const phone = normalizePhone(rawPhone);
  const db = await admin();
  const { data, error } = await db.rpc("reserve_referral_withdrawal", {
    _user_id: userId,
    _phone: phone,
    _request_key: `${userId}:${requestKey}`,
    _min: MIN_WITHDRAWAL,
  });
  if (error) {
    if (error.message.includes("below_minimum")) throw new Error(`Minimum withdrawal is KSh ${MIN_WITHDRAWAL}.`);
    if (error.message.includes("withdrawal_in_progress") || error.code === "23505")
      throw new Error("You already have a withdrawal in progress.");
    console.error("reserve withdrawal failed", error);
    throw new Error("Could not request the withdrawal. Please try again.");
  }
  const row = data as unknown as { id: string; amount: number };
  await audit("withdrawal_requested", { withdrawalId: row.id, amount: row.amount });
  const { dispatchWithdrawal } = await import("@/lib/payout.server");
  await dispatchWithdrawal(row.id).catch((e) => console.error("dispatch failed", e));
  return { id: row.id, amount: row.amount };
}

export { randomToken };

/**
 * Server-only M-Pesa payout provider boundary for referral withdrawals.
 *
 * No payout provider is connected yet. The existing PayHero setup is STK Push
 * collection only; its /api/v2/payments endpoint must never be used for payouts.
 * When PayHero Disbursements (or Daraja B2C) is enabled, implement `sendPayout`
 * against the provider's official API and set the env vars checked below.
 * Until then withdrawals stay "pending" — nothing is ever marked paid here
 * without a provider confirmation.
 */
import { admin, audit } from "@/lib/bujuu.server";

export function payoutConfigured(): boolean {
  return Boolean(
    process.env["PAYHERO_PAYOUT_API_USERNAME"] &&
      process.env["PAYHERO_PAYOUT_API_PASSWORD"] &&
      process.env["PAYHERO_PAYOUT_CHANNEL_ID"],
  );
}

export type PayoutSubmitResult =
  | { accepted: true; providerReference: string }
  | { accepted: false; reason: string };

/** Submits a payout to the provider. Not implemented until a provider is enabled. */
export async function sendPayout(_args: {
  withdrawalId: string;
  phone: string;
  amount: number;
}): Promise<PayoutSubmitResult> {
  return { accepted: false, reason: "provider_not_configured" };
}

/** Tries to hand a pending withdrawal to the provider. Leaves it pending when no provider exists. */
export async function dispatchWithdrawal(withdrawalId: string) {
  if (!payoutConfigured()) return;
  const db = await admin();
  const { data: claimed } = await db
    .from("referral_withdrawals")
    .update({ status: "processing", provider: "payhero" })
    .eq("id", withdrawalId)
    .eq("status", "pending")
    .select("id, phone, amount")
    .maybeSingle();
  if (!claimed) return;
  const result = await sendPayout({ withdrawalId, phone: claimed.phone, amount: claimed.amount });
  if (result.accepted) {
    await db
      .from("referral_withdrawals")
      .update({ provider_reference: result.providerReference })
      .eq("id", withdrawalId);
  } else {
    await settleWithdrawal(withdrawalId, { ok: false, reason: result.reason });
  }
}

/**
 * Final state, called only from verified provider results (e.g. a signed callback
 * re-checked against the provider). Failed withdrawals stop counting against the
 * balance, so the full amount becomes available again automatically.
 */
export async function settleWithdrawal(
  withdrawalId: string,
  outcome: { ok: true; providerReference: string } | { ok: false; reason: string },
) {
  const db = await admin();
  const patch = outcome.ok
    ? { status: "paid", provider_reference: outcome.providerReference, processed_at: new Date().toISOString() }
    : { status: "failed", failure_reason: outcome.reason.slice(0, 200), processed_at: new Date().toISOString() };
  const { data } = await db
    .from("referral_withdrawals")
    .update(patch)
    .eq("id", withdrawalId)
    .in("status", ["pending", "processing"])
    .select("id");
  if (data?.length) await audit(outcome.ok ? "withdrawal_paid" : "withdrawal_failed", { withdrawalId });
}

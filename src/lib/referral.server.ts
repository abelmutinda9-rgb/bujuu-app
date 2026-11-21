/** Referral server stub - referrals disabled */
export const REFERRAL_REWARD = 0;

export async function ensureReferralCode(_userId: string): Promise<string> {
  return "";
}

export async function attachReferral(_userId: string, _code: string): Promise<boolean> {
  return false;
}

export async function qualifyReferral(_userId: string | null, _paymentId: string) {}

export async function referralSummary(_userId: string) {
  return {
    code: "",
    qualified: 0,
    pending: 0,
    availableBalance: 0,
    totalEarned: 0,
  };
}

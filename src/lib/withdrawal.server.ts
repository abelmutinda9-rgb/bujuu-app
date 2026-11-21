/** Withdrawal server stub - withdrawals disabled */
export const MIN_WITHDRAWAL = 0;
export function maskPhone(n: string): string { return n; }

export async function withdrawalSummary(_userId: string) {
  return { availableBalance: 0, recent: [] };
}

export async function requestWithdrawal(_userId: string, _rawPhone: string, _requestKey: string) {
  return { ok: false, reason: "Withdrawals disabled" };
}

export function randomToken(_len = 16) { return ""; }

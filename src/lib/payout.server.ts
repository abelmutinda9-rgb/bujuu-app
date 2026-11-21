/** Payout server stub - payouts disabled */
export function payoutConfigured(): boolean {
  return false;
}

export async function sendPayout(_args: any) {
  return { ok: false, error: "Payouts disabled" };
}

export async function dispatchWithdrawal(_withdrawalId: string) {}
export async function settleWithdrawal(_id: string, _ok: boolean, _ref?: string, _fail?: string) {}

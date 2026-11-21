/**
 * Referral configuration stub - referrals disabled.
 */
export const DOWNLOAD_SITE_URL: string = "https://buuju.lovable.app";

export function buildReferralUrl(_code: string): string {
  return DOWNLOAD_SITE_URL;
}

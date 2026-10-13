/**
 * Central configuration for BUJUU APK download website and referral destination.
 * 
 * Default is configured to the confirmed download site (or VITE_DOWNLOAD_SITE_URL / DOWNLOAD_SITE_URL env var).
 * When the final custom Vercel domain is provided, update this single value or set VITE_DOWNLOAD_SITE_URL.
 */
export const DOWNLOAD_SITE_URL: string =
  (typeof process !== "undefined" && (process.env?.DOWNLOAD_SITE_URL || process.env?.VITE_DOWNLOAD_SITE_URL)) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_DOWNLOAD_SITE_URL) ||
  "https://buuju.lovable.app";

/**
 * Builds a referral link pointing to the APK download website while preserving the referral code.
 * Example: https://buuju.lovable.app/r/50CA37C0
 */
export function buildReferralUrl(code: string): string {
  const base = DOWNLOAD_SITE_URL.replace(/\/+$/, "");
  return `${base}/r/${encodeURIComponent(code.trim().toUpperCase())}`;
}

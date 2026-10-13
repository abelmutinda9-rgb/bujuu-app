/**
 * PayHero Kenya phone formatting and display helpers.
 * Payment execution and verification is strictly handled server-side in
 * src/lib/bujuu.server.ts and src/lib/bujuu.functions.ts.
 */

export const PLAN_AMOUNT = 150;

/**
 * Normalizes phone number to Kenyan national format 07XXXXXXXX or 01XXXXXXXX
 * (PayHero requires 10-digit national format; 254... results in HTTP 400).
 */
export function normalizeKenyanPhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("2540")) n = `0${n.slice(4)}`;
  else if (n.startsWith("254")) n = `0${n.slice(3)}`;
  else if (n.startsWith("7") || n.startsWith("1")) n = `0${n}`;
  else if (!n.startsWith("0")) n = `0${n}`;

  if (!/^0(7|1)\d{8}$/.test(n)) {
    throw new Error("Enter a valid Safaricom or Airtel number (e.g. 0712345678 or 0112345678)");
  }
  return n;
}

export function formatPhoneDisplay(phone: string): string {
  try {
    const clean = normalizeKenyanPhone(phone);
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  } catch {
    return phone;
  }
}

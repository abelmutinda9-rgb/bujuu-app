/**
 * PayHero Kenya M-Pesa integration for BUJUU.
 * Provides direct STK push requests and authoritative transaction status polling.
 * Operates reliably across native Android (via CapacitorHttp) and Web (via CORS).
 */
export const PLAN_AMOUNT = 150;

/**
 * Normalizes phone number to Kenyan national format 07XXXXXXXX or 01XXXXXXXX
 * (PayHero accepts 10-digit national format 07... / 01... and 254...).
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

export interface PayHeroStkResponse {
  success: boolean;
  status: string;
  reference: string;
  CheckoutRequestID?: string;
  external_reference?: string;
}

/**
 * Payments must be initiated and verified by a trusted server. This legacy
 * client entry point intentionally fails closed until the server payment flow
 * is connected to the device-based access model.
 */
export async function requestStkPush(_params: {
  phone: string;
  userId?: string | null;
  deviceId?: string | null;
}): Promise<PayHeroStkResponse> {
  throw new Error("Secure M-Pesa payments are temporarily unavailable. Please try again later.");
}

export interface PayHeroStatusResponse {
  status: "SUCCESS" | "FAILED" | "PENDING";
  raw: unknown;
}

/** Browser and APK clients must never query PayHero directly. */
export async function checkPaymentStatus(_reference: string): Promise<PayHeroStatusResponse> {
  throw new Error("Payment verification is handled securely by the server.");
}

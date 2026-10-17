/**
 * PayHero Kenya M-Pesa integration for BUJUU.
 * Provides direct STK push requests and authoritative transaction status polling.
 * Operates reliably across native Android (via CapacitorHttp) and Web (via CORS).
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const PAYHERO_API_USERNAME =
  (import.meta as any).env?.VITE_PAYHERO_API_USERNAME || "Fwn62pjQ6lqCzqeExV9h";
export const PAYHERO_API_PASSWORD =
  (import.meta as any).env?.VITE_PAYHERO_API_PASSWORD || "Dfy4GMR0UefuaAU7vrm95nZpPEXrFPpahMynupTb";
export const PAYHERO_CHANNEL_ID = Number(
  (import.meta as any).env?.VITE_PAYHERO_CHANNEL_ID || 12608
);

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
 * Dispatches the M-Pesa STK push prompt to the user's phone.
 * Bypasses intermediary proxies using native CapacitorHttp on Android,
 * or direct CORS preflight on Web.
 */
export async function requestStkPush(params: {
  phone: string;
  userId?: string | null;
  deviceId?: string | null;
}): Promise<PayHeroStkResponse> {
  const cleanPhone = normalizeKenyanPhone(params.phone);
  const ref = `bujuu_${(params.userId || params.deviceId || "guest").slice(0, 8)}_${Date.now()}`;
  const auth = btoa(`${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`);

  const payload = {
    amount: PLAN_AMOUNT,
    phone_number: cleanPhone,
    channel_id: PAYHERO_CHANNEL_ID,
    provider: "m-pesa",
    external_reference: ref,
    callback_url: "https://lynnn.lovable.app/api/public/payhero-callback",
  };

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const res = await CapacitorHttp.request({
      url: "https://backend.payhero.co.ke/api/v2/payments",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      data: payload,
    });

    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    if (res.status >= 400 || (!data.success && data.status !== "QUEUED")) {
      const msg = data?.error_message || data?.message || "Failed to start payment. Please check your number.";
      throw new Error(msg);
    }

    return {
      success: true,
      status: data.status || "QUEUED",
      reference: data.reference,
      CheckoutRequestID: data.CheckoutRequestID,
      external_reference: ref,
    };
  }

  // Web fallback using standard fetch
  const res = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || (!data.success && data.status !== "QUEUED")) {
    const msg = data?.error_message || data?.message || "Failed to start payment. Please check your number.";
    throw new Error(msg);
  }

  return {
    success: true,
    status: data.status || "QUEUED",
    reference: data.reference,
    CheckoutRequestID: data.CheckoutRequestID,
    external_reference: ref,
  };
}

export interface PayHeroStatusResponse {
  status: "SUCCESS" | "FAILED" | "PENDING";
  raw: any;
}

/**
 * Checks transaction confirmation status directly with PayHero.
 */
export async function checkPaymentStatus(reference: string): Promise<PayHeroStatusResponse> {
  const auth = btoa(`${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`);
  const url = `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`;

  const isNative = Capacitor.isNativePlatform();
  let data: any;

  try {
    if (isNative) {
      const res = await CapacitorHttp.request({
        url,
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } else {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      data = await res.json();
    }
  } catch (err) {
    return { status: "PENDING", raw: err };
  }

  const rawStatus = String(data?.status || data?.Status || "").toUpperCase();
  if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "PAID") {
    return { status: "SUCCESS", raw: data };
  }
  if (rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "REJECTED") {
    return { status: "FAILED", raw: data };
  }
  return { status: "PENDING", raw: data };
}

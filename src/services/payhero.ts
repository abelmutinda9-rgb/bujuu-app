/**
 * PayHero Kenya M-Pesa integration for BUJUU
 */

export const PAYHERO_API_USERNAME =
  (import.meta as any).env?.VITE_PAYHERO_API_USERNAME || "Fwn62pjQ6lqCzqeExV9h";
export const PAYHERO_API_PASSWORD =
  (import.meta as any).env?.VITE_PAYHERO_API_PASSWORD || "Dfy4GMR0UefuaAU7vrm95nZpPEXrFPpahMynupTb";
export const PAYHERO_CHANNEL_ID = Number(
  (import.meta as any).env?.VITE_PAYHERO_CHANNEL_ID || 12608
);

export const PLAN_AMOUNT = 150;

/** Normalizes phone number to 2547XXXXXXXX or 2541XXXXXXXX */
export function normalizeKenyanPhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = `254${n.slice(1)}`;
  else if (n.startsWith("7") || n.startsWith("1")) n = `254${n}`;
  else if (n.startsWith("2540")) n = `254${n.slice(4)}`;
  else if (n.startsWith("+254")) n = n.slice(1);

  if (!/^254(7|1)\d{8}$/.test(n)) {
    throw new Error("Enter a valid Safaricom or Airtel number (e.g. 0712345678 or 0112345678)");
  }
  return n;
}

export interface PayHeroStkResponse {
  success: boolean;
  status: string;
  reference: string;
  CheckoutRequestID?: string;
  external_reference?: string;
}

export async function requestStkPush(params: {
  phone: string;
  userId?: string;
}): Promise<PayHeroStkResponse> {
  const phone = normalizeKenyanPhone(params.phone);
  const ref = `bujuu_${params.userId?.slice(0, 8) || "guest"}_${Date.now()}`;
  const auth = btoa(`${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`);

  const res = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: PLAN_AMOUNT,
      phone_number: phone,
      channel_id: PAYHERO_CHANNEL_ID,
      provider: "m-pesa",
      external_reference: ref,
      callback_url: "https://lynnn.lovable.app/api/public/payhero-callback",
    }),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from payment provider.");
  }

  if (!res.ok || (!data.success && data.status !== "QUEUED")) {
    const msg = data.error_message || data.message || "Failed to start payment. Please try again.";
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

export async function checkPaymentStatus(reference: string): Promise<PayHeroStatusResponse> {
  const auth = btoa(`${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`);
  const res = await fetch(
    `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: "PENDING", raw: text };
  }

  const rawStatus = String(data.status || data.Status || "").toUpperCase();
  if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "PAID") {
    return { status: "SUCCESS", raw: data };
  }
  if (rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "REJECTED") {
    return { status: "FAILED", raw: data };
  }

  return { status: "PENDING", raw: data };
}

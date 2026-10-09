/**
 * Server-only helpers for paid access, devices, rate limiting and audit logging.
 * Never import this from client code.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export const PLAN_AMOUNT = 150;
export const PLAN_LABEL = "KSh 150 / 30 days";

/** Adds the 30-day plan period. (Name kept for existing callers.) */
export function addMonth(from: Date): Date {
  return new Date(from.getTime() + 30 * 24 * 3600 * 1000);
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** 2547XXXXXXXX for Kenyan numbers; throws on obvious rubbish. */
export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = `254${n.slice(1)}`;
  else if (n.startsWith("7") || n.startsWith("1")) n = `254${n}`;
  else if (n.startsWith("2540")) n = `254${n.slice(4)}`;
  if (!/^254(7|1)\d{8}$/.test(n)) throw new Error("Enter a valid Safaricom number, e.g. 0712345678");
  return n;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0]! % 900000));
}

export async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function rateLimit(bucket: string, key: string, limit: number, windowSeconds: number) {
  const db = await admin();
  const { data, error } = await db.rpc("check_rate_limit", {
    _bucket: bucket,
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (error) return; // never block on limiter failure
  if (data === false) throw new Error("Too many attempts. Please wait a moment and try again.");
}

export async function audit(
  event: string,
  meta: Record<string, unknown> = {},
  ids: { subscriberId?: string | null; deviceId?: string | null } = {},
) {
  const db = await admin();
  await db.from("audit_log").insert({
    event,
    subscriber_id: ids.subscriberId ?? null,
    device_id: ids.deviceId ?? null,
    meta: { ip: clientIp(), ...meta },
  });
}

export interface DeviceCreds {
  deviceId: string;
  deviceSecret: string;
}

export interface AccessState {
  active: boolean;
  phone: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  reason: "ok" | "no_device" | "no_subscription" | "expired" | "device_revoked";
}

/** Verifies the device credentials and returns the subscription state behind them. */
export async function resolveAccess(creds: DeviceCreds | null): Promise<
  AccessState & { subscriberId: string | null; deviceRow: { id: string } | null }
> {
  const none = {
    active: false,
    phone: null,
    expiresAt: null,
    autoRenew: false,
    subscriberId: null,
    deviceRow: null,
  } as const;
  if (!creds?.deviceId || !creds.deviceSecret) return { ...none, reason: "no_device" };

  const db = await admin();
  const { data: device } = await db
    .from("devices")
    .select("id, subscriber_id, secret_hash, revoked_at")
    .eq("id", creds.deviceId)
    .maybeSingle();
  if (!device) return { ...none, reason: "no_device" };

  const hash = await sha256(creds.deviceSecret);
  if (!timingSafeEqualHex(hash, device.secret_hash)) return { ...none, reason: "no_device" };

  // The device is genuine from here on, so always report its row — callers such as
  // startPayment need it even when there is no subscription yet.
  const known = { ...none, deviceRow: { id: device.id } as { id: string } };
  if (device.revoked_at) return { ...known, reason: "device_revoked" };
  if (!device.subscriber_id) return { ...known, reason: "no_subscription" };

  const [{ data: subscriber }, { data: sub }] = await Promise.all([
    db.from("subscribers").select("phone").eq("id", device.subscriber_id).maybeSingle(),
    db
      .from("subscriptions")
      .select("expires_at, status, auto_renew")
      .eq("subscriber_id", device.subscriber_id)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  await db.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

  const base = {
    phone: subscriber?.phone ?? null,
    subscriberId: device.subscriber_id,
    deviceRow: { id: device.id },
  };
  if (!sub) {
    return { ...base, active: false, expiresAt: null, autoRenew: false, reason: "no_subscription" };
  }
  const expired = new Date(sub.expires_at).getTime() <= Date.now();
  return {
    ...base,
    active: !expired,
    expiresAt: sub.expires_at,
    autoRenew: sub.auto_renew === true,
    reason: expired ? "expired" : "ok",
  };
}

/** Creates (or extends) a one-month subscription for a phone and binds a device to it. */
export async function grantSubscription(phone: string, deviceId: string | null) {
  const db = await admin();
  const { data: existing } = await db
    .from("subscribers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  let subscriberId = existing?.id ?? null;
  if (!subscriberId) {
    const { data: created, error } = await db
      .from("subscribers")
      .insert({ phone })
      .select("id")
      .single();
    if (error) throw error;
    subscriberId = created.id;
  }

  const { data: current } = await db
    .from("subscriptions")
    .select("id, expires_at")
    .eq("subscriber_id", subscriberId)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const from =
    current && new Date(current.expires_at).getTime() > now
      ? new Date(current.expires_at)
      : new Date(now);
  const expiresAt = addMonth(from).toISOString();

  if (current) {
    await db
      .from("subscriptions")
      .update({
        expires_at: expiresAt,
        status: "active",
        auto_renew: true,
        cancelled_at: null,
        last_charge_attempt_at: new Date().toISOString(),
      })
      .eq("id", current.id);
  } else {
    await db.from("subscriptions").insert({
      subscriber_id: subscriberId,
      expires_at: expiresAt,
      last_charge_attempt_at: new Date().toISOString(),
    });
  }

  if (deviceId) await bindDevice(subscriberId, deviceId);
  return { subscriberId, expiresAt };
}

/** Turns off automatic monthly renewal; the current month keeps running. */
export async function cancelAutoRenew(subscriberId: string) {
  const db = await admin();
  await db
    .from("subscriptions")
    .update({ auto_renew: false, cancelled_at: new Date().toISOString() })
    .eq("subscriber_id", subscriberId)
    .eq("status", "active");
}

/** One device at a time: bind this one, revoke every other device on the account. */
export async function bindDevice(subscriberId: string, deviceId: string) {
  const db = await admin();
  await db.from("devices").update({ subscriber_id: subscriberId, revoked_at: null }).eq("id", deviceId);
  await db
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("subscriber_id", subscriberId)
    .neq("id", deviceId)
    .is("revoked_at", null);
}

/* ---------- PayHero ---------- */

const PAYHERO_URL = "https://backend.payhero.co.ke/api/v2/payments";

export function payheroConfigured() {
  return Boolean(
    process.env["PAYHERO_API_USERNAME"] &&
      process.env["PAYHERO_API_PASSWORD"] &&
      process.env["PAYHERO_CHANNEL_ID"],
  );
}

export async function payheroStkPush(args: {
  phone: string;
  amount: number;
  reference: string;
  callbackUrl: string;
}) {
  const username = process.env["PAYHERO_API_USERNAME"];
  const password = process.env["PAYHERO_API_PASSWORD"];
  const channelId = process.env["PAYHERO_CHANNEL_ID"];
  if (!username || !password || !channelId) throw new Error("Payments are not configured yet.");

  const auth = btoa(`${username}:${password}`);
  const res = await fetch(PAYHERO_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: args.amount,
      phone_number: args.phone,
      channel_id: Number(channelId),
      provider: "m-pesa",
      external_reference: args.reference,
      callback_url: args.callbackUrl,
    }),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    console.error("PayHero STK push failed", res.status, text);
    throw new Error("Could not start the M-Pesa payment. Please try again.");
  }
  return body as Record<string, unknown>;
}

export function siteOrigin(): string {
  const explicit = process.env["PUBLIC_SITE_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
  const proto = getRequestHeader("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Independently confirms a payment with PayHero (never trust the callback body alone). */
export async function payheroTransactionStatus(reference: string): Promise<{
  status: string;
  raw: unknown;
}> {
  const username = process.env["PAYHERO_API_USERNAME"];
  const password = process.env["PAYHERO_API_PASSWORD"];
  if (!username || !password) throw new Error("Payments are not configured yet.");
  const auth = btoa(`${username}:${password}`);
  const res = await fetch(
    `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`,
    { headers: { authorization: `Basic ${auth}` } },
  );
  const text = await res.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    console.error("PayHero status check failed", res.status, text);
    throw new Error("Could not verify the payment.");
  }
  const status = String(
    (raw as { status?: string; Status?: string }).status ??
      (raw as { Status?: string }).Status ??
      "",
  ).toUpperCase();
  return { status, raw };
}

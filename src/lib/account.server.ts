/**
 * Server-only helpers for Google-account identity: profile linking, the
 * account's subscription, and the single authorized device per account.
 * Never import this from client code.
 */
import { admin, audit, sha256, timingSafeEqualHex } from "./bujuu.server";

export type AccountStatus = "ACTIVE" | "NO_SUBSCRIPTION" | "EXPIRED" | "DEVICE_NOT_AUTHORIZED";

export interface AccountState {
  status: AccountStatus;
  isPremium: boolean;
  phone: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  deviceAuthorized: boolean;
  subscriberId: string | null;
}

/** Creates or refreshes the profile row for a signed-in account. */
export async function upsertProfile(claims: Record<string, unknown>) {
  const db = await admin();
  const id = String(claims["sub"]);
  const email = typeof claims["email"] === "string" ? (claims["email"] as string) : null;
  const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta["full_name"] === "string" && (meta["full_name"] as string)) ||
    (typeof meta["name"] === "string" && (meta["name"] as string)) ||
    null;
  const providerId =
    typeof meta["provider_id"] === "string" ? (meta["provider_id"] as string) : null;

  await db.from("profiles").upsert(
    {
      id,
      email,
      display_name: displayName,
      provider: "google",
      provider_user_id: providerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return { id, email, displayName };
}

/** The subscriber row that owns this account's subscription, if any. */
export async function accountSubscriber(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("subscribers")
    .select("id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Finds (or creates) the subscriber for this account and phone number.
 * An existing phone-only subscriber is adopted by the account, so nobody who
 * already paid loses their subscription.
 */
export async function linkSubscriber(userId: string, phone: string) {
  const db = await admin();
  const mine = await accountSubscriber(userId);
  if (mine) {
    if (mine.phone !== phone) await db.from("subscribers").update({ phone }).eq("id", mine.id);
    return mine.id;
  }

  const { data: byPhone } = await db
    .from("subscribers")
    .select("id, user_id")
    .eq("phone", phone)
    .maybeSingle();
  if (byPhone) {
    if (byPhone.user_id && byPhone.user_id !== userId) {
      throw new Error("That number is already used by another bujuu account.");
    }
    await db.from("subscribers").update({ user_id: userId }).eq("id", byPhone.id);
    return byPhone.id;
  }

  const { data: created, error } = await db
    .from("subscribers")
    .insert({ phone, user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error("Could not set up your account. Please try again.");
  return created.id;
}

/** Verifies the device secret and that the device belongs to this account. */
export async function verifyDevice(
  userId: string,
  creds: { deviceId: string; deviceSecret: string },
) {
  const db = await admin();
  const { data: device } = await db
    .from("devices")
    .select("id, user_id, secret_hash, revoked_at")
    .eq("id", creds.deviceId)
    .maybeSingle();
  if (!device) return null;
  if (!timingSafeEqualHex(await sha256(creds.deviceSecret), device.secret_hash)) return null;
  return {
    id: device.id,
    mine: device.user_id === userId,
    revoked: Boolean(device.revoked_at),
  };
}

/** The account's currently authorized device, if there is one. */
export async function authorizedDevice(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("devices")
    .select("id, platform, last_seen_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Makes this device the account's only authorized device. Any other device on
 * the account is revoked. The subscription itself is never touched.
 */
export async function authorizeOnly(userId: string, deviceId: string, platform?: string | null) {
  const db = await admin();
  const subscriber = await accountSubscriber(userId);
  await db
    .from("devices")
    .update({
      user_id: userId,
      subscriber_id: subscriber?.id ?? null,
      platform: platform ?? null,
      revoked_at: null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", deviceId);
  await db
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .neq("id", deviceId)
    .is("revoked_at", null);
  await audit("device_authorized", { platform: platform ?? null }, { deviceId });
}

/** Subscription + device state for an account. All checks happen here, server-side. */
export async function accountState(
  userId: string,
  creds?: { deviceId: string; deviceSecret: string } | null,
): Promise<AccountState> {
  const db = await admin();
  const subscriber = await accountSubscriber(userId);

  let deviceAuthorized = false;
  if (creds?.deviceId && creds.deviceSecret) {
    const device = await verifyDevice(userId, creds);
    if (device && device.mine && !device.revoked) {
      deviceAuthorized = true;
      await db
        .from("devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", device.id);
    }
  }

  if (!subscriber) {
    return {
      status: "NO_SUBSCRIPTION",
      isPremium: false,
      phone: null,
      expiresAt: null,
      autoRenew: false,
      deviceAuthorized,
      subscriberId: null,
    };
  }

  const { data: sub } = await db
    .from("subscriptions")
    .select("expires_at, status, auto_renew")
    .eq("subscriber_id", subscriber.id)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = {
    phone: subscriber.phone,
    subscriberId: subscriber.id,
    deviceAuthorized,
  };
  if (!sub) {
    return { ...base, status: "NO_SUBSCRIPTION", isPremium: false, expiresAt: null, autoRenew: false };
  }
  const live = sub.status === "active" && new Date(sub.expires_at).getTime() > Date.now();
  if (!live) {
    return {
      ...base,
      status: "EXPIRED",
      isPremium: false,
      expiresAt: sub.expires_at,
      autoRenew: sub.auto_renew === true,
    };
  }
  return {
    ...base,
    status: deviceAuthorized ? "ACTIVE" : "DEVICE_NOT_AUTHORIZED",
    isPremium: deviceAuthorized,
    expiresAt: sub.expires_at,
    autoRenew: sub.auto_renew === true,
  };
}

/**
 * True when the caller re-verified with an email one-time code in the last
 * 15 minutes. Read from the signed token, so it cannot be faked by the app.
 */
export function recentEmailOtp(claims: Record<string, unknown>): boolean {
  const amr = claims["amr"];
  if (!Array.isArray(amr)) return false;
  const cutoff = Date.now() / 1000 - 15 * 60;
  return amr.some((entry) => {
    const e = entry as { method?: string; timestamp?: number };
    return (
      (e.method === "otp" || e.method === "email" || e.method === "magiclink") &&
      typeof e.timestamp === "number" &&
      e.timestamp > cutoff
    );
  });
}

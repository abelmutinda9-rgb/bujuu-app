/**
 * Account-based server functions: Google identity, KSh 150 / 30-day
 * subscription, one authorized device, and the playback gate.
 * Every check runs on the server; nothing here trusts the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deviceSchema = z.object({
  deviceId: z.string().uuid(),
  deviceSecret: z.string().min(16),
  platform: z.string().max(120).optional(),
});

const optionalDeviceSchema = deviceSchema.partial({ deviceId: true, deviceSecret: true });

/**
 * Called right after Google sign-in. Links the profile and, when the account
 * has no authorized device yet, authorizes this one.
 */
export const syncAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deviceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { upsertProfile, verifyDevice, authorizedDevice, authorizeOnly, accountState } =
      await import("@/lib/account.server");

    const profile = await upsertProfile(context.claims as Record<string, unknown>);
    const device = await verifyDevice(context.userId, data);
    if (!device) throw new Error("This device is not recognised. Please reload the app.");

    const current = await authorizedDevice(context.userId);
    if (!current || current.id === device.id) {
      await authorizeOnly(context.userId, device.id, data.platform ?? null);
    }

    const state = await accountState(context.userId, data);
    return { ...state, email: profile.email, displayName: profile.displayName };
  });

/** Subscription + device status for the signed-in account. Safe to poll. */
export const myStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => optionalDeviceSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { accountState } = await import("@/lib/account.server");
    const creds =
      data.deviceId && data.deviceSecret
        ? { deviceId: data.deviceId, deviceSecret: data.deviceSecret }
        : null;
    return accountState(context.userId, creds);
  });

/** Starts the M-Pesa STK push for KSh 150 / 30 days on this account. */
export const startSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    deviceSchema.extend({ phone: z.string().min(9).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const {
      admin,
      normalizePhone,
      randomToken,
      rateLimit,
      clientIp,
      audit,
      payheroStkPush,
      payheroConfigured,
      siteOrigin,
      PLAN_AMOUNT,
    } = await import("@/lib/bujuu.server");
    const { linkSubscriber, verifyDevice } = await import("@/lib/account.server");

    const phone = normalizePhone(data.phone);
    await rateLimit("pay_start_user", context.userId, 8, 900);
    await rateLimit("pay_start_ip", clientIp(), 10, 900);
    await rateLimit("pay_start_phone", phone, 5, 900);

    const device = await verifyDevice(context.userId, data);
    if (!device) throw new Error("This device is not recognised. Please reload the app.");
    if (!payheroConfigured()) throw new Error("Payments are not set up yet.");

    const subscriberId = await linkSubscriber(context.userId, phone);

    const reference = `bujuu-${randomToken(8)}`;
    const db = await admin();
    const { error } = await db.from("payments").insert({
      reference,
      phone,
      amount: PLAN_AMOUNT,
      status: "pending",
      device_id: device.id,
      subscriber_id: subscriberId,
      user_id: context.userId,
    });
    if (error) throw new Error("Could not start the payment. Please try again.");

    try {
      const raw = await payheroStkPush({
        phone,
        amount: PLAN_AMOUNT,
        reference,
        callbackUrl: `${siteOrigin()}/api/public/payhero-callback`,
      });
      await db
        .from("payments")
        .update({
          provider_reference: String((raw as { reference?: string }).reference ?? ""),
          raw: raw as never,
        })
        .eq("reference", reference);
    } catch (e) {
      await db.from("payments").update({ status: "failed" }).eq("reference", reference);
      throw e;
    }

    await audit("payment_started", { reference, phone }, { subscriberId, deviceId: device.id });
    return { reference };
  });

/** Poll a payment of this account until PayHero's verified result lands. */
export const mySubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    optionalDeviceSchema.extend({ reference: z.string().min(4).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/bujuu.server");
    const { accountState } = await import("@/lib/account.server");

    const db = await admin();
    const { data: payment } = await db
      .from("payments")
      .select("status")
      .eq("reference", data.reference)
      .eq("user_id", context.userId)
      .maybeSingle();

    const creds =
      data.deviceId && data.deviceSecret
        ? { deviceId: data.deviceId, deviceSecret: data.deviceSecret }
        : null;
    const state = await accountState(context.userId, creds);
    return { ...state, paymentStatus: payment?.status ?? "unknown" };
  });

/**
 * Moves the authorization to this device. Only allowed right after the account
 * re-verified with the one-time code emailed to its verified address; the
 * subscription and its expiry are left exactly as they are.
 */
export const transferDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deviceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { rateLimit, clientIp, audit } = await import("@/lib/bujuu.server");
    const { verifyDevice, authorizeOnly, accountState, recentEmailOtp } = await import(
      "@/lib/account.server"
    );

    await rateLimit("device_transfer_user", context.userId, 5, 3600);
    await rateLimit("device_transfer_ip", clientIp(), 10, 3600);

    if (!recentEmailOtp(context.claims as Record<string, unknown>)) {
      throw new Error("Please enter the code we emailed you, then try again.");
    }

    const device = await verifyDevice(context.userId, data);
    if (!device) throw new Error("This device is not recognised. Please reload the app.");

    await authorizeOnly(context.userId, device.id, data.platform ?? null);
    await audit("device_transfer_verified", {}, { deviceId: device.id });
    const { notify } = await import("@/lib/notify.server");
    await notify(context.userId, {
      kind: "device_replaced",
      title: "Watching moved to a new device",
      body: "Your previous device was signed out of playback. Your subscription time is unchanged.",
      dedupeKey: `device:${device.id}:${Date.now()}`,
    });
    return accountState(context.userId, data);
  });

/** Stops future monthly charges. The paid period keeps running. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { cancelAutoRenew, audit } = await import("@/lib/bujuu.server");
    const { accountSubscriber, accountState } = await import("@/lib/account.server");
    const subscriber = await accountSubscriber(context.userId);
    if (!subscriber) throw new Error("There is no subscription on this account.");
    await cancelAutoRenew(subscriber.id);
    await audit("renewal_cancelled", {}, { subscriberId: subscriber.id });
    return accountState(context.userId, null);
  });

/**
 * The playback gate. The stream address is only built when the account has a
 * live subscription AND this device is the authorized one.
 */
export const getStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    deviceSchema
      .extend({
        tmdbId: z.number().int().positive(),
        mediaType: z.enum(["movie", "tv"]),
        season: z.number().int().positive().default(1),
        episode: z.number().int().positive().default(1),
        server: z.number().int().min(0).max(20).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { rateLimit, clientIp, audit } = await import("@/lib/bujuu.server");
    const { accountState } = await import("@/lib/account.server");
    const { embedUrl, SERVER_COUNT } = await import("@/services/embeds");

    await rateLimit("playback", clientIp(), 240, 3600);
    const state = await accountState(context.userId, data);
    if (!state.isPremium) {
      return { allowed: false as const, status: state.status, src: null, serverCount: SERVER_COUNT };
    }

    await audit(
      "playback_granted",
      { tmdbId: data.tmdbId, mediaType: data.mediaType, server: data.server },
      { subscriberId: state.subscriberId, deviceId: data.deviceId },
    );

    return {
      allowed: true as const,
      status: state.status,
      src: embedUrl(
        {
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
          season: data.season,
          episode: data.episode,
        },
        data.server,
      ),
      serverCount: SERVER_COUNT,
    };
  });

/** Invite link + rewards for the signed-in account. */
export const myReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { referralSummary } = await import("@/lib/referral.server");
    return referralSummary(context.userId);
  });

/** Applies an invite code captured from a /r/ link. Safe to call repeatedly. */
export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(3).max(16) }).parse(input))
  .handler(async ({ data, context }) => {
    const { rateLimit } = await import("@/lib/bujuu.server");
    const { attachReferral } = await import("@/lib/referral.server");
    await rateLimit("referral_apply", context.userId, 5, 3600);
    return { ok: await attachReferral(context.userId, data.code) };
  });

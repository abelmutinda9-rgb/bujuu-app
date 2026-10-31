/**
 * Server functions for paid access: device registration, M-Pesa payment,
 * subscription state, device transfer and the playback gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credsSchema = z.object({
  deviceId: z.string().uuid(),
  deviceSecret: z.string().min(16),
});

const playbackSchema = credsSchema.extend({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  season: z.number().int().positive().default(1),
  episode: z.number().int().positive().default(1),
  server: z.number().int().min(0).max(20).default(0),
});

/** Creates a fresh device identity. Called once per browser/TV. */
export const registerDevice = createServerFn({ method: "POST" })
  .validator((input: { label?: string } | undefined) =>
    z.object({ label: z.string().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { admin, randomToken, sha256, rateLimit, clientIp, audit } = await import(
      "@/lib/bujuu.server"
    );
    await rateLimit("device_register", clientIp(), 20, 3600);

    const secret = randomToken(32);
    const db = await admin();
    const { data: row, error } = await db
      .from("devices")
      .insert({ secret_hash: await sha256(secret), label: data.label ?? null })
      .select("id")
      .single();
    if (error) throw new Error("Could not set up this device. Please try again.");

    await audit("device_registered", {}, { deviceId: row.id });
    return { deviceId: row.id, deviceSecret: secret };
  });

/** Current subscription state for a device. Safe to poll. */
export const getAccess = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveAccess } = await import("@/lib/bujuu.server");
    const state = await resolveAccess(data);
    return {
      active: state.active,
      phone: state.phone,
      expiresAt: state.expiresAt,
      autoRenew: state.autoRenew,
      reason: state.reason,
    };
  });


/** Device-bound trial/access status, derived only from server timestamps and subscriptions. */
export const getDeviceStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin, resolveAccess } = await import("@/lib/bujuu.server");
    const access = await resolveAccess(data);
    if (!access.deviceRow) return { status: "blocked" as const, can_stream: false, days_remaining: 0 };
    if (access.active && access.expiresAt) {
      return {
        status: "active" as const,
        can_stream: true,
        days_remaining: Math.max(0, Math.ceil((new Date(access.expiresAt).getTime() - Date.now()) / 86400000)),
        subscription_expires_at: access.expiresAt,
        phone: access.phone,
      };
    }
    const ends = access.trialEndsAt ? new Date(access.trialEndsAt) : new Date(0);
    const remainingMs = ends.getTime() - Date.now();
    const canStream = remainingMs > 0 && access.reason !== "device_revoked";
    return {
      status: canStream ? "trial" as const : (access.reason === "device_revoked" ? "blocked" as const : "expired" as const),
      can_stream: canStream,
      days_remaining: Math.max(0, Math.ceil(remainingMs / 86400000)),
      trial_ends_at: ends.toISOString(),
    };
  });

/** Stops automatic monthly charges. The paid month keeps running. */
export const cancelRenewal = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveAccess, cancelAutoRenew, audit } = await import("@/lib/bujuu.server");
    const state = await resolveAccess(data);
    if (!state.subscriberId) throw new Error("There is no subscription on this device.");
    await cancelAutoRenew(state.subscriberId);
    await audit("renewal_cancelled", {}, { subscriberId: state.subscriberId });
    return { autoRenew: false, expiresAt: state.expiresAt };
  });

/** Starts an M-Pesa STK push for the KSh 150 / 30-day plan. */
export const startPayment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        phone: z.string().min(9).max(20),
        deviceId: z.string().uuid(),
        deviceSecret: z.string().min(32),
        userId: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
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
      resolveAccess,
    } = await import("@/lib/bujuu.server");

    const phone = normalizePhone(data.phone);
    await rateLimit("pay_start_ip", clientIp(), 15, 900);
    await rateLimit("pay_start_phone", phone, 8, 900);

    if (!payheroConfigured()) throw new Error("Payments are not configured yet.");

    const device = await resolveAccess({ deviceId: data.deviceId, deviceSecret: data.deviceSecret });
    const deviceId = device.deviceRow?.id ?? null;
    if (!deviceId || device.reason === "device_revoked") {
      throw new Error("This device is not recognized. Refresh BUJUU and try again.");
    }

    const reference = `bujuu-${randomToken(8)}`;
    const db = await admin();

    // Check or link subscriber
    const { data: existingSub } = await db
      .from("subscribers")
      .select("id, user_id")
      .eq("phone", phone)
      .maybeSingle();

    let subscriberId = existingSub?.id ?? null;
    if (!subscriberId && data.userId) {
      const { data: newSub } = await db
        .from("subscribers")
        .insert({ phone, user_id: data.userId })
        .select("id")
        .maybeSingle();
      subscriberId = newSub?.id ?? null;
    } else if (existingSub && data.userId && !existingSub.user_id) {
      await db.from("subscribers").update({ user_id: data.userId }).eq("id", existingSub.id);
    }

    const { error } = await db.from("payments").insert({
      reference,
      phone,
      amount: PLAN_AMOUNT,
      status: "pending",
      device_id: deviceId,
      subscriber_id: subscriberId,
      user_id: data.userId ?? null,
    });
    if (error) throw new Error("Could not start the payment. Please try again.");

    const callbackUrl = `${siteOrigin()}/api/public/payhero-callback`;
    try {
      const raw = await payheroStkPush({
        phone,
        amount: PLAN_AMOUNT,
        reference,
        callbackUrl,
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

    await audit("payment_started", { reference, phone }, { deviceId, subscriberId });
    return { reference };
  });

/**
 * Polls and authoritatively confirms a payment with PayHero.
 * When PayHero confirms payment success, immediately grants subscription
 * in Supabase and qualifies any active referral.
 */
export const verifyAndActivatePayment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        reference: z.string().min(4).max(64),
        deviceId: z.string().uuid(),
        deviceSecret: z.string().min(32),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const {
      admin,
      audit,
      grantSubscription,
      payheroTransactionStatus,
      PLAN_AMOUNT,
    } = await import("@/lib/bujuu.server");

    const device = await (await import("@/lib/bujuu.server")).resolveAccess({
      deviceId: data.deviceId,
      deviceSecret: data.deviceSecret,
    });
    if (!device.deviceRow || device.reason === "device_revoked") {
      throw new Error("This device is not authorized to verify this payment.");
    }
    const db = await admin();
    const { data: payment } = await db
      .from("payments")
      .select("id, status, applied_at, phone, device_id, provider_reference, amount, user_id, reference")
      .eq("reference", data.reference)
      .eq("device_id", device.deviceRow.id)
      .maybeSingle();

    if (!payment) {
      return { status: "NOT_FOUND", isPremium: false };
    }

    // Already applied and confirmed
    if (payment.status === "success" && payment.applied_at) {
      return { status: "SUCCESS", isPremium: true };
    }

    // Marked failed
    if (payment.status === "failed") {
      return { status: "FAILED", isPremium: false };
    }

    if (Number(payment.amount) !== PLAN_AMOUNT) {
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return { status: "FAILED", isPremium: false };
    }

    // Query PayHero status directly from backend
    const providerRef = payment.provider_reference || payment.reference;
    try {
      const check = await payheroTransactionStatus(providerRef);
      const verified = check.status;

      if (verified === "SUCCESS") {
        // Claim payment atomically so it only applies once
        const { data: claimed } = await db
          .from("payments")
          .update({ applied_at: new Date().toISOString() })
          .eq("id", payment.id)
          .is("applied_at", null)
          .select("id");

        if (claimed && claimed.length > 0) {
          const effectiveUserId = payment.user_id || null;
          const effectiveDeviceId = payment.device_id || device.deviceRow.id;

          const { subscriberId, expiresAt } = await grantSubscription(
            payment.phone,
            effectiveDeviceId,
            effectiveUserId,
          );

          await db
            .from("payments")
            .update({
              status: "success",
              subscriber_id: subscriberId,
              user_id: effectiveUserId,
            })
            .eq("id", payment.id);

          const { qualifyReferral } = await import("@/lib/referral.server");
          await qualifyReferral(effectiveUserId, payment.id).catch(() => undefined);

          const { notify } = await import("@/lib/notify.server");
          await notify(effectiveUserId, {
            kind: "payment_confirmed",
            title: "Payment confirmed",
            body: `KSh ${PLAN_AMOUNT} received. Access active until ${new Date(expiresAt).toLocaleDateString("en-KE")}.`,
            dedupeKey: `payment:${payment.id}`,
          });

          await audit(
            "payment_verified_polling",
            { reference: payment.reference, expiresAt },
            { subscriberId, deviceId: effectiveDeviceId },
          );
        }

        return { status: "SUCCESS", isPremium: true };
      }

      if (verified === "FAILED" || verified === "CANCELLED") {
        await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
        return { status: "FAILED", isPremium: false };
      }
    } catch (err) {
      console.warn("PayHero status check error in polling:", err);
    }

    return { status: "PENDING", isPremium: false };
  });

/** Poll a payment until it lands. Also returns the resulting access state. */
export const paymentStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.extend({ reference: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    const { admin, resolveAccess } = await import("@/lib/bujuu.server");
    const device = await resolveAccess(data);
    if (!device.deviceRow) throw new Error("This device is not recognised. Please reload the app.");

    const db = await admin();
    const { data: payment } = await db
      .from("payments")
      .select("status, reference")
      .eq("reference", data.reference)
      .eq("device_id", device.deviceRow.id)
      .maybeSingle();

    const after = await resolveAccess(data);
    return {
      status: payment?.status ?? "unknown",
      active: after.active,
      expiresAt: after.expiresAt,
    };
  });

/**
 * Moves an existing subscription to this device.
 * Rate limited and audited; the previous device is revoked immediately.
 */
export const claimSubscription = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    credsSchema.extend({ phone: z.string().min(9).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, normalizePhone, rateLimit, clientIp, audit, bindDevice, resolveAccess } =
      await import("@/lib/bujuu.server");

    const phone = normalizePhone(data.phone);
    await rateLimit("claim_ip", clientIp(), 8, 900);
    await rateLimit("claim_phone", phone, 5, 3600);

    const device = await resolveAccess(data);
    if (!device.deviceRow) throw new Error("This device is not recognised. Please reload the app.");

    const db = await admin();
    const { data: subscriber } = await db
      .from("subscribers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (!subscriber) throw new Error("No subscription found for that number.");

    const { data: sub } = await db
      .from("subscriptions")
      .select("expires_at")
      .eq("subscriber_id", subscriber.id)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || new Date(sub.expires_at).getTime() <= Date.now()) {
      throw new Error("That subscription has expired. Please pay again to continue.");
    }

    await bindDevice(subscriber.id, device.deviceRow.id);
    await audit(
      "device_transferred",
      { phone },
      { subscriberId: subscriber.id, deviceId: device.deviceRow.id },
    );
    return { active: true, expiresAt: sub.expires_at, phone };
  });

/** The playback gate: the stream address is only built after access is verified. */
export const getPlaybackSource = createServerFn({ method: "POST" })
  .validator((input: unknown) => playbackSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveAccess, rateLimit, clientIp, audit } = await import("@/lib/bujuu.server");
    const { embedUrl, SERVER_COUNT } = await import("@/services/embeds");

    await rateLimit("playback", clientIp(), 240, 3600);
    const access = await resolveAccess(data);
    if (!access.active) {
      return { allowed: false as const, reason: access.reason, src: null, serverCount: SERVER_COUNT };
    }

    await audit(
      "playback_granted",
      { tmdbId: data.tmdbId, mediaType: data.mediaType, server: data.server },
      { subscriberId: access.subscriberId, deviceId: access.deviceRow?.id ?? null },
    );

    return {
      allowed: true as const,
      reason: "ok" as const,
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

import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const BATCH = 40;
const RETRY_GAP_MS = 12 * 3600 * 1000;

/**
 * Daily renewal run (00:00 East Africa time). Charges subscriptions that are
 * due, one bounded batch per run, and suspends accounts left unpaid for a week.
 * Only the scheduler can call it: the shared cron secret is verified first.
 */
export const Route = createFileRoute("/api/public/hooks/renew-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) {
          // The in-database daily schedule sends its own private token instead.
          const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
          if (!token) return denied;
          const { admin: getAdmin, timingSafeEqualHex } = await import("@/lib/bujuu.server");
          const { data: row } = await (await getAdmin())
            .from("scheduler_tokens")
            .select("token")
            .eq("name", "renew")
            .maybeSingle();
          if (!row || !timingSafeEqualHex(row.token, token)) return denied;
        }

        const {
          admin,
          audit,
          randomToken,
          payheroStkPush,
          payheroConfigured,
          siteOrigin,
          PLAN_AMOUNT,
        } = await import("@/lib/bujuu.server");

        const db = await admin();
        const now = new Date();
        const nowIso = now.toISOString();

        // Suspend anything a week past its expiry.
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        await db
          .from("subscriptions")
          .update({ status: "suspended" })
          .eq("status", "active")
          .lt("expires_at", weekAgo);

        // Cache upkeep: drop expired catalogue entries so the cache cannot grow forever.
        await db.from("media_cache").delete().lt("expires_at", nowIso);
        await db.from("rate_limits").delete().lt("window_start", new Date(now.getTime() - 86400000).toISOString());

        // "Ending soon" notices for subscriptions expiring within 3 days.
        const soon = new Date(now.getTime() + 3 * 86400000).toISOString();
        const { data: ending } = await db
          .from("subscriptions")
          .select("id, subscriber_id, expires_at, auto_renew")
          .eq("status", "active")
          .gt("expires_at", nowIso)
          .lte("expires_at", soon)
          .limit(200);
        if (ending?.length) {
          const { notify } = await import("@/lib/notify.server");
          const { data: subs } = await db
            .from("subscribers")
            .select("id, user_id")
            .in("id", ending.map((e) => e.subscriber_id));
          for (const e of ending) {
            const userId = subs?.find((s) => s.id === e.subscriber_id)?.user_id;
            await notify(userId, {
              kind: "subscription_ending",
              title: "Subscription ending soon",
              body: `Your access ends on ${new Date(e.expires_at).toLocaleDateString("en-KE")}.${
                e.auto_renew ? " We'll send an M-Pesa prompt to renew." : " Renew to keep watching."
              }`,
              dedupeKey: `ending:${e.id}:${e.expires_at}`,
            });
          }
        }

        if (!payheroConfigured()) {
          return Response.json({ charged: 0, skipped: "payments_not_configured" });
        }

        const { data: due } = await db
          .from("subscriptions")
          .select("id, subscriber_id, expires_at, last_charge_attempt_at")
          .eq("status", "active")
          .eq("auto_renew", true)
          .lte("expires_at", nowIso)
          .order("expires_at", { ascending: true })
          .limit(BATCH);

        let charged = 0;
        for (const sub of due ?? []) {
          const last = sub.last_charge_attempt_at
            ? new Date(sub.last_charge_attempt_at).getTime()
            : 0;
          if (now.getTime() - last < RETRY_GAP_MS) continue;

          // Claim the attempt first so a concurrent run cannot double-charge.
          const { data: claimed } = await db
            .from("subscriptions")
            .update({ last_charge_attempt_at: nowIso })
            .eq("id", sub.id)
            .or(
              sub.last_charge_attempt_at
                ? `last_charge_attempt_at.eq.${sub.last_charge_attempt_at}`
                : "last_charge_attempt_at.is.null",
            )
            .select("id")
            .maybeSingle();
          if (!claimed) continue;

          const [{ data: subscriber }, { data: device }] = await Promise.all([
            db.from("subscribers").select("phone").eq("id", sub.subscriber_id).maybeSingle(),
            db
              .from("devices")
              .select("id")
              .eq("subscriber_id", sub.subscriber_id)
              .is("revoked_at", null)
              .order("last_seen_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
          if (!subscriber?.phone) continue;

          const reference = `bujuu-r-${randomToken(6)}`;
          await db.from("payments").insert({
            reference,
            phone: subscriber.phone,
            amount: PLAN_AMOUNT,
            status: "pending",
            device_id: device?.id ?? null,
            subscriber_id: sub.subscriber_id,
          });

          try {
            const raw = await payheroStkPush({
              phone: subscriber.phone,
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
            charged += 1;
            await audit("renewal_requested", { reference }, { subscriberId: sub.subscriber_id });
          } catch (error) {
            console.error("renewal push failed", reference, error);
            await db.from("payments").update({ status: "failed" }).eq("reference", reference);
            await audit("renewal_failed", { reference }, { subscriberId: sub.subscriber_id });
          }
        }

        return Response.json({ charged, considered: due?.length ?? 0 });
      },
    },
  },
});

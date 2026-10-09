import { createFileRoute } from "@tanstack/react-router";

/**
 * PayHero payment notification. The body is untrusted: the reference is used
 * only to look up our own record, and the outcome is confirmed directly with
 * PayHero before any subscription is granted. Repeat notifications are ignored.
 */
export const Route = createFileRoute("/api/public/payhero-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { admin, audit, grantSubscription, payheroTransactionStatus, PLAN_AMOUNT } = await import(
          "@/lib/bujuu.server"
        );

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("bad request", { status: 400 });
        }

        const response = (payload["response"] ?? payload) as Record<string, unknown>;
        const reference = String(
          response["ExternalReference"] ?? response["external_reference"] ?? "",
        );
        if (!reference) return new Response("ok");

        const db = await admin();
        const { data: payment } = await db
          .from("payments")
          .select("id, status, applied_at, phone, device_id, provider_reference, amount, user_id")
          .eq("reference", reference)
          .maybeSingle();
        if (!payment) return new Response("ok");
        if (payment.applied_at) return new Response("ok"); // already applied
        const paidAmount = Number(response["Amount"] ?? response["amount"] ?? payment.amount);
        if (Number(payment.amount) !== PLAN_AMOUNT || paidAmount < PLAN_AMOUNT) {
          await db.from("payments").update({ status: "failed", raw: payload as never }).eq("id", payment.id);
          await audit("payment_amount_mismatch", { reference, paidAmount });
          return new Response("ok");
        }

        const providerRef = String(
          response["Reference"] ?? response["reference"] ?? payment.provider_reference ?? reference,
        );

        let verified = "";
        try {
          const check = await payheroTransactionStatus(providerRef);
          verified = check.status;
        } catch {
          verified = "";
        }

        if (verified !== "SUCCESS") {
          const failed = ["FAILED", "CANCELLED", "QUEUED"].includes(verified) ? verified : null;
          await db
            .from("payments")
            .update({
              status: failed === "FAILED" || failed === "CANCELLED" ? "failed" : payment.status,
              raw: payload as never,
            })
            .eq("id", payment.id);
          await audit("payment_not_confirmed", { reference, verified });
          return new Response("ok");
        }

        // Claim the payment first so a duplicate notification can never grant twice.
        const { data: claimed } = await db
          .from("payments")
          .update({ applied_at: new Date().toISOString() })
          .eq("id", payment.id)
          .is("applied_at", null)
          .select("id");
        if (!claimed?.length) return new Response("ok");

        const { subscriberId, expiresAt } = await grantSubscription(payment.phone, payment.device_id);
        await db
          .from("payments")
          .update({
            status: "success",
            subscriber_id: subscriberId,
            raw: payload as never,
          })
          .eq("id", payment.id);
        const { qualifyReferral } = await import("@/lib/referral.server");
        await qualifyReferral(payment.user_id, payment.id).catch(() => undefined);
        const { notify } = await import("@/lib/notify.server");
        await notify(payment.user_id, {
          kind: "payment_confirmed",
          title: "Payment confirmed",
          body: `KSh ${PLAN_AMOUNT} received. Access active until ${new Date(expiresAt).toLocaleDateString("en-KE")}.`,
          dedupeKey: `payment:${payment.id}`,
        });

        await audit(
          "payment_applied",
          { reference, expiresAt },
          { subscriberId, deviceId: payment.device_id },
        );
        return new Response("ok");
      },
    },
  },
});

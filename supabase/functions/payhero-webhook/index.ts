import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase service environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    console.log("[PayHero Webhook Received]", JSON.stringify(body));

    // PayHero callback payload can be wrapped in `response` or provided top-level
    const resp = body.response || body;
    const reference = String(
      resp.external_reference || resp.ExternalReference || resp.reference || resp.CheckoutRequestID || ""
    );
    const status = String(resp.status || resp.Status || "").toUpperCase();
    const phone = String(resp.phone || resp.phone_number || resp.Phone || "");
    const amount = Number(resp.amount || resp.Amount || 150);

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing transaction reference in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract device ID from external reference (format: bujuu_<device_id>_<timestamp>)
    let deviceId = "";
    if (reference.startsWith("bujuu_")) {
      const parts = reference.split("_");
      if (parts.length >= 3) {
        deviceId = parts.slice(1, -1).join("_");
      } else if (parts.length === 2) {
        deviceId = parts[1];
      }
    }

    if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") {
      // Validate payment amount threshold
      if (amount < 150) {
        console.warn(`[PayHero Webhook] Amount mismatch: received ${amount}, expected 150`);
        await supabase.from("payments").upsert({
          reference: reference,
          phone: phone,
          amount: amount,
          currency: "KES",
          status: "FAILED_AMOUNT_MISMATCH",
          raw_payload: body,
          updated_at: new Date().toISOString(),
        }, { onConflict: "reference" });

        return new Response(
          JSON.stringify({ error: "Amount less than required subscription fee" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recoveryToken = "BUJ-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Upsert payment audit record
      await supabase.from("payments").upsert({
        reference: reference,
        phone: phone,
        amount: amount,
        currency: "KES",
        status: "SUCCESS",
        raw_payload: body,
        updated_at: new Date().toISOString(),
      }, { onConflict: "reference" });

      // If device ID was parsed from the reference, update or insert device directly
      if (deviceId) {
        const { error: rpcErr } = await supabase.rpc("confirm_payment_success", {
          p_device_id: deviceId,
          p_reference: reference,
          p_phone: phone,
          p_raw: body,
        });

        if (rpcErr) {
          console.warn("[PayHero Webhook] confirm_payment_success RPC notice, updating devices directly:", rpcErr);
          await supabase
            .from("devices")
            .upsert({
              device_id: deviceId,
              phone: phone,
              recovery_token: recoveryToken,
              subscription_expires_at: expiresAt,
              is_blocked: false,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "device_id" });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription activated successfully",
          reference,
          deviceId: deviceId || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record non-success callbacks (cancelled / failed / expired)
    await supabase.from("payments").upsert({
      reference: reference,
      phone: phone,
      amount: amount,
      currency: "KES",
      status: status || "FAILED",
      raw_payload: body,
      updated_at: new Date().toISOString(),
    }, { onConflict: "reference" });

    return new Response(
      JSON.stringify({ success: true, message: `Recorded status: ${status}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[PayHero Webhook Error]", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

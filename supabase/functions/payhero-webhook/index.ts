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

    // Extract reference, status, and phone from PayHero callback
    // PayHero sends response payload with external_reference, status, amount, and phone
    const response = body.response || body;
    const reference = response.external_reference || response.reference || response.checkout_request_id;
    const status = (response.status || "").toUpperCase();
    const phone = response.phone || response.phone_number || "";
    const amount = Number(response.amount || 150);

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing transaction reference in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status === "SUCCESS" || status === "COMPLETED") {
      // Find matching payment record or device mapping
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, subscriber_id, user_id, phone")
        .eq("reference", reference)
        .maybeSingle();

      let subscriberId = existingPayment?.subscriber_id;
      let userId = existingPayment?.user_id;

      const recoveryToken = "BUJ-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Upsert payment status
      await supabase.from("payments").upsert({
        reference: reference,
        phone: phone || existingPayment?.phone,
        amount: amount,
        currency: "KES",
        status: "SUCCESS",
        raw_payload: body,
        updated_at: new Date().toISOString(),
      }, { onConflict: "reference" });

      // If subscriber is mapped, activate subscription directly
      if (subscriberId) {
        await supabase.from("subscriptions").insert({
          subscriber_id: subscriberId,
          user_id: userId,
          phone: phone,
          status: "ACTIVE",
          recovery_token: recoveryToken,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscription activated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Ignored status: ${status}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[PayHero Webhook Error]", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

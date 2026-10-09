import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const myWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withdrawalSummary } = await import("@/lib/withdrawal.server");
    return withdrawalSummary(context.userId);
  });

/** Withdraws the ENTIRE server-computed balance. No amount is accepted from the client. */
export const requestReferralWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ phone: z.string().min(9).max(16), requestKey: z.string().uuid() })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { rateLimit } = await import("@/lib/bujuu.server");
    await rateLimit("withdraw", context.userId, 5, 600);
    const { requestWithdrawal } = await import("@/lib/withdrawal.server");
    return requestWithdrawal(context.userId, data.phone, data.requestKey);
  });

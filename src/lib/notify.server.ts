/** Server-only: writes in-app notifications. A dedupe key makes repeats harmless. */
import { admin } from "@/lib/bujuu.server";

export async function notify(
  userId: string | null | undefined,
  n: { kind: string; title: string; body?: string; dedupeKey?: string },
) {
  if (!userId) return;
  const db = await admin();
  await db
    .from("notifications")
    .upsert(
      { user_id: userId, kind: n.kind, title: n.title, body: n.body ?? null, dedupe_key: n.dedupeKey ?? null },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .then(undefined, () => undefined);
}

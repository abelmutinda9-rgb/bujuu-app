/** Public, read-only movie data. The TMDB key stays on the server. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const schema = z.object({
  path: z.string().min(2).max(80),
  params: z.record(z.string(), z.string()).default({}),
});

export const tmdbQuery = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { tmdbCached } = await import("@/lib/tmdb.server");
    const { rateLimit, clientIp } = await import("@/lib/bujuu.server");
    await rateLimit("tmdb", clientIp(), 600, 3600);
    return (await tmdbCached(data.path, data.params)) as Json;
  });

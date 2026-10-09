/**
 * Server-only TMDB access. The API key lives in a secret and never reaches the
 * browser. Every response is cached in the database so repeat visitors share
 * one upstream request, and identical concurrent requests are de-duplicated.
 */
const BASE = "https://api.themoviedb.org/3";

/** Only these shapes may be requested by the browser. */
const ALLOWED: RegExp[] = [
  /^\/trending\/all\/(day|week)$/,
  /^\/movie\/(popular|upcoming|top_rated|now_playing)$/,
  /^\/tv\/(popular|top_rated|on_the_air)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/search\/(multi|person)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/tv\/\d+\/season\/\d+$/,
];

const ALLOWED_PARAMS = new Set([
  "page",
  "query",
  "include_adult",
  "with_genres",
  "sort_by",
  "language",
  "region",
]);

/** How long a response stays fresh, in seconds. */
function ttlFor(path: string): number {
  if (/^\/(movie|tv)\/\d+/.test(path)) return 7 * 24 * 3600; // details rarely change
  if (path.startsWith("/search/")) return 6 * 3600;
  return 3 * 3600; // lists
}

export function assertAllowed(path: string, params: Record<string, string>) {
  if (!ALLOWED.some((re) => re.test(path))) throw new Error("Unsupported request");
  for (const key of Object.keys(params)) {
    if (!ALLOWED_PARAMS.has(key)) throw new Error("Unsupported request");
    if (params[key]!.length > 120) throw new Error("Unsupported request");
  }
}

function cacheKey(path: string, params: Record<string, string>) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `tmdb:${path}${sorted ? `?${sorted}` : ""}`;
}

const inFlight = new Map<string, Promise<unknown>>();

export async function tmdbCached(
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  assertAllowed(path, params);
  const key = cacheKey(path, params);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const work = (async () => {
    const { admin } = await import("@/lib/bujuu.server");
    const db = await admin();

    const { data: cached } = await db
      .from("media_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return cached.payload;
    }

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) {
      if (cached) return cached.payload; // stale is better than nothing
      throw new Error("Movie data is not configured yet.");
    }

    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", params["language"] ?? "en-US");
    for (const [k, v] of Object.entries(params)) {
      if (k !== "language") url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (cached) return cached.payload; // serve stale on upstream trouble
      throw new Error("Could not load titles right now. Please try again.");
    }
    const payload = (await res.json()) as unknown;

    await db.from("media_cache").upsert(
      {
        cache_key: key,
        payload: payload as never,
        expires_at: new Date(Date.now() + ttlFor(path) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );

    return payload;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, work);
  return work;
}

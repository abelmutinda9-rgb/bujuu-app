&nbsp;

# Phase 1 — Restore bujuu, then inspect (no rebuild)

Your instruction document is clear: inspect first, change nothing, report, stop. One blocker: this project is currently empty — the bujuu app only exists inside the uploaded zip. So Phase 1 here is two steps: put your existing app back into this project exactly as-is, then inspect it and report.

## Step 1 — Restore the existing app (no redesign)

Copy the uploaded project in unchanged: all pages (home, movies, TV, new, genres, search, watch, profile, splash), all components, the logo, the styling, the TMDB and playback code, and the one existing database migration. Nothing renamed, restyled, or re-architected.

Two housekeeping items found in the zip, both safe:

- A duplicated leftover folder (`src/src/...`) holding older copies of a splash screen, an auth pop-up and a "mirrors" file that nothing in the app uses. I will leave the files in place and flag them in the report rather than delete anything during Phase 1.
- The app expects a backend (its database/auth files are present, and it has a migration), so the built-in Lovable Cloud backend must be switched on for the app to run and for the migration to apply. This restores what your project already had; it adds no new features.

## Step 2 — Phase 1 inspection report (then stop)

Delivered in chat, in the sections your document asks for: what exists, what is reusable, what must be added, what must change, required credentials, what you configure vs. what I configure, required Cloudflare resources, required PayHero configuration, required environment variables, plus architecture, security, scalability and free-tier concerns.

Findings already confirmed from reading the zip, which the report will detail:

- No payment code exists. No PayHero, no M-Pesa, no subscription logic, no device authorization, no OTP or recovery, anywhere in the project.
- The KSh 90 / 30-day / all-movies / one-device model is not implemented yet, so it will be built new rather than changed. Get rid of the download stuffs and also don't add any splash page  
- The database currently has exactly one table, holding cached download links. No movie, payment, subscription, device, OTP or audit tables exist.
- Your TMDB key is currently shipped inside the app that runs in people's browsers, meaning it is publicly readable. Movie lists, details and search all call TMDB straight from the browser, with no shared cache, so traffic scales with visitors rather than with titles.
- Playback is third-party embed pages (vidlink, vidsrc, multiembed) chosen in the browser, with a silent 12-second failover between three servers. Nothing checks payment, subscription or device before a movie plays — access is currently open to anyone.
- Downloads are triggered by a hidden frame pointing at another third-party site.
- No Cloudflare R2, no Workers of your own, no Capacitor/Android project, and no image storage exist yet.
- Posters and backdrops are loaded directly from TMDB's image servers, not from your own storage.

I will not implement PayHero, subscriptions, devices, OTP, R2, caching or hardening in this phase. After you approve the report we agree on Phase 2 scope, and your PayHero credentials get saved securely then — not before.

## Technical notes

- Stack in the zip: TanStack Start v1 + React 19 + Vite, Tailwind v4, shadcn/ui, TanStack Query, Supabase client files present (`src/integrations/supabase/*`), one migration creating `public.torrent_cache` with anon read.
- TMDB access lives entirely in `src/services/tmdb.ts` using `VITE_TMDB_API_KEY` (client bundle). Embed selection in `src/services/embed.ts` and `src/services/embeds.ts`, consumed by `src/routes/watch.tsx`.
- Env names present in the zip: `VITE_TMDB_API_KEY`, `VITE_STREAM_BASE_URL`, plus Supabase URL/publishable key/project id. Cloud enablement regenerates the Supabase values; TMDB and stream base URL will be re-supplied, with TMDB moving server-side in Phase 2.
- Phase 2 direction, for the report only: TMDB proxied through server functions with cache → database → TMDB fallback, request de-duplication, 7-day detail cache, R2 for artwork, PayHero STK Push initiation + idempotent callback verified server-side, cryptographically random device credentials, and a server-side gate in front of every playback source.
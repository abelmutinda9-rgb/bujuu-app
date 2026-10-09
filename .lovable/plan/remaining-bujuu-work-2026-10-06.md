# Remaining BUJUU work

Everything that already works stays as it is: referrals, KSh 150 PayHero payments, one-device rule, playback gate, notifications, withdrawals.

## 1. Guests can browse before signing in

- The launch splash stops sending first-time visitors to the sign-in page. Guests can browse Home, Movies, TV, Search and title details.
- Sign-in is only asked for when someone presses Play, My List or Profile.

## 2. My List

- The "My List" buttons on the big banner and on each title's detail panel start working. They toggle between "+ My List" and "In My List".
- A new My List page shows saved titles. Guests who press it are asked to sign in.

## 3. Continue Watching and Watch History

- The player saves your progress every 15 seconds and again when you leave. The embedded players don't share the real position, so progress is estimated from how long you watched.
- Home gets a "Continue Watching" row for signed-in users. TV episodes resume at the last season and episode watched.
- Profile gets a "Watch History" list with a "Clear history" button.

## 4. Fuller Home page

- The banner at the top rotates through trending titles.
- 13 category rows are added (Comedy, Horror, Sci-Fi, Romance, Animation, Crime, Documentary, Thriller, Drama, Family, Top Rated Movies, Top Rated TV, Airing Now). Each row only loads when you scroll near it.

## 5. BUJUU image delivery

- Posters and backgrounds load through BUJUU's own image address instead of loading from TMDB directly. The image files are not stored in the database.

## 6. Security headers

- Standard browser security rules are added to every page, so the site can't be framed by other sites and only trusted sources can load. The six player servers and the payment flow keep working.

## 7. Daily renewal schedule

- The daily renewal and cleanup run is scheduled inside the database at 21:00 UTC (00:00 Nairobi time), using the existing private secret. You don't need to set up anything outside the app.

## Still blocked on you

- **Real M-Pesa withdrawals:** I need either PayHero payout access (payouts turned on plus a funded payout balance) or Safaricom Daraja B2C credentials. Until then, withdrawal requests stay Pending.
- **Google sign-in screen showing BUJUU's name:** needs your own Google Client ID and Secret. Google sign-in already works without them.
- **Android APK / Windows installer files:** these get built outside the app (Android Studio). The download page stays "Coming soon" until those files exist.

## Technical details

- New tables `watchlist`, `playback_progress`, `watch_history`, `user_roles` (with the `app_role` enum and the `has_role` security-definer function). Each table gets GRANTs plus RLS limited to `auth.uid() = user_id`. Reads and writes go through `requireSupabaseAuth` server functions.
- Splash: remove the redirect at Splash.tsx lines 32–34.
- Image proxy: `/api/public/image/$size/$path` with a whitelisted size and path pattern, an immutable cache-control header, and fetching from image.tmdb.org. `posterUrl` and `backdropUrl` switch to this route.
- CSP and other security headers are set in the server entry. `frame-src` is limited to the six providers.
- Cron: pg_cron + pg_net POST to the renew-subscriptions endpoint, with the bearer token read from vault.
- Admin page goes under `_authenticated/admin`. Server functions check `has_role` before reading anything with admin access.
- Not included: DevTools detection (unreliable, and it breaks normal users) and ad-blocking (not possible in a web app).
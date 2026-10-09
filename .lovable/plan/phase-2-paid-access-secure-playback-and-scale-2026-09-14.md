# Phase 2 — Paid access, secure playback, and scale

Phase 1 (restore + report) is done. This phase turns bujuu into a paid, secure app.

## 1. Subscriptions

- One plan: KSh 90, 30 days, all movies, one device at a time.
- Database records: subscribers (phone), subscriptions (start, expiry, status), payments, devices, audit log.
- A subscription is only created after payment is confirmed by the payment provider, never by the app trusting the browser.

## 2. M-Pesa payment via PayHero

- User enters phone number, taps Pay KSh 90, gets the M-Pesa prompt on their phone (STK Push).
- Screen waits and updates itself when payment lands; no manual refresh.
- The provider notifies our own callback address; repeated notifications for the same payment can never double-charge or double-extend.
- Failed, cancelled and timed-out payments are shown clearly and can be retried.
- I will need your PayHero API username, API password and payment channel ID, requested through the secure form at the start of this work, plus the callback address I hand you once the endpoint exists.

## 3. One device per subscription

- On first successful payment the device is registered and holds the subscription.
- Signing in on a new device asks for the phone number and a one-time code, then moves the subscription over and locks out the old device.
- Codes expire quickly and are rate limited.

## 4. Playback gate

- Nothing plays until the server confirms: payment received, subscription active, not expired, correct device.
- The player address is handed out by the server per request, so it can't be shared or reused.

## 5. Movie data served by us

- All movie data moves off the browser and behind our server, so the TMDB key is never visible in the app. I need a **fresh TMDB key** — the current one has been public and should be treated as leaked.
- Lookups go cache first, then our database, then TMDB. Identical simultaneous requests are collapsed into one.
- Detail pages cached 7 days; lists shorter.

## 6. Posters and artwork

- Posters and backdrops are copied into our own Cloudflare R2 storage and served from our CDN, so images stay fast and free of third-party limits.

## 7. Hardening and cleanup

- Rate limits on payment, code and playback requests.
- Audit log of payments, device changes and access grants.
- Profile page buttons (My List, activity, settings, sign out) become real.
- Leftover duplicate `src/src/` folder deleted.

## Order of work

1. Database + secure storage of your PayHero and TMDB values
2. Payment flow end to end (test payment first)
3. Device + code recovery
4. Playback gate
5. Server-side movie data + caching
6. R2 artwork
7. Rate limits, audit log, profile cleanup

## What I need from you

- PayHero API username, API password, payment channel ID
- A fresh TMDB key
- Confirmation that KSh 90 / 30 days / 1 device is final
- Then I want this you to hide every key privately away from our frontend 
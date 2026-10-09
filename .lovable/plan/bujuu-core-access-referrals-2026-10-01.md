# Bujuu — Core access + Referrals

Scope for this round: finish the paid-access system and add referrals. Not in this round: ad blocking, Windows/Android/TV apps, live updates, capacity tools, moving backends.

## What you will get

1. **Browse freely** — anyone can see the catalogue, search and details. Sign-in and payment are only needed to press Play.
2. **Continue with Google** — one button on the existing subscribe/profile screens. Returning users are recognised and their subscription and device load automatically.
3. **KSh 150 for 30 days** via the existing PayHero M-Pesa push (channel 12608). Price set on the server only. Access starts only after PayHero confirms the payment; repeated confirmations never add extra days.
4. **One device per account** — signing in on a new device shows a "move watching here" screen that emails a one-time code. After the code, the old device is locked out (playback stops), the new one works, and the 30 days are not reset.
5. **Posters** — keep using TMDB's image service, with lazy loading, sized images, and a grey placeholder when an image fails. Movie details stay cached in our backend. No image files stored in the database.
6. **Player servers** — exactly 6 servers: vidfast, vidy, vidrock, vidvault, vidsrc.mov, vidzee (7th removed).
7. **Sidebar** always closed until tapped.
8. **Referrals** — each account gets a personal link. A friend who signs up through it and pays is credited to the referrer once (no self-referral, no double credit, reversed if the payment is refunded). A simple "Invite friends" section on the profile page shows the link, share button, and earned rewards.

Existing design, catalogue, cards, search, player and routes stay as they are.

## Technical details

- Copy: subscribe.tsx/profile.tsx → "KSh 150 / 30 days"; PLAN_AMOUNT=150, PLAN_DAYS=30 (replace addMonth with 30-day add in grantSubscription).
- Auth UI: `lovable.auth.signInWithOAuth("google")`, root `onAuthStateChange`, then `syncAccount`. Watch route calls `getStream` (requireSupabaseAuth); deny reasons route to /subscribe or device-transfer screen.
- Device transfer: `supabase.auth.signInWithOtp({ email, shouldCreateUser:false })` + `verifyOtp`; server `recentEmailOtp` + `transferDevice`; rate limits (3 sends/15 min, 5 verifies). Enable email OTP auth.
- DeviceLock: unmount the player iframe when lockedOut; 30 s status polling.
- Callback: validate amount=150 + reference, idempotent by payment status, grant to user-linked subscriber.
- Cron: schedule renew route daily 21:00 UTC; renewals now also KSh 150 / 30 days.
- Images: `loading="lazy"`, `decoding="async"`, w342 cards / w780 detail / w1280 hero, onError placeholder.
- embeds.ts: 6-entry array; SERVER_COUNT=6.
- Referrals migration: `referral_codes(user_id, code unique)`, `referrals(referrer_id, referred_id unique, status pending/qualified/reversed, payment_id unique)`, `referral_ledger(user_id, amount, kind, referral_id)`; RLS read-own; written only by the server in the callback after a verified payment. `/r/$code` route stores the code, applied on first Google sign-in.
- Tests via Playwright + direct callback simulation: new/returning user, success, failure, duplicate webhook, expired, unauthorized device, OTP transfer, OTP abuse, referral credit once.

## Needed from you
- A live M-Pesa test on your phone at the end (KSh 150).
- Referral reward amount (default: KSh 30 credit per paying friend, paid out manually).

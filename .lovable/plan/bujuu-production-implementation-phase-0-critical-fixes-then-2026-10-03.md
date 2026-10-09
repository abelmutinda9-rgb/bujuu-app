# BUJUU Production Implementation — Phase 0 (Critical fixes), then Phase 1

Your document asks for the work to be done one phase at a time, with a build and test after each. This plan covers Phase 0 in full and Phase 1 next. Phases 2–7 come in later rounds, each with its own plan.

## Phase 0 — Critical fixes

1. **Login no longer accepts unregistered accounts by mistake**
  - The login page stops sending you onward just because an older sign-in is still saved in the browser.
  - If you are already signed in, the page shows "Signed in as [email]" with two buttons: "Continue" and "Sign out".
  - Pressing Login only lets you in if that exact attempt succeeds. Otherwise you stay on the page and see "Invalid email or password." No account, profile or device is created.
  - Sign-up happens only on the Sign up tab. A failed login never creates an account.
2. **Sign out works everywhere**
  - The header menu's "Sign out" (currently does nothing) and the Profile page's sign-out both run the same full sign-out.
  - Full sign-out means: end the session, clear saved app data, check that no session is left, show "Signed out.", then go to the login page.
  - Your subscription, device and payment records are kept.
3. **Google sign-in**
  - Google sign-in switches to the app's own sign-in system, not the Lovable wrapper (see the important note below).
  - After signing in with Google, you return to the page you were on before. Only links inside BUJUU are allowed as return pages.
4. **Login screen and splash**
  - Check the login screen and splash screen on phone, tablet, desktop and TV sizes.
  - Only fix things that look broken. No redesign.
5. **Six video servers**: check that all six still load a sample movie and episode.
6. **Security fixes**: confirm playback is still blocked on the server when you are signed out, unpaid or on a replaced device, including if someone opens /watch directly or edits browser storage.
7. **Test the full 10-case login checklist** from your document and report each case as TEST | EXPECTED | ACTUAL | PASS/FAIL.

### Important: Google sign-in needs your own Google keys

Right now Google sign-in only works because of the Lovable-managed wrapper. If the wrapper is removed, Google sign-in stops working until you create your own Google sign-in keys and add them in the backend settings (Users → Auth Settings → Google).

- **Default:** switch the code now and give you step-by-step instructions to get the keys. Google sign-in will show an error until you add them.
- **Alternative:** keep the wrapper until you have the keys. Say if you prefer this.

## Phase 1 — Viewing features (after Phase 0 passes)

- **Continue Watching row** on Home, saving how far you got in each movie or episode.
- **Watch History** on the Profile page.
- **My List**: add or remove titles with a button on each title page, plus a My List page.
- **Notifications**: the bell shows real alerts, such as payment confirmed, device replaced or subscription ending soon.
- Each user can only see their own data.

## Later phases (separate plans)

- Phase 2: Admin panel
- Phase 3: Doomsday event and seasonal themes
- Phase 4: Hardening — image proxy, security headers, short-lived playback links, renewal schedule
- Phase 5: Native apps — Android, TV, Windows
- Phase 6: Ad filtering in native apps only (not possible on the website)
- Phase 7: Download page and updates

## Technical details

- New `src/lib/auth.ts` exports `signOutSession(queryClient, navigate)`. It runs `supabase.auth.signOut()`, then `queryClient.cancelQueries()` and `clear()`, removes the `bujuu.after` value, checks `getSession()` (falling back to `signOut({scope:"local"})`), shows a toast and does a `navigate({to:"/auth", replace:true})`. Used by `Header.tsx` and `profile.tsx`.
- `auth.tsx`:
  - Remove the passive `getUser()` and `onAuthStateChange` navigation.
  - Add a banner for an existing session.
  - `submit()` navigates only when this request returns `data.session`.
  - For Google OAuth, the return path is `safePath(sessionStorage["bujuu.after"])`, read once the session is confirmed.
- `GoogleButton.tsx` and `auth.tsx` call `supabase.auth.signInWithOAuth({provider:"google", options:{redirectTo: origin + "/auth"}})`. Delete `src/integrations/lovable` only if the default option is chosen.
- New Phase 1 tables: `playback_progress`, `watch_history`, `watchlist`, `notifications`. Each gets GRANTs and RLS limited to `auth.uid() = user_id`. Reads and writes go through `requireSupabaseAuth` server functions. Existing tables stay unchanged.
- Progress is saved from the player every 15s and on exit. Embedded players don't report their position, so progress is estimated from watch time.  
Add an animated hero billboard, 13 expanded catalog categories, and client-side data resolution logic to the existing web application.
  1. ANIMATED HERO BILLBOARD (NETFLIX STYLE)
  At the top of the main home view (above the category rows), build a full-width featured media billboard:
  Data Source: Query TMDB /trending/all/day?page=1 to fetch top trending items.
  Auto-Rotation & Transitions:
  Auto-rotate through the top 5 featured items every 7 seconds.
  Pause timer on hover or focus; resume on mouse leave.
  Apply a smooth 800ms cross-fade transition (opacity + subtle scale(1.05) zoom) between backdrop images.
  Visual Elements:
  Background Backdrop: High-resolution backdrop image ([[https://image.tmdb.org/t/p/original/](https://image.tmdb.org/t/p/original/){backdrop_path}](https://image.tmdb.org/t/p/original/](https://image.tmdb.org/t/p/original/){backdrop_path})) with a bottom-to-top dark gradient overlay (bg-gradient-to-t from-background via-background/60 to-transparent).
  Content Overlay: Placed over the bottom-left of the image:
  Title logo or large bold title heading.
  Metadata row: Release Year, Content Rating (PG-13/TV-MA), Duration/Seasons, HD/4K badge, TMDB Score.
  Synopsis (truncated to 3 lines maximum).
  Action Buttons: Primary [Play Now] button and Secondary [Save Offline ↓] button.
  Indicator Controls: Render subtle dot indicators or small progress bars at the bottom right indicating the active slide.
  2. EXPANDED CATEGORIES (13 SECTIONS)
  Render horizontal scrolling media rows below the Hero Billboard using TMDB API endpoints (/discover/movie & /discover/tv):
  Action & Adventure: /discover/movie & /discover/tv → with_genres=28,12,10759&sort_by=popularity.desc
  Anime & Animation: with_genres=16&with_keywords=210024&sort_by=popularity.desc
  K-Dramas: with_original_language=ko&with_genres=18&sort_by=popularity.desc
  Sci-Fi & Fantasy: with_genres=878,14,10765&sort_by=popularity.desc
  Thriller & Mystery: with_genres=53,9648&sort_by=popularity.desc
  Crime & True Crime: with_genres=80&with_keywords=9882&sort_by=popularity.desc
  Horror: with_genres=27&sort_by=popularity.desc
  Documentaries: with_genres=99&sort_by=popularity.desc
  Reality Shows: with_genres=10764&sort_by=popularity.desc
  Stand-Up Comedy: with_genres=35&with_keywords=9716&sort_by=popularity.desc
  Family & Kids: with_genres=10751,10762&sort_by=popularity.desc
  Drama & Romance: with_genres=18,10749&sort_by=popularity.desc
  Drama Shows: /discover/tv → with_genres=18&sort_by=popularity.desc
  Row Specifications:
  Each row displays a section title, a horizontal card slider, and a "See All" button.
  Implement lazy loading via IntersectionObserver to load row data only when entering the viewport.
  &nbsp;
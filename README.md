# Bujuu Media Hub

Build the global layout and color system based on KNOWLEDGE.md.



Set the application background to pure black (#000000).



Create a responsive top header bar:



Left side: Red logo title #E50914.



Right side: Search button icon, Notifications icon, and User Profile avatar dropdown.



Add glassmorphic blur on scroll (backdrop-blur-md bg-black/60).



Create a bottom navigation bar fixed on mobile viewports containing: Home, Search, New & Hot, Downloads, and My Profile.



Add CSS media queries so that on desktop and TV viewports (min-width: 1024px), the bottom navigation bar turns into a collapsible left side menu."



Create the main Home Screen component (/src/pages/Index.tsx):



Hero Banner:



Full-width cover displaying a backdrop image with a bottom gradient fade into pure black.



Display title, category tags (e.g., 'Action • Sci-Fi'), and two primary buttons: 'Play' (solid white button) and 'My List' (translucent gray button).



Media Rows:



Build a reusable MediaRow component with horizontal touch-swipe snapping (snap-x).



Add rows for: 'Trending Now', 'Top 10 Movies Today' (with large numbered rank badges 1–10 overlapping cards on the left), and 'Popular Action'."

Build the detail view when a user taps a card and connect TMDB API endpoints:



On mobile viewports, tapping a media card opens an iOS bottom drawer sheet (Shadcn Drawer). On desktop/TV viewports, it opens a centered modal (Shadcn Dialog).



Show metadata badges: Match Percentage (e.g., '98% Match'), Year, Age Rating ('TV-MA'), Duration, and HD/4K badges.



Add dynamic fetchers (/src/services/tmdb.ts) using TanStack Query reading from import.meta.env.VITE_TMDB_API_KEY to load live trending movies and details into all rows."



Build a dedicated video playback page (/src/pages/Watch.tsx):



Read tmdbId, mediaType (movie or tv), season, and episode from URL query parameters.



Build a full-screen #000000 view with a red spinning activity indicator (Loader2) and text: 'Connecting secure stream...'.



Construct a dynamic video URL using the environment variable string ${import.meta.env.VITE_STREAM_BASE_URL}/${mediaType}/${tmdbId}.



Render an HTML5 <iframe> taking 100% height and width with allow="fullscreen; autoplay" permissions.



Keep the iframe opacity at 0 until the iframe fires an onLoad event, then transition opacity to 1 and hide the loading overlay. Include a floating back button in the top left corner."

But it should be called bujuu   and the colors should be black and white or grey




Continue developing this project in the [Lovable editor](https://lovable.dev/projects/148340a5-ec3c-4701-9a93-af8bcf024d2f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

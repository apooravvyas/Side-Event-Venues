/* ─────────────────────────────────────────────────────────────
   SIDEQUEST — configuration
   ─────────────────────────────────────────────────────────────
   PLACES_API_KEY unlocks real photography for all 42 venues.

   How to create it (5 minutes, free tier covers this traffic):
   1. console.cloud.google.com → create/pick a project
   2. APIs & Services → Library → enable "Places API (New)"
   3. Credentials → Create credentials → API key
   4. Edit the key → Application restrictions → Websites →
      add:  https://side-event-venues.vercel.app/*
            http://localhost:8000 (for local testing)
   5. API restrictions → Restrict key → Places API (New)
   6. Paste the key below and redeploy.

   The key is referrer-restricted, so it only works from your own
   domain — safe to keep in a public repo. Results are cached in
   the visitor's browser for 30 days, so repeat views cost nothing.

   Leave it empty and the app falls back to typographic panels.
   ───────────────────────────────────────────────────────────── */

window.SIDEQUEST_CONFIG = {
  PLACES_API_KEY: "",
  PHOTO_CACHE_DAYS: 30,
  MAX_PHOTOS_PER_VENUE: 4,
};

# SIDEQUEST — Find the right room.

Mumbai's side-event map for India Blockchain Week (Nov 1–2, Fairmont Mumbai) and
Devcon 8 (Nov 3–6, Jio World Centre). 42 venues scored for eventability, with the
evidence behind every score.

## Deploy in 60 seconds (no coding)

**Netlify (easiest)**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder (or the `sidequest.zip`) onto the page.
3. You get a live URL immediately. Rename the site in Site settings → Change site name.

**Vercel**
1. Go to https://vercel.com/new → "Deploy without Git" is not offered anymore for zips,
   so use Netlify Drop, or install the Vercel CLI and run `vercel` inside this folder.

**Custom domain** — both services let you add a domain (e.g. sidequest.indiablockchainweek.com)
in the site settings.

The app is fully static: `index.html`, `css/`, `js/`, `data/`. There is no build step,
no API keys and no server. The map tiles come from CARTO's free dark basemap.

## Add or edit a venue (no code changes needed)

Open `data/venues.json` and copy an existing venue object. Fields:

| field | meaning |
|---|---|
| `id` | url-safe slug, unique (used in deep links `?v=slug`) |
| `name`, `address`, `lat`, `lng` | copy coordinates from Google Maps (right-click → copy) |
| `cat` | one of `hotel`, `restaurant`, `bar`, `rooftop`, `cafe`, `sports`, `creative`, `cowork` |
| `area` | one of `sahar`, `powai`, `santacruz`, `bkc`, `bandra`, `juhu`, `parel`, `east` |
| `types` | which event types it surfaces for: `mixer`, `party`, `dinner`, `workshop`, `hackathon`, `panel`, `builder`, `sports`, `creative`, `afterparty` |
| `tagline` | one line shown in the list |
| `summary` | the opinionated paragraph in the analysis box |
| `scores` | 0–5 per factor (steps of 0.5). Use `null` when unknown — never guess |
| `overall` | 0–10; average of the ten factors ×2 with unknowns counted as 3.0 |
| `confidence` | `high` / `medium` / `low` |
| `bestFor` | short tags |
| `formats.good` / `formats.bad` | explicit recommendations |
| `facts` | capacity, privateBooking, outdoor, alcohol, food, wifi, av, lateHours, parking, accessibility — write "Unknown" if unknown |
| `evidence` | list of `{ "text": ..., "source": ... }` — every claim needs one |
| `pastEvents` | verified events only |
| `links` | `website`, `instagram`, `maps` (use `null` if none) |
| `photo` | `null` or `{ "url", "page", "credit", "license" }` — only use photos you have rights to |

Area cards, event types, category colours and the format-pattern table live in
`data/areas.json`.

## Deep links

Every state is in the URL and safe to share on X / Telegram / WhatsApp:

- `?v=olive-bar-kitchen` — opens a venue
- `?type=afterparty` — event type
- `?cat=rooftop&area=parel` — category + area
- `?near=ibw` — venues within 6 km of Fairmont
- `?q=padel` — search

## Photos

Seven landmark venues use Wikimedia Commons photos under CC licences; each panel shows
the credit and links to the file page (required by the licence). Everything else shows a
styled placeholder until you add venue-approved photography to `photo`.

## Data integrity

Coordinates and addresses: Google Maps. Capacities and specs: venue websites, Cvent,
event-listing platforms. Scores are editorial judgements on the listed evidence; unknown
stays unknown. Confirm with the venue before committing budget.

Data generated 2 September 2026.

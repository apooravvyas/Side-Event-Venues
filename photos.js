/* SIDEQUEST — venue photography.
   Order of preference per venue:
   1. Verified Creative Commons photos shipped in venues.json
   2. Google Places Photos (needs PLACES_API_KEY in data/config.js)
   3. Typographic panel (no photo invented, ever)

   Places results are cached in localStorage so a returning visitor
   costs nothing. Photo author attribution is always rendered. */

window.Photos = (function () {
  const CFG = window.SIDEQUEST_CONFIG || {};
  const KEY = (CFG.PLACES_API_KEY || "").trim();
  const TTL = (CFG.PHOTO_CACHE_DAYS || 30) * 864e5;
  const MAX = CFG.MAX_PHOTOS_PER_VENUE || 4;
  const CACHE = "sq_photos_v1:";
  const mem = new Map();

  const enabled = () => KEY.length > 10;

  function readCache(id) {
    try {
      const raw = localStorage.getItem(CACHE + id);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() - o.t > TTL) { localStorage.removeItem(CACHE + id); return null; }
      return o.p;
    } catch (e) { return null; }
  }
  function writeCache(id, p) {
    try { localStorage.setItem(CACHE + id, JSON.stringify({ t: Date.now(), p })); } catch (e) {}
  }

  function mediaURL(name, w) {
    return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&key=${encodeURIComponent(KEY)}`;
  }

  async function fromPlaces(v) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
      },
      body: JSON.stringify({ textQuery: v.placeQuery || `${v.name}, Mumbai`, maxResultCount: 1, languageCode: "en" }),
    });
    if (!res.ok) throw new Error("places " + res.status);
    const d = await res.json();
    const p = d.places && d.places[0];
    if (!p || !p.photos) return [];
    // Guard against a same-name venue in another city: the returned
    // place must sit within ~2 km of the coordinates we researched.
    if (p.location) {
      const dLat = p.location.latitude - v.lat, dLng = p.location.longitude - v.lng;
      const km = Math.sqrt((dLat * 111) ** 2 + (dLng * 105) ** 2);
      if (km > 2) { console.warn("Places match too far for", v.id, km.toFixed(1) + "km"); return []; }
    }
    return p.photos.slice(0, MAX).map((ph) => ({
      url: mediaURL(ph.name, 1200),
      page: (ph.authorAttributions && ph.authorAttributions[0] && ph.authorAttributions[0].uri) || null,
      credit: (ph.authorAttributions && ph.authorAttributions[0] && ph.authorAttributions[0].displayName) || "Google user",
      license: "via Google Places",
    }));
  }

  /* Returns {photos:[], source:'cc'|'places'|'none'} — never throws. */
  async function get(v) {
    if (v.photos && v.photos.length) return { photos: v.photos, source: "cc" };
    if (!enabled()) return { photos: [], source: "none" };
    if (mem.has(v.id)) return { photos: mem.get(v.id), source: "places" };
    const cached = readCache(v.id);
    if (cached) { mem.set(v.id, cached); return { photos: cached, source: "places" }; }
    try {
      const p = await fromPlaces(v);
      mem.set(v.id, p); writeCache(v.id, p);
      return { photos: p, source: p.length ? "places" : "none" };
    } catch (e) {
      console.warn("Photo lookup failed for", v.id, e.message);
      return { photos: [], source: "none" };
    }
  }

  return { get, enabled };
})();

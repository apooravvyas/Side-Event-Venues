/* SIDEQUEST — Find the right room. */
(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const [vRes, aRes] = await Promise.all([fetch("data/venues.json"), fetch("data/areas.json")]);
  const DATA = await vRes.json();
  const META = await aRes.json();
  const VENUES = DATA.venues;
  const CAT = Object.fromEntries(META.categories.map((c) => [c.id, c]));
  const AREA = Object.fromEntries(META.areas.map((a) => [a.id, a]));
  const TYPE = Object.fromEntries(META.eventTypes.map((t) => [t.id, t]));
  const ANCH = Object.fromEntries(META.anchors.map((a) => [a.id, a]));

  // ---------- distances ----------
  const R = 6371;
  const hav = (a, b, c, d) => {
    const toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(c - a), dLng = toR(d - b);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  VENUES.forEach((v) => {
    v.dist = {};
    META.anchors.forEach((a) => (v.dist[a.id] = hav(v.lat, v.lng, a.lat, a.lng)));
    v.search = [v.name, v.tagline, v.summary, AREA[v.area]?.name, CAT[v.cat]?.label, ...(v.bestFor || []), ...(v.types || []).map((t) => TYPE[t]?.label)].join(" ").toLowerCase();
  });
  const fmtKm = (k) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1)} km`);

  // ---------- state & URL ----------
  const state = { type: null, cat: null, area: "", near: "", q: "", sort: "score", venue: null };
  const readURL = () => {
    const p = new URLSearchParams(location.search);
    state.type = TYPE[p.get("type")] ? p.get("type") : null;
    state.cat = CAT[p.get("cat")] ? p.get("cat") : null;
    state.area = AREA[p.get("area")] ? p.get("area") : "";
    state.near = ANCH[p.get("near")] ? p.get("near") : "";
    state.q = p.get("q") || "";
    state.sort = ["score", "ibw", "devcon", "name"].includes(p.get("sort")) ? p.get("sort") : "score";
    state.venue = VENUES.find((v) => v.id === p.get("v")) ? p.get("v") : null;
  };
  const writeURL = (push = false) => {
    const p = new URLSearchParams();
    if (state.type) p.set("type", state.type);
    if (state.cat) p.set("cat", state.cat);
    if (state.area) p.set("area", state.area);
    if (state.near) p.set("near", state.near);
    if (state.q) p.set("q", state.q);
    if (state.sort !== "score") p.set("sort", state.sort);
    if (state.venue) p.set("v", state.venue);
    const url = location.pathname + (p.toString() ? "?" + p : "") + (landingOpen ? "" : "");
    (push ? history.pushState : history.replaceState).call(history, null, "", url);
  };

  // ---------- map ----------
  const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: [72.862, 19.06],
    zoom: 11.6,
    minZoom: 9.5,
    maxZoom: 17.5,
    attributionControl: { compact: true },
    pitchWithRotate: false,
    dragRotate: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.touchZoomRotate.disableRotation();

  const circlePoly = (lng, lat, km, n = 96) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const dx = (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(t);
      const dy = (km / 110.574) * Math.sin(t);
      pts.push([lng + dx, lat + dy]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
  };

  map.on("load", () => {
    // Mute the basemap further so venue markers and rings lead.
    const layers = map.getStyle().layers;
    layers.forEach((l) => {
      if (l.type === "symbol") {
        try { map.setPaintProperty(l.id, "text-color", "#6e685d"); map.setPaintProperty(l.id, "text-halo-color", "#0c0c0d"); } catch (e) {}
      }
      if (l.type === "line" && /road|street|highway|motorway|rail/i.test(l.id)) {
        try { map.setPaintProperty(l.id, "line-opacity", 0.55); } catch (e) {}
      }
    });
    const rings = { type: "FeatureCollection", features: META.anchors.map((a) => ({ ...circlePoly(a.lng, a.lat, a.radiusKm), properties: { id: a.id } })) };
    map.addSource("rings", { type: "geojson", data: rings });
    map.addLayer({ id: "rings-fill", type: "fill", source: "rings", paint: { "fill-color": ["match", ["get", "id"], "ibw", "#E0B75B", "#7FC4D6"], "fill-opacity": 0.045 } });
    map.addLayer({ id: "rings-line", type: "line", source: "rings", paint: { "line-color": ["match", ["get", "id"], "ibw", "#E0B75B", "#7FC4D6"], "line-width": 1.2, "line-dasharray": [3, 3], "line-opacity": 0.7 } });
    // Connector between anchors
    map.addSource("axis", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: META.anchors.map((a) => [a.lng, a.lat]) } } });
    map.addLayer({ id: "axis", type: "line", source: "axis", paint: { "line-color": "#efe8da", "line-width": 1, "line-opacity": 0.18, "line-dasharray": [1, 4] } });
  });

  META.anchors.forEach((a) => {
    const el = document.createElement("div");
    el.className = "anchor-mk";
    el.style.setProperty("--c", a.id === "ibw" ? "#E0B75B" : "#7FC4D6");
    el.innerHTML = `<div class="ring"></div><div class="core"></div><div class="alabel"><b>${esc(a.label)} · ${esc(a.dates)}</b>${esc(a.venue)}</div>`;
    new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([a.lng, a.lat]).addTo(map);
  });

  const markers = {};
  VENUES.forEach((v) => {
    const el = document.createElement("div");
    el.className = "mk";
    el.style.setProperty("--c", CAT[v.cat].color);
    el.innerHTML = `<div class="pin"></div><div class="lbl">${esc(v.name)}${v.overall != null ? `<b>${v.overall.toFixed(1)}</b>` : ""}</div>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); openVenue(v.id, true); });
    el.addEventListener("mouseenter", () => hover(v.id, true));
    el.addEventListener("mouseleave", () => hover(v.id, false));
    markers[v.id] = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map);
  });

  // ---------- filters ----------
  function filtered() {
    let list = VENUES.filter((v) =>
      (!state.type || v.types.includes(state.type)) &&
      (!state.cat || v.cat === state.cat) &&
      (!state.area || v.area === state.area) &&
      (!state.q || v.search.includes(state.q.toLowerCase()))
    );
    if (state.near) list = list.filter((v) => v.dist[state.near] <= 6);
    const s = state.sort;
    list.sort((a, b) =>
      s === "name" ? a.name.localeCompare(b.name) :
      s === "ibw" || s === "devcon" ? a.dist[s] - b.dist[s] :
      (b.overall ?? -1) - (a.overall ?? -1)
    );
    return list;
  }

  function renderChips() {
    const tc = $("#typeChips");
    tc.innerHTML = META.eventTypes.map((t) => {
      const n = VENUES.filter((v) => v.types.includes(t.id)).length;
      return `<button class="chip" data-type="${t.id}" aria-pressed="${state.type === t.id}">${t.emoji} ${esc(t.label)} <span class="chip-count">${n}</span></button>`;
    }).join("");
    const cc = $("#catChips");
    cc.innerHTML = META.categories.map((c) => {
      const n = VENUES.filter((v) => v.cat === c.id).length;
      return `<button class="chip" data-cat="${c.id}" style="--c:${c.color}" aria-pressed="${state.cat === c.id}"><span class="dot"></span>${esc(c.label)} <span class="chip-count">${n}</span></button>`;
    }).join("");
    $("#areaSelect").value = state.area;
    $("#nearSelect").value = state.near;
    $("#sortSelect").value = state.sort;
    $("#search").value = state.q;
    $("#clearFilters").hidden = !(state.type || state.cat || state.area || state.near || state.q);
  }

  function renderList() {
    const list = filtered();
    $("#resultCount").textContent = `${list.length} venue${list.length === 1 ? "" : "s"}`;
    const ol = $("#venueList");
    if (!list.length) {
      ol.innerHTML = `<li class="empty"><b>No venue matches that combination.</b>Try widening the area, or clear the "Near" filter — Lower Parel and Bandra venues sit outside the 6 km radius.</li>`;
    } else {
      ol.innerHTML = list.map((v) => `
        <li class="venue-row${state.venue === v.id ? " is-active" : ""}" data-id="${v.id}" style="--c:${CAT[v.cat].color}" tabindex="0" role="button">
          <div class="vname"><span class="dot"></span>${esc(v.name)}</div>
          <div class="score${v.overall == null ? " is-unknown" : ""}">${v.overall == null ? "—" : v.overall.toFixed(1)}<small>${esc(v.confidence)} conf.</small></div>
          <div class="vmeta">${esc(AREA[v.area]?.name || "")} · ${fmtKm(v.dist.ibw)} to IBW · ${fmtKm(v.dist.devcon)} to Devcon</div>
          <div class="vtag">${esc(v.tagline)}</div>
        </li>`).join("");
    }
    const ids = new Set(list.map((v) => v.id));
    VENUES.forEach((v) => markers[v.id].getElement().classList.toggle("is-dim", !ids.has(v.id)));
    return list;
  }

  function fitTo(list, pad = 60) {
    if (!list.length) return;
    const b = new maplibregl.LngLatBounds();
    list.forEach((v) => b.extend([v.lng, v.lat]));
    const isMobile = matchMedia("(max-width:860px)").matches;
    map.fitBounds(b, { padding: isMobile ? { top: 90, bottom: window.innerHeight * 0.5, left: 30, right: 30 } : { top: 80, bottom: 80, left: pad, right: 100 }, maxZoom: 14.5, duration: 700 });
  }

  function applyFilters({ fit = true } = {}) {
    renderChips();
    const list = renderList();
    writeURL();
    if (fit && !landingOpen) fitTo(list);
  }

  // ---------- hover ----------
  function hover(id, on) {
    markers[id]?.getElement().classList.toggle("is-hover", on);
    $(`.venue-row[data-id="${id}"]`)?.classList.toggle("is-hover", on);
  }

  // ---------- detail ----------
  const factKeys = [["capacity", "Capacity"], ["privateBooking", "Private booking"], ["outdoor", "Outdoor space"], ["alcohol", "Alcohol"], ["food", "Food"], ["wifi", "Wi-Fi"], ["av", "AV"], ["lateHours", "Late hours"], ["parking", "Parking"], ["accessibility", "Accessibility"]];

  function openVenue(id, push) {
    const v = VENUES.find((x) => x.id === id);
    if (!v) return;
    state.venue = id;
    closeLanding(false);
    const d = $("#detail");
    const c = CAT[v.cat];
    const known = Object.entries(v.scores).filter(([, s]) => s != null).length;
    const initials = v.name.replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
    const photo = v.photo
      ? `<img src="${esc(v.photo.url)}" alt="${esc(v.name)}" loading="lazy"><span class="credit">Photo: <a href="${esc(v.photo.page)}" target="_blank" rel="noopener">${esc(v.photo.credit)}</a> · ${esc(v.photo.license)}</span>`
      : `<div class="ph"><span>${esc(initials)}</span><small>No verified photo yet — see Instagram &amp; Maps below.</small></div>`;

    d.innerHTML = `
      <div class="detail-top">
        <button class="back" id="back">← All venues</button>
        <button class="share" id="share">Copy link</button>
      </div>
      <div class="hero" style="--c:${c.color}">${photo}<span class="cat-badge"><i></i>${esc(c.label)}</span></div>
      <div class="dbody">
        <h2 class="dname">${esc(v.name)}</h2>
        <p class="dsub">${esc(AREA[v.area]?.name || "")} · ${esc(AREA[v.area]?.role || "")}<span class="addr">${esc(v.address)}</span></p>
        <div class="ddist">
          <span style="--c:#E0B75B"><i></i><b>${fmtKm(v.dist.ibw)}</b> from Fairmont (IBW)</span>
          <span style="--c:#7FC4D6"><i></i><b>${fmtKm(v.dist.devcon)}</b> from Jio World Centre (Devcon)</span>
        </div>
        <p class="dtag">${esc(v.tagline)}</p>

        <section class="analysis">
          <div class="analysis-head">
            <h3>EVENTABILITY ANALYSIS</h3>
            <div class="big-score">${v.overall == null ? "—" : v.overall.toFixed(1)}<small> / 10</small></div>
          </div>
          <span class="conf ${esc(v.confidence)}">${esc(v.confidence.toUpperCase())} CONFIDENCE · ${known}/10 factors assessed${known < 10 ? " · unknowns counted neutral" : ""}</span>
          <p>${esc(v.summary)}</p>
          <div class="rails">
            ${Object.entries(v.scores).map(([k, s]) => `
              <div class="rail${s == null ? " is-unknown" : ""}">
                <span class="rl">${esc(META.factorLabels[k])}</span>
                <span class="track"><span class="fill" data-w="${s == null ? 0 : (s / 5) * 100}"></span></span>
                <span class="rv">${s == null ? "?" : s.toFixed(1)}</span>
              </div>`).join("")}
          </div>
        </section>

        <section class="dsec"><h3>BEST FOR</h3><div class="tags">${v.bestFor.map((b) => `<span class="tag">${esc(b.toUpperCase())}</span>`).join("")}</div></section>

        <section class="dsec"><h3>EVENT FORMATS</h3>
          <div class="formats">
            <div><h4>Works well</h4><ul>${v.formats.good.map((f) => `<li class="ok">${esc(f)}</li>`).join("")}</ul></div>
            <div><h4>Not ideal for</h4><ul>${v.formats.bad.map((f) => `<li class="no">${esc(f)}</li>`).join("")}</ul></div>
          </div>
        </section>

        <section class="dsec"><h3>VENUE FACTS</h3>
          <div class="facts">${factKeys.map(([k, l]) => {
            const val = v.facts[k] || "Unknown";
            return `<div class="fact${/^unknown/i.test(val) ? " is-unknown" : ""}"><b>${l}</b><span>${esc(val)}</span></div>`;
          }).join("")}</div>
        </section>

        <section class="dsec"><h3>EVIDENCE REVIEWED</h3>
          <ul class="evidence" id="evList">${v.evidence.map((e, i) => `<li${i >= 3 ? " hidden" : ""}>${esc(e.text)}<span class="src">${esc(e.source)}</span></li>`).join("")}</ul>
          ${v.evidence.length > 3 ? `<button class="more" id="moreEv">View all ${v.evidence.length} evidence points</button>` : ""}
        </section>

        ${v.pastEvents?.length ? `<section class="dsec"><h3>EVENTS HOSTED HERE</h3><ul class="past">${v.pastEvents.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>` : ""}

        <section class="dsec"><h3>LINKS</h3><div class="links">
          ${v.links.website ? `<a href="${esc(v.links.website)}" target="_blank" rel="noopener">Website ↗</a>` : ""}
          ${v.links.instagram ? `<a href="${esc(v.links.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>` : ""}
          <a href="${esc(v.links.maps)}" target="_blank" rel="noopener">Google Maps ↗</a>
        </div></section>

        <p class="dfoot">Scores are editorial judgements based on the evidence listed. Capacities and policies change — confirm with the venue before committing budget. Data generated ${esc(DATA.generated)}.</p>
      </div>`;
    d.hidden = false;
    d.scrollTop = 0;
    $(".app").classList.add("has-detail");
    setTimeout(() => map.resize(), 240);
    requestAnimationFrame(() => $$(".fill", d).forEach((f) => (f.style.width = f.dataset.w + "%")));

    $("#back", d).onclick = () => closeVenue(true);
    $("#share", d).onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href); }
    };
    $("#moreEv", d)?.addEventListener("click", (e) => { $$("#evList li", d).forEach((li) => (li.hidden = false)); e.target.remove(); });

    $$(".venue-row").forEach((r) => r.classList.toggle("is-active", r.dataset.id === id));
    Object.values(markers).forEach((m) => m.getElement().classList.remove("is-active"));
    markers[id].getElement().classList.add("is-active");
    const isMobile = matchMedia("(max-width:860px)").matches;
    map.easeTo({ center: [v.lng, v.lat], zoom: Math.max(map.getZoom(), 14), offset: isMobile ? [0, -window.innerHeight * 0.18] : [0, 0], duration: 700 });
    if (isMobile) setSheet("full");
    writeURL(push);
  }

  function closeVenue(push) {
    state.venue = null;
    $("#detail").hidden = true;
    $(".app").classList.remove("has-detail");
    setTimeout(() => map.resize(), 240);
    $$(".venue-row").forEach((r) => r.classList.remove("is-active"));
    Object.values(markers).forEach((m) => m.getElement().classList.remove("is-active"));
    writeURL(push);
    if (matchMedia("(max-width:860px)").matches) setSheet("half");
  }

  // ---------- landing ----------
  let landingOpen = true;
  function closeLanding(fit = true) {
    if (!landingOpen) return;
    landingOpen = false;
    $("#landing").classList.add("is-hidden");
    if (fit) fitTo(filtered());
  }
  function renderLanding() {
    $("#landingTypes").innerHTML = META.eventTypes.map((t) => `<button class="chip" data-type="${t.id}">${t.emoji} ${esc(t.label)}</button>`).join("");
    $("#landingAreas").innerHTML = META.areas.map((a) => `
      <button class="area-card" data-area="${a.id}"><span class="role">${esc(a.role.toUpperCase())}</span><span class="an">${esc(a.name)}</span><p>${esc(a.blurb)}</p></button>`).join("");
    $("#patterns").innerHTML = `<tr><th>Format</th><th>Size</th><th>Mumbai equivalents</th></tr>` + META.patterns.map((p) => `<tr><td>${esc(p.format)}</td><td>${esc(p.size)}</td><td>${esc(p.mumbai)}</td></tr>`).join("");
    $("#areaSelect").innerHTML += META.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  }
  function renderLegend() {
    $("#legend").innerHTML = META.categories.map((c) => `<span style="--c:${c.color}"><i></i>${esc(c.label)}</span>`).join("") + `<span style="--c:#E0B75B"><i></i>IBW anchor · 3 km ring</span><span style="--c:#7FC4D6"><i></i>Devcon anchor · 3 km ring</span>`;
  }

  // ---------- mobile sheet ----------
  function setSheet(mode) {
    const sb = $("#sidebar");
    sb.classList.remove("is-peek", "is-full");
    if (mode === "peek") sb.classList.add("is-peek");
    if (mode === "full") sb.classList.add("is-full");
  }
  $("#sheetHandle").addEventListener("click", () => {
    const sb = $("#sidebar");
    setSheet(sb.classList.contains("is-full") ? "peek" : sb.classList.contains("is-peek") ? "half" : "full");
  });

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-type]");
    if (t) { state.type = state.type === t.dataset.type && !t.closest("#landingTypes") ? null : t.dataset.type; closeLanding(false); applyFilters(); return; }
    const c = e.target.closest("[data-cat]");
    if (c) { state.cat = state.cat === c.dataset.cat ? null : c.dataset.cat; applyFilters(); return; }
    const a = e.target.closest("[data-area]");
    if (a) { state.area = a.dataset.area; closeLanding(false); applyFilters({ fit: false }); const ar = AREA[a.dataset.area]; map.flyTo({ center: [ar.lng, ar.lat], zoom: ar.zoom, duration: 900 }); return; }
    const row = e.target.closest(".venue-row");
    if (row) { openVenue(row.dataset.id, true); return; }
    const an = e.target.closest("[data-anchor]");
    if (an) { const x = ANCH[an.dataset.anchor]; closeLanding(false); map.flyTo({ center: [x.lng, x.lat], zoom: 13.6, duration: 900 }); return; }
  });
  $("#venueList").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.classList.contains("venue-row")) openVenue(e.target.dataset.id, true); });
  $("#venueList").addEventListener("mouseover", (e) => { const r = e.target.closest(".venue-row"); if (r) hover(r.dataset.id, true); });
  $("#venueList").addEventListener("mouseout", (e) => { const r = e.target.closest(".venue-row"); if (r) hover(r.dataset.id, false); });
  $("#areaSelect").addEventListener("change", (e) => { state.area = e.target.value; applyFilters(); });
  $("#nearSelect").addEventListener("change", (e) => { state.near = e.target.value; applyFilters(); });
  $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; applyFilters({ fit: false }); });
  let qt; $("#search").addEventListener("input", (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value.trim(); applyFilters(); }, 180); });
  $("#clearFilters").addEventListener("click", () => { Object.assign(state, { type: null, cat: null, area: "", near: "", q: "" }); applyFilters(); });
  $("#explore").addEventListener("click", () => closeLanding(true));
  $("#brand").addEventListener("click", (e) => { e.preventDefault(); Object.assign(state, { type: null, cat: null, area: "", near: "", q: "", venue: null }); closeVenue(false); landingOpen = true; $("#landing").classList.remove("is-hidden"); applyFilters({ fit: false }); history.replaceState(null, "", location.pathname); });
  $("#aboutLink").addEventListener("click", (e) => { e.preventDefault(); $("#about").hidden = false; });
  $("#aboutClose").addEventListener("click", () => ($("#about").hidden = true));
  $("#about").addEventListener("click", (e) => { if (e.target.id === "about") $("#about").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#about").hidden) $("#about").hidden = true; else if (state.venue) closeVenue(true); } });
  window.addEventListener("popstate", () => { readURL(); renderChips(); renderList(); if (state.venue) openVenue(state.venue, false); else $("#detail").hidden = true; });

  let tt; function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 1800); }

  // ---------- init ----------
  readURL();
  renderLanding();
  renderLegend();
  renderChips();
  renderList();
  if (state.venue || state.type || state.cat || state.area || state.near || state.q) {
    // Deep link: skip the landing screen.
    landingOpen = false;
    $("#landing").classList.add("is-hidden");
    map.once("load", () => { if (state.venue) openVenue(state.venue, false); else fitTo(filtered()); });
  }
  if (matchMedia("(max-width:860px)").matches) setSheet("half");
})();

/* SIDEQUEST — Mumbai side-event venues for IBW + Devcon 2026 */
(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mob = () => matchMedia("(max-width:860px)").matches;

  const [vR, aR] = await Promise.all([fetch("data/venues.json"), fetch("data/areas.json")]);
  const DATA = await vR.json(), META = await aR.json();
  const V = DATA.venues;
  const CAT = Object.fromEntries(META.categories.map((c) => [c.id, c]));
  const AREA = Object.fromEntries(META.areas.map((a) => [a.id, a]));
  const TYPE = Object.fromEntries(META.eventTypes.map((t) => [t.id, t]));
  const ANCH = Object.fromEntries(META.anchors.map((a) => [a.id, a]));
  const BAND = Object.fromEntries(META.sizeBands.map((b) => [b.id, b]));
  const ADJ = { mixer: ["party", "dinner", "afterparty"], party: ["mixer", "afterparty"], afterparty: ["party", "mixer"], dinner: ["mixer"], workshop: ["panel", "builder", "hackathon"], panel: ["workshop", "creative"], builder: ["workshop", "hackathon"], hackathon: ["builder", "workshop"], creative: ["panel", "party"], sports: [] };
  const RED = "#e63329", AQUA = "#f2efe9";

  const hav = (a, b, c, d) => { const r = (x) => (x * Math.PI) / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  V.forEach((v) => {
    v.dist = {}; META.anchors.forEach((a) => (v.dist[a.id] = hav(v.lat, v.lng, a.lat, a.lng)));
    v.q = [v.name, v.tagline, AREA[v.area]?.name, CAT[v.cat]?.label, ...(v.bestFor || []), ...(v.types || []).map((t) => TYPE[t]?.label)].join(" ").toLowerCase();
  });
  const km = (k) => (k < 1 ? Math.round(k * 1000) + " m" : k.toFixed(1) + " km");
  const sc = (v) => (v.known < 8 ? "~" : "") + v.overall.toFixed(1);
  const cap = (v) => v.size.min + "–" + v.size.max.toLocaleString("en-IN");

  /* ── state ── */
  const S = { type: null, near: null, size: null, cat: "", area: "", q: "", sort: "fit", venue: null };
  const brief = () => !!(S.type || S.size || S.near !== null);
  function readURL() {
    const p = new URLSearchParams(location.search);
    S.type = TYPE[p.get("type")] ? p.get("type") : null;
    S.near = p.has("near") ? (ANCH[p.get("near")] ? p.get("near") : "") : null;
    S.size = BAND[p.get("size")] ? p.get("size") : null;
    S.cat = CAT[p.get("cat")] ? p.get("cat") : "";
    S.area = AREA[p.get("area")] ? p.get("area") : "";
    S.q = p.get("q") || "";
    S.sort = ["fit", "score", "ibw", "devcon", "name"].includes(p.get("sort")) ? p.get("sort") : "fit";
    S.venue = V.some((x) => x.id === p.get("v")) ? p.get("v") : null;
  }
  function writeURL(push) {
    const p = new URLSearchParams();
    if (S.type) p.set("type", S.type);
    if (S.near !== null) p.set("near", S.near);
    if (S.size) p.set("size", S.size);
    if (S.cat) p.set("cat", S.cat);
    if (S.area) p.set("area", S.area);
    if (S.q) p.set("q", S.q);
    if (S.sort !== "fit") p.set("sort", S.sort);
    if (S.venue) p.set("v", S.venue);
    (push ? history.pushState : history.replaceState).call(history, null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }

  /* ── fit engine ── */
  function assess(v) {
    const r = { fit: v.overall * 10, cls: "strong", why: [], t: 2, c: 2 };
    const b = S.size ? BAND[S.size] : null, t = S.type;
    if (t) {
      r.t = v.types.includes(t) ? 2 : ADJ[t]?.some((x) => v.types.includes(x)) ? 1 : 0;
      const L = META.typeCopy[t];
      if (r.t === 2) { r.fit += 20; r.why.push(["good", `Built for ${L} — one of the formats this room does well.`]); }
      else if (r.t === 1) r.why.push(["warn", `Not primarily ${L.replace(/^an? /, "a ")} venue, but it runs adjacent formats. Ask.`]);
      else { r.fit -= 35; r.why.push(["bad", `Not built for ${L}. Its strengths are ${v.bestFor.slice(0, 2).join(" and ").toLowerCase()}.`]); }
      const kf = META.typeFactor[t], ks = v.scores[kf];
      if (ks != null) { r.fit += (ks - 3) * 10; r.key = kf; }
    }
    if (b) {
      const est = v.size.source === "estimated";
      if (b.min > v.size.max) { r.c = 0; r.fit -= 40; r.why.push(["bad", `Too small — room for about ${v.size.max}${est ? " (estimated)" : ""}, you need ${b.label}.`]); }
      else if (b.max > v.size.max) { r.c = 1; r.fit -= 5; r.why.push(["warn", `Tight at the top — holds about ${v.size.max}${est ? " (estimated)" : ""}; ${b.max.toLocaleString("en-IN")} may not fit.`]); }
      else if (b.max < v.size.min) { r.c = 1; r.fit -= 8; r.why.push(["warn", `Built for bigger crowds (from ~${v.size.min}). ${b.label} could feel lost — ask for a smaller room.`]); }
      else { r.fit += 15; r.why.push(["good", `${b.label} sits inside its ${cap(v)} range${est ? " — our estimate, confirm it" : ""}.`]); }
    }
    if (S.near) {
      const d = v.dist[S.near], a = ANCH[S.near];
      if (d <= 3) { r.fit += 12; r.why.push(["good", `${km(d)} from ${a.venue} — inside the ${a.label} ring.`]); }
      else if (d <= 7) { r.fit += 4; r.why.push(["warn", `${km(d)} from ${a.venue} — a 15–25 minute cab.`]); }
      else { r.fit -= 12; r.why.push(["warn", `${km(d)} from ${a.venue} — a destination trip, 35–60 minutes.`]); }
    }
    if (v.confidence === "high") r.fit += 4;
    if (v.confidence === "low") { r.fit -= 4; r.why.push(["warn", "Low confidence — limited public evidence. Call before you plan."]); }
    r.cls = r.t === 0 || r.c === 0 ? "stretch" : r.t === 2 && r.c === 2 ? "strong" : "possible";
    return r;
  }
  const ok = (v) => (!S.cat || v.cat === S.cat) && (!S.area || v.area === S.area) && (!S.q || v.q.includes(S.q.toLowerCase()));
  function compute() {
    const all = V.map((v) => ({ v, a: assess(v), ok: ok(v) }));
    const SORT = { fit: (x, y) => y.a.fit - x.a.fit, score: (x, y) => y.v.overall - x.v.overall, name: (x, y) => x.v.name.localeCompare(y.v.name), ibw: (x, y) => x.v.dist.ibw - y.v.dist.ibw, devcon: (x, y) => x.v.dist.devcon - y.v.dist.devcon };
    all.sort(SORT[S.sort]);
    const shown = all.filter((x) => x.ok);
    const good = shown.filter((x) => x.a.cls !== "stretch");
    const pool = [...(good.length >= 3 ? good : shown)].sort((x, y) => y.a.fit - x.a.fit);
    const picks = [];
    const take = (label, why, s) => { const c = [...pool].filter((x) => !picks.some((p) => p.x === x)).sort(s)[0]; if (c) picks.push({ label, why: why(c.v), x: c }); };
    take("Best overall fit", (v) => v.tagline, (x, y) => y.a.fit - x.a.fit);
    take("Best atmosphere", (v) => `Atmosphere ${(v.scores.atmosphere ?? 3).toFixed(1)}/5 — the room does the work for you.`, (x, y) => (y.v.scores.atmosphere ?? 0) - (x.v.scores.atmosphere ?? 0) || y.a.fit - x.a.fit);
    take("Best for networking", (v) => `Networking ${(v.scores.networking ?? 3).toFixed(1)}/5 — layout and crowd make introductions easy.`, (x, y) => (y.v.scores.networking ?? 0) - (x.v.scores.networking ?? 0) || y.a.fit - x.a.fit);
    if (S.type) take(`Best for ${META.typeCopy[S.type].replace(/^an? /, "")}`, (v) => `${META.factorLabels[META.typeFactor[S.type]]} ${(v.scores[META.typeFactor[S.type]] ?? 3).toFixed(1)}/5 — the factor that decides this format.`, (x, y) => (y.v.scores[META.typeFactor[S.type]] ?? 0) - (x.v.scores[META.typeFactor[S.type]] ?? 0) || y.a.fit - x.a.fit);
    return { all, shown, good, picks };
  }

  /* ── photos ── */
  const thumbs = new Map();
  async function thumb(v) {
    if (thumbs.has(v.id)) return thumbs.get(v.id);
    const p = Photos.get(v).then((r) => (r.photos[0] ? r.photos[0].url : null));
    thumbs.set(v.id, p); return p;
  }
  function fillThumbs(root) {
    $$("[data-thumb]", root).forEach(async (el) => {
      const v = V.find((x) => x.id === el.dataset.thumb);
      const u = await thumb(v);
      if (u && el.isConnected) { const i = new Image(); i.loading = "lazy"; i.alt = ""; i.src = u; i.onload = () => el.replaceChildren(i); }
    });
  }

  /* ── map ── */
  const map = new maplibregl.Map({ container: "map", style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", center: [72.862, 19.06], zoom: 11.5, minZoom: 9.5, maxZoom: 17.5, attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.touchZoomRotate.disableRotation();
  const ring = (lng, lat, r, n = 96) => { const p = []; for (let i = 0; i <= n; i++) { const t = (i / n) * 2 * Math.PI; p.push([lng + (r / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(t), lat + (r / 110.574) * Math.sin(t)]); } return { type: "Feature", geometry: { type: "Polygon", coordinates: [p] } }; };
  map.on("load", () => {
    map.getStyle().layers.forEach((l) => {
      try {
        if (l.type === "symbol") { if (/poi|transit|housenum|airport|water_name/i.test(l.id)) map.setLayoutProperty(l.id, "visibility", "none"); else { map.setPaintProperty(l.id, "text-color", "#57534c"); map.setPaintProperty(l.id, "text-halo-color", "#0b0b0c"); } }
        if (l.type === "line" && /road|street|highway|motorway|rail|bridge|tunnel/i.test(l.id)) map.setPaintProperty(l.id, "line-opacity", 0.45);
      } catch (e) {}
    });
    map.addSource("rings", { type: "geojson", data: { type: "FeatureCollection", features: META.anchors.map((a) => ({ ...ring(a.lng, a.lat, a.radiusKm), properties: { id: a.id } })) } });
    map.addLayer({ id: "rf", type: "fill", source: "rings", paint: { "fill-color": RED, "fill-opacity": 0.05 } });
    map.addLayer({ id: "rl", type: "line", source: "rings", paint: { "line-color": RED, "line-width": 1, "line-dasharray": [4, 3], "line-opacity": 0.8 } });
    map.addSource("ax", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: META.anchors.map((a) => [a.lng, a.lat]) } } });
    map.addLayer({ id: "ax", type: "line", source: "ax", paint: { "line-color": AQUA, "line-width": 1, "line-opacity": 0.2, "line-dasharray": [1, 4] } });
  });
  META.anchors.forEach((a, i) => {
    const el = document.createElement("div"); el.className = "anc"; el.style.setProperty("--c", RED);
    el.innerHTML = `<div class="dot"></div><div class="box"><div class="n">${i + 1}</div><div class="t">${esc(a.venue)}<em>${esc(a.label)} · ${esc(a.dates)}</em></div></div>`;
    new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([a.lng, a.lat]).addTo(map);
  });
  const MK = {};
  V.forEach((v) => {
    const el = document.createElement("div"); el.className = "mk";
    el.innerHTML = `<div class="p"></div><div class="l"><em></em>${esc(v.name)}<b>${sc(v)}</b></div>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); openVenue(v.id, true); });
    el.addEventListener("mouseenter", () => hov(v.id, 1)); el.addEventListener("mouseleave", () => hov(v.id, 0));
    MK[v.id] = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map);
  });
  function paint(res) {
    const top = new Map(res.picks.map((p, i) => [p.x.v.id, i + 1]));
    res.all.forEach(({ v, a, ok }) => {
      const el = MK[v.id].getElement();
      el.classList.toggle("is-dim", !ok);
      el.classList.toggle("is-stretch", ok && a.cls === "stretch");
      el.classList.toggle("is-top", top.has(v.id));
      $(".l em", el).textContent = top.has(v.id) ? top.get(v.id) : "";
    });
  }
  function fitSet(res) { const s = res.shown.filter((x) => x.a.cls === "strong"); return (S.near && s.length >= 3 ? s : res.good.length ? res.good : res.shown).map((x) => x.v); }
  function fitTo(list) {
    if (!list.length) return;
    const b = new maplibregl.LngLatBounds(); list.forEach((v) => b.extend([v.lng, v.lat]));
    if (S.near) { const a = ANCH[S.near]; b.extend([a.lng, a.lat]); }
    map.fitBounds(b, { padding: mob() ? { top: 70, bottom: 50, left: 26, right: 26 } : { top: 70, bottom: 70, left: 80, right: 130 }, maxZoom: 14.4, duration: 700 });
  }

  /* ── rail ── */
  function briefBar() {
    const p = (lb, val, step) => `<button class="bpart${val ? "" : " is-empty"}" data-step="${step}"><span>${lb}</span><b>${esc(val || "any")}</b></button>`;
    $("#briefBar").innerHTML = p("Hosting", S.type ? TYPE[S.type].label : "", 1) + p("Where", S.near === null ? "" : S.near ? "near " + ANCH[S.near].label : "anywhere", 2) + p("Guests", S.size ? BAND[S.size].label : "", 3);
  }
  function refine() {
    $("#refine").innerHTML =
      `<select id="cS"><option value="">All types</option>${META.categories.map((c) => `<option value="${c.id}"${S.cat === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
       <select id="aS"><option value="">All areas</option>${META.areas.map((a) => `<option value="${a.id}"${S.area === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
       <select id="sS">${[["fit", "Best fit"], ["score", "Score"], ["ibw", "Near IBW"], ["devcon", "Near Devcon"], ["name", "A–Z"]].map(([k, l]) => `<option value="${k}"${S.sort === k ? " selected" : ""}>${l}</option>`).join("")}</select>
       <input id="qI" type="search" placeholder="Search" value="${esc(S.q)}" aria-label="Search venues">`;
    $("#cS").onchange = (e) => { S.cat = e.target.value; go(); };
    $("#aS").onchange = (e) => { S.area = e.target.value; go(); };
    $("#sS").onchange = (e) => { S.sort = e.target.value; go({ fit: 0 }); };
    let t; $("#qI").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); go(); }, 160); };
  }
  function sentence() {
    if (!brief()) return `All ${V.length} venues, ranked by Eventability. <button data-step="1">Tell it what you're hosting</button> for a shortlist.`;
    const b = [S.type ? `<b>${esc(META.typeCopy[S.type])}</b>` : "an event"];
    if (S.size) b.push(`for <b>${esc(BAND[S.size].label)}</b>`);
    b.push(S.near ? `<b>near ${esc(ANCH[S.near].label)}</b>` : "anywhere in Mumbai");
    return `You're hosting ${b.join(" ")}. <button data-step="1">Change</button>`;
  }
  const rowHTML = (x, i) => {
    const { v, a } = x;
    return `<li class="row${a.cls === "stretch" ? " is-stretch" : ""}${S.venue === v.id ? " is-active" : ""}" data-id="${v.id}" tabindex="0" role="button">
      <span class="k">${String(i + 1).padStart(2, "0")}</span>
      <span class="thumb" data-thumb="${v.id}"><span class="ph"></span></span>
      <span class="nm">${esc(v.name)}${brief() ? `<i class="fit ${a.cls}">${a.cls}</i>` : ""}</span>
      <span class="sc">${sc(v)}</span>
      <span class="mt">${esc(CAT[v.cat].label)} · ${esc(AREA[v.area]?.name)} · ${cap(v)} pax${S.near ? " · " + km(v.dist[S.near]) : ""}</span></li>`;
  };
  function renderRail(res) {
    const el = $("#railScroll");
    const fits = res.shown.filter((x) => x.a.cls !== "stretch"), str = res.shown.filter((x) => x.a.cls === "stretch");
    let h = `<div class="head"><h2>${brief() ? "Shortlist" : "All venues"}</h2><span class="n">${res.shown.length}/${V.length}</span></div><p class="blurb">${sentence()}</p>`;
    if (!res.shown.length) h += `<div class="empty"><b>Nothing matches that filter.</b>Reset the type, area or search — your brief is kept.</div>`;
    else {
      h += `<div class="picks">${res.picks.map((p, i) => { const { v } = p.x; return `<div class="pick${S.venue === v.id ? " is-active" : ""}" data-id="${v.id}" tabindex="0" role="button">
        <span class="thumb" data-thumb="${v.id}"><span class="ph">NO<br>PHOTO</span></span>
        <span class="lab">${String(i + 1).padStart(2, "0")} · ${esc(p.label)}</span>
        <span class="nm">${esc(v.name)}</span><span class="sc">${sc(v)}</span>
        <span class="wy">${esc(p.why)}</span>
        <span class="mt">${esc(CAT[v.cat].label)} · ${esc(AREA[v.area]?.name)} · ${cap(v)} pax${S.near ? " · " + km(v.dist[S.near]) : ""}</span></div>`; }).join("")}</div>`;
      h += `<div class="head"><h2>${brief() ? "Every match" : "Ranked"}</h2><span class="n">${fits.length}</span></div><ol class="rows">${fits.map(rowHTML).join("")}</ol>`;
      if (str.length) h += `<div class="head"><h2>Stretches</h2><span class="n">${str.length} · wrong size or format</span></div><ol class="rows">${str.map((x, i) => rowHTML(x, fits.length + i)).join("")}</ol>`;
    }
    h += `<p class="foot">Scores are editorial judgements on the evidence inside each venue page. Capacity ranges marked estimated are ours, not the venue's. Confirm before committing budget.</p>`;
    el.innerHTML = h; fillThumbs(el);
  }
  let RES = null;
  function go({ fit = 1 } = {}) {
    RES = compute(); briefBar(); refine(); renderRail(RES); paint(RES); writeURL();
    if (fit && !landing) fitTo(fitSet(RES));
  }
  const hov = (id, on) => { MK[id]?.getElement().classList.toggle("is-hover", !!on); $$(`.rail [data-id="${id}"]`).forEach((e) => e.classList.toggle("is-hover", !!on)); };

  /* ── venue page ── */
  const FK = [["capacity", "Capacity"], ["privateBooking", "Private booking"], ["outdoor", "Outdoor"], ["alcohol", "Alcohol"], ["food", "Food"], ["wifi", "Wi-Fi"], ["av", "AV"], ["lateHours", "Late hours"], ["parking", "Parking"], ["accessibility", "Access"]];
  const lateV = (s) => /unknown/i.test(s) ? "Unknown" : /\b(1:30|1:00|1|12|2|6)\s?AM\b|midnight|24\s?hours|open 24/i.test(s) ? "Yes" : /\b(10|11|11:30)\s?PM\b|closes/i.test(s) ? "No" : "Check";
  function verdict(v, a) {
    if (!brief()) return `<div class="verdict"><p class="q">Can I host my event here?</p><p class="a">Best for ${esc(v.bestFor.slice(0, 3).join(", ").toLowerCase())}.</p><ul><li class="good">${esc(v.formats.good[0])}</li>${v.formats.good[1] ? `<li class="good">${esc(v.formats.good[1])}</li>` : ""}<li class="bad">${esc(v.formats.bad[0])}</li></ul><p style="margin-top:12px"><button class="more" data-step="1">Tell it what you're hosting</button></p></div>`;
    const w = [S.type ? META.typeCopy[S.type] : "your event", S.size ? "for " + BAND[S.size].label : ""].filter(Boolean).join(" ");
    const H = { strong: [`<em>Yes.</em> You can host ${esc(w)} here.`, "yes"], possible: [`<em>Possibly.</em> ${esc(w)} could work — check the caveats.`, ""], stretch: [`<em>No.</em> A stretch for ${esc(w)}.`, "no"] }[a.cls];
    return `<div class="verdict ${H[1]}"><p class="q">Can I host my event here?</p><p class="a">${H[0]}</p><ul>${a.why.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("")}</ul></div>`;
  }
  async function openVenue(id, push) {
    const v = V.find((x) => x.id === id); if (!v) return;
    S.venue = id; closeLanding(0); if (!RES) RES = compute();
    const a = assess(v), d = $("#venue");
    const others = RES.picks.map((p) => p.x.v).filter((o) => o.id !== v.id).slice(0, 3);
    const late = v.facts.lateHours || "Unknown";
    d.innerHTML = `
      <div class="vnav"><button class="bk" id="bk">← ${brief() ? "Shortlist" : "All venues"}</button><div class="acts"><button class="ghost" id="shr">Copy link</button><a class="ghost" href="${esc(v.links.maps)}" target="_blank" rel="noopener">Maps ↗</a></div></div>
      <div class="gal" id="gal"></div>
      <div class="vb">
        <p class="vk"><span><i></i>${esc(CAT[v.cat].label)}</span><span>${esc(AREA[v.area]?.role)}</span></p>
        <h2 class="vn">${esc(v.name)}</h2>
        <p class="va">${esc(AREA[v.area]?.name)} — ${esc(v.address)}<br>${km(v.dist.ibw)} to Fairmont (IBW) · ${km(v.dist.devcon)} to Jio World Centre (Devcon)</p>
        ${verdict(v, a)}
        <div class="kf">
          <div><b>Capacity</b><span class="${v.size.source === "estimated" ? "dim" : ""}">${cap(v)}</span><small>${v.size.source === "published" ? "published" : "estimated — confirm"}</small></div>
          <div><b>Private hire</b><span>${/^yes/i.test(v.facts.privateBooking) ? "Yes" : /^no/i.test(v.facts.privateBooking) ? "No" : "Ask"}</span><small>${esc((v.facts.privateBooking || "").replace(/^(yes|no)\s*[—-]?\s*/i, "").slice(0, 44))}</small></div>
          <div><b>Runs late</b><span class="${/unknown/i.test(late) ? "dim" : ""}">${lateV(late)}</span><small>${esc(late.slice(0, 40))}</small></div>
        </div>
        <div class="sl"><div><p class="lbl">Eventability</p><p class="v">${sc(v)}<s> /10</s></p></div><p class="c"><b class="${v.confidence}">${v.confidence} confidence</b><br>${v.known}/10 factors assessed${v.known < 10 ? " · unknowns neutral" : ""}</p></div>
        <section class="vs"><h3>The take</h3><p class="take">${esc(v.tagline)}</p><p class="take2">${esc(v.summary)}</p></section>
        <section class="vs"><h3>Breakdown${a.key ? `<em>${esc(META.factorLabels[a.key])} decides this format</em>` : ""}</h3><div class="bars">${Object.entries(v.scores).map(([k, s]) => `<div class="bar${s == null ? " unk" : ""}${a.key === k ? " is-key" : ""}"><span class="l">${esc(META.factorLabels[k])}</span><span class="t">${[1, 2, 3, 4, 5].map((n) => `<s class="${s != null && s >= n - 0.5 ? "on" : ""}"></s>`).join("")}</span><span class="v">${s == null ? "?" : s.toFixed(1)}</span></div>`).join("")}</div></section>
        <section class="vs"><h3>Formats</h3><div class="fmt"><div><h4>Works</h4><ul>${v.formats.good.map((f) => `<li class="y">${esc(f)}</li>`).join("")}</ul></div><div><h4>Doesn't</h4><ul>${v.formats.bad.map((f) => `<li class="n">${esc(f)}</li>`).join("")}</ul></div></div></section>
        <section class="vs"><h3>Best for</h3><div class="tags">${v.bestFor.map((b) => `<span>${esc(b)}</span>`).join("")}</div></section>
        <section class="vs"><h3>Facts</h3><div class="facts">${FK.map(([k, l]) => { const x = v.facts[k] || "Unknown"; return `<div class="${/^unknown/i.test(x) ? "unk" : ""}"><b>${l}</b><span>${esc(x)}</span></div>`; }).join("")}</div></section>
        <section class="vs"><h3>Evidence reviewed<em>${v.evidence.length} sources</em></h3><ul class="ev" id="evL">${v.evidence.map((e, i) => `<li${i >= 3 ? " hidden" : ""}>${esc(e.text)}<s>${esc(e.source)}</s></li>`).join("")}</ul>${v.evidence.length > 3 ? `<button class="more" id="mEv">Show all ${v.evidence.length}</button>` : ""}</section>
        ${v.pastEvents?.length ? `<section class="vs"><h3>Events hosted here</h3><ul class="past">${v.pastEvents.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>` : ""}
        <section class="vs"><h3>Links</h3><div class="links">${v.links.website ? `<a href="${esc(v.links.website)}" target="_blank" rel="noopener">Website ↗</a>` : ""}${v.links.instagram ? `<a href="${esc(v.links.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>` : ""}<a href="${esc(v.links.maps)}" target="_blank" rel="noopener">Maps ↗</a></div></section>
        ${others.length ? `<section class="vs"><h3>Also on your shortlist</h3><div class="also">${others.map((o) => `<button data-id="${o.id}">${esc(o.name)}<small>${sc(o)} · ${esc(AREA[o.area]?.name)}</small></button>`).join("")}</div></section>` : ""}
        <p class="vf">Scores are editorial judgements on the evidence above. Capacities and policies change — confirm with the venue. Data generated ${esc(DATA.generated)}.</p>
      </div>`;
    d.hidden = false; d.scrollTop = 0;
    $("#app").classList.add("has-venue"); setTimeout(() => map.resize(), 220);
    $("#bk").onclick = () => closeVenue(1);
    $("#shr").onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast("Copy failed"); } };
    $("#mEv")?.addEventListener("click", (e) => { $$("#evL li").forEach((l) => (l.hidden = false)); e.target.remove(); });
    gallery(v);
    $$("[data-id]").forEach((e) => e.classList.toggle("is-active", e.dataset.id === id));
    Object.values(MK).forEach((m) => m.getElement().classList.remove("is-active"));
    MK[id].getElement().classList.add("is-active");
    map.easeTo({ center: [v.lng, v.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
    writeURL(push);
  }
  async function gallery(v) {
    const el = $("#gal"); if (!el) return;
    const panel = `<div class="frame"><div class="tpanel"><div class="big">${esc(v.bestFor[0] || v.name)}</div><div class="co"><span>${v.lat.toFixed(4)}°N ${v.lng.toFixed(4)}°E</span><span>${esc(AREA[v.area]?.name)}</span></div></div></div>`;
    el.innerHTML = panel;
    const { photos, source } = await Photos.get(v);
    if (!photos.length || !el.isConnected) return;
    let i = 0;
    const draw = () => {
      const p = photos[i];
      el.innerHTML = `<div class="frame"><img src="${esc(p.url)}" alt="${esc(v.name)}" loading="lazy">
        <span class="cred">${p.page ? `<a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.credit)}</a>` : esc(p.credit)}${p.license ? " · " + esc(p.license) : ""}</span></div>
        ${photos.length > 1 ? `<div class="strip">${photos.map((q, n) => `<button data-i="${n}" aria-current="${n === i}"><img src="${esc(q.url)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
        ${p.note ? `<p class="note">${esc(p.note)}</p>` : source === "places" ? `<p class="note">Photos via Google Places — verify current condition with the venue.</p>` : ""}`;
      const img = $(".frame img", el);
      if (img) img.onerror = () => { el.innerHTML = panel; };
      $$(".strip button", el).forEach((b) => (b.onclick = () => { i = +b.dataset.i; draw(); }));
    };
    draw();
  }
  function closeVenue(push) {
    S.venue = null; $("#venue").hidden = true; $("#app").classList.remove("has-venue"); setTimeout(() => map.resize(), 220);
    $$("[data-id]").forEach((e) => e.classList.remove("is-active"));
    Object.values(MK).forEach((m) => m.getElement().classList.remove("is-active"));
    writeURL(push);
  }

  /* ── landing ── */
  let landing = true, miniMap = null;
  function renderLanding() {
    $("#qgrid").innerHTML = META.eventTypes.map((t) => `<button data-pick="type" data-val="${t.id}">${esc(t.label)}<s>${V.filter((v) => v.types.includes(t.id)).length} venues</s></button>`).join("");
    $("#cats").innerHTML = META.categories.map((c) => `<button data-cat="${c.id}">${esc(c.label)}<s>${V.filter((v) => v.cat === c.id).length}</s></button>`).join("");
    const hero = V.filter((v) => v.photos.length).slice(0, 4);
    const pub = V.filter((v) => v.size.source === "published").length;
    $("#bento").innerHTML =
      `<div class="b-map"><div class="mini" id="mini"></div><div class="cap"><span>Sahar → BKC · the 9 km axis</span><span>42 venues</span></div></div>` +
      hero.slice(0, 2).map((v) => `<div class="b-img"><img src="${esc(v.photos[0].url)}" alt="${esc(v.name)}" loading="lazy"><span class="nm">${esc(v.name)}</span></div>`).join("") +
      `<div class="b-stat red"><div class="big">42</div><div class="lb">venues researched<br>8 categories</div></div>` +
      `<div class="b-stat ink"><div class="big">${pub}</div><div class="lb">with published<br>capacity figures</div></div>` +
      hero.slice(2, 4).map((v) => `<div class="b-img"><img src="${esc(v.photos[0].url)}" alt="${esc(v.name)}" loading="lazy"><span class="nm">${esc(v.name)}</span></div>`).join("") +
      `<div class="b-stat"><div class="big">10</div><div class="lb">factors scored<br>per venue</div></div>` +
      `<div class="b-stat"><div class="big">${V.reduce((n, v) => n + v.evidence.length, 0)}</div><div class="lb">sourced evidence<br>points</div></div>`;
    const note = Photos.enabled() ? "Photography: Wikimedia Commons + Google Places" : `Photography: ${V.filter((v) => v.photos.length).length} venues verified via Wikimedia Commons`;
    $("#photoNote").textContent = note;
    $("#howPhotos").textContent = Photos.enabled()
      ? "Venue photos come from two places: Creative Commons images verified by hand against each specific Mumbai location, and Google Places, matched by name and address and rejected if the returned place sits more than 2 km from our researched coordinates. Every photo carries its author credit."
      : "Ten venues carry Creative Commons photos verified by hand against that exact Mumbai location. The rest show a typographic panel — we do not attach a photo we cannot prove belongs to the venue. Adding a Google Places API key in data/config.js unlocks real photography for all 42.";
    $("#ptable").innerHTML = `<tr><th>Format</th><th>Size</th><th>Mumbai equivalents</th></tr>` + META.patterns.map((p) => `<tr><td>${esc(p.format)}</td><td>${esc(p.size)}</td><td>${esc(p.mumbai)}</td></tr>`).join("");
    if (!miniMap) {
      miniMap = new maplibregl.Map({ container: "mini", style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", center: [72.872, 19.083], zoom: 10.6, interactive: false, attributionControl: false });
      miniMap.on("load", () => {
        miniMap.getStyle().layers.forEach((l) => { try { if (l.type === "symbol") miniMap.setLayoutProperty(l.id, "visibility", "none"); if (l.type === "line") miniMap.setPaintProperty(l.id, "line-opacity", 0.35); } catch (e) {} });
        miniMap.addSource("v", { type: "geojson", data: { type: "FeatureCollection", features: V.map((v) => ({ type: "Feature", geometry: { type: "Point", coordinates: [v.lng, v.lat] }, properties: {} })) } });
        miniMap.addLayer({ id: "v", type: "circle", source: "v", paint: { "circle-radius": 3, "circle-color": "#f2efe9" } });
        miniMap.addSource("a", { type: "geojson", data: { type: "FeatureCollection", features: META.anchors.map((a) => ({ type: "Feature", geometry: { type: "Point", coordinates: [a.lng, a.lat] }, properties: {} })) } });
        miniMap.addLayer({ id: "ac", type: "circle", source: "a", paint: { "circle-radius": 7, "circle-color": RED } });
      });
    }
  }
  function closeLanding(fit = 1) {
    if (!landing) return; landing = false; $("#landing").classList.add("is-hidden"); go({ fit });
  }
  function openLanding() { landing = true; $("#landing").classList.remove("is-hidden"); $("#sheet").hidden = true; }

  /* ── question sheets ── */
  const STEPS = {
    2: { no: "02 / 03", q: "Where should it be?", opts: () => META.nearOptions.map((n) => ({ v: n.id, l: n.label, h: n.sub, k: "near" })) },
    3: { no: "03 / 03", q: "How many people?", opts: () => META.sizeBands.map((b) => ({ v: b.id, l: b.label, h: b.hint, k: "size" })) },
    1: { no: "01 / 03", q: "What are you hosting?", opts: () => META.eventTypes.map((t) => ({ v: t.id, l: t.label, h: V.filter((x) => x.types.includes(t.id)).length + " venues built for it", k: "type" })) },
  };
  function sheet(n) {
    const s = STEPS[n]; if (!s) return;
    $("#sheetNo").textContent = s.no; $("#sheetQ").textContent = s.q;
    $("#sheetOpts").innerHTML = s.opts().map((o) => `<button data-pick="${o.k}" data-val="${o.v}"><span class="ol">${esc(o.l)}</span><span class="oh">${esc(o.h)}</span></button>`).join("");
    $("#sheetBack").hidden = n === 1;
    $("#sheet").hidden = false; $("#sheet").dataset.step = n; window.scrollTo(0, 0);
  }

  const setView = (v) => { $("#app").classList.toggle("v-map", v === "map"); $("#app").classList.toggle("v-list", v !== "map"); $$("#tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v))); if (v === "map") setTimeout(() => map.resize(), 50); };

  /* ── events ── */
  document.addEventListener("click", (e) => {
    const pk = e.target.closest("[data-pick]");
    if (pk) {
      const k = pk.dataset.pick, val = pk.dataset.val;
      S[k] = val;
      if (k === "type") { briefBar(); sheet(2); }
      else if (k === "near") { briefBar(); sheet(3); }
      else { $("#sheet").hidden = true; closeVenue(0); closeLanding(1); if (mob()) setView("list"); }
      return;
    }
    const st = e.target.closest("[data-step]");
    if (st && st.id !== "sheet") { openLanding(); sheet(+st.dataset.step); return; }
    const ct = e.target.closest("[data-cat]");
    if (ct) { S.cat = ct.dataset.cat; closeLanding(1); if (mob()) setView("list"); return; }
    const row = e.target.closest("[data-id]");
    if (row && !row.closest(".mk")) { openVenue(row.dataset.id, true); return; }
    const tb = e.target.closest("#tabs [data-view]");
    if (tb) setView(tb.dataset.view);
  });
  $("#sheetBack").onclick = () => { const n = +$("#sheet").dataset.step; if (n === 3) sheet(2); else if (n === 2) sheet(1); else $("#sheet").hidden = true; };
  $("#explore").onclick = () => { if (S.near === null) S.near = ""; closeLanding(1); if (mob()) setView("map"); };
  $("#brand").onclick = (e) => { e.preventDefault(); Object.assign(S, { type: null, near: null, size: null, cat: "", area: "", q: "", venue: null }); closeVenue(0); openLanding(); history.replaceState(null, "", location.pathname); go({ fit: 0 }); };
  ["howBtn", "howBtn2"].forEach((i) => ($("#" + i).onclick = () => ($("#how").hidden = false)));
  $("#howClose").onclick = () => ($("#how").hidden = true);
  $("#how").onclick = (e) => { if (e.target.id === "how") $("#how").hidden = true; };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("[data-id][role=button]")) openVenue(e.target.dataset.id, true);
    if (e.key === "Escape") { if (!$("#how").hidden) $("#how").hidden = true; else if (!$("#sheet").hidden) $("#sheet").hidden = true; else if (S.venue) closeVenue(1); }
  });
  document.addEventListener("mouseover", (e) => { const r = e.target.closest(".rail [data-id]"); if (r) hov(r.dataset.id, 1); });
  document.addEventListener("mouseout", (e) => { const r = e.target.closest(".rail [data-id]"); if (r) hov(r.dataset.id, 0); });
  window.addEventListener("popstate", () => { readURL(); go({ fit: 0 }); if (S.venue) openVenue(S.venue, false); else { $("#venue").hidden = true; $("#app").classList.remove("has-venue"); } });
  let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 1600); }

  /* ── init ── */
  readURL(); renderLanding();
  $("#key").innerHTML = `<div><i class="top"></i>Top picks</div><div><i class="fits"></i>Fits your brief</div><div><i class="str"></i>Stretch</div><div><i class="anc"></i>3 km anchor rings</div>`;
  if (S.venue || brief() || S.cat || S.area || S.q) {
    landing = false; $("#landing").classList.add("is-hidden"); go({ fit: 0 });
    map.once("load", () => { if (S.venue) openVenue(S.venue, false); else fitTo(fitSet(RES)); });
  } else go({ fit: 0 });
  setView("list");
})();

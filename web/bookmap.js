// Birthplace map for the family book (web/book.js). Plain JavaScript, no dependencies; needs
// worldmap.js (country outlines) and, for the detail in the enlarged areas, mapdetail.js (cities,
// provinces, rivers, lakes, roads). Output: SVG content in mm for one A4 page.
//
// Every person whose birth (or baptism) place has GEDCOM coordinates adds to a colour density
// (heat) layer: pale yellow where few people were born, through orange to dark red where many were.
// The family's places are not named. The world map (Equal Earth) shows the whole spread; the busiest
// areas (places within 90 km of the busiest ones) get enlarged insets below, four when there are enough, drawn with
// reference detail (Natural Earth) and town names (GeoNames), named after their main town.
(function (global) {
  "use strict";

  const node = typeof module === "object" && module.exports;
  const W = node ? require("./worldmap.js") : global.WorldMap;
  const detail = () => (node ? (() => { try { return require("./mapdetail.js"); } catch (e) { return null; } })() : global.MapDetail);

  // Towns (GeoNames, 1,000+ inhabitants): towns/index.js says which countries have towns in each
  // 2-degree cell; towns/<CC>.js holds one country. The page loads the files it needs before
  // building (see townCountries); in Node they are read here.
  const townIndex = () => (node ? (() => { try { return require("./towns/index.js"); } catch (e) { return null; } })() : global.MapTownsIndex);
  const townFile = (cc) => (node ? (() => { try { return require(`./towns/${cc}.js`); } catch (e) { return null; } })()
                                 : (global.MapTowns || {})[cc] || null);
  const cellSets = new Map();
  /** Countries with towns inside any of the boxes [lonMin, latMin, lonMax, latMax]. */
  function townCountries(boxes) {
    const index = townIndex();
    if (!index) return [];
    const ids = new Set();
    for (const [a, b, c, d] of boxes) {
      for (let la = Math.floor(b / 2); la <= Math.floor(d / 2); la++) {
        for (let lo = Math.floor(a / 2); lo <= Math.floor(c / 2); lo++) ids.add((la + 45) * 180 + lo + 90);
      }
    }
    return Object.keys(index).filter((cc) => {
      if (!cellSets.has(cc)) cellSets.set(cc, new Set(index[cc]));
      const set = cellSets.get(cc);
      return [...ids].some((id) => set.has(id));
    });
  }
  /** Towns inside a box as {name, lat, lon, rank}, most important first; null when none are loaded. */
  function townsIn(box) {
    const out = [];
    let loaded = false;
    for (const cc of townCountries([box])) {
      const list = townFile(cc);
      if (!list) continue;
      loaded = true;
      for (const [name, la, lo, rank] of list) {
        const lat = la / 100, lon = lo / 100;
        if (lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]) out.push({ name, lat, lon, rank });
      }
    }
    return loaded ? out.sort((p, q) => p.rank - q.rank) : null;
  }

  const f2 = (v) => Math.round(v * 100) / 100;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RAD = Math.PI / 180;
  const LAND = "#f1ece0", BORDER = "#a89c84", SEA = "#dfeaf1", WATER = "#a9c8dc", RIVER = "#8db5d0";
  const PROVINCE = "#b9ad96", ROAD = "#e0a85e", ROAD2 = "#e6c99a", CITY = "#3c3c3c";
  // Density colours: low -> high (pale yellow, yellow, orange, red, dark red).
  const HEAT = { r: "1 1 1 0.93 0.62", g: "1 0.86 0.52 0.16 0.02", b: "0.55 0.12 0.02 0.02 0.02", a: "0 0.5 0.72 0.84 0.9" };

  // Lines decoded once: [x0, y0, dx1, dy1, ...] in 1/scale degree -> [[lon, lat], ...] with a box.
  const cache = new Map();
  function decode(key, list, scale) {
    if (cache.has(key)) return cache.get(key);
    const out = [];
    for (const flat of list || []) {
      let x = flat[0], y = flat[1];
      const pts = [[x / scale, y / scale]];
      for (let i = 2; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; pts.push([x / scale, y / scale]); }
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [lon, lat] of pts) { a = Math.min(a, lon); b = Math.min(b, lat); c = Math.max(c, lon); d = Math.max(d, lat); }
      out.push({ pts, box: [a, b, c, d] });
    }
    cache.set(key, out);
    return out;
  }
  const countryRings = () => (W ? decode("countries", W.countries.flat(), W.scale) : []);

  // Equal Earth projection (Šavrič, Patterson, Jenny 2018), in projection units.
  function equalEarth(lon, lat) {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const t = Math.asin(M * Math.sin(lat * RAD)), t2 = t * t, t6 = t2 * t2 * t2;
    const x = (2 * Math.sqrt(3) * lon * RAD * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
    const y = A4 * t6 * t2 * t + A3 * t6 * t + A2 * t2 * t + A1 * t;
    return [x, y];
  }

  function km(a, b) {
    const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  // One SVG path for lines or rings, projected with `proj(lon, lat) -> [x, y]` (mm), limited to `box`.
  // Points closer than 0.25 mm on paper are skipped; nothing is drawn across the date line. With a
  // `frame` [x, y, w, h], points far outside it are pulled onto a margin around it (a run along one
  // side collapses to its ends), so a continent cut by an inset costs only its visible part.
  function path(lines, proj, box, closed, frame) {
    const M = 3;
    const fr = frame ? [frame[0] - M, frame[1] - M, frame[0] + frame[2] + M, frame[1] + frame[3] + M] : null;
    const outside = (x, y) => fr && (x < fr[0] || x > fr[2] || y < fr[1] || y > fr[3]);
    let d = "";
    for (const r of lines) {
      if (box && (r.box[2] < box[0] || r.box[0] > box[2] || r.box[3] < box[1] || r.box[1] > box[3])) continue;
      const xy = r.pts.map((p) => proj(p[0], p[1]));
      const pts = [];
      xy.forEach(([x, y], i) => {
        const jump = i > 0 && Math.abs(r.pts[i][0] - r.pts[i - 1][0]) > 180;
        if (fr && outside(x, y) && (i === 0 || outside(...xy[i - 1])) && (i === xy.length - 1 || outside(...xy[i + 1]))) {
          x = Math.min(Math.max(x, fr[0]), fr[2]);
          y = Math.min(Math.max(y, fr[1]), fr[3]);
        }
        pts.push([x, y, jump]);
      });
      // Drop repeated points and the middle of straight runs along the margin.
      const keep = [];
      for (const p of pts) {
        const a = keep[keep.length - 1], b = keep[keep.length - 2];
        if (a && !p[2] && a[0] === p[0] && a[1] === p[1]) continue;
        if (a && b && fr && !p[2] && !a[2] && ((a[0] === p[0] && b[0] === p[0] && (p[0] === fr[0] || p[0] === fr[2])) ||
            (a[1] === p[1] && b[1] === p[1] && (p[1] === fr[1] || p[1] === fr[3])))) { keep[keep.length - 1] = p; continue; }
        keep.push(p);
      }
      let lx = 0, ly = 0, part = "", count = 0;
      keep.forEach(([x, y, jump], i) => {
        if (i && !jump && i < keep.length - 1 && Math.hypot(x - lx, y - ly) < 0.25) return;
        part += `${i === 0 || jump ? "M" : "L"}${f2(x)} ${f2(y)}`;
        lx = x; ly = y; count++;
      });
      if (count > (closed ? 2 : 1)) d += part + (closed ? "Z" : "");
    }
    return d;
  }

  // A <path> element, or nothing when there is nothing to draw.
  const el = (d, attrs) => (d ? `<path d="${d}" ${attrs}/>` : "");

  // The density layer: one blurred disc per place (opacity from its number of births), coloured by
  // an SVG filter (blur, then alpha -> colour ramp). `sigma` is the spread in mm.
  function heat(id, groups, proj, frame, sigma) {
    const [fx, fy, fw, fh] = frame;
    let s = `<filter id="${id}" filterUnits="userSpaceOnUse" x="${f2(fx)}" y="${f2(fy)}" width="${f2(fw)}" height="${f2(fh)}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur stdDeviation="${f2(sigma)}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0"/>` +
      `<feComponentTransfer><feFuncR type="table" tableValues="${HEAT.r}"/><feFuncG type="table" tableValues="${HEAT.g}"/>` +
      `<feFuncB type="table" tableValues="${HEAT.b}"/><feFuncA type="table" tableValues="${HEAT.a}"/></feComponentTransfer></filter>`;
    s += `<g filter="url(#${id})">`;
    for (const g of groups) {
      const [x, y] = proj(g.lon, g.lat);
      if (x < fx - 3 * sigma || x > fx + fw + 3 * sigma || y < fy - 3 * sigma || y > fy + fh + 3 * sigma) continue;
      const a = 1 - Math.pow(0.75, g.n);               // each person adds 25% of what is left
      s += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(1.5 * sigma)}" fill="#000" fill-opacity="${f2(a)}"/>`;
    }
    return s + `</g>`;
  }

  /**
   * points: [{lat, lon}] one per person. opts: {x, y, w, h (mm), title, missing (people with a place
   * but no coordinates), labels: {births(n, missing), less, more}}. Returns SVG content (no <svg>).
   */
  function layout(points, opts) {
    const { x: X, y: Y, w: Wd } = opts;
    // Same coordinates = one place.
    const byCoord = new Map();
    for (const p of points) {
      const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      if (!byCoord.has(key)) byCoord.set(key, { lat: p.lat, lon: p.lon, n: 0 });
      byCoord.get(key).n++;
    }
    const groups = [...byCoord.values()];

    // World map, Antarctica left out.
    const [x0] = equalEarth(-180, 0), [x1] = equalEarth(180, 0);
    const [, yTop] = equalEarth(0, 84), [, yBottom] = equalEarth(0, -56);
    const scale = Wd / (x1 - x0);
    const worldH = (yTop - yBottom) * scale;
    const top = Y + 9;
    const world = (lon, lat) => { const [px, py] = equalEarth(lon, lat); return [X + (px - x0) * scale, top + (yTop - py) * scale]; };

    // Areas: around the place with most births, every place within 90 km; then the next place not
    // yet covered, and so on.
    const clusters = [], covered = new Set();
    for (const g of groups.slice().sort((a, b) => b.n - a.n)) {
      if (covered.has(g)) continue;
      const near = groups.filter((h) => !covered.has(h) && km(g, h) <= 90);
      near.forEach((h) => covered.add(h));
      clusters.push({ groups: near, n: near.reduce((s, h) => s + h.n, 0) });
    }
    // Inset frames: two per row under the world map; up to four.
    const gridTop = top + worldH + 14, gap = 6, bottom = opts.y + opts.h - 4;   // 4 mm for the credits
    const frameIn = (c, cellW, innerH) => {
      const lats = c.groups.map((g) => g.lat), lons = c.groups.map((g) => g.lon);
      const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
      const kx = Math.cos(lat0 * RAD);
      const spanLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.35, 0.5);
      const spanLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 1.35, 0.5 / kx);
      const s = Math.min(cellW / (spanLon * kx), innerH / spanLat);           // mm per degree of latitude
      const halfLon = cellW / 2 / (kx * s), halfLat = innerH / 2 / s;
      return { lat0, lon0, kx, s, box: [lon0 - halfLon, lat0 - halfLat, lon0 + halfLon, lat0 + halfLat] };
    };
    const within = (g, box) => g.lon >= box[0] && g.lon <= box[2] && g.lat >= box[1] && g.lat <= box[3];
    // Biggest areas first (2+ places, 5+ people), up to four, so the page is filled; an area that is
    // mostly visible in an inset already chosen is skipped.
    const insets = [], chosenBoxes = [];
    const fullH = Math.min(95, (bottom - gridTop - gap) / 2) - 6, halfW = (Wd - gap) / 2;
    for (const c of clusters.sort((a, b) => b.n - a.n)) {
      if (insets.length >= 4) break;
      if (c.groups.length < 2 || c.n < 5) continue;
      const seen = c.groups.filter((g) => chosenBoxes.some((b) => within(g, b))).reduce((t, g) => t + g.n, 0);
      if (seen * 2 >= c.n) continue;
      insets.push(c);
      chosenBoxes.push(frameIn(c, halfW, fullH).box);
    }

    const cols = insets.length > 1 ? 2 : 1;
    const rowsN = Math.ceil(insets.length / cols);
    const cellW = (Wd - gap * (cols - 1)) / cols;
    const cellH = rowsN ? Math.min(95, (bottom - gridTop - gap * (rowsN - 1)) / rowsN) : 0;
    const views = insets.map((c, i) => {
      const fx = X + (i % cols) * (cellW + gap), fy = gridTop + Math.floor(i / cols) * (cellH + gap);
      const innerH = cellH - 6;
      const { lat0, lon0, kx, s, box } = frameIn(c, cellW, innerH);
      const proj = (lon, lat) => [fx + cellW / 2 + (lon - lon0) * kx * s, fy + 6 + innerH / 2 - (lat - lat0) * s];
      const inside = groups.filter((g) => within(g, box));
      // Weighted centre of the births, to name the inset after the main city near it.
      const n = inside.reduce((t, g) => t + g.n, 0);
      const centre = { lat: inside.reduce((t, g) => t + g.lat * g.n, 0) / n, lon: inside.reduce((t, g) => t + g.lon * g.n, 0) / n };
      return { i, fx, fy, proj, box, inside, people: n, centre, frame: [fx, fy + 6, cellW, innerH] };
    });
    return { groups, world, top, worldH, views };
  }

  /** The boxes of the enlarged areas, so the page can load their town files before building. */
  const insetBoxes = (points, opts) => layout(points, opts).views.map((v) => v.box);

  function birthMap(points, opts) {
    const { x: X, y: Y, w: Wd } = opts;
    const L = opts.labels;
    const MD = detail();
    const { groups, world, top, worldH, views } = layout(points, opts);

    let s = `<text x="${X}" y="${Y + 2}" font-size="5" font-weight="bold" fill="#2a1d12">${esc(opts.title)}</text>`;
    s += `<defs><clipPath id="bm-world"><rect x="${X}" y="${top}" width="${f2(Wd)}" height="${f2(worldH)}"/></clipPath>` +
         views.map((v) => `<clipPath id="bm-inset-${v.i}"><rect x="${f2(v.frame[0])}" y="${f2(v.frame[1])}" width="${f2(v.frame[2])}" height="${f2(v.frame[3])}"/></clipPath>`).join("") +
         `</defs>`;

    // World.
    s += `<rect x="${X}" y="${top}" width="${f2(Wd)}" height="${f2(worldH)}" fill="${SEA}" stroke="#9aa7ad" stroke-width="0.25"/>`;
    s += `<g clip-path="url(#bm-world)"><path d="${path(countryRings(), world, null, true)}" fill="${LAND}" stroke="${BORDER}" stroke-width="0.08"/>`;
    s += heat("bm-heat-world", groups, world, [X, top, Wd, worldH], 1.4);
    for (const v of views) {
      const [ax, ay] = world(v.box[0], v.box[3]), [bx, by] = world(v.box[2], v.box[1]);
      s += `<rect x="${f2(Math.min(ax, bx))}" y="${f2(Math.min(ay, by))}" width="${f2(Math.max(1.2, Math.abs(bx - ax)))}" height="${f2(Math.max(1.2, Math.abs(by - ay)))}" fill="none" stroke="#333" stroke-width="0.25"/>` +
           `<text x="${f2(Math.min(ax, bx) - 0.6)}" y="${f2(Math.min(ay, by) - 0.6)}" font-size="2.6" font-weight="bold" text-anchor="end" fill="#222" stroke="#fff" stroke-width="0.5" paint-order="stroke">${v.i + 1}</text>`;
    }
    s += `</g>`;

    // Legend: the colour ramp, from fewer to more births; counts on the right.
    const ly = top + worldH + 6, lw = 40;
    const stops = HEAT.r.split(" ").map((r, k) => {
      const c = (v) => Math.round(255 * Number(v));
      return `<stop offset="${k / 4}" stop-color="rgb(${c(r)},${c(HEAT.g.split(" ")[k])},${c(HEAT.b.split(" ")[k])})" stop-opacity="${HEAT.a.split(" ")[k]}"/>`;
    }).slice(1).join("");
    s += `<defs><linearGradient id="bm-ramp">${stops}</linearGradient></defs>` +
         `<text x="${X}" y="${f2(ly + 1)}" font-size="2.3" fill="#333">${esc(L.less)}</text>` +
         `<rect x="${f2(X + 15)}" y="${f2(ly - 1.4)}" width="${lw}" height="3" fill="url(#bm-ramp)" stroke="#bbb" stroke-width="0.15"/>` +
         `<text x="${f2(X + 17 + lw)}" y="${f2(ly + 1)}" font-size="2.3" fill="#333">${esc(L.more)}</text>` +
         `<text x="${f2(X + Wd)}" y="${f2(ly + 1)}" font-size="2.3" text-anchor="end" fill="#555">${esc(L.births(points.length, opts.missing))}</text>`;

    // Insets: reference detail, the density on top, then the reference cities.
    const lakes = MD ? decode("lakes", MD.lakes, MD.scale) : [];
    const rivers = MD ? decode("rivers", MD.rivers, MD.scale) : [];
    const provinces = MD ? decode("provinces", MD.provinces, MD.scale) : [];
    const majorRoads = MD ? decode("majorRoads", MD.majorRoads, MD.scale) : [];
    const roads = MD ? decode("roads", MD.roads, MD.scale) : [];
    // 1:10m land and borders when mapdetail.js is there; otherwise the 1:50m countries.
    const land = MD && MD.land ? decode("land", MD.land, MD.scale) : countryRings();
    const borders = MD && MD.borders ? decode("borders", MD.borders, MD.scale) : null;
    const cities = MD ? MD.cities.map(([name, lat, lon, rank]) => ({ name, lat: lat / MD.scale, lon: lon / MD.scale, rank })) : [];
    const regions = MD && MD.regions ? MD.regions.map(([name, pt, lat, lon, rank]) =>
      ({ name: opts.lang === "pt" && pt ? pt : name, lat: lat / MD.scale, lon: lon / MD.scale, rank })) : [];
    for (const v of views) {
      const [fx, fy, fw, fh] = v.frame;
      const inBox = (c) => c.lon >= v.box[0] && c.lon <= v.box[2] && c.lat >= v.box[1] && c.lat <= v.box[3];
      // Reference places: GeoNames towns when their files are loaded, else Natural Earth's cities.
      const towns = townsIn(v.box) || cities.filter(inBox);
      // Named after the most important reference place (bigger first on a tie).
      const main = towns[0];
      s += `<text x="${f2(v.fx)}" y="${f2(v.fy + 4)}" font-size="2.8" font-weight="bold" fill="#2a1d12">${v.i + 1}${main ? ` · ${esc(main.name)}` : ""}` +
           `<tspan font-weight="normal" fill="#666">\u00a0(${v.people})</tspan></text>`;
      s += `<rect x="${f2(fx)}" y="${f2(fy)}" width="${f2(fw)}" height="${f2(fh)}" fill="${SEA}" stroke="#9aa7ad" stroke-width="0.25"/>`;
      s += `<g clip-path="url(#bm-inset-${v.i})">` +
           el(path(land, v.proj, v.box, true, v.frame), `fill="${LAND}" stroke="${BORDER}" stroke-width="0.12"`) +
           el(path(lakes, v.proj, v.box, true, v.frame), `fill="${WATER}" stroke="${RIVER}" stroke-width="0.1"`) +
           el(path(rivers, v.proj, v.box, false, v.frame), `fill="none" stroke="${RIVER}" stroke-width="0.25"`) +
           el(path(provinces, v.proj, v.box, false, v.frame), `fill="none" stroke="${PROVINCE}" stroke-width="0.18" stroke-dasharray="0.8 0.5"`) +
           el(path(roads, v.proj, v.box, false, v.frame), `fill="none" stroke="${ROAD2}" stroke-width="0.25"`) +
           el(path(majorRoads, v.proj, v.box, false, v.frame), `fill="none" stroke="${ROAD}" stroke-width="0.4"`) +
           (borders ? el(path(borders, v.proj, v.box, false, v.frame), `fill="none" stroke="${BORDER}" stroke-width="0.35"`)
                    : el(path(countryRings(), v.proj, v.box, true, v.frame), `fill="none" stroke="${BORDER}" stroke-width="0.35"`));
      s += heat(`bm-heat-${v.i}`, v.inside, v.proj, v.frame, 2.2);

      // Labels never overlap each other or a town's dot. First up to three region names (districts,
      // states, provinces), faint and spaced out; then the towns, most important first.
      const taken = [];
      const free = (b) => b[0] >= fx + 0.3 && b[2] <= fx + fw - 0.3 && b[1] >= fy + 0.3 && b[3] <= fy + fh - 0.3 &&
                          !taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
      let regionSvg = "", regionsShown = 0;
      for (const rg of regions.filter(inBox).sort((p, q) => p.rank - q.rank)) {
        if (regionsShown >= 3) break;
        const [cx, cy] = v.proj(rg.lon, rg.lat);
        const text = rg.name.toUpperCase(), size = 2.5, spacing = 0.6;
        const tw = text.length * (size * 0.66 + spacing);
        const b = [cx - tw / 2, cy - size * 0.8, cx + tw / 2, cy + size * 0.2];
        if (!free(b)) continue;
        taken.push(b);
        regionsShown++;
        regionSvg += `<text x="${f2(cx)}" y="${f2(cy)}" font-size="${size}" text-anchor="middle" letter-spacing="${spacing}"` +
                     ` fill="#8f846f" fill-opacity="0.8">${esc(text)}</text>`;
      }
      let townSvg = "", shown = 0;
      for (const c of towns) {
        if (shown >= 45) break;
        const [cx, cy] = v.proj(c.lon, c.lat);
        const big = c.rank <= 4, mid = c.rank <= 8;
        const size = big ? 2.5 : mid ? 2.1 : 1.75, r = big ? 0.65 : mid ? 0.45 : 0.32;
        const tw = c.name.length * size * (big ? 0.6 : 0.52);
        const dot = [cx - r, cy - r, cx + r, cy + r];
        const right = [cx - r, cy - size * 0.75, cx + r + 0.5 + tw, cy + size * 0.3];
        const left = [cx - r - 0.5 - tw, cy - size * 0.75, cx + r, cy + size * 0.3];
        const side = free(right) ? "right" : free(left) ? "left" : null;
        if (!side) continue;
        taken.push(side === "right" ? right : left, dot);
        const tx = side === "right" ? cx + r + 0.4 : cx - r - 0.4;
        townSvg += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${r}" fill="#fff" stroke="${CITY}" stroke-width="${big ? 0.3 : 0.22}"/>` +
                   `<text x="${f2(tx)}" y="${f2(cy + size * 0.3)}" font-size="${size}"${big ? ' font-weight="bold"' : ""}` +
                   `${side === "left" ? ' text-anchor="end"' : ""} fill="${mid ? CITY : "#555"}" stroke="#fff" stroke-width="0.4" paint-order="stroke">${esc(c.name)}</text>`;
        shown++;
      }
      s += regionSvg + townSvg + `</g>`;
    }
    // Credits for the map data.
    s += `<text x="${f2(X + Wd)}" y="${f2(opts.y + opts.h - 0.5)}" font-size="1.9" text-anchor="end" fill="#888">${esc(L.credit)}</text>`;
    return s;
  }

  const api = { birthMap, insetBoxes, townCountries, equalEarth };
  if (node) module.exports = api;
  else global.FamilyBookMap = api;
})(typeof window !== "undefined" ? window : globalThis);

// Birthplace map for the family book (web/book.js). Plain JavaScript, no dependencies; needs
// worldmap.js (country outlines). Output: SVG content in mm for one A4 page.
//
// Every person whose birth (or baptism) place has GEDCOM coordinates is a point. The world map
// (Equal Earth projection) shows them as circles whose area follows the number of births; places
// that fall within a couple of millimetres of each other are drawn as one circle. The busiest areas
// (places linked within ~80 km of each other) get enlarged insets below, up to four, with labels.
(function (global) {
  "use strict";

  const W = typeof module === "object" && module.exports ? require("./worldmap.js") : global.WorldMap;

  const f2 = (v) => Math.round(v * 100) / 100;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RAD = Math.PI / 180;
  const LAND = "#efe8d8", BORDER = "#b4a88f", SEA = "#f4f8fa", DOT = "rgba(168,44,32,0.55)", DOT_EDGE = "#7a1d14";

  // Country outlines, decoded once: rings of [lon, lat] with their bounding boxes.
  let rings = null;
  function outlines() {
    if (rings || !W) return rings || [];
    rings = [];
    for (const country of W.countries) {
      for (const flat of country) {
        let x = flat[0], y = flat[1];
        const pts = [[x / W.scale, y / W.scale]];
        for (let i = 2; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; pts.push([x / W.scale, y / W.scale]); }
        const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
        rings.push({ pts, box: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] });
      }
    }
    return rings;
  }

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

  // Land as one SVG path, for a projection `proj(lon, lat) -> [x, y]` in mm, limited to `box` (lon/lat).
  function landPath(proj, box) {
    let d = "";
    for (const r of outlines()) {
      if (box && (r.box[2] < box[0] || r.box[0] > box[2] || r.box[3] < box[1] || r.box[1] > box[3])) continue;
      let prev = null, lx = 0, ly = 0, part = "", count = 0;
      r.pts.forEach((p, i) => {
        const [x, y] = proj(p[0], p[1]);
        const jump = prev !== null && Math.abs(p[0] - prev) > 180;   // never draw across the date line
        prev = p[0];
        // Points closer than 0.25 mm on paper add nothing: skip them (keeps world pages small).
        if (i && !jump && i < r.pts.length - 1 && Math.hypot(x - lx, y - ly) < 0.25) return;
        part += `${i === 0 || jump ? "M" : "L"}${f2(x)} ${f2(y)}`;
        lx = x; ly = y; count++;
      });
      if (count > 2) d += part + "Z";
    }
    return d;
  }

  // Merge circles closer than `gap` mm (largest first); the merged circle keeps the largest position.
  function mergeOnScreen(groups, proj, gap) {
    const kept = [];
    for (const g of groups.slice().sort((a, b) => b.n - a.n)) {
      const [x, y] = proj(g.lon, g.lat);
      const near = kept.find((k) => Math.hypot(k.x - x, k.y - y) < gap);
      if (near) {
        near.n += g.n;
        for (const [name, k] of g.names) {
          const have = near.names.get(name) || { n: 0, pos: k.pos };
          near.names.set(name, { n: have.n + k.n, pos: Math.min(have.pos, k.pos) });
        }
      } else {
        kept.push({ x, y, n: g.n, names: new Map([...g.names].map(([name, k]) => [name, { ...k }])) });
      }
    }
    return kept;
  }
  // "Lumbier/Irunberri Ntra. Sra. de la Asuncion" -> "Lumbier"; "Coimbra (Sé Nova)" -> "Coimbra".
  const shortName = (part) => part.split(/[/(]/)[0].replace(/\?/g, "").trim().replace(/\s+(do|da|de|dos|das)$/i, "");
  const ranked = (names) => [...names].sort((a, b) => b[1].n - a[1].n || a[1].pos - b[1].pos).map(([name]) => name);
  // Labels of a map's circles, biggest first; a name already used by a bigger circle is not repeated.
  function nameDots(list) {
    const used = new Set();
    for (const d of list.slice().sort((a, b) => b.n - a.n)) {
      const names = ranked(d.names);
      d.label = names.find((nm) => !used.has(nm)) || names[0];
      used.add(d.label);
    }
  }

  /**
   * points: [{lat, lon, place}] one per person. opts: {x, y, w, h (mm), title, labels: {births,
   * withoutCoords, inset, legendOne}, missing: people with a place but no coordinates}.
   * Returns SVG content (no <svg> wrapper).
   */
  function birthMap(points, opts) {
    const { x: X, y: Y, w: Wd } = opts;
    const L = opts.labels;
    // Same place (same coordinates) = one group; the label is the place's first part, most common first.
    const byCoord = new Map();
    for (const p of points) {
      const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      if (!byCoord.has(key)) byCoord.set(key, { lat: p.lat, lon: p.lon, n: 0, names: new Map() });
      const g = byCoord.get(key);
      g.n++;
      // Every part of the place text ("Peneireiros, Veade" -> Peneireiros, Veade) is a possible label;
      // the part found in most births wins, the earlier part on a tie.
      String(p.place || "?").split(",").map(shortName).filter(Boolean).forEach((name, pos) => {
        const k = g.names.get(name) || { n: 0, pos };
        k.n++; k.pos = Math.min(k.pos, pos);
        g.names.set(name, k);
      });
    }
    const groups = [...byCoord.values()];

    // World map, Antarctica left out.
    const [x0] = equalEarth(-180, 0), [x1] = equalEarth(180, 0);
    const [, yTop] = equalEarth(0, 84), [, yBottom] = equalEarth(0, -56);
    const scale = Wd / (x1 - x0);
    const worldH = (yTop - yBottom) * scale;
    const top = Y + 9;
    const world = (lon, lat) => { const [px, py] = equalEarth(lon, lat); return [X + (px - x0) * scale, top + (yTop - py) * scale]; };

    // Insets: around the place with most births, every place within 90 km; then the next place not
    // yet covered, and so on. The busiest areas (2+ places, 3% of the people) are enlarged.
    const clusters = [], covered = new Set();
    for (const g of groups.slice().sort((a, b) => b.n - a.n)) {
      if (covered.has(g)) continue;
      const near = groups.filter((h) => !covered.has(h) && km(g, h) <= 90);
      near.forEach((h) => covered.add(h));
      clusters.push({ groups: near, n: near.reduce((s, h) => s + h.n, 0) });
    }
    const minPeople = Math.max(5, Math.round(points.length * 0.03));
    const insets = clusters.filter((c) => c.groups.length > 1 && c.n >= minPeople).sort((a, b) => b.n - a.n).slice(0, 4);

    // Inset frames: two per row under the world map.
    const gridTop = top + worldH + 14, gap = 6;
    const cols = insets.length > 1 ? 2 : 1;
    const rowsN = Math.ceil(insets.length / cols);
    const cellW = (Wd - gap * (cols - 1)) / cols;
    const cellH = rowsN ? Math.min(95, (opts.y + opts.h - gridTop - gap * (rowsN - 1)) / rowsN) : 0;
    const views = insets.map((c, i) => {
      const lats = c.groups.map((g) => g.lat), lons = c.groups.map((g) => g.lon);
      const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
      const kx = Math.cos(lat0 * RAD);
      const fx = X + (i % cols) * (cellW + gap), fy = gridTop + Math.floor(i / cols) * (cellH + gap);
      const innerH = cellH - 6;
      const spanLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.35, 0.5);
      const spanLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 1.35, 0.5 / kx);
      const s = Math.min(cellW / (spanLon * kx), innerH / spanLat);           // mm per degree of latitude
      const proj = (lon, lat) => [fx + cellW / 2 + (lon - lon0) * kx * s, fy + 6 + innerH / 2 - (lat - lat0) * s];
      const halfLon = cellW / 2 / (kx * s), halfLat = innerH / 2 / s;
      return { c, i, fx, fy, proj, box: [lon0 - halfLon, lat0 - halfLat, lon0 + halfLon, lat0 + halfLat] };
    });

    // Circles: area follows the number of births, the same scale on every map.
    const worldDots = mergeOnScreen(groups, world, 2.2);
    for (const v of views) {
      v.inside = groups.filter((g) => g.lon >= v.box[0] && g.lon <= v.box[2] && g.lat >= v.box[1] && g.lat <= v.box[3]);
      v.dots = mergeOnScreen(v.inside, v.proj, 2.2);
      nameDots(v.dots);
    }
    const maxN = Math.max(1, ...worldDots.map((d) => d.n), ...views.flatMap((v) => v.dots.map((d) => d.n)));
    const R_MAX = 5.2, R_MIN = 0.65;
    const radius = (n) => Math.max(R_MIN, R_MAX * Math.sqrt(n / maxN));
    const dots = (list) => list.sort((a, b) => b.n - a.n).map((d) =>
      `<circle cx="${f2(d.x)}" cy="${f2(d.y)}" r="${f2(radius(d.n))}" fill="${DOT}" stroke="${DOT_EDGE}" stroke-width="0.18"/>`).join("");

    let s = `<text x="${X}" y="${Y + 2}" font-size="5" font-weight="bold" fill="#2a1d12">${esc(opts.title)}</text>`;
    s += `<defs><clipPath id="bm-world"><rect x="${X}" y="${top}" width="${f2(Wd)}" height="${f2(worldH)}"/></clipPath>` +
         views.map((v) => `<clipPath id="bm-inset-${v.i}"><rect x="${f2(v.fx)}" y="${f2(v.fy + 6)}" width="${f2(cellW)}" height="${f2(cellH - 6)}"/></clipPath>`).join("") +
         `</defs>`;
    s += `<rect x="${X}" y="${top}" width="${f2(Wd)}" height="${f2(worldH)}" fill="${SEA}" stroke="#9aa7ad" stroke-width="0.25"/>`;
    s += `<g clip-path="url(#bm-world)"><path d="${landPath(world)}" fill="${LAND}" stroke="${BORDER}" stroke-width="0.08"/>${dots(worldDots)}`;
    for (const v of views) {
      const [ax, ay] = world(v.box[0], v.box[3]), [bx, by] = world(v.box[2], v.box[1]);
      s += `<rect x="${f2(Math.min(ax, bx))}" y="${f2(Math.min(ay, by))}" width="${f2(Math.max(1.2, Math.abs(bx - ax)))}" height="${f2(Math.max(1.2, Math.abs(by - ay)))}" fill="none" stroke="#333" stroke-width="0.25"/>` +
           `<text x="${f2(Math.min(ax, bx) - 0.6)}" y="${f2(Math.min(ay, by) - 0.6)}" font-size="2.6" font-weight="bold" text-anchor="end" fill="#222" stroke="#fff" stroke-width="0.5" paint-order="stroke">${v.i + 1}</text>`;
    }
    s += `</g>`;

    // Legend and counts under the world map.
    const ly = top + worldH + 6;
    const samples = [1, 10, 100].filter((n) => n <= maxN);
    let lx = X;
    for (const n of samples) {
      const r = radius(n);
      s += `<circle cx="${f2(lx + r)}" cy="${f2(ly - r + 1.2)}" r="${f2(r)}" fill="${DOT}" stroke="${DOT_EDGE}" stroke-width="0.18"/>` +
           `<text x="${f2(lx + 2 * r + 1)}" y="${f2(ly + 1)}" font-size="2.3" fill="#333">${n === 1 ? L.legendOne : n}</text>`;
      lx += 2 * r + 4 + String(n === 1 ? L.legendOne : n).length * 1.25;
    }
    s += `<text x="${f2(X + Wd)}" y="${f2(ly + 1)}" font-size="2.3" text-anchor="end" fill="#555">${esc(L.births(points.length, opts.missing))}</text>`;

    // Insets with labels (largest places first, skipped where they would overlap).
    for (const v of views) {
      const people = v.inside.reduce((t, g) => t + g.n, 0);
      const names = [];
      for (const d of [...v.dots].sort((a, b) => b.n - a.n)) {
        const next = [...names, d.label].join(", ");
        if (names.length >= 3 || (next.length + 10) * 1.5 > cellW) break;
        names.push(d.label);
      }
      s += `<text x="${f2(v.fx)}" y="${f2(v.fy + 4)}" font-size="2.8" font-weight="bold" fill="#2a1d12">${v.i + 1} · ${esc(names.join(", "))}` +
           `<tspan font-weight="normal" fill="#666">\u00a0(${people})</tspan></text>`;
      s += `<rect x="${f2(v.fx)}" y="${f2(v.fy + 6)}" width="${f2(cellW)}" height="${f2(cellH - 6)}" fill="${SEA}" stroke="#9aa7ad" stroke-width="0.25"/>`;
      s += `<g clip-path="url(#bm-inset-${v.i})"><path d="${landPath(v.proj, v.box)}" fill="${LAND}" stroke="${BORDER}" stroke-width="0.15"/>${dots(v.dots)}`;
      // A label may cover smaller circles (they stay visible under its white outline), never a
      // bigger circle or another label.
      const circles = v.dots.map((d) => { const r = radius(d.n); return { n: d.n, b: [d.x - r, d.y - r, d.x + r, d.y + r] }; });
      const taken = [];
      const hit = (b, t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1];
      let current = 0;
      const clash = (b) => taken.some((t) => hit(b, t)) || circles.some((c) => c.n >= current && hit(b, c.b));
      let shown = 0;
      for (const d of [...v.dots].sort((a, b) => b.n - a.n)) {
        if (shown >= 14) break;
        const text = `${d.label} ${d.n}`;
        current = d.n;
        const tw = text.length * 2.2 * 0.5, r = radius(d.n);
        // Right, left, above, below the circle: the first place that is free.
        const options = [[d.x + r + 0.6, d.y + 0.8, "start"], [d.x - r - 0.6, d.y + 0.8, "end"],
                         [d.x, d.y - r - 0.7, "middle"], [d.x, d.y + r + 2.3, "middle"]];
        for (const [tx, ty, anchor] of options) {
          const bx0 = anchor === "start" ? tx : anchor === "end" ? tx - tw : tx - tw / 2;
          const b = [bx0, ty - 2, bx0 + tw, ty + 0.5];
          if (b[0] < v.fx || b[2] > v.fx + cellW || clash(b)) continue;
          taken.push(b);
          s += `<text x="${f2(tx)}" y="${f2(ty)}" font-size="2.2" text-anchor="${anchor}" fill="#222" stroke="#fff" stroke-width="0.5" paint-order="stroke">${esc(text)}</text>`;
          shown++;
          break;
        }
      }
      s += `</g>`;
    }
    return s;
  }

  const api = { birthMap, equalEarth };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.FamilyBookMap = api;
})(typeof window !== "undefined" ? window : globalThis);

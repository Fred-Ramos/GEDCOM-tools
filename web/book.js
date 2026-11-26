// Family book (A4, portrait) for GEDCOM Tools. Plain JavaScript, no dependencies; needs tree.js.
//
// Every family of the tree is drawn exactly once, as a sideways descendant chart: a couple box, and
// to its right the children stacked downwards (generations are columns, 4 per page). A family hangs
// under the husband's parents' family (or, when his parents are unknown, the wife's); families with
// neither are the roots, and each big root starts a chapter.
//
// One full entry per person: where they formed their own family (with spouse and children), or, for
// people without a family of their own, among their parents' children. Every other appearance is a
// short box with a page reference (→ p.), and couple boxes point to the spouse's parents (◄ p.) and,
// at the top of a page, to where the person appears as a child (↑ p.).
//
// Page breaks: a family whose children would fall beyond the 4th column, or a page that is too tall,
// is cut off (largest branch first) and continues as its own chart. Small charts share pages.
// Notes are never printed. Output: one SVG string per A4 page (mm units), for preview and printing.
(function (global) {
  "use strict";

  const T = typeof module === "object" && module.exports ? require("./tree.js") : global.FamilyTree;
  const { esc, normalize } = T.internals;

  const LABELS = {
    pt: {
      title: "Livro de Família", contents: "Índice geral", index: "Índice onomástico", family: "Família",
      otherFamilies: "Outras famílias", second: "2.º casamento", people: "pessoas", families: "famílias",
      made: "Gerado em", noSurname: "sem apelido", how: "Como ler", howText: [
        "Cada pessoa tem uma entrada completa, com o número entre parênteses rectos [n.º].",
        "→ p. página onde está a entrada completa ou a continuação da família.",
        "◄ p. página onde estão os pais do cônjuge.   ↑ p. página onde a pessoa aparece como filho/a.",
        "* nascimento ou batismo   † morte ou enterro   ∞ casamento   ? pessoa desconhecida"],
    },
    en: {
      title: "Family Book", contents: "Contents", index: "Index of names", family: "Family",
      otherFamilies: "Other families", second: "2nd marriage", people: "people", families: "families",
      made: "Made on", noSurname: "no surname", how: "How to read", howText: [
        "Every person has one full entry, with their number in square brackets [no.].",
        "→ p. page with the full entry, or where the family continues.",
        "◄ p. page with the spouse's parents.   ↑ p. page where the person appears as a child.",
        "* birth or baptism   † death or burial   ∞ marriage   ? unknown person"],
    },
  };

  // Page geometry (mm).
  const PAGE_W = 210, PAGE_H = 297, ML = 10, MT = 14, MB = 16;
  const BODY = PAGE_H - MT - MB;
  const COLS = 4, BW = 43, CG = 6;           // 4 generation columns of 43 mm, 6 mm for brackets
  const PW = 8.5, PH = 10.5;                  // photo frame beside each full entry
  const LH = 3.0, PAD = 1.5, GAP = 1.6, TREE_GAP = 7, CAPTION = 7;
  const FONT = 2.3, FONT_NAME = 2.45, FONT_SMALL = 1.9;
  const CHARS = 32;                           // characters per box line at FONT (kept safe for wide fonts)
  const CHARS_PHOTO = 25;                     // ... when a photo frame takes part of the box
  const LINES = {
    compact: { single: 1, couple: 2, short: 1 },
    standard: { single: 2, couple: 4, short: 2 },
    detailed: { single: 3, couple: 6, short: 2 },
  };

  const fit = (text, max) => (text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text);
  const f2 = (v) => Math.round(v * 100) / 100;
  const shortPlace = (place) => (place ? String(place).split(",")[0].trim() : "");

  function buildBook(tree, options = {}) {
    const lang = LABELS[options.lang] ? options.lang : "pt";
    const level = LINES[options.level] ? options.level : "standard";
    const L = LABELS[lang];
    const title = (options.title || "").trim() || L.title;
    const idx = T.indexTree(tree);
    const fam = new Map(idx.families().map((id) => [id, idx.family(id)]));
    const lines = LINES[level];
    // Photo frames: in standard and detailed books, unless turned off. photoFor(id) gives an image URL.
    const framed = options.photos !== false && level !== "compact";
    const photoFor = options.photoFor || (() => null);
    const segH = (rows) => (framed ? Math.max(rows * LH, PH + 0.8) : rows * LH);
    const H = { single: segH(lines.single) + PAD, couple: 2 * segH(lines.couple / 2) + PAD, short: lines.short * LH + PAD };

    // ---- Where everything belongs ----------------------------------------------------
    const firstFamily = new Map();                 // person -> the family holding their full entry
    for (const pid of idx.people()) {
      const u = idx.unions(pid).find((x) => fam.has(x.famId));
      if (u) firstFamily.set(pid, u.famId);
    }
    const placedUnder = new Map();                 // "parentFamily|child" -> [families of that child]
    const roots = [];
    for (const [id, f] of fam) {
      let placed = null;
      for (const via of [f.husband, f.wife]) {
        const pf = via && idx.parentFamily(via);
        if (pf && fam.has(pf) && fam.get(pf).children.includes(via)) { placed = { pf, via }; break; }
      }
      if (placed) {
        const key = `${placed.pf}|${placed.via}`;
        if (!placedUnder.has(key)) placedUnder.set(key, []);
        placedUnder.get(key).push(id);
      } else {
        roots.push(id);
      }
    }
    const viaFams = (F, c) => placedUnder.get(`${F}|${c}`) || [];
    const below = (F) => fam.get(F).children.flatMap((c) => viaFams(F, c));
    const famCount = new Map();
    const countFams = (F) => {
      if (!famCount.has(F)) famCount.set(F, 1 + below(F).reduce((s, G) => s + countFams(G), 0));
      return famCount.get(F);
    };
    roots.forEach(countFams);
    roots.sort((a, b) => countFams(b) - countFams(a) || fam.get(b).children.length - fam.get(a).children.length);

    // ---- Layout of one chart (abstract boxes, heights only) ---------------------------
    const cut = new Set();                          // families that continue as their own chart
    function place(F, d, top, out, via, second, heights) {
      const f = fam.get(F);
      const a = via || f.husband || f.wife;
      const b = a === f.husband ? f.wife : a === f.wife ? f.husband : null;
      if (out) out.push({ type: "couple", fam: F, a, b, second: !!second, d, y: top, h: H.couple });
      let y = top;
      const anchors = [];
      if (d < COLS - 1) {
        for (const c of f.children) {
          const placed = viaFams(F, c);
          if (placed.length) {
            placed.forEach((G, i) => {
              if (d + 1 === COLS - 1 && fam.get(G).children.length) cut.add(G);   // no room for its children
              if (cut.has(G)) {
                if (out) out.push({ type: "short", kind: "cut", pid: c, fam: G, second: i > 0, d: d + 1, y, h: H.short });
                anchors.push(y);
                y += H.short + GAP;
              } else {
                const h = place(G, d + 1, y, out, c, i > 0, heights);
                anchors.push(y);
                y += h + GAP;
              }
            });
          } else if (!firstFamily.has(c)) {
            if (out) out.push({ type: "single", pid: c, d: d + 1, y, h: H.single });
            anchors.push(y);
            y += H.single + GAP;
          } else {
            if (out) out.push({ type: "short", kind: "elsewhere", pid: c, fam: firstFamily.get(c), d: d + 1, y, h: H.short });
            anchors.push(y);
            y += H.short + GAP;
          }
        }
      }
      if (out && anchors.length) out.push({ type: "bracket", d, from: top, anchors });
      const h = Math.max(H.couple, anchors.length ? y - GAP - top : 0);
      if (heights) heights.set(F, h);
      return h;
    }

    // Cut the largest branches until the chart fits on a page.
    function fitChart(R, extra) {
      for (let guard = 0; guard < 1000; guard++) {
        const heights = new Map();
        const h = place(R, 0, 0, null, null, false, heights) + extra;
        if (h <= BODY) return h;
        const candidates = [...heights].filter(([F]) => F !== R && fam.get(F).children.length)
                                       .sort((x, y) => y[1] - x[1]);
        if (!candidates.length) return h;
        cut.add(candidates[0][0]);
      }
      return BODY;
    }

    // Charts in reading order: each root, then (depth first) the branches cut from it.
    const charts = [];
    const chapterRoots = new Set(roots.filter((R) => countFams(R) >= 3));
    function emit(R, isRoot) {
      const caption = isRoot && chapterRoots.has(R);
      const h = fitChart(R, caption ? CAPTION : 0);
      charts.push({ root: R, h, caption, isRoot });
      const out = [];
      place(R, 0, 0, out);
      for (const b of out) if (b.type === "short" && b.kind === "cut") emit(b.fam, false);
    }
    roots.forEach((R) => emit(R, true));

    // ---- Pages ---------------------------------------------------------------------------
    const tocLines = chapterRoots.size + 3;
    const tocPages = Math.max(1, Math.ceil(tocLines / 72));
    let pageNo = 1 + tocPages + 1;                  // cover, contents, then charts
    let used = Infinity;
    const chartPages = [];
    for (const c of charts) {
      const need = (used > 0 && used !== Infinity ? TREE_GAP : 0) + c.h;
      if (used === Infinity || used + need > BODY) {
        chartPages.push({ no: chartPages.length ? chartPages[chartPages.length - 1].no + 1 : pageNo, charts: [] });
        used = 0;
      }
      const page = chartPages[chartPages.length - 1];
      c.y = used + (page.charts.length ? TREE_GAP : 0);
      c.page = page.no;
      page.charts.push(c);
      used = c.y + c.h;
    }

    // Which page each family is drawn on, and the boxes of every chart.
    const famPage = new Map();
    for (const c of charts) {
      c.boxes = [];
      place(c.root, 0, c.caption ? CAPTION : 0, c.boxes);
      for (const b of c.boxes) if (b.type === "couple") famPage.set(b.fam, c.page);
    }
    const fullPage = (pid) => (firstFamily.has(pid) ? famPage.get(firstFamily.get(pid))
                                                     : famPage.get(idx.parentFamily(pid)));
    const childPage = (pid) => famPage.get(idx.parentFamily(pid));

    // Numbers in reading order of the full entries.
    const number = new Map();
    for (const c of charts) {
      for (const b of c.boxes) {
        const people = b.type === "couple" ? [b.a, b.b] : b.type === "single" ? [b.pid] : [];
        for (const pid of people) {
          const isFull = pid && (b.type === "single" || firstFamily.get(pid) === b.fam);
          if (isFull && !number.has(pid)) number.set(pid, number.size + 1);
        }
      }
    }

    // ---- Drawing ---------------------------------------------------------------------------
    const appearances = new Map();                  // person -> Map(page -> full?)
    const appear = (pid, page, full) => {
      if (!pid) return;
      if (!appearances.has(pid)) appearances.set(pid, new Map());
      const m = appearances.get(pid);
      m.set(page, m.get(page) || full);
    };
    const info = (pid) => idx.info(pid);
    const no = (pid) => (number.has(pid) ? `[${number.get(pid)}]` : "");
    let drawingPage = 0;                            // references to the page being drawn are left out
    const ref = (sign, page) => (page && page !== drawingPage ? `${sign} ${f2(page)}` : "");
    const life = (pid) => {
      const p = info(pid);
      if (level === "compact") return p.years ? `(${p.years})` : "";
      const part = (sign, e) => (e.year || e.place ? `${sign} ${[e.year, shortPlace(e.place)].filter(Boolean).join(" ")}` : "");
      return [part("*", p.birth), part("†", p.death)].filter(Boolean).join("  ");
    };
    const displayName = (pid) => {
      const p = info(pid);
      return level !== "compact" && p.nick ? `${p.name} '${p.nick}'` : p.name;
    };

    function textLine(x, y, left, right, opts = {}) {
      const size = opts.size || FONT;
      const max = (opts.chars || CHARS) - (right ? right.length + 1 : 0);
      let s = `<text x="${f2(x + 1 + (opts.indent || 0))}" y="${f2(y)}" font-size="${opts.bold ? FONT_NAME : size}"` +
        `${opts.bold ? ' font-weight="bold"' : ""}${opts.italic ? ' font-style="italic"' : ""} fill="${opts.color || "#111"}">` +
        `${esc(fit(left, opts.bold ? max - 4 : max))}</text>`;
      if (right) {
        s += `<text x="${f2(x + BW - 1)}" y="${f2(y)}" font-size="${FONT_SMALL}" text-anchor="end" fill="#666">${esc(right)}</text>`;
      }
      return s;
    }

    function drawBox(b, x, y0, page) {
      const y = y0 + b.y;
      let rows = [];        // [left, right, opts] of the current person
      const segments = [];  // one per person: { pid, rows, photo }
      const person = (pid, photo) => { rows = []; segments.push({ pid, rows, photo }); };
      let style = 'fill="#ffffff" stroke="#555" stroke-width="0.25"';
      if (b.type === "couple") {
        const fullA = firstFamily.get(b.a) === b.fam;
        const fullB = b.b && firstFamily.get(b.b) === b.fam;
        const f = fam.get(b.fam);
        appear(b.a, page, fullA);
        appear(b.b, page, fullB);
        const up = b.d === 0 && idx.parentFamily(b.a) ? ref("↑ p.", childPage(b.a)) : "";
        const nameA = b.second && !fullA ? `${displayName(b.a)} (${L.second})` : displayName(b.a);
        const rightA = fullA ? no(b.a) : ref("→ p.", fullPage(b.a));
        const spouseParents = b.b && idx.parentFamily(b.b) ? ref("◄ p.", childPage(b.b)) : "";
        const married = f.marriage.year ? `${f.marriage.year} ` : "";
        const nameB = b.b ? `∞ ${level === "compact" ? "" : married}${displayName(b.b)}` : "∞ ?";
        const rightB = b.b ? (fullB ? no(b.b) : ref("→ p.", fullPage(b.b))) : "";
        if (level === "compact") {
          person(b.a, false);
          rows.push([`${nameA} ${fullA ? life(b.a) : ""} ${up}`.trim(), rightA, { bold: true }]);
          person(b.b, false);
          rows.push([`${nameB} ${b.b && fullB ? life(b.b) : ""} ${spouseParents}`.trim(), rightB, {}]);
        } else {
          person(b.a, fullA);
          rows.push([nameA, rightA, { bold: true }]);
          rows.push([fullA ? life(b.a) : "", up, {}]);
          if (level === "detailed") rows.push([fullA ? info(b.a).occupation : "", "", { italic: true, color: "#444" }]);
          person(b.b, !!(b.b && fullB));
          rows.push([nameB, rightB, { bold: !!b.b }]);
          rows.push([b.b && fullB ? life(b.b) : "", spouseParents, {}]);
          if (level === "detailed") rows.push([b.b && fullB ? info(b.b).occupation : "", "", { italic: true, color: "#444" }]);
        }
      } else if (b.type === "single") {
        appear(b.pid, page, true);
        person(b.pid, true);
        if (level === "compact") rows.push([`${displayName(b.pid)} ${life(b.pid)}`.trim(), no(b.pid), { bold: true }]);
        else {
          rows.push([displayName(b.pid), no(b.pid), { bold: true }]);
          rows.push([life(b.pid), "", {}]);
          if (level === "detailed") rows.push([info(b.pid).occupation, "", { italic: true, color: "#444" }]);
        }
      } else {
        appear(b.pid, page, false);
        person(b.pid, false);
        style = 'fill="#f6f6f6" stroke="#999" stroke-width="0.2" stroke-dasharray="0.8 0.5"';
        const target = b.kind === "cut" ? famPage.get(b.fam) : fullPage(b.pid);
        const name = b.second ? `${displayName(b.pid)} (${L.second})` : displayName(b.pid);
        const years = info(b.pid).years ? `(${info(b.pid).years})` : "";
        if (level === "compact") rows.push([`${name} ${years}`.trim(), ref("→ p.", target), { italic: true, color: "#444" }]);
        else {
          rows.push([name, no(b.pid), { italic: true, color: "#444" }]);
          rows.push([years, ref("→ p.", target), { color: "#444" }]);
        }
      }
      let s = `<rect x="${f2(x)}" y="${f2(y)}" width="${BW}" height="${f2(b.h)}" ${style}/>`;
      let top = y + PAD / 2;
      for (const seg of segments) {
        const withFrame = framed && b.type !== "short";
        if (withFrame && seg.photo) {
          // A portrait frame: the photo if there is one, otherwise empty space for it.
          const fx = x + 1, fy = top + 0.3;
          const url = photoFor(seg.pid);
          s += `<rect x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" fill="#fafafa" stroke="#c8c8c8" stroke-width="0.2"/>`;
          if (url) {
            s += `<image href="${esc(url)}" x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice"/>` +
                 `<rect x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" fill="none" stroke="#777" stroke-width="0.2"/>`;
          }
        }
        const opts = withFrame ? { indent: PW + 1, chars: CHARS_PHOTO } : {};
        seg.rows.forEach(([left, right, o], i) => {
          s += textLine(x, top + LH * (i + 0.78), left, right, { ...o, ...opts });
        });
        top += b.type === "short" ? seg.rows.length * LH : segH(seg.rows.length);
      }
      return s;
    }

    function drawChart(c) {
      drawingPage = c.page;
      const y0 = MT + c.y;
      let s = "";
      if (c.caption) {
        const f = fam.get(c.root);
        const head = f.husband || f.wife;
        const surname = head && info(head).surname;
        s += `<text x="${ML}" y="${f2(y0 + 4.2)}" font-size="3.6" font-weight="bold" fill="#3a2a18">` +
             `${esc(`${L.family} ${surname || (head ? info(head).name : "?")}`)}</text>` +
             `<line x1="${ML}" y1="${f2(y0 + 5.6)}" x2="${PAGE_W - ML}" y2="${f2(y0 + 5.6)}" stroke="#b8a46a" stroke-width="0.3"/>`;
      }
      let lines = "";
      for (const b of c.boxes) {
        const x = ML + b.d * (BW + CG);
        if (b.type === "bracket") {
          const from = x + BW, mid = from + CG / 2, py = y0 + b.from + LH;
          const ys = b.anchors.map((a) => y0 + a + LH);
          lines += `M${f2(from)} ${f2(py)}H${f2(mid)}M${f2(mid)} ${f2(Math.min(py, ...ys))}V${f2(Math.max(py, ...ys))}`;
          for (const ay of ys) lines += `M${f2(mid)} ${f2(ay)}H${f2(mid + CG / 2)}`;
        } else {
          s += drawBox(b, x, y0, c.page);
        }
      }
      return `<path d="${lines}" fill="none" stroke="#333" stroke-width="0.25"/>` + s;
    }

    const svg = (content, page, header = true) =>
      `<svg xmlns="http://www.w3.org/2000/svg" class="book-page" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm"` +
      ` font-family="Georgia, 'Times New Roman', serif"><rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>` +
      (header ? `<text x="${PAGE_W - ML}" y="8" font-size="2.4" text-anchor="end" fill="#888" font-style="italic">${esc(title)}</text>` : "") +
      content +
      (page ? `<text x="${PAGE_W / 2}" y="${PAGE_H - 8}" font-size="2.8" text-anchor="middle" fill="#444">${page}</text>` : "") +
      `</svg>`;

    const pages = [];
    // Cover.
    const date = new Date().toISOString().slice(0, 10);
    pages.push(svg(
      `<rect x="20" y="20" width="170" height="257" fill="none" stroke="#b8a46a" stroke-width="0.8"/>` +
      `<rect x="23" y="23" width="164" height="251" fill="none" stroke="#cdbd8a" stroke-width="0.3"/>` +
      `<text x="105" y="120" font-size="13" text-anchor="middle" font-style="italic" fill="#2a1d12">${esc(fit(title, 28))}</text>` +
      `<text x="105" y="136" font-size="4.5" text-anchor="middle" fill="#555">${idx.people().length} ${L.people} · ${fam.size} ${L.families}</text>` +
      `<text x="105" y="250" font-size="3.2" text-anchor="middle" fill="#888">${L.made} ${date}</text>`, null, false));

    // Charts.
    const chartSvgs = chartPages.map((p) => svg(p.charts.map(drawChart).join(""), p.no));

    // Index (needs the appearances recorded while drawing the charts).
    const indexStart = chartPages.length ? chartPages[chartPages.length - 1].no + 1 : pageNo;
    const particles = /^(da|de|do|dos|das|d')\s+/i;
    const entries = [...appearances.keys()].map((pid) => {
      const p = info(pid);
      const sur = p.surname || "";
      const given = sur && p.name.endsWith(sur) ? p.name.slice(0, -sur.length).trim() : p.name;
      // People without a surname go after everyone else, sorted by given name.
      const key = sur ? normalize(sur.replace(particles, "") + " " + given) : "\uffff" + normalize(p.name);
      const label = sur ? `${sur}, ${given}` : `${p.name} (${L.noSurname})`;
      const pgs = [...appearances.get(pid)].sort((a, b) => a[0] - b[0]);
      return { key, label: `${label}${p.years ? ` (${p.years})` : ""}`, no: number.get(pid), pages: pgs };
    }).sort((a, b) => a.key.localeCompare(b.key));
    const perColumn = Math.floor((BODY - 10) / 3.1);
    const colW = (PAGE_W - 2 * ML - 6) / 2;
    const indexSvgs = [];
    for (let i = 0, page = indexStart; i < entries.length; i += perColumn * 2, page++) {
      let s = `<text x="${ML}" y="${MT + 2}" font-size="5" font-weight="bold" fill="#2a1d12">${esc(L.index)}</text>`;
      for (let col = 0; col < 2; col++) {
        entries.slice(i + col * perColumn, i + (col + 1) * perColumn).forEach((e, row) => {
          const x = ML + col * (colW + 6);
          const y = MT + 10 + row * 3.1;
          const pagesText = e.pages.map(([pg, full]) => (full ? `<tspan font-weight="bold">${pg}</tspan>` : `${pg}`)).join(", ");
          const plain = e.pages.map(([pg]) => pg).join(", ");
          s += `<text x="${f2(x)}" y="${f2(y)}" font-size="2.2" fill="#111">${esc(fit(e.label, Math.floor(colW / 1.05) - plain.length - 8))}` +
               `${e.no ? ` <tspan fill="#777" font-size="1.8">[${e.no}]</tspan>` : ""}</text>` +
               `<text x="${f2(x + colW)}" y="${f2(y)}" font-size="2.2" text-anchor="end" fill="#333">${pagesText}</text>`;
        });
      }
      indexSvgs.push(svg(s, page));
    }

    // Contents.
    const toc = [];
    for (const c of charts) {
      if (c.caption) {
        const f = fam.get(c.root);
        const names = [f.husband, f.wife].filter(Boolean).map((x) => info(x).name).join(" & ");
        const head = f.husband || f.wife;
        const surname = head && info(head).surname;
        toc.push([`${L.family} ${surname || names}`, surname ? names : "", c.page]);
      }
    }
    const firstSmall = charts.find((c) => c.isRoot && !c.caption);
    if (firstSmall) toc.push([L.otherFamilies, "", firstSmall.page]);
    toc.push([L.index, "", indexStart]);
    const tocSvgs = [];
    for (let i = 0, page = 2; i < Math.max(toc.length, 1); i += 72, page++) {
      let s = `<text x="${ML}" y="${MT + 2}" font-size="5" font-weight="bold" fill="#2a1d12">${esc(L.contents)}</text>`;
      toc.slice(i, i + 72).forEach(([name, sub, pg], row) => {
        const y = MT + 10 + row * 3.4;
        s += `<text x="${ML}" y="${f2(y)}" font-size="2.6" fill="#111">${esc(fit(name, 45))}` +
             `${sub ? ` <tspan fill="#777" font-size="2.1">${esc(fit(sub, 60))}</tspan>` : ""}</text>` +
             `<text x="${PAGE_W - ML}" y="${f2(y)}" font-size="2.6" text-anchor="end" fill="#111">${pg}</text>`;
      });
      if (i === 0) {
        const y = PAGE_H - MB - 22;
        s += `<text x="${ML}" y="${y}" font-size="3" font-weight="bold" fill="#2a1d12">${esc(L.how)}</text>` +
             L.howText.map((t, k) => `<text x="${ML}" y="${f2(y + 4.5 + k * 3.4)}" font-size="2.4" fill="#333">${esc(t)}</text>`).join("");
      }
      tocSvgs.push(svg(s, page));
    }

    pages.push(...tocSvgs, ...chartSvgs, ...indexSvgs);

    // Self-check: everyone has exactly one full entry.
    const full = [...appearances].filter(([, m]) => [...m.values()].some(Boolean)).length;
    return {
      pages,
      stats: {
        people: idx.people().length, families: fam.size, pages: pages.length, chartPages: chartSvgs.length,
        indexPages: indexSvgs.length, chapters: chapterRoots.size, charts: charts.length,
        withFullEntry: full, numbered: number.size,
      },
    };
  }

  const api = { buildBook, LABELS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.FamilyBook = api;
})(typeof window !== "undefined" ? window : globalThis);

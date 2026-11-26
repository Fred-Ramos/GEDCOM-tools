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
      otherFamilies: "Outras famílias", marriageNo: (n) => `${n}.º casamento`, divorced: "div.",
      people: "pessoas", families: "famílias",
      made: "Gerado em", noSurname: "sem apelido", how: "Como ler", howText: [
        "Cada pessoa tem uma entrada completa, com o número entre parênteses rectos [n.º].",
        "→ p. página onde está a entrada completa ou a continuação da família.",
        "◄ p. página onde estão os pais do cônjuge.   ↑ p. página onde a pessoa aparece como filho/a.",
        "* nascimento ou batismo   † morte ou enterro   ∞ casamento (∞¹ ∞² ordem)   div. divórcio   ? desconhecido"],
    },
    en: {
      title: "Family Book", contents: "Contents", index: "Index of names", family: "Family",
      otherFamilies: "Other families", divorced: "div.",
      marriageNo: (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} marriage`,
      people: "people", families: "families",
      made: "Made on", noSurname: "no surname", how: "How to read", howText: [
        "Every person has one full entry, with their number in square brackets [no.].",
        "→ p. page with the full entry, or where the family continues.",
        "◄ p. page with the spouse's parents.   ↑ p. page where the person appears as a child.",
        "* birth or baptism   † death or burial   ∞ marriage (∞¹ ∞² order)   div. divorced   ? unknown"],
    },
  };

  // Page geometry (mm).
  const PAGE_W = 210, PAGE_H = 297, ML = 10, MT = 14, MB = 16;
  const BODY = PAGE_H - MT - MB;
  const COLS = 4, BW = 43, CG = 6;           // 4 generation columns of 43 mm, 6 mm for brackets
  const PW = 8.5, PH = 10.5;                  // photo frame beside each full entry
  const LH = 3.0, PAD = 1.5, GAP = 1.6, TREE_GAP = 7, CAPTION = 7;
  const FONT = 2.3, FONT_NAME = 2.45, FONT_SMALL = 1.9;
  const LEVELS = ["compact", "standard", "detailed"];
  const MIN_SCALE = 0.86;                     // a line may shrink this much before it wraps instead

  // Text width in mm. In the browser it is measured on a canvas with the page's own fonts; elsewhere
  // (tests, Node) it is estimated, a little generously.
  function estimateWidth(text, size, bold) {
    let w = 0;
    for (const ch of text) {
      w += /[il.,;:'|!jtfI()[\] ]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.86 :
           /[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9∞†*→↑◄]/.test(ch) ? 0.66 : 0.55;
    }
    return w * size * (bold ? 1.08 : 1);
  }
  function makeMeasure(custom) {
    if (custom) return custom;
    try {
      const ctx = typeof document !== "undefined" && document.createElement("canvas").getContext("2d");
      if (ctx && ctx.measureText) {
        const cache = new Map();
        return (text, size, bold, italic) => {
          const key = `${bold ? 1 : 0}${italic ? 1 : 0}${text}`;
          if (!cache.has(key)) {
            ctx.font = `${italic ? "italic " : ""}${bold ? "bold " : ""}100px Georgia, "Times New Roman", serif`;
            cache.set(key, ctx.measureText(text).width / 100);
          }
          return cache.get(key) * size;
        };
      }
    } catch (e) { /* no canvas: estimate */ }
    return estimateWidth;
  }

  const fit = (text, max) => (text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text);
  const f2 = (v) => Math.round(v * 100) / 100;
  const shortPlace = (place) => (place ? String(place).split(",")[0].trim() : "");

  function buildBook(tree, options = {}) {
    const lang = LABELS[options.lang] ? options.lang : "pt";
    const level = LEVELS.includes(options.level) ? options.level : "standard";
    const L = LABELS[lang];
    const title = (options.title || "").trim() || L.title;
    const idx = T.indexTree(tree);
    const fam = new Map(idx.families().map((id) => [id, idx.family(id)]));
    // Photo frames: in standard and detailed books, unless turned off. photoFor(id) gives an image URL.
    const framed = options.photos !== false && level !== "compact";
    const photoFor = options.photoFor || (() => null);
    const measure = makeMeasure(options.measure);

    // ---- Where everything belongs ----------------------------------------------------
    // Each person's unions in time order (by marriage year when all are known, otherwise as recorded).
    const unionsOf = new Map();
    for (const pid of idx.people()) {
      const list = idx.unions(pid).map((u) => u.famId).filter((id) => fam.has(id));
      if (list.length > 1 && list.every((id) => fam.get(id).marriage.year)) {
        list.sort((x, y) => Number(fam.get(x).marriage.year) - Number(fam.get(y).marriage.year));
      }
      if (list.length) unionsOf.set(pid, list);
    }
    const unionNo = (pid, F) => { const list = unionsOf.get(pid) || []; return list.length > 1 ? list.indexOf(F) + 1 : 0; };
    // The full entry is with the first union.
    const firstFamily = new Map([...unionsOf].map(([pid, list]) => [pid, list[0]]));
    const placedUnder = new Map();                 // "parentFamily|child" -> [families of that child]
    const placementOf = new Map();                 // family -> { pf, via }
    const roots = [];
    for (const [id, f] of fam) {
      let placed = null;
      for (const via of [f.husband, f.wife]) {
        const pf = via && idx.parentFamily(via);
        if (pf && fam.has(pf) && fam.get(pf).children.includes(via)) { placed = { pf, via }; break; }
      }
      if (placed) {
        placementOf.set(id, placed);
        const key = `${placed.pf}|${placed.via}`;
        if (!placedUnder.has(key)) placedUnder.set(key, []);
        placedUnder.get(key).push(id);
      } else {
        roots.push(id);
      }
    }
    // A person's unions drawn under their parents are stacked in time order.
    for (const [key, list] of placedUnder) {
      const via = key.slice(key.indexOf("|") + 1);
      list.sort((x, y) => unionNo(via, x) - unionNo(via, y));
    }
    const stackedTogether = (F, G) => {
      const a = placementOf.get(F), b = placementOf.get(G);
      return !!(a && b && a.pf === b.pf && a.via === b.via);
    };
    const viaFams = (F, c) => placedUnder.get(`${F}|${c}`) || [];
    const below = (F) => fam.get(F).children.flatMap((c) => viaFams(F, c));
    const famCount = new Map();
    const countFams = (F) => {
      if (!famCount.has(F)) famCount.set(F, 1 + below(F).reduce((s, G) => s + countFams(G), 0));
      return famCount.get(F);
    };
    roots.forEach(countFams);
    roots.sort((a, b) => countFams(b) - countFams(a) || fam.get(b).children.length - fam.get(a).children.length);

    // ---- What each box says (measured, wrapped; independent of page numbers) ---------
    const info = (pid) => idx.info(pid);
    const displayName = (pid) => {
      const p = info(pid);
      return level !== "compact" && p.nick ? `${p.name} '${p.nick}'` : p.name;
    };
    const lifeParts = (pid) => {
      const p = info(pid);
      const part = (sign, e) => (e.year || e.place ? `${sign} ${[e.year, shortPlace(e.place)].filter(Boolean).join(" ")}` : "");
      return [part("*", p.birth), part("†", p.death)].filter(Boolean);
    };
    const yearsText = (pid) => (info(pid).years ? `(${info(pid).years})` : "");

    // Markers on the right of a line: a person's number, or a page reference (resolved when drawing).
    const digits = String(idx.people().length).length;
    const num = (pid) => ({ type: "num", pid });
    const goto = (sign, to) => ({ type: "ref", sign, to });
    const markerWidth = (m) => measure(m.type === "num" ? `[${"8".repeat(digits)}]` : `${m.sign} 888`, FONT_SMALL) + 1.8;
    const row = (text, style = {}, markers = []) => ({ text: text || "", style, markers: markers.filter(Boolean) });

    // Fit one text into a first line of `firstWidth` mm and further lines of `width` mm:
    // as it is, slightly smaller, or wrapped onto more lines. Never cut.
    function wrapText(text, size, bold, italic, firstWidth, width) {
      const w = measure(text, size, bold, italic);
      if (w <= firstWidth) return [{ text, size }];
      if (w * MIN_SCALE <= firstWidth) return [{ text, size: size * firstWidth / w }];
      const out = [];
      let line = "";
      for (const word of text.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (!line || measure(next, size, bold, italic) <= (out.length ? width : firstWidth)) line = next;
        else { out.push(line); line = word; }
      }
      out.push(line);
      // A single word wider than the box (rare) is shrunk to fit.
      return out.map((t, i) => {
        const limit = i ? width : firstWidth;
        const lw = measure(t, size, bold, italic);
        return { text: t, size: lw > limit ? size * limit / lw : size };
      });
    }

    function layoutRows(rows, withFrame) {
      const width = BW - 2 - (withFrame ? PW + 1 : 0);
      const lines = [];
      for (const r of rows) {
        const reserve = r.markers.reduce((sum, m) => sum + markerWidth(m), 0);
        const size = r.style.bold ? FONT_NAME : FONT;
        const parts = r.text ? wrapText(r.text, size, r.style.bold, r.style.italic, width - reserve, width) : [{ text: "", size }];
        parts.forEach((p, i) => lines.push({ ...p, style: r.style, markers: i === 0 ? r.markers : [] }));
      }
      return lines;
    }

    // Birth and death share a line when they fit, otherwise one line each.
    function lifeRows(pid, markers, withFrame) {
      const parts = lifeParts(pid);
      if (!parts.length) return markers.filter(Boolean).length ? [row("", {}, markers)] : [];
      const joined = row(parts.join("  "), {}, markers);
      if (parts.length === 1 || layoutRows([joined], withFrame).length === 1) return [joined];
      return [row(parts[0], {}, markers), row(parts[1])];
    }

    const sup = (n) => (n ? String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]) : "");
    const divorceText = (F) => {
      const dv = fam.get(F).divorce;
      return dv ? ` · ${L.divorced}${dv.year ? ` ${dv.year}` : ""}` : "";
    };

    const contentCache = new Map();
    function contents(b) {
      const key = b.type === "couple" ? `c|${b.fam}|${b.a}|${b.second}|${b.d === 0}`
                                      : `${b.type}|${b.kind || ""}|${b.pid}|${b.fam || ""}|${!!b.second}`;
      if (contentCache.has(key)) return contentCache.get(key);
      const segments = [];
      const seg = (pid, photo, rows) => {
        const withFrame = framed && photo;
        segments.push({ pid, photo: withFrame, lines: layoutRows(rows, withFrame) });
      };
      const occupation = (pid, withFrame) =>
        (level === "detailed" && info(pid).occupation ? [row(info(pid).occupation, { italic: true, color: "#444" })] : []);
      if (b.type === "couple") {
        const f = fam.get(b.fam);
        const fullA = firstFamily.get(b.a) === b.fam;
        const fullB = b.b && firstFamily.get(b.b) === b.fam;
        const markA = fullA ? num(b.a) : goto("→ p.", () => fullPage(b.a));
        const up = b.d === 0 && idx.parentFamily(b.a) ? goto("↑ p.", () => childPage(b.a)) : null;
        const markB = b.b ? (fullB ? num(b.b) : goto("→ p.", () => fullPage(b.b))) : null;
        const spouseParents = b.b && idx.parentFamily(b.b) ? goto("◄ p.", () => childPage(b.b)) : null;
        const n = unionNo(b.a, b.fam);
        const nameA = b.second && !fullA ? `${displayName(b.a)} (${L.marriageNo(n)})` : displayName(b.a);
        const married = level !== "compact" && f.marriage.year ? `${f.marriage.year} ` : "";
        const nameB = `∞${sup(n)} ${married}${b.b ? displayName(b.b) : "?"}${divorceText(b.fam)}`;
        // At a full entry, every other union of that person that is not stacked right here.
        const otherUnions = (pid) => (unionsOf.get(pid) || [])
          .filter((G) => G !== b.fam && !stackedTogether(G, b.fam))
          .map((G) => {
            const g = fam.get(G);
            const spouse = g.husband === pid ? g.wife : g.husband;
            return row(`∞${sup(unionNo(pid, G))} ${spouse ? displayName(spouse) : "?"}${divorceText(G)}`,
                       { color: "#444" }, [goto("→ p.", () => famPage.get(G))]);
          });
        if (level === "compact") {
          seg(b.a, false, [row(`${nameA} ${fullA ? yearsText(b.a) : ""}`.trim(), { bold: true }, [markA, up]),
                           ...(fullA ? otherUnions(b.a) : [])]);
          seg(b.b, false, [row(`${nameB} ${fullB ? yearsText(b.b) : ""}`.trim(), {}, [markB, spouseParents]),
                           ...(fullB ? otherUnions(b.b) : [])]);
        } else {
          seg(b.a, fullA, [row(nameA, { bold: true }, [markA]),
                           ...(fullA ? lifeRows(b.a, [up], framed) : up ? [row("", {}, [up])] : []),
                           ...(fullA ? occupation(b.a) : []),
                           ...(fullA ? otherUnions(b.a) : [])]);
          seg(b.b, !!fullB, [row(nameB, { bold: !!b.b }, [markB]),
                             ...(fullB ? lifeRows(b.b, [spouseParents], framed) : spouseParents ? [row("", {}, [spouseParents])] : []),
                             ...(fullB ? occupation(b.b) : []),
                             ...(fullB ? otherUnions(b.b) : [])]);
        }
      } else if (b.type === "single") {
        if (level === "compact") seg(b.pid, false, [row(`${displayName(b.pid)} ${yearsText(b.pid)}`.trim(), { bold: true }, [num(b.pid)])]);
        else seg(b.pid, true, [row(displayName(b.pid), { bold: true }, [num(b.pid)]), ...lifeRows(b.pid, [], framed), ...occupation(b.pid)]);
      } else {
        const target = b.kind === "cut" ? goto("→ p.", () => famPage.get(b.fam)) : goto("→ p.", () => fullPage(b.pid));
        const name = b.second ? `${displayName(b.pid)} (${L.marriageNo(unionNo(b.pid, b.fam))})` : displayName(b.pid);
        const style = { italic: true, color: "#444" };
        if (level === "compact") seg(b.pid, false, [row(`${name} ${yearsText(b.pid)}`.trim(), style, [target])]);
        else seg(b.pid, false, [row(name, style, [num(b.pid)]), row(yearsText(b.pid), { color: "#444" }, [target])]);
      }
      const h = PAD + segments.reduce((sum, g) => sum + (g.photo ? Math.max(g.lines.length * LH, PH + 0.8) : g.lines.length * LH), 0);
      const result = { segments, h };
      contentCache.set(key, result);
      return result;
    }

    // ---- Layout of one chart (abstract boxes, heights only) ---------------------------
    const cut = new Set();                          // families that continue as their own chart
    function place(F, d, top, out, via, second, heights) {
      const f = fam.get(F);
      const a = via || f.husband || f.wife;
      const b = a === f.husband ? f.wife : a === f.wife ? f.husband : null;
      const couple = { type: "couple", fam: F, a, b, second: !!second, d, y: top };
      couple.h = contents(couple).h;
      if (out) out.push(couple);
      let y = top;
      const anchors = [];
      if (d < COLS - 1) {
        for (const c of f.children) {
          const placed = viaFams(F, c);
          if (placed.length) {
            placed.forEach((G, i) => {
              if (d + 1 === COLS - 1 && fam.get(G).children.length) cut.add(G);   // no room for its children
              if (cut.has(G)) {
                const box = { type: "short", kind: "cut", pid: c, fam: G, second: i > 0, d: d + 1, y };
                box.h = contents(box).h;
                if (out) out.push(box);
                anchors.push(y);
                y += box.h + GAP;
              } else {
                const h = place(G, d + 1, y, out, c, i > 0, heights);
                anchors.push(y);
                y += h + GAP;
              }
            });
          } else {
            const box = !firstFamily.has(c)
              ? { type: "single", pid: c, d: d + 1, y }
              : { type: "short", kind: "elsewhere", pid: c, fam: firstFamily.get(c), d: d + 1, y };
            box.h = contents(box).h;
            if (out) out.push(box);
            anchors.push(y);
            y += box.h + GAP;
          }
        }
      }
      if (out && anchors.length) out.push({ type: "bracket", d, from: top, anchors });
      const h = Math.max(couple.h, anchors.length ? y - GAP - top : 0);
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
    let drawingPage = 0;                            // references to the page being drawn are left out
    const ref = (sign, page) => (page && page !== drawingPage ? `${sign} ${f2(page)}` : "");
    const markerText = (m) => (m.type === "num" ? (number.has(m.pid) ? `[${number.get(m.pid)}]` : "")
                                                 : ref(m.sign, m.to()));

    function drawBox(b, x, y0, page) {
      const y = y0 + b.y;
      if (b.type === "couple") {
        appear(b.a, page, firstFamily.get(b.a) === b.fam);
        appear(b.b, page, !!(b.b && firstFamily.get(b.b) === b.fam));
      } else {
        appear(b.pid, page, b.type === "single");
      }
      const style = b.type === "short" ? 'fill="#f6f6f6" stroke="#999" stroke-width="0.2" stroke-dasharray="0.8 0.5"'
                                       : 'fill="#ffffff" stroke="#555" stroke-width="0.25"';
      let s = `<rect x="${f2(x)}" y="${f2(y)}" width="${BW}" height="${f2(b.h)}" ${style}/>`;
      let top = y + PAD / 2;
      contents(b).segments.forEach((seg, segIndex) => {
        if (segIndex === 1 && b.type === "couple") {
          // A thin line between the two people of the couple.
          s += `<line x1="${f2(x + 0.6)}" y1="${f2(top - 0.25)}" x2="${f2(x + BW - 0.6)}" y2="${f2(top - 0.25)}" stroke="#bbb" stroke-width="0.2"/>`;
        }
        if (seg.photo) {
          // A portrait frame: the photo if there is one, otherwise empty space for it.
          const fx = x + 1, fy = top + 0.3;
          const url = photoFor(seg.pid);
          s += `<rect x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" fill="#fafafa" stroke="#c8c8c8" stroke-width="0.2"/>`;
          if (url) {
            s += `<image href="${esc(url)}" x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice"/>` +
                 `<rect x="${f2(fx)}" y="${f2(fy)}" width="${PW}" height="${PH}" fill="none" stroke="#777" stroke-width="0.2"/>`;
          }
        }
        const left = x + 1 + (seg.photo ? PW + 1 : 0);
        seg.lines.forEach((ln, i) => {
          const by = top + LH * (i + 0.78);
          if (ln.text) {
            s += `<text x="${f2(left)}" y="${f2(by)}" font-size="${f2(ln.size)}"${ln.style.bold ? ' font-weight="bold"' : ""}` +
                 `${ln.style.italic ? ' font-style="italic"' : ""} fill="${ln.style.color || "#111"}">${esc(ln.text)}</text>`;
          }
          const right = ln.markers.map(markerText).filter(Boolean).join(" ");
          if (right) {
            s += `<text x="${f2(x + BW - 1)}" y="${f2(by)}" font-size="${FONT_SMALL}" text-anchor="end" fill="#666">${esc(right)}</text>`;
          }
        });
        top += seg.photo ? Math.max(seg.lines.length * LH, PH + 0.8) : seg.lines.length * LH;
      });
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

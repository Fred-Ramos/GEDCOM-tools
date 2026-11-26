// Family poster (Style 2) for GEDCOM Tools. Plain JavaScript, no dependencies; needs tree.js.
//
// A chosen couple sits in the middle:
// - their descendants open downwards (children, grandchildren, ...), each with their spouses;
// - the wife's ancestors open to the left and the husband's to the right, one generation per column,
//   father above mother, joined by bracket lines. Unknown ancestors keep an empty box, so both halves
//   stay symmetrical.
// Behind everything grows a decorative tree (seeded, so a poster always looks the same), and a title
// cartouche sits above the couple.
(function (global) {
  "use strict";

  const T = typeof module === "object" && module.exports ? require("./tree.js") : global.FamilyTree;
  const { packRow, layoutDescendants, rng, branch, norm, f1, esc, wrapName } = T.internals;

  const BW = 150;              // box size (same width as the tree cards, so the descendant layout fits)
  const BH = 86;
  const GAPC = 34;             // between the two spouses of the centre couple
  const CX = 200;              // distance between ancestor columns
  const SLOT = BH + 14;        // height of one box slot in the outermost ancestor column
  const DESC_GAP = 64;         // vertical gap between descendant generations
  const MARGIN = 60;
  const TITLE_H = 150;

  // ------------------------------------------------------------------
  // Title
  // ------------------------------------------------------------------
  function defaultTitle(idx, famId) {
    const fam = idx.family(famId);
    if (!fam) return "";
    const names = [];
    // Each spouse's surname; without one, their father's (or mother's) surname.
    for (const id of [fam.wife, fam.husband]) {
      if (!id) continue;
      const { father, mother } = idx.parents(id);
      const s = [id, father, mother].map((x) => x && idx.info(x).surname).find(Boolean);
      if (s && !names.includes(s)) names.push(s);
    }
    return names.join(" ");
  }

  function titleLines(title) {
    // "|" forces a line break, e.g. "Ramos AP | da Cunha Ramos".
    if (String(title).includes("|")) return title.split("|").map((l) => l.trim()).filter(Boolean).slice(0, 3);
    const words = String(title || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    if (title.length <= 22) return [title];
    // Two lines, split near the middle.
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }

  // ------------------------------------------------------------------
  // Layout
  // ------------------------------------------------------------------
  // upGens: ancestor generations per side (1 = parents). downGens: descendant generations (Infinity = all).
  function layoutPoster(idx, famId, upGens, downGens, title, heading = "") {
    const fam = idx.family(famId);
    const boxes = [];
    let lines = "";

    // Descendants, laid out with the same packing as the tree, then centred under the couple.
    let serial = 0;
    const card = (id, row, kind, line) => ({ key: serial++, id, row, kind, line, x: 0 });
    const kids = downGens > 0 ? fam.children.map((c) => layoutDescendants(idx, c, 1, downGens - 1, "r", card)) : [];
    const desc = packRow(kids);
    if (desc.cards.length) {
      const xs = desc.cards.map((c) => c.x);
      desc.shift(-(Math.min(...xs) + Math.max(...xs)) / 2);
    }

    const tLines = titleLines(title);
    const titleW = Math.max(360, String(heading).length * 13 + 90, ...tLines.map((l) => l.length * 19 + 90));
    const innerX = Math.max(GAPC / 2 + 1.5 * BW + 60, titleW / 2 + 40 + BW / 2);

    // Vertical positions.
    const H = upGens > 0 ? Math.pow(2, upGens) * SLOT : BH;
    const titleTop = MARGIN;
    const coupleY = Math.max(MARGIN + H / 2, titleTop + TITLE_H + 50 + BH / 2);
    const sideTop = coupleY - H / 2;
    const rowTop = new Map();                      // descendant row -> y of its top, set further down
    const rowY = (row) => rowTop.get(row) + BH / 2;
    const obstacles = [];                          // ancestor boxes and brackets the descendants must avoid

    // Centre couple: wife left, husband right.
    const wifeX = -(GAPC / 2 + BW / 2);
    const husbandX = GAPC / 2 + BW / 2;
    boxes.push({ id: fam.wife, x: wifeX, y: coupleY, kind: "couple" });
    boxes.push({ id: fam.husband, x: husbandX, y: coupleY, kind: "couple" });
    lines += `M${f1(wifeX + BW / 2)} ${f1(coupleY)}H${f1(husbandX - BW / 2)}`;

    // Ancestors: each side is a sideways pedigree chart, father above mother.
    for (const [spouse, dir, x0] of [[fam.wife, -1, wifeX], [fam.husband, 1, husbandX]]) {
      let prev = [{ id: spouse, x: x0, y: coupleY }];
      for (let k = 1; k <= upGens; k++) {
        const colX = dir * (innerX + (k - 1) * CX);
        const gen = [];
        prev.forEach((child, i) => {
          const parents = child.id ? idx.parents(child.id) : {};
          const father = { id: parents.father || null, x: colX, y: sideTop + (2 * i + 0.5) * H / Math.pow(2, k) };
          const mother = { id: parents.mother || null, x: colX, y: sideTop + (2 * i + 1.5) * H / Math.pow(2, k) };
          gen.push(father, mother);
          // Bracket: from the child's outer edge to the middle of the gap, up/down to both parents.
          const from = child.x + dir * BW / 2;
          const to = colX - dir * BW / 2;
          const mid = (from + to) / 2;
          lines += `M${f1(from)} ${f1(child.y)}H${f1(mid)}M${f1(mid)} ${f1(father.y)}V${f1(mother.y)}` +
                   `M${f1(mid)} ${f1(father.y)}H${f1(to)}M${f1(mid)} ${f1(mother.y)}H${f1(to)}`;
          obstacles.push({ x1: Math.min(from, to), x2: Math.max(from, to), y1: father.y, y2: mother.y });
        });
        for (const b of gen) {
          boxes.push({ ...b, kind: "ancestor" });
          obstacles.push({ x1: b.x - BW / 2, x2: b.x + BW / 2, y1: b.y - BH / 2, y2: b.y + BH / 2 });
        }
        prev = gen;
      }
    }

    // Descendant rows: imagine the two diagonals of the ancestors' rectangle, crossing at the couple.
    // Each row goes down until it fits inside the lower triangle between them (which widens as it
    // goes down) and touches no ancestor box or bracket.
    const sideHalf = innerX + (upGens - 1) * CX + BW / 2;
    const slope = upGens > 0 ? sideHalf / (H / 2) : Infinity;   // half-width gained per pixel down
    const CLEAR = 14;
    let next = coupleY + BH / 2 + DESC_GAP;
    let descHalf = 0;
    for (const r of [...desc.rows.keys()].sort((a, b) => a - b)) {
      const [left, right] = desc.rows.get(r);
      const reach = Math.max(-left, right);
      descHalf = Math.max(descHalf, reach);
      let y = Math.max(next, coupleY + reach / slope);
      for (let guard = 0; guard < 1000; guard++) {
        const hit = obstacles.find((o) => o.x1 < right + CLEAR && o.x2 > left - CLEAR &&
                                          o.y1 < y + BH + CLEAR && o.y2 > y - DESC_GAP / 2 - CLEAR);
        if (!hit) break;
        y = hit.y2 + DESC_GAP / 2 + CLEAR;
      }
      rowTop.set(r, y);
      next = y + BH + DESC_GAP;
    }

    // Descendants and their lines.
    for (const c of desc.cards) boxes.push({ id: c.id, x: c.x, y: rowY(c.row), kind: c.kind === "spouse" ? "spouse" : "descendant" });
    const bar = (fromX, fromY, children, row) => {
      if (!children.length) return "";
      const barY = rowY(row) - BH / 2 - DESC_GAP / 2;
      const xs = children.map((k) => k.x);
      let d = `M${f1(fromX)} ${f1(fromY)}V${f1(barY)}M${f1(Math.min(fromX, ...xs))} ${f1(barY)}H${f1(Math.max(fromX, ...xs))}`;
      for (const k of children) d += `M${f1(k.x)} ${f1(barY)}V${f1(rowY(row) - BH / 2)}`;
      return d;
    };
    const firstRow = desc.cards.filter((c) => c.row === 1 && c.kind !== "spouse");
    lines += bar(0, coupleY, firstRow, 1);
    for (const f of desc.families) {
      const y = rowY(f.row);
      if (f.spouse) {
        const [a, b] = f.via.x < f.spouse.x ? [f.via, f.spouse] : [f.spouse, f.via];
        lines += `M${f1(a.x + BW / 2)} ${f1(y)}H${f1(b.x - BW / 2)}`;
        lines += bar((a.x + b.x) / 2, y, f.children, f.row + 1);
      } else {
        lines += bar(f.via.x, y + BH / 2, f.children, f.row + 1);
      }
    }

    // Size, then move everything so the poster starts at (0, 0).
    const lastRow = desc.cards.length ? Math.max(...desc.cards.map((c) => c.row)) : 0;
    const bottom = Math.max(sideTop + H, lastRow ? rowY(lastRow) + BH / 2 : coupleY + BH / 2);
    const half = Math.max(innerX + (upGens - 1) * CX + BW / 2, descHalf, titleW / 2) + MARGIN;
    const width = 2 * half;
    const height = bottom + 150;
    for (const b of boxes) b.x += half;

    return {
      boxes, width, height, half, famId,
      lines: lines.replace(/M(-?[\d.]+)/g, (m, x) => "M" + f1(Number(x) + half))
                  .replace(/H(-?[\d.]+)/g, (m, x) => "H" + f1(Number(x) + half)),
      couple: { x: half, y: coupleY },
      title: { heading: String(heading).trim(), lines: tLines, x: half, y: titleTop, w: titleW, h: TITLE_H },
      trunk: { x: half, base: bottom + 110, top: coupleY + BH / 2 + 10 },
    };
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------
  const LEAF_COLORS = ["#7fb069", "#9ccc65", "#5aa356", "#2e7d32", "#5c8d89", "#7aa6c2", "#b5d99c", "#43a047"];

  // A decorative tree. Each limb keeps growing almost straight while side shoots leave it at an
  // angle; every step the wood gets thinner, and thin wood carries leaves.
  function decorativeTree(layout, seed) {
    const rand = rng(seed);
    const { width, height, trunk } = layout;
    const wood = [];
    const leaves = [];
    const span = Math.hypot(width / 2, trunk.top);
    const step = Math.max(90, span / 9);
    let budget = 0;

    const leaf = (x, y, angle, size) => leaves.push(
      `<use href="#leaf" fill="${LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)]}" ` +
      `transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(angle)}) scale(${f1(size)})"/>`);

    function grow(from, angle, length, radius, depth) {
      if (budget-- <= 0) return;
      const a = angle + (rand() - 0.5) * 0.3;
      const to = [from[0] + Math.cos(a) * length, from[1] + Math.sin(a) * length];
      const [path, , geo] = branch(from, [Math.cos(angle), Math.sin(angle)], to, [Math.cos(a), Math.sin(a)],
                                   radius, radius * 0.82, `${seed}:${wood.length}`);
      wood.push(`<path d="${path}"/>`);
      if (radius < 3) {
        // Leaves along thin wood.
        for (let i = 0; i < 2; i++) {
          const t = 0.2 + rand() * 0.75;
          const [x, y] = geo.at(t);
          const [tx, ty] = geo.tangent(t);
          const side = rand() < 0.5 ? -1 : 1;
          leaf(x, y, Math.atan2(ty, tx) * 180 / Math.PI + side * (30 + rand() * 40), 0.8 + rand() * 0.6);
        }
      }
      const outside = to[0] < -60 || to[0] > width + 60 || to[1] < -60 || to[1] > height;
      if (depth <= 0 || radius < 0.7 || outside) {
        for (let i = 0; i < 3; i++) leaf(to[0] + (rand() - 0.5) * 26, to[1] + (rand() - 0.5) * 26, rand() * 360, 0.9 + rand() * 0.6);
        return;
      }
      // The limb continues, bending slightly upwards, and one or two side shoots leave it.
      const lift = Math.sin(a) > -0.9 ? -0.06 : 0;
      grow(to, a + lift + (rand() - 0.5) * 0.25, length * 0.92, radius * 0.8, depth - 1);
      const shoots = rand() < 0.3 ? 2 : 1;
      for (let i = 0; i < shoots; i++) {
        const side = (i === 0) === (rand() < 0.5) ? 1 : -1;
        grow(to, a + side * (0.45 + rand() * 0.45), length * 0.68, radius * 0.55, depth - 2);
      }
    }

    // Trunk, flaring at the base, with a few roots.
    const top = [trunk.x, trunk.top];
    const base = [trunk.x, trunk.base];
    const R = Math.max(20, Math.min(60, 24 * Math.sqrt((width * height) / (2900 * 1800))));   // grows with the poster
    const [stem] = branch(base, [0, -1], top, [0, -1], R * 1.4, R, `${seed}:trunk`);
    wood.push(`<path d="${stem}"/>`);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const [root] = branch([trunk.x + side * R * 0.5, trunk.base - 8], norm(side, 0.5),
        [trunk.x + side * (60 + rand() * 120), trunk.base + 20 + rand() * 25], norm(side, 0.2),
        R * (0.5 - i * 0.05), 1, `${seed}:root${i}`);
      wood.push(`<path d="${root}"/>`);
    }
    // Limbs fan out from the top of the trunk: from left (a bit down) over the top to right (a bit down).
    const limbs = 15;
    for (let i = 0; i < limbs; i++) {
      budget = 130;
      const angle = (170 + i * 200 / (limbs - 1) + (rand() - 0.5) * 6) * Math.PI / 180;
      grow(top, angle, step * (0.85 + rand() * 0.3), R * (0.32 + rand() * 0.12), 9);
    }
    return { wood: wood.join(""), leaves: leaves.join("") };
  }

  function cartouche(t) {
    const x = t.x - t.w / 2, y = t.y, w = t.w, h = t.h;
    const curl = (cx, cy, sx, sy) =>
      `<path d="M${f1(cx)} ${f1(cy + sy * 22)}C${f1(cx)} ${f1(cy + sy * 6)} ${f1(cx + sx * 6)} ${f1(cy)} ${f1(cx + sx * 22)} ${f1(cy)}` +
      `M${f1(cx + sx * 8)} ${f1(cy + sy * 8)}m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>`;
    const first = t.heading ? 92 : 82;
    const surnames = t.lines.map((l, i) =>
      `<text x="${f1(t.x)}" y="${f1(y + first + i * 40 - (t.lines.length - 1) * (t.heading ? 16 : 20))}" font-size="36" font-style="italic" fill="#3a2a18">${esc(l)}</text>`).join("");
    return `<g class="cartouche">` +
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${h}" fill="#fffdf6" fill-opacity="0.92" stroke="#b8a46a" stroke-width="2"/>` +
      `<rect x="${f1(x + 7)}" y="${f1(y + 7)}" width="${f1(w - 14)}" height="${h - 14}" fill="none" stroke="#cdbd8a" stroke-width="0.8"/>` +
      `<g fill="none" stroke="#b8a46a" stroke-width="1.4">${curl(x + 14, y + 14, 1, 1)}${curl(x + w - 14, y + 14, -1, 1)}` +
      `${curl(x + 14, y + h - 14, 1, -1)}${curl(x + w - 14, y + h - 14, -1, -1)}</g>` +
      (t.heading ? `<text x="${f1(t.x)}" y="${f1(y + 44)}" font-size="22" letter-spacing="1" fill="#3a2a18">${esc(t.heading)}</text>` : "") +
      surnames + `</g>`;
  }

  function boxSvg(idx, b, selected) {
    const x = b.x - BW / 2, y = b.y - BH / 2;
    if (!b.id) {
      return `<rect x="${f1(x)}" y="${f1(y)}" width="${BW}" height="${BH}" fill="#ffffff" fill-opacity="0.7" stroke="#d9ceb0" stroke-width="1"/>`;
    }
    const p = idx.info(b.id);
    const name = wrapName(p.name, 18);
    const facts = [];
    const fact = (sign, e) => {
      const text = [e.year, e.place].filter(Boolean).join(", ");
      if (text) facts.push(`${sign} ${text.length > 26 ? text.slice(0, 25) + "…" : text}`);
    };
    fact("*", p.birth);
    fact("†", p.death);
    const strong = b.kind === "couple";
    const nameTop = BH / 2 - (name.length * 16 + facts.length * 14) / 2 + 12;
    const text = name.map((l, i) =>
      `<text x="${BW / 2}" y="${f1(nameTop + i * 16)}" font-size="13.5" font-weight="bold" fill="#2a1d12">${esc(l)}</text>`).join("") +
      facts.map((l, i) =>
        `<text x="${BW / 2}" y="${f1(nameTop + name.length * 16 + 3 + i * 14)}" font-size="10.5" fill="#5a4a3a">${esc(l)}</text>`).join("");
    const title = `${p.name}${p.years ? ` (${p.years})` : ""}` +
      [p.birth, p.death].map((e, i) => (e.place ? `\n${i ? "†" : "*"} ${[e.year, e.place].filter(Boolean).join(", ")}` : "")).join("");
    return `<g class="person ${b.kind}${b.id === selected ? " selected" : ""}" data-id="${esc(b.id)}" transform="translate(${f1(x)} ${f1(y)})">` +
      `<title>${esc(title)}</title>` +
      `<rect class="frame" width="${BW}" height="${BH}" fill="#ffffff" fill-opacity="0.93" stroke="${strong ? "#9a7b35" : "#c3b07c"}" stroke-width="${strong ? 2.2 : 1.2}"/>` +
      text + `</g>`;
  }

  function drawPoster(layout, idx, selected) {
    const { width, height } = layout;
    const tree = decorativeTree(layout, `poster:${layout.famId}`);
    const people = layout.boxes.map((b) => boxSvg(idx, b, selected)).join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(width)}" height="${f1(height)}" viewBox="0 0 ${f1(width)} ${f1(height)}"` +
      ` font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">` +
      `<defs><symbol id="leaf" overflow="visible"><path d="M0 0C5-6.5 15-6.5 20 0C15 6.5 5 6.5 0 0Z"/>` +
      `<path d="M1.5 0H17" stroke="#1f3a1a" stroke-opacity="0.3" stroke-width="0.7" fill="none"/></symbol></defs>` +
      `<rect width="100%" height="100%" fill="#ffffff"/>` +
      `<g fill="#6f6560" opacity="0.6">${tree.wood}</g>` +
      `<g opacity="0.85">${tree.leaves}</g>` +
      `<path d="${layout.lines}" fill="none" stroke="#2b2118" stroke-width="1.8" stroke-linecap="square"/>` +
      cartouche(layout.title) + people + `</svg>`;
    return { svg };
  }

  const api = { layoutPoster, drawPoster, defaultTitle };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.FamilyPoster = api;
})(typeof window !== "undefined" ? window : globalThis);

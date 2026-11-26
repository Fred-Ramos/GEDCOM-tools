// Family tree view for GEDCOM Tools. Plain JavaScript, no dependencies.
//
// Rule:
// - one person is chosen (searched); they and their ancestors are shown (up to N generations);
// - every ancestor (and the chosen person) can show their full siblings, then the children of all
//   those siblings, then the siblings' grandchildren (never more than 2 generations below a sibling);
// - anyone whose children are shown is shown with their spouse; couples are woman left, man right.
//
// Layout: one row per generation. An ancestor's siblings open on the outer side (a mother's to the
// left, a father's to the right; the chosen person's to the right). Blocks are packed so people
// never overlap, and the column below the chosen person is kept free for the trunk.
//
// Drawing: an illustrated tree. The family links form a branch skeleton rooted at the chosen person
// (the trunk). Each branch is a tapered, slightly curved shape whose thickness follows the pipe model
// (radius ~ sqrt of the people it carries). Randomness is seeded by person ids, so a tree always
// looks the same. People are drawn as semi-transparent medallions on top of the wood.
(function (global) {
  "use strict";

  const CARD_W = 150;        // horizontal slot of one person
  const CARD_H = 64;
  const RX = 70;             // medallion radii
  const RY = 31;
  const GAP = 24;            // between unrelated people
  const COUPLE_GAP = 10;     // between spouses
  const ROW_GAP = 90;        // vertical room for the wood between generations
  const MARGIN_X = 110;
  const MARGIN_TOP = 120;    // room for the leaves above the oldest ancestors
  const MARGIN_BOTTOM = 70;
  const MAX_DEPTH = 60;      // guard against broken data

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const ref = (v) => (v && typeof v === "object" ? v._PREF : v);

  // Values can be strings, objects or lists, depending on the program that wrote the file.
  const first = (v) => asList(v)[0];
  const pointer = (v) => ref(first(v)) || null;

  function yearOf(event) {
    const e = first(event);
    let date = e && typeof e === "object" ? first(e.DATE) : null;
    if (date && typeof date === "object") date = date._NAME;
    if (!date) return null;
    const years = String(date).match(/\d{3,4}/g);
    return years ? years[years.length - 1] : null;
  }

  function placeOf(event) {
    const e = first(event);
    let place = e && typeof e === "object" ? first(e.PLAC) : null;
    if (place && typeof place === "object") place = place._NAME;
    return place || null;
  }

  function normalize(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\//g, " ");
  }

  function indexTree(tree) {
    const people = new Map();
    const families = new Map();
    for (const p of tree.INDI || []) people.set(p._PDEF, p);
    for (const f of tree.FAM || []) families.set(f._PDEF, f);

    const info = new Map();
    for (const [id, p] of people) {
      let n = first(p.NAME) || {};
      if (typeof n !== "object") n = { _NAME: n };
      const name = ([n.GIVN, n.SURN].filter(Boolean).join(" ") ||
                    String(n._NAME || "").replace(/\//g, " ")).replace(/\s+/g, " ").trim() || "(no name)";
      const born = yearOf(p.BIRT);
      const died = yearOf(p.DEAT);
      const years = born && died ? `${born}–${died}` : born ? `${born}–` : died ? `–${died}` :
                    p.DEAT ? "deceased" : "";
      info.set(id, {
        id, name, years, born: born ? Number(born) : null, sex: first(p.SEX), search: normalize(name),
        surname: String(n.SURN || (String(n._NAME || "").match(/\/([^/]*)\//) || [])[1] || "").trim(),
        birth: { year: born, place: placeOf(p.BIRT) || placeOf(p.BAPM) },
        death: { year: died, place: placeOf(p.DEAT) || placeOf(p.BURI) },
      });
    }

    const birthOrder = (ids) => {
      const list = ids.filter((id) => info.has(id));
      return list.every((id) => info.get(id).born !== null)
        ? list.slice().sort((a, b) => info.get(a).born - info.get(b).born)
        : list;
    };

    const familyOf = (id) => families.get(ref(asList((people.get(id) || {}).FAMC)[0]));

    return {
      info: (id) => info.get(id),
      has: (id) => info.has(id),

      parents(id) {
        const f = familyOf(id);
        const mother = f && pointer(f.WIFE);
        const father = f && pointer(f.HUSB);
        return { mother: info.has(mother) ? mother : null, father: info.has(father) ? father : null };
      },

      // Full siblings: the other children of the same parents' family.
      siblings(id) {
        const f = familyOf(id);
        return f ? birthOrder(asList(f.CHIL).map(ref).filter((c) => c !== id)) : [];
      },

      // Families where the person is a spouse: [{ spouse, children, isHusband }]
      unions(id) {
        return asList((people.get(id) || {}).FAMS).map((r) => families.get(ref(r))).filter(Boolean).map((f) => {
          const isHusband = pointer(f.HUSB) === id;
          const spouse = isHusband ? pointer(f.WIFE) : pointer(f.HUSB);
          return { famId: f._PDEF, spouse: info.has(spouse) ? spouse : null,
                   children: birthOrder(asList(f.CHIL).map(ref)), isHusband };
        });
      },

      // A couple: { id, wife, husband, children }.
      family(famId) {
        const f = families.get(famId);
        if (!f) return null;
        const wife = pointer(f.WIFE);
        const husband = pointer(f.HUSB);
        return { id: famId, wife: info.has(wife) ? wife : null, husband: info.has(husband) ? husband : null,
                 children: birthOrder(asList(f.CHIL).map(ref)) };
      },

      search(query, limit = 100) {
        const words = normalize(query).split(/\s+/).filter(Boolean);
        if (!words.length) return [];
        const hits = [];
        for (const person of info.values()) {
          if (words.every((w) => person.search.includes(w))) hits.push(person);
        }
        hits.sort((a, b) => a.name.localeCompare(b.name) || (a.born || 0) - (b.born || 0));
        return hits.slice(0, limit);
      },
    };
  }

  function childrenOf(idx, id) {
    return idx.unions(id).flatMap((u) => u.children);
  }

  // How many people each level would add: [siblings, their children, their grandchildren].
  function counts(idx, id) {
    const siblings = idx.siblings(id);
    const children = siblings.flatMap((s) => childrenOf(idx, s));
    const grandchildren = children.flatMap((c) => childrenOf(idx, c));
    return [siblings.length, children.length, grandchildren.length];
  }

  // ------------------------------------------------------------------
  // Layout
  // ------------------------------------------------------------------
  // A Shape is a set of cards plus, for every row it uses, its leftmost and rightmost edge.
  class Shape {
    constructor() { this.cards = []; this.rows = new Map(); this.families = []; this.main = null; }
    reserve(row, l, r) {
      const edge = this.rows.get(row);
      if (!edge) this.rows.set(row, [l, r]);
      else { edge[0] = Math.min(edge[0], l); edge[1] = Math.max(edge[1], r); }
    }
    add(card) {
      this.cards.push(card);
      this.reserve(card.row, card.x - CARD_W / 2, card.x + CARD_W / 2);
    }
    merge(other) {
      for (const card of other.cards) this.add(card);
      for (const [row, [l, r]] of other.rows) this.reserve(row, l, r);
      this.families.push(...other.families);
    }
    shift(dx) {
      if (!dx) return;
      for (const card of this.cards) card.x += dx;
      for (const edge of this.rows.values()) { edge[0] += dx; edge[1] += dx; }
    }
  }

  // Smallest shift that puts `moving` entirely to the right of `fixed` in every row they share.
  function rightOf(fixed, moving, gapFor = () => GAP) {
    let need = -Infinity;
    for (const [row, [, fixedRight]] of fixed.rows) {
      const edge = moving.rows.get(row);
      if (edge) need = Math.max(need, fixedRight + gapFor(row) - edge[0]);
    }
    return need;
  }

  // Smallest shift (negative) that puts `moving` entirely to the left of `fixed`.
  function leftOf(fixed, moving) {
    let need = -Infinity;
    for (const [row, [fixedLeft]] of fixed.rows) {
      const edge = moving.rows.get(row);
      if (edge) need = Math.max(need, edge[1] + GAP - fixedLeft);
    }
    return need === -Infinity ? -Infinity : -need;
  }

  // Place shapes left to right, each as close as possible to the ones before it.
  function packRow(shapes) {
    const all = new Shape();
    for (const s of shapes) {
      if (all.cards.length) {
        const dx = rightOf(all, s);
        if (dx !== -Infinity) s.shift(dx);
      }
      all.merge(s);
    }
    return all;
  }

  // A person and the generations shown below them, each with their spouses (woman left, man right).
  // card(id, row, kind, line) makes the card objects, so callers can number them.
  function layoutDescendants(idx, id, row, below, line, card) {
    const shape = new Shape();
    const unions = below > 0 ? idx.unions(id) : [];
    const self = card(id, row, "relative", line);
    shape.main = self;
    if (!unions.length) { shape.add(self); return shape; }

    const kidShapes = [];
    const kidsPerUnion = unions.map((u) => u.children.map((c) => {
      const s = layoutDescendants(idx, c, row + 1, below - 1, line, card);
      kidShapes.push(s);
      return s.main;
    }));
    const kids = packRow(kidShapes);

    // Woman on the left, man on the right.
    const spouses = unions.map((u) => (u.spouse ? card(u.spouse, row, "spouse", line) : null));
    const isHusband = unions[0].isHusband || (!unions.some((u) => u.isHusband) && idx.info(id).sex === "M");
    const order = isHusband ? [...spouses.filter(Boolean), self] : [self, ...spouses.filter(Boolean)];

    const kidsEdge = kids.rows.get(row + 1);
    const center = kidsEdge ? (kidsEdge[0] + kidsEdge[1]) / 2 : 0;
    const width = order.length * CARD_W + (order.length - 1) * COUPLE_GAP;
    order.forEach((c, i) => { c.x = center - width / 2 + CARD_W / 2 + i * (CARD_W + COUPLE_GAP); });

    shape.merge(kids);
    order.forEach((c) => shape.add(c));
    unions.forEach((u, i) => {
      shape.families.push({ kind: "down", row, via: self, spouse: spouses[i], children: kidsPerUnion[i] });
    });
    return shape;
  }

  // levels: Map id -> 0..3 (none, siblings, + their children, + grandchildren).
  // maxGenerations: how many generations of ancestors to show, counting the chosen person as 1.
  function layoutTree(idx, rootId, levels, maxGenerations = Infinity) {
    let serial = 0;
    const card = (id, row, kind, line) => ({ key: serial++, id, row, kind, line, x: 0 });

    const descendants = (id, row, below, line) => layoutDescendants(idx, id, row, below, line, card);

    // An ancestor (or the chosen person): their siblings and everyone above them.
    // side: "left" if they are the mother in the couple below, "right" if the father, "root" otherwise.
    // line: "m" mother's side, "p" father's side, "r" the chosen person and their siblings.
    function ancestor(id, row, side, depth, line) {
      const shape = new Shape();
      const self = card(id, row, depth === 0 ? "root" : "ancestor", line);
      self.level = levels.get(id) || 0;
      self.counts = counts(idx, id);
      shape.main = self;
      shape.add(self);
      if (depth === 0) {
        // Keep the column under the chosen person free for the trunk.
        shape.reserve(row + 1, self.x - 55, self.x + 55);
        shape.reserve(row + 2, self.x - 55, self.x + 55);
      }
      const siblingCards = [];

      if (self.level > 0) {
        const units = idx.siblings(id).map((s) => descendants(s, row, self.level - 1, line));
        if (units.length) {
          const group = packRow(units);
          group.shift(side === "left" ? leftOf(shape, group) : rightOf(shape, group));
          shape.merge(group);
          siblingCards.push(...units.map((u) => u.main));
        }
      }

      const { mother, father } = idx.parents(id);
      if (!mother && !father) return shape;
      if (depth + 1 >= maxGenerations || depth >= MAX_DEPTH) { self.more = true; return shape; }

      const childrenRow = side === "left" ? [...siblingCards, self] : [self, ...siblingCards];
      const xs = childrenRow.map((c) => c.x);
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      const half = mother && father ? (CARD_W + COUPLE_GAP) / 2 : 0;
      const upper = new Shape();
      let m = null;
      let f = null;

      if (mother) {
        m = ancestor(mother, row - 1, "left", depth + 1, depth === 0 ? "m" : line);
        m.shift(center - half - m.main.x);
        const dx = leftOf(shape, m);
        if (dx !== -Infinity && dx < 0) m.shift(dx);      // only ever move away
        upper.merge(m);
      }
      if (father) {
        f = ancestor(father, row - 1, "right", depth + 1, depth === 0 ? "p" : line);
        f.shift(center + half - f.main.x);
        const both = new Shape();
        both.merge(shape);
        both.merge(upper);
        // Spouses may stand closer together than unrelated people.
        const gapFor = (r) => (m && r === row - 1 &&
          both.rows.get(r)[1] === m.main.x + CARD_W / 2 ? COUPLE_GAP : GAP);
        const dx = rightOf(both, f, gapFor);
        if (dx !== -Infinity && dx > 0) f.shift(dx);
        upper.merge(f);
      }

      // Slide this person's group under the middle of the parents, as far as the cousins allow.
      if (m && f) {
        const want = (m.main.x + f.main.x) / 2 - center;
        const maxRight = rightOf(shape, f) === -Infinity ? Infinity : -rightOf(shape, f);
        const maxLeft = rightOf(m, shape);
        const move = Math.max(maxLeft, Math.min(want, maxRight));
        if (Number.isFinite(move)) shape.shift(move);
      }

      shape.merge(upper);
      shape.families.push({ kind: "up", row: row - 1, via: self, parents: [m, f].filter(Boolean).map((s) => s.main),
                            siblings: siblingCards });
      return shape;
    }

    return place(ancestor(rootId, 0, "root", 0, "r"));
  }

  // Pixel positions for every card.
  function place(shape) {
    const { cards, families } = shape;
    const rows = [...new Set(cards.map((c) => c.row))].sort((a, b) => a - b);
    const top = new Map(rows.map((r, i) => [r, MARGIN_TOP + i * (CARD_H + ROW_GAP)]));
    const minX = Math.min(...cards.map((c) => c.x)) - CARD_W / 2;
    const maxX = Math.max(...cards.map((c) => c.x)) + CARD_W / 2;
    const dx = MARGIN_X - minX;
    for (const c of cards) {
      c.x += dx;
      c.top = top.get(c.row);
      c.cy = c.top + CARD_H / 2;
    }
    const lastBottom = top.get(rows[rows.length - 1]) + CARD_H;
    const groundY = lastBottom + 80;
    return { cards, families, width: maxX - minX + 2 * MARGIN_X, height: groundY + 60 + MARGIN_BOTTOM, groundY };
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------
  // Seeded random numbers, so the same person always gets the same bends and leaves.
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(seed);
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const f1 = (v) => Math.round(v * 10) / 10;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const WOOD = "#5b3a22";
  const WOOD_LIGHT = "#8c6240";
  const LEAVES = {
    m: ["#8e9a3c", "#a3ab4c", "#b4b55c", "#7b8a33"],   // mother's side: olive and gold
    p: ["#3f7a4a", "#4e8e56", "#62a364", "#356a3f"],   // father's side: deeper greens
    r: ["#5f8e44", "#73a050", "#86ad5a"],
  };
  const MEDALLION = {
    root:     { fill: "#fff6df", stroke: "#9a6a1c", width: 3,    inner: "#caa45a", weight: "bold" },
    ancestor: { fill: "#fbf5e8", stroke: "#5b3a22", width: 2,    inner: "#b39062", weight: "bold" },
    relative: { fill: "#fdf9f0", stroke: "#7a5b3d", width: 1.5,  inner: "#cdb48c", weight: "normal" },
    spouse:   { fill: "#f3eee3", stroke: "#8e7b63", width: 1.25, inner: "#bba98a", weight: "normal", dash: "3 2" },
  };

  // A tapered branch from A to B along a cubic Bezier curve. Returns [wood path, highlight path, info].
  function branch(A, dirA, B, dirB, r0, r1, seed) {
    const rand = rng(seed);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const [px, py] = norm(-(B[1] - A[1]), B[0] - A[0]);
    // Bend and wobble grow with length, but are capped so very long branches stay calm.
    const reach = Math.min(L * 0.4, 150);
    const wobble = Math.min(L * 0.22, 45);
    const wob1 = (rand() - 0.5) * wobble;
    const wob2 = (rand() - 0.5) * wobble;
    const P1 = [A[0] + dirA[0] * reach + px * wob1, A[1] + dirA[1] * reach + py * wob1];
    const P2 = [B[0] - dirB[0] * reach + px * wob2, B[1] - dirB[1] * reach + py * wob2];
    const at = (t) => {
      const u = 1 - t;
      return [u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0],
              u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1]];
    };
    const tangent = (t) => {
      const u = 1 - t;
      return norm(3 * u * u * (P1[0] - A[0]) + 6 * u * t * (P2[0] - P1[0]) + 3 * t * t * (B[0] - P2[0]),
                  3 * u * u * (P1[1] - A[1]) + 6 * u * t * (P2[1] - P1[1]) + 3 * t * t * (B[1] - P2[1]));
    };
    const phase = rand() * 6.28;
    const n = Math.max(10, Math.min(90, Math.round(L / 9)));
    const left = [], right = [], hiL = [], hiR = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = at(t);
      const [tx, ty] = tangent(t);
      const nx = -ty, ny = tx;
      const r = (r0 + (r1 - r0) * t) * (1 + 0.07 * Math.sin(t * 11 + phase));
      left.push(`${f1(x + nx * r)} ${f1(y + ny * r)}`);
      right.push(`${f1(x - nx * r)} ${f1(y - ny * r)}`);
      // Light falls from the left: a narrow lighter band on that side.
      const hx = x - nx * r * 0.35, hy = y - ny * r * 0.35;
      hiL.push(`${f1(hx + nx * r * 0.28)} ${f1(hy + ny * r * 0.28)}`);
      hiR.push(`${f1(hx - nx * r * 0.28)} ${f1(hy - ny * r * 0.28)}`);
    }
    const shape = (l, r) => `M${l.join("L")}L${r.reverse().join("L")}Z`;
    return [shape(left, right), shape(hiL, hiR), { at, tangent, r0, r1, rand }];
  }

  function wrapName(name, max = 20) {
    const lines = [""];
    for (const word of name.split(" ")) {
      const line = lines[lines.length - 1];
      if (!line) lines[lines.length - 1] = word;
      else if ((line + " " + word).length <= max) lines[lines.length - 1] = line + " " + word;
      else lines.push(word);
    }
    if (lines.length > 2) lines.splice(1, lines.length, lines.slice(1).join(" "));
    return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
  }

  // Builds the whole SVG. prevKeys: keys drawn last time (new things fade in). selected: person id.
  function drawTree(layout, idx, prevKeys, selected) {
    const { cards, families, width, height, groundY } = layout;
    const root = cards.find((c) => c.kind === "root");
    const outOf = new Map();
    for (const f of families) {
      if (!outOf.has(f.via)) outOf.set(f.via, []);
      outOf.get(f.via).push(f);
    }
    const members = (f) => (f.kind === "up" ? [...f.parents, ...f.siblings] : [f.spouse, ...f.children].filter(Boolean));

    // Pipe model: how many people each card and family carries, seen from the trunk.
    const memo = new Map();
    const weightCard = (c) => {
      if (!memo.has(c)) memo.set(c, 1 + (outOf.get(c) || []).reduce((s, f) => s + weightFamily(f), 0));
      return memo.get(c);
    };
    const weightFamily = (f) => members(f).reduce((s, c) => s + weightCard(c), 0);
    const radius = (w) => Math.min(40, 1.6 + 2.5 * Math.sqrt(w));

    const keys = new Set();
    const grow = (key) => { keys.add(key); return prevKeys && !prevKeys.has(key) ? " grow" : ""; };
    const wood = [], light = [], knots = [], leaves = [], people = [];
    const leafColor = (line, rand) => { const p = LEAVES[line] || LEAVES.r; return p[Math.floor(rand() * p.length)]; };

    function addBranch(A, dirA, B, dirB, w, seed, line, leafy) {
      const R = radius(w);
      const [path, hi, geo] = branch(A, dirA, B, dirB, R, R * 0.78, seed);
      const cls = grow("b:" + seed);
      wood.push(`<path class="wood${cls}" d="${path}"/>`);
      light.push(`<path class="wood${cls}" d="${hi}"/>`);
      if (leafy) {
        // Leaves along thin branches, alternating sides.
        const count = R < 5 ? 4 : 2;
        for (let i = 0; i < count; i++) {
          const t = 0.25 + geo.rand() * 0.6;
          const [x, y] = geo.at(t);
          const [tx, ty] = geo.tangent(t);
          const side = i % 2 ? 1 : -1;
          const r = geo.r0 + (geo.r1 - geo.r0) * t;
          const angle = Math.atan2(ty, tx) * 180 / Math.PI + side * (35 + geo.rand() * 35);
          leaves.push(leafUse(x - ty * side * (r + 2), y + tx * side * (r + 2), angle,
                              0.7 + geo.rand() * 0.5, leafColor(line, geo.rand), cls));
        }
      }
      return geo;
    }
    const leafUse = (x, y, angle, scale, color, cls) =>
      `<use href="#leaf" class="leaf${cls}" fill="${color}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(angle)}) scale(${f1(scale * 100) / 100})"/>`;

    // Branches of every family.
    for (const f of families) {
      const via = f.via;
      const mem = members(f);
      if (!mem.length) continue;
      const w = weightFamily(f);
      const R = radius(w);
      const seedBase = `${via.id}:${f.kind}`;
      if (f.kind === "up") {
        const px = f.parents.reduce((s, p) => s + p.x, 0) / f.parents.length;
        const parentsBottom = f.parents[0].top + CARD_H;
        const J = [via.x * 0.45 + px * 0.55, parentsBottom + (via.top - parentsBottom) * 0.5];
        const stem = addBranch([via.x, via.cy], [0, -1], J, norm(J[0] - via.x, -60), w, seedBase + ">J", via.line, false);
        knots.push(`<circle class="wood${grow("k:" + seedBase)}" cx="${f1(J[0])}" cy="${f1(J[1])}" r="${f1(R * 0.82)}"/>`);
        for (const p of f.parents) {
          const to = [p.x, p.cy];
          addBranch(J, norm((to[0] - J[0]) * 0.8, -Math.abs(to[1] - J[1]) - 30), to, [0, -1],
                    weightCard(p), `${seedBase}>${p.id}`, p.line, false);
        }
        // Siblings hang from a bough that leaves the stem and runs out above them, thinning as it goes.
        for (const out of [-1, 1]) {
          const group = f.siblings.filter((s) => Math.sign(s.x - via.x) === out)
                                  .sort((a, b) => Math.abs(a.x - via.x) - Math.abs(b.x - via.x));
          if (!group.length) continue;
          let from = stem.at(0.45);
          let dir = norm(out, -0.25);
          group.forEach((s, i) => {
            const carried = group.slice(i).reduce((sum, k) => sum + weightCard(k), 0);
            const at = [s.x, s.top - 26];
            addBranch(from, dir, at, [out, 0], carried, `${seedBase}>bough>${s.id}`, s.line, i === group.length - 1);
            addBranch(at, norm(out * 0.25, 1), [s.x, s.cy], [0, 1], weightCard(s), `${seedBase}>${s.id}`,
                      s.line, weightCard(s) <= 3);
            from = at;
            dir = [out, 0];
          });
        }
      } else {
        const sx = f.spouse ? (via.x + f.spouse.x) / 2 : via.x;
        const K = [via.x * 0.5 + sx * 0.5, via.top + CARD_H + ROW_GAP * 0.42];
        addBranch([via.x, via.cy], [0, 1], K, norm(K[0] - via.x, 60), w, seedBase + ">K", via.line, false);
        knots.push(`<circle class="wood${grow("k:" + seedBase + f.children.length)}" cx="${f1(K[0])}" cy="${f1(K[1])}" r="${f1(R * 0.82)}"/>`);
        if (f.spouse) {
          addBranch(K, norm(f.spouse.x - K[0], -40), [f.spouse.x, f.spouse.cy], [0, -1], 1,
                    `${seedBase}>${f.spouse.id}`, via.line, false);
        }
        for (const k of f.children) {
          addBranch(K, norm(k.x - K[0], 50), [k.x, k.cy], [0, 1], weightCard(k), `${seedBase}>${k.id}`,
                    k.line, weightCard(k) <= 3);
        }
      }
    }

    // Trunk, roots and ground below the chosen person.
    const total = weightCard(root);
    const RT = radius(total);
    const base = [root.x, groundY];
    const ground = `<ellipse cx="${f1(root.x)}" cy="${f1(groundY + 14)}" rx="${f1(Math.max(180, RT * 9))}" ry="22" fill="#9aa872" opacity="0.35"/>`;
    addBranch([root.x, root.cy], [0, 1], base, [0, 1], total, `${root.id}:trunk`, "r", false);
    {
      const [trunk] = branch([root.x, root.cy + 40], [0, 1], base, [0, 1], RT * 0.95, RT * 1.45, `${root.id}:flare`);
      wood.push(`<path class="wood" d="${trunk}"/>`);
      const rand = rng(`${root.id}:roots`);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const to = [root.x + side * (50 + rand() * 120 + i * 12), groundY + 18 + rand() * 40];
        const [p] = branch([root.x + side * RT * 0.5, groundY - 6], norm(side, 0.6), to, norm(side, 0.3),
                           RT * (0.55 - i * 0.04), 1.2, `${root.id}:root${i}`);
        wood.push(`<path class="wood" d="${p}"/>`);
      }
    }

    // Leaves: a crown above the oldest ancestors shown, and small clusters at the twig ends.
    for (const c of cards) {
      const hasOut = (outOf.get(c) || []).some((f) => members(f).length);
      if (hasOut || c.kind === "root") continue;
      const rand = rng(`${c.id}:${c.kind}:leaves`);
      const crown = c.kind === "ancestor";
      const cls = grow(`l:${c.id}:${c.kind}`);
      const n = crown ? 11 : 5;
      for (let i = 0; i < n; i++) {
        const x = c.x + (rand() - 0.5) * (crown ? CARD_W * 1.05 : CARD_W * 0.9);
        const y = crown ? c.top - 6 - rand() * 46 : c.cy + (rand() - 0.5) * CARD_H * 0.9;
        const angle = crown ? -90 + (rand() - 0.5) * 150 : rand() * 360;
        leaves.push(leafUse(x, y, angle, crown ? 0.9 + rand() * 0.6 : 0.6 + rand() * 0.4, leafColor(c.line, rand), cls));
      }
      if (crown) {
        // A short twig up into the crown.
        const [twig, hi] = branch([c.x, c.cy], [0, -1], [c.x + (rand() - 0.5) * 30, c.top - 34], [0, -1], 4, 1.4, `${c.id}:twig`);
        wood.push(`<path class="wood${cls}" d="${twig}"/>`);
        light.push(`<path class="wood${cls}" d="${hi}"/>`);
      }
    }

    // People: semi-transparent medallions on top, so the wood shows through.
    for (const c of cards) {
      const p = idx.info(c.id);
      const st = MEDALLION[c.kind];
      const lines = wrapName(p.name);
      const cls = grow(`p:${c.id}:${c.kind}`) + (c.id === selected ? " selected" : "");
      const nameY = p.years ? (lines.length > 1 ? [-9, 5] : [-3]) : (lines.length > 1 ? [-3, 11] : [4]);
      const text = lines.map((l, i) =>
        `<text y="${nameY[i]}" font-size="12.5" font-weight="${st.weight}" fill="#2e2015">${esc(l)}</text>`).join("");
      const years = p.years
        ? `<text y="${lines.length > 1 ? 19 : 13}" font-size="10.5" letter-spacing="0.6" fill="#6e5b45">${esc(p.years)}</text>` : "";
      people.push(
        `<g class="person ${c.kind}${cls}" data-id="${esc(c.id)}"${c.kind === "root" || c.kind === "ancestor" ? ` data-anchor="${esc(c.id)}"` : ""} transform="translate(${f1(c.x)} ${f1(c.cy)})">` +
        `<title>${esc(p.name)}${p.years ? ` (${esc(p.years)})` : ""}</title>` +
        `<ellipse rx="${RX}" ry="${RY}" cx="2" cy="3" fill="#2b1a0c" opacity="0.16"/>` +
        `<ellipse class="frame" rx="${RX}" ry="${RY}" fill="${st.fill}" fill-opacity="0.8" stroke="${st.stroke}" stroke-width="${st.width}"/>` +
        `<ellipse rx="${RX - 4.5}" ry="${RY - 4.5}" fill="none" stroke="${st.inner}" stroke-width="0.8"${st.dash ? ` stroke-dasharray="${st.dash}"` : ""}/>` +
        text + years + `</g>`);
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(width)}" height="${f1(height)}" viewBox="0 0 ${f1(width)} ${f1(height)}"` +
      ` font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">` +
      `<defs>` +
      `<radialGradient id="paper" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#faf4e4"/><stop offset="1" stop-color="#eadcbc"/></radialGradient>` +
      `<symbol id="leaf" overflow="visible"><path d="M0 0C5-6.5 15-6.5 20 0C15 6.5 5 6.5 0 0Z"/>` +
      `<path d="M1.5 0H17" stroke="#24391b" stroke-opacity="0.35" stroke-width="0.7" fill="none"/></symbol>` +
      `</defs>` +
      `<rect width="100%" height="100%" fill="url(#paper)"/>` +
      ground +
      `<g fill="${WOOD}">${wood.join("")}${knots.join("")}</g>` +
      `<g fill="${WOOD_LIGHT}" opacity="0.45">${light.join("")}</g>` +
      `<g>${leaves.join("")}</g>` +
      `<g>${people.join("")}</g>` +
      `</svg>`;
    return { svg, keys };
  }

  // ------------------------------------------------------------------
  // View
  // ------------------------------------------------------------------
  // Style 1: the illustrated tree around one person (this file).
  // Style 2: the poster around a couple (poster.js, global FamilyPoster).
  const ZOOMS = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];
  const LABELS = ["Siblings", "Their children", "Grandchildren"];

  function create(el, { onStatus = () => {} } = {}) {
    const state = {
      idx: null, style: "1", zoom: 1, layout: null, selected: null, keys: null,
      root: null, levels: new Map(),               // style 1
      couple: null, title: null,                   // style 2 (title null = automatic)
      generations: { 1: "5", 2: "4" },             // remembered per style
    };
    const poster = () => global.FamilyPoster;
    const maxGenerations = () => Number(el.generations.value) || Infinity;
    const button = (text, onClick) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.addEventListener("click", onClick);
      return b;
    };
    const coupleName = (famId) => {
      const f = state.idx.family(famId);
      return [f.wife, f.husband].map((id) => (id ? state.idx.info(id).name : "?")).join(" & ");
    };

    // Style -------------------------------------------------------------
    function showStyleControls() {
      for (const node of document.querySelectorAll("[data-style]")) node.hidden = node.dataset.style !== state.style;
      el.search.placeholder = state.style === "1" ? "Type a name, e.g. Miguel Ramos" : "Type either spouse's name";
    }
    el.style.addEventListener("change", () => {
      state.generations[state.style] = el.generations.value;
      state.style = el.style.value;
      el.generations.value = state.generations[state.style];
      showStyleControls();
      el.matches.hidden = true;
      if (!state.idx) return;
      // Carry the current person over: Style 2 uses their first couple, Style 1 the selected person.
      if (state.style === "2" && !state.couple && state.root) {
        const u = state.idx.unions(state.root)[0];
        if (u) state.couple = u.famId;
      }
      if (state.style === "1" && !state.root && state.selected) state.root = state.selected;
      const has = state.style === "1" ? state.root : state.couple;
      el.search.value = !has ? "" : state.style === "1" ? state.idx.info(state.root).name : coupleName(state.couple);
      if (has) { state.keys = null; render(); centerOnFocus(); } else clearDrawing();
    });

    // Search -----------------------------------------------------------
    function showMatches() {
      const hits = state.idx ? state.idx.search(el.search.value) : [];
      let options;
      if (state.style === "1") {
        options = hits.map((p) => [p.id, p.years ? `${p.name} (${p.years})` : p.name]);
      } else {
        // Every couple of every matching person.
        const seen = new Set();
        options = [];
        for (const p of hits) {
          for (const u of state.idx.unions(p.id)) {
            if (seen.has(u.famId)) continue;
            seen.add(u.famId);
            options.push([u.famId, coupleName(u.famId)]);
          }
        }
      }
      el.matches.replaceChildren(...options.map(([value, text]) => Object.assign(document.createElement("option"), { value, textContent: text })));
      el.matches.hidden = !options.length;
      if (options.length) el.matches.size = Math.min(8, Math.max(2, options.length));
    }
    const pick = (value) => (state.style === "1" ? choose(value) : chooseCouple(value));

    function choose(id) {
      if (!id || !state.idx.has(id)) return;
      state.root = id;
      state.levels = new Map();
      state.selected = id;
      state.keys = null;
      el.search.value = state.idx.info(id).name;
      el.matches.hidden = true;
      render();
      centerOnFocus();
    }

    function chooseCouple(famId) {
      if (!famId || !state.idx.family(famId)) return;
      state.couple = famId;
      state.title = null;
      state.selected = null;
      el.search.value = coupleName(famId);
      el.matches.hidden = true;
      render();
      centerOnFocus();
    }

    function switchTo(style, value) {
      el.style.value = style;
      el.style.dispatchEvent(new Event("change"));
      pick(value);
    }

    el.search.addEventListener("input", showMatches);
    el.search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && !el.matches.hidden) {
        event.preventDefault();
        el.matches.focus();
        el.matches.selectedIndex = 0;
      } else if (event.key === "Enter" && el.matches.options.length) {
        pick(el.matches.options[0].value);
      } else if (event.key === "Escape") {
        el.matches.hidden = true;
      }
    });
    el.matches.addEventListener("click", () => pick(el.matches.value));
    el.matches.addEventListener("keydown", (event) => {
      if (event.key === "Enter") pick(el.matches.value);
      if (event.key === "Escape") { el.matches.hidden = true; el.search.focus(); }
    });
    el.generations.addEventListener("change", () => anchoredRender(state.selected || state.root));
    el.descendants.addEventListener("change", () => anchoredRender(state.selected));
    let titleTimer = null;
    el.title.addEventListener("input", () => {
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => { state.title = el.title.value; anchoredRender(state.selected); }, 350);
    });

    // Zoom -------------------------------------------------------------
    function setZoom(zoom) {
      const vp = el.viewport;
      const cx = (vp.scrollLeft + vp.clientWidth / 2) / state.zoom;
      const cy = (vp.scrollTop + vp.clientHeight / 2) / state.zoom;
      state.zoom = zoom;
      applyZoom();
      vp.scrollLeft = cx * zoom - vp.clientWidth / 2;
      vp.scrollTop = cy * zoom - vp.clientHeight / 2;
    }
    function applyZoom() {
      el.zoomLabel.textContent = Math.round(state.zoom * 100) + "%";
      if (!state.layout) return;
      el.stage.style.transform = `scale(${state.zoom})`;
      el.sizer.style.width = state.layout.width * state.zoom + "px";
      el.sizer.style.height = state.layout.height * state.zoom + "px";
    }
    // Next step up or down from the current zoom (which may be an in-between "fit" value).
    const stepZoom = (step) => {
      const next = step > 0 ? ZOOMS.find((z) => z > state.zoom + 1e-6)
                            : [...ZOOMS].reverse().find((z) => z < state.zoom - 1e-6);
      if (next) setZoom(next);
    };
    // Zoom out (or in) so the whole drawing fits in the window.
    function fitToWindow() {
      if (!state.layout) return;
      const vp = el.viewport;
      state.zoom = Math.max(0.02, Math.min(ZOOMS[ZOOMS.length - 1],
        (vp.clientWidth - 4) / state.layout.width, (vp.clientHeight - 4) / state.layout.height));
      applyZoom();
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
    }
    el.zoomIn.addEventListener("click", () => stepZoom(1));
    el.zoomOut.addEventListener("click", () => stepZoom(-1));
    el.zoomFit.addEventListener("click", fitToWindow);

    // Drag the background to move around ---------------------------------
    let drag = null;
    el.viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".person")) return;
      drag = { x: event.clientX, y: event.clientY, left: el.viewport.scrollLeft, top: el.viewport.scrollTop };
      el.viewport.setPointerCapture(event.pointerId);
      el.viewport.classList.add("panning");
    });
    el.viewport.addEventListener("pointermove", (event) => {
      if (!drag) return;
      el.viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      el.viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const endDrag = () => { drag = null; el.viewport.classList.remove("panning"); };
    el.viewport.addEventListener("pointerup", endDrag);
    el.viewport.addEventListener("pointercancel", endDrag);

    // Selecting a person -------------------------------------------------
    el.stage.addEventListener("click", (event) => {
      const g = event.target.closest(".person");
      if (!g) return;
      state.selected = g.dataset.id;
      for (const p of el.stage.querySelectorAll(".person")) p.classList.toggle("selected", p.dataset.id === state.selected);
      showSelection();
    });

    function showSelection() {
      const id = state.selected;
      if (!id || !state.layout) { el.selection.hidden = true; return; }
      const p = state.idx.info(id);
      const parts = [];
      const name = document.createElement("strong");
      name.textContent = p.name;
      parts.push(name);
      if (p.years) parts.push(document.createTextNode(` (${p.years})`));
      const couples = state.idx.unions(id);

      if (state.style === "1") {
        const c = state.layout.cards.find((k) => k.id === id && (k.kind === "root" || k.kind === "ancestor"));
        if (c) {
          for (let level = 1; level <= 3; level++) {
            if (level > 1 && (c.level < level - 1 || !c.counts[level - 2])) break;
            const label = document.createElement("label");
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = c.level >= level;
            box.disabled = !c.counts[level - 1];
            box.addEventListener("change", () => {
              state.levels.set(id, box.checked ? level : level - 1);
              anchoredRender(id);
            });
            label.append(box, ` ${LABELS[level - 1]} (${c.counts[level - 1]})`);
            parts.push(label);
          }
          if (c.more) parts.push(Object.assign(document.createElement("span"),
            { className: "hint", textContent: "More ancestors above: raise Generations." }));
        } else {
          parts.push(Object.assign(document.createElement("span"),
            { className: "hint", textContent: "Siblings can be shown for the chosen person and their ancestors." }));
        }
        if (id !== state.root) parts.push(button("Show this person's tree", () => choose(id)));
        for (const u of couples) parts.push(button(`Poster: ${coupleName(u.famId)}`, () => switchTo("2", u.famId)));
      } else {
        for (const u of couples) {
          if (u.famId !== state.couple) parts.push(button(`Centre on ${coupleName(u.famId)}`, () => chooseCouple(u.famId)));
        }
        parts.push(button("Tree of this person (Style 1)", () => switchTo("1", id)));
      }
      el.selection.replaceChildren(...parts);
      el.selection.hidden = false;
    }

    // Drawing ------------------------------------------------------------
    function render() {
      if (!state.idx) return;
      let svg;
      let status;
      if (state.style === "1") {
        if (!state.root) return;
        const layout = layoutTree(state.idx, state.root, state.levels, maxGenerations());
        const drawn = drawTree(layout, state.idx, state.keys, state.selected);
        state.layout = layout;
        state.keys = drawn.keys;
        svg = drawn.svg;
        status = `Showing ${layout.cards.length} people around ${state.idx.info(state.root).name}. Click a person for options.`;
      } else {
        if (!state.couple) return;
        const auto = poster().defaultTitle(state.idx, state.couple);
        if (state.title === null) el.title.value = auto;
        const title = state.title === null ? auto : state.title;
        const up = Math.min(Number(el.generations.value) || 6, 7);
        const down = Number(el.descendants.value) || Infinity;
        const layout = poster().layoutPoster(state.idx, state.couple, up, down, title);
        state.layout = layout;
        svg = poster().drawPoster(layout, state.idx, state.selected).svg;
        const known = layout.boxes.filter((b) => b.id).length;
        status = `Poster of ${coupleName(state.couple)}: ${known} people. Click a person for options.`;
      }
      el.stage.style.width = state.layout.width + "px";
      el.stage.style.height = state.layout.height + "px";
      el.stage.innerHTML = svg;
      el.empty.hidden = true;
      el.viewport.hidden = false;
      el.savePng.disabled = false;
      el.saveSvg.disabled = false;
      applyZoom();
      showSelection();
      onStatus(status);
    }

    function clearDrawing() {
      state.layout = null;
      state.selected = null;
      el.stage.replaceChildren();
      el.viewport.hidden = true;
      el.selection.hidden = true;
      el.savePng.disabled = true;
      el.saveSvg.disabled = true;
      el.empty.hidden = false;
      el.empty.textContent = state.style === "1" ? "Search for a person above to draw their tree."
                                                 : "Search for either spouse above to make the poster of a couple.";
    }

    // Re-render, keeping one person where it is on screen.
    function anchoredRender(id) {
      const find = () => [...el.stage.querySelectorAll(".person")]
        .find((g) => (state.style === "1" ? g.dataset.anchor : g.dataset.id) === id);
      const before = id && find();
      const rect = before && before.getBoundingClientRect();
      render();
      const after = id && find();
      if (rect && after) {
        const now = after.getBoundingClientRect();
        el.viewport.scrollLeft += now.left - rect.left;
        el.viewport.scrollTop += now.top - rect.top;
      }
    }

    // Scroll to the chosen person (Style 1) or the couple (Style 2).
    function centerOnFocus() {
      if (!state.layout) return;
      let x, y;
      if (state.style === "1") {
        const c = state.layout.cards.find((k) => k.id === state.root);
        if (!c) return;
        [x, y] = [c.x, c.cy];
      } else {
        [x, y] = [state.layout.couple.x, state.layout.couple.y];
      }
      el.viewport.scrollLeft = x * state.zoom - el.viewport.clientWidth / 2;
      el.viewport.scrollTop = y * state.zoom - el.viewport.clientHeight / 2;
    }

    // Saving ---------------------------------------------------------------
    const slug = (text) => normalize(text).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const fileStem = () => (state.style === "1"
      ? "family-tree-" + slug(state.idx.info(state.root).name)
      : "family-poster-" + slug(el.title.value || coupleName(state.couple)));
    const svgText = () => el.stage.querySelector("svg").outerHTML;
    function download(blob, name) {
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    el.saveSvg.addEventListener("click", () => {
      download(new Blob([svgText()], { type: "image/svg+xml" }), fileStem() + ".svg");
    });
    el.savePng.addEventListener("click", () => {
      const { width, height } = state.layout;
      // Twice the size for sharp prints, within what browsers allow for a canvas.
      const scale = Math.min(2, 16000 / Math.max(width, height), Math.sqrt(120e6 / (width * height)));
      const image = new Image();
      const url = URL.createObjectURL(new Blob([svgText()], { type: "image/svg+xml" }));
      onStatus("Creating the image…");
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) { download(blob, fileStem() + ".png"); onStatus("Image saved."); }
          else onStatus("Could not create the image: the drawing is too large. Try Save SVG.");
        }, "image/png");
      };
      image.onerror = () => { URL.revokeObjectURL(url); onStatus("Could not create the image. Try Save SVG."); };
      image.src = url;
    });

    showStyleControls();

    return {
      load(tree) {
        state.idx = indexTree(tree);
        state.root = null;
        state.couple = null;
        state.title = null;
        state.keys = null;
        clearDrawing();
        el.search.disabled = false;
        el.search.value = "";
        el.matches.hidden = true;
      },
      choose,
      chooseCouple,
    };
  }

  const api = {
    create, indexTree, layoutTree, drawTree, counts, CARD_W,
    // Shared with poster.js (Style 2).
    internals: { Shape, packRow, layoutDescendants, rng, branch, norm, f1, esc, wrapName, normalize },
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.FamilyTree = api;
})(typeof window !== "undefined" ? window : globalThis);

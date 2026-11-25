// Family tree view for GEDCOM Tools. Plain JavaScript, no dependencies.
//
// Rule:
// - one person is chosen (searched); they and all their ancestors are shown;
// - every ancestor (and the chosen person) has a "Siblings" checkbox that shows their full siblings;
// - then "Their children" shows the children of all those siblings (with the siblings' spouses);
// - then "Grandchildren" shows the siblings' grandchildren (with the children's spouses).
//   Two generations below a sibling is the maximum.
// - Couples: the woman on the left, the man on the right.
//
// Layout: one row per generation. An ancestor's siblings open on the outer side (a mother's to the
// left, a father's to the right; the chosen person's to the right). Every block is placed beside
// what already occupies the rows it touches, so cards never overlap. Lines are only horizontal and
// vertical: parents drop to a horizontal bar, the bar drops to each child.
(function (global) {
  "use strict";

  const CARD_W = 150;
  const GAP = 20;           // between unrelated cards
  const COUPLE_GAP = 8;     // between spouses
  const BASE_H = 56;        // name (2 lines) + years
  const CHECK_H = 19;       // one checkbox line
  const LANE = 7;           // distance between parallel horizontal bars
  const MARGIN = 40;
  const MAX_DEPTH = 60;     // guard against broken data

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
      info.set(id, { id, name, years, born: born ? Number(born) : null, sex: first(p.SEX), search: normalize(name) });
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
          return { spouse: info.has(spouse) ? spouse : null, children: birthOrder(asList(f.CHIL).map(ref)), isHusband };
        });
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

  // How many people each checkbox would add.
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
    add(card) {
      this.cards.push(card);
      const l = card.x - CARD_W / 2;
      const r = card.x + CARD_W / 2;
      const edge = this.rows.get(card.row);
      if (!edge) this.rows.set(card.row, [l, r]);
      else { edge[0] = Math.min(edge[0], l); edge[1] = Math.max(edge[1], r); }
    }
    merge(other) {
      for (const card of other.cards) this.add(card);
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

  function layoutTree(idx, rootId, levels) {
    let serial = 0;
    const card = (id, row, kind) => ({ key: serial++, id, row, kind, x: 0 });

    // A sibling (or a sibling's child) and the generations shown below them.
    function descendants(id, row, below) {
      const shape = new Shape();
      const unions = below > 0 ? idx.unions(id) : [];
      const self = card(id, row, "relative");
      shape.main = self;
      if (!unions.length) { shape.add(self); return shape; }

      const kidShapes = [];
      const kidsPerUnion = unions.map((u) => u.children.map((c) => {
        const s = descendants(c, row + 1, below - 1);
        kidShapes.push(s);
        return s.main;
      }));
      const kids = packRow(kidShapes);

      // Woman on the left, man on the right.
      const spouses = unions.map((u) => (u.spouse ? card(u.spouse, row, "spouse") : null));
      const isHusband = unions[0].isHusband || (!unions.some((u) => u.isHusband) && idx.info(id).sex === "M");
      const line = isHusband ? [...spouses.filter(Boolean), self] : [self, ...spouses.filter(Boolean)];

      const kidsEdge = kids.rows.get(row + 1);
      const center = kidsEdge ? (kidsEdge[0] + kidsEdge[1]) / 2 : 0;
      const width = line.length * CARD_W + (line.length - 1) * COUPLE_GAP;
      line.forEach((c, i) => { c.x = center - width / 2 + CARD_W / 2 + i * (CARD_W + COUPLE_GAP); });

      shape.merge(kids);
      line.forEach((c) => shape.add(c));
      unions.forEach((u, i) => {
        shape.families.push({ row, parents: spouses[i] ? [self, spouses[i]] : [self], children: kidsPerUnion[i] });
      });
      return shape;
    }

    // An ancestor (or the chosen person): their siblings and everyone above them.
    // side: "left" if they are the mother in the couple below, "right" if the father, "root" otherwise.
    function ancestor(id, row, side, depth) {
      const shape = new Shape();
      const self = card(id, row, depth === 0 ? "root" : "ancestor");
      self.level = levels.get(id) || 0;
      self.counts = counts(idx, id);
      shape.main = self;
      shape.add(self);
      const siblingCards = [];

      if (self.level > 0) {
        const units = idx.siblings(id).map((s) => descendants(s, row, self.level - 1));
        if (units.length) {
          const group = packRow(units);
          group.shift(side === "left" ? leftOf(shape, group) : rightOf(shape, group));
          shape.merge(group);
          siblingCards.push(...units.map((u) => u.main));
        }
      }

      const { mother, father } = depth < MAX_DEPTH ? idx.parents(id) : {};
      if (!mother && !father) return shape;

      // `shape` (this person, their siblings and the siblings' descendants) is the base;
      // the mother's side is placed to its left and the father's side to its right.
      const childrenRow = side === "left" ? [...siblingCards, self] : [self, ...siblingCards];
      const xs = childrenRow.map((c) => c.x);
      const center = (Math.min(...xs) + Math.max(...xs)) / 2;
      const half = mother && father ? (CARD_W + COUPLE_GAP) / 2 : 0;
      const upper = new Shape();
      let m = null;
      let f = null;

      if (mother) {
        m = ancestor(mother, row - 1, "left", depth + 1);
        m.shift(center - half - m.main.x);
        const dx = leftOf(shape, m);
        if (dx !== -Infinity && dx < 0) m.shift(dx);      // only ever move away
        upper.merge(m);
      }
      if (father) {
        f = ancestor(father, row - 1, "right", depth + 1);
        f.shift(center + half - f.main.x);
        const both = new Shape();
        both.merge(shape);
        both.merge(upper);
        // Spouses may stand closer together than unrelated cards.
        const gapFor = (r) => (m && r === row - 1 &&
          both.rows.get(r)[1] === m.main.x + CARD_W / 2 ? COUPLE_GAP : GAP);
        const dx = rightOf(both, f, gapFor);
        if (dx !== -Infinity && dx > 0) f.shift(dx);
        upper.merge(f);
      }

      // Slide this person's group under the middle of the parents, as far as the
      // cousins on either side allow.
      if (m && f) {
        const want = (m.main.x + f.main.x) / 2 - center;
        const maxRight = rightOf(shape, f) === -Infinity ? Infinity : -rightOf(shape, f);
        const maxLeft = rightOf(m, shape);                  // <= 0: how far left before touching the mother's side
        const move = Math.max(maxLeft, Math.min(want, maxRight));
        if (Number.isFinite(move)) shape.shift(move);
      }

      shape.merge(upper);
      shape.families.push({ row: row - 1, parents: [m, f].filter(Boolean).map((s) => s.main), children: childrenRow });
      return shape;
    }

    const shape = ancestor(rootId, 0, "root", 0);
    return place(shape);
  }

  // Turn the abstract layout into pixel positions, horizontal bar lanes and line paths.
  function cardHeight(c) {
    if (c.kind !== "root" && c.kind !== "ancestor") return BASE_H;
    return BASE_H + CHECK_H * (1 + (c.level >= 1 && c.counts[0] ? 1 : 0) + (c.level >= 2 && c.counts[1] ? 1 : 0));
  }

  function place(shape) {
    const { cards } = shape;
    const families = shape.families.filter((f) => f.parents.length + f.children.length > 1);
    const rows = [...new Set(cards.map((c) => c.row))].sort((a, b) => a - b);
    const rowHeight = new Map(rows.map((r) => [r, 0]));
    for (const c of cards) {
      c.h = cardHeight(c);
      rowHeight.set(c.row, Math.max(rowHeight.get(c.row), c.h));
    }

    // Lanes: families whose bars would overlap in the same gap get different heights.
    const lanesPerRow = new Map();
    const byRow = new Map();
    for (const f of families) {
      const xs = [...f.parents, ...f.children].map((c) => c.x);
      f.x1 = Math.min(...xs);
      f.x2 = Math.max(...xs);
      if (!byRow.has(f.row)) byRow.set(f.row, []);
      byRow.get(f.row).push(f);
    }
    for (const [row, list] of byRow) {
      list.sort((a, b) => a.x1 - b.x1);
      const laneEnds = [];
      for (const f of list) {
        let lane = laneEnds.findIndex((end) => end + 12 < f.x1);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = f.x2;
        f.lane = lane;
      }
      lanesPerRow.set(row, laneEnds.length);
    }

    const top = new Map();
    let y = MARGIN;
    for (const r of rows) {
      top.set(r, y);
      y += rowHeight.get(r) + 30 + Math.max(0, (lanesPerRow.get(r) || 1) - 1) * LANE;
    }
    const height = y - 30 + MARGIN;

    const minX = Math.min(...cards.map((c) => c.x)) - CARD_W / 2;
    const maxX = Math.max(...cards.map((c) => c.x)) + CARD_W / 2;
    const dx = MARGIN - minX;
    for (const c of cards) { c.x += dx; c.left = c.x - CARD_W / 2; c.top = top.get(c.row); }

    const paths = families.map((f) => {
      const barY = top.get(f.row) + rowHeight.get(f.row) + 14 + f.lane * LANE;
      let d = `M${f.x1 + dx} ${barY}H${f.x2 + dx}`;
      for (const p of f.parents) d += `M${p.x} ${p.top + p.h}V${barY}`;
      for (const c of f.children) d += `M${c.x} ${barY}V${c.top}`;
      return d;
    });

    return { cards, paths, width: maxX - minX + 2 * MARGIN, height, cardWidth: CARD_W };
  }

  // ------------------------------------------------------------------
  // View
  // ------------------------------------------------------------------
  const ZOOMS = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];
  const LABELS = ["Siblings", "Their children", "Grandchildren"];

  function create(el, { onStatus = () => {} } = {}) {
    const state = { idx: null, root: null, levels: new Map(), zoom: 1, layout: null };

    // Search -----------------------------------------------------------
    function showMatches() {
      const hits = state.idx ? state.idx.search(el.search.value) : [];
      el.matches.replaceChildren(...hits.map((p) => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.years ? `${p.name} (${p.years})` : p.name;
        return option;
      }));
      el.matches.hidden = !hits.length;
      if (hits.length) el.matches.size = Math.min(8, Math.max(2, hits.length));
    }

    function choose(id) {
      if (!id || !state.idx.has(id)) return;
      state.root = id;
      state.levels = new Map();
      el.search.value = state.idx.info(id).name;
      el.matches.hidden = true;
      render();
      centerOn(id);
    }

    el.search.addEventListener("input", showMatches);
    el.search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && !el.matches.hidden) {
        event.preventDefault();
        el.matches.focus();
        el.matches.selectedIndex = 0;
      } else if (event.key === "Enter" && el.matches.options.length) {
        choose(el.matches.options[0].value);
      } else if (event.key === "Escape") {
        el.matches.hidden = true;
      }
    });
    el.matches.addEventListener("click", () => choose(el.matches.value));
    el.matches.addEventListener("keydown", (event) => {
      if (event.key === "Enter") choose(el.matches.value);
      if (event.key === "Escape") { el.matches.hidden = true; el.search.focus(); }
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
    // Zoom out (or in) so the whole tree fits in the window.
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
      if (event.button !== 0 || event.target.closest("label, input, .tcard")) return;
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

    // Checkboxes ---------------------------------------------------------
    el.stage.addEventListener("change", (event) => {
      const box = event.target;
      if (!box.dataset.level) return;
      const id = box.closest(".tcard").dataset.id;
      const level = Number(box.dataset.level);
      state.levels.set(id, box.checked ? level : level - 1);
      // Keep the clicked card where it is on screen while the tree re-arranges.
      const before = box.closest(".tcard").getBoundingClientRect();
      render();
      const after = [...el.stage.querySelectorAll(".tcard[data-anchor]")].find((c) => c.dataset.anchor === id);
      if (after) {
        const now = after.getBoundingClientRect();
        el.viewport.scrollLeft += now.left - before.left;
        el.viewport.scrollTop += now.top - before.top;
        const again = after.querySelector(`input[data-level="${level}"]`);
        if (again) again.focus({ preventScroll: true });
      }
    });

    // Drawing ------------------------------------------------------------
    function cardElement(c) {
      const p = state.idx.info(c.id);
      const div = document.createElement("div");
      div.className = "tcard " + c.kind;
      div.dataset.id = c.id;
      div.style.cssText = `left:${c.left}px;top:${c.top}px;width:${CARD_W}px;height:${c.h}px`;
      const name = document.createElement("div");
      name.className = "tname";
      name.textContent = p.name;
      name.title = p.name;
      const years = document.createElement("div");
      years.className = "tyears";
      years.textContent = p.years || " ";
      div.append(name, years);

      if (c.kind === "root" || c.kind === "ancestor") {
        div.dataset.anchor = c.id;
        for (let level = 1; level <= 3; level++) {
          if (level > 1 && (c.level < level - 1 || !c.counts[level - 2])) break;
          const count = c.counts[level - 1];
          const label = document.createElement("label");
          const box = document.createElement("input");
          box.type = "checkbox";
          box.dataset.level = level;
          box.checked = c.level >= level;
          box.disabled = !count;
          label.append(box, ` ${LABELS[level - 1]} (${count})`);
          div.append(label);
        }
      }
      return div;
    }

    function render() {
      if (!state.idx || !state.root) return;
      const layout = layoutTree(state.idx, state.root, state.levels);
      state.layout = layout;
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", layout.width);
      svg.setAttribute("height", layout.height);
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", layout.paths.join(""));
      svg.append(path);
      el.stage.style.width = layout.width + "px";
      el.stage.style.height = layout.height + "px";
      el.stage.replaceChildren(svg, ...layout.cards.map(cardElement));
      el.empty.hidden = true;
      el.viewport.hidden = false;
      applyZoom();
      onStatus(`Showing ${layout.cards.length} people around ${state.idx.info(state.root).name}.`);
    }

    function centerOn(id) {
      const c = state.layout && state.layout.cards.find((k) => k.id === id);
      if (!c) return;
      el.viewport.scrollLeft = c.x * state.zoom - el.viewport.clientWidth / 2;
      el.viewport.scrollTop = (c.top + c.h / 2) * state.zoom - el.viewport.clientHeight / 2;
    }

    return {
      load(tree) {
        state.idx = indexTree(tree);
        state.root = null;
        state.layout = null;
        el.stage.replaceChildren();
        el.viewport.hidden = true;
        el.empty.hidden = false;
        el.empty.textContent = "Search for a person above to draw their tree.";
        el.search.disabled = false;
        el.search.value = "";
        el.matches.hidden = true;
      },
      choose,
    };
  }

  const api = { create, indexTree, layoutTree, counts, CARD_W };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.FamilyTree = api;
})(typeof window !== "undefined" ? window : globalThis);

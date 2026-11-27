# GEDCOM tools

Converts Quick Family Tree `.ftz` archives into GEDCOM 5.5.1. Python 3.8+, standard library only
(except the optional `interpret.py`, which needs `requests` and `python-dotenv`).

## Layout
- `src/gedcom_tools/` - the package; all conversion logic lives here and only here.
- `main.py` - CLI wrapper around `gedcom_tools.cli:main` (also the `gedcom-tools` command from `pyproject.toml`).
- `web/index.html` - static page that runs the package in the browser with Pyodide (fetches
  `../src/gedcom_tools/*.py`; the module list is hardcoded in the page, so update it when adding a module
  the converter imports). No build step, no npm. Two tabs: Convert, and Family tree. Convert also has a
  "GEDCOM → .ftz" section (a .zip/.ged/.json back to a Quick Family Tree file, `ftz_writer.file_to_ftz`).
  Retro 90s desktop style on purpose: square corners, bevelled grey, no rounded edges; the window fills
  the screen. A third tab, Book, builds the family book (web/book.js).
- `web/tree.js` - the Family tree tab (plain JS, also loadable in Node for tests). It reads the tree
  converted in the Convert tab by default, or a `.zip`/`.ged`/`.json` opened in the tab (`.ged` goes through
  `gedcom_to_json` in Pyodide; a `.zip` through `read_zip`, which also brings its photos). Values may be strings, objects or lists depending on the program that
  wrote the file, so read them through its `first`/`pointer`/`ref` helpers. Years are shown with the
  GEDCOM qualifier (`yearLabel`): BEF → "a. 1920", AFT → "d. 1920", ABT/CAL/EST → "c. 1920",
  BET → "1850/1860" (the book in English writes bef./aft.); `yearOf` gives the plain year for sorting. Rule: search one person;
  show them and all ancestors; each ancestor (and the chosen person) has checkboxes Siblings (full siblings
  only) → Their children (of all those siblings) → Grandchildren; never more than 2 generations below a
  sibling. Spouses are shown for anyone whose children are shown; couples are woman left, man right.
  Layout: one row per generation, a mother's side branches open left and a father's right, blocks are
  packed so people never overlap; the column under the chosen person stays free for the trunk.
  Drawing: an illustrated tree in SVG (not retro, unlike the interface). Family links form a branch
  skeleton rooted at the chosen person; each branch is a tapered Bezier shape whose radius follows the
  pipe model (~ sqrt of the people it carries); siblings hang from a bough; randomness (bends, leaves)
  is seeded by person ids so a tree always looks the same. People are semi-transparent medallions drawn
  on top of the wood. Click a person to get the Siblings / Their children / Grandchildren checkboxes.
  Default 5 generations (selector), Fit to max, Save PNG / Save SVG.
  The tab has a Style selector: 1 = this tree around a person, 2 = the poster below.
- `web/poster.js` - Style 2, the poster of a couple (needs tree.js; reuses its descendant layout and
  branch drawing via `FamilyTree.internals`). The couple is in the centre (wife left, husband right);
  descendants open downwards; the wife's ancestors open to the left and the husband's to the right as
  sideways pedigree charts (one generation per column, father above mother, bracket lines, empty boxes
  for unknown ancestors). A seeded decorative tree grows behind, and a title sits above the couple: one free
  text, fully editable (default: each spouse's surname, or their father's; "|" forces a line break).
  Descendant rows drop until they fit in the lower triangle between the diagonals of the ancestors'
  rectangle (crossing at the couple) and clear every ancestor box and bracket. Defaults: 4 generations up,
  all down.
- `web/book.js` - the Book tab: an A4 portrait family book of the whole tree (needs tree.js). Every
  family is drawn once as a sideways descendant chart (generations as columns, 4 per page; children
  stacked downwards; couple box = person + "∞ spouse"). A family hangs under the husband's parents'
  family, else the wife's; families with neither are roots, big roots are chapters. One full entry
  per person (where they formed their own family, else among their parents' children); every other
  appearance is a short box with "→ p."; "◄ p." points to a spouse's parents, "↑ p." to where a chart's
  head appears as a child. Page breaks cut whole families (largest first); small charts share pages.
  Cover, contents, charts, index of names. Person numbers [n.º] follow the index order (alphabetical by
  surname ignoring da/de/do…, then given name; no surname last), so they depend only on names. Notes are not printed in the charts; the index lists each person's note (wrapped, italic) under their name at the standard and detailed levels, leaving out the "Apelido deduzido" lines that the gedcom-surnames skill adds. Portuguese or English, three detail
  levels. Every full entry has a portrait photo frame (standard/detailed): filled from the person's
  `OBJE` photo when available (converted .ftz, or "Add photos…" matched by file name), empty otherwise.
  Unions: each person's unions in time order (∞¹ ∞² …); the full entry is with the first; unions drawn
  under the same parents are stacked (each with its own children), and the full entry lists every
  other union with "→ p."; a GEDCOM DIV shows as "· sep." (separated, + year), because a couple may
  have split without marrying. A remarried person's unions always stay together: all hang with that
  person and move to a continuation page as one block. Couple boxes have a thin dividing line.
  Text is never cut: each line is measured (canvas in the browser, an estimate in Node), shrunk to at most
  86% if slightly too long, otherwise wrapped; birth and death get one line each when they don't fit
  together. Box heights come from the measured text, so page breaks use real heights.
  Pages are SVGs in mm: previewed in the tab and printed with the browser's Print / Save as PDF.
  Before the index, a "Lugares de nascimento" page (when people have coordinates, see gedcom-places).
- `web/bookmap.js` - that birthplace map: a colour density (heat) layer, pale yellow to dark red, made with
  an SVG filter (blurred discs, alpha mapped to a colour ramp); the family's places are never named.
  World (Equal Earth) plus up to 4 enlarged areas (places within 90 km of the busiest ones), each named
  after its main reference city and drawn with reference detail. Births = birth place, else baptism;
  reads `info.birth.coords` from tree.js (PLAC → MAP → LATI/LONG).
- `web/worldmap.js` - country outlines for the world map: Natural Earth 1:50m (public domain, world-atlas
  2.0.2), simplified to 0.02°, delta-coded integers (1/40°). Loaded with the page.
- `web/mapdetail.js` - reference detail for the enlarged areas, Natural Earth 1:10m: land, country borders,
  admin-1 (district/state) borders, rivers, lakes, major and secondary roads, populated places (name +
  rank). ~2.8 MB, so the page loads it only when a book with coordinates is built. Inset geometry far
  outside a frame is pulled onto its margin, so a page stays ~200 KB. Regenerate only if the map needs it.
- `interpret.py` + `prompt.txt` - older OpenRouter/DeepSeek note interpreter.

`main.py` and `interpret.py` add `src/` to `sys.path`, so no install is needed.

## Pipeline
`.ftz` bytes → `ftz_to_json` (`parse_node_ftt` → `to_json`, GEDCOM as nested JSON) → `json_to_gedcom` → `.ged`
(all in `src/gedcom_tools/converter.py`; tag names in `enums.py`). `ftz_to_gedcom(data)` does the
whole thing with no file I/O; `convert()` is the CLI wrapper that reads/writes files.
Photos: the app stores them as `face/<person id>.jpg` in the `.ftz`. `ftz_photos(data)` returns them;
with `photo_dir`, `ftz_to_json` links each person to `<photo_dir>/<id>.jpg` (`OBJE` → `FILE` → `FORM jpg`).
Output format everywhere (CLI, web, both skills): `<name>.zip` = `<name>.ged` + the `<name>_photos/` folder
it links to, and `<name>.json` outside the zip (`write_outputs`, `make_zip`, `read_zip`, `collect_photos`).
Skills find a tree's photos next to its .json, inside `<name>.zip`, or inside another .zip in the folder.
`node.ftt` (UTF-8 with BOM, tab-separated): header `people couples last-person-id`; person lines of 29
columns (0 id, 2 parent couple, 3 sibling order, 12 surname, 13 given, 16-19 birth code/y/m/d,
20-23 death code/y/m/d, 24 sex 1/2, 25 the app's short "addition" line, 28 note with `<br>`); couple lines
of 12 (0 id, 1 divorced, 2 man, 3 his union order, 4 woman, 5 her union order). Event codes: 128 = date
known, 3 = deceased without a date, 2 = nothing. Columns 6-7 are layout positions (0.00 = automatic).
The converter joins note + addition, turns `<br>` into line breaks, and orders unions and children by
the app's order columns.

Back to .ftz: `ftz_writer.json_to_ftz` / `file_to_ftz` (CLI: `main.py tree.zip` writes `tree.ftz`, never
overwriting). New ids follow the record order, so pointers come back the same. What the app has no field
for goes into the person's note as GEDCOM lines, after the person's own note:
`NOTES` / own note / blank line / `GEDCOM` / `0 INDI` + level-1 tags, `0 FAM n` (the person's n-th union;
on the husband, else the wife) or `0 FAM CHILD` (their parents' family, when it has no spouse).
`split_note` / `apply_indi_extra` in converter.py apply it back (a date or name changed in the app wins).
.ged → .ftz → .ged gives the same records (line order inside a record follows `INDI_ORDER`/`FAM_ORDER`).
`gedcom_to_json(text)` is the reverse of `json_to_gedcom`: it reads any GEDCOM (ours or another
program's) into the same JSON shape, joining CONT/CONC. A tag that repeats becomes a list; INDI, FAM,
FAMC, FAMS and CHIL are always lists.

JSON conventions used by `json_to_gedcom`:
- `_PDEF` = pointer definition (`0 @I0001@ INDI`), `_PREF` = pointer reference, `_NAME` = line value
  of a block (`1 NAME Ana /Silva/`). These patch the *previous* line, so they must be the **first
  key** of their dict.
- A list repeats the tag; a string containing `\n` becomes CONT lines; long lines are split with CONC.

## Notes → GEDCOM records
To turn the free-text notes into BIRT/BAPM/DEAT/BURI/RESI/OCCU/MARR, use the
`gedcom-notes` skill (`.claude/skills/gedcom-notes/`). Agents without skill support can
follow `SKILL.md` and `rules.md` in that folder directly.

## Places → coordinates
To give the places coordinates (GEDCOM `MAP`/`LATI`/`LONG`, used by the book's map), use the
`gedcom-places` skill (`.claude/skills/gedcom-places/`). Coordinates are worked out by the agent and
asked to the user when ambiguous, never looked up online; answers stay in `<tree>_places/coords.json`.
Place readers must accept a PLAC that is a string or an object with `_NAME` (+ `MAP`).

## Privacy
`.ftz`, `.json`, `.ged`, `.zip` files and `*_photos/` folders are real family data and are gitignored.
Never commit them.

# GEDCOM tools

Converts Quick Family Tree `.ftz` archives into GEDCOM 5.5.1. Python 3.8+, standard library only
(except the optional `interpret.py`, which needs `requests` and `python-dotenv`).

## Layout
- `src/gedcom_tools/` - the package; all conversion logic lives here and only here.
- `main.py` - CLI wrapper around `gedcom_tools.cli:main` (also the `gedcom-tools` command from `pyproject.toml`).
- `web/index.html` - static page that runs the package in the browser with Pyodide (fetches
  `../src/gedcom_tools/*.py`; the module list is hardcoded in the page, so update it when adding a module
  the converter imports). No build step, no npm. Two tabs: Convert, and Family tree.
  Retro 90s desktop style on purpose: square corners, bevelled grey, no rounded edges; the window fills
  the screen.
- `web/tree.js` - the Family tree tab (plain JS, also loadable in Node for tests). It reads the tree
  converted in the Convert tab by default, or a `.ged`/`.json` opened in the tab (`.ged` goes through
  `gedcom_to_json` in Pyodide). Values may be strings, objects or lists depending on the program that
  wrote the file, so read them through its `first`/`pointer`/`ref` helpers. Rule: search one person;
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
- `interpret.py` + `prompt.txt` - older OpenRouter/DeepSeek note interpreter.

`main.py` and `interpret.py` add `src/` to `sys.path`, so no install is needed.

## Pipeline
`.ftz` bytes → `ftz_to_json` (`parse_node_ftt` → `to_json`, GEDCOM as nested JSON) → `json_to_gedcom` → `.ged`
(all in `src/gedcom_tools/converter.py`; tag names in `enums.py`). `ftz_to_gedcom(data)` does the
whole thing with no file I/O; `convert()` is the CLI wrapper that reads/writes files.
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

## Privacy
`.ftz`, `.json` and `.ged` files are real family data and are gitignored. Never commit them.

# GEDCOM tools

Converts Quick Family Tree `.ftz` archives into GEDCOM 5.5.1. Python 3.8+, standard library only
(except the optional `interpret.py`, which needs `requests` and `python-dotenv`).

## Layout
- `src/gedcom_tools/` - the package; all conversion logic lives here and only here.
- `main.py` - CLI wrapper around `gedcom_tools.cli:main` (also the `gedcom-tools` command from `pyproject.toml`).
- `web/index.html` - static page that runs the package in the browser with Pyodide (fetches
  `../src/gedcom_tools/*.py`; the module list is hardcoded in the page, so update it when adding a module
  the converter imports). No build step, no npm.
- `interpret.py` + `prompt.txt` - older OpenRouter/DeepSeek note interpreter.

`main.py` and `interpret.py` add `src/` to `sys.path`, so no install is needed.

## Pipeline
`.ftz` bytes → `ftz_to_json` (`parse_node_ftt` → `to_json`, GEDCOM as nested JSON) → `json_to_gedcom` → `.ged`
(all in `src/gedcom_tools/converter.py`; tag names in `enums.py`). `ftz_to_gedcom(data)` does the
whole thing with no file I/O; `convert()` is the CLI wrapper that reads/writes files.

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

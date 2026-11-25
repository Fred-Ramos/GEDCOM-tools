# GEDCOM tools

Converts Quick Family Tree `.ftz` archives into GEDCOM 5.5.1. Python 3.8+, standard library only
(except the optional `interpret.py`, which needs `requests` and `python-dotenv`).

## Pipeline
`.ftz` → `parse_node_ftt` → `to_json` (GEDCOM as nested JSON) → `json_to_gedcom` → `.ged`
(all in `gedcom_tools/converter.py`; tag names in `gedcom_tools/enums.py`).

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

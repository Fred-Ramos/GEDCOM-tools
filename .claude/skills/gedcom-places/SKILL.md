---
name: gedcom-places
description: Add map coordinates to the places of a GEDCOM JSON tree (from a Quick Family Tree .ftz) - every PLAC gets a GEDCOM MAP (LATI/LONG), worked out place by place and asked to the user when a place is ambiguous - so the family book can draw its birthplace map and other genealogy programs can show the places. Use when the user wants coordinates, geocoding, a map of places, or to locate the places of their family tree.
---

# Places → coordinates

Rules: [rules.md](rules.md). Read it fully before giving any coordinates.

All commands run from the repository root. `SK=.claude/skills/gedcom-places/scripts`.

## Workflow

1. **Get the JSON tree**, normally the latest one (e.g. `X_processed_surnames.json`).
2. **List the places:** `python3 $SK/extract_places.py X.json` writes `X_places/places.json` and
   prints every place without an answer yet: how often it is used, in which events, and a few
   people as examples.
3. **Work out the coordinates** (rules sections 1-3) and write them to `X_places/coords.json`.
   Use the family's other places (parents, spouse, the same person's other events) to tell
   which of several places with the same name is meant.
4. **Ask the user** about every place that stays ambiguous (rules section 4), with the
   AskUserQuestion tool, up to 4 per call, your best proposal first. Tell the user up front how
   many questions there are. Record "no coordinates" answers as `{"skip": "reason"}`.
5. **Apply:** `python3 $SK/apply_places.py X.json`. Adding coordinates changes nothing else, so
   the tree is updated in place (`X.json` + `X.zip`); the previous JSON is kept once as
   `X_places/before.json`. Use `--out STEM` to write elsewhere, `--dry-run` to check first.
6. **Report:** how many places and uses got coordinates, which were left out and why, and the
   answers the user gave.

`coords.json` stays in the `X_places/` folder, so a later run (for example after the notes or
surnames skills rebuilt the tree) only needs step 5 again, plus answers for new places.

The book (`web/book.js` + `web/bookmap.js`) draws a birthplace map from these coordinates; nothing
else in the book shows them.

These files contain personal family data. Keep them local (`*.json`, `*.ged`, `*.zip` are gitignored).
Examples in this skill use invented or generic places; keep it that way, because the repository is public.

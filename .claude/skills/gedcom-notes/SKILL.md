---
name: gedcom-notes
description: Interpret the free-text NOTE of each individual in a GEDCOM JSON (made from a Quick Family Tree .ftz) and turn it into real GEDCOM records - BIRT, BAPM, DEAT (with CAUS), BURI, RESI, OCCU on individuals and MARR, DIV (divorce) on families - then write the processed .json and .zip (.ged + photos). Use when the user wants to extract, interpret or structure family-tree notes, add marriages from notes, or enrich a .ged/.json/.ftz tree.
---

# GEDCOM notes → GEDCOM records

You read the notes and decide what they mean. Python scripts do the extraction
and the merge, so the tree's pointers and family links are never rewritten by hand.

Rules for interpreting notes: [rules.md](rules.md). Read it fully before writing any patch.

All commands run from the repository root. `SK=.claude/skills/gedcom-notes/scripts`.

## 1. Get the JSON tree
If the user gave a `.ftz`, convert it first (writes `NAME.json` and `NAME.zip` = `NAME.ged` + photos):

```bash
PYTHONPATH=src python3 -c "from gedcom_tools.converter import process_ftz; process_ftz('NAME.ftz', 'NAME')"
```

## 2. Extract the notes into batches

```bash
python3 $SK/extract_notes.py NAME.json            # → NAME_notes/batch_001.json …
```

Tell the user how many notes and batches there are. For a large tree, ask whether
to process everything or start with one batch so they can check the result first.

## 3. Write one patch per batch
For each `NAME_notes/batch_NNN.json`, read it and write `NAME_notes/patch_NNN.json`
following [rules.md](rules.md). Work one batch at a time: read it, write its patch,
then go to the next. Skip batches that already have a patch file when resuming.

After each few batches, run a dry run to catch mistakes early:

```bash
python3 $SK/apply_patches.py NAME.json NAME_notes --dry-run
```

Errors (unknown pointer, bad tag, invalid date) block the run: fix the patch and
run again.

## 4. Apply

```bash
python3 $SK/apply_patches.py NAME.json NAME_notes   # → NAME_processed.json + NAME_processed.zip (.ged + photos)
```

The original `NAME.json` is never modified.

## 5. Report to the user
- Counts printed by the script (events added, fields filled in, MARR added, notes removed).
- Every **conflict** (note disagrees with existing data; existing data was kept).
- A few before/after examples, including at least one marriage.
- Notes you deliberately left untouched because they were ambiguous.

These files contain personal family data. Keep them local: `*.json`, `*.ged` and `*.zip` are
gitignored, so never force-add them or send them anywhere.

"""
Validate note patches and merge them into a GEDCOM JSON, then write the
processed JSON and the .ged file.

Patch file format (see ../rules.md):
    {
      "individuals": {"@I0001@": {"BIRT": {"PLAC": "Porto"}, "OCCU": "lavrador", "NOTE": null}},
      "families":    {"@F0107@": {"MARR": {"DATE": "3 May 1850", "PLAC": "Victoria, Porto"}}}
    }

Merge rules: data that already exists is never overwritten. A missing event is
added, a missing sub-field (DATE/PLAC/CAUS) is added to an existing event, and a
different value is reported as a conflict and the existing value is kept.
"DEAT": "Y" is replaced by the death details. NOTE replaces the note, null deletes it.

Usage:
    python3 apply_patches.py TREE.json PATCH_DIR_OR_FILES... [--dry-run] [--out STEM]
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO_ROOT))
from gedcom_tools.converter import json_to_gedcom  # noqa: E402

INDI_EVENTS = {"BIRT", "BAPM", "DEAT", "BURI", "RESI"}
FAM_EVENTS = {"MARR"}
EVENT_FIELDS = ("DATE", "PLAC", "CAUS")
INDI_ORDER = ["_PDEF", "NAME", "SEX", "BIRT", "BAPM", "RESI", "OCCU", "DEAT", "BURI", "FAMC", "FAMS", "NOTE"]
FAM_ORDER = ["_PDEF", "HUSB", "WIFE", "MARR", "DIV", "CHIL"]

_MON = r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)"
_DATE = rf"(\d{{1,2}} {_MON} \d{{3,4}}|{_MON} \d{{3,4}}|\d{{3,4}})"
DATE_RE = re.compile(
    rf"^((ABT|CAL|EST|BEF|AFT) {_DATE}|BET {_DATE} AND {_DATE}|FROM {_DATE}( TO {_DATE})?|TO {_DATE}|{_DATE})$",
    re.IGNORECASE)


def ordered(record, order):
    out = {k: record[k] for k in order if k in record}
    out.update({k: v for k, v in record.items() if k not in out})
    return out


def validate_event(where, value, errors):
    if not isinstance(value, dict) or not value:
        errors.append(f"{where}: must be a non-empty object with {EVENT_FIELDS}")
        return
    for field, v in value.items():
        if field not in EVENT_FIELDS:
            errors.append(f"{where}.{field}: unknown field (allowed: {', '.join(EVENT_FIELDS)})")
        elif not isinstance(v, str) or not v.strip():
            errors.append(f"{where}.{field}: must be a non-empty string")
        elif field == "DATE" and not DATE_RE.match(v.strip()):
            errors.append(f"{where}.DATE: '{v}' is not a GEDCOM date (e.g. '7 Aug 1980', 'BEF 1850', 'ABT 1900')")


def merge_event(where, record, tag, new, stats, conflicts):
    current = record.get(tag)
    if not isinstance(current, dict):  # missing, or "Y"
        record[tag] = {f: new[f].strip() for f in EVENT_FIELDS if f in new}
        stats[f"{tag} added"] += 1
        return
    for field in EVENT_FIELDS:
        if field not in new:
            continue
        value = new[field].strip()
        if field not in current:
            current[field] = value
            stats[f"{tag}.{field} filled in"] += 1
        elif current[field].strip().lower() != value.lower():
            conflicts.append(f"{where} {tag}.{field}: kept '{current[field]}', note says '{value}'")
    record[tag] = ordered(current, list(EVENT_FIELDS))


def load_patches(sources):
    files = []
    for src in sources:
        p = Path(src)
        files.extend(sorted(p.glob("patch_*.json")) if p.is_dir() else [p])
    if not files:
        sys.exit("No patch files found (expected patch_*.json).")
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree")
    ap.add_argument("patches", nargs="+", help="patch_*.json files or a directory containing them")
    ap.add_argument("--dry-run", action="store_true", help="validate and report, write nothing")
    ap.add_argument("--out", help="output stem (default: <tree stem>_processed)")
    args = ap.parse_args()

    tree_path = Path(args.tree)
    data = json.loads(tree_path.read_text(encoding="utf-8"))
    indi_idx = {r["_PDEF"]: n for n, r in enumerate(data.get("INDI", []))}
    fam_idx = {r["_PDEF"]: n for n, r in enumerate(data.get("FAM", []))}

    errors, conflicts, warnings = [], [], []
    patches = []
    seen_indi = Counter()
    for f in load_patches(args.patches):
        try:
            patch = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{f.name}: invalid JSON ({e})")
            continue
        unknown_top = set(patch) - {"individuals", "families"}
        if unknown_top:
            errors.append(f"{f.name}: unknown top-level keys {sorted(unknown_top)}")
        for ptr, changes in patch.get("individuals", {}).items():
            where = f"{f.name} {ptr}"
            seen_indi[ptr] += 1
            if ptr not in indi_idx:
                errors.append(f"{where}: no such individual")
                continue
            for tag, value in changes.items():
                if tag in INDI_EVENTS:
                    validate_event(f"{where} {tag}", value, errors)
                elif tag == "OCCU":
                    vals = value if isinstance(value, list) else [value]
                    if not vals or not all(isinstance(v, str) and v.strip() for v in vals):
                        errors.append(f"{where} OCCU: must be a non-empty string or list of strings")
                elif tag == "NOTE":
                    if value is not None and not isinstance(value, str):
                        errors.append(f"{where} NOTE: must be a string or null")
                else:
                    errors.append(f"{where}: tag '{tag}' not allowed on individuals")
        for ptr, changes in patch.get("families", {}).items():
            where = f"{f.name} {ptr}"
            if ptr not in fam_idx:
                errors.append(f"{where}: no such family")
                continue
            for tag, value in changes.items():
                if tag in FAM_EVENTS:
                    validate_event(f"{where} {tag}", value, errors)
                else:
                    errors.append(f"{where}: tag '{tag}' not allowed on families")
        patches.append((f.name, patch))

    for ptr, n in seen_indi.items():
        if n > 1:
            warnings.append(f"{ptr} appears in {n} patch files; later NOTE values win")

    if errors:
        print("ERRORS - nothing was written. Fix the patches and run again:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    stats = Counter()
    for fname, patch in patches:
        for ptr, changes in patch.get("individuals", {}).items():
            n = indi_idx[ptr]
            rec = data["INDI"][n]
            where = f"{fname} {ptr}"
            for tag, value in changes.items():
                if tag in INDI_EVENTS:
                    merge_event(where, rec, tag, value, stats, conflicts)
                elif tag == "OCCU":
                    have = rec.get("OCCU", [])
                    have = [have] if isinstance(have, str) else list(have)
                    for v in (value if isinstance(value, list) else [value]):
                        if v.strip().lower() not in {h.lower() for h in have}:
                            have.append(v.strip())
                            stats["OCCU added"] += 1
                    rec["OCCU"] = have[0] if len(have) == 1 else have
                elif tag == "NOTE":
                    if value is None or not value.strip():
                        if "NOTE" in rec:
                            del rec["NOTE"]
                            stats["NOTE removed (fully extracted)"] += 1
                    else:
                        rec["NOTE"] = value.strip()
                        stats["NOTE shortened"] += 1
            if "NOTE" not in changes and any(t != "NOTE" for t in changes):
                warnings.append(f"{where}: data extracted but NOTE left unchanged")
            data["INDI"][n] = ordered(rec, INDI_ORDER)
        for ptr, changes in patch.get("families", {}).items():
            n = fam_idx[ptr]
            rec = data["FAM"][n]
            for tag, value in changes.items():
                merge_event(f"{fname} {ptr}", rec, tag, value, stats, conflicts)
            data["FAM"][n] = ordered(rec, FAM_ORDER)

    with_notes = [r["_PDEF"] for r in data["INDI"] if r.get("NOTE")]
    untouched = [p for p in with_notes if p not in seen_indi]

    print(f"Applied {len(patches)} patch file(s) to {tree_path.name}")
    for k in sorted(stats):
        print(f"  {k}: {stats[k]}")
    print(f"  individuals patched: {len(seen_indi)}; notes never patched: {len(untouched)}")
    if conflicts:
        print(f"\nCONFLICTS ({len(conflicts)}) - existing data kept:")
        for c in conflicts:
            print("  -", c)
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print("  -", w)

    if args.dry_run:
        print("\nDry run: nothing written.")
        return
    stem = args.out or str(tree_path.with_name(tree_path.stem + "_processed"))
    Path(stem + ".json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(stem + ".ged").write_text(json_to_gedcom(data), encoding="utf-8")
    print(f"\nWritten: {stem}.json and {stem}.ged")


if __name__ == "__main__":
    main()

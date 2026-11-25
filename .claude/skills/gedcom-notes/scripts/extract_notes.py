"""
Extract the NOTE of every individual from a GEDCOM JSON (made by converter.to_json)
into small batch files that are easy to read and interpret.

Each batch entry holds only what is needed to interpret the note:
the pointer, name, sex, the events that already exist, the families where the
person is a spouse (with the spouse's name and any existing MARR) and the note
split into lines.

Usage:
    python3 extract_notes.py TREE.json [--batch-size 40] [--out-dir DIR]
"""
import argparse
import json
from pathlib import Path

EVENT_TAGS = ("BIRT", "BAPM", "DEAT", "BURI", "RESI", "OCCU")


def note_lines(note: str):
    return [ln.strip() for ln in note.replace("<br>", "\n").split("\n") if ln.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree", help="GEDCOM JSON file (e.g. FamilyTree.json)")
    ap.add_argument("--batch-size", type=int, default=40)
    ap.add_argument("--out-dir", help="default: <tree stem>_notes/ next to the tree")
    args = ap.parse_args()

    tree_path = Path(args.tree)
    data = json.loads(tree_path.read_text(encoding="utf-8"))
    out_dir = Path(args.out_dir) if args.out_dir else tree_path.with_name(tree_path.stem + "_notes")
    out_dir.mkdir(parents=True, exist_ok=True)

    indi_by_ptr = {i["_PDEF"]: i for i in data.get("INDI", [])}
    fam_by_ptr = {f["_PDEF"]: f for f in data.get("FAM", [])}

    def name_of(ptr):
        indi = indi_by_ptr.get(ptr)
        return indi["NAME"].get("_NAME", "") if indi and isinstance(indi.get("NAME"), dict) else ""

    entries = []
    for indi in data.get("INDI", []):
        note = indi.get("NOTE")
        if not isinstance(note, str) or not note.strip():
            continue
        ptr = indi["_PDEF"]
        families = []
        for fams in indi.get("FAMS", []):
            fam = fam_by_ptr.get(fams.get("_PREF"))
            if not fam:
                continue
            spouse = fam.get("WIFE") if fam.get("HUSB") == ptr else fam.get("HUSB")
            fam_entry = {"fam": fam["_PDEF"], "spouse": spouse, "spouse_name": name_of(spouse) if spouse else None}
            if "MARR" in fam:
                fam_entry["MARR"] = fam["MARR"]
            families.append(fam_entry)
        entries.append({
            "id": ptr,
            "name": name_of(ptr),
            "sex": indi.get("SEX"),
            "existing": {t: indi[t] for t in EVENT_TAGS if t in indi},
            "families": families,
            "note": note_lines(note),
        })

    for old in out_dir.glob("batch_*.json"):
        old.unlink()
    n_batches = 0
    for start in range(0, len(entries), args.batch_size):
        n_batches += 1
        batch = entries[start:start + args.batch_size]
        (out_dir / f"batch_{n_batches:03d}.json").write_text(
            json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{len(entries)} individuals with notes -> {n_batches} batch file(s) in {out_dir}")


if __name__ == "__main__":
    main()

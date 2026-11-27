"""
Write the coordinates from TREE_places/coords.json into the tree: every PLAC whose text has an
answer gets a GEDCOM MAP (LATI/LONG) under it. Adding coordinates changes nothing else, so by
default the tree is updated in place (its .json and .zip); the previous .json is kept once as
TREE_places/before.json. Countries and skipped places get no coordinates.

Usage:
    python3 apply_places.py TREE.json [--out STEM] [--dry-run]
"""
import argparse
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[3] / "src"))
from places_lib import LEVELS, load_coords, place_name, to_gedcom_coords, walk_places  # noqa: E402
from gedcom_tools.converter import collect_photos, write_outputs  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree")
    ap.add_argument("--out", help="output stem (default: the tree itself)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    tree_path = Path(args.tree)
    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    folder = tree_path.with_name(tree_path.stem + "_places")
    coords = load_coords(folder)

    errors = []
    for place, c in coords.items():
        if c.get("skip") or c.get("level") == "country":
            continue
        if not isinstance(c.get("lat"), (int, float)) or not isinstance(c.get("lon"), (int, float)):
            errors.append(f"{place!r}: lat/lon must be numbers")
        elif not (-90 <= c["lat"] <= 90 and -180 <= c["lon"] <= 180):
            errors.append(f"{place!r}: lat/lon out of range")
        if c.get("level") not in LEVELS:
            errors.append(f"{place!r}: level must be one of {LEVELS}")
    if errors:
        print("ERRORS - nothing written:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    stats = Counter()
    for rec, path, node, key in walk_places(tree):
        value = node[key]
        name = place_name(value)
        c = coords.get(name)
        if not c:
            stats["no answer yet"] += 1
            continue
        if c.get("skip") or c.get("level") == "country":
            stats["left without coordinates (country or skipped)"] += 1
            continue
        plac = dict(value) if isinstance(value, dict) else {"_NAME": name}
        new = to_gedcom_coords(c["lat"], c["lon"])
        stats["coordinates " + ("updated" if plac.get("MAP") and plac["MAP"] != new else
                                "unchanged" if plac.get("MAP") == new else "added")] += 1
        plac["MAP"] = new
        node[key] = plac

    for k in sorted(stats):
        print(f"  {k}: {stats[k]}")
    if args.dry_run:
        print("Dry run: nothing written.")
        return
    stem = args.out or str(tree_path.with_suffix(""))
    backup = folder / "before.json"
    if not args.out and not backup.exists():
        folder.mkdir(exist_ok=True)
        shutil.copyfile(tree_path, backup)
        print(f"Previous tree kept as {backup}")
    print(write_outputs(stem, tree, collect_photos(str(tree_path), tree)))


if __name__ == "__main__":
    main()

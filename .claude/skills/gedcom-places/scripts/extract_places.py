"""
List every distinct place (PLAC) of a GEDCOM JSON tree, with how often and where it is used,
so coordinates can be worked out for each one.

Usage:
    python3 extract_places.py TREE.json            # -> TREE_places/places.json + the open ones printed
    python3 extract_places.py TREE.json --all      # print every place, also the ones already answered
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from places_lib import load_coords, person_name, place_name, walk_places, year_of  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    tree_path = Path(args.tree)
    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    folder = tree_path.with_name(tree_path.stem + "_places")
    folder.mkdir(exist_ok=True)

    uses = Counter()
    events = defaultdict(Counter)
    examples = defaultdict(list)
    has_map = set()
    for rec, path, node, key in walk_places(tree):
        name = place_name(node[key] if not isinstance(node[key], list) else node[key][0])
        if not name:
            continue
        uses[name] += 1
        events[name][path[0] if path else "?"] += 1
        if len(examples[name]) < 3:
            examples[name].append(f"{person_name(rec)} ({path[0] if path else '?'} {year_of(node)})".replace(" )", ")"))
        if isinstance(node[key], dict) and node[key].get("MAP"):
            has_map.add(name)

    coords = load_coords(folder)
    places = [{"place": p, "uses": n, "events": dict(events[p]), "examples": examples[p],
               "answered": p in coords, "has_coordinates": p in has_map}
              for p, n in sorted(uses.items(), key=lambda x: (-x[1], x[0]))]
    (folder / "places.json").write_text(json.dumps(places, ensure_ascii=False, indent=1), encoding="utf-8")

    open_ = [p for p in places if not p["answered"]]
    print(f"{len(places)} distinct places, {sum(uses.values())} uses; answered in coords.json: "
          f"{len(places) - len(open_)}; still open: {len(open_)}")
    for p in (places if args.all else open_):
        ev = ", ".join(f"{k} {v}" for k, v in p["events"].items())
        print(f"- {p['place']!r}  x{p['uses']}  [{ev}]  e.g. {'; '.join(p['examples'])}")
    print(f"\nWritten: {folder / 'places.json'}")


if __name__ == "__main__":
    main()

"""
Write the cleaned names (rules section 2) and the user's answers (names_*.json) into a NEW tree:
<tree stem>_surnames.json and <tree stem>_surnames.ged. The input tree is never modified.

For every changed person the birth NAME comes first (with GIVN, SURN, NICK, TYPE birth), then any
married names (TYPE married), alternative surnames and the original name (TYPE aka).

Usage:
    python3 apply_names.py TREE.json [--dir ANSWERS_DIR] [--dry-run]
"""
import argparse
import collections
import copy
import json
import os

from names_lib import Tree, clean, load_answers, load_config, squash
from gedcom_tools.converter import json_to_gedcom


def name_record(given, surname, kind, nick=None):
    rec = {"_NAME": f"{given} /{surname}/"}
    if kind == "birth":
        if given:
            rec["GIVN"] = given
        if surname:
            rec["SURN"] = surname
        if nick:
            rec["NICK"] = nick
    rec["TYPE"] = kind
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree")
    ap.add_argument("--dir", help="answers folder (default: <tree stem>_names)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    stem = os.path.splitext(args.tree)[0]
    folder = args.dir or stem + "_names"
    with open(args.tree, encoding="utf-8") as f:
        data = json.load(f)
    out = copy.deepcopy(data)
    config = load_config(folder)
    tree = Tree(out, config)
    answers = load_answers(folder) if os.path.isdir(folder) else {}
    unknown = [pid for pid in answers if pid not in tree.people]
    if unknown:
        raise SystemExit(f"Answers for unknown people: {unknown[:5]}")

    stats = collections.Counter()
    recent = config.get("recent_generations")
    for pid, person in tree.people.items():
        c = clean(person, config["abbreviations"])
        a = answers.get(pid, {})
        if a and not tree.is_recent(pid, recent):
            # Older generations keep their surnames as recorded: earlier answers for them are not used.
            stats["answer skipped: older generation"] += 1
            a = {}
        surname = squash(a["surname"]) if "surname" in a else c["surname"]
        if a.get("given"):                      # the answer may also correct the given name
            c["given"] = squash(a["given"])
            c["changes"].append("given name corrected")
        married = c["married"] + [squash(m) for m in a.get("married", [])]
        if not c["changes"] and "surname" not in a and not a.get("married"):
            continue
        for change in c["changes"]:
            stats[change] += 1
        if "surname" in a and squash(a["surname"]) != c["surname"]:
            stats["answer: surname " + ("filled in" if not c["surname"] else "changed")] += 1
        if a.get("married"):
            stats["answer: recorded name kept as married name"] += 1
        if a.get("basis") and surname:
            # A worked-out surname is marked in the person's note.
            line = f"Apelido deduzido (não registado): {surname}. Base: {a['basis']}."
            note = person.get("NOTE")
            if isinstance(note, str) and note.strip():
                if line not in note:
                    person["NOTE"] = note.rstrip() + "\n" + line
            elif not note:
                person["NOTE"] = line
            stats["note added: surname guessed"] += 1

        records = [name_record(c["given"], surname, "birth", c["nick"])]
        records += [name_record(c["given"], m, "married") for m in dict.fromkeys(married) if m and m != surname]
        records += [name_record(c["given"], x, "aka") for x in c["aka"]]
        if squash(c["original"]) != squash(records[0]["_NAME"]):
            records.append({"_NAME": c["original"], "TYPE": "aka"})
        person["NAME"] = records[0] if len(records) == 1 else records
        stats["people changed"] += 1

    empty = sum(1 for p in tree.people.values()
                if not (p["NAME"][0] if isinstance(p["NAME"], list) else p["NAME"]).get("SURN"))
    for k in sorted(stats):
        print(f"  {k}: {stats[k]}")
    print(f"  people still without a surname: {empty}")
    if args.dry_run:
        print("Dry run: nothing written.")
        return
    out_stem = stem + "_surnames"
    with open(out_stem + ".json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    with open(out_stem + ".ged", "w", encoding="utf-8") as f:
        f.write(json_to_gedcom(out))
    print(f"Written: {out_stem}.json and {out_stem}.ged (input unchanged)")


if __name__ == "__main__":
    main()

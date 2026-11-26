"""
List the surname decisions still to be taken (rules sections 3-4), oldest generation first.

Already answered people (names_*.json in the answers folder) count as known, so their children get
proposals built from the answers. Siblings with the same parents and no surname form one group:
one question for the whole group.

Usage:
    python3 extract_names.py TREE.json --setup          # what to ask the user before starting
    python3 extract_names.py TREE.json [--dir ANSWERS_DIR] [--next N]
Writes ANSWERS_DIR/cases.json (all open groups) and prints a summary plus the next N groups.
"""
import argparse
import collections
import json
import os
import re

from names_lib import Tree, clean, load_answers, load_config, name_parts, passes_on, squash, units


def setup(tree):
    """Print the tree-specific questions for the user (rules section 0)."""
    abbreviations = collections.Counter()
    examples = collections.defaultdict(list)
    for pid, p in tree.people.items():
        _given, surname, full = name_parts(p)
        for token in re.findall(r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{1,4}\b", surname):
            abbreviations[token] += 1
            examples[token].append(full)
    print("1. Abbreviations in surnames (ask what each means, or 'keep as is'):")
    for token, n in abbreviations.most_common():
        print(f"   {token}: {n} people, e.g. {examples[token][:3]}")

    compounds = collections.Counter()
    for pid in tree.people:
        _m, father = tree.parents(pid)
        if not father:
            continue
        a, b = units(squash(name_parts(tree.people[pid])[1])), units(squash(name_parts(tree.people[father])[1]))
        k = 0
        while k < min(len(a), len(b)) and a[-1 - k] == b[-1 - k]:
            k += 1
        if k >= 2:
            compounds[" ".join(a[-k:])] += 1
    print("2. Multi-word surnames a child carries unchanged from the father (ask which pass on whole):")
    for c, n in compounds.most_common(30):
        if n >= 2:
            print(f"   {c}: {n} children")

    marker = re.compile(r"\b(San|Santa Mar[ií]a|Ntra|Nuestra|Asunci[oó]n|de la|del)\b")
    places = collections.Counter()
    for p in tree.people.values():
        for tag in ("BIRT", "BAPM"):
            e = p.get(tag)
            e = e[0] if isinstance(e, list) else e
            if isinstance(e, dict) and e.get("PLAC") and (marker.search(e["PLAC"]) or tree.spanish_places.search(e["PLAC"])):
                places[e["PLAC"]] += 1
    print("3. Places that look Spanish-speaking (ask which towns/regions use Spanish naming):")
    for place, n in places.most_common():
        print(f"   {place}: {n}")
    print("\nSave the answers in the answers folder as config.json:")
    print('   {"abbreviations": {"XY": "Meaning"}, "compound_surnames": ["..."], "spanish_places": ["Town", "Region"]}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tree")
    ap.add_argument("--dir", help="answers folder (default: <tree stem>_names)")
    ap.add_argument("--next", type=int, default=4, help="how many open groups to print in full")
    ap.add_argument("--setup", action="store_true", help="print the questions to ask before starting")
    args = ap.parse_args()

    stem = os.path.splitext(args.tree)[0]
    folder = args.dir or stem + "_names"
    os.makedirs(folder, exist_ok=True)
    config = load_config(folder)
    with open(args.tree, encoding="utf-8") as f:
        tree = Tree(json.load(f), config)
    if args.setup:
        setup(tree)
        return
    if not os.path.exists(os.path.join(folder, "config.json")):
        raise SystemExit(f"No {folder}/config.json yet: run with --setup, ask the user, save their answers first.")
    answers = load_answers(folder)
    cleaned = {pid: clean(p, config["abbreviations"]) for pid, p in tree.people.items()}

    def pass_on(surname_, spanish_):
        return passes_on(surname_, spanish_, config["compound_surnames"])

    def surname(pid):
        if pid in answers and "surname" in answers[pid]:
            return answers[pid]["surname"]
        return cleaned[pid]["surname"]

    def label(pid):
        c = cleaned[pid]
        y = tree.years(pid)
        return f"{c['given']}{' /' + surname(pid) + '/' if surname(pid) else ''}{f' ({y})' if y else ''}"

    # ---- Proposals for people without a birth surname --------------------------------
    def proposal(pid):
        """(proposal, alternatives, reason, confidence) or None when nothing is known."""
        spanish = tree.is_spanish(pid)
        mother, father = tree.parents(pid)
        ms, fs = (surname(mother) if mother else ""), (surname(father) if father else "")
        alternatives = []
        recorded = sorted({surname(s) for s in tree.siblings(pid) if surname(s)})
        if len(recorded) == 1:
            reason = f"recorded siblings are all '{recorded[0]}'"
            main, confidence = recorded[0], "likely"
        elif ms or fs:
            mp, fp = pass_on(ms, spanish), pass_on(fs, spanish)
            parts = [fp, mp] if spanish else [mp, fp]
            main = squash(" ".join(x for x in parts if x))
            conv = "Spanish: father's first + mother's first" if spanish else "Portuguese: mother's + father's"
            reason = f"{conv} (mother '{ms or '?'}', father '{fs or '?'}')"
            if recorded:
                reason += f"; recorded siblings: {', '.join(recorded)}"
            confidence = "guess"
        else:
            # Rules 3.5: read it back from the children.
            candidates = set()
            for _fam, spouse, children in tree.unions(pid):
                spouse_s = surname(spouse) if spouse else ""
                for child in children:
                    cs = surname(child)
                    if not cs or pid in answers:
                        continue
                    spanish_c = tree.is_spanish(child)
                    cu = units(cs)
                    is_father = tree.sex(pid) == "M"
                    if spanish_c and len(cu) >= 2:
                        candidates.add(cu[0] if is_father else cu[1])
                    elif not spanish_c and spouse_s:
                        sp = pass_on(spouse_s, False)
                        if is_father and cs.startswith(sp + " "):
                            candidates.add(cs[len(sp) + 1:])
                        elif not is_father and cs.endswith(" " + sp) and cs != sp:
                            candidates.add(units(cs[: -len(sp) - 1])[-1])
            # A part that already appears in the other parent's surname is that parent's, not evidence.
            other_words = set()
            for _fam, spouse, _children in tree.unions(pid):
                if spouse:
                    other_words |= {w.lower() for w in surname(spouse).split()}
            candidates = {c for c in candidates
                          if any(w.lower() not in other_words for w in c.split() if w.lower() not in ("da", "de", "do", "dos", "das"))}
            if len(candidates) != 1:
                return None
            main = candidates.pop()
            reason = "read back from the children's surnames"
            confidence = "guess"
        if fs and squash(fs) != main:
            alternatives.append(fs)          # the father's full surname (most common in this tree)
        return main, alternatives, reason, confidence

    groups = {}
    nothing_known = []
    recent = config.get("recent_generations")
    older = 0
    for pid in tree.people:
        if surname(pid) or pid in answers:
            continue
        if not tree.is_recent(pid, recent):
            older += 1                     # older generations keep their surnames as recorded
            continue
        result = proposal(pid)
        if not result:
            nothing_known.append(pid)
            continue
        main, alternatives, reason, confidence = result
        famc = tree.famc(pid)
        key = f"family {famc}" if famc and "children" not in reason else f"person {pid}"
        g = groups.setdefault(key, {"key": key, "kind": "missing", "ids": [], "proposal": main,
                                    "alternatives": alternatives, "reason": reason, "confidence": confidence})
        g["ids"].append(pid)

    # ---- Rules section 4: women whose recorded surname may be a married name ---------
    for pid in tree.people:
        if pid in answers or tree.sex(pid) != "F" or not surname(pid) or cleaned[pid]["married"]:
            continue
        if not tree.is_recent(pid, recent):
            continue
        mother, father = tree.parents(pid)
        if not (mother and father and surname(mother) and surname(father)):
            continue
        rec = surname(pid)
        for _fam, spouse, _children in tree.unions(pid):
            if not spouse or not surname(spouse):
                continue
            sp = pass_on(surname(spouse), False)
            if rec.endswith(" " + sp) and rec != sp:
                spanish = tree.is_spanish(pid)
                mp, fp = pass_on(surname(mother), spanish), pass_on(surname(father), spanish)
                birth = squash(" ".join([fp, mp] if spanish else [mp, fp]))
                if birth != rec and not rec.startswith(birth + " "):
                    continue
                if birth != rec:
                    groups[f"married {pid}"] = {
                        "key": f"married {pid}", "kind": "married?", "ids": [pid], "proposal": birth,
                        "alternatives": [rec], "confidence": "guess",
                        "reason": f"recorded '{rec}' ends with husband's surname '{sp}'; parents give '{birth}'"}
                break

    ordered = sorted(groups.values(), key=lambda g: (min(tree.generation(i) for i in g["ids"]), g["key"]))
    for g in ordered:
        g["people"] = [label(i) for i in g["ids"]]
        g["generation"] = min(tree.generation(i) for i in g["ids"])
        mother, father = tree.parents(g["ids"][0])
        g["parents"] = [label(x) for x in (mother, father) if x]
        g["convention"] = "Spanish" if tree.is_spanish(g["ids"][0]) else "Portuguese"
    with open(os.path.join(folder, "cases.json"), "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=1)

    changes = collections.Counter(c for x in cleaned.values() for c in x["changes"])
    print(f"Cleaning (applied automatically): " + ", ".join(f"{k}: {v}" for k, v in changes.most_common()))
    print(f"Answered so far: {len(answers)} people")
    print(f"Open questions: {len(ordered)} ({sum(len(g['ids']) for g in ordered)} people); "
          f"no evidence, will stay empty: {len(nothing_known)}")
    if recent:
        print(f"Only the {recent} most recent generations are filled in: {older} older people without a "
              f"surname stay as recorded.")
    for n, g in enumerate(ordered[: args.next], 1):
        print(f"\n[{n}] {g['key']} | gen {g['generation']} | {g['convention']} | {g['kind']} | {g['confidence']}")
        print("    people:  " + "; ".join(g["people"]))
        print("    parents: " + ("; ".join(g["parents"]) or "-"))
        print(f"    propose: {g['proposal']}   alternatives: {g['alternatives']}")
        print(f"    why:     {g['reason']}")


if __name__ == "__main__":
    main()

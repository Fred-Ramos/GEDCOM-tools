"""
Shared logic for the gedcom-surnames skill (see ../rules.md): reading names, the fixed cleaning
rules (section 2), the naming conventions and the surname a person passes on (section 3).
"""
import glob
import json
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "src"))

PARTICLES = {"da", "de", "do", "dos", "das", "del", "la"}
JOINERS = {"e", "y"}
SAINTS = {"São", "Santa", "Santo", "San", "Sant'", "Sant’"}
# Generic only. Everything specific to one family tree (what an abbreviation means, which
# multi-word surnames pass on whole, which towns use Spanish naming) lives in that tree's local
# config.json, filled in by asking the user (see ../rules.md, section 0). Never put it here.
SPANISH_COUNTRIES = (r"Espanha|España|Spain|M[eé]xico|Chile|Argentina|Uruguai|Uruguay|Col[oô]mbia|Peru|Per[uú]|"
                     r"Venezuela|Cuba|Bol[ií]via|Paraguai|Paraguay|Equador|Ecuador")
CONFIG_DEFAULTS = {"abbreviations": {}, "compound_surnames": [], "spanish_places": [],
                   "recent_generations": None}    # None = fill in surnames in every generation
GENERATION_YEARS = 28
TITLE = re.compile(r"^(Avó|Avô)\s+")
NICK = re.compile(r"\s*['‘’]([^'‘’]+)['‘’]\s*")


def as_list(v):
    return v if isinstance(v, list) else [] if v is None else [v]


def first(v):
    items = as_list(v)
    return items[0] if items else None


def load_config(folder):
    """The tree's local config (config.json in the answers folder), or the defaults."""
    path = os.path.join(folder, "config.json")
    config = dict(CONFIG_DEFAULTS)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            config.update(json.load(f))
    return config


def ref(v):
    return v.get("_PREF") if isinstance(v, dict) else v


def place_text(plac):
    """The name of a place: PLAC may be a string or an object with _NAME (and MAP coordinates)."""
    return str((plac.get("_NAME") if isinstance(plac, dict) else plac) or "")


def squash(text):
    return " ".join(str(text or "").split())


class Tree:
    """Indexes a GEDCOM JSON tree: people, families, parents, children, spouses, generations."""

    def __init__(self, data, config=None):
        config = config or CONFIG_DEFAULTS
        self.data = data
        places = [SPANISH_COUNTRIES] + [re.escape(p) for p in config.get("spanish_places", [])]
        self.spanish_places = re.compile("|".join(places), re.IGNORECASE)
        self.people = {p["_PDEF"]: p for p in data.get("INDI", [])}
        self.families = {f["_PDEF"]: f for f in data.get("FAM", [])}
        self._gen = {}

    def famc(self, pid):
        return ref(first(self.people[pid].get("FAMC")))

    def parents(self, pid):
        f = self.families.get(self.famc(pid)) or {}
        mother, father = ref(first(f.get("WIFE"))), ref(first(f.get("HUSB")))
        return (mother if mother in self.people else None, father if father in self.people else None)

    def siblings(self, pid):
        f = self.families.get(self.famc(pid)) or {}
        return [c for c in map(ref, as_list(f.get("CHIL"))) if c != pid and c in self.people]

    def unions(self, pid):
        """[(family id, spouse id or None, [children])] where pid is a spouse."""
        out = []
        for r in as_list(self.people[pid].get("FAMS")):
            f = self.families.get(ref(r))
            if not f:
                continue
            husband, wife = ref(first(f.get("HUSB"))), ref(first(f.get("WIFE")))
            spouse = wife if husband == pid else husband
            out.append((f["_PDEF"], spouse if spouse in self.people else None,
                        [c for c in map(ref, as_list(f.get("CHIL"))) if c in self.people]))
        return out

    def generation(self, pid, seen=()):
        """0 for people without known parents; otherwise one more than the oldest parent."""
        if pid in self._gen:
            return self._gen[pid]
        if pid in seen:
            return 0
        gens = [self.generation(p, seen + (pid,)) for p in self.parents(pid) if p]
        self._gen[pid] = (max(gens) + 1) if gens else 0
        return self._gen[pid]

    def sex(self, pid):
        return first(self.people[pid].get("SEX"))

    def birth_year(self, pid):
        """Recorded birth (or baptism) year, or None."""
        p = self.people[pid]
        for tag in ("BIRT", "BAPM"):
            e = first(p.get(tag))
            d = e.get("DATE") if isinstance(e, dict) else None
            m = re.findall(r"\d{3,4}", str(d or ""))
            if m:
                return int(m[-1])
        return None

    def estimated_births(self):
        """Birth years for everyone: recorded, or estimated from relatives (parents + 28, children - 28,
        spouses and siblings about the same), repeated until nothing changes."""
        if hasattr(self, "_births"):
            return self._births
        known = {pid: y for pid in self.people if (y := self.birth_year(pid))}
        for _ in range(30):
            added = {}
            for pid in self.people:
                if pid in known:
                    continue
                guesses = []
                guesses += [known[x] + GENERATION_YEARS for x in self.parents(pid) if x in known]
                for _fam, spouse, children in self.unions(pid):
                    if spouse in known:
                        guesses.append(known[spouse])
                    guesses += [known[c] - GENERATION_YEARS for c in children if c in known]
                guesses += [known[s] for s in self.siblings(pid) if s in known]
                if guesses:
                    added[pid] = round(sum(guesses) / len(guesses))
            if not added:
                break
            known.update(added)
        self._births = known
        self._youngest = max((y for pid in self.people if (y := self.birth_year(pid))), default=None)
        return known

    def is_recent(self, pid, generations):
        """In the `generations` most recent generations (counted back from the youngest birth in the
        tree, GENERATION_YEARS per generation)? People with no date anywhere near them count as old."""
        if not generations:
            return True
        births = self.estimated_births()
        if pid not in births or self._youngest is None:
            return False
        return (self._youngest - births[pid]) // GENERATION_YEARS < generations

    def years(self, pid):
        p = self.people[pid]

        def year(tag):
            e = first(p.get(tag))
            d = e.get("DATE") if isinstance(e, dict) else None
            m = re.findall(r"\d{3,4}", str(d or ""))
            return m[-1] if m else ""
        b, d = year("BIRT") or year("BAPM"), year("DEAT")
        return f"{b}–{d}" if (b or d) else ""

    def is_spanish(self, pid):
        """Spanish naming if born/baptised in a Spanish-speaking place (or, if unknown, a parent was)."""
        def own(x):
            p = self.people[x]
            for tag in ("BIRT", "BAPM"):
                e = first(p.get(tag))
                if isinstance(e, dict) and self.spanish_places.search(place_text(e.get("PLAC"))):
                    return True
            return False
        return own(pid) or any(own(x) for x in self.parents(pid) if x)


def name_parts(person):
    """(given, surname, original full name) as recorded."""
    n = first(person.get("NAME")) or {}
    if not isinstance(n, dict):
        n = {"_NAME": n}
    full = str(n.get("_NAME", ""))
    m = re.match(r"^(.*?)/(.*)/(.*)$", full)
    if m:
        return squash(m.group(1) + " " + m.group(3)), m.group(2), full
    return squash(full), str(n.get("SURN", "")), full


def apply_abbreviations(text, abbreviations, keep_spacing=False):
    """Replace each key of `abbreviations` (whole words, any case) by its value, in one pass so
    replacements never chain. Works both ways: {"XY": "Xavier Yanez"} expands, {"Xavier Yanez": "XY"}
    shortens. keep_spacing keeps line breaks (for notes); names are squashed."""
    if abbreviations:
        lookup = {k.lower(): v for k, v in abbreviations.items()}
        keys = sorted(abbreviations, key=len, reverse=True)
        pattern = r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b"
        text = re.sub(pattern, lambda m: lookup[m.group(1).lower()], str(text or ""), flags=re.IGNORECASE)
    return text if keep_spacing else squash(text)


def clean(person, abbreviations=None):
    """Apply the fixed cleaning rules (rules section 2). Returns a dict describing the cleaned name.
    abbreviations: {"XY": "meaning"} from the tree's config (asked to the user)."""
    abbreviations = abbreviations or {}
    given, surname, full = name_parts(person)
    changes = []
    g = given
    if TITLE.match(g):
        g = TITLE.sub("", g)
        changes.append("Avó/Avô removed")
    nick = None
    m = NICK.search(g)
    if m:
        nick = squash(m.group(1))
        g = NICK.sub(" ", g)
        changes.append("nickname moved to NICK")
    g = squash(g)

    parts = surname.split("/")
    birth, extra = parts[0], [squash(x) for x in parts[1:] if squash(x)]
    if extra:
        changes.append("second surname moved to aka")
    married_parts = [squash(x) for x in re.findall(r"\(([^)]*)\)", birth)]
    if married_parts:
        birth = re.sub(r"\([^)]*\)", " ", birth)
        changes.append("married name in parentheses")

    def expand(s):
        return apply_abbreviations(s, abbreviations)
    for find, replace in abbreviations.items():
        if re.search(rf"\b{re.escape(find)}\b", birth + " " + " ".join(married_parts), re.IGNORECASE):
            changes.append(f"{find} -> {replace}")
    birth = expand(birth)
    married = [squash(f"{birth} {expand(x)}") for x in married_parts if x]
    if squash(birth) != squash(surname) and not changes:
        changes.append("spaces")
    return {"given": g, "surname": birth, "married": married, "nick": nick, "aka": [expand(x) for x in extra],
            "original": full, "changes": changes}


def units(surname):
    """Split a surname into family units: particles stay with the next word, "e"/"y" join two words."""
    words = surname.split()
    out, i = [], 0
    while i < len(words):
        w = words[i]
        if w.lower() in PARTICLES and i + 1 < len(words):
            # "de São Sibrão": a particle takes the next word, and a saint's title takes one more.
            take = 2 + (1 if words[i + 1] in SAINTS and i + 2 < len(words) else 0)
            out.append(" ".join(words[i:i + take]))
            i += take
        elif w in SAINTS and i + 1 < len(words):
            out.append(f"{w} {words[i + 1]}")
            i += 2
        elif w.lower() in JOINERS and out and i + 1 < len(words):
            out[-1] = f"{out[-1]} {w} {words[i + 1]}"
            i += 2
        else:
            out.append(w)
            i += 1
    return out


def passes_on(surname, spanish, compounds=()):
    """The surname a person passes on (rules 3.1): Portuguese the last family unit (or a compound
    surname from the config), Spanish the first."""
    s = squash(surname)
    if not s:
        return ""
    if not spanish:
        for c in compounds:
            if s == c or s.endswith(" " + c):
                return c
    u = units(s)
    return u[0] if spanish else u[-1]


def load_answers(folder):
    """All decisions already taken, from names_*.json (later files win)."""
    answers = {}
    for path in sorted(glob.glob(os.path.join(folder, "names_*.json"))):
        with open(path, encoding="utf-8") as f:
            answers.update(json.load(f))
    return answers

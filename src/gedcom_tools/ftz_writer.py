"""
GEDCOM -> Quick Family Tree .ftz (the reverse of converter.ftz_to_json).

An .ftz holds, per person: given name, surname, sex, birth and death dates (exact dates only),
parents, unions, a note and a photo (face/<person id>.jpg). Everything else in the GEDCOM (places,
baptism, burial, occupations, married names, marriage dates, qualified dates such as "ABT 1850",
custom tags...) is written into the person's note, under a "GEDCOM" header, as GEDCOM lines:

    NOTES
    <the person's own note>

    GEDCOM
    0 INDI
    1 BIRT
    2 PLAC Porto
    0 FAM 1            <- the person's 1st union (marriage order in the app)
    1 MARR
    2 DATE 17 JUN 1928

converter.ftz_to_json reads that section back, so .ged -> .ftz -> .ged gives the same records.
Family data goes in the husband's note (else the wife's; "FAM CHILD" in a child's note when the
family has no spouse). Ids are new; the converter numbers pointers in that same order, and
pointers inside the GEDCOM section are rewritten to the numbers they will get.
"""
import os
import re
import zipfile
from io import BytesIO
from typing import Dict, List, Optional, Tuple

from .enums import Tags as T
from .converter import (
    GEDCOM_HEADER, NOTES_HEADER, gedcom_to_json, json_to_gedcom, name_parts, read_zip,
    _POINTER,
)
from .utils import fmt_ged_date, parse_exact_date, remove_empty_strings, sex_to_ged

PERSON_BASE = 100000      # person ids: 100000, 100001... (the app uses large numbers)
COUPLE_BASE = 2000000     # couple ids, kept apart from person ids
HANDLED_TOP = {T.HEADER, T.SUBMITTER, T.TRAILER, T.INDIVIDUAL, T.FAMILY}


def _as_list(value) -> list:
    return value if isinstance(value, list) else [] if value is None else [value]


def _clean(text) -> str:
    """A value safe for one tab-separated field: no tabs, no line breaks."""
    return " ".join(str(text or "").replace("\t", " ").split())


def _pointer(value) -> Optional[str]:
    if isinstance(value, dict):
        value = value.get(T._PREF) or value.get(T._NAME)
    return value if isinstance(value, str) and _POINTER.fullmatch(value) else None


def _repoint(value, mapping: Dict[str, str]):
    """Rewrite pointers (anywhere in a value) to the numbers the converter will give them."""
    if isinstance(value, dict):
        return {k: _repoint(v, mapping) for k, v in value.items()}
    if isinstance(value, list):
        return [_repoint(v, mapping) for v in value]
    if isinstance(value, str) and value in mapping:
        return mapping[value]
    return value


def _same(a, b) -> bool:
    """Two values that are written as the same GEDCOM lines (e.g. "Ana /Silva/" and {"_NAME": "Ana /Silva/"})."""
    if a == b:
        return True
    if a is None or b is None or a == [] or b == []:
        return (a in (None, [])) and (b in (None, []))
    return json_to_gedcom({"X": a}) == json_to_gedcom({"X": b})


def _event_fields(value) -> Tuple[Optional[Tuple], Optional[object]]:
    """(year, month, day) for the app's fields, and what the GEDCOM section must keep of the event."""
    if isinstance(value, dict):
        date = value.get(T.DATE)
        ymd = parse_exact_date(date)
        if ymd and fmt_ged_date(*ymd) == date:
            rest = {k: v for k, v in value.items() if k != T.DATE}
            return ymd, (rest or None)
        return None, value
    if isinstance(value, list):
        return None, value          # several events: kept whole in the section (fields stay empty)
    if value is None:
        return None, None
    return None, value              # "Y" and other plain values


def json_to_ftz(tree: dict, photos: Dict[str, bytes] = None, name: str = "FamilyTree") -> Tuple[bytes, dict]:
    """
    Build an .ftz from GEDCOM JSON (as made by gedcom_to_json or ftz_to_json).
    photos: {path the tree links to (OBJE/FILE): image bytes}; JPEG photos become face/<id>.jpg.
    Returns (the .ftz bytes, a report dict).
    """
    photos = photos or {}
    people = [p for p in _as_list(tree.get(T.INDIVIDUAL)) if isinstance(p, dict)]
    families = [f for f in _as_list(tree.get(T.FAMILY)) if isinstance(f, dict)]

    # New ids in file order; the converter numbers pointers by sorted id, so @I0000@... follow it.
    pid = {p.get(T._PDEF): PERSON_BASE + i for i, p in enumerate(people)}
    cid = {f.get(T._PDEF): COUPLE_BASE + i for i, f in enumerate(families)}
    new_ptr = {old: f"@I{i:04d}@" for i, old in enumerate(pid)}
    new_ptr.update({old: f"@F{i:04d}@" for i, old in enumerate(cid)})
    fam_by_ptr = {f.get(T._PDEF): f for f in families}

    # Unions of each person, in their FAMS order, then any family naming them that FAMS misses.
    unions: Dict[str, List[str]] = {}
    for p in people:
        own = [_pointer(x) for x in _as_list(p.get(T.FAMILY_AS_SPOUSE))]
        unions[p.get(T._PDEF)] = [x for x in own if x in fam_by_ptr]
    for f in families:
        for tag in (T.HUSBAND, T.WIFE):
            who = _pointer(f.get(tag))
            if who in unions and f.get(T._PDEF) not in unions[who]:
                unions[who].append(f.get(T._PDEF))

    # Parent family and position among its children.
    parent: Dict[str, str] = {}
    for p in people:
        famc = next((x for x in map(_pointer, _as_list(p.get(T.FAMILY_AS_CHILD))) if x in fam_by_ptr), None)
        if famc:
            parent[p.get(T._PDEF)] = famc
    children: Dict[str, List[str]] = {f.get(T._PDEF): [] for f in families}
    for f in families:
        for c in map(_pointer, _as_list(f.get(T.CHILD))):
            if parent.get(c) == f.get(T._PDEF) and c not in children[f.get(T._PDEF)]:
                children[f.get(T._PDEF)].append(c)
    for p in people:
        f = parent.get(p.get(T._PDEF))
        if f and p.get(T._PDEF) not in children[f]:
            children[f].append(p.get(T._PDEF))

    # What the converter will make from the app's fields alone, to keep only the differences.
    def made_famc(ptr):
        f = parent.get(ptr)
        return [{T._PREF: new_ptr[f], "PEDI": "BIRTH"}] if f else None

    def made_fams(ptr):
        return [{T._PREF: new_ptr[f]} for f in unions.get(ptr, [])] or None

    report = {"people": len(people), "families": len(families), "photos": 0, "notes_with_gedcom": 0,
              "dropped_records": {}, "photos_not_jpeg": 0, "photos_missing": 0}
    for tag, value in tree.items():
        if tag not in HANDLED_TOP:
            report["dropped_records"][tag] = len(_as_list(value))

    sections: Dict[str, Dict[str, list]] = {p.get(T._PDEF): {"INDI": [], "FAM": []} for p in people}
    lines, faces = [], {}
    for i, p in enumerate(people):
        ptr = p.get(T._PDEF)
        extra = {}
        given, surname = name_parts(p.get(T.NAME, ""))
        canonical = remove_empty_strings({T._NAME: f"{given} /{surname}/", T.GIVEN: given, T.SURNAME: surname})
        if T.NAME in p and not _same(p[T.NAME], canonical):
            extra[T.NAME] = p[T.NAME]
        sex = {"M": 1, "F": 2}.get(str(p.get(T.SEX, "")).strip().upper(), 0)
        if T.SEX in p and not _same(p[T.SEX], sex_to_ged(sex)):
            extra[T.SEX] = p[T.SEX]

        birth, keep = _event_fields(p.get(T.BIRTH))
        if keep is not None:
            extra[T.BIRTH] = keep
        death, keep = _event_fields(p.get(T.DEATH))
        if keep is not None and keep != "Y":
            extra[T.DEATH] = keep
        dead = T.DEATH in p

        if T.FAMILY_AS_CHILD in p and not _same(_repoint(p[T.FAMILY_AS_CHILD], new_ptr), made_famc(ptr)):
            extra[T.FAMILY_AS_CHILD] = p[T.FAMILY_AS_CHILD]
        if T.FAMILY_AS_SPOUSE in p and not _same(_repoint(p[T.FAMILY_AS_SPOUSE], new_ptr), made_fams(ptr)):
            extra[T.FAMILY_AS_SPOUSE] = p[T.FAMILY_AS_SPOUSE]

        note = p.get(T.NOTE)
        own_note = note if isinstance(note, str) else None
        if note is not None and not isinstance(note, str):
            extra[T.NOTE] = note

        # Photo: the first JPEG linked; anything more complex stays in the section.
        objs = _as_list(p.get(T.OBJECT))
        face = None
        for obj in objs:
            files = _as_list(obj.get(T.FILE)) if isinstance(obj, dict) else []
            for f in files:
                path = f.get(T._NAME) if isinstance(f, dict) else f
                if not path:
                    continue
                if path not in photos:
                    report["photos_missing"] += 1
                elif os.path.splitext(path)[1].lower() in (".jpg", ".jpeg") and face is None:
                    face = photos[path]
                else:
                    report["photos_not_jpeg"] += 1
        simple = (len(objs) == 1 and isinstance(objs[0], dict) and set(objs[0]) == {T.FILE}
                  and isinstance(objs[0][T.FILE], dict) and set(objs[0][T.FILE]) <= {T._NAME, T.FORM}
                  and face is not None)
        if objs and not simple:
            extra[T.OBJECT] = p[T.OBJECT]
        if face is not None:
            faces[PERSON_BASE + i] = face

        for tag, value in p.items():
            if tag not in (T._PDEF, T.NAME, T.SEX, T.BIRTH, T.DEATH, T.FAMILY_AS_CHILD,
                           T.FAMILY_AS_SPOUSE, T.NOTE, T.OBJECT):
                extra[tag] = value
        if extra:
            sections[ptr]["INDI"].append(_repoint(extra, new_ptr))

        famc = parent.get(ptr)
        sibling = children[famc].index(ptr) if famc else 0
        b_ev = 128 if birth else 2
        d_ev = 128 if death else (3 if dead else 2)
        by, bm, bd = birth or (0, 0, 0)
        dy, dm, dd = death or (0, 0, 0)
        lines.append([PERSON_BASE + i, 0, cid[famc] if famc else 0, sibling, 0, 0, "0.00", "0.00", 0, 0, 0, 0,
                      _clean(surname), _clean(given), "", "",
                      b_ev, by or 0, bm or 0, bd or 0, d_ev, dy or 0, dm or 0, dd or 0,
                      sex, "", "", "", own_note])

    couple_lines = []
    for j, f in enumerate(families):
        fptr = f.get(T._PDEF)
        husband, wife = _pointer(f.get(T.HUSBAND)), _pointer(f.get(T.WIFE))
        husband = husband if husband in pid else None
        wife = wife if wife in pid else None
        extra = {}
        if f.get(T.HUSBAND) is not None and not _same(_repoint(f.get(T.HUSBAND), new_ptr), new_ptr.get(husband)):
            extra[T.HUSBAND] = f[T.HUSBAND]
        if f.get(T.WIFE) is not None and not _same(_repoint(f.get(T.WIFE), new_ptr), new_ptr.get(wife)):
            extra[T.WIFE] = f[T.WIFE]
        made_chil = [new_ptr[c] for c in children[fptr]]
        if T.CHILD in f and not _same(_repoint(f[T.CHILD], new_ptr), made_chil):
            extra[T.CHILD] = f[T.CHILD]
        div = f.get(T.DIVORCE)
        if div is not None and div != "Y":
            extra[T.DIVORCE] = div
        for tag, value in f.items():
            if tag not in (T._PDEF, T.HUSBAND, T.WIFE, T.CHILD, T.DIVORCE):
                extra[tag] = value
        if extra:
            anchor = husband or wife
            if anchor:
                which = str(unions[anchor].index(fptr) + 1)
            elif children[fptr]:
                anchor, which = children[fptr][0], "CHILD"
            else:
                anchor = None
            if anchor:
                sections[anchor]["FAM"].append({T._NAME: which, **_repoint(extra, new_ptr)})
            else:
                report.setdefault("lost_families", 0)
                report["lost_families"] += 1
        couple_lines.append([COUPLE_BASE + j, 1 if div is not None else 0,
                             pid[husband] if husband else 0, unions[husband].index(fptr) if husband else 0,
                             pid[wife] if wife else 0, unions[wife].index(fptr) if wife else 0,
                             "0.00", "0.00", 0, 0, 0, 0])

    # Notes: the person's own note, then the GEDCOM section; <br> separates lines in the app.
    for i, p in enumerate(people):
        sec = sections[p.get(T._PDEF)]
        own = lines[i][28]
        own_lines = str(own).replace("\r", "").split("\n") if own else []
        if sec["INDI"] or sec["FAM"]:
            report["notes_with_gedcom"] += 1
            block = {}
            if sec["INDI"]:
                block[T.INDIVIDUAL] = sec["INDI"]
            if sec["FAM"]:
                block[T.FAMILY] = sec["FAM"]
            ged = json_to_gedcom(block).rstrip("\n").split("\n")
            text = ([NOTES_HEADER] + own_lines + [""] if own_lines else []) + [GEDCOM_HEADER] + ged
        else:
            text = own_lines
        lines[i][28] = "<br>".join(t.replace("\t", " ") for t in text)

    last = PERSON_BASE + len(people) - 1 if people else 0
    body = [f"{len(people)}\t{len(families)}\t{last}"]
    body += ["\t".join(str(x) for x in row) for row in lines]
    body += ["\t".join(str(x) for x in row) for row in couple_lines]
    folder = re.sub(r"[\\/:*?\"<>|]", "_", name).strip() or "FamilyTree"
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{folder}/node.ftt", "﻿" + "\n".join(body) + "\n")
        for person_id, image in faces.items():
            z.writestr(f"{folder}/face/{person_id}.jpg", image)
    report["photos"] = len(faces)
    return out.getvalue(), report


def gedcom_to_ftz(text: str, photos: Dict[str, bytes] = None, name: str = "FamilyTree") -> Tuple[bytes, dict]:
    """GEDCOM text -> .ftz bytes (see json_to_ftz)."""
    return json_to_ftz(gedcom_to_json(text), photos, name)


def file_to_ftz(data: bytes, filename: str) -> Tuple[bytes, dict]:
    """The bytes of a .zip (.ged + photos), .ged or .json -> .ftz bytes. The tree is named after the file."""
    import json
    stem, ext = os.path.splitext(os.path.basename(filename))
    ext = ext.lower()
    if ext == ".zip":
        _, tree, photos = read_zip(data)
    elif ext == ".json":
        tree, photos = json.loads(bytes(data).decode("utf-8-sig")), {}
    else:
        raw = bytes(data)
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
        tree, photos = gedcom_to_json(text), {}
    return json_to_ftz(tree, photos, stem)


def describe(report: dict) -> str:
    """One line about a conversion, plus what could not be kept."""
    s = (f"{report['people']} people, {report['families']} families, {report['photos']} photos; "
         f"{report['notes_with_gedcom']} notes carry a GEDCOM section")
    lost = []
    if report.get("dropped_records"):
        lost.append("records not kept: " + ", ".join(f"{k} x{v}" for k, v in report["dropped_records"].items()))
    if report.get("photos_missing"):
        lost.append(f"{report['photos_missing']} linked photos not found")
    if report.get("photos_not_jpeg"):
        lost.append(f"{report['photos_not_jpeg']} photos are not JPEG (kept as links only)")
    if report.get("lost_families"):
        lost.append(f"{report['lost_families']} families with no members lost their details")
    return s + (" (" + "; ".join(lost) + ")" if lost else "")

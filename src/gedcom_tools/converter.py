import os
import re
import zipfile
from io import BytesIO
from typing import Dict, List, Tuple
from datetime import datetime
import json

# GEDCOM tools
from . import __version__

from .models import (
    Person_FTT,
    Couple_FTT
)

from .utils import (
    _to_int,
    _to_float,
    GED_MONTHS,
    fmt_ged_date,
    sex_to_ged,
    remove_empty_strings
)
from .enums import Tags as T

# -----------------------------
# Parsing .ftt file information
# -----------------------------
def parse_node_ftt(text: str) -> Tuple[Dict[int, Person_FTT], Dict[int, Couple_FTT]]:
    """
    Parse a str from a .ftt file
    Expected layout: TSV (tab-separated values).
    Header line: <n_people>\t<n_couples>\t<last_addition_id>
    People lines (tab-delimited):
      0:id 1:reserved 2:parent_couple_id 3..11:unknowns 12:surname 13:name
      14:tab_unk1 15:tab_unk2
      16:birth_event 17:birth_year 18:birth_month 19:birth_day
      20:death_event 21:death_year 22:death_month 23:death_day
      24:sex 25:addition 26:note 27:tab_unk3 28:tab_unk4
    Couple_FTTs lines (tab-delimited) with your existing mapping.
    """
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return {}, {}

    # Header (TSV)
    hdr_parts = lines[0].split("\t")
    n_people = int(hdr_parts[0].lstrip("\ufeff"))
    n_couples = int(hdr_parts[1])

    people_by_id: Dict[int, Person_FTT] = {}
    couples_by_id: Dict[int, Couple_FTT] = {}

    # People: lines[1 : 1 + n_people]
    start_person = 1
    for i in range(start_person, start_person + n_people):
        parts = lines[i].split("\t")
        if len(parts) < 29:
            parts += [""] * (29 - len(parts))

        person_id = _to_int(parts[0], _None_is_0=True)
        person = Person_FTT(
            id=person_id,
            reserved=_to_int(parts[1], _None_is_0=True),
            parent_couple_id=_to_int(parts[2]),
            unk4=_to_int(parts[3], _None_is_0=True),
            unk5=_to_int(parts[4], _None_is_0=True),
            unk6=_to_int(parts[5], _None_is_0=True),
            f1=_to_float(parts[6]),
            f2=_to_float(parts[7]),
            unk9=_to_int(parts[8], _None_is_0=True),
            unk10=_to_int(parts[9], _None_is_0=True),
            unk11=_to_int(parts[10], _None_is_0=True),
            unk12=_to_int(parts[11], _None_is_0=True),
            surname=parts[12].strip(),
            name=parts[13].strip(),
            tab_unk1=parts[14],
            tab_unk2=parts[15],
            birth_event=_to_int(parts[16], _None_is_0=True),
            birth_year=_to_int(parts[17], _0_is_None=True),
            birth_month=_to_int(parts[18], _0_is_None=True),
            birth_day=_to_int(parts[19], _0_is_None=True),
            death_event=_to_int(parts[20], _None_is_0=True),
            death_year=_to_int(parts[21], _0_is_None=True),
            death_month=_to_int(parts[22], _0_is_None=True),
            death_day=_to_int(parts[23], _0_is_None=True),
            sex=_to_int(parts[24], _None_is_0=True),
            addition=(parts[25].strip() or None),
            tab_unk3=parts[26],
            tab_unk4=parts[27],
            note=(parts[28].strip() or None),
        )
        people_by_id[person.id] = person

    # Couple_FTTs
    start_couples = 1 + n_people
    for i in range(start_couples, start_couples + n_couples):
        parts = lines[i].split("\t")
        if len(parts) < 12:
            parts += ["0"] * (12 - len(parts))

        couple_id = _to_int(parts[0], _None_is_0=True)
        couple = Couple_FTT(
            id=couple_id,
            divorce=_to_int(parts[1], _None_is_0=True),
            male_id=_to_int(parts[2]),
            unk4=_to_int(parts[3], _None_is_0=True),
            female_id=_to_int(parts[4]),
            unk6=_to_int(parts[5], _None_is_0=True),
            f1=_to_float(parts[6]),
            f2=_to_float(parts[7]),
            unk9=_to_int(parts[8], _None_is_0=True),
            unk10=_to_int(parts[9], _None_is_0=True),
            unk11=_to_int(parts[10], _None_is_0=True),
            unk12=_to_int(parts[11], _None_is_0=True),
        )
        couples_by_id[couple.id] = couple

    return people_by_id, couples_by_id

# ---------------------------
# Index builders for GEDCOM
# ---------------------------
def build_indexes(people_by_id: Dict[int, Person_FTT],
                  couples_by_id: Dict[int, Couple_FTT]):
    """
    Build reverse-index maps for fast relationship lookup when exporting GEDCOM.

    This function produces two dictionaries:

    1) children_of_couple: Dict[couple_id → List[person_id]] or List[children]
       ------------------------------------------------------
       For each couple, it lists all the people who have that couple
       as their `parent_couple_id`. "Which children belong to this couple?"

    2) couples_of_person: Dict[person_id → List[couple_id]] or List[couples]
       ----------------------------------------------------
       For each person, it lists all the couples where that person
       appears as a spouse (male_id or female_id). "Which families is this person a spouse in?"
    
    These reverse indexes allow fast GEDCOM creation of:
        - FAMC (Family as Child)
        - FAMS (Family as Spouse)

    Returns:
        (children_of_couple, couples_of_person)
    """
    children_of_couple: Dict[int, List[int]] = {couple_id: [] for couple_id in couples_by_id}
    for p in people_by_id.values():
        if p.parent_couple_id and p.parent_couple_id in couples_by_id:
            children_of_couple[p.parent_couple_id].append(p.id)

    couples_of_person: Dict[int, List[int]] = {person_id: [] for person_id in people_by_id}
    for c in couples_by_id.values():
        for person_id in (c.male_id, c.female_id): # For the male member and female member
            if person_id and person_id in couples_of_person: #
                couples_of_person[person_id].append(c.id)

    return children_of_couple, couples_of_person 

# ---------------------------
# GEDCOM export
# ---------------------------

def to_json(people_by_id: Dict[int, Person_FTT],
              couples_by_id: Dict[int, Couple_FTT],
              lang: str = "en",
              photos: Dict[int, str] = None):
    """photos: person id -> photo file path, written as a GEDCOM multimedia link (OBJE/FILE)."""

    # Start document root
    DOCUMENT = {} # Main JSON   
    level_stack = [DOCUMENT] # 

    now = datetime.now()
    head_date = now.strftime("%d %b %Y").upper()
    head_time = now.strftime("%H:%M:%S")

    # HEAD block --------------------------------------------
    DOCUMENT[T.HEADER] = {
        T.GEDCOM: {
            T.VERSION: "5.5.1",
            T.FORM: "LINEAGE-LINKED",
        },
        T.CHARSET: "UTF-8",
        T.SOURCE: {
            T._NAME: "GT",
            T.NAME: "Gedcom Tools",
            T.VERSION: __version__,
        },
        T.DATE: {
            T._NAME: head_date,
            T.TIME: head_time,
        },
        T.LANGUAGE: lang,
        T.SUBMITTER: "@U1@",
    }
    # Submitter definition
    DOCUMENT[T.SUBMITTER] = {
        T._PDEF: "@U1@",
        T.NAME: "Tester"
    }

    # Reset stack to root
    level_stack = [DOCUMENT]

    # Start LISTS for INDI and FAM
    DOCUMENT[T.INDIVIDUAL] = []
    DOCUMENT[T.FAMILY] = []

    # Create sorted id lists
    person_ids = sorted(people_by_id.keys())
    couple_ids = sorted(couples_by_id.keys())

    indi_ptr = {person_id: f"@I{idx:04d}@" for idx, person_id in enumerate(person_ids)} # Generate pointers for individuals
    fam_ptr = {couple_id: f"@F{idx:04d}@" for idx, couple_id in enumerate(couple_ids)}  # Generate pointers for families

    children_of_couple, couples_of_person = build_indexes(people_by_id, couples_by_id)

    # INDI records ------------------------------------------
    for person_id in person_ids:
        p = people_by_id[person_id]

        node = {
            T._PDEF: indi_ptr[person_id],
            T.NAME: {
                T._NAME: f"{p.name} /{p.surname}/",
                T.GIVEN: p.name,
                T.SURNAME: p.surname
            },
            T.SEX: sex_to_ged(p.sex),
            T.FAMILY_AS_CHILD: [],
            T.FAMILY_AS_SPOUSE: []
        }

        # Birth
        bdate = fmt_ged_date(p.birth_year, p.birth_month, p.birth_day)
        if p.birth_event and bdate:
            node[T.BIRTH] = {T.DATE: bdate}

        # Death
        ddate = fmt_ged_date(p.death_year, p.death_month, p.death_day)
        if p.death_event and (ddate or p.death_event == 128):
            node[T.DEATH] = {T.DATE: ddate} if ddate else "Y"

        # Family as a child
        if p.parent_couple_id and p.parent_couple_id in fam_ptr:
            subnode = {
                T._PREF: fam_ptr[p.parent_couple_id],
                "PEDI": "BIRTH"
            }
            node[T.FAMILY_AS_CHILD].append(subnode)

        # Family as spouse
        for couple_id in couples_of_person.get(person_id, []):
            subnode = {
                T._PREF: fam_ptr[couple_id],
            }
            node[T.FAMILY_AS_SPOUSE].append(subnode)

        # Photo (a link to the image file next to the .ged)
        if photos and person_id in photos:
            node[T.OBJECT] = {T.FILE: {T._NAME: photos[person_id], T.FORM: "jpg"}}

        # Notes
        note_text = p.note or p.addition
        if note_text:
            node[T.NOTE] = note_text

        DOCUMENT[T.INDIVIDUAL].append(node)
    
    # FAM records -------------------------------------------
    for couple_id in couple_ids:
        c = couples_by_id[couple_id]

        node = {
            T._PDEF: fam_ptr[couple_id]
        }

        if c.male_id and c.male_id in indi_ptr:
            node[T.HUSBAND] = indi_ptr[c.male_id]
        if c.female_id and c.female_id in indi_ptr:
            node[T.WIFE] = indi_ptr[c.female_id]

        kids = children_of_couple.get(couple_id, [])
        if kids:
            node[T.CHILD] = [indi_ptr[p] for p in kids]

        if c.divorce == 1:
            node[T.DIVORCE] = "Y"

        DOCUMENT[T.FAMILY].append(node)

    # Trailer block --------------------------------------------
    DOCUMENT["TRLR"] = {}

    DOCUMENT = remove_empty_strings(DOCUMENT)
    return DOCUMENT

def _split_conc(text: str, size: int = 200) -> List[str]:
    """Split text into chunks of at most `size` chars, never cutting next to a space."""
    chunks = []
    while len(text) > size:
        cut = size
        while cut > 1 and (text[cut - 1] == " " or text[cut] == " "):
            cut -= 1
        chunks.append(text[:cut])
        text = text[cut:]
    chunks.append(text)
    return chunks

def json_to_gedcom(data: dict) -> str:
    """
    Convert JSON-structured GEDCOM (nested dicts/lists) back into flat GEDCOM lines.
    """
    lines = []

    def emit(level, tag, value):
        """
        Write a simple value. Line breaks become CONT lines and long lines
        are split with CONC so no GEDCOM line exceeds the 255 char limit.
        """
        for line_no, text in enumerate(str(value).split("\n")):
            for chunk_no, chunk in enumerate(_split_conc(text)):
                if line_no == 0 and chunk_no == 0:
                    lvl, current = level, tag
                else:
                    lvl, current = level + 1, (T.CONTINUE if chunk_no == 0 else T.CONCAT)
                lines.append(f"{lvl} {current} {chunk}" if chunk else f"{lvl} {current}")

    def walk(node, level, forced_tag=None):
        """
        forced_tag is used for list-of-dicts entries:
        Example:
            "INDI": [ { ... }, { ... } ]
        Here each dict gets tag = "INDI".
        """
        # ----------------------------------------------------
        # CASE A — node is a dict
        # ----------------------------------------------------
        if isinstance(node, dict):
            items = node.items()

            for tag, value in items:
                # --------------------------------------------
                # A01 — tag is _PDEF
                # --------------------------------------------
                if tag == T._PDEF:
                    """ We are defining a pointer"""
                    prev_level_str, prev_tag = lines[-1].split(" ", 1)
                    # Patch the previous line.
                    lines[-1] = f"{prev_level_str} {value} {prev_tag}"
                    continue
                # --------------------------------------------
                # A02 — tag is _PREF
                # --------------------------------------------
                if tag == T._PREF or tag == T._NAME:
                    """We are referencing a pointer"""
                    prev_level_str, prev_tag = lines[-1].split(" ", 1)
                    # Patch the previous line.
                    lines[-1] = f"{prev_level_str} {prev_tag} {value}"
                    continue

                # --------------------------------------------
                # A1 — dict without _PDEF → nested block
                # --------------------------------------------
                if isinstance(value, dict):
                    lines.append(f"{level} {tag}")
                    walk(value, level + 1)
                    continue

                # --------------------------------------------
                # A2 — list → repeat tag for each entry
                # --------------------------------------------
                if isinstance(value, list):
                    for item in value:
                        # If entry is a dict → each is a separate object
                        if isinstance(item, dict):
                            lines.append(f"{level} {tag}")
                            walk(item, level + 1)
                        else:
                            # Simple list item
                            emit(level, tag, item)
                    continue

                # --------------------------------------------
                # A3 — simple value
                # --------------------------------------------
                emit(level, tag, value)

        else:
            pass

    # Start
    walk(data, 0)

    return "\n".join(lines) + "\n"

# ---------------------------
# GEDCOM text -> JSON (the reverse of json_to_gedcom)
# ---------------------------
# Tags that are always lists, as to_json makes them, even when they appear once.
_LIST_TAGS = {T.INDIVIDUAL, T.FAMILY, T.FAMILY_AS_CHILD, T.FAMILY_AS_SPOUSE, T.CHILD}
# Pointer tags that to_json writes as {"_PREF": ...} objects instead of plain strings.
_POINTER_OBJECT_TAGS = {T.FAMILY_AS_CHILD, T.FAMILY_AS_SPOUSE}
_GED_LINE = re.compile(r"^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$")
_POINTER = re.compile(r"@[^@\s]+@")

def gedcom_to_json(text: str) -> dict:
    """
    Parse GEDCOM text (from this tool or any other program) into the JSON structure used
    by to_json/json_to_gedcom. CONT/CONC lines are joined back into their value.
    Raises ValueError on a line that is not GEDCOM.
    """
    root = {"tag": None, "value": None, "xref": None, "children": []}
    stack = [(-1, root)]
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        match = _GED_LINE.match(line)
        if not match:
            raise ValueError(f"Line {number} is not GEDCOM: {line[:60]!r}")
        level, xref, tag, value = int(match.group(1)), match.group(2), match.group(3), match.group(4)
        while stack[-1][0] >= level:
            stack.pop()
        if level != stack[-1][0] + 1:
            raise ValueError(f"Line {number}: level {level} does not follow level {stack[-1][0]}")
        parent = stack[-1][1]
        if tag in (T.CONTINUE, T.CONCAT):
            parent["value"] = (parent["value"] or "") + ("\n" if tag == T.CONTINUE else "") + (value or "")
            continue
        node = {"tag": tag, "value": value, "xref": xref, "children": []}
        parent["children"].append(node)
        stack.append((level, node))
    return _ged_children(root["children"])

def _ged_children(children) -> dict:
    out, repeated = {}, set()
    for child in children:
        tag, value = child["tag"], _ged_value(child)
        if tag in _LIST_TAGS:
            out.setdefault(tag, []).append(value)
        elif tag in out:
            if tag not in repeated:
                out[tag] = [out[tag]]
                repeated.add(tag)
            out[tag].append(value)
        else:
            out[tag] = value
    return out

def _ged_value(node):
    value = node["value"] or None
    is_pointer = bool(value and _POINTER.fullmatch(value))
    if not node["children"] and not node["xref"]:
        if value is None:
            return {}
        if is_pointer and node["tag"] in _POINTER_OBJECT_TAGS:
            return {T._PREF: value}
        return value
    result = {}
    if node["xref"]:
        result[T._PDEF] = node["xref"]
    if value is not None:
        result[T._PREF if is_pointer else T._NAME] = value
    result.update(_ged_children(node["children"]))
    return result

# ---------------------------
# Conversion from bytes (no file I/O: used by the CLI and the web page)
# ---------------------------
def inspect_ftz(archive: zipfile.ZipFile) -> Tuple[str, List[str]]:
    """Return (tree folder name, list of face image paths) of an open .ftz archive."""
    names = archive.namelist()
    top_folders = {name.split("/")[0] for name in names if "/" in name}
    if not top_folders:
        raise ValueError("No folder structure found inside the archive.")
    folder_name = top_folders.pop()  # assume only one root
    # Support both "faces/" and "face/"
    faces_prefixes = (f"{folder_name}/faces/", f"{folder_name}/face/")
    faces = [n for n in names if n.startswith(faces_prefixes) and n.lower().endswith(".jpg")]
    return folder_name, faces

def ftz_photos(data: bytes) -> Dict[int, bytes]:
    """
    The photos inside an .ftz archive: person id -> JPEG bytes.
    The app stores each photo as face/<person id>.jpg (or faces/).
    """
    photos = {}
    with zipfile.ZipFile(BytesIO(bytes(data))) as archive:
        _, faces = inspect_ftz(archive)
        for name in faces:
            stem = os.path.splitext(os.path.basename(name))[0]
            if stem.isdigit():
                photos[int(stem)] = archive.read(name)
    return photos

def ftz_to_json(data: bytes, lang: str = "English", photo_dir: str = None) -> dict:
    """
    Convert the raw bytes of an .ftz archive into GEDCOM JSON.
    photo_dir: when given, people with a photo get a link to "<photo_dir>/<person id>.jpg"
    (the caller saves the files there, see ftz_photos).
    Raises ValueError when the archive is not a valid family tree.
    """
    try:
        archive = zipfile.ZipFile(BytesIO(bytes(data)))
    except zipfile.BadZipFile:
        raise ValueError("Not a valid .ftz file (it is not a zip archive).")
    with archive:
        folder_name, _ = inspect_ftz(archive)
        node_name = f"{folder_name}/node.ftt"
        if node_name not in archive.namelist():
            raise ValueError("node.ftt not found in the archive.")
        raw = archive.read(node_name)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("node.ftt is not valid UTF-8 text.")
    people_by_id, couples_by_id = parse_node_ftt(text)
    photos = None
    if photo_dir:
        photos = {pid: f"{photo_dir}/{pid}.jpg" for pid in ftz_photos(data) if pid in people_by_id}
    return to_json(people_by_id, couples_by_id, lang=lang, photos=photos)

def ftz_to_gedcom(data: bytes, lang: str = "English", photo_dir: str = None) -> str:
    """Convert the raw bytes of an .ftz archive into GEDCOM 5.5.1 text."""
    return json_to_gedcom(ftz_to_json(data, lang, photo_dir))

# ---------------------------
# Output package: <name>.zip (the .ged + the photos it links to), <name>.json outside
# ---------------------------
def photo_links(tree: dict) -> List[str]:
    """The photo paths a GEDCOM JSON links to (INDI → OBJE → FILE)."""
    links = []
    for person in tree.get(T.INDIVIDUAL, []):
        objs = person.get(T.OBJECT)
        for obj in objs if isinstance(objs, list) else [objs] if objs else []:
            files = obj.get(T.FILE) if isinstance(obj, dict) else None
            for f in files if isinstance(files, list) else [files] if files else []:
                path = f.get(T._NAME) if isinstance(f, dict) else f
                if path and path not in links:
                    links.append(path)
    return links

def make_zip(ged_name: str, gedcom_text: str, photos: Dict[str, bytes]) -> bytes:
    """A .zip with the .ged and the photos, at the paths the .ged links to."""
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(ged_name, gedcom_text)
        for path, image in photos.items():
            z.writestr(path, image)
    return out.getvalue()

def read_zip(data: bytes) -> Tuple[str, dict, Dict[str, bytes]]:
    """Open a tree .zip: (name of the .ged or .json inside, GEDCOM JSON, {photo path: bytes})."""
    try:
        archive = zipfile.ZipFile(BytesIO(bytes(data)))
    except zipfile.BadZipFile:
        raise ValueError("Not a valid .zip file.")
    with archive:
        names = archive.namelist()
        tree_name = next((n for n in names if n.lower().endswith(".ged")), None) or \
                    next((n for n in names if n.lower().endswith(".json")), None)
        if not tree_name:
            raise ValueError("No .ged or .json file inside the .zip.")
        raw = archive.read(tree_name)
        if tree_name.lower().endswith(".json"):
            tree = json.loads(raw.decode("utf-8-sig"))
        else:
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("latin-1")
            tree = gedcom_to_json(text)
        photos = {n: archive.read(n) for n in names
                  if os.path.splitext(n)[1].lower() in (".jpg", ".jpeg", ".png", ".gif", ".webp")}
    return tree_name, tree, photos

def collect_photos(near: str, tree: dict) -> Dict[str, bytes]:
    """
    Find the photos a tree links to, for a tree file at path `near`: first as files next to it
    (e.g. a <name>_photos/ folder), then inside <name>.zip, then inside any other .zip in that folder.
    """
    folder = os.path.dirname(os.path.abspath(near))
    stem = os.path.splitext(os.path.abspath(near))[0]
    zips = [stem + ".zip"] + sorted(os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith(".zip"))
    found = {}
    for link in photo_links(tree):
        path = os.path.join(folder, link)
        if os.path.isfile(path):
            with open(path, "rb") as f:
                found[link] = f.read()
            continue
        for z in dict.fromkeys(zips):
            if os.path.isfile(z):
                with zipfile.ZipFile(z) as archive:
                    if link in archive.namelist():
                        found[link] = archive.read(link)
                        break
    return found

def write_outputs(out_stem: str, tree: dict, photos: Dict[str, bytes]) -> str:
    """Write <out_stem>.json and <out_stem>.zip (<name>.ged + photos). Returns a one-line summary."""
    with open(out_stem + ".json", "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=2)
    name = os.path.basename(out_stem)
    with open(out_stem + ".zip", "wb") as f:
        f.write(make_zip(name + ".ged", json_to_gedcom(tree), photos))
    missing = [link for link in photo_links(tree) if link not in photos]
    return (f"Written: {out_stem}.zip ({name}.ged + {len(photos)} photos) and {out_stem}.json"
            + (f"; {len(missing)} linked photos not found" if missing else ""))

# ---------------------------
# Main convert flow (CLI: reads the .ftz and writes <name>.zip + <name>.json)
# ---------------------------
def convert(file: str, output_name: str):
    if not file.lower().endswith(".ftz"):
        print("Not an .ftz file. Exiting.")
        return None

    print(f"Processing {file} ...")
    with open(file, "rb") as f:
        data = f.read()

    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            folder_name, faces = inspect_ftz(archive)
        print(f"Found Family Tree: {folder_name}")
        photos = ftz_photos(data)
        # The .ged links to the photos in a <name>_photos/ folder inside the .zip.
        photo_dir = os.path.basename(output_name) + "_photos"
        gedcom_json = ftz_to_json(data, photo_dir=photo_dir if photos else None)
    except (ValueError, zipfile.BadZipFile) as e:
        print(f"⚠️ {e}")
        return None

    files = {f"{photo_dir}/{pid}.jpg": image for pid, image in photos.items()}
    print(write_outputs(output_name, gedcom_json, files))

def process_ftz(file: str, output_name: str):
    convert(file, output_name)

import zipfile
from io import BytesIO
from typing import Optional, Dict, List, Tuple
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
              lang: str = "en"):

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

def json_to_gedcom(data: dict) -> str:
    """
    Convert JSON-structured GEDCOM (nested dicts/lists) back into flat GEDCOM lines.
    """
    lines = []

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
                            lines.append(f"{level} {tag} {item}")
                    continue

                # --------------------------------------------
                # A3 — simple value
                # --------------------------------------------
                lines.append(f"{level} {tag} {value}")

        else:
            pass

    # Start
    walk(data, 0)

    return "\n".join(lines) + "\n"

# ---------------------------
# Main convert flow
# ---------------------------
def convert(file: str, output_file: str):
    faces_images: List[Tuple[str, BytesIO]] = []   # list of (filename, BytesIO)
    node_file: Optional[Tuple[str, bytes]] = None  # (filename, bytes)

    if not file.lower().endswith(".ftz"):
        print("Not an .ftz file. Exiting.")
        return None
    
    print(f"Processing {file} ...")
    with zipfile.ZipFile(file, 'r') as archive:
        files = archive.namelist()

        # Detect top-level folder (first part before '/')
        top_folders = {name.split("/")[0] for name in files if "/" in name}
        if not top_folders:
            print("⚠️ No folder structure found inside the archive.")
            return None

        folder_name = top_folders.pop()  # assume only one root
        print(f"Found Family Tree: {folder_name}")

        # Support both "faces/" and "face/"
        faces_prefixes = [f"{folder_name}/faces/", f"{folder_name}/face/"]
        has_faces_folder = any(
            any(name.startswith(prefix) for name in files) for prefix in faces_prefixes
        )

        if has_faces_folder:
            for name in files:
                if any(name.startswith(prefix) for prefix in faces_prefixes) and name.lower().endswith(".jpg"):
                    with archive.open(name) as f:
                        faces_images.append((name, BytesIO(f.read())))
            print(f"Faces folder found with {len(faces_images)} image(s).")
            if faces_images:
                print("Faces list:")
                for fname, _ in faces_images:
                    print(" -", fname)
        else:
            print("No faces folder available.")

        # Collect node.ftt (mandatory)
        for name in files:
            if name == f"{folder_name}/node.ftt":
                with archive.open(name) as f:
                    node_file = (name, f.read())
                break

    # node.ftt summary + parsing
    people_by_id: Dict[int, Person_FTT] = {}
    couples_by_id: Dict[int, Couple_FTT] = {}

    if node_file:
        print("Found node.ftt")
        try:
            text = node_file[1].decode("utf-8-sig")
            print("\n===== node.ftt contents =====")
            print(text)
            print("===== end of node.ftt =====\n")
            # Parse into structures
            people_by_id, couples_by_id = parse_node_ftt(text)

            # # Debug: print each person
            # print("=== PEOPLE (parsed) ===")
            # for p in people_by_id.values():
            #     print(
            #         f"Person {p.id}: {p.surname}, {p.name} | "
            #         f"Birth: {p.birth_year}-{p.birth_month}-{p.birth_day} (ev={p.birth_event}) | "
            #         f"Death: {p.death_year}-{p.death_month}-{p.death_day} (ev={p.death_event}) | "
            #         f"Sex={p.sex} | ParentCouple={p.parent_couple_id} | "
            #         f"Addition={p.addition} | Note={p.note}"
            #     )

            # # Debug: print each couple
            # print("\n=== COUPLES (parsed) ===")
            # for c in couples_by_id.values():
            #     print(
            #         f"Couple {c.id}: divorce={c.divorce} | male={c.male_id} | female={c.female_id}"
            #     )

            # Export GEDCOM
            gedcom_json = to_json(people_by_id, couples_by_id,
                      lang="English")

            # Write JSON file
            with open(output_file + ".json", "w", encoding="utf-8") as f:
                json.dump(gedcom_json, f, indent=2)

            print(f"JSON written to: {output_file + '.json'}")

            gedcom = json_to_gedcom(gedcom_json)

            # Write JSON file
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(gedcom)
            print(f"GEDCOM written to: {output_file}")


            return
        except UnicodeDecodeError:
            print("⚠️ node.ftt is not valid UTF-8 text.")
    else:
        print("⚠️ node.ftt not found!")

    return None

def process_ftz(file: str, output_file: str):
    convert(file, output_file)
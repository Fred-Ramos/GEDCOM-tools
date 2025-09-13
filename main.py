import zipfile
from io import BytesIO
from dataclasses import dataclass
from typing import Optional, Dict, List, Tuple
from datetime import datetime

# ---------------------------
# Data models
# ---------------------------
@dataclass
class Person:
    id: int
    reserved: int
    parent_couple_id: Optional[int]
    unk4: int
    unk5: int
    unk6: int
    f1: float
    f2: float
    unk9: int
    unk10: int
    unk11: int
    unk12: int
    surname: str
    name: str
    # NEW placeholders between name and birth_event
    tab_unk1: Optional[str] = None
    tab_unk2: Optional[str] = None
    # shifted fields start here (+2)
    birth_event: int = 0
    birth_year: Optional[int] = None
    birth_month: Optional[int] = None
    birth_day: Optional[int] = None
    death_event: int = 0
    death_year: Optional[int] = None
    death_month: Optional[int] = None
    death_day: Optional[int] = None
    sex: int = 0  # 1=Male, 2=Female, 3=Unknown
    addition: Optional[str] = None
    note: Optional[str] = None
    # NEW placeholders after note
    tab_unk3: Optional[str] = None
    tab_unk4: Optional[str] = None

@dataclass
class Couple:
    id: int
    divorce: int  # 0=No, 1=Yes
    male_id: Optional[int]
    unk4: int
    female_id: Optional[int]
    unk6: int
    f1: float
    f2: float
    unk9: int
    unk10: int
    unk11: int
    unk12: int

# ---------------------------
# Parsing helpers
# ---------------------------
def _to_int(x: str) -> Optional[int]:
    try:
        v = int(x)
        return None if v == 0 else v
    except Exception:
        return None

def _to_int_keep0(x: str) -> int:
    try:
        return int(x)
    except Exception:
        return 0

def _to_float(x: str) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0

def parse_node_ftt(text: str) -> Tuple[Dict[int, Person], Dict[int, Couple]]:
    """
    Expected layout: TSV (tab-separated values).
    Header line: <n_people>\t<n_couples>\t<last_addition_id>
    People lines (tab-delimited):
      0:id 1:reserved 2:parent_couple_id 3..11:unknowns 12:surname 13:name
      14:tab_unk1 15:tab_unk2
      16:birth_event 17:birth_year 18:birth_month 19:birth_day
      20:death_event 21:death_year 22:death_month 23:death_day
      24:sex 25:addition 26:note 27:tab_unk3 28:tab_unk4
    Couples lines (tab-delimited) with your existing mapping.
    """
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return {}, {}

    # Header (TSV)
    hdr_parts = lines[0].split("\t")
    n_people = int(hdr_parts[0].lstrip("\ufeff"))
    n_couples = int(hdr_parts[1])

    people_by_id: Dict[int, Person] = {}
    couples_by_id: Dict[int, Couple] = {}

    # People: lines[1 : 1 + n_people]
    for i in range(1, 1 + n_people):
        parts = lines[i].split("\t")
        if len(parts) < 29:
            parts += [""] * (29 - len(parts))

        pid = _to_int_keep0(parts[0])
        person = Person(
            id=pid,
            reserved=_to_int_keep0(parts[1]),
            parent_couple_id=_to_int(parts[2]),
            unk4=_to_int_keep0(parts[3]),
            unk5=_to_int_keep0(parts[4]),
            unk6=_to_int_keep0(parts[5]),
            f1=_to_float(parts[6]),
            f2=_to_float(parts[7]),
            unk9=_to_int_keep0(parts[8]),
            unk10=_to_int_keep0(parts[9]),
            unk11=_to_int_keep0(parts[10]),
            unk12=_to_int_keep0(parts[11]),
            surname=parts[12].strip(),
            name=parts[13].strip(),
            tab_unk1=parts[14],
            tab_unk2=parts[15],
            birth_event=_to_int_keep0(parts[16]),
            birth_year=_to_int(parts[17]),
            birth_month=_to_int(parts[18]),
            birth_day=_to_int(parts[19]),
            death_event=_to_int_keep0(parts[20]),
            death_year=_to_int(parts[21]),
            death_month=_to_int(parts[22]),
            death_day=_to_int(parts[23]),
            sex=_to_int_keep0(parts[24]),
            addition=(parts[25].strip() or None),
            note=(parts[26].strip() or None),
            tab_unk3=parts[27],
            tab_unk4=parts[28],
        )
        people_by_id[person.id] = person

    # Couples
    start_couples = 1 + n_people
    for i in range(start_couples, start_couples + n_couples):
        parts = lines[i].split("\t")
        if len(parts) < 12:
            parts += ["0"] * (12 - len(parts))

        cid = _to_int_keep0(parts[0])
        couple = Couple(
            id=cid,
            divorce=_to_int_keep0(parts[1]),
            male_id=_to_int(parts[2]),
            unk4=_to_int_keep0(parts[3]),
            female_id=_to_int(parts[4]),
            unk6=_to_int_keep0(parts[5]),
            f1=_to_float(parts[6]),
            f2=_to_float(parts[7]),
            unk9=_to_int_keep0(parts[8]),
            unk10=_to_int_keep0(parts[9]),
            unk11=_to_int_keep0(parts[10]),
            unk12=_to_int_keep0(parts[11]),
        )
        couples_by_id[couple.id] = couple

    return people_by_id, couples_by_id

# ---------------------------
# Index builders for GEDCOM
# ---------------------------
def build_indexes(people_by_id: Dict[int, Person],
                  couples_by_id: Dict[int, Couple]):
    children_of_couple: Dict[int, List[int]] = {cid: [] for cid in couples_by_id}
    for p in people_by_id.values():
        if p.parent_couple_id and p.parent_couple_id in couples_by_id:
            children_of_couple[p.parent_couple_id].append(p.id)

    couples_of_person: Dict[int, List[int]] = {pid: [] for pid in people_by_id}
    for c in couples_by_id.values():
        for pid in (c.male_id, c.female_id):
            if pid and pid in couples_of_person:
                couples_of_person[pid].append(c.id)

    return children_of_couple, couples_of_person

# ---------------------------
# GEDCOM formatting
# ---------------------------
GED_MONTHS = [None, "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

def fmt_ged_date(y, m, d) -> Optional[str]:
    """Return GEDCOM-compliant date with available granularity."""
    if y is None:
        return None
    if m is None:
        return f"{y}"
    mon = GED_MONTHS[m] if 1 <= m <= 12 else None
    if mon is None:
        return f"{y}"
    if d is None:
        return f"{mon} {y}"
    return f"{d} {mon} {y}"

def sex_to_ged(sex_code: int) -> str:
    return {1: "M", 2: "F"}.get(sex_code, "U")

# ---------------------------
# GEDCOM export
# ---------------------------
def to_gedcom(people_by_id: Dict[int, Person],
              couples_by_id: Dict[int, Couple],
              out_path: str = "output.ged",
              source_name: str = "FTZ2GED",
              lang: str = "English"):
    """Generate a GEDCOM 5.5.1 file from parsed people/couples."""
    person_ids = sorted(people_by_id.keys())
    couple_ids = sorted(couples_by_id.keys())

    # Map internal IDs to GEDCOM pointers
    indi_ptr = {pid: f"@I{idx:04d}@" for idx, pid in enumerate(person_ids)}
    fam_ptr  = {cid: f"@F{idx:04d}@" for idx, cid in enumerate(couple_ids)}

    # Indexes
    children_of_couple, couples_of_person = build_indexes(people_by_id, couples_by_id)

    now = datetime.now()
    head_date = now.strftime("%d %b %Y").upper()     # e.g., "13 SEP 2025"
    head_time = now.strftime("%H:%M:%S")

    lines: List[str] = []

    # HEAD
    lines += [
        "0 HEAD",
        f"1 SOUR {source_name}",
        "2 VERS 1.0",
        f"1 DATE {head_date}",
        f"2 TIME {head_time}",
        "1 SUBM @SUBM@",
        "1 GEDC",
        "2 VERS 5.5.1",
        "2 FORM LINEAGE-LINKED",
        "1 CHAR UTF-8",
        f"1 LANG {lang}",
    ]

    # Minimal SUBM
    lines += [
        "0 @SUBM@ SUBM",
        "1 NAME",
    ]

    # INDI records
    for pid in person_ids:
        p = people_by_id[pid]
        ptr = indi_ptr[pid]
        full_name = f"{p.name} /{p.surname}/".strip()
        lines.append(f"0 {ptr} INDI")
        lines.append(f"1 NAME {full_name}")
        lines.append("2 TYPE birth")
        if p.name:
            lines.append(f"2 GIVN {p.name}")
        if p.surname:
            lines.append(f"2 SURN {p.surname}")
        lines.append(f"1 SEX {sex_to_ged(p.sex)}")

        # Birth
        bdate = fmt_ged_date(p.birth_year, p.birth_month, p.birth_day)
        if p.birth_event and bdate:
            lines.append("1 BIRT")
            lines.append(f"2 DATE {bdate}")

        # Death
        ddate = fmt_ged_date(p.death_year, p.death_month, p.death_day)
        # Emit DEAT if we have a date OR death_event indicates a death (128) even without date
        if p.death_event and (ddate or p.death_event == 128):
            lines.append("1 DEAT" + ("" if ddate else " Y"))
            if ddate:
                lines.append(f"2 DATE {ddate}")

        # FAMC (parents family)
        if p.parent_couple_id and p.parent_couple_id in fam_ptr:
            lines.append(f"1 FAMC {fam_ptr[p.parent_couple_id]}")
            lines.append("2 PEDI birth")

        # FAMS (spouse in families)
        for cid in couples_of_person.get(pid, []):
            lines.append(f"1 FAMS {fam_ptr[cid]}")

        # Inline NOTE
        note_text = p.note or p.addition
        if note_text:
            lines.append(f"1 NOTE {note_text}")

        # CHAN
        lines.append("1 CHAN")
        lines.append(f"2 DATE {head_date}")
        lines.append(f"3 TIME {head_time}")

    # FAM records
    for cid in couple_ids:
        c = couples_by_id[cid]
        fptr = fam_ptr[cid]
        lines.append(f"0 {fptr} FAM")
        if c.male_id and c.male_id in indi_ptr:
            lines.append(f"1 HUSB {indi_ptr[c.male_id]}")
        if c.female_id and c.female_id in indi_ptr:
            lines.append(f"1 WIFE {indi_ptr[c.female_id]}")

        # Children
        for child_pid in children_of_couple.get(cid, []):
            lines.append(f"1 CHIL {indi_ptr[child_pid]}")

        # Divorce
        if c.divorce == 1:
            lines.append("1 DIV Y")

        # CHAN
        lines.append("1 CHAN")
        lines.append(f"2 DATE {head_date}")
        lines.append(f"3 TIME {head_time}")

    # Trailer
    lines.append("0 TRLR")

    # Write file
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    # Debug preview
    print("\n===== GEDCOM preview =====")
    for ln in lines[:80]:
        print(ln)
    if len(lines) > 80:
        print("... (truncated)")
    print("===== end GEDCOM preview =====\n")

    print(f"GEDCOM written to: {out_path}")

# ---------------------------
# Main convert flow
# ---------------------------
def convert(file: str, output_file: str):
    faces_images: List[Tuple[str, BytesIO]] = []   # list of (filename, BytesIO)
    node_file: Optional[Tuple[str, bytes]] = None  # (filename, bytes)

    if not file.lower().endswith(".ftz"):
        print("Not an .ftz file. Exiting.")
        return faces_images, node_file

    print(f"Processing {file} ...")
    with zipfile.ZipFile(file, 'r') as archive:
        all_files = archive.namelist()

        # Detect top-level folder (first part before '/')
        top_folders = {name.split("/")[0] for name in all_files if "/" in name}
        if not top_folders:
            print("⚠️ No folder structure found inside the archive.")
            return faces_images, node_file

        folder_name = top_folders.pop()  # assume only one root
        print(f"Found Family Tree: {folder_name}")

        # Support both "faces/" and "face/"
        faces_prefixes = [f"{folder_name}/faces/", f"{folder_name}/face/"]
        has_faces_folder = any(
            any(name.startswith(prefix) for name in all_files) for prefix in faces_prefixes
        )

        if has_faces_folder:
            for name in all_files:
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
        for name in all_files:
            if name == f"{folder_name}/node.ftt":
                with archive.open(name) as f:
                    node_file = (name, f.read())
                break

    # node.ftt summary + parsing
    people_by_id: Dict[int, Person] = {}
    couples_by_id: Dict[int, Couple] = {}

    if node_file:
        print("Found node.ftt")
        try:
            text = node_file[1].decode("utf-8-sig")
            print("\n===== node.ftt contents =====")
            print(text)
            print("===== end of node.ftt =====\n")

            # Parse into structures
            people_by_id, couples_by_id = parse_node_ftt(text)

            # Debug: print each person
            print("=== PEOPLE (parsed) ===")
            for p in people_by_id.values():
                print(
                    f"Person {p.id}: {p.surname}, {p.name} | "
                    f"Birth: {p.birth_year}-{p.birth_month}-{p.birth_day} (ev={p.birth_event}) | "
                    f"Death: {p.death_year}-{p.death_month}-{p.death_day} (ev={p.death_event}) | "
                    f"Sex={p.sex} | ParentCouple={p.parent_couple_id} | "
                    f"Addition={p.addition} | Note={p.note}"
                )

            # Debug: print each couple
            print("\n=== COUPLES (parsed) ===")
            for c in couples_by_id.values():
                print(
                    f"Couple {c.id}: divorce={c.divorce} | male={c.male_id} | female={c.female_id}"
                )

            # Export GEDCOM
            to_gedcom(people_by_id, couples_by_id, out_path=output_file,
                      source_name="FTZ2GED", lang="English")

        except UnicodeDecodeError:
            print("⚠️ node.ftt is not valid UTF-8 text.")
    else:
        print("⚠️ node.ftt not found!")

    return faces_images, node_file

if __name__ == "__main__":
    ORIGIN_FILE = "FamilyTree.ftz" 
    OUTPUT_FILE = "output2.ged"
    faces_images, node_file = convert(ORIGIN_FILE, OUTPUT_FILE)
from dataclasses import dataclass
from typing import Optional
# ---------------------------
# Data models
# ---------------------------
@dataclass
class Person_ftt:
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
    # placeholders between name and birth_event
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
class Couple_ftt:
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
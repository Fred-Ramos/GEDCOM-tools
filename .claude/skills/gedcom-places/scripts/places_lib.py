"""Shared helpers for the gedcom-places skill: find every place (PLAC) in a GEDCOM JSON tree."""
import json
import re
from pathlib import Path

LEVELS = ("parish", "town", "city", "region", "country")


def as_list(v):
    return v if isinstance(v, list) else [] if v is None else [v]


def place_name(plac):
    """The text of a PLAC value (a string, or an object with _NAME)."""
    if isinstance(plac, dict):
        return str(plac.get("_NAME") or "").strip()
    return str(plac or "").strip()


def walk_places(tree):
    """Yield (record, tag path, parent dict, key) for every PLAC in INDI and FAM records."""
    for kind in ("INDI", "FAM"):
        for rec in as_list(tree.get(kind)):
            yield from _walk(rec, rec, [])


def _walk(rec, node, path):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "PLAC":
                for i, _ in enumerate(as_list(value)):
                    yield rec, path, node, key
                    break
            else:
                yield from _walk(rec, value, path + [key])
    elif isinstance(node, list):
        for item in node:
            yield from _walk(rec, item, path)


def person_name(rec):
    n = as_list(rec.get("NAME"))
    n = n[0] if n else ""
    n = n.get("_NAME", "") if isinstance(n, dict) else str(n)
    return " ".join(n.replace("/", " ").split()) or rec.get("_PDEF", "")


def year_of(node):
    date = node.get("DATE") if isinstance(node, dict) else None
    m = re.findall(r"\d{3,4}", str(date or ""))
    return m[-1] if m else ""


def to_gedcom_coords(lat, lon):
    """GEDCOM 5.5.1 MAP values: N41.1496 / W8.6110."""
    return {"LATI": f"{'N' if lat >= 0 else 'S'}{abs(lat):.4f}", "LONG": f"{'E' if lon >= 0 else 'W'}{abs(lon):.4f}"}


def load_coords(folder: Path):
    """coords.json: {place text: {"lat", "lon", "level", "basis"} or {"skip": reason}}."""
    f = folder / "coords.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}

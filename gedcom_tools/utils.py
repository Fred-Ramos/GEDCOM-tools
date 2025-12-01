from typing import Optional, List

def _to_int(x: str, _None_is_0=False, _0_is_None=False) -> Optional[int]:
    # Impossible combination → caller error
    if _None_is_0 and _0_is_None:
        raise ValueError("None_is_0 and _0_is_None cannot both be True")

    # Try to convert
    try:
        value = int(x)
    except Exception:
        return 0 if _None_is_0 else None

    # Post-processing
    if _0_is_None and value == 0:
        return None

    return value
        
def _to_float(x: str) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0
    
def remove_empty_strings(obj):
    if isinstance(obj, dict):
        keys_to_delete = []
        for k, v in obj.items():
            if v == "":                     # delete empty string entries
                keys_to_delete.append(k)
            else:
                obj[k] = remove_empty_strings(v)
        
        for k in keys_to_delete:
            del obj[k]

        return obj

    elif isinstance(obj, list):
        return [remove_empty_strings(x) for x in obj]

    else:
        return obj
    
# ---------------------------
# GEDCOM formatting
# ---------------------------
GED_MONTHS = [None, "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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
from typing import Optional

def _to_int(x: str, None_is_0=False) -> Optional[int]:
    try:
        return int(x)

    except Exception:
        if None_is_0:
            return 0
        else:
            return None

def _to_float(x: str) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0
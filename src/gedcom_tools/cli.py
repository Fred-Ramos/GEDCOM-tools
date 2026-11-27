import os
import sys

from .converter import process_ftz


def _free_name(stem: str, ext: str) -> str:
    """<stem><ext>, or <stem>_1<ext>, _2... when that file exists (never overwrite an .ftz)."""
    path, n = stem + ext, 0
    while os.path.exists(path):
        n += 1
        path = f"{stem}_{n}{ext}"
    return path


def to_ftz(file: str) -> None:
    """A .zip (.ged + photos), .ged or .json -> .ftz next to it."""
    from .ftz_writer import file_to_ftz, describe
    with open(file, "rb") as f:
        data = f.read()
    try:
        ftz, report = file_to_ftz(data, os.path.basename(file))
    except ValueError as e:
        print(f"⚠️ {file}: {e}")
        return
    out = _free_name(os.path.splitext(file)[0], ".ftz")
    with open(out, "wb") as f:
        f.write(ftz)
    print(f"Written: {out} ({describe(report)})")


def main(argv=None):
    """Convert the files given as arguments: .ftz -> .zip + .json; .ged/.zip/.json -> .ftz.
    Without arguments, every .ftz in the current directory."""
    args = sys.argv[1:] if argv is None else argv
    files = args or sorted(f for f in os.listdir() if f.lower().endswith(".ftz"))
    if not files:
        print("No .ftz files found in the current directory.")
        return

    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in (".ged", ".zip", ".json"):
            print(f"Converting {file} to .ftz")
            to_ftz(file)
            continue
        output_name = os.path.splitext(file)[0]
        print(f"Found FTT {file}, converting to GEDCOM {output_name}")
        process_ftz(file, output_name)

    print("Done:")
    for file in files:
        print(file)


if __name__ == "__main__":
    main()

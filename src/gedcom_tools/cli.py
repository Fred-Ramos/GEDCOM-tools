import os
import sys

from .converter import process_ftz


def main(argv=None):
    """Convert the .ftz files given as arguments, or every .ftz in the current directory."""
    args = sys.argv[1:] if argv is None else argv
    ftz_files = args or sorted(f for f in os.listdir() if f.lower().endswith(".ftz"))
    if not ftz_files:
        print("No .ftz files found in the current directory.")
        return

    for file in ftz_files:
        output_name = os.path.splitext(file)[0]
        print(f"Found FTT {file}, converting to GEDCOM {output_name}")
        process_ftz(file, output_name)

    print("Converted all FTT files:")
    for file in ftz_files:
        print(file)


if __name__ == "__main__":
    main()

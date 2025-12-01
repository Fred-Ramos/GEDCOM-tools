import os
from gedcom_tools.converter import process_ftz

if __name__ == "__main__":
    files = os.listdir()
    ftz_files = []
    for file in files:
        if file.endswith(".ftz"):
            ftz_files.append(file)
            output_file=file[:-3] + "ged"
            print(f"Found FTT {file}, converting to GEDCOM {output_file}")
            process_ftz(file, output_file)

    print(f"Converted all FTT files:")
    for file in ftz_files:
        print(file)
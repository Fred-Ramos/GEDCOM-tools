import os
from gedcom_tools.converter import process_ftz

if __name__ == "__main__":
    files = os.listdir()
    ftz_files = []
    for file in files:
        if file.endswith(".ftz"):
            ftz_files.append(file)
            output_name=file[:-4]
            print(f"Found FTT {file}, converting to GEDCOM {output_name}")
            process_ftz(file, output_name)

    print(f"Converted all FTT files:")
    for file in ftz_files:
        print(file)
# GEDCOM tools (.ftz file converter)

This repository converts .ftz family tree archives (used in the android app **Quick Family Tree**) into standard GEDCOM 5.5.1 files, compatible with most genealogy tools.

## Usage from release

1. Download `gedcom_tools.exe` from the releases.

2. Place all `.ftz` files you want to convert in the same directory as `gedcom_tools.exe`.

3. Run the executable.

## Usage from source code

1. Make sure you have Python 3.8+ installed (no extra dependencies required)

2.  Clone or download this repository.
3.  Place all `.ftz` files you want to convert in the same directory as
    `main.py`.
4.  Run:

``` bash
python3 main.py
```

## Result

Either using source code with python or the executable, each `.ftz` file will be converted into a `.ged` file with the same
name:

    example.ftz  ->  example.ged

## Notes

-   Person images inside FTZ files are detected but currently not
    exported.

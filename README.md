# GEDCOM Tools (FTZ → GEDCOM Converter)

Converts **.ftz** archives (fromat from the *Quick Family Tree* app) into
standard **GEDCOM 5.5.1** files, compatible with most genealogy
applications.

## 🚀 Usage

1.  Clone or download this repository.\
2.  Place all `.ftz` files you want to convert in the same directory as
    `main.py`.\
3.  Run:

``` bash
python3 main.py
```

Each `.ftz` file will be converted into a `.ged` file with the same
name:

    example.ftz  →  example.ged

## 📦 Requirements

-   Python 3.8+
-   No external dependencies required

## 📌 Notes

-   Person images inside FTZ files are detected but currently not
    exported.

# GEDCOM tools (.ftz file converter)

This repository converts .ftz family tree archives (used in the android app **Quick Family Tree**) into standard GEDCOM 5.5.1 files, compatible with most genealogy tools.

## Usage in the browser

Open the web page (`web/index.html`), choose an `.ftz` file, then save the `.zip` (the `.ged` with its
photos) and, if you want it, the `.json`.
The conversion runs in your browser with [Pyodide](https://pyodide.org); the file is never uploaded.

To run the page locally, serve the repository root (opening the file directly does not work):

``` bash
python3 -m http.server
# then open http://localhost:8000/web/
```

To publish it, enable GitHub Pages for the repository root. The root `index.html` redirects to `/web/`, so the site's main address opens the page.

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
python3 main.py                  # converts every .ftz in the current directory
python3 main.py tree.ftz         # or only the files you name
```

Or install it as a command:

``` bash
pip install .
gedcom-tools                     # same as python3 main.py
```

## Result

Either using source code with python or the executable, each `.ftz` file is converted into two files
with the same name:

    example.ftz  ->  example.zip    (example.ged + the example_photos/ folder it links to)
                     example.json   (the same tree as JSON, outside the zip, easy to read)

Unzip `example.zip` to use the `.ged` in another genealogy program; keep the photos folder next to it.
The web page opens the `.zip` directly (Family tree and Book tabs), photos included.

## Turning notes into GEDCOM records (Claude Code)

The app stores births, baptisms, deaths, burials, occupations and marriages as free text
in each person's note. With [Claude Code](https://claude.com/claude-code) open in this
repository, ask it to interpret the notes of a tree (or run `/gedcom-notes`):

    example.json  ->  example_processed.zip + example_processed.json   (notes turned into BIRT, BAPM, DEAT, BURI, RESI, OCCU, MARR)

The skill lives in `.claude/skills/gedcom-notes/`. The interpretation rules are in `rules.md`.
Existing data is never overwritten; disagreements are reported.

## Notes

-   A `.ged` file cannot contain images, only links to them. Each person with a photo in the `.ftz` gets
    a link (GEDCOM `OBJE`/`FILE`) to `example_photos/<id>.jpg`, and that folder is inside the `.zip`.

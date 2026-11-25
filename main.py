import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))  # package lives in src/

from gedcom_tools.cli import main

if __name__ == "__main__":
    main()

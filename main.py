import zipfile
from io import BytesIO

def convert(file):
    faces_images = []   # list of (filename, BytesIO)
    node_file = None    # (filename, bytes)

    if file.lower().endswith(".ftz"):
        print(f"Processing {file} ...")

        with zipfile.ZipFile(file, 'r') as archive:
            for name in archive.namelist():
                # Collect .jpg under FamilyTree/faces/
                if name.startswith("FamilyTree/faces/") and name.lower().endswith(".jpg"):
                    with archive.open(name) as f:
                        faces_images.append((name, BytesIO(f.read())))

                # Collect node.ftt (mandatory)
                elif name == "FamilyTree/node.ftt":
                    with archive.open(name) as f:
                        node_file = (name, f.read())

        # Debug summary
        print(f"Found {len(faces_images)} faces")
        if node_file:
            print("Found node.ftt")
            try:
                # Try decoding as UTF-8 plain text
                text = node_file[1].decode("utf-8")
                print("\n===== node.ftt contents =====")
                print(text)
                print("===== end of node.ftt =====\n")
            except UnicodeDecodeError:
                print("⚠️ node.ftt is not valid UTF-8 text.")
        else:
            print("⚠️ node.ftt not found!")

    else:
        print("Not an .ftz file. Exiting.")

    return faces_images, node_file


if __name__ == "__main__":
    ORIGIN_FILE = "pais.ftz"  # change this path if needed
    faces_images, node_file = convert(ORIGIN_FILE)

    # Example: just listing image names
    print("Faces list:", [name for name, _ in faces_images])

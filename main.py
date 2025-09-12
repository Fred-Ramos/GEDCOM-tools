import zipfile
from io import BytesIO

def convert(file):
    faces_images = []   # list of (filename, BytesIO)
    node_file = None    # (filename, bytes)

    if file.lower().endswith(".ftz"):
        print(f"Processing {file} ...")

        with zipfile.ZipFile(file, 'r') as archive:
            all_files = archive.namelist()

            # Detect top-level folder (first part before '/')
            top_folders = {name.split("/")[0] for name in all_files if "/" in name}
            if not top_folders:
                print("⚠️ No folder structure found inside the archive.")
                return faces_images, node_file

            folder_name = top_folders.pop()  # assume only one root
            print(f"Found Family Tree: {folder_name}")

            # Check if faces folder exists
            has_faces_folder = any(name.startswith(f"{folder_name}/faces/") for name in all_files)

            if has_faces_folder:
                for name in all_files:
                    if name.startswith(f"{folder_name}/faces/") and name.lower().endswith(".jpg"):
                        with archive.open(name) as f:
                            faces_images.append((name, BytesIO(f.read())))
                print(f"Faces folder found with {len(faces_images)} image(s).")
                if faces_images:
                    print("Faces list:")
                    for fname, _ in faces_images:
                        print(" -", fname)
            else:
                print("No faces folder available.")

            # Collect node.ftt (mandatory)
            for name in all_files:
                if name == f"{folder_name}/node.ftt":
                    with archive.open(name) as f:
                        node_file = (name, f.read())
                    break

        # Debug summary for node.ftt
        if node_file:
            print("Found node.ftt")
            try:
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

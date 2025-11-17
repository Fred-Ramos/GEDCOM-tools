from gedcom_tools.converter import convert

if __name__ == "__main__":
    ORIGIN_FILE = "FamilyTree131125.ftz" 
    OUTPUT_FILE = "output2.ged"
    faces_images, node_file = convert(ORIGIN_FILE, OUTPUT_FILE)
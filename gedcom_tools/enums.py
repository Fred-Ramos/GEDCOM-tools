class Tags:
    """GEDCOM tags used in the application"""

    # Parent relationships
    MOTHER_REL = "_MREL"      # Relationship to a mother
    FATHER_REL = "_FREL"      # Relationship to a father

    # Personal events
    BIRTH = "BIRT"            # The event of entering into life
    BURIAL = "BURI"           # The event of proper disposing of remains
    CENSUS = "CENS"           # Census event
    CHANGE = "CHAN"           # Indicates a change, correction, or modification
    CHILD = "CHIL"            # Child of a father and mother
    CONCAT = "CONC"           # Concatenation indicator
    CONTINUE = "CONT"         # Continued indicator
    DATE = "DATE"             # Time of an event in calendar format
    DEATH = "DEAT"            # Event when mortal life terminates

    # Family / structure
    FAMILY = "FAM"            # Family relationship
    FAMILY_AS_CHILD = "FAMC"  # Family in which individual appears as child
    FAMILY_AS_SPOUSE = "FAMS" # Family in which individual appears as spouse

    # Objects / files / occupations
    FILE = "FILE"             # Information storage place
    GIVEN = "GIVN"            # Given or earned name
    HUSBAND = "HUSB"          # Individual in role of married man or father
    INDIVIDUAL = "INDI"       # A person
    MARRIAGE = "MARR"         # Event of creating a family unit
    NAME = "NAME"             # Name used to identify individual
    OBJECT = "OBJE"           # Multimedia object
    OCCUPATION = "OCCU"       # Type of work or profession
    PLACE = "PLAC"            # Jurisdictional name for place/location
    PRIVATE = "PRIV"          # Flag for private address or event
    SEX = "SEX"               # Sex of an individual
    SOURCE = "SOUR"           # Source material
    SURNAME = "SURN"          # Family name
    WIFE = "WIFE"             # Individual in role as mother/married woman

    # Header / metadata
    HEADER = "HEAD"           # Header record
    GEDCOM = "GEDC"           # GEDCOM version information
    VERSION = "VERS"          # Version
    FORM = "FORM"             # Form
    CHARSET = "CHAR"          # Character set
    LANGUAGE = "LANG"         # Language
    SUBMITTER = "SUBM"        # Submitter
    TRAILER = "TRLR"          # Trailer record
    NOTE = "NOTE"             # Note
    PEDIGREE = "PEDI"         # Pedigree
    DIVORCE = "DIV"           # Divorce
    TIME = "TIME"             # Time

    # Custom tags (unchanged)
    _NAME = "_NAME"           # When naming a element (custom tag)
    _PREF = "_PREF"           # Pointer Reference (custom tag)
    _PDEF = "_PDEF"           # Pointer Definition (custom tag)

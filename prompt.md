This is a .txt file with information in GEDCOM format. Please follow my instructions and give me back the .txt with the added modifications.

Instruction:

1. For each individual in the GEDCOM file (represented by `INDI`), first check if the individual has an entry for `BIRT` (birth), `DEAT` (death), `BURI` (burial), `BAPM` (baptism), or marriage (represented by an `EVEN` entry with `TYPE Marriage`).

2. Then check the **NOTES** of that individual for any reference to a place or date of birth, death, burial, baptism, or marriage. Use intelligent interpretation to search for typical phrases or keywords related to birth, death, baptism, marriage, and burial. Extract dates and places by recognizing common date formats and known location names.

3. If a place or date is found in the **NOTES**, add a new line under the corresponding entry or create it (`BIRT`, `DEAT`, `BURI`, `BAPM`, or marriage) with the tag `PLAC` for the place, or `DATE` for the date.

4. If no place or date is found in the **NOTES** but the `BIRT`, `DEAT`, `BURI`, `BAPM`, or marriage entry exists, **do not add the entry or any placeholder**.

5. The format for filling the place and date should be as follows:

   - **For `BIRT` (birth) entry**:  
     Add `PLAC` entry right below `BIRT`, with the place of birth. If the date is missing, add `DATE` entry.
     ```
     1 BIRT
     2 DATE [Birth Date]
     2 PLAC [Place of Birth]
     ```

   - **For `DEAT` (death) entry**:  
     Add `PLAC` entry right below `DEAT`, with the place of death. If the date is missing, add `DATE` entry.
     ```
     1 DEAT
     2 DATE [Death Date]
     2 PLAC [Place of Death]
     ```

   - **For `BURI` (burial) entry**:  
     Add `PLAC` entry right below `BURI`, with the place of burial. If the date is missing, add `DATE` entry.
     ```
     1 BURI
     2 DATE [Burial Date]
     2 PLAC [Place of Burial]
     ```

   - **For `BAPM` (baptism) entry**:  
     Add `DATE` entry right below `BAPM`, with the date of baptism, and `PLAC` entry with the place.
     ```
     1 BAPM
     2 DATE [Baptism Date]
     2 PLAC [Place of Baptism]
     ```

   - **For `EVEN` (Marriage) entry**:  
     Add `TYPE Marriage` entry and include the date and place of marriage. The format should be:
     ```
     1 EVEN
     2 TYPE Marriage
     2 DATE [Marriage Date]
     2 PLAC [Place of Marriage]
     ```

6. If there is no place or date found in the **NOTES** or elsewhere, leave the `PLAC` or `DATE` entry empty or omit it entirely.

---

Example GEDCOM Input:
```
0 @I0000@ INDI
1 NAME John Doe
1 BIRT
2 DATE 15 APR 1950
1 DEAT
2 DATE 20 MAY 2000
1 BURI
2 DATE 22 MAY 2000
1 BAPM
2 DATE 10 JUN 1950
1 EVEN
2 TYPE Marriage
2 DATE 12 DEC 1975
1 NOTE Born in Paris, France. Died in New York. Buried in Arlington Cemetery. Baptized in St. Peter's Church. Married in Boston.
```

Expected Output:
```
0 @I0000@ INDI
1 NAME John Doe
1 BIRT
2 DATE 15 APR 1950
2 PLAC Paris, France
1 DEAT
2 DATE 20 MAY 2000
2 PLAC New York
1 BURI
2 DATE 22 MAY 2000
2 PLAC Arlington Cemetery
1 BAPM
2 DATE 10 JUN 1950
2 PLAC St. Peter's Church
1 EVEN
2 TYPE Marriage
2 DATE 12 DEC 1975
2 PLAC Boston
```

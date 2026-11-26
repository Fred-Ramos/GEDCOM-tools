# Note interpretation rules

The notes come from the Quick Family Tree app. They are written mostly in Portuguese
(sometimes Spanish or other languages) and usually copied from parish records.
Each batch entry gives the note split into lines (the app's `<br>`), the events that
already exist (`existing`) and the families where the person is a spouse (`families`).

**Golden rule: never invent.** Only extract what the note states. When a sentence is
ambiguous, leave it in the note. Lost information is worse than an unextracted note.

## What to extract

| Note says | GEDCOM | Where |
|---|---|---|
| Natural de X, nasceu/nascido/nascida em X, nascimento em X | `BIRT` `PLAC` (and `DATE` if given) | individual |
| Batizado/batizada/baptizado a DATE em X, batismo | `BAPM` `DATE` / `PLAC` | individual |
| Faleceu/morreu/óbito/falecimento em X a DATE | `DEAT` `DATE` / `PLAC` | individual |
| Faleceu de/com CAUSE, causa da morte | `DEAT` `CAUS` | individual |
| Sepultado/sepultada/enterrado em X, cemitério X, jazigo | `BURI` `PLAC` (and `DATE`) | individual |
| Profissão: X, lavrador, doméstica, advogado, militar, padre, negociante… | `OCCU` | individual |
| Morador em X, residente em X, vivia em X | `RESI` `PLAC` (and `DATE`) | individual |
| Casou/casaram em X a DATE, casamento em X | `MARR` `DATE` / `PLAC` | **family** |
| Divorciou-se/divorciado/divórcio a DATE em X | `DIV` `DATE` / `PLAC` | **family** |

"Natural e batizada a 19/08/1832 em São Pedro" gives both `BIRT.PLAC` and
`BAPM` (`DATE` + `PLAC`) with the same place.

### Origin ("de X")
A note or line that is just a place of origin ("de Covelinhas", "do lugar de
Peneireiros, Veade", "de Victoria, Porto") is the birthplace in parish-record style →
`BIRT.PLAC`. Only when the whole line is that phrase. "de" inside a sentence is not a
birth keyword.

### Nationality
"Brasileiro/Brasileira" → `BIRT.PLAC` "Brazil"; "Português/Portuguesa" → "Portugal";
"Espanhol/Espanhola" → "Spain". Only when no more specific birthplace is known
(neither in the note nor in `existing.BIRT.PLAC`).

## Divorce (DIV) - goes on the FAM record
Pick the family like a marriage (below): the spouse named in the note, the only family, or, when the
person has several, the one already marked divorced (`DIV` "Y" from the app). A "Y" is replaced by
the date/place. A legal separation ("separação de pessoas e bens") is **not** a divorce: leave it in
the note. Example (invented): "Divorciada de Rui a 02/03/1950 em Lisboa" →
`"families": {"@F0123@": {"DIV": {"DATE": "2 Mar 1950", "PLAC": "Lisboa"}}}`.

## Marriage (MARR) - goes on the FAM record
1. Pick the family from the entry's `families` list:
   - exactly one family → that one;
   - several → use the spouse named in the note ("casou com Rita") to match `spouse_name`;
     if no spouse is named, or the name matches none / several → do not extract.
2. No family listed → nothing to attach the marriage to: leave it in the note.
3. "Casou com 22 anos", "casou duas vezes", "viúvo de X", witnesses
   ("testemunhas no casamento") are not MARR data → leave in the note.
4. Both spouses often describe the same marriage. Write it once per family
   (if both say it, both patches may carry it; the apply script merges them and
   reports any disagreement).

## Dates
GEDCOM format: `D Mon YYYY`, `Mon YYYY` or `YYYY`, with English 3-letter months
`Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`.

- `14/07/1919` → `14 Jul 1919` (day/month/year, Portuguese order)
- `12 março 1995`, `dia 3 de maio de 1980`, `7 de agosto de 1980` → `12 Mar 1995`, `3 May 1980`, `7 Aug 1980`
- Month names: janeiro, fevereiro, março, abril, maio, junho, julho, agosto,
  setembro, outubro, novembro, dezembro (also old spellings like "Março", "Agôsto")
- `antes de 1850` → `BEF 1850`; `depois de 1850` → `AFT 1850`;
  `cerca de 1900`, `c. 1900`, `por volta de 1900` → `ABT 1900`;
  `entre 1850 e 1860` → `BET 1850 AND 1860`
- A baptism date is **not** a birth date. Never copy `BAPM.DATE` into `BIRT.DATE`.
- No year → no DATE (leave it in the note).

## Places
Copy the place as written, keeping its own order and spelling
("São Ildefonso, Porto", "Penedo de São Pedro de Riba d'Aves, Famalicão").
Drop only the connective words: "em", "na", "no", "na freguesia de", "na igreja de".
Keep "igreja", "cemitério", "rua" when they are the place itself
("Cemitério do Bonfim", "Igreja dos Terceiros do Carmo (Santo Ildefonso)").
Do not add a city or country that the note does not mention.

## Existing data
`existing` shows what the tree already has. Only add what is missing:
- event missing → add it;
- event present but without `PLAC`/`DATE`/`CAUS` → add only the missing field;
- the note disagrees with an existing value → do not extract that value, leave the
  sentence in the note.
`"DEAT": "Y"` means "died, no details" - adding death details is fine.

## The remaining NOTE
After extraction, rewrite the note with what was **not** extracted, verbatim:
godparents ("padrinhos"), witnesses, marital status ("casado", "solteira", "viúvo de Mariana"),
alternative spellings ("ou Ignatio"), age at marriage, family comments, sources.
- Join remaining lines with `\n` (not `<br>`).
- Remove only the words you extracted, plus connectives left dangling. Keep the rest of
  each sentence as written.
- Nothing left → `"NOTE": null`.
- Always include `NOTE` for every individual you patch.
- If you extract nothing from a person, leave them out of the patch file.

## Patch file format
One `patch_NNN.json` per `batch_NNN.json`:

```json
{
  "individuals": {
    "@I0001@": {
      "BIRT": {"PLAC": "São Ildefonso, Porto"},
      "DEAT": {"PLAC": "Rua da Madeira"},
      "BURI": {"PLAC": "Igreja dos Terceiros do Carmo (Santo Ildefonso)"},
      "NOTE": "Viuvo de Mariana."
    }
  },
  "families": {
    "@F0107@": {"MARR": {"PLAC": "Victoria, Porto"}}
  }
}
```

Allowed: individuals → `BIRT BAPM DEAT BURI RESI` (objects with `DATE PLAC CAUS`),
`OCCU` (string or list), `NOTE` (string or null); families → `MARR`, `DIV` (`DATE PLAC`).

## Worked examples

**@I0006@** existing `BIRT.DATE 13 Jul 1919`, `DEAT.DATE 22 Jun 2009`
> Batizado a 14/07/1919, em São Baptista, Rio de Janeiro. Padrinhos Antonio Leal da Silva e Maria Abreu Lima.
> Faleceu em Belo Horizonte, casado, de encefalopatia hepática. Cemitério do Bonfim.

```json
"@I0006@": {
  "BAPM": {"DATE": "14 Jul 1919", "PLAC": "São Baptista, Rio de Janeiro"},
  "DEAT": {"PLAC": "Belo Horizonte", "CAUS": "encefalopatia hepática"},
  "BURI": {"PLAC": "Cemitério do Bonfim"},
  "NOTE": "Padrinhos Antonio Leal da Silva e Maria Abreu Lima.\nFaleceu casado."
}
```

**@I0004@** families: `[{"fam": "@F0007@", "spouse_name": "Rita /…/"}]`
> Casou em São Nicolau, Porto, com Rita "sua criada e da qual tem uma filha chamada Maria Izabel com 6 anos".

```json
"individuals": {"@I0004@": {"NOTE": "Casou com Rita \"sua criada e da qual tem uma filha chamada Maria Izabel com 6 anos\"."}},
"families":    {"@F0007@": {"MARR": {"PLAC": "São Nicolau, Porto"}}}
```

**@I0018@**
> Batizada a 27/01/1895 na freguesia de N. Sra. da Glória da diocese de São João Baptista
> Casou com 22 anos

```json
"@I0018@": {
  "BAPM": {"DATE": "27 Jan 1895", "PLAC": "N. Sra. da Glória da diocese de São João Baptista"},
  "NOTE": "Casou com 22 anos"
}
```

**@I0003@** (no birthplace known)
> Brasileiro

```json
"@I0003@": {"BIRT": {"PLAC": "Brazil"}, "NOTE": null}
```

# Surname rules

Goal: every person carries their **birth (maiden) surname**. Children get the surnames passed
on by their parents. Nothing is lost: the original name, married names, nicknames and
alternative spellings are kept as extra GEDCOM name data.

Examples below use invented names. **Never write anything from the user's family into this skill**
(names, surnames, places, abbreviations): the repository is public. Everything specific to one
tree lives in that tree's local `config.json` (section 0), which is gitignored with the other data.

## 0. Setup: ask before changing anything
Run `extract_names.py TREE.json --setup`. It lists, from the tree itself:
1. **abbreviations** found in surnames (e.g. `XY`, `A.G.S.`): ask the user what each means and whether to
   write it out in full, keep it as is, or the other way round (write a long surname as the abbreviation);
2. **multi-word surnames** that children carry unchanged from their father: ask which ones are a
   family surname that passes on whole;
3. **places that look Spanish-speaking**: ask which towns or regions name children the Spanish way;
4. **how many recent generations** should get missing surnames filled in. In older generations a
   missing surname is often deliberate (people really had none, or only a married name is known), so
   they are left as recorded. Counted back from the youngest birth in the tree, 28 years per
   generation; missing birth years are estimated from relatives (parents + 28, children − 28,
   spouses and siblings about the same).

Save the answers in the answers folder (`X_names/config.json`):

```json
{"abbreviations": {"XY": "Xavier Yanez"}, "compound_surnames": ["Costa Mendes"],
 "spanish_places": ["Town", "Region"], "recent_generations": 4}
```

Never guess what an abbreviation means.

## 1. What a cleaned name looks like (GEDCOM 5.5.1)

```
1 NAME Maria Júlia /Reis de Almeida/      ← birth name, shown everywhere
2 GIVN Maria Júlia
2 SURN Reis de Almeida
2 NICK Juju                                ← nickname, if any
2 TYPE birth
1 NAME Maria Júlia /Reis de Almeida Ramos/ ← married name, kept but not shown
2 TYPE married
1 NAME Maria Júlia /Reis d'Almeida (Ramos)/ ← original spelling, if it changed
2 TYPE aka
```

The birth `NAME` is always first, so the family-tree pages show it.

## 2. Cleaning (fixed rules, always applied, confidence: certain)

| Found | Do | Example |
|---|---|---|
| an abbreviation rule from the config | replace it in names, answers and notes, all generations (works both ways; the recorded spelling is not kept as aka for this change alone) | `{"XY": "Xavier Yanez"}`: `Costa XY` → `Costa Xavier Yanez`; `{"Xavier Yanez": "XY"}` shortens instead |
| `(X)` at the end of the surname | X is a **married** surname: remove it from the birth surname; married name = birth surname + X | `/Reis (Ramos)/` → birth `Reis`, married `Reis Ramos` |
| whole surname is `(X)` | birth surname unknown (infer it, section 3); married name = X | `/(Dias)/` → birth `?`, married `Dias` |
| `'X'` in the given name | X is a **nickname**: move it to `NICK` | `Alfredo 'Dito'` → given `Alfredo`, `NICK Dito` |
| `Avó`, `Avô` at the start of the given name | remove (it describes the relationship to the user, not the name) | `Avô Jorge` → `Jorge` |
| two surnames separated by `/` | first is the birth surname, second goes to an `aka` name | `/Lopes/Lobo/` → `Lopes` + aka `Lobo` |
| `?` anywhere | keep it as written; it marks real doubt. Put the person on the review list | `Cardoso Celha?` stays |
| extra spaces | collapse to one | |

Do **not** "correct" old or regional spellings (`Joze`/`José`, `Thereza`/`Teresa`, `Mattos`/`Matos`):
they are how the records were written.

## 3. Inferring a missing birth surname

Only for people whose birth surname is empty after cleaning **and who belong to the recent
generations** chosen in setup (section 0, `recent_generations`). Older people keep their names as
recorded (cleaning still applies). A recorded surname is never replaced by an inferred one.

Work **from the oldest generation down**, so an inferred parent surname can be passed on.

### 3.1 The surname a person passes on
- **Portuguese/Brazilian convention:** the **last** family surname. A family surname can be
  several words that always travel together: particles stay with the next word (`da Silva`,
  `de Lima`, `dos Santos`, `d'Almeida`; a saint's title takes one more word: `de São Paulo`), and the
  compound family surnames the user confirmed in setup (`compound_surnames`) stay whole.
- **Spanish convention:** the **first** surname (the father's).

### 3.2 Which convention a family uses
- **Spanish** if the person (or, for an unknown person, their parents) was born or baptised in a
  Spanish-speaking country (Spain/Espanha, México, Chile, Argentina, Uruguay, …) or in a town/region
  the user listed in setup (`spanish_places`).
- **Portuguese** otherwise (Portugal, Brazil, other countries, unknown).

### 3.3 Building the child's surname

| Convention | Child's birth surname | Example |
|---|---|---|
| Portuguese | mother passes on + father passes on (**both parents joined**, the user's choice) | mother `Sofia Lopes Vaz`, father `Rui Costa Barros` → `Vaz Barros` |
| Spanish | father passes on + mother passes on | father `Pablo Ortega Ruiz`, mother `Ana Zubiria Lara` → `Ortega Zubiria` |
| one parent known | that parent's passed-on surname alone | |

Note: in many Portuguese trees the recorded children carry only the **father's full surname**. The joined form is still the proposal (the user's choice), but always offer the
father's-full-surname version as an alternative when asking (section 5).

### 3.4 Evidence beats the rule
Families did not always follow the convention (some children took only the father's
surnames). Before applying 3.3, look at **full siblings with a recorded surname**:
- if they all share one surname → use it (confidence: **likely**);
- if they differ → apply 3.3 and mark it **guess**, mentioning the siblings' surnames.

### 3.5 From children back to a parent
A parent with no surname and no known parents can sometimes be read from their children:
in the Portuguese convention, a child `X Y` of a father whose surname ends in `Y` suggests
the mother passed on `X` (confidence: **guess**). Use it only when at least one child shows it
and no child contradicts it. Ignore a part whose words already appear in the other parent's
surname: children often carry the father's full surname (`Costa Lima` from father `Faria Costa Lima`),
which says nothing about the mother.

### 3.6 When nothing is known
No parents, no siblings, no children evidence → leave the surname empty. Do not invent.

## 4. Married names without parentheses
Portuguese women often appear with the husband's surname added and no parentheses. If a
woman's recorded surname **ends with her husband's passed-on surname** and her parents'
surnames point to a different birth surname, **do not change it automatically**: put it on the
review list with the proposed birth surname (confidence: **guess**).

## 5. Confidence and review
Every change gets one level:
- **certain**: section 2 cleaning;
- **likely**: matches recorded siblings, or both parents known and the result agrees with at least one recorded sibling or child;
- **guess**: everything else from sections 3.3–4.

**Certain** changes (section 2 cleaning) are applied with only a summary.

**Every inferred surname is asked one by one** (likely and guess alike; the user wants to decide each
case). For each person show: their name and years, their parents (with surnames), recorded siblings'
surnames if any, the convention used and why. Offer, in this order:
1. the rule's proposal (joined parents' surnames, or the siblings' surname when 3.4 applies),
2. the father's full surname (Portuguese) or another sensible variant,
3. leave the surname empty,
and the user can always type their own. Use their answer exactly as given.

### Mark guessed surnames in the note
Every surname that was **not recorded** but worked out (any answer that fills in or replaces a
birth surname from rules 3-4) adds a line to the person's `NOTE`, in Portuguese like the rest of
the notes:

`Apelido deduzido (não registado): <surname>. Base: <basis>.`

Basis, by how it was found: `apelidos dos irmãos`, `apelidos dos pais (mãe + pai)`,
`apelidos dos pais (pai + mãe)` (Spanish), `apelido completo do pai`, `apelidos dos filhos`,
`escolha do utilizador` (typed by the user). Nothing is added when the surname stays empty.

## 6. Patch format
One `names_NNN.json` per batch:

```json
{
  "@I0001@": {
    "given": "Maria Júlia",
    "surname": "Reis de Almeida",
    "married": ["Reis de Almeida Ramos"],
    "nick": "Juju",
    "aka": ["Reis d'Almeida (Ramos)"],
    "confidence": "certain",
    "reason": "married name in parentheses; nickname in quotes"
  },
  "@I0002@": {
    "surname": "Vaz Barros",
    "confidence": "guess",
    "basis": "apelidos dos pais (mãe + pai)"
  }
}
```

`basis` marks an inferred surname: it is what goes into the note. `given` (optional) corrects the
given name, e.g. when the surname was typed inside it (`João Maria Costa Lima //` → given
`João Maria`, surname `Costa Lima`).

Only include people whose name changes. `married`, `nick` and `aka` are optional.

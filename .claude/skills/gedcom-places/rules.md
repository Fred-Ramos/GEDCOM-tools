# Rules for coordinates

**Never send place names to an online geocoding service.** They are family data. Work the
coordinates out yourself, and ask the user when you are not sure.

## 1. Precision levels (`level` in coords.json)

| level | use for | example |
|---|---|---|
| `parish` | a parish, village, hamlet, neighbourhood, church, cemetery or street | a parish of a city, a cemetery |
| `town` | a small town or municipality seat | a municipality named without parish |
| `city` | a city, when the parish is not known | "Madrid", "Lyon, França" |
| `region` | a state, province or district only | "Texas", "Andaluzia" |
| `country` | only a country ("Portugal", "Brasil") | gets **no** coordinates |

- A hamlet, street, church or cemetery takes the coordinates of its parish (or city), not a guessed
  exact point. Write the precise place in `basis` when you know it.
- A region gets its approximate centre. A country gets no coordinates: a dot in the middle of a
  country would look like a real place.
- Four decimals are plenty (about 10 m); the real precision is the level.

## 2. Reading the place text

- Places are written as in the records: old spellings ("Villa", "Thyrso", "Regua"), parish
  patron saints ("Santa Maria de X" = parish X), parish + municipality + district, sometimes in
  another order. Different spellings of one place get the same coordinates.
- `?` in the text means the source was unsure. Use the place if it clearly exists (and keep the
  doubt in mind), otherwise ask.
- An old name gives the place under its current name (an old parish name, a city's former name).
- Words that are not places (an occupation, "freguesia de", "concelho de") are ignored.

## 3. Same name, several places

Many names exist in several countries or regions (parish names, saints, "Springfield", "San José").
Decide from the family, not from fame:
- the same person's other events (born there, baptised there);
- the parents', spouse's and children's places;
- the other parts of the text (city, district, country).
If two candidates remain, ask (section 4).

## 4. Ask the user

Ask about every place that is still ambiguous, or that you cannot find:
- one question per place (or per group of spellings of the same place), with the people and the
  clues you used, your proposal first, the other candidates, and "leave without coordinates";
- never invent a location for a place you cannot identify: `{"skip": "unknown"}`.

## 5. coords.json

```json
{
  "Sé, Exemplo":           {"lat": 40.1234, "lon": -8.1234, "level": "parish", "basis": "Sé parish, Exemplo"},
  "Exemplo, Portugal":     {"lat": 40.1300, "lon": -8.1300, "level": "city",   "basis": "Exemplo (city)"},
  "Estado de Exemplo":     {"lat": -18.5,   "lon": -44.5,   "level": "region", "basis": "centre of the state"},
  "Portugal":              {"level": "country", "basis": "country only"},
  "Vila Inventada?":       {"skip": "user: unknown"}
}
```

The key is the place text exactly as it is in the tree. `apply_places.py` writes
`PLAC` → `MAP` → `LATI` (N/S) and `LONG` (E/W) for every use of that text.

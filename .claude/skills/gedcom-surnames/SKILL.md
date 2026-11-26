---
name: gedcom-surnames
description: Fix the surnames in a GEDCOM JSON tree (from a Quick Family Tree .ftz) so every person carries their birth (maiden) surname - expand abbreviations (after asking what they mean), move married names, nicknames and "Avó/Avô" out of the name, and infer missing surnames from parents, siblings and children using the Portuguese or Spanish naming convention. Use when the user wants to clean, fix, standardise or fill in surnames or names in their family tree.
---

# Surnames → birth surnames

Rules: [rules.md](rules.md). Read it fully before proposing any change.

All commands run from the repository root. `SK=.claude/skills/gedcom-surnames/scripts`.

## Workflow

1. **Get the JSON tree.** Prefer `NAME_processed.json` (after the `gedcom-notes` skill), because
   birth and baptism places decide the naming convention.
2. **Setup (rules section 0).** Run `python3 $SK/extract_names.py X.json --setup` and ask the user
   about every abbreviation, compound surname and Spanish-looking place it lists (AskUserQuestion).
   Save the answers as `X_names/config.json`. Never guess what an abbreviation means, and never
   write anything from the user's family into this skill.
3. **Clean (rules section 2).** `python3 $SK/extract_names.py X.json --next 4` applies the fixed cleaning rules and lists
   every remaining case (empty surnames, `?`, possible married names) family by family, oldest
   generation first, with parents, siblings and children.
4. **Infer (rules section 3-4).** For each listed person, propose a birth surname following the
   rules, with a confidence level and a one-line reason (the script prints its proposal for each
   open group; siblings with the same parents are one group). Answers go to
   `X_names/names_NNN.json` (rules section 6); re-run the script after each batch so the
   children's proposals use the parents' answers.
5. **Ask the user, one person at a time** (rules section 5): every inferred surname is a separate
   question with the proposal first, the alternatives, "leave empty", and room to type their own.
   Ask with the AskUserQuestion tool, up to 4 people per call, oldest generation first (an answer can
   change what the children are offered). Tell the user up front how many questions there are.
   Write only the answers given. **Certain** cleaning changes need only a summary.
6. **Apply.** `python3 $SK/apply_names.py X.json` writes the birth `NAME` first, then `married`/`aka` names and
   `NICK`, and saves the result to **new files** named after the input: `X.json` →
   `X_surnames.json` + `X_surnames.ged` (e.g. `FamilyTree_processed_surnames.json`).
   Every worked-out surname also adds `Apelido deduzido (não registado): … Base: ….` to the
   person's NOTE (rules section 5), so guessed surnames are always marked.
   The input tree is never modified. Original names are also kept as `aka`, so every change
   can be undone. The user's answers stay in the `names_NNN.json` files, so a run can be
   repeated or resumed without asking again.
7. **Report** counts per rule, every guess the user accepted, and the people still without a
   surname (and why).

These files contain personal family data. Keep them local (`*.json`, `*.ged` are gitignored).
Examples in this skill use invented names; keep it that way, because the repository is public.

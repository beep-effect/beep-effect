# Honest Repo Signal — Grill decisions

Architecture grill 2026-08-13 against `standards/ARCHITECTURE.md`,
`07-non-slice-families.md`, and `DECISIONS.md` 2026-06-21 (no placeholder
packages). Packet D1–D7 were already locked. This file is the second-round
frontier.

## 2026-08-13 — Yeet this PR, then stop

- **Question:** P1 is already in the tree. What is the next move in this clone?
- **Answer:** Yeet the honesty pass as-is. Stop. Do not stack MUI or schema-wall
  work on this branch.
- **Rationale:** D1 was one night. Housekeeping PR1 in the sibling clone is
  already ~346 files. Mixing walls violates the cap and the split.
- **Rejected:** Keep the branch open and pile the next easy win. Yeet plus a
  README Effect/Drizzle-bet paragraph (operator did not pick it).

## 2026-08-13 — Defer MUI

- **Question:** When do we cut MUI?
- **Answer:** Not now. Wait until housekeeping PR1 is on `main` and
  `professional-desktop` UX #675 settles.
- **Rationale:** 07 already says product-agnostic UI lives in
  `foundation/ui-system`. `@beep/ui` is already shadcn/Base UI. Live MUI use is
  a theme kernel plus ontology `RichTreeView`. That is a packet, not a night,
  and it would fight #675.
- **Rejected:** New goal immediately after yeet; start as soon as honesty
  publishes; leave MUI forever.

## 2026-08-13 — No clone coordination protocol

- **Question:** What does this clone do with VariantSchema / Model /
  EntitySchema while the sibling PR2 deletes them?
- **Answer:** Do not start that deletion in this packet. If both clones land
  overlapping work, resolve the conflict. First-lander wins.
- **Rationale:** Persist-stack deletion is their PR2 after baseline parity.
  This packet's job is honesty, not a third migration.
- **Rejected:** Wait-for-their-PR1 as a hard gate; delete TaggedErrorClass
  here; delete EntitySchema here in parallel.

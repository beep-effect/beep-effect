---
title: "db-admin aggregation becomes a generated projection of present slices"
date: 2026-11-17
lane: "feat/prunable-product-leaves"
reversal: "Restore the hand-written schema barrel and migration registry and revert the doctrine text and its DECISIONS.md entry."
---

Operator decision, 2026-11-17, a doctrine amendment. packages/_internal/db-admin stays the single migration aggregation home (standards/ARCHITECTURE.md, the db-admin paragraph of the non-slice families section; standards/architecture/07-non-slice-families.md, Internal Admin Packages). Its schema barrel (src/schema.ts) and migration registry become a generated projection of the slices present in the workspace, regenerated like tsconfig references, so removing a slice removes its tables and migrations from the aggregation without a hand edit. The amended doctrine text and its standards/architecture/DECISIONS.md entry land with seam 4's PR, not before.

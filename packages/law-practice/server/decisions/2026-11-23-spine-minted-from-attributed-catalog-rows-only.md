---
title: Family, docket and client spine nodes are minted from attributed catalog rows only, never from enrichment
date: 2026-11-23
reversal: Mint family nodes from the enrichment rows' `docket_families` column as well as from the attributed catalog rows.
governs:
  - src/PracticeKg.projections.ts#buildGraphRows
enforcedBy: []
---

Family, docket and client nodes come from the attributed catalog rows only. An anchor joins the spine through `files_as` only when its number resolves to exactly one keyed family; otherwise it hangs off the families that mention it.

Reason: the enrichment `docket_families` fan-out is mention-derived, prior-art citations included, and minting families from it produced the cartesian defect the first gauntlet surfaced.

Rejected: creating families from enrichment rows, and joining an anchor to every family that mentions its number.

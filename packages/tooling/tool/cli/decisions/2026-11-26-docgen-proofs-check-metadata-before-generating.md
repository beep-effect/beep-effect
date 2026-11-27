---
title: Both docgen proofs check JSDoc metadata from docgen config before generating
date: 2026-11-26
reversal: Drop the metadata check from runFullDocgen, or derive the checked packages from proof manifests.
governs:
  - src/commands/Docgen/internal/Local.ts#discoverFullMetadataCheckPackages
  - src/commands/Docgen/internal/Local.ts#runFullDocgen
enforcedBy: []
---

The scoped and the full proof both ratchet JSDoc metadata before they generate, over the packages whose docgen outDir is aggregated into docs/generated: every configured package in full mode, the planner's direct selections in scoped mode. A non-canonical outDir is skipped exactly as the aggregate step skips it.
Reason: a full proof that skips the check lets main merge metadata debt that only the next PR's scoped check pays for.
Rejected: reading proof manifests. They prove generation, not metadata, and generation alone let an unknown category merge on main.

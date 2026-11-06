---
title: "The catalog schema becomes v2 through an explicit migrate command"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Restore the backed-up catalog/history/<sha>.json over catalog/library.json; v1 still decodes"
---

accessClass, findings, derivations and modelRuns change the persisted contract. LibraryCatalog.schema accepts v1 and v2, and the new fields decode with defaults, so v1 files stay readable. beep research library migrate writes v2 only after a hash-equal index.md re-render. It backs up the pre-migration catalog under catalog/history/ and writes a LibraryMigrationReceipt. Whole-library migration stays separate from selected-source acquisition (October lesson).

---
title: Migration proofs run on the in-process PGlite driver with btree_gist registered
date: 2026-11-26
reversal: Return each proof to the gate-selected driver once the shared pglite-socket lane can load btree_gist.
governs:
  - test/integration/ArchitectureLabMigration.pglite.test.ts#makeMigrationProofLayer
  - test/integration/DocumentsSyncMigration.pglite.test.ts#makeMigrationProofLayer
  - test/integration/EpistemicEdgeMigration.pglite.test.ts#makeMigrationProofLayer
  - test/integration/ExecutionAuthorityLedgerMigration.pglite.test.ts#makeMigrationProofLayer
  - test/integration/LawPracticeCandorGateMigration.pglite.test.ts#makeMigrationProofLayer
  - test/integration/LawPracticeLegalPositionMigration.pglite.test.ts#makeMigrationProofLayer
enforcedBy: []
---

The drizzle folder runs `CREATE EXTENSION btree_gist` for the epistemic edge migration's gist exclusion constraint, and the shared external pglite-socket lane cannot load that extension. Every proof that applies the folder therefore builds a fresh in-process PGlite layer with the bundled extension registered.

Rejected: letting `makePgliteIntegrationGate` select the driver, which fails on the socket lane at the extension statement.

Accepted limit: an implicit-transaction PGlite host rolls the whole session chain back after a failed statement, so each proof's intentional failure runs last, and two denial probes take two fresh databases rather than one session.

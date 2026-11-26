---
title: "P6: MatterWall.two-matter.test.ts composes a PGlite graph store built by the test and fails rather than skips without it"
date: 2026-11-24
lane: "p6"
reversal: "Drop the PGlite graph store from the test layer and assert path 3 only on the DuckDB matter store tools"
---

Independent review of the P6 design. The Practice KG graph tools query PGlite, not DuckDB: the handler layer requires SqlClient (server/src/PracticeKg.tool-handlers.ts:381-391) and kg_clients, kg_docket_family, kg_application_lookup, kg_find, kg_candidate_claims and kg_provenance go through queryPglite (:397,402-415,421,505,637); the graph store is kg.pglite (PracticeKgHost/PracticeKgHost.selfCheck.ts:220). A test without PGlite either fails to compose or sees the NotLoaded result of kg_candidate_claims (:496-503), which makes 'B rows absent' true with no wall. The test therefore composes a PGlite graph store built by the test through Pglite.makeLayer in a scoped temporary directory, as server/test/PracticeKg.projections.test.ts:850,868 already does in the unit shard, and asserts that kg_candidate_claims returned the loaded result type before asserting that B rows are absent. The worry of 2026-11-24-p6-the-two-matter-test-runs-in-the-unit-shard-without-pglite was a gated skip; the file fails, never skips, when PGlite is absent. That decision is amended: what remains of it is that the PGlite repositories CandorRecord and LegalPositionRecord are not composed and that the file runs in the unit shard. Answers A15 and F14 as amended.

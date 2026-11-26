---
title: "P6: MatterWall.two-matter.test.ts composes no PGlite repositories and runs in the server unit shard"
date: 2026-11-24
lane: "p6"
reversal: "Add the PGlite repositories to the test layer and move the file to the integration shard, amending server/vitest.shards.json"
---

2026-11-19-p0-item11-matter-wall-test-shape lists PGlite repositories in the widened server test layer. The only repositories in law-practice server are CandorRecord and LegalPositionRecord, which filter by orgId (CandorRecord.repo.ts:99-109, LegalPositionRecord.repo.ts:107-138): tenant isolation, outside the seven matter paths. Composing them would add PGlite to the test without exercising a path, and a gated skip on a host without PGlite would let the exit go green without running. This amends the P0 layer list: the test composes LawPracticeServerLive widened with the Practice KG host over MemoryFileSystem and an in-memory DuckDB bundle, the citation engine, the notice mailbox over the fake mailbox, MatterAuthorityLive over a test config and a test LawPrincipal. Fixture: the synthetic office-action text captured under two scope references bound to matters A and B; principal pA staffed on A, pAB on both; one it.layer case per path. The file joins server/vitest.shards.json in the unit shard and is reweighted with bun run beep ci partitions rebalance --write --run <id> after the first hosted run. Answers A15 and F14.

Amended after independent review by decision `2026-11-24-p6-the-two-matter-test-builds-an-in-memory-pglite-graph-store`. The Practice KG graph tools query PGlite, so the test composes a PGlite graph store built by the test and fails, never skips, without it; the notice mailbox is no longer composed (path 6 is a structural proof). What stands from this decision: the PGlite repositories `CandorRecord` and `LegalPositionRecord` are not composed, `orgId` isolation is outside the seven paths, and the file runs in the server unit shard.

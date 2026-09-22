# @beep/epistemic-tables — four-lens audit

4 files; 16 rows; 0 review items; 16 coverage-only rows. Severity: 16 info. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

All four files test local metadata, schema transformations and row converters. Drizzle getColumns/getTableConfig describe PostgreSQL column types, nullability, indexes and exported identities; they do not execute SQL or enforce a migration. Receipt uniqueness is expressly delegated to the raw migration, and the test only excludes an incorrect metadata index. No PGlite, PostgreSQL, filesystem or container is acquired. MemoryFileSystem would not improve these pure tests, and replacing future SQL backstops with metadata tests would change the subject.

Contradiction rows include valid-seal controls, per-seal mutations, reversed pair rejection, candidate/organization/time relationships and supersession-chain checks. EvidenceVerification binds evidence identity, source identity, quote and manifestation seal with positive and independent negative controls. The properties retain fcRuns(25) and UsageRecord retains fcRuns(50). All Result/Option migration candidates must preserve polarity and labeled cases, not collapse typed failure into success.

EpistemicTables pins complete columns and both open/closed bitemporal representations. Its legacy Evidence read normalization intentionally differs from strict write validation; long legacy quotes remain readable but cannot be rewritten under the current bound. Those compatibility assertions must not be weakened to make the schemas identical. Existing complexity comments are immutable historical source, not new lane waivers.

ExecutionRecord tests pin exact column sets before excluding payload-capable column types, so the exclusion loops are not empty-table false positives. The selected outcome helper fills decisionVerdict with allowed because the physical column defaults to allowed; the insert converter omits the domain-absent field and the read converter removes it. That is legitimate database-default emulation, not a hidden missing production write bug. These tests still do not prove actual default/check/foreign-key execution. No additional judgment defect beyond mechanical candidates was established; all sixteen file/lens explanations are retained.

## Findings

No additional judgment findings beyond mechanical candidates. Full file-specific explanations are retained in the four JSONL files.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 39 passed registrations; reporter 5136.937500ms; whole command 5.515672s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

0 mapped historical observations across 0 jobs. Zero mapped observations does not mean no historical failures. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal classification was performed.

## Top files

- `packages/epistemic/tables/test/ContradictionTables.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/tables/test/EpistemicTables.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/tables/test/EvidenceVerificationTables.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/tables/test/ExecutionRecordTables.test.ts`: 4 rows, 0 review items.

## P2 ordering and uncertainty

Only after explicit authorization: Preserve exact column/index and converter oracles, independent seal mutations, strict writes versus compatible legacy reads, and 25/50-run property floors. No extra human defect was established; metadata tests do not replace SQL enforcement proof. Preserve every existing assertion, operand and replay seed. No timeout increase, retry or provider acquisition is justified by this audit.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

# @beep/ai-sync: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

2 files; 1 review items and 7 coverage rows. Severity counts: info 7, minor 1.


## Top files by row count

- `packages/tooling/library/ai-sync/test/AiSync.equivalence.test.ts`: 4 rows; fully read 1–20 (test).
- `packages/tooling/library/ai-sync/test/ai-sync.test.ts`: 4 rows; fully read 1–749 (test).

## Layer topology and native boundaries

One NodeServices block supplies FileSystem/Path. Three withTempDirectory calls acquire/release unique directories. Synthetic validation reads use the FileSystem interface (validation.ts:333-348), so fresh MemoryFileSystem fixtures are a candidate. checkGeneratedArtifacts reads committed package artifacts (drift.ts:28-33,89-114); cache-input and checked-in permission tests read the actual checkout. Those assertions must remain native. HTTP drift is injected, not network traffic. No measured layer-build cost is available.

## Findings

- `L-RES-04` minor, `packages/tooling/library/ai-sync/test/ai-sync.test.ts:138–159`: Synthetic config tests use FileSystem only; checked-in artifact and policy tests intentionally read real repository files. After D14 wrapper migration, use fresh subject-local MemoryFileSystem fixtures only for synthetic config validation; preserve real checked-in generated/policy/cache assertions on native FileSystem. Keep exact read-count/order assertions and cleanup.

## Timing and history

Retained Node command: 16 registrations, {'passed': 16}, exit 0; whole command 4.976657s; reporter span 4623.748ms. Source head `662823dd960367046ba7d73dd8fd25d15782865a`; raw reporter SHA256 `354a7f91926086626cf3050bdbd2e18e875d64858ba99dc6efb4e51d8dc1bb23`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Command: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. No new execution.

Slowest reported files:

- `packages/tooling/library/ai-sync/test/ai-sync.test.ts`: 88.748ms, 15 tests.
- `packages/tooling/library/ai-sync/test/AiSync.equivalence.test.ts`: 1.205ms, 1 tests.

Hosted history: 3 observation rows across 1 jobs; categories {'coverage-ratchet': 3}.
- https://github.com/beep-effect/beep-effect/actions/runs/33746737220/job/100621131987 — head `011c166ba736d8817400bf013b0f5fac598f4d14`, 2026-09-03T10:53:39Z.

Historical observations are not unique flakes or current-source failures. AI-sync coverage-ratchet rows are not failing test assertions. ACP historical assertion labels alone do not establish present cause; the known Node24 escaped-key environment issue is distinct from this accepted Node22 cohort. No source comparison to historical heads or rerun was performed. Across the campaign, 527 failed runs include 21 unavailable logs and one unresolved cause. Zero mapped jobs does not establish no failures.

## P2 ordering and limits

Scope and native-boundary decisions first; preserve each resource finalizer and mutable fixture. Then resolve assertion-family candidates without changing operands or polarity; migrate property registration retaining every run floor/seed and generator; investigate any actual flake evidence; finally adopt accepted instrumentation with safe logs. P2 is not authorized by this audit.

A passing configured Node command is not race freedom, coverage or full package proof. All 139 first attempts comprise 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser tests were absent from its Node cohort, not skipped. Effect-drizzle failed Bun.sqlite collection; CIops and QA-capture failed cohorts retain their original limitations. No substituted driver, timing or provider operation is proposed. rc113 adapter remains paired with Vitest4.1.11 outside its declared Vitest5 peer range; exercised compatibility is evidence-bound.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

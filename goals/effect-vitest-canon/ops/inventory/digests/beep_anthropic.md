# @beep/anthropic: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 0 review items and 12 coverage rows. Severity counts: info 12.


## Top files by row count

- `packages/drivers/anthropic/test/Anthropic.equivalence.test.ts`: 4 rows; fully read 1–16 (test).
- `packages/drivers/anthropic/test/Anthropic.repair.test.ts`: 4 rows; fully read 1–96 (test).
- `packages/drivers/anthropic/test/Anthropic.test.ts`: 4 rows; fully read 1–110 (test).

## Layer topology and native boundaries

No provider layer is built. The construction test only checks lazy layer/plan values are defined. Repair helpers consume finite synthetic streams. No HTTP, credential or live retry execution is demonstrated; no MemoryFileSystem demand or layer-build saving is established.

## Findings

No additional actionable judgment beyond the retained mechanical candidates. Every NONE explanation is file-specific in the lens JSONL.

## Timing and history

Retained Node command: 9 registrations, {'passed': 9}, exit 0; whole command 6.118133s; reporter span 5751.050ms. Source head `662823dd960367046ba7d73dd8fd25d15782865a`; raw reporter SHA256 `ac3ead4532c751c0ad532fd20a825e2288d28ac1b2e147ff3d19375397172281`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Command: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. No new execution.

Slowest reported files:

- `packages/drivers/anthropic/test/Anthropic.repair.test.ts`: 12.893ms, 4 tests.
- `packages/drivers/anthropic/test/Anthropic.test.ts`: 12.050ms, 4 tests.
- `packages/drivers/anthropic/test/Anthropic.equivalence.test.ts`: 0.967ms, 1 tests.

Hosted history: 0 observation rows across 0 jobs; categories {}.

Historical observations are not unique flakes or current-source failures. AI-sync coverage-ratchet rows are not failing test assertions. ACP historical assertion labels alone do not establish present cause; the known Node24 escaped-key environment issue is distinct from this accepted Node22 cohort. No source comparison to historical heads or rerun was performed. Across the campaign, 527 failed runs include 21 unavailable logs and one unresolved cause. Zero mapped jobs does not establish no failures.

## P2 ordering and limits

Scope and native-boundary decisions first; preserve each resource finalizer and mutable fixture. Then resolve assertion-family candidates without changing operands or polarity; migrate property registration retaining every run floor/seed and generator; investigate any actual flake evidence; finally adopt accepted instrumentation with safe logs. P2 is not authorized by this audit.

A passing configured Node command is not race freedom, coverage or full package proof. All 139 first attempts comprise 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser tests were absent from its Node cohort, not skipped. Effect-drizzle failed Bun.sqlite collection; CIops and QA-capture failed cohorts retain their original limitations. No substituted driver, timing or provider operation is proposed. rc113 adapter remains paired with Vitest4.1.11 outside its declared Vitest5 peer range; exercised compatibility is evidence-bound.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

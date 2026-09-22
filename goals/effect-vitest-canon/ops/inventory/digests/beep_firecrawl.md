# @beep/firecrawl: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 1 review items and 11 coverage rows. Severity counts: info 11, minor 1.


## Top files by human row count

- `packages/drivers/firecrawl/test/Firecrawl.equivalence.test.ts`: 4 rows; full read 1–16 (test).
- `packages/drivers/firecrawl/test/Firecrawl.service.test.ts`: 4 rows; full read 1–544 (test).
- `packages/drivers/firecrawl/test/integration/Firecrawl.live.test.ts`: 4 rows; full read 1–51 (test).

## Layer topology and native boundaries

Five unit blocks wrap pure makeLayerFromClient values (Firecrawl.service.ts:803-804); variants do not open remote connections. Two separate fake watcher instances each belong to one test. Production registers listeners before watcher.start and removes all listeners/closes in acquireRelease (385-456). Existing tests assert closure after done and malformed terminal output, not cancellation-before-done. Optional live branch builds an SDK layer with a 30-second hook timeout; no provider operation was run in this audit. No filesystem or measured expensive rebuild applies.

## Findings

- `L-PROP-01` minor, `packages/drivers/firecrawl/test/integration/Firecrawl.live.test.ts:7–13`: Gate claims blank/unresolved keys are absent, but it neither trims whitespace nor recognizes a leading-space op reference. In P2 characterize the gate with synthetic absent, empty, whitespace and unresolved-reference strings, preserving legitimate keys and all live assertions. Normalize classification without reading secrets or invoking the provider; preserve the two credentialed registrations and current unauthenticated guard.

## Retained timing and history

14 registrations, statuses {'passed': 14}, exit 0; whole command 7.421517s; reporter span 6960.794ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `44e88e3d632f56ee4c32e91dbfe2180bd5662ac10b14148b9c5b6d49f1e81a79`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/firecrawl/test/Firecrawl.service.test.ts`: 57.794ms, 12 tests.
- `packages/drivers/firecrawl/test/Firecrawl.equivalence.test.ts`: 1.431ms, 1 tests.
- `packages/drivers/firecrawl/test/integration/Firecrawl.live.test.ts`: 0.894ms, 1 tests.

Hosted history: 1 mapped observation rows across 1 jobs; categories {'assertion-or-property-failure': 1}.
- https://github.com/beep-effect/beep-effect/actions/runs/34393769103/job/102608445414 — head `30f8e682f2bb5c65293a84e3dd6da7649c627054`, 2026-09-09T19:13:25Z.

The retained exact historical row names `Firecrawl.service.test.ts` / “round-trips crispened schema invariants through derived arbitraries”, with “AssertionError: expected false to be true” at log lines 1154–1155. No counterexample/schema identity appears in this excerpt. It predates the current rc113 cohort; no historical source comparison or reproduction establishes a present defect or flake. The one live-file registration in the Node baseline corresponds to the absent-key guard branch, not the two authenticated API cases.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

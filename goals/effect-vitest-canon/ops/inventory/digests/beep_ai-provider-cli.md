# @beep/ai-provider-cli: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 0 review items and 12 coverage rows. Severity counts: info 12.


## Top files by row count

- `packages/drivers/ai-provider-cli/test/AiProviderCli.service.test.ts`: 4 rows; fully read 1–177 (test).
- `packages/drivers/ai-provider-cli/test/AiProviderCli.snapshot.test.ts`: 4 rows; fully read 1–299 (test).
- `packages/drivers/ai-provider-cli/test/AiProviderCliHome.equivalence.test.ts`: 4 rows; fully read 1–50 (test).

## Layer topology and native boundaries

One shared makeLayerFromRunner block wraps a pure Layer.succeed service (AiProviderCli.service.ts:381-385). Snapshot wrappers rebuild mostly pure runner stubs; one effectful makeLayer captures an injected failing spawner (340-350), merged with a test-local logger. Capture Refs and log arrays must not become shared mutable state during D14 wrapper removal. No real authentication CLI or home filesystem is accessed; only homedir path semantics are native. No expensive acquisition or measurable layer-build saving is established.

## Findings

No additional actionable judgment beyond the retained mechanical candidates. Every NONE explanation is file-specific in the lens JSONL.

## Timing and history

Retained Node command: 18 registrations, {'passed': 18}, exit 0; whole command 4.422123s; reporter span 4041.566ms. Source head `662823dd960367046ba7d73dd8fd25d15782865a`; raw reporter SHA256 `3a0d4c09c529fcb571ef7c9d923ab04fd6e7301c9bb1b4515fec560d1bc98cda`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Command: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. No new execution.

Slowest reported files:

- `packages/drivers/ai-provider-cli/test/AiProviderCli.service.test.ts`: 15.566ms, 3 tests.
- `packages/drivers/ai-provider-cli/test/AiProviderCli.snapshot.test.ts`: 15.550ms, 13 tests.
- `packages/drivers/ai-provider-cli/test/AiProviderCliHome.equivalence.test.ts`: 1.229ms, 2 tests.

Hosted history: 0 observation rows across 0 jobs; categories {}.

Historical observations are not unique flakes or current-source failures. AI-sync coverage-ratchet rows are not failing test assertions. ACP historical assertion labels alone do not establish present cause; the known Node24 escaped-key environment issue is distinct from this accepted Node22 cohort. No source comparison to historical heads or rerun was performed. Across the campaign, 527 failed runs include 21 unavailable logs and one unresolved cause. Zero mapped jobs does not establish no failures.

## P2 ordering and limits

Scope and native-boundary decisions first; preserve each resource finalizer and mutable fixture. Then resolve assertion-family candidates without changing operands or polarity; migrate property registration retaining every run floor/seed and generator; investigate any actual flake evidence; finally adopt accepted instrumentation with safe logs. P2 is not authorized by this audit.

A passing configured Node command is not race freedom, coverage or full package proof. All 139 first attempts comprise 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser tests were absent from its Node cohort, not skipped. Effect-drizzle failed Bun.sqlite collection; CIops and QA-capture failed cohorts retain their original limitations. No substituted driver, timing or provider operation is proposed. rc113 adapter remains paired with Vitest4.1.11 outside its declared Vitest5 peer range; exercised compatibility is evidence-bound.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

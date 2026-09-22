# @beep/openai: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 0 review items and 12 coverage rows. Severity counts: info 12.


## Top files by human row count

- `packages/drivers/openai/test/OpenAi.equivalence.test.ts`: 4 rows; full read 1–27 (test).
- `packages/drivers/openai/test/OpenAi.service.test.ts`: 4 rows; full read 1–248 (test).
- `packages/drivers/openai/test/OpenAi.test.ts`: 4 rows; full read 1–78 (test).

## Layer topology and native boundaries

Model service tests build per-test embedding/language/config layers through the existing scoped wrapper. Stub HttpClient captures are local, preserving parallel isolation. Metadata-only live layers resolve synthetic config and FetchHttpClient but never invoke remote models. OpenAiLive reads Config.Redacted at acquisition (OpenAi.service.ts:40-47). The missing-key failure is intentionally observed inside the body; moving that failing layer into an outer hook would lose the assertion. D14 migration must retain this acquisition subject under a safe parent context. Option/equivalence files allocate no resources. No native filesystem demand or measured rebuild cost.

## Findings

No additional actionable judgment beyond existing mechanical candidates. File-specific NONE rows retain the source evidence and limitations.

## Retained timing and history

12 registrations, statuses {'passed': 12}, exit 0; whole command 7.073791s; reporter span 6646.695ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `d86d380ff5458a904d223217ce03b987aa2668f5f6e613ecd9ab2ceff2839906`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/openai/test/OpenAi.service.test.ts`: 31.695ms, 6 tests.
- `packages/drivers/openai/test/OpenAi.test.ts`: 15.523ms, 4 tests.
- `packages/drivers/openai/test/OpenAi.equivalence.test.ts`: 2.156ms, 2 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

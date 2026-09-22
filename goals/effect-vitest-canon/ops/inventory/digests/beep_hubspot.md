# @beep/hubspot: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

2 files; 1 review items and 7 coverage rows. Severity counts: info 7, major 1.


## Top files by human row count

- `packages/drivers/hubspot/test/HubSpot.equivalence.test.ts`: 4 rows; full read 1–24 (test).
- `packages/drivers/hubspot/test/HubSpot.service.test.ts`: 4 rows; full read 1–361 (test).

## Layer topology and native boundaries

One TestLayer shares a capturesRef and mutable respondRef across four cases. Package config inherits globally concurrent sequence from vitest.shared.ts:207-209; rc113 anonymous layer caches a single context and does not force serial execution (internal.ts:264-343). Three cases replace the response callback, while request handling reads it later. Thus one test can see another response/capture without a production defect. Fresh blocks or stateless request-specific routing are the meaningful isolation remedy. No real HTTP, files or database; no measured rebuild cost.

## Findings

- `L-RES-03` major, `packages/drivers/hubspot/test/HubSpot.service.test.ts:262–359`: Four concurrent tests share respondRef and captures; three overwrite the response handler used by other in-flight requests. Use separate fresh layer blocks or request-local stateless routes for each response scenario. Keep all four tests, exact request/auth captures, 401/429 status/error payloads and URL assertions. Do not serialize globally or weaken expectations to tolerate another case response.

## Retained timing and history

8 registrations, statuses {'passed': 8}, exit 0; whole command 7.573328s; reporter span 7118.659ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `3535ce8cce28630e34f6d24c70b96ca62c7c4d499b496db2e74cf5751003f123`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/hubspot/test/HubSpot.service.test.ts`: 64.659ms, 6 tests.
- `packages/drivers/hubspot/test/HubSpot.equivalence.test.ts`: 1.616ms, 2 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

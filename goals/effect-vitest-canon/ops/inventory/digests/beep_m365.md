# @beep/m365: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

2 files; 1 review items and 7 coverage rows. Severity counts: info 7, minor 1.


## Top files by human row count

- `packages/drivers/m365/test/M365.service.test.ts`: 4 rows; full read 1–735 (test).
- `packages/drivers/m365/test/integration/M365.live.test.ts`: 4 rows; full read 1–85 (test).

## Layer topology and native boundaries

Nine separate unit layer blocks create fresh M365TestHttp capture/response Refs; static auth avoids real token cache. Each block holds one test. Retry-default case uses forkChild, TestClock.adjust(1s) and Fiber.join; production delay is Effect.sleep (M365.service.ts:887-914). Separate retry layers prevent cross-test clock state. Live branch uses actual Graph/auth/cache and a 60-second hook budget when all required settings exist. Native auth/token-cache semantics must remain when that runner is authorized; no external calls here and no quantified acquisition cost.

## Findings

- `L-OBS-01` minor, `packages/drivers/m365/test/integration/M365.live.test.ts:61–81`: Three awaited live stages share one test with no safe last-completed phase annotation for list, download or message-read failures. After scope/assertion work adopt accepted instrumentation with safe operation-only list/download/message phase labels. Preserve both download variants, hook/body budgets and every assertion. Never log credential values, token-cache contents or real document/message payloads.

## Retained timing and history

12 registrations, statuses {'passed': 12}, exit 0; whole command 7.171171s; reporter span 6683.176ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `829583a3e3535209fcd8a89100bff19b33a08718405eee7126a48004621aa4d4`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/m365/test/M365.service.test.ts`: 84.176ms, 11 tests.
- `packages/drivers/m365/test/integration/M365.live.test.ts`: 1.243ms, 1 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

The one live-file registration alone cannot prove authenticated Graph execution: both the absent-settings guard and the live branch contain one case. No credential values or active environment were inspected.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

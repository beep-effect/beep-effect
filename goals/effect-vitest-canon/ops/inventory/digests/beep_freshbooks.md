# @beep/freshbooks: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

2 files; 1 review items and 7 coverage rows. Severity counts: info 7, major 1.


## Top files by human row count

- `packages/drivers/freshbooks/test/Freshbooks.service.test.ts`: 4 rows; full read 1–291 (test).
- `packages/drivers/freshbooks/test/Freshbooks.token.test.ts`: 4 rows; full read 1–280 (test).

## Layer topology and native boundaries

Read-service block shares an append-only capture Ref, in-memory token store and stateless route; current cases look up distinct URLs. Token file has four layer blocks: interrupted persistence, three shared expired-token cases, empty store, and explicit fresh-token refresh. Production memory store allocates a Ref (Freshbooks.token.ts:196-211), auth allocates a Semaphore and reads that shared store (340-413). The middle block sharing can pre-warm the 25-demand proof. Keep independent test initial state; do not globally serialize the suite. Cancellation gates correctly release in ensuring. No HTTP server, database or secret acquisition occurs; no quantified build cost.

## Findings

- `L-RES-03` major, `packages/drivers/freshbooks/test/Freshbooks.token.test.ts:173–234`: Three cases share one expired-token AuthLayer and TokenServer, so sibling accessToken calls can rotate the token before the 25-fiber demand. Give the 25-demand serialization case its own fresh AuthLayer/TokenServer, separate from persistence and reuse cases. Keep 25 simultaneous fibers, exact one-refresh/access-token assertions, TestClock expiry and cancellation gates. Do not reset shared state while siblings run.

## Retained timing and history

12 registrations, statuses {'passed': 12}, exit 0; whole command 7.270276s; reporter span 6855.631ms. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Head `662823dd960367046ba7d73dd8fd25d15782865a`; reporter SHA256 `1855cbb3b66b8e2d640b328b05bd5bfd319d74ef3f7d32804efccaf17316fbfb`. Exact command shape: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Root accepted that configured Node cohort, not a new proof from this audit.

Slowest reported files:

- `packages/drivers/freshbooks/test/Freshbooks.token.test.ts`: 14.631ms, 6 tests.
- `packages/drivers/freshbooks/test/Freshbooks.service.test.ts`: 14.390ms, 6 tests.

Hosted history: 0 mapped observation rows across 0 jobs; categories {}.

## P2 order and uncertainty

Scope/isolation and native boundaries first; assertion-family corrections next, preserving payload/cause, operand, polarity and every count. Then native property registration retaining current fcRuns floors (20/25/50 where present), seeds, generators and invalid-boundary cases; flake work only with supported causes; safe observability last. Do not transfer old exceptions or replace a native subject to make a test green. All proposal statuses remain open; P2 remains gated.

Campaign timing facts remain 139 attempts, 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser file was absent, not skipped. The failed effect-drizzle Bun.sqlite collection remains a failed Node cohort; no substituted driver or fabricated timing. Hosted 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Zero mapped history is not proof of no failures. A passing configured run proves neither race freedom nor coverage/full package verification. rc113 adapter with Vitest4.1.11 remains outside its declared Vitest5 peer range; compatibility is receipt-bound. No package tests, services or benchmarks were run here.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

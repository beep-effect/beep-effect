# @beep/acp: four-lens source inventory

| Lens | Rows |
|---|---:|
| resource | 6 |
| flake | 6 |
| property | 6 |
| observability | 6 |

6 files; 5 review items and 19 coverage rows. Severity counts: info 19, major 2, minor 3.


## Top files by row count

- `packages/drivers/acp/test/Acp.equivalence.test.ts`: 4 rows; fully read 1–20 (test).
- `packages/drivers/acp/test/agent.test.ts`: 4 rows; fully read 1–258 (test).
- `packages/drivers/acp/test/fixtures/acp-mock-peer.ts`: 4 rows; fully read 1–155 (support).
- `packages/drivers/acp/test/helpers.ts`: 4 rows; fully read 1–89 (support).
- `packages/drivers/acp/test/integration/client.integration.test.ts`: 4 rows; fully read 1–430 (test).
- `packages/drivers/acp/test/protocol.test.ts`: 4 rows; fully read 1–626 (test).

## Layer topology and native boundaries

Two NodeServices blocks share platform services. Agent tests build two separate agent layers; four integration cases build separate client layers and the fifth creates a client under an explicit scope. ACP production starts scoped RPC server fibers (AcpAgent.service.ts:400-405; AcpClient.service.ts:544-549) and keeps mutable handlers per client. Scope registration must precede setup and cover failure. NodeServices reuse does not eliminate the six real Bun child launches (four client and two protocol scenarios). Preserve process/stdin/stdout/exit-code subjects; MemoryFileSystem is not a substitute. No measured per-layer build cost is available.

## Findings

- `L-RES-02` major, `packages/drivers/acp/test/agent.test.ts:63–64`: Standalone scopes are built before their close finalizers are installed. Attach scope ownership before building the agent layer, preserving isolated queues/handlers and existing cleanup. Resolve D14 layer migration without sharing mutable agent registrations across tests.
- `L-OBS-01` minor, `packages/drivers/acp/test/agent.test.ts:94–185`: Permission/output and cancellation waits have no phase log identifying the last completed handshake. After scope and assertion work, use accepted instrumented tester and safe phase labels before outbound permission/read and cancellation waits. Preserve Queue/Deferred ordering, names, deadline and every payload assertion.
- `L-RES-02` major, `packages/drivers/acp/test/integration/client.integration.test.ts:364–427`: The distinct-id case closes its manually supplied client scope only after all assertions succeed. Use a test-owned child scope or acquireRelease before AcpClient.make, so assertion failure/interruption closes RPC fibers. Preserve both request IDs, replies, join assertions and intentional per-test isolation.
- `L-OBS-01` minor, `packages/drivers/acp/test/integration/client.integration.test.ts:100–126`: Initialize, permission, prompt and stream waits lack last-completed-phase diagnostics. Record safe initialize/prompt/notification phase labels through the accepted tester. Keep Bun subprocess, inherited stderr, all protocol assertions and budgets; never log credentials or complete protocol payloads.
- `L-OBS-01` minor, `packages/drivers/acp/test/protocol.test.ts:508–528`: Child termination and first-message waits do not record which boundary completed before a hang. Record spawn/first-protocol-message/termination phases with the accepted instrumented tester. Preserve exit 7 and malformed exit 23, all cause assertions and native child scope; no retry or timeout change.

## Timing and history

Retained Node command: 22 registrations, {'passed': 22}, exit 0; whole command 5.866664s; reporter span 5455.482ms. Source head `662823dd960367046ba7d73dd8fd25d15782865a`; raw reporter SHA256 `4a7db5c81989f784b377c30c183cc99fe9e4292f8366c5b9fa31af6036bf1ef3`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Command: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. No new execution.

Slowest reported files:

- `packages/drivers/acp/test/protocol.test.ts`: 967.482ms, 12 tests.
- `packages/drivers/acp/test/integration/client.integration.test.ts`: 960.015ms, 5 tests.
- `packages/drivers/acp/test/agent.test.ts`: 40.500ms, 4 tests.
- `packages/drivers/acp/test/Acp.equivalence.test.ts`: 1.145ms, 1 tests.

Hosted history: 3 observation rows across 3 jobs; categories {'assertion-or-property-failure': 3}.
- https://github.com/beep-effect/beep-effect/actions/runs/34393769103/job/102608445481 — head `30f8e682f2bb5c65293a84e3dd6da7649c627054`, 2026-09-09T19:13:25Z.
- https://github.com/beep-effect/beep-effect/actions/runs/34403442214/job/102640731217 — head `7e41ac03ed88681850a4cda0a44ef221d6b68efe`, 2026-09-09T20:50:23Z.
- https://github.com/beep-effect/beep-effect/actions/runs/34416715253/job/102683195474 — head `5213fdf9af28875b766426f2b3c470d14d154fc6`, 2026-09-09T23:23:29Z.

Historical observations are not unique flakes or current-source failures. AI-sync coverage-ratchet rows are not failing test assertions. ACP historical assertion labels alone do not establish present cause; the known Node24 escaped-key environment issue is distinct from this accepted Node22 cohort. No source comparison to historical heads or rerun was performed. Across the campaign, 527 failed runs include 21 unavailable logs and one unresolved cause. Zero mapped jobs does not establish no failures.

## P2 ordering and limits

Scope and native-boundary decisions first; preserve each resource finalizer and mutable fixture. Then resolve assertion-family candidates without changing operands or polarity; migrate property registration retaining every run floor/seed and generator; investigate any actual flake evidence; finally adopt accepted instrumentation with safe logs. P2 is not authorized by this audit.

A passing configured Node command is not race freedom, coverage or full package proof. All 139 first attempts comprise 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d browser tests were absent from its Node cohort, not skipped. Effect-drizzle failed Bun.sqlite collection; CIops and QA-capture failed cohorts retain their original limitations. No substituted driver, timing or provider operation is proposed. rc113 adapter remains paired with Vitest4.1.11 outside its declared Vitest5 peer range; exercised compatibility is evidence-bound.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

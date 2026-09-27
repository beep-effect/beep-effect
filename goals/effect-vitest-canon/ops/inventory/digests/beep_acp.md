# @beep/acp: reconciled six-path inventory

D12 completed through scope, assertions, property registration, test ordering and observability. The admitted membership remains four registered test files and two support files. The newer `test/json.test.ts` is a deferred remainder: configured package proofs include it, but this six-path review does not claim to have audited it.

## Ledger reconciliation

| On-disk family | Rows | Fixed | Open no-findings | Exceptions |
|---|---:|---:|---:|---:|
| detector | 31 | 29 | 0 | 2 |
| resource | 6 | 2 | 4 | 0 |
| property | 6 | 0 | 6 | 0 |
| flake | 6 | 1 | 5 | 0 |
| observability | 6 | 3 | 3 | 0 |
| Total | 55 | 35 | 18 | 2 |

These are file-location counts; some detector rows have `lens: resource`. The frozen detector ledger had 22 rows, while the inherited root baseline had 24. Their union contained 32 IDs: 18 historical EV001 anchors for 12 runtime sites, 6 EV002, 5 EV014 and 3 historical EV010 anchors. Preserve all 29 fixed historical IDs; retire the old native anchors in favor of the final detector's 2 current EV010 occurrences. This accounts for 31 detector rows without treating shifted historical anchors as additional runtime calls.

The prior `L-FLAKE-NONE:packages/drivers/acp/test/protocol.test.ts:1` coverage row is superseded by concrete `L-FLAKE-02:packages/drivers/acp/test/protocol.test.ts:662`. Its original evidence was “Deferred/Queue synchronization replaces time polling; real child exit and parse failure must remain native.” The private reconciliation receipt preserves the complete original row. The new fixed row records a source-demonstrated missing ordering edge with bounded confidence; no production failure or pre-edit flaky execution was reproduced. All remaining no-finding rows stay open and receive no fabricated fix credit.

## Current admitted census

| File | Kind | Lines | Bytes |
|---|---|---:|---:|
| `packages/drivers/acp/test/Acp.equivalence.test.ts` | test | 21 | 1054 |
| `packages/drivers/acp/test/agent.test.ts` | test | 281 | 11810 |
| `packages/drivers/acp/test/fixtures/acp-mock-peer.ts` | support | 155 | 4015 |
| `packages/drivers/acp/test/helpers.ts` | support | 89 | 3236 |
| `packages/drivers/acp/test/integration/client.integration.test.ts` | test | 436 | 16621 |
| `packages/drivers/acp/test/protocol.test.ts` | test | 995 | 38412 |

Only these six existing census byte/line fields were refreshed. Frozen provenance and unrelated census objects remain intact. Private source hashes and raw-block preservation receipts accompany strict validation; no seventh entry was added.

## Completed phases and preserved subjects

- Scope `dfbff4de5eb6c16761b097a041a7e488763d3e23`: each agent case owns a fresh single-case harness layer exposing the same transport queues; four native integration cases retain public AcpClient.layerChildProcess with isolated handles. Direct AcpClient.make remains the distinct-ID constructor subject under test-owned scope. Explicit 10-second hook caps preserve ordinary limits; the existing explicit 30-second hook and all body deadlines remain unchanged.
- Assertions `78e89e2cec5960712c4c516d662ef60da5dc1803`: specialized Option checks retain exact 7/7/0 values; schema equivalence retains the same predicate. Full message/Cause/ID and payload assertions remain intact.
- Properties `5613080599522433e039e92b3d6e023c02ad7e77`: two native effect-property registrations replace 12 runSync calls with identical codec operations and reencoded-string comparisons. Original inputs, cause filters and `fcRuns(25)` remain; the separate four-input synchronous property is unchanged.
- Test ordering `971456d4f296621d83dda76b4f96fa8600e21309`: malformed-output callback completes a Deferred after incrementing its counter; the test awaits it before the original count 1 assertion, observes native exit 23 and checks count 1 again. No sleep/retry or deadline increase. The shared reference parser remains unchanged: current complete string frames leave no residual buffer and never populate its batch map.
- Observability `237412d589859ae72bf36e6318b8636fe88d8580`: four admitted test files use public @beep/test-runner; static Info-level phase/state events identify handshake and termination boundaries. Parent positive controls passed, negative controls failed as intended and temporary probes were restored exactly. The earlier Debug-level events were filtered at the Info threshold and were corrected before this commit. No protocol payloads or credentials are logged.

Two current native exceptions remain: `integration/client.integration.test.ts:5` and `protocol.test.ts:12`, the NodeServices imports. Actual Bun child creation, stdin/stdout, native exits 7/23 and EOF 0 are test subjects. MemoryFileSystem cannot substitute for them. Peer NodeRuntime.runMain/scoped layer construction is an intentional standalone runtime boundary; helper stream adaptation and stderr drain remain unchanged. No blanket file exemptions or production repairs were introduced.

New protocol cases within the admitted existing file remain preserved, including escaped-key host regression, Effect-reference frame parity, batch/UTF-8 fragmentation, 16 MiB boundaries, control frames and full Fail/Die cause-shape oracles.

## Final proof evidence

Final source commit `237412d589859ae72bf36e6318b8636fe88d8580`: full package verification passed after Info-level instrumentation (audit 11.2 seconds / docgen 4.0 seconds). Configured Node and Bun final runs each passed 39 tests with 0 skips, including the deferred seventh suite. Node whole-command 4.52176503699593 seconds; Bun 2.467965527997876 seconds. These final receipts are distinct from historical timings below. All 3 existing property registrations passed with `BEEP_FC_NUM_RUNS=400` and `BEEP_FC_SEED=20260708` after instrumentation. Native malformed-output synchronization additionally passed two Node and two Bun targeted samples without retries.

Final public evidence: `../timings/after/acp/node.json`, `../timings/after/acp/bun.json`, their context receipts, `../../../research/acp-final-evidence.json` and `../../../history/2026-09-26-acp-final-proof.md`. Timing results are observations on their recorded host/load/context, not proof of race freedom or performance causality. Source/assertion preservation and trace controls are separate receipts.

## Historical timing and observations

Retained Node command: 22 registrations, {'passed': 22}, exit 0; whole command 5.866664s; reporter span 5455.482ms. Source head `662823dd960367046ba7d73dd8fd25d15782865a`; raw reporter SHA256 `4a7db5c81989f784b377c30c183cc99fe9e4292f8366c5b9fa31af6036bf1ef3`. Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. Command: `bunx vitest run --reporter=json --outputFile=<private absolute raw report>`, package cwd. Historical execution only; not current-source proof.

Slowest reported files:

- `packages/drivers/acp/test/protocol.test.ts`: 967.482ms, 12 tests.
- `packages/drivers/acp/test/integration/client.integration.test.ts`: 960.015ms, 5 tests.
- `packages/drivers/acp/test/agent.test.ts`: 40.500ms, 4 tests.
- `packages/drivers/acp/test/Acp.equivalence.test.ts`: 1.145ms, 1 tests.

Hosted history: 3 observation rows across 3 jobs; categories {'assertion-or-property-failure': 3}.
- https://github.com/beep-effect/beep-effect/actions/runs/34393769103/job/102608445481 — head `30f8e682f2bb5c65293a84e3dd6da7649c627054`, 2026-09-09T19:13:25Z.
- https://github.com/beep-effect/beep-effect/actions/runs/34403442214/job/102640731217 — head `7e41ac03ed88681850a4cda0a44ef221d6b68efe`, 2026-09-09T20:50:23Z.
- https://github.com/beep-effect/beep-effect/actions/runs/34416715253/job/102683195474 — head `5213fdf9af28875b766426f2b3c470d14d154fc6`, 2026-09-09T23:23:29Z.

Historical observations are not unique flakes or current-source failures. AI-sync coverage-ratchet rows are not failing test assertions. ACP historical assertion labels alone do not establish present cause; the known Node 24 escaped-key environment issue is distinct from this accepted Node 22 cohort. No source comparison to historical heads or rerun was performed. Across the campaign, 527 failed runs include 21 unavailable logs and one unresolved cause. Zero mapped jobs does not establish no failures.


## Remaining boundary

The six-path D12 work is reconciled. The seventh json.test.ts requires separate admitted review; package-level 39-test passing results do not extend this inventory's six-file coverage claim. Parent owns publication, hosted review/check gates and broader goal closure.

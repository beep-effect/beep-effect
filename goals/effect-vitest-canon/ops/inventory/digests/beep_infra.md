# @beep/infra P1 digest

Root-reviewed and accepted P1 source inventory. P2 remains gated.

14 complete files; 56 open judgment rows: 5 minor review items and 51 info coverage-only rows. Native-boundary guidance is not a demonstrated defect.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 2 | 12 | 14 |
| flake | 1 | 13 | 14 |
| property | 1 | 13 | 14 |
| observability | 1 | 13 | 14 |

Detailed review items:

- `infra/ci-runners/sdks/ghaRunners/test/build.test.js:36` — L-RES-04: Preserve the native subprocess/filesystem subject when reviewing EV010: build invokes the selected compiler through process.execPath, then reads its exact argv/cwd record and copies a package manifest. A MemoryFileSystem or successful process stub cannot prove this boundary. Retain context.after cleanup, stale-compiler nonexecution and no-postinstall assertions.
- `infra/test/OpenClaw.test.ts:113` — L-RES-04: Retain the real Node Crypto and ChildProcess subjects behind NodeServices. runCaptured owns a spawned handle in an inner scope and joins stderr plus exitCode; its early release is not automatically redundant EV004. Only the rendered script's missing-mode usage path executes; retain exit 1 and usage text. Do not replace this with MemoryFileSystem or a successful process stub, or claim backup/provider/systemd execution.
- `infra/test/OpenClaw.test.ts:774` — L-FLAKE-05: The real usage-path test launches /bin/bash -lc, sourcing host login initialization, while other cases insist rendered commands use --noprofile --norc -p. Review executing this same body through the declared non-login shell contract, preserving the genuine child, exit 1 and exact usage diagnostic. Host profile state can add output, delay or side effects; this is a source-level isolation risk, not a reproduced flake. Do not run provider/privileged modes.
- `infra/test/schemaParity.ts:21` — L-PROP-03: This shared round-trip runner passes literal { runs: 25 }, bypassing repository BEEP_FC_NUM_RUNS and BEEP_FC_SEED policy. Preserve the 25 floor and encode-then-decode schema equivalence, passing fcRuns(25) through native property options. Its five assigned caller files need coordinated adoption; their separate assertSchemaArbitraryDecodesToSelf helper already applies fcRuns, so do not duplicate that finding.
- `infra/test/schemaParity.ts:23` — L-OBS-01: The helper reduces native arbitrary results to _tag and groups multiple schemas under one caller test. Retain each full encode/decode equivalence law and run floor, but expose named schema context and formatted native failure/replay information during migration. Do not collapse it to an unrelated Boolean tag comparison or weaken the law.

Ten highest-count files (all tie at four rows; sorted by path, coverage included):

- `infra/ci-runners/sdks/ghaRunners/test/build.test.js`: 4 rows, 1 review items.
- `infra/lambda/turbo-cache/test/authorizer.test.ts`: 4 rows, 0 review items.
- `infra/lambda/turbo-cache/test/helpers.ts`: 4 rows, 0 review items.
- `infra/lambda/turbo-cache/test/hmac.test.ts`: 4 rows, 0 review items.
- `infra/lambda/turbo-cache/test/writer.test.ts`: 4 rows, 0 review items.
- `infra/test/AIMetrics.test.ts`: 4 rows, 0 review items.
- `infra/test/AccountCostControls.test.ts`: 4 rows, 0 review items.
- `infra/test/CiFleetController.test.ts`: 4 rows, 0 review items.
- `infra/test/CiRunners.test.ts`: 4 rows, 0 review items.
- `infra/test/CiTurboCache.test.ts`: 4 rows, 0 review items.

Most tests construct pure configuration/rendered artifacts. AccountCostControls, CiFleetController and CiTurboCache use local Pulumi mocks and acquireUseRelease/disconnect, not live AWS. Keep config restoration and spy finally blocks. Three OpenClaw NodeServices suites preserve real SHA-256 or child-process usage behavior; runCaptured joins stderr/exit and owns a nested resource lifetime. The SDK test owns real temp directories and launches a fixture compiler through process.execPath, so MemoryFileSystem cannot replace that subject. Lambda handlers receive injected loaders/delegates and need no cloud resources. No resource construction speedup has been measured. Literal script sleeps, service commands and paths are renderer expectations, not runtime waits in this audit.

Retained first attempt: 93 passed across eight parent Vitest files, command 7.168527 seconds, exit 0. This is a configured subset, not a full-census baseline. The SDK build test and Lambda authorizer/HMAC/writer tests are absent from that reporter; they are not reported skipped or executed. The two support files are source-reviewed, not test registrations. Reporter SHA256 `e6961c70d2ef399d3492705dfc1d3be33232f8540e03941a7534dfc4c18d95b9`. CiTurboCache was the slowest reported file at 121.008 ms; no child-runner timing is available in this cohort.

Hosted history has nine coverage-ratchet observations across three jobs on 2026-08-13: functions 53.37 < 53.74, lines 52.94 < 53.17, statements 53.27 < 53.5. They are not nine flakes or test failures. Exact jobs, heads, log lines and runtime evidence are retained in the public hosted history summary; no causal comparison to current source is claimed.

The campaign completed 139 first attempts: 132 full-file-representation baselines, four configured subsets, three failures (CIops, Effect Drizzle, QA Capture). Recorded P1 runtime is Node 22.22.3/Bun 1.4.2/Vitest 4.1.11 with rc113; no supported-peer claim is inferred. Hosted scope is 527 failed runs with 21 unavailable logs and one unresolved cause. No tests, timings, browser, AWS/provider calls or secrets were executed/resolved here.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve native compiler and child-process subjects and mock lifetimes before assertion migration. Preserve exact payloads and matcher polarity for tagged candidates; plain extracted values remain under D5. Apply the explicit property-floor and diagnostic proposals without replacing round-trip laws. Address the source-proven environment-state risks without retries or timeout changes. Benjamin must acknowledge the complete inventory after Grok review before P2; later implementation requires package/runtime proof.

Root verified all sealed inputs, outputs and full source receipts, then passed combined strict inventory validation. Full P1 remains incomplete.

Evidence: [timing index](../timings/baseline-index.json), [configured subsets](../timings/configured-subsets.json), and [hosted history](../hosted-history-summary.json).

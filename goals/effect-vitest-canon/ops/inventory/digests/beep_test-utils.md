# @beep/test-utils — P1 inventory digest

Root accepted the complete 20-file package census after full four-lens reads,
strict validation and source/artifact hash checks: 18 tests and two support
files, including one generated declaration, totaling 5,051 lines and 198,114
bytes. Full P1 is incomplete; P2 waits for Benjamin’s acknowledgement.

There are 80 judgment/open rows: 11 actions (seven major, four minor) and 69 info coverage rows. All 80 passed actual strict public decoding, including every prescribed NONE. Every assigned file has exactly one row per lens. No exception, reason or fixSha was fabricated.

| Lens | Rows | Actions | Coverage |
| --- | ---: | ---: | ---: |
| resource | 20 | 3 | 17 |
| flake | 20 | 2 | 18 |
| property | 20 | 3 | 17 |
| observability | 20 | 3 | 17 |


## Top ten files by inventory count

Every file has four rows. Ties below prioritize actionable count, then full path; this is not a runtime ranking.

- test/SqlTest.test.ts: 4 rows, 3 actionable, 1 coverage.
- test/integration/SqlTest.pglite.test.ts: 4 rows, 3 actionable, 1 coverage.
- test/ConformanceLedger.test.ts: 4 rows, 1 actionable, 3 coverage.
- test/Layer.test.ts: 4 rows, 1 actionable, 3 coverage.
- test/MemoryFileSystem/Coverage.test.ts: 4 rows, 1 actionable, 3 coverage.
- test/MemoryFileSystem/MemoryFileSystem.test.ts: 4 rows, 1 actionable, 3 coverage.
- test/SqlTest.offline.test.ts: 4 rows, 1 actionable, 3 coverage.
- dist/test/Vitest.test-kit.d.ts: 4 rows, 0 actionable, 4 coverage.
- src/test/Vitest.test-kit.ts: 4 rows, 0 actionable, 4 coverage.
- test/Entity.test.ts: 4 rows, 0 actionable, 4 coverage.

## Layer topology, rebuilds and native boundaries

ConformanceLedger writes artifact fixtures through BunFileSystem, while its production reader calls Bun.file directly. Virtualizing just the fixture writer would break the consumer boundary. Preserve the native path until both sides have an explicitly reviewed service seam; this is a bounded P2 review dependency, not authorization for a production refactor.

Node/Bun filesystem conformance deliberately rebuilds the adapter per helper case and closes inner resources per case. The adapter is the subject, so the existing D8/D14 conformance exception matters. The reusable testLayer implementation registers named operations; the baseline represents 36 cases for each Node, Bun and Memory registration. The Bun adapter file ran under the Node compatibility cohort, which is not a Bun-native proof. Native write compatibility additionally checks offset views, seek and append behavior; substituting the emulator there would remove the subject.

MemoryFileSystem builds an in-process volume. Its lock covers state transition and event publication; watcher registration keeps a pending queue across Stream.callback attachment. Shared-layer blocks intentionally share volume state, and separate make evaluations/layer blocks prove independent volumes. Shorter scopes expose closed descriptors and temporary cleanup to assertions. Keep them. Per-test fresh temporary roots avoid incidental collisions. Shared TestClock.setTime/adjust remains a mutation: sequential case execution alone is not isolation, and no unconditional reset or nested-layer exemption is proposed.

SQL layers deliberately test real SQLite temporary files, in-process PGLite and separately gated external/container behavior. Offline module mocks control PG/testcontainers transports; no Docker acquisition is implied by those fixtures. makeSqlTestLayer applies Layer.fresh and runs migrate/seed before the body. Sharing these layers indiscriminately would weaken driver isolation and lifecycle tests. Two independent Scope.make lifetimes need failure-safe closure while preserving explicit early close. The freshness oracle must perform its write before checking the next provision. Real native SQLite file paths and external container teardown are not MemoryFS replacement targets.

Vitest.runtime creates real temporary fixture files consumed by spawned Vitest processes. Inner cleanup saves abort/report evidence before the fixture directory closes. This is genuine runner/process lifecycle coverage, not replaceable mock filesystem I/O. Vitest.test's cross-test counters and controlled monotonic values are deliberate contracts under sequence.concurrent:false. The package comment about file concurrency is broader than that setting: the retained worker receipt says fileParallelism:true and per-file isolation. No blanket claim of serial package files is made.

Measured timing supports prioritizing the process fixture workload, but not a promised speedup. The runtime file occupies 86,588.661621 ms of reporter file interval and registers 15 parent tests, including repeated child invocations. The trace outcome matrix is the slowest parent case at 14,323.397332 ms. Do not replace native worker, timeout or repeat/retry subjects to improve these numbers. Acquisition counts and exact topology are source evidence; CPU or external startup cost is not inferred from layer names.

## Actionable source judgments

**L-RES-04 — test/ConformanceLedger.test.ts:8 (minor, confidence 1).** The fixture writes real artifacts through BunFileSystem, but ConformanceLedger.evidence.ts:23 reads them with Bun.file(url).text(), outside the Effect FileSystem service. A naive MemoryFS replacement would make the validator read another filesystem. Preserve native artifact consumption until an explicitly reviewed production I/O seam exists; if virtualizing later, route both writer and reader through the same service and retain all missing/invalid artifact assertions. This hidden consumer is additional evidence beyond the EV010 import candidate. No source change or exemption is approved.

**L-PROP-04 — test/Layer.test.ts:15 (minor, confidence 1).** The only fixture is Layer.succeed and the assertion checks its value. An implementation that provides context without closing the layer scope can satisfy this test, although src/Layer.ts:41-49 advertises scoped build/provision. Keep the pure stub layer and add an acquireRelease operation in the provided assertion body, with a release marker observed after helper completion, including failure/interruption paths where appropriate. Retain the current pure-stub value assertion and intentional scope boundary; do not manufacture a random property or shared outer fixture.

**L-OBS-01 — test/MemoryFileSystem/Coverage.test.ts:629 (minor, confidence 1).** The watcher waits for firstEvent before the second write, and joins an exact-count stream. If delivery regresses, the case reaches a generic task timeout without the collected prefix or pending operation. Preserve the first-delivery handshake, exact two-event sequence and later root-watch assertions; attach scoped progress/last-event diagnostics and a bounded diagnostic failure through the accepted runner. Do not emit a terminal marker before the handshake or reduce Stream.take counts. Production queue handoff buffering rules out asserting an unproved subscriber-registration race.

**L-OBS-01 — test/MemoryFileSystem/MemoryFileSystem.test.ts:16 (minor, confidence 1).** The shared watch helper takes an exact event count and joins; a missing event stalls before the caller can inspect the collected sequence. Preserve exact counts, ordering, recursive filtering and scoped child ownership. Retain the observed event prefix and pending operation in bounded failure diagnostics through the existing instrumented runner; where a terminal marker is appropriate, keep it distinct from the asserted subject events. Do not replace event control with sleeps or weaken the original expected sequence.

**L-FLAKE-02 — test/SqlTest.offline.test.ts:281 (major, confidence 0.85).** The child performs async PG module/client setup before the production retry schedule (SqlTest.ts:1173-1189; 20 recurrences with 250ms delays at862). Twenty-five yieldNow/300ms advances are not an acknowledgement that those retries have armed: sufficiently delayed async setup can leave a later retry waiting after the final advance, then Fiber.join stalls. Drive the mocked connection/retry lifecycle with an observable handshake and completion condition, retaining the exact retry bound and typed provision failure checks. This is a source-based scheduling risk, not a reproduced failure; do not add arbitrary waits or change the run floor.

**L-RES-02 — test/SqlTest.test.ts:539 (major, confidence 1).** Scope.make creates an independently closeable scope. The following Layer.buildWithScope and pre-close assertions can fail before the explicit Scope.close, leaving the layer resource owned by an unclosed scope. Register failure-safe closure immediately at scope creation while retaining the explicit early close and post-close filesystem/schema assertion. Do not extend the asserted lifetime to the end of the test or share this lifecycle subject across cases. Static failure-path evidence only; no leaked resource was created by this audit.

**L-PROP-04 — test/SqlTest.test.ts:423 (major, confidence 1).** createTable is a lazy Effect at407-421. The fresh provision is queried at423 before createTable is executed at 425, so a reused initially empty database can satisfy both true/false assertions. Execute and assert the first write before querying the next fresh provision; preserve both exact Boolean expectations, real driver selection and scoped cleanup. Production uses Layer.fresh; this is a distinguishing test-oracle gap, not evidence that production currently shares a database.

**L-OBS-01 — test/SqlTest.test.ts:159 (major, confidence 1).** The local codec law nests runSync encode/decode inside native checkEffect and checks only Passed; thrown decode/encode failures can bypass a useful property outcome. Use named it.effect.prop with the same schema-derived arbitrary, native fcRuns (helper default20 and existing explicit10 callers), yielded encode/decode and original equivalence. Retain the separate error-payload property at716, all exact payload expectations, seeds and floors. The pinned adapter normalizes assertion causes and formats replay/shrink context; this adds failure-path evidence beyond EV001/EV007. No failing sample was invented.

**L-RES-02 — test/integration/SqlTest.pglite.test.ts:381 (major, confidence 1).** Scope.make creates an independently closeable scope. The following Layer.buildWithScope and pre-close assertions can fail before the explicit Scope.close, leaving the layer resource owned by an unclosed scope. Register failure-safe closure immediately at scope creation while retaining the explicit early close and post-close filesystem/schema assertion. Do not extend the asserted lifetime to the end of the test or share this lifecycle subject across cases. Static failure-path evidence only; no leaked resource was created by this audit.

**L-FLAKE-01 — test/integration/SqlTest.pglite.test.ts:395 (major, confidence 0.95).** PostCloseConnectRetryPolicy uses spaced(1 second)/upTo(60 seconds), and the inspection helper at161 uses timeoutOption(5 seconds), under it.effect without clock advancement. After a real connection failure, or a hung native inspect Promise, the Effect-managed bound can wait on frozen TestClock. Apply a narrowly owned live-clock boundary to the native probe/retry where wall time is required, preserving error attribution, all retry/time budgets and finalizers. Do not advance the shared test clock or switch every logging/I/O test to live. The external branches were not reproduced here.

**L-PROP-04 — test/integration/SqlTest.pglite.test.ts:160 (major, confidence 1).** The helper converts every import/runtime/inspect error and timeout into false. A live container with an unreachable daemon therefore satisfies the post-close false expectation at462. Distinguish a verified not-found/removal result from connectivity, import and timeout failures; preserve the pre-close true assertion and post-close removal assertion. Treat unknown inspection failures as failed or inconclusive evidence, not proof of cleanup. No Docker operation was run.

Graph links are review navigation, not automatic rewrites. In particular, assertFalse for the inspection oracle does not justify flattening every error to false; Effect.scopedWith does not justify deleting the tested early close; TestClock.withLive is narrowly applicable where the it.effect environment supplies TestClock and native wall time is the subject. Preserve every assertion operand, polarity, seed, run floor and native boundary.

## Mechanical candidates retained

All 85 package scanner payloads are preserved, open and source-bound: EV001 12; EV002 18; EV003 2; EV004 12; EV006 16; EV007 2; EV009 1; EV010 5; EV011 1; EV014 15; EV015 1. The 85 are not human lens coverage, even where mechanization is judgment.

EV004 shorter scopes include descriptor invalidation, temporary removal, container stop accounting and child-process evidence capture. EV002 driver rebuilds can be the conformance subject. EV014 includes Layer.empty, ConfigProvider, Ref and memory fixtures: no automatic container timeout or inferred startup cost is justified by those candidates. The compound encoded database-info equality at SqlTest.test.ts:673 retains all nested Options and plain fields; it is already ambiguous review guidance, not proof the outer object is an Option. Positive Exit/Some predicates do not supply an expected Cause/payload. The live testcase explicitly proves the runner works without TestClock; do not remove that subject. No detector row is waived, closed or relabeled here.

## Completed baseline and bounded failure evidence

Root's first attempt, captured 2026-09-11T23:18:11.021756+00:00, exited zero with reporter success and zero failed tests. It registered 285 cases: **274 passed, seven skipped and four todo**. All 18 assigned test source files were represented; the two support files are not runtime test bodies. This is not a claim that all registered cases or all external driver branches executed. The package's ordinary script excludes integration; the accepted Node baseline command has its own full-file cohort.

Whole-command duration is 88.59411348499998 seconds. Reporter interval is 88,028.66162109375 ms and excludes shutdown/report writing. File durations overlap and must not be summed as wall time. All campaign collection is terminal: 139 first attempts, 132 accepted full-file baselines, four configured subsets and three failures. test-utils belongs to the accepted full-file group. No timing/history collection was rerun.

| Baseline file | Registered cases | Reporter file duration (ms) |
| --- | ---: | ---: |
| test/ConformanceLedger.test.ts | 14 | 38.411865234375 |
| test/Entity.test.ts | 2 | 1.1845703125 |
| test/FileSystemConformance.bun.test.ts | 36 | 261.48486328125 |
| test/FileSystemConformance.node.test.ts | 36 | 213.261962890625 |
| test/FileSystemWriteCompatibility.test.ts | 3 | 19.673583984375 |
| test/Layer.test.ts | 1 | 2.97314453125 |
| test/Schema.test.ts | 4 | 7.166259765625 |
| test/SqlTest.equivalence.test.ts | 1 | 1.2099609375 |
| test/SqlTest.offline.test.ts | 8 | 859.677734375 |
| test/SqlTest.test.ts | 19 | 2544.831787109375 |
| test/SystemTemp.test.ts | 3 | 1.2158203125 |
| test/Vitest.runtime.test.ts | 15 | 86588.66162109375 |
| test/Vitest.test.ts | 37 | 36.583251953125 |
| test/MemoryFileSystem/Characterization.test.ts | 18 | 213.728515625 |
| test/MemoryFileSystem/Conformance.test.ts | 36 | 159.92333984375 |
| test/MemoryFileSystem/Coverage.test.ts | 27 | 575.63134765625 |
| test/MemoryFileSystem/MemoryFileSystem.test.ts | 17 | 317.72509765625 |
| test/integration/SqlTest.pglite.test.ts | 8 | 6984.265380859375 |


The captured cohort is Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 with Effect/adapter rc113. The adapter declares Vitest 5 compatibility; the accepted exercised Vitest 4 cohort is not a claim of supported peer binding. Workers are configured as forks, fileParallelism:true, per-file isolation, capacity 63 and maxConcurrency 5; ordinary cases default sequential. Capacity is not utilization. The context retains 19 host samples, max CPU PSI avg10 7.51, I/O 1.74, memory 0 and minimum available memory 67.126 GiB. No load normalization, best-of selection or hosted speed extrapolation is used.

Completed hosted history covers 2026-08-12T23:06:31Z through 2026-09-11T23:06:31Z. Package evidence contains 75 observations across 18 jobs: 56 coverage-ratchet records, 15 child-worker-startup observations and four timeout-observed records. The latter include missing TestHang for the live watchdog/tiny-budget cases, missing last-alpha for concurrent each, and the trace matrix reaching its parent timeout. Fifteen records from the Sep10 worker-startup job share thread-worker teardown/startup symptoms and downstream assertion failures; they are not 15 independent flakes.

Current tiny/concurrent fixtures use a controlled independent watchdog clock with explicit arming/log handshakes. The real watchdog fixture still exercises real time. The current Node fixture selects its runtime pool separately from Bun. These inspected facts do not establish historical-source equality or prove a historical cause was repaired. Global hosted limitations remain 21 unavailable logs and one unresolved cause among 527 failed runs, with latest-attempt scope. Coverage production paths are not test failures. The passing current first attempt proves neither absence of rare races nor compiler, coverage or full package acceptance.

## Proposed internal P2 order and remaining uncertainty

Keep scope → assertions → property → flake → observability. First protect manual scopes and native-reader boundaries; then preserve complete tagged/plain assertion semantics; correct distinguishing freshness/removal/release oracles; address retry readiness and native timer ownership with evidence; finally add property/watch diagnostics using the existing runner. No generator floor reduction, skipped test, flakyTest, catch-all retry or timeout expansion is proposed.

Root accepted these 11 proposals as source inventory; later implementation
still requires the P2 gate and appropriate proof. No current failure was reproduced. The SQL scheduling risks are conditional on delayed setup, failed reconnection or hung inspection; no database or container was acquired here. Host history is not causally complete. All 80 rows passed strict decoding at frozen schema SHA256 05ef413feaa552d684c91422adf95014514c26ca9ada916b7c0290c8d27ee27d; graph membership is 100 at rc113 commit d3b837aee836f35d625d55205f7d6e61305fc198. Root's 237 regressions, 25 controls and package proof are prerequisite receipts, not work rerun here.

The 90 inherited-main ratchet additions and all test/production source remain
unchanged. No P2 remediation or waiver is authorized by this inventory.

The [baseline](../timings/baseline/beep_test-utils.json) and
[timing context](../timings/context/baseline/beep_test-utils.json) retain the exact measured cohort.

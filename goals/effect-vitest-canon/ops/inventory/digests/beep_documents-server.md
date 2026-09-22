# @beep/documents-server P1 four-lens digest

11 complete test files, 44 file/lens pairs, 45 rows: 10 review proposals and 35 coverage-only NONE rows. All rows remain open judgments. Review proposals include two informational native-boundary constraints; they are not ten independently reproduced failures. No source remediation or test execution occurred.

| Lens | Review | NONE | Minor | Info total |
|---|---:|---:|---:|---:|
| resource | 6 | 5 | 4 | 7 |
| flake | 1 | 10 | 1 | 10 |
| property | 3 | 9 | 3 | 9 |
| observability | 0 | 11 | 0 | 11 |

## Detailed review proposals

### L-RES-05: DmsMirrorBox.test.ts:303–311 (minor)

mirrorLayer and availabilityLayer build actual Ref-backed adapters (DmsMirrorBox.ts545-558,828-834), not just pure fake service values. Expose outer lifecycle through public layer registration in P2 while preserving a fresh fake and cache per independent scenario and one shared cache within each repeated-call assertion. Keep scripted Node Readable upload bodies, exact counters and config inputs. Do not turn this into a live Box test or share the mutable fake across concurrent cases.

Evidence: `const mirrorLayer = (fake: FakeBoxHarness, config: BoxMirrorConfigValue = defaultConfig) =>   DmsMirrorBoxLayer.pipe(     Layer.provide(Layer.merge(Box.makeLayerFromClient(fake.client), BoxMirrorConfi`

### L-RES-04: DocumentIntake.test.ts:119–139 (info)

Coordinate EV002/EV010 through public outer layer ownership, retaining per-test scoped directories and native symlink/inode/atomic publication semantics. The directory escape, predictable-temp symlink and eight-writer cases test real path safety; MemoryFileSystem must not replace this security/concurrency cohort. Production DocumentIntake.service.ts143 awaits writeFileWithinRootAtomically before returning metadata. Preserve victim bytes, exact refusal reason and cleanup ordering.

Evidence: `  it.effect(     "rejects a projected vault ancestor that is a symlink outside the vault",     Effect.fnUntraced(function* () {`

### L-RES-05: FilingDecisionLlm.test.ts:40–68 (minor)

LanguageModel.make is an effectful builder under a private provider helper; retain response-specific model construction and the real FilingDecisionLlm service when adopting public outer registration. Pure failure FileProcessing Layer.succeed remains legal. Keep the native filesystem only where intake materialization is exercised and retain scoped temp cleanup; no provider credential or real model call is needed.

Evidence: `const makeLanguageModelLayer = (response: Effect.Effect<string>): Layer.Layer<LanguageModel.LanguageModel> =>   Layer.effect(     LanguageModel.LanguageModel,`

### L-PROP-04: FilingDecisionLlm.test.ts:158–179 (minor)

The case is named materializes heuristic filing after extraction failure, but only checks filing classification and relative path. Returning valid metadata without writing bytes would satisfy these assertions. Retain those assertions and add a native read of the returned path under the scoped vault root equal to the exact input complaint bytes. Production intake awaits materialization at DocumentIntake.service.ts143. Keep the extraction failure, heuristic subject and original operands; do not replace with a mock write count.

Evidence: `describe("@beep/documents-server FilingTextExtraction", () => {   it.effect(     "materializes the heuristic filing when the optional extraction engine fails",`

### L-RES-05: VaultSyncDrift.test.ts:28–31 (minor)

DocumentsSyncFixtureLive builds four in-memory repositories, a Ref-backed mirror and engine locks (Layer.ts143-154; DmsMirrorFixture.ts316-323). Public outer registration must preserve fresh state between cases and the SAME repositories/cursor across the two engines within the restart case. Keep native temp scopes and local-byte nonmutation after remote deletion. No database/process durability or measured build-cost claim.

Evidence: `const SyncDriftTestLayer = DocumentsSyncFixtureLive.pipe(   Layer.provideMerge(BunFileSystem.layer),   Layer.provideMerge(BunPath.layer)`

### L-RES-04: VaultSyncEngine.test.ts:64–101 (info)

Public outer ownership must retain the actual native filesystem and decorators that deny /proc/self/fd resolution or remove inode identity. The positive inode fallback and exact missing-inode refusal, queued symlink escape and atomic file changes are native subjects, not MemoryFS substitution candidates. Keep fresh fixture/repositories per case and scoped temp roots; reuse only immutable wiring. Preserve all counts, digests and failure payloads.

Evidence: `const ProcfsUnavailableFileSystemLayer = Layer.effect(   FileSystem.FileSystem,   Effect.gen(function* () {`

### L-FLAKE-05: VaultSyncEngine.test.ts:431–450 (minor)

This case expects exactly three upload attempts but DocumentsSyncFixtureLive includes ambient VaultSyncConfigLayer (Layer.ts151; VaultSync.config.ts149-157). DOCUMENTS_SYNC_MAX_ATTEMPTS=1 or 4 changes terminal attempts even with identical fixture input. Supply an explicit test-local ConfigProvider/config value for the existing budget 3 and page limit, preserving the production env-decoding tests separately. Do not mutate process.env, raise timeouts, lower retry assertions or change production defaults. This is a source-proven dependency, not an observed hosted flake.

Evidence: `    "fails an operation after exhausting the configured attempt budget",     Effect.fnUntraced(function* () {       const engine = yield* VaultSyncEngine;`

### L-RES-05: VaultSyncReviewRegressions.test.ts:32–32 (minor)

RegressionTestLayer combines actual native filesystem with mutable repository/mirror state. Expose outer lifetime publicly in P2 without sharing fixed workspace 21 state across independent concurrent cases. Preserve inner temp roots, actual dangling/outside symlink versus good-file control, and within-case successive sync passes. Native path-boundary tests remain native even if separate interface-only cases later justify MemoryFS.

Evidence: `const RegressionTestLayer = DocumentsSyncFixtureLive.pipe(`

### L-PROP-04: VaultSyncReviewRegressions.test.ts:116–140 (minor)

The new-file-at-vacated-path regression checks both remote keys and current state but not which bytes reached each key. Wrong/stale content can satisfy it. Preserve every existing path/status assertion and assert each public fixture node contentDigest matches its respective original first and new second byte payload. DmsMirrorFixture exposes contentDigest explicitly; do not invent a private inspection hook or change the native move/write sequence.

Evidence: `  it.effect(     "uploads a new file created at a previously vacated path",     Effect.fnUntraced(function* () {`

### L-PROP-04: VaultSyncReviewRegressions.test.ts:335–338 (minor)

String(conflict.remotePayload.head).length <=8192 also passes for undefined or a wrong short head. Preserve truncated=true and the bound, then require a string head matching the exact first 8192 characters of the serialized injected payload. VaultSyncEngine.service.ts115-119 defines that content contract. Keep oversized input and actual conflict capture; do not weaken to a presence-only check.

Evidence: `      const conflict = yield* Effect.fromOption(A.head(conflicts));       expect(conflict.remotePayload.truncated).toBe(true);       expect(String(conflict.remotePayload.head).length).toBeLessThanOrEq`

## Layer topology, native subjects and rebuild costs

The private provideScopedLayer helper builds the supplied layer in a new scope on each execution (test-utils/src/Layer.ts46–49). Box adapters retain per-build root/cache Refs. Vault fixture construction creates seven Refs for items, IDs, events, positions, counts, requests and injected failures; DocumentsSyncFixtureLive also composes four repository instances and per-engine lock state. Source establishes repeated builds, not their measured duration. Share only appropriate outer immutable/platform wiring in P2; preserve fresh scenario state and within-scenario repeated calls. No numeric rebuild saving is claimed.

The intake and vault security cases require real symlinks, inode identity, descriptor path fallback and atomic native publication. They cannot be indiscriminately switched to MemoryFileSystem. Interface-only filing/routing cases may be evaluated separately in P2 with equivalent outcomes; this audit does not approve a replacement. Box is a scripted client with real in-process Readable conversion. LanguageModel is scripted. PGlite is the real in-process SQL driver with btree_gist, actual migrations and constraints, a serial shared public layer and deliberate last-test transaction cleanup. No external Box/model/PostgreSQL service was called here.

## Timing and hosted evidence

The accepted retained Node command baseline reports 94 passed cases across all 11 files: 7.020790881999801 seconds whole command and 6611.717529296875 ms reporter duration, not additive file durations. PGlite file: 1510.717529296875 ms, six registered/passed cases; first migration/item case: 1332.2954829999999 ms. This is evidence for that exact configured Node cohort, not a new run, live provider execution, coverage or package proof. Node22.22.3, Bun1.4.2 and Vitest4.1.11 are retained identities; rc113 declares the independently qualified Vitest5 peer range.

Hosted summary maps five observations from three jobs: one assertion/property failure and four coverage-ratchet observations. It does not establish a current-source race or five unique flakes. Global history covers 527 failed runs, 21 unavailable logs and one unresolved cause. The package-specific aggregate lacks the detailed assertion cause; no causal attribution to these proposals is invented. Across all packages, 139 first attempts comprise 132 full-file baselines, four configured subsets and three failures (CIops, Effect Drizzle, QA Capture). Those failures and subset boundaries remain unchanged.

## Top ten files by review-row count

| File | Reviews |
|---|---:|
| packages/documents/server/test/VaultSyncReviewRegressions.test.ts | 3 |
| packages/documents/server/test/FilingDecisionLlm.test.ts | 2 |
| packages/documents/server/test/VaultSyncEngine.test.ts | 2 |
| packages/documents/server/test/DmsMirrorBox.test.ts | 1 |
| packages/documents/server/test/DocumentIntake.test.ts | 1 |
| packages/documents/server/test/VaultSyncDrift.test.ts | 1 |
| packages/documents/server/test/SyncConflictServer.test.ts | 0 |
| packages/documents/server/test/SyncCursorServer.test.ts | 0 |
| packages/documents/server/test/SyncItemServer.test.ts | 0 |
| packages/documents/server/test/SyncOperationServer.test.ts | 0 |

## Per-file four-lens coverage

### DmsMirrorBox.test.ts

Full read: 1–1026; 37185 bytes; owner @beep/documents-server; kind test. SHA256 `9cc7a8bebc424f13d7c9b3397763728a2913519cd8df10198185c8cce8df6948`.

- **resource:** mirrorLayer and availabilityLayer build actual Ref-backed adapters (DmsMirrorBox.ts545-558,828-834), not just pure fake service values. Expose outer lifecycle through public layer registration in P2 while preserving a fresh fake and cache per independent scenario and one shared cache within each repeated-call assertion. Keep scripted Node Readable upload bodies, exact counters and config inputs. Do not turn this into a live Box test or share the mutable fake across concurrent cases.
- **flake:** No additional change required by this lens: The fake Box client returns scripted Promises, records calls and consumes upload Readables. Pagination and conflict recovery have explicit counters; the root-creator race is simulated, not measured concurrent HTTP. Probe caching is checked by identity then refresh, without waiting for TTL. No additional uncontrolled wait established.
- **property:** No additional change required by this lens: Schema-derived round trips retain fcRuns(10), encode/decode and equivalence. Upload/version bodies, parent moves, pagination markers, malformed events and retryable/permanent status controls are explicit. Preserve all operands and negative cases; EV001/EV007 already own runner syntax.
- **observability:** No additional change required by this lens: Named adapter cases expose call counts, payloads, disconnect reasons and probe refresh. Failure classification is asserted; it is not evidence of a production retry or live Box availability. No extra logging justified.

### DocumentIntake.test.ts

Full read: 1–198; 9227 bytes; owner @beep/documents-server; kind test. SHA256 `3a231e158fe2c11377980be140b1ff3ca6923041e539a9a014a80599d44db47f`.

- **resource:** Coordinate EV002/EV010 through public outer layer ownership, retaining per-test scoped directories and native symlink/inode/atomic publication semantics. The directory escape, predictable-temp symlink and eight-writer cases test real path safety; MemoryFileSystem must not replace this security/concurrency cohort. Production DocumentIntake.service.ts143 awaits writeFileWithinRootAtomically before returning metadata. Preserve victim bytes, exact refusal reason and cleanup ordering.
- **flake:** No additional change required by this lens: Eight intake Effects are awaited together at concurrency8 and each case owns a scoped temp root. Symlink targets and victim bytes are explicitly checked. No sleep or unjoined child; retain actual concurrent publication rather than serializing away the subject.
- **property:** No additional change required by this lens: Base64 schema round trip preserves fcRuns(10). Filed/inboxed bytes, outside-root refusal, unchanged symlink victim and one final publication after eight intakes are concrete witnesses. No additional generated law required from syntax alone.
- **observability:** No additional change required by this lens: Named security and publication cases expose exact failure reason, destination and victim bytes. The native filesystem is the subject; no external extraction provider is exercised.

### FilingDecisionLlm.test.ts

Full read: 1–180; 6752 bytes; owner @beep/documents-server; kind test. SHA256 `a9c3ecaf54909a45745445107046be5e95d38b7d101f9214037906949ec02f98`.

- **resource:** LanguageModel.make is an effectful builder under a private provider helper; retain response-specific model construction and the real FilingDecisionLlm service when adopting public outer registration. Pure failure FileProcessing Layer.succeed remains legal. Keep the native filesystem only where intake materialization is exercised and retain scoped temp cleanup; no provider credential or real model call is needed.
- **flake:** No additional change required by this lens: LanguageModel.make responds with scripted text or a deliberate defect. The extraction stub also defects; recovery is intentional. No real model request, timeout race or external availability is tested.
- **property:** The case is named materializes heuristic filing after extraction failure, but only checks filing classification and relative path. Returning valid metadata without writing bytes would satisfy these assertions. Retain those assertions and add a native read of the returned path under the scoped vault root equal to the exact input complaint bytes. Production intake awaits materialization at DocumentIntake.service.ts143. Keep the extraction failure, heuristic subject and original operands; do not replace with a mock write count.
- **observability:** No additional change required by this lens: High/low confidence, unknown taxonomy and model-unavailable outcomes assert explicit reason/rationale. Keep those distinctions when instrumenting, including defect recovery; a fake model is not live provider proof.

### SyncConflictServer.test.ts

Full read: 1–147; 5247 bytes; owner @beep/documents-server; kind test. SHA256 `f475feb772ab9a0295394c0dba62a89cf947811b09e5e8b4744d895fd5269592`.

- **resource:** No additional change required by this lens: Fresh makeInMemorySyncConflictRepository per case is the constructor under test. The separate provider smoke probe is already EV002; preserve isolated IDs and repository state rather than sharing mutable state across cases. No additional resource issue beyond that candidate established.
- **flake:** No additional change required by this lens: All local repository operations are awaited; deduplication uses fixed event IDs and explicit absent-event controls. No database, clock wait or concurrent actor.
- **property:** No additional change required by this lens: Record, same-event deduplication, no-event non-deduplication, reviewed filtering and unknown-ID error are explicit. Domain/seed schema equivalence uses fcRuns(10); keep both distinct IDs and exact missing ID.
- **observability:** No additional change required by this lens: Named repository outcomes and typed unknown-ID evidence are diagnostic. These are in-memory transitions, not SQL persistence or restart proof.

### SyncCursorServer.test.ts

Full read: 1–101; 3585 bytes; owner @beep/documents-server; kind test. SHA256 `c48f0df04bf001198ca47c984e8692165dd89a0e6cc418fcdb223f87f2204b8c`.

- **resource:** No additional change required by this lens: Each test constructs a fresh in-memory cursor repository. Private layer smoke probe remains EV002; do not hoist one mutable cursor store across cases. No native acquisition is implied by the stream-position strings.
- **flake:** No additional change required by this lens: Fixed stream positions and awaited upserts have no external stream or scheduling. The lastError text is fixture data, not an observed interruption.
- **property:** No additional change required by this lens: Initial None, stable upsert ID, replaced event/error fields and exact lookup position are checked, plus domain/seed schema equivalence at fcRuns(10). Preserve Option operands during EV006 migration.
- **observability:** No additional change required by this lens: Named empty/upsert/provision cases distinguish behavior. This file does not establish durable cursor storage or an actual interrupted remote stream.

### SyncItemServer.test.ts

Full read: 1–167; 5977 bytes; owner @beep/documents-server; kind test. SHA256 `42fb9855bac4c72c84a3ea32c7e8a77e1b7fc950dabde4e44dfdc305f8218b6c`.

- **resource:** No additional change required by this lens: Fresh in-memory item repositories isolate deterministic IDs and indexes. The private layer smoke probe already has EV002; preserve constructor tests and separate mutable instances. Path strings do not acquire a filesystem.
- **flake:** No additional change required by this lens: Local create/update/find calls are sequential and awaited; no timer or detached work. Exact insertion-order expectation is intentional.
- **property:** No additional change required by this lens: Create order, duplicate-path conflict, remote-ID update, path lookup and missing-ID payload are witnessed. Both real schemas retain equivalence and fcRuns(10); no additional heuristic property proposal.
- **observability:** No additional change required by this lens: Failure cases name the conflict/not-found boundary and retain tags/IDs. Plain projected ID arrays are legitimate expect operands, not a logging gap.

### SyncOperationServer.test.ts

Full read: 1–185; 7072 bytes; owner @beep/documents-server; kind test. SHA256 `5431aeabc3af047a32b23382bccc89510412b11d71f1e5f15c25e3eccedfb8b1`.

- **resource:** No additional change required by this lens: Each case owns a fresh in-memory operation repository; private layer smoke probe remains an existing EV002 candidate. Preserve queue identity and mutable state isolation; no real database lease is acquired.
- **flake:** No additional change required by this lens: FIFO and leased-to-queued transitions use explicit statuses, not elapsed time. All operations are awaited and no external worker runs.
- **property:** No additional change required by this lens: Duplicate idempotency key, FIFO order, per-item filtering, requeue count and unknown ID are explicit positive/negative controls. Native schema checks keep fcRuns(10) and equivalence.
- **observability:** No additional change required by this lens: Named queue transitions and exact error/key/count assertions identify failures. A leased status fixture is not proof of crash recovery or database locking.

### VaultSyncDrift.test.ts

Full read: 1–307; 12926 bytes; owner @beep/documents-server; kind test. SHA256 `17928e52c4c88318983510558ef854e85697c064e6a1837729849b19b0eebe58`.

- **resource:** DocumentsSyncFixtureLive builds four in-memory repositories, a Ref-backed mirror and engine locks (Layer.ts143-154; DmsMirrorFixture.ts316-323). Public outer registration must preserve fresh state between cases and the SAME repositories/cursor across the two engines within the restart case. Keep native temp scopes and local-byte nonmutation after remote deletion. No database/process durability or measured build-cost claim.
- **flake:** No additional change required by this lens: Sync passes and remote-event injections are awaited in order. Restart case rebuilds an engine over the same in-memory repositories within one test. No actual process crash or external polling is performed.
- **property:** No additional change required by this lens: Foreign versus self/outside events, deduped replay, preserved local bytes after remote deletion, reviewed filtering and cursor reuse have exact witnesses. Preserve positions None then stored cursor and injected poll-error payload.
- **observability:** No additional change required by this lens: Named drift types and exact event IDs/local paths make attribution visible. The stored error cursor is in memory; source and timing do not establish durable database restart.

### VaultSyncEngine.test.ts

Full read: 1–539; 22704 bytes; owner @beep/documents-server; kind test. SHA256 `aaf69f5902a8d1430dcde8b5f4bf47daa47f0ad188457d6d77f0a047c0d91d44`.

- **resource:** Public outer ownership must retain the actual native filesystem and decorators that deny /proc/self/fd resolution or remove inode identity. The positive inode fallback and exact missing-inode refusal, queued symlink escape and atomic file changes are native subjects, not MemoryFS substitution candidates. Keep fresh fixture/repositories per case and scoped temp roots; reuse only immutable wiring. Preserve all counts, digests and failure payloads.
- **flake:** This case expects exactly three upload attempts but DocumentsSyncFixtureLive includes ambient VaultSyncConfigLayer (Layer.ts151; VaultSync.config.ts149-157). DOCUMENTS_SYNC_MAX_ATTEMPTS=1 or 4 changes terminal attempts even with identical fixture input. Supply an explicit test-local ConfigProvider/config value for the existing budget 3 and page limit, preserving the production env-decoding tests separately. Do not mutate process.env, raise timeouts, lower retry assertions or change production defaults. This is a source-proven dependency, not an observed hosted flake.
- **property:** No additional change required by this lens: Content digests, procfs fallback with/without inode identity, move/rename/version counts, escaped queued symlink refusal, exact retry attempts and seeded lease/healing transitions are checked. Schema round trips retain fcRuns(10). Production retries are the subject, not a test retry workaround.
- **observability:** No additional change required by this lens: Explicit VaultScanFailed reason and operation lastError distinguish safety from provider failure. Seeded crash-window healing is not an actual killed process. Preserve real filesystem decorators and per-case trace identity.

### VaultSyncReviewRegressions.test.ts

Full read: 1–340; 14103 bytes; owner @beep/documents-server; kind test. SHA256 `a5fb3c7445adc1aaed681a531d2c71d89b69778d36f20f7ffea6b53ff56493a3`.

- **resource:** RegressionTestLayer combines actual native filesystem with mutable repository/mirror state. Expose outer lifetime publicly in P2 without sharing fixed workspace 21 state across independent concurrent cases. Preserve inner temp roots, actual dangling/outside symlink versus good-file control, and within-case successive sync passes. Native path-boundary tests remain native even if separate interface-only cases later justify MemoryFS.
- **flake:** No additional change required by this lens: Awaited sync passes and native path changes use per-case scoped roots and isolated fixture state. No arbitrary wait. Retry revival is a production recovery scenario, not flakyTest; preserve fixed injected failure and later success.
- **property:** The new-file-at-vacated-path regression checks both remote keys and current state but not which bytes reached each key. Wrong/stale content can satisfy it. Preserve every existing path/status assertion and assert each public fixture node contentDigest matches its respective original first and new second byte payload. DmsMirrorFixture exposes contentDigest explicitly; do not invent a private inspection hook or change the native move/write sequence. String(conflict.remotePayload.head).length <=8192 also passes for undefined or a wrong short head. Preserve truncated=true and the bound, then require a string head matching the exact first 8192 characters of the serialized injected payload. VaultSyncEngine.service.ts115-119 defines that content contract. Keep oversized input and actual conflict capture; do not weaken to a presence-only check.
- **observability:** No additional change required by this lens: Named regressions identify move/rename, vanished operation, remote edit and root filtering. Instrumentation must retain exact event IDs and native symlink positive control. Payload diagnostic content weakness is recorded by property lens rather than duplicated here.

### SyncRepositoriesDrizzle.pglite.test.ts

Full read: 1–306; 13230 bytes; owner @beep/documents-server; kind test. SHA256 `20a3053e1d80ad79d9b90bc9bf8073ed0a581bded3b3c0d27d78b2706487e07a`.

- **resource:** No additional change required by this lens: Actual in-process PGlite with btree_gist, migration and Drizzle repositories runs inside a serial public layer with explicit five-minute hook option. Layer.fresh and transaction ownership are deliberate. Preserve real SQL constraints and final ROLLBACK; neither MemoryFS nor pure stubs substitute for this subject.
- **flake:** No additional change required by this lens: The suite explicitly disables concurrency and places the session-aborting duplicate-key test last, followed by ROLLBACK. This documented order constraint must remain during migration. Source does not prove rollback succeeds on every driver failure; no observed teardown race is inferred from comments.
- **property:** No additional change required by this lens: Real SQL duplicate constraints, stable cursor upsert, FIFO/requeue and remote-event deduplication have typed and exact-value checks. Seed schema round trips preserve fcRuns(10). Fixed shared IDs rely on the existing serial suite order; preserve it.
- **observability:** No additional change required by this lens: Named integration cases retain exact repository outcomes. ROLLBACK is deliberately ignored in the final poisoned-session cleanup and thus does not prove successful rollback; no new silent-success claim. Retained baseline records all six cases passed, not external PostgreSQL execution.

## Proposed P2 order and limits

Only after Benjamin authorizes P2: (1) scope/outer registration with fresh mutable fixtures and native inner lifetimes; (2) preserve all existing Option/Result operands and polarity during assertion migration, add exact written-content/digest/truncation witnesses; (3) migrate existing schema laws without changing fcRuns(10), seed or CI floor; (4) bind retry-budget test inputs explicitly without changing production retry behavior or globals; (5) adopt accepted instrumented runner without changing TestEnv, logger, cleanup, timeouts or tester variants. The 147 scanner candidates remain open and separate; human resource coverage is not inferred from EV002/EV010. No exceptions are transferred.

Source review cannot prove absence of races, finalizer failures, native-platform differences or hidden provider failures. A shared SQL transaction and final ignored ROLLBACK remain qualified. No new runtime reproduction, test, benchmark or provider call was executed. The 90 inherited-main ratchet additions are untouched. Root has accepted this P1 source inventory; P2 remains gated.

Root verified the sealed artifacts, source receipts and combined strict inventory validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

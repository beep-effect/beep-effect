# @beep/ontology-client P1 four-lens digest

11 complete test files; 44 file/lens pairs; 44 open judgments: 12 review proposals and 32 coverage-only NONE rows. No blocker finding. Root accepted this P1 inventory after source/artifact and combined strict validation.

| Lens | Reviews | NONE | Major | Minor | Info |
|---|---:|---:|---:|---:|---:|
| resource | 7 | 4 | 3 | 4 | 4 |
| flake | 2 | 9 | 2 | 0 | 9 |
| property | 3 | 8 | 0 | 3 | 8 |
| observability | 0 | 11 | 0 | 0 | 11 |

## Detailed findings

### L-RES-02 Session.atoms.test.ts:201–269 (major)

The Worker global stub is acquireUseRelease-owned, but registry.dispose is after assertions inside its use body; other cases likewise dispose only on success. Failed assertions can leave mounts, worker watchdogs and detached runtime work alive even after the global is restored. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve worker termination before restoring Worker; the production bridge finalizer at Session.atoms.ts1959-1964 disarms and terminates.

Evidence: `      yield* Effect.acquireUseRelease(         Effect.sync(() => vi.stubGlobal("Worker", FakeWorker)),         () =>`

### L-FLAKE-05 Session.atoms.test.ts:201–269 (major)

This live case and the live construction/send case at273-332 replace global Worker and call unstubAllGlobals. The package inherits sequence.concurrent=true with no local serial override. Production makeWorker reads the global constructor at1845 on retry, so one test can use the other constructor or lose its stub during a yield. Isolate the constructor at an existing public seam or explicitly serialize only the state-owning cases if injection cannot preserve the bundler boundary. Keep all retry, termination, message and redaction assertions; no global config change or fabricated hosted flake.

Evidence: `      yield* Effect.acquireUseRelease(         Effect.sync(() => vi.stubGlobal("Worker", FakeWorker)),         () =>`

### L-RES-02 auto-open.test.ts:63–78 (minor)

All four cases manually dispose only after assertions; several ignore mount release handles. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve the one-attempt flag across intentional remounts within a case and the zero-call controls.

Evidence: `  it.effect(     "opens the seeded tutorial when the app session starts with no document",     Effect.fnUntraced(function* () {`

### L-RES-02 graph-renderer-toggle.test.ts:147–210 (major)

Both cases release DOM/mounts only at the successful tail; the second never disposes its registry. A timeout or failed assertion can retain the canvas, ResizeObserver, renderer and registry effects. Register failure-safe per-case teardown at acquisition, retaining explicit null-container/release observations before final teardown. Keep DOM, actual Cosmos/3D, subscriptions and renderer destruction order; MemoryFS or a fake renderer would erase this subject. First-case registry.dispose at141 also needs guaranteed finalization.

Evidence: `      const registry = AtomRegistry.make();       const container = document.createElement("div");       container.style.width = "800px";`

### L-FLAKE-02 graph-renderer-toggle.test.ts:188–196 (major)

The two 300ms sleeps followed only by error=None do not establish selection or projection application. A delayed or dropped update also passes. Replace guessed elapsed-time completion with an observable public renderer/selection acknowledgement or actual browser-visible state, then retain all existing no-error and canvas/backend assertions. Keep real browser scheduling, projection and selected IRI; do not replace the renderer with a mock, increase timeout, or assume TestClock drives DOM/GPU callbacks. No browser failure was executed here.

Evidence: `      // selection flows through the bridge into the mounted 3D renderer       registry.set(selectedOntologyResourceIriAtom, O.some("https://example.test/Pizza"));       yield* Effect.sleep("300 milli`

### L-RES-02 failure-messages.test.ts:38–58 (minor)

The typed-error case never disposes its manually created registry; the defect case disposes only after assertions. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup.

Evidence: `      const registry = AtomRegistry.make({         initialValues: [           [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],`

### L-PROP-04 failure-messages.test.ts:78–80 (minor)

The defect case maps None to empty text and only rejects private substrings; a missing user-facing error passes both checks. Add a positive Some/nonempty safe-message witness before retaining both exact not-toContain checks. Session.atoms.ts972-978 promises a generic failure message for untyped causes. Assert the intended safe contract without inventing an error/Cause value or exposing raw details; preserve the typed parse-message case.

Evidence: the defect case falls back from None to empty text and only excludes the private-value string and operator-home prefix. The historical receipt preserves both exact negative assertions; neither requires a present, nonempty safe message.

### L-RES-02 inspector-actions.test.ts:50–93 (minor)

Both cases mount several runtime/action atoms and dispose only after assertions. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve the sequential add/connect/instantiate scenario inside its one fresh registry.

Evidence: `      const registry = AtomRegistry.make();       const setSubject = setOntologyInspectorInputAtoms("subject");       const setPredicate = setOntologyInspectorInputAtoms("predicate");`

### L-RES-02 stale-read.test.ts:60–93 (major)

The manually created registry is never disposed, and its RPC can remain parked on releaseQuery if an earlier step fails. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve both Deferred acknowledgements and stale-read ordering; ensure scope exit interrupts outstanding registry work rather than forcing a successful release/result that masks the failure.

Evidence: `      const queryReached = yield* Deferred.make<void>();       const releaseQuery = yield* Deferred.make<void>(); `

### L-RES-02 workbench-state-lifetime.test.ts:42–63 (minor)

The subject intentionally survives unmount but its owning registry is never disposed. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Final disposal must occur after the retained-document assertions, never before the idle observation.

Evidence: `      const registry = AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS });        // The workbench is on screen: something subscribes.`

### L-PROP-04 workbench-state-lifetime.test.ts:42–62 (minor)

This test passes if idle eviction never occurs at all: it checks only keepAlive values after the delay. Add a separate ordinary removable atom in the same 40ms-TTL registry and witness its reset while the exact document/path/source/signature remain. Preserve native timers, current delay and intentional unmount; no private disposal hook or forced reset of the subject.

Evidence: `      const registry = AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS });        // The workbench is on screen: something subscribes.`

### L-PROP-01 worker-wire.test.ts:57–87 (minor)

The command round-trip checks only decode success and the result checks class membership; valid-but-empty or wrong RDF/projection content can still pass. Add schema-derived equivalence or exact meaningful snapshot/options and projection field expectations across the same encode/structuredClone/decode boundary, including existing focusIri=None. Preserve the unencoded-clone negative and actual native clone. If generalized with native Arbitrary, use real schemas and explicit fcRuns without lowering existing floors; this row does not authorize replacing current fixed regression witnesses.

Evidence: `    const command = WorkerCommand.make({ kind: "projectGraph", snapshot, options });      const onTheWire = structuredClone(encodeWorkerCommand(command));`

## Layer topology, rebuild costs and native boundaries

Each atom scenario constructs its own AtomRegistry; initialValues inject pure OntologyClient scripts plus Reactivity.layer. Registries own detached atom runtimes, subscriptions, keepAlive state and sometimes the worker watchdog. Keep one registry across each intentional sequence, but guarantee per-case disposal rather than sharing one mutable outer registry. Public scoped registry/mount APIs supply existing lifetime seams. OntologyReasonerLive is explicitly Layer.succeed(OntologyReasoner, {infer: inferOntologySession}) at Session.reasoner.ts956-961, not a native acquisition merely because its name ends in Live. The private wrapper still Layer.build/scopes it and existing EV002/EV003 require Root judgment; no measured rebuild saving or heavyweight initialization is established. Two scenarios invoke actual structural inference; SHACL validation is scripted and the Turtle-labelled case constructs its dataset directly. Pure projection/codec tests acquire no service. Browser tests exercise real DOM, ResizeObserver, Cosmos and Graph3D; these and native AtomRegistry idle timers must not be replaced by MemoryFS or fake renderers. Paths in RPC fixtures are values, not native filesystem operations. No SQL/HTTP/provider/ACP/process execution is performed by this audit.

## Retained timing and hosted limits

The retained configured Node subset reports 25 passed tests in 10 files, 7.370720089000315 seconds whole command and 6766.827880859375 ms reporter duration. This is NOT a full-census baseline. Browser graph-renderer-toggle.test.ts is excluded by vitest.config.ts11 and belongs to the separate Playwright Chromium configuration; it was neither executed nor reported skipped by this Node run. No browser receipt is substituted. The baseline-index historical pending-scope wording is retained alongside the later configured-subsets classification supported-configured-runner-boundary. Raw reporter SHA256 `3f16e2161d5f523f9daa874f36bd1b1d98902d511c72e87e6fefdd7dfeead398`. Runtimes Node22.22.3/Bun1.4.2/Vitest4.1.11; rc113 Vitest5 peer-range qualification remains.

| Reported file | Retained ms | Registered tests |
|---|---:|---:|
| packages/ontology/client/test/Session.atoms.test.ts | 56.20166015625 | 8 |
| packages/ontology/client/test/TaggedError.equivalence.test.ts | 1.38623046875 | 1 |
| packages/ontology/client/test/auto-open.test.ts | 13.679931640625 | 4 |
| packages/ontology/client/test/failure-messages.test.ts | 12.637939453125 | 2 |
| packages/ontology/client/test/graph-centrality.test.ts | 442.827880859375 | 2 |
| packages/ontology/client/test/graph-labels.test.ts | 2.47900390625 | 2 |
| packages/ontology/client/test/inspector-actions.test.ts | 10.415283203125 | 2 |
| packages/ontology/client/test/stale-read.test.ts | 5.150146484375 | 1 |
| packages/ontology/client/test/workbench-state-lifetime.test.ts | 203.341552734375 | 1 |
| packages/ontology/client/test/worker-wire.test.ts | 3.849365234375 | 2 |

Graph centrality is the largest retained file duration (442.827880859375ms), followed by native TTL retention (203.341552734375ms). These are existing overlapping reporter intervals, not isolated setup/CPU costs or additive savings. No rebuild cost was benchmarked.

Hosted history maps zero observations/jobs to this package; zero does not establish absence of failures. The hosted scope covers 527 failed runs and includes 21 unavailable logs and one unresolved cause, not unique flakes; coverage paths are not test failures. All139 first timing attempts comprise132 full-file baselines,4 configured subsets and3 failures (CIops, Effect Drizzle, QA Capture). Preserve those boundaries and the separate graph-3d browser exclusion.

## Top ten files by review count

| File | Reviews |
|---|---:|
| packages/ontology/client/test/Session.atoms.test.ts | 2 |
| packages/ontology/client/test/browser/graph-renderer-toggle.test.ts | 2 |
| packages/ontology/client/test/failure-messages.test.ts | 2 |
| packages/ontology/client/test/workbench-state-lifetime.test.ts | 2 |
| packages/ontology/client/test/auto-open.test.ts | 1 |
| packages/ontology/client/test/inspector-actions.test.ts | 1 |
| packages/ontology/client/test/stale-read.test.ts | 1 |
| packages/ontology/client/test/worker-wire.test.ts | 1 |
| packages/ontology/client/test/TaggedError.equivalence.test.ts | 0 |
| packages/ontology/client/test/graph-centrality.test.ts | 0 |

## Every file and lens

### packages/ontology/client/test/Session.atoms.test.ts

Owner @beep/ontology-client; kind test; full read 1–564; 22397 bytes; SHA256 `8be8b74680e538333880c147c67fbdddf3c83301c90d9f8edc8570dc65d1f372`.

- **resource:** The Worker global stub is acquireUseRelease-owned, but registry.dispose is after assertions inside its use body; other cases likewise dispose only on success. Failed assertions can leave mounts, worker watchdogs and detached runtime work alive even after the global is restored. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve worker termination before restoring Worker; the production bridge finalizer at Session.atoms.ts1959-1964 disarms and terminates.
- **flake:** This live case and the live construction/send case at273-332 replace global Worker and call unstubAllGlobals. The package inherits sequence.concurrent=true with no local serial override. Production makeWorker reads the global constructor at1845 on retry, so one test can use the other constructor or lose its stub during a yield. Isolate the constructor at an existing public seam or explicitly serialize only the state-owning cases if injection cannot preserve the bundler boundary. Keep all retry, termination, message and redaction assertions; no global config change or fabricated hosted flake.
- **property:** No additional change required by this lens: Dirty divergence uses equal-length distinct change logs; inference caching asserts one real reasoner call across toggles; absent shapes prove zero inference/validation calls. Three real schemas round-trip with explicit fcRuns(10) and maxDiscards tied to the run count. Preserve those options, equivalence, counters and error payloads. EV001/EV007 already cover the manual property registration. The SHACL test returns a scripted validation result; it is not actual Turtle parsing or SHACL execution.
- **observability:** No additional change required by this lens: Worker waits carry explicit condition labels and bounded retry failure text. Construction/send/error/messageerror paths assert redaction, retry counts and exact user-facing messages. The synthetic private path is fixture data, not a credential. Preserve those diagnostics and the two distinct error-boundary cases; no additional generic logging finding.

### packages/ontology/client/test/TaggedError.equivalence.test.ts

Owner @beep/ontology-client; kind test; full read 1–15; 803 bytes; SHA256 `f97dd4030d5655b48f4fc45440a3165df88604655e42394eeb7f4e3756c7eb09`.

- **resource:** No additional change required by this lens: Declared-field equality constructs only local error values; no worker or timeout resource is started.
- **flake:** No additional change required by this lens: Two fixed comparisons are synchronous and independent of scheduling or shared mutable fixtures.
- **property:** No additional change required by this lens: Equal message instances compare true and distinct messages compare false. This deliberate positive/negative equivalence witness is meaningful without an invented generator requirement.
- **observability:** No additional change required by this lens: The named declared-field regression and explicit true/false operands identify equality failure; it is not evidence of a real worker timeout.

### packages/ontology/client/test/auto-open.test.ts

Owner @beep/ontology-client; kind test; full read 1–163; 6231 bytes; SHA256 `f718fe1a9af2bcc69ba32f5a00fb5fe72dd18aaabbb5c85dd3066a656cbf2088`.

- **resource:** All four cases manually dispose only after assertions; several ignore mount release handles. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve the one-attempt flag across intentional remounts within a case and the zero-call controls.
- **flake:** No additional change required by this lens: Public getResult awaits the dispatched open action. Once-only and preopened guards are synchronous in Session.atoms.ts3020-3037; intentional unmount/remount preserves the same registry. No sleep or external file access is required.
- **property:** No additional change required by this lens: Exact path/session identity, one open call, zero calls for preopened state and no retry after typed failure cover positive and negative bootstrap behavior. Preserve the keepAlive attempt flag and remount sequence; file paths are RPC data, not native FS operations.
- **observability:** No additional change required by this lens: The failure case asserts the exact tutorial error; unexpected RPC tags die. Named startup, preopened, once-only and failure cases separate the bootstrap contracts. No swallowed failure without an observed state assertion.

### packages/ontology/client/test/browser/graph-renderer-toggle.test.ts

Owner @beep/ontology-client; kind test; full read 1–213; 8278 bytes; SHA256 `7dc47b975e860fe0e4262095fd9a4147e6af3e0f90dac5d2edd5fec7b2e86b04`.

- **resource:** Both cases release DOM/mounts only at the successful tail; the second never disposes its registry. A timeout or failed assertion can retain the canvas, ResizeObserver, renderer and registry effects. Register failure-safe per-case teardown at acquisition, retaining explicit null-container/release observations before final teardown. Keep DOM, actual Cosmos/3D, subscriptions and renderer destruction order; MemoryFS or a fake renderer would erase this subject. First-case registry.dispose at141 also needs guaranteed finalization.
- **flake:** The two 300ms sleeps followed only by error=None do not establish selection or projection application. A delayed or dropped update also passes. Replace guessed elapsed-time completion with an observable public renderer/selection acknowledgement or actual browser-visible state, then retain all existing no-error and canvas/backend assertions. Keep real browser scheduling, projection and selected IRI; do not replace the renderer with a mock, increase timeout, or assume TestClock drives DOM/GPU callbacks. No browser failure was executed here.
- **property:** No additional change required by this lens: The six-node projection exercises actual Cosmos/3D DOM mounting and return-to-Cosmos backend/canvas conditions. Keep the real browser renderer and exact projection; the selection-completion weakness is captured in the flake row rather than duplicated here. These are not Node cohort executions.
- **observability:** No additional change required by this lens: waitFor includes a condition label and uses performance.now with live sleep under the browser 60-second body limit. Canvas-or-error wait prevents silently ignoring first-mount failure. Do not switch the browser to TestClock or claim watchdog coverage from a Node pass.

### packages/ontology/client/test/failure-messages.test.ts

Owner @beep/ontology-client; kind test; full read 1–84; 3537 bytes; SHA256 `4a791090b04c70ace5c52f5fedb8a84f7d5987b675464315313140a1ddc7ec40`.

- **resource:** The typed-error case never disposes its manually created registry; the defect case disposes only after assertions. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup.
- **flake:** No additional change required by this lens: Both scripted failure effects are awaited through getResult before state reads. Synthetic message paths do not access a filesystem, network or provider.
- **property:** The defect case maps None to empty text and only rejects private substrings; a missing user-facing error passes both checks. Add a positive Some/nonempty safe-message witness before retaining both exact not-toContain checks. Session.atoms.ts972-978 promises a generic failure message for untyped causes. Assert the intended safe contract without inventing an error/Cause value or exposing raw details; preserve the typed parse-message case.
- **observability:** No additional change required by this lens: Typed parse failure must show its own message without stack/module paths. Untyped defect deliberately tests redaction; its empty-output blind spot is the property finding. No real secret is resolved and no actual provider failure is demonstrated.

### packages/ontology/client/test/graph-centrality.test.ts

Owner @beep/ontology-client; kind test; full read 1–76; 2916 bytes; SHA256 `d1d63ab8f56c604f9bd55bd3c8271140af00d8abde35c8b8cd33a4b59788de98`.

- **resource:** No additional change required by this lens: Pure projection conversion allocates arrays and uses an identity-keyed module cache, with no renderer/resource acquisition. Different projection objects with the same revision are explicitly tested.
- **flake:** No additional change required by this lens: Conversion and cache writes are synchronous, so concurrent async scheduling cannot interleave inside a conversion. Source uses deterministic stride sampling above 1500; no random seed or wall-clock dependence.
- **property:** No additional change required by this lens: Distinct projection lengths prevent revision-only cache reuse; the 1500 exact path oracle and independent 1502 projections test deterministic sampling and a positive lower bound. Preserve the mathematical oracle and all array checks; no timing threshold is asserted.
- **observability:** No additional change required by this lens: Named cutover/cache regressions expose wrong lengths and numerical deviations. Retained duration is not a benchmark or proof of an algorithmic latency limit.

### packages/ontology/client/test/graph-labels.test.ts

Owner @beep/ontology-client; kind test; full read 1–66; 2196 bytes; SHA256 `5bb63121e54290eb73d5f296a2e32605fb0a5e04f7c0a2c2ac766c4232cee9b1`.

- **resource:** No additional change required by this lens: Pure Cosmos projection mapping returns local data without mounting Cosmos or creating a browser canvas.
- **flake:** No additional change required by this lens: Fixed full/hidden label options use no timers, shared mutation or external state.
- **property:** No additional change required by this lens: Exact two-label order and undefined hidden labels are complementary positive/negative controls. Keep both original expectations; no weaker truthiness assertion.
- **observability:** No additional change required by this lens: The named renderer-boundary examples identify missing labels. They prove mapping only, not browser-visible text rendering.

### packages/ontology/client/test/inspector-actions.test.ts

Owner @beep/ontology-client; kind test; full read 1–169; 7360 bytes; SHA256 `f7d3bff2e483d2852847a6f5102f79054ff7898c2f449c6b3a16bc2aa7bff419`.

- **resource:** Both cases mount several runtime/action atoms and dispose only after assertions. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve the sequential add/connect/instantiate scenario inside its one fresh registry.
- **flake:** No additional change required by this lens: Each async setter/action is acknowledged with getResult; parallel setter acknowledgements are joined by Effect.all. RPC behavior is local and the real domain mutation is synchronous. EV009 already records live-mode judgment; do not add a duplicate unexplained-live finding.
- **property:** No additional change required by this lens: Invalid/trimmed valid IRIs, unsupported object-kind retention, renderer choice, literal whitespace and connect/instantiate quad directions are all explicit. Exhaustive ChangeOperation.match fails the removeQuad branch. Preserve exact operands and RDF_TYPE, not merely successful RPC classification.
- **observability:** No additional change required by this lens: Unexpected tags and invalid batch shapes die explicitly. Each command mode has distinct subject/predicate/object assertions. The fake client runs the real change operation but no server or network; no additional diagnostic gap.

### packages/ontology/client/test/stale-read.test.ts

Owner @beep/ontology-client; kind test; full read 1–95; 3824 bytes; SHA256 `3709f9288d7730ada00fd23754d3906d5a46dd35d575055f3a9341658f427cd5`.

- **resource:** The manually created registry is never disposed, and its RPC can remain parked on releaseQuery if an earlier step fails. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Preserve both Deferred acknowledgements and stale-read ordering; ensure scope exit interrupts outstanding registry work rather than forcing a successful release/result that masks the failure.
- **flake:** No additional change required by this lens: Two Deferreds establish query entry, session mutation, then release before getResult. This is a controlled concurrent-read boundary, not guessed sleep; retain that ordering and native atom runtime.
- **property:** No additional change required by this lens: The same session is advanced by an actual change while an RPC is parked; the stale result must remain None and an error Some. Preserve Boolean polarity without inventing a payload. EV006 already tracks assertion family; no additional property weakness is proven.
- **observability:** No additional change required by this lens: The named stale-read regression and explicit result/error state expose the discarded read. Unexpected RPC tags die; teardown must not hide the original assertion or stranded Deferred failure.

### packages/ontology/client/test/workbench-state-lifetime.test.ts

Owner @beep/ontology-client; kind test; full read 1–65; 3002 bytes; SHA256 `de35387a7f969156ae1cd3ed97695bb505d9a3fe77e03fae5ac088f042c07527`.

- **resource:** The subject intentionally survives unmount but its owning registry is never disposed. Register fresh per-case registry disposal immediately using the existing scoped registry/finalizer seam, and release mounts before disposal even on assertion failure or interruption. Preserve each case's initialValues, pure client stub, actual atom runtime, assertions and any intentional unmount/remount before final teardown. Do not share mutable registries just to amortize setup. Final disposal must occur after the retained-document assertions, never before the idle observation.
- **flake:** No additional change required by this lens: The subject is AtomRegistry native Date.now/setTimeout eviction, not Effect TestClock time. Keep live mode, 40ms TTL and existing 200ms observation. A native eviction witness is the property proposal; no blanket replacement with virtual sleep.
- **property:** This test passes if idle eviction never occurs at all: it checks only keepAlive values after the delay. Add a separate ordinary removable atom in the same 40ms-TTL registry and witness its reset while the exact document/path/source/signature remain. Preserve native timers, current delay and intentional unmount; no private disposal hook or forced reset of the subject.
- **observability:** No additional change required by this lens: Named lifetime regression checks exact session/path/source/saved signature. The comment also mentions redo state but current empty redo setup is not evidence for retaining a nonempty redo history; report that limit without inventing execution.

### packages/ontology/client/test/worker-wire.test.ts

Owner @beep/ontology-client; kind test; full read 1–89; 3639 bytes; SHA256 `dbe62184ca64eb69f6ca390beeffa404ffba43cd6cc037ec4a3503ebcc16f28c`.

- **resource:** No additional change required by this lens: Real encode/decode and structuredClone exercise the local serialization boundary without creating a Worker, filesystem or remote service.
- **flake:** No additional change required by this lens: All operations are synchronous over fixed RDF data; structuredClone is the actual tested native operation, not an external worker timing dependency.
- **property:** The command round-trip checks only decode success and the result checks class membership; valid-but-empty or wrong RDF/projection content can still pass. Add schema-derived equivalence or exact meaningful snapshot/options and projection field expectations across the same encode/structuredClone/decode boundary, including existing focusIri=None. Preserve the unencoded-clone negative and actual native clone. If generalized with native Arbitrary, use real schemas and explicit fcRuns without lowering existing floors; this row does not authorize replacing current fixed regression witnesses.
- **observability:** No additional change required by this lens: The unencoded clone negative and decoded class check localize loss of domain prototypes. Preserve those checks and native structuredClone; no browser worker launch or message-event ordering is established by these tests.

## Proposed P2 sequence and uncertainty

After P1 acknowledgement: scope/cleanup first, including registry teardown before Worker-global restoration and native renderer release; assertions preserving every family/polarity and all existing witnesses; meaningful positive-control/serialization laws without smaller run floors; flake fixes using scoped global ownership and actual observable completion; finally instrumented-runner adoption preserving TestEnv and logs. No flakyTest, skipped case, global concurrency/timeout change or suppression proposed. EV009 requires actual native/detached scheduler judgment; browser rendering and native idle eviction are legitimate live subjects. Ordinary inspector setters still require Root adjudication of their current live mode.

This is a static source inventory. No test, browser, build, scan, benchmark, provider, secret or Git command was run. Passing historical Node registrations do not prove browser execution, absence of races, coverage or full package proof. P2 remains gated; no source mutation, exception transfer or canonical-write approval follows from a valid inventory. Preserve all original assertions/operands/polarities, property runs/seeds/discards, native subjects and limits. Root-reviewed P1 inventory; P2 remains gated.

Evidence: [timing index](../timings/baseline-index.json), [configured subsets](../timings/configured-subsets.json), and [hosted history](../hosted-history-summary.json). Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.

Quoted fixture literals are preserved in the
[reference evidence receipt](../../../history/2026-09-21-p1-reference-evidence/README.md).
They are test data, not instructions to use a machine-local path.

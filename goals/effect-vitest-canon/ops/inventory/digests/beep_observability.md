# @beep/observability — P1 four-lens digest

All 19 census files were fully read: 16 tests, three support fixtures, 1,689 lines and 61,964 bytes. All 76 file/lens pairs have rows. Fourteen review items include three informational logger-adoption constraints; 62 rows are prescribed NONE coverage. Severity totals are one major, ten minor and 65 info. All remain open judgments, not accepted exceptions.

| Lens | Rows | Review | NONE |
|---|---:|---:|---:|
| resource | 19 | 2 | 17 |
| flake | 19 | 0 | 19 |
| property | 19 | 8 | 11 |
| observability | 19 | 4 | 15 |

Top ten files by row count (all files tie at four; lexical ordering):

- `Boundary.test.ts` — four.
- `CauseDiagnostics.test.ts` — four.
- `CauseRedaction.test.ts` — four.
- `DevTools.test.ts` — four.
- `DevToolsRelay.test.ts` — four.
- `ErrorReporting.test.ts` — four.
- `HttpApiTelemetry.test.ts` — four.
- `HttpError.test.ts` — four.
- `Logging.test.ts` — four.
- `Metric.test.ts` — four.

## Layers, native subjects and rebuild costs

Cause/HTTP errors, options, fingerprints and codec tests are pure computations. HTTP endpoint descriptors and HttpServerResponse are in-process values, not bound HTTP servers. DevTools schema filters do not connect their ws URL. ServerUtilities constructs but never builds its disabled LGTM layer. The three consumer fixtures are compiler input only: tsc --noEmit reads them but does not execute the OTLP-enabled server fixture. No remote service, database, provider or credential was acquired by this audit.

CauseRedaction allocates two distinct capture layers plus one silent logger layer; Logging builds separate Info and None capture layers; PhaseProfiler has one capture layer. Each capture block has one case and its own array. These are source construction sites, not measured setup cost. Preserve logger replacement, minimum level, exact count/order and Cause annotations. Public tester instrumentation must not append start/end records into subject arrays or defeat None filtering. The three L-OBS-04 rows are concrete P2 isolation constraints, not current leaks.

DevToolsRelay.test supplies a fake server. The production make constructor (DevToolsRelay.ts:124–204) obtains its address, Clock and mutable state but never invokes run. Effect.never is a dormant fake method, not a stuck test. The real relay server layer forks transport handling elsewhere; this test does not prove socket lifecycle. Its empty metrics snapshot is insufficient to witness ingestion: ignoring that request also yields count zero. Preserve it and add a nonempty pinned snapshot plus actual stored payload/count checks.

OtlpPacketLab builds two independent scoped serialization environments. Production makeLayer creates fresh mutable packet storage with Clock and wraps real JSON/protobuf serializers. Snapshot assertions occur after the helper scope closes; do not accidentally share encoding buffers or remove real serialization while migrating the EV003 wrapper. Add exact one-packet cardinality to detect duplicate captures while retaining every metadata assertion. Serialized body/size checks must follow the actual encoding contract, not fabricate nonempty protobuf output for an empty request.

NodeSdk’s two actual layer cases use SimpleSpanProcessor/InMemorySpanExporter with OTLP disabled. Existing scopes own built SDK lifecycle; keep processors distinct and real tracer access. The separate config-only case enables OTLP, directly constructs BatchSpanProcessor/OTLPTraceExporter (NodeSdk.ts:199–211), then only inspects shape. It does not hand the processor to a built SDK or shut it down. Assign an explicit cleanup owner without changing assertions or initiating export. This is an ownership review; no active timer, network request or leak was reproduced. An attempted lookup in two common installed SDK paths found no file; no unsupported constructor-internals claim is made.

Boundary.test executes three real compiler subprocesses sequentially, with 600000ms task budget. runTypecheck discards each child handle and both output streams. Scope cleanup must terminate/await the child on interruption; timeout alone is not ownership. Keep the real source/config/export/ambient subject and all three fixtures. MemoryFileSystem cannot replace a test of the actual package compiler boundary. Bounded output capture should retain compiler errors with safe fixture-relative identity; current diagnostics only give path and exit code.

## Assertion/property judgments

Metric’s fail("boom") and interruption cases assert only Failure, and observeWorkflow discards its Exit. PhaseProfiler also discards failure/interruption Exits while checking side effects. An unrelated defect after recording metrics could pass. Preserve counters and annotations, and additionally prove original typed error/interruption. Metric.ts:235–251 explicitly re-emits the captured Cause; PhaseProfiler.ts:222–282 uses onExit around the original effect. HttpApiTelemetry similarly needs the original backend-unavailable error witness alongside 503 classification and 5xx count.

CauseDiagnostics calls fingerprint once; add equal-input repeat and deliberately distinct-message/class controls for its stability claim. Fingerprint composition normalizes/truncates message chunks (CauseDiagnostics.ts:351–366); do not require all distinct strings to be collision-free. Observed’s schema membership laws are legitimate arbitrary controls but do not exercise generated encode/decode; add codec laws using declared equivalence/canonical projections rather than demanding Error identity through JSON. Keep fixed failed-Cause and failed-Exit examples and all fcRuns(50) floors.

Prometheus sanitation currently checks removal of Infinity and presence of +Inf, but not preservation of the ordinary le=10 bucket. Add that exact witness without removing either assertion. Production sanitizer only filters matching lines (Prometheus.ts:30–33). No current production loss is claimed.

No independent flake was established. Package sequence.concurrent is false, metric names distinguish scenarios, and capture arrays are separate. Clock reads do not imply sleeps; elapsedMillis only asserts nonnegative output. Do not add arbitrary resets, live mode, retries, timeout increases or metric-registry global policy changes. Retain all eleven native property checks with configured seeds/floors and all negative fixtures.

## Retained timing and history

Root’s accepted first Node command represents 16 test files/80 passed tests; three support files are compiler inputs, not separately executed test suites. Exit zero, whole command 10.367386381s, reporter span 9905.110352ms. Node22.22.3/Bun1.4.2/Vitest4.1.11, exact raw identities, per-file and slowest-test records are retained in the public timing context. Boundary is slowest at 2490.110352ms. These overlapping file spans and host-load measurements are not additive rebuild costs or predicted savings. Pool forks/file parallelism/isolation, capacity63, maxConcurrency5 and serial per-package test ordering are settings, not demonstrated races.

No hosted observation maps to observability in the retained summary. That is not proof of no failures. Globally, 527 failed runs include 21 unavailable logs and one unresolved cause; mapped coverage paths are not test failures. All 139 timings remain 132 accepted full-file baselines, four configured subsets, three failures. Preserve other packages’ Bun.sqlite Node collection and excluded graph-3d browser boundaries. Installed Vitest4.1.11 remains outside rc113’s declared >=5 <6 peer range; existing accepted runtime evidence does not authorize a dependency change.

## Proposed P2 order

Scope the compiler child and constructed processor first, preserving real compilation and SDK ownership. Resolve existing runtime/wrapper/Option candidates without changing operands or causes; strengthen failure preservation. Then add the bounded property/cardinality/preservation witnesses. Investigate only demonstrated flake causes. Adopt public instrumentation last, explicitly protecting subject loggers and all tester modes. No P2 implementation is authorized here.

All 67 detector candidates remain open with exact payloads: 27 EV001, two EV003, nine EV006, eleven EV007, twelve EV011 and six EV014. No support-file candidate is emitted. Human rows do not duplicate those syntax findings or automatically infer a container timeout from local Logger layers. Strict public decoding, full census/owner/line/primitive/ID checks, all 76 pairs and exact public re-encoding passed. This is static P1 inventory, not runtime, coverage, transport delivery, package proof, race freedom or canonical acceptance.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

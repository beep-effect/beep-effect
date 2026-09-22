# @beep/ciops — P1 wave006-b digest

P1 source inventory reviewed by Root; P2 remains gated. All 2 assigned files were read completely through all four lenses. No source or canonical edits, tests or optional service gates were executed.

Rows: 8 = 2 actionable judgment candidates + 6 file-specific coverage rows. Lens counts: resource 2, flake 2, property 2, observability 2. Severity counts: info 6, minor 2. All are open; every row passed the strict public decoder.

Layer topology and native boundaries: The health fixture owns local HTTP handler disposal; projection tests build FileSystem contexts around real ratified artifact reads and isolated projection service state. Retain frozen artifact provenance and queue lifetime. The Node worker failed before test execution, so there is no accepted CiOps duration or rebuild comparison.

Top files by actionable count (all assigned files; fewer than ten):

- apps/labs/ciops/test/projection.test.ts: 2 actions, 4 rows; read 1–644.
- apps/labs/ciops/test/health.test.ts: 0 actions, 4 rows; read 1–24.

Detailed findings:

- L-PROP-04, apps/labs/ciops/test/projection.test.ts:214 (minor, confidence 1): The occurs-once property converts both projected arrays to HashSet before all comparisons. For pending [a], steps [a] and deferredTail [a] satisfy both set sizes and subset checks despite duplicate output. Assert the combined array cardinality and per-nonce occurrence/disjointness before deduplication, retaining every current set assertion, unique-input generation, policy weights and fcRuns(64). Engine.ts:165-242 returns steps and deferredTail separately; no actual duplicate production output is claimed.
- L-OBS-01, apps/labs/ciops/test/projection.test.ts:145 (minor, confidence 1): The four manual checks use captured runSync and assertion-bearing callbacks then reduce the result to Passed. A thrown assertion bypasses native PropertyError normalization; false-result details are not formatted here. Use four named Effect adapter properties with the same policy setup, inputs and explicit fcRuns(64), fcRuns(64), fcRuns(64), fcRuns(48). Preserve all fixed journal/saturation cases and do not conflate file setup failure with a generated counterexample.

Recorded runtime evidence: The first attempt exited 1 after 10.366359 seconds with no registered tests: the threads pool rejects --js-float16array from shared Node<24 execArgv. Root attributes this to the unchanged inherited compatibility boundary. No test bodies ran and no accepted baseline exists.

Global collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. No timing is rerun, normalized or selected as best-of. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 are the recorded runtimes; rc113 API semantics are pinned separately. No supported Vitest peer claim, code coverage or full package proof follows from these passes.

Hosted evidence: 0 matching observations across 0 jobs in the completed 527-failed-run collection. No matching observation is not a claim of no historical or rare failures. The collection includes 21 unavailable logs and one unresolved cause; causal attribution and unique-flake counts remain unproved. Exact matching records and source summary hashes are retained privately.

Proposed internal P2 order remains scope, assertions, property, flake, observability. First review ownership/native boundaries and any resource candidates; then preserve complete tagged/plain assertion operands; address the listed oracle/generator gaps; make any demonstrated clock/cancellation corrections without retries; finally migrate manual property diagnostics through the accepted instrumented public tester. This order proposes review work only. Existing scanner candidates and the 90 inherited-main ratchet additions remain open and unchanged. No waiver, threshold change or P2 implementation is authorized.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

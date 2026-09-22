# @beep/chalk — P1 wave006-b digest

P1 source inventory reviewed by Root; P2 remains gated. All 2 assigned files were read completely through all four lenses. No source or canonical edits, tests or optional service gates were executed.

Rows: 8 = 1 actionable judgment candidates + 7 file-specific coverage rows. Lens counts: resource 2, flake 2, property 2, observability 2. Severity counts: info 7, minor 1. All are open; every row passed the strict public decoder.

Layer topology and native boundaries: Pure schema/style/detection checks use fresh builders and synchronous singleton-level restoration. Detection facts are injected. There is no outer service layer, temporary filesystem or process to share. No resource rebuild savings are established.

Top files by actionable count (all assigned files; fewer than ten):

- packages/foundation/capability/chalk/test/index.test.ts: 1 actions, 4 rows; read 1–315.
- packages/foundation/capability/chalk/test/TaggedError.equivalence.test.ts: 0 actions, 4 rows; read 1–40.

Detailed findings:

- L-OBS-01, packages/foundation/capability/chalk/test/index.test.ts:195 (minor, confidence 1): Eleven schemas share a manual native runner and callback assertions; a throwing codec/assertion can bypass formatted property failure and replay context. Register or label each schema property through the adapter while preserving fcRuns(50), the existing Equal.equals(decoded,value) and all eleven inputs. The replacement must not weaken equality or collapse schema identity into an unnamed Boolean. No failing seed was run.

Recorded runtime evidence: Root accepted one configured Node command baseline: 18 registered tests, {'passed': 18}; whole command 8.180706 seconds, reporter total 7757.191406 ms. These are different measurements. Slowest files (up to ten, including all represented files):

- packages/foundation/capability/chalk/test/index.test.ts: 23.191406 ms, 17 registered tests.
- packages/foundation/capability/chalk/test/TaggedError.equivalence.test.ts: 1.247314 ms, 1 registered tests.

Global collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. No timing is rerun, normalized or selected as best-of. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 are the recorded runtimes; rc113 API semantics are pinned separately. No supported Vitest peer claim, code coverage or full package proof follows from these passes.

Hosted evidence: 0 matching observations across 0 jobs in the completed 527-failed-run collection. No matching observation is not a claim of no historical or rare failures. The collection includes 21 unavailable logs and one unresolved cause; causal attribution and unique-flake counts remain unproved. Exact matching records and source summary hashes are retained privately.

Proposed internal P2 order remains scope, assertions, property, flake, observability. First review ownership/native boundaries and any resource candidates; then preserve complete tagged/plain assertion operands; address the listed oracle/generator gaps; make any demonstrated clock/cancellation corrections without retries; finally migrate manual property diagnostics through the accepted instrumented public tester. This order proposes review work only. Existing scanner candidates and the 90 inherited-main ratchet additions remain open and unchanged. No waiver, threshold change or P2 implementation is authorized.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

# @beep/brand — P1 wave006-b digest

P1 source inventory reviewed by Root; P2 remains gated. All 3 assigned files were read completely through all four lenses. No source or canonical edits, tests or optional service gates were executed.

Rows: 12 = 2 actionable judgment candidates + 10 file-specific coverage rows. Lens counts: resource 3, flake 3, property 3, observability 3. Severity counts: info 10, minor 2. All are open; every row passed the strict public decoder.

Layer topology and native boundaries: Pure renderer/schema/React cases coexist with scoped Bun FileSystem/Path reads of tracked golden assets. The native files are the oracle, not an application FileSystem service to replace blindly. No server or shared database is acquired. Asset rendering costs are not independently benchmarked.

Top files by actionable count (all assigned files; fewer than ten):

- packages/foundation/ui-system/brand/test/Brand.test.ts: 1 actions, 4 rows; read 1–154.
- packages/foundation/ui-system/brand/test/assets.test.ts: 1 actions, 4 rows; read 1–53.
- packages/foundation/ui-system/brand/test/react.test.tsx: 0 actions, 4 rows; read 1–28.

Detailed findings:

- L-OBS-01, packages/foundation/ui-system/brand/test/Brand.test.ts:146 (minor, confidence 1): The schema round-trip is evaluated by a manual native check within one ordinary case. A thrown encode/decode/assertion is not normalized by the adapter property callback, and a Passed summary does not render the native shrink/replay report. Use a named adapter property for BrandIdentity, retaining fcRuns(5), equality and exact codec assertions. rc113 internal.ts:96-123 normalizes defects and formats failures; do not infer an observed failing seed or lower the floor.
- L-PROP-04, packages/foundation/ui-system/brand/test/assets.test.ts:22 (minor, confidence 1): The golden comparison iterates only renderBrandAssets output; no independent expected asset path set is asserted. A renderer returning only the favicon can evade the other asset comparisons while satisfying the separate favicon and CSS bridge checks. Brand.assets.ts:84-117 specifies five paths. Assert their exact set and multiplicity, then retain every existing byte-for-byte comparison, bridge variable check and favicon assertion. This is a test oracle gap, not a current missing asset.

Recorded runtime evidence: Root accepted one configured Node command baseline: 17 registered tests, {'passed': 17}; whole command 7.572369 seconds, reporter total 7178.162354 ms. These are different measurements. Slowest files (up to ten, including all represented files):

- packages/foundation/ui-system/brand/test/react.test.tsx: 59.162354 ms, 2 registered tests.
- packages/foundation/ui-system/brand/test/Brand.test.ts: 36.477295 ms, 12 registered tests.
- packages/foundation/ui-system/brand/test/assets.test.ts: 12.987549 ms, 3 registered tests.

Global collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. No timing is rerun, normalized or selected as best-of. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 are the recorded runtimes; rc113 API semantics are pinned separately. No supported Vitest peer claim, code coverage or full package proof follows from these passes.

Hosted evidence: 0 matching observations across 0 jobs in the completed 527-failed-run collection. No matching observation is not a claim of no historical or rare failures. The collection includes 21 unavailable logs and one unresolved cause; causal attribution and unique-flake counts remain unproved. Exact matching records and source summary hashes are retained privately.

Proposed internal P2 order remains scope, assertions, property, flake, observability. First review ownership/native boundaries and any resource candidates; then preserve complete tagged/plain assertion operands; address the listed oracle/generator gaps; make any demonstrated clock/cancellation corrections without retries; finally migrate manual property diagnostics through the accepted instrumented public tester. This order proposes review work only. Existing scanner candidates and the 90 inherited-main ratchet additions remain open and unchanged. No waiver, threshold change or P2 implementation is authorized.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

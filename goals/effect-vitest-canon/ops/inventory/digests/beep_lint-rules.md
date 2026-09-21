# @beep/lint-rules — wave006-d recovery digest

P1 four-lens inventory reviewed by Root; P2 remains gated. 9 complete assigned files; prior reads reused only after exact current source hash verification. Original usage-limit interruption remains recorded; no original artifact changed.

36 rows: 8 actionable judgments and 28 file-specific coverage rows. Lens counts: {'resource': 9, 'flake': 9, 'property': 9, 'observability': 9}. Severity counts: {'info': 28, 'major': 2, 'minor': 6}. All open; all passed fresh strict public decoding.

Native Biome and oxlint processes read the same on-disk config, source, plugin and supporting bytes written through FileSystem. Each call owns a unique acquireUseRelease temporary directory; cleanup errors are ignored and synchronous process calls can delay JavaScript watchdog execution. No child hang or leftover directory was reproduced. Do not replace the writer alone with MemoryFS or mock the plugin under test. Registry reads also require actual tracked files. Per-case platform builds and child startup have no independently measured cost breakdown; no speedup is claimed.

Top files by actionable count (at most ten):

- packages/tooling/policy-pack/lint-rules/test/oxlint-harness.ts: 2 actions; support; full read 1–262.
- packages/tooling/policy-pack/lint-rules/test/registry.test.ts: 2 actions; test; full read 1–133.
- packages/tooling/policy-pack/lint-rules/test/codec.ts: 1 actions; support; full read 1–45.
- packages/tooling/policy-pack/lint-rules/test/harness.ts: 1 actions; support; full read 1–132.
- packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts: 1 actions; test; full read 1–124.
- packages/tooling/policy-pack/lint-rules/test/schema-parity.test.ts: 1 actions; test; full read 1–95.
- packages/tooling/policy-pack/lint-rules/test/oxlint-sources.ts: 0 actions; support; full read 1–436.
- packages/tooling/policy-pack/lint-rules/test/rules.test.ts: 0 actions; test; full read 1–37.
- packages/tooling/policy-pack/lint-rules/test/sources.ts: 0 actions; support; full read 1–46.

Detailed judgment findings:

- L-OBS-01 at packages/tooling/policy-pack/lint-rules/test/codec.ts:44 (major, confidence 1): jsonReportParser replaces every JSON/schema decode failure with the empty fallback used by both harnesses. Invalid/noisy stdout can therefore satisfy rules.test.ts:32 and oxlint-rules.test.ts:118 zero-findings checks. Preserve malformed-report failure separately from a successfully decoded empty report and carry process status/stderr as bounded diagnostic context. Expected lint exits for warning/error rules must remain allowed; do not blanket-require exit zero or expose unlimited output. This is a static oracle ambiguity, not a reproduced process failure.
- L-RES-04 at packages/tooling/policy-pack/lint-rules/test/harness.ts:103 (minor, confidence 1): The FileSystem service writes config/source into a temporary directory, but Bun.spawnSync invokes Biome, which reads those paths through the OS. Replacing only the Effect writer with MemoryFS would make the real lint process read a different filesystem. Retain this native parser/plugin subject and acquireUseRelease cleanup; any future virtualization must preserve both writer and external reader visibility. This cross-process consumer is evidence beyond the caller EV010 import candidate.
- L-RES-04 at packages/tooling/policy-pack/lint-rules/test/oxlint-harness.ts:202 (minor, confidence 1): Oxlint consumes the actual config, plugin path, main fixture and supporting runtime files from disk, including extension-resolution/fix behavior. A MemoryFS-only writer cannot supply the subprocess view. Preserve native temporary file ownership, exact filenames and supporting bytes; do not replace the plugin execution with a mock just to satisfy a platform import candidate.
- L-OBS-01 at packages/tooling/policy-pack/lint-rules/test/oxlint-harness.ts:207 (major, confidence 1): The lint helper drops exitCode/stderr and the fix helper ignores the entire process result at252-257. Combined with empty-report fallback, a failed invocation can look like a valid silent case; the escaped-module no-fix fixture also expects unchanged source, so unchanged output does not prove a successful fixer run. Return/validate the actual process outcome and decoded report separately, retaining legitimate rule warning/error exits and exact fixedSource assertions. Do not turn every nonzero lint exit into an unrelated generic failure.
- L-PROP-04 at packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts:85 (minor, confidence 1): Four compiler calls are visited: two static inputs and two runtime inputs. The only oracle for this in-process case is reports.length===2. Reporting the two runtime nodes instead of the static nodes still satisfies it. Assert exact reported node identities or labels/locations and absence for the two runtime forms, retaining the total and the separate subprocess fixture cases. This closes this test-specific distinguishing gap; it is not a claim the full package misses those forms.
- L-PROP-04 at packages/tooling/policy-pack/lint-rules/test/registry.test.ts:127 (minor, confidence 1): The wiring proof searches raw JSONC for rules/<name>.grit. A commented-out or unrelated-string reference can satisfy includes without an active plugin entry. Parse through an existing JSONC mechanism and inspect effective plugins/overrides for the required rules, preserving current scope semantics, exact registry membership and orphan-file checks. Do not alter config or infer the current wiring is broken; the counterexample is a weakened test oracle.
- L-OBS-01 at packages/tooling/policy-pack/lint-rules/test/registry.test.ts:104 (minor, confidence 1): The manual native check contains throwing codec/assertion callbacks and reduces the result to Passed. It bypasses rc113 adapter normalizeProperty and formatted shrink/replay failure output (internal.ts:96-123); the native runner directly invokes the callback. Use named adapter property registration while preserving the complete RuleRegistry law and fcRuns(50), including full equality. This adds exact failure-context evidence beyond EV001/EV007 syntax; no failing seed was run and no floor may be lowered.
- L-OBS-01 at packages/tooling/policy-pack/lint-rules/test/schema-parity.test.ts:25 (minor, confidence 1): The manual native check contains throwing codec/assertion callbacks and reduces the result to Passed. It bypasses rc113 adapter normalizeProperty and formatted shrink/replay failure output (internal.ts:96-123); the native runner directly invokes the callback. Use named adapter property registration while preserving all three named ImportBinding/BiomeReport/OxlintReport laws, fcRuns(50) each, matched local names and present-coordinate bounds. This adds exact failure-context evidence beyond EV001/EV007 syntax; no failing seed was run and no floor may be lowered.

Recorded Root baseline: 66 registered tests, {'passed': 66}, whole command 21.274880 seconds; reporter total 20904.975342 ms. These are distinct timing measures. Slowest represented test files (up to ten; support files are not separately executed tests):

- packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts: 19303.975342 ms, 48 registered tests.
- packages/tooling/policy-pack/lint-rules/test/rules.test.ts: 359.448730 ms, 8 registered tests.
- packages/tooling/policy-pack/lint-rules/test/registry.test.ts: 20.960205 ms, 7 registered tests.
- packages/tooling/policy-pack/lint-rules/test/schema-parity.test.ts: 13.815674 ms, 3 registered tests.

All 139 first attempts are complete: 132 accepted full-file-representation baselines, four configured subsets, three failures. Runtime Node 22.22.3/Bun 1.4.2/Vitest 4.1.11; exact rc113 API pin is separate from peer-support acceptance. No run was repeated, normalized or selected as best-of. Passing observations do not prove compiler/coverage/full-package proof, absence of races, or external provider behavior. Other failed Node cohorts retain their inherited compatibility limitations.

Completed hosted summary: 0 matching observations across 0 jobs. No matching observations does not prove zero historical or rare failures. The 527-failed-run collection includes 21 unavailable logs and one unresolved cause; causal completeness remains limited. No logs/timings/providers were collected by this lane.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve native boundaries and lifetime ownership first; retain every assertion operand/polarity and error payload; review the concrete oracle gaps; address only demonstrated nondeterminism; then adopt named adapter/instrumented properties without reducing floors. No change is authorized here. Root owns canonical assembly, acceptance and proof. The 90 inherited-main ratchet additions remain unchanged.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

# @beep/mcp-kit — wave006-d recovery digest

P1 four-lens inventory reviewed by Root; P2 remains gated. 7 complete assigned files; prior reads reused only after exact current source hash verification. Original usage-limit interruption remains recorded; no original artifact changed.

28 rows: 6 actionable judgments and 22 file-specific coverage rows. Lens counts: {'resource': 7, 'flake': 7, 'property': 7, 'observability': 7}. Severity counts: {'info': 22, 'minor': 6}. All open; all passed fresh strict public decoding.

McpServer registration is local and uses pure stub caller services, not a transport listener. Soft credential reads occur per handler call, while hard gate decisions occur during layer build with explicit upstream ConfigProvider. Shared layer registration remains distinct from per-test tracer captures, per-call caller identity and local recording Refs. Current tests contain no container/remote acquisition. Preserve sanitization as the subject and do not replace the recording tracer with a generic logger. No rebuild-cost estimate is established.

Top files by actionable count (at most ten):

- packages/foundation/capability/mcp-kit/test/FieldTier.test.ts: 2 actions; test; full read 1–142.
- packages/foundation/capability/mcp-kit/test/TierGate.test.ts: 2 actions; test; full read 1–258.
- packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts: 1 actions; test; full read 1–140.
- packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts: 1 actions; test; full read 1–74.
- packages/foundation/capability/mcp-kit/test/SanitizedSpan.test.ts: 0 actions; test; full read 1–145.
- packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts: 0 actions; test; full read 1–298.
- packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts: 0 actions; support; full read 1–41.

Detailed judgment findings:

- L-OBS-01 at packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts:72 (minor, confidence 1): The manual native check contains throwing codec/assertion callbacks and reduces the result to Passed. It bypasses rc113 adapter normalizeProperty and formatted shrink/replay failure output (internal.ts:96-123); the native runner directly invokes the callback. Use named adapter property registration while preserving SourceAuthRegistration and ApiKeyRequiredFailure, defaults and fcRuns(50) each. This adds exact failure-context evidence beyond EV001/EV007 syntax; no failing seed was run and no floor may be lowered.
- L-PROP-04 at packages/foundation/capability/mcp-kit/test/FieldTier.test.ts:98 (minor, confidence 1): The balanced projection compares keys only, and the budget tests check tag/tier/size/omission. Returning wrong schema-valid values for those same retained keys can pass. FieldTier.ts:154-203 filters existing entries and should preserve surviving values. Assert the exact retained abstractText/documentId/title values for balanced and the corresponding minimal subset, retaining all existing budget, handle and columnar assertions. No blanket equality is required for deliberately stripped null/undefined fields.
- L-OBS-01 at packages/foundation/capability/mcp-kit/test/FieldTier.test.ts:46 (minor, confidence 1): The manual native check contains throwing codec/assertion callbacks and reduces the result to Passed. It bypasses rc113 adapter normalizeProperty and formatted shrink/replay failure output (internal.ts:96-123); the native runner directly invokes the callback. Use named adapter property registration while preserving FetchableHandle, FieldProjectionOutcome and ColumnarEnvelope, S.toEquivalence and fcRuns(50) each. This adds exact failure-context evidence beyond EV001/EV007 syntax; no failing seed was run and no floor may be lowered.
- L-PROP-04 at packages/foundation/capability/mcp-kit/test/TierGate.test.ts:55 (minor, confidence 1): Refusal cases pass Effect.succeed("this handler must never run"), which has no observable execution marker. Even the no-settlement test only observes recordOutcome. An implementation that evaluates the handler and discards its value before returning Refused could pass. Add a local execution counter/Ref or failing sentinel with a retained zero-execution assertion for refused calls, plus a positive approved control; preserve every audit and settlement assertion. Production dispatchWithTierGate:597-610 currently selects onApproved only for approval.
- L-OBS-01 at packages/foundation/capability/mcp-kit/test/TierGate.test.ts:35 (minor, confidence 1): The manual native check contains throwing codec/assertion callbacks and reduces the result to Passed. It bypasses rc113 adapter normalizeProperty and formatted shrink/replay failure output (internal.ts:96-123); the native runner directly invokes the callback. Use named adapter property registration while preserving all four TierGate schemas, S.toEquivalence, toolCallId defaults/invalid controls and fcRuns(50) each. This adds exact failure-context evidence beyond EV001/EV007 syntax; no failing seed was run and no floor may be lowered.
- L-PROP-04 at packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts:57 (minor, confidence 1): The absent-key case asserts only Result.Failure. A mounted tool that fails for another reason also satisfies it. Assert that hard_source_tool is absent from the server registration list and absent from observable acquisition/handler markers, and distinguish the expected missing-tool failure when its contract is available. Preserve the current failure tag and the present-key success/isError:false checks; do not invent an upstream error payload. composeGatedLayers:134-153 actually filters before building layers.

Recorded Root baseline: 43 registered tests, {'passed': 43}, whole command 7.671486 seconds; reporter total 7221.794434 ms. These are distinct timing measures. Slowest represented test files (up to ten; support files are not separately executed tests):

- packages/foundation/capability/mcp-kit/test/TierGate.test.ts: 33.794434 ms, 12 registered tests.
- packages/foundation/capability/mcp-kit/test/FieldTier.test.ts: 30.010010 ms, 7 registered tests.
- packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts: 21.546143 ms, 4 registered tests.
- packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts: 13.615234 ms, 10 registered tests.
- packages/foundation/capability/mcp-kit/test/SanitizedSpan.test.ts: 8.675781 ms, 8 registered tests.
- packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts: 4.040039 ms, 2 registered tests.

All 139 first attempts are complete: 132 accepted full-file-representation baselines, four configured subsets, three failures. Runtime Node 22.22.3/Bun 1.4.2/Vitest 4.1.11; exact rc113 API pin is separate from peer-support acceptance. No run was repeated, normalized or selected as best-of. Passing observations do not prove compiler/coverage/full-package proof, absence of races, or external provider behavior. Other failed Node cohorts retain their inherited compatibility limitations.

Completed hosted summary: 4 matching observations across 2 jobs. These are production coverage-ratchet observations, not failed test cases or unique flakes. The 527-failed-run collection includes 21 unavailable logs and one unresolved cause; causal completeness remains limited. No logs/timings/providers were collected by this lane.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve native boundaries and lifetime ownership first; retain every assertion operand/polarity and error payload; review the concrete oracle gaps; address only demonstrated nondeterminism; then adopt named adapter/instrumented properties without reducing floors. No change is authorized here. Root owns canonical assembly, acceptance and proof. The 90 inherited-main ratchet additions remain unchanged.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

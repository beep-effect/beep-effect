# @beep/phoenix — wave006-d recovery digest

P1 four-lens inventory reviewed by Root; P2 remains gated. 2 complete assigned files; prior reads reused only after exact current source hash verification. Original usage-limit interruption remains recorded; no original artifact changed.

8 rows: 2 actionable judgments and 6 file-specific coverage rows. Lens counts: {'resource': 2, 'flake': 2, 'property': 2, 'observability': 2}. Severity counts: {'info': 6, 'minor': 2}. All open; all passed fresh strict public decoding.

Phoenix.makeLayerWithSdk is verified Layer.succeed around an injected SDK. Promise rejection is intentional transport error data; no live Phoenix layer or environment credentials are acquired. Preserve typed transport errors, exact wire-shape normalization, guard-before-SDK behavior and encoded law semantics. The source supplies no evidence of expensive outer-resource rebuilding.

Top files by actionable count (at most ten):

- packages/drivers/phoenix/test/Phoenix.service.test.ts: 2 actions; test; full read 1–297.
- packages/drivers/phoenix/test/Phoenix.equivalence.test.ts: 0 actions; test; full read 1–24.

Detailed judgment findings:

- L-PROP-04 at packages/drivers/phoenix/test/Phoenix.service.test.ts:287 (minor, confidence 1): The empty-selector test checks PhoenixError operation/config but uses okSdk.getPrompt, which succeeds if invoked. Calling it and then returning the expected config error would still pass. Give this occurrence a local call counter or unexpected-call rejection and assert zero SDK calls while retaining all current error fields. Phoenix.service.ts:623-631 performs the guard before callSdk; this is missing evidence for the claimed ordering, not a demonstrated production call.
- L-OBS-01 at packages/drivers/phoenix/test/Phoenix.service.test.ts:179 (minor, confidence 1): The loop discards each publicSchemaRoundTripCases label and runs 22 schemas inside one manual native check case. Thrown codecs/assertions bypass adapter normalization and Passed does not format shrinking/replay details. Register named properties using the retained schema labels and rc113 adapter, preserving every schema, fcRuns(5) and encoded-decode-reencoded equality. Do not replace the encoded stability law with raw Error identity or silently raise/lower its normal floor.

Recorded Root baseline: 9 registered tests, {'passed': 9}, whole command 6.221590 seconds; reporter total 5872.476074 ms. These are distinct timing measures. Slowest represented test files (up to ten; support files are not separately executed tests):

- packages/drivers/phoenix/test/Phoenix.service.test.ts: 40.476074 ms, 7 registered tests.
- packages/drivers/phoenix/test/Phoenix.equivalence.test.ts: 1.453369 ms, 2 registered tests.

All 139 first attempts are complete: 132 accepted full-file-representation baselines, four configured subsets, three failures. Runtime Node 22.22.3/Bun 1.4.2/Vitest 4.1.11; exact rc113 API pin is separate from peer-support acceptance. No run was repeated, normalized or selected as best-of. Passing observations do not prove compiler/coverage/full-package proof, absence of races, or external provider behavior. Other failed Node cohorts retain their inherited compatibility limitations.

Completed hosted summary: 0 matching observations across 0 jobs. No matching observations does not prove zero historical or rare failures. The 527-failed-run collection includes 21 unavailable logs and one unresolved cause; causal completeness remains limited. No logs/timings/providers were collected by this lane.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve native boundaries and lifetime ownership first; retain every assertion operand/polarity and error payload; review the concrete oracle gaps; address only demonstrated nondeterminism; then adopt named adapter/instrumented properties without reducing floors. No change is authorized here. Root owns canonical assembly, acceptance and proof. The 90 inherited-main ratchet additions remain unchanged.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

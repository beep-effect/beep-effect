# @beep/openai-compat — wave006-d recovery digest

P1 four-lens inventory reviewed by Root; P2 remains gated. 1 complete assigned files; prior reads reused only after exact current source hash verification. Original usage-limit interruption remains recorded; no original artifact changed.

4 rows: 0 actionable judgments and 4 file-specific coverage rows. Lens counts: {'resource': 1, 'flake': 1, 'property': 1, 'observability': 1}. Severity counts: {'info': 4}. All open; all passed fresh strict public decoding.

The outer layer is Layer.empty; the client layer resolves an injected HttpClient with local Response objects. Refs are per-test, streams are finite generated fixtures, and failure-before-provider sentinels preserve the actual request/stream translation boundary. No real OpenAI provider is invoked. The 10 MiB SSE input intentionally exceeds the parser bound; do not weaken it to improve runtime. No resource sharing or speedup follows from the open EV002/EV014 candidates.

Top files by actionable count (at most ten):

- packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts: 0 actions; test; full read 1–953.

Detailed judgment findings:

No additional actionable residue established. The four explicit file/lens coverage explanations preserve the provider/HTTP/stream subject and the complete current assertions. Mechanical candidates remain open.

Recorded Root baseline: 19 registered tests, {'passed': 19}, whole command 6.774492 seconds; reporter total 6419.586426 ms. These are distinct timing measures. Slowest represented test files (up to ten; support files are not separately executed tests):

- packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts: 339.586426 ms, 19 registered tests.

All 139 first attempts are complete: 132 accepted full-file-representation baselines, four configured subsets, three failures. Runtime Node 22.22.3/Bun 1.4.2/Vitest 4.1.11; exact rc113 API pin is separate from peer-support acceptance. No run was repeated, normalized or selected as best-of. Passing observations do not prove compiler/coverage/full-package proof, absence of races, or external provider behavior. Other failed Node cohorts retain their inherited compatibility limitations.

Completed hosted summary: 3 matching observations across 3 jobs. These are production coverage-ratchet observations, not failed test cases or unique flakes. The 527-failed-run collection includes 21 unavailable logs and one unresolved cause; causal completeness remains limited. No logs/timings/providers were collected by this lane.

Proposed internal P2 order remains scope, assertions, property, flake, observability. Preserve native boundaries and lifetime ownership first; retain every assertion operand/polarity and error payload; review the concrete oracle gaps; address only demonstrated nondeterminism; then adopt named adapter/instrumented properties without reducing floors. No change is authorized here. Root owns canonical assembly, acceptance and proof. The 90 inherited-main ratchet additions remain unchanged.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

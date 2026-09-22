# @beep/xai — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 2 assigned census files were reviewed completely: 8 human rows, 1 review proposals and 7 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 7 info, 1 minor.

 16 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/xai/test/XAi.equivalence.test.ts`: 0 proposals; full lines 1–24, test.
- `packages/drivers/xai/test/XAi.service.test.ts`: 1 proposals; full lines 1–772, test.

Nine factory layer blocks supply local HttpClient/Ref doubles. Descriptor requests are sequential. Invalid WebSocket options fail before a connection, and finite SSE fixtures test parser behavior in memory. Native it.prop uses 25-run floor options. No provider, process, database or MemoryFS setup is needed. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-PROP-04` `XAi.service.test.ts:765`: All four SSE adapters are checked only for two events. A parser returning two wrong payloads or two done markers would satisfy these assertions. Retain all four endpoint calls and length checks, then compare the first hello delta, final done flag and event ordering using the actual XAiServerSentEvent schema. Keep request body/model operands unchanged. Existing schema round-trips at fcRuns(25) validate value codecs, not these adapter-specific outputs.

Completed Root baseline: 14 registered tests passed, zero failed; whole command 5.272597198 seconds, reporter file-span total 4820.596924 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Strengthen the four SSE adapter payload/order witnesses while retaining endpoint calls, length checks, request operands and existing 25-run schema laws. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

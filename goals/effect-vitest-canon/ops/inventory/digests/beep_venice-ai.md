# @beep/venice-ai — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 3 assigned census files were reviewed completely: 12 human rows, 2 review proposals and 10 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

Severity: 10 info, 2 minor.

 34 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/venice-ai/test/VeniceAI.equivalence.test.ts`: 0 proposals; full lines 1–16, test.
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts`: 1 proposals; full lines 1–1107, test.
- `packages/drivers/venice-ai/test/integration/VeniceAI.integration.test.ts`: 1 proposals; full lines 1–50, test.

Eleven top-level unit factory blocks allocate independent HTTP captures/respond Refs; sharing a Layer constant does not merge those block memo maps. Swagger bytes are read through Bun.file under the configured Node shim. Finite and open Web Response streams are real parser inputs. The separate optional integration branch uses FetchHttpClient only when keyed. Preserve its live subject, while qualifying the absent-key passing placeholder. Layer-build costs were not isolated. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-FLAKE-01` `VeniceAI.service.test.ts:1028`: The early-SSE test intentionally leaves a Web ReadableStream open and wraps take(1) in Effect.timeoutOption("1 second") under the default layer TestClock, without advancing it. The successful emission is meaningful, but a buffering regression cannot trigger that inner one-second timeout and waits for the outer Vitest limit. Bound this native callback subject with an independent live-clock deadline or explicit event control, retaining take(1), the open body and exact first-event payload. Do not advance/reset a shared clock or unconditionally exclude needed TestClock services.
- `L-OBS-03` `VeniceAI.integration.test.ts:30`: The absent-key branch registers a passing test named skips live API calls, rather than an explicit skipped integration case. Make non-execution visible in the retained test/runner outcome while preserving the keyed listModels JSON/status assertions and credential gate. A baseline entry for this file is not evidence of live API execution. Do not inspect or print the key, acquire credentials, or change the optional scope.

Completed Root baseline: 17 registered tests passed, zero failed; whole command 5.716958815 seconds, reporter file-span total 5362.480957 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. The integration file contributes one registration; the retained aggregate baseline does not establish which credential branch ran, and the absent-key branch is a passing placeholder rather than a skip. No live-provider success is claimed. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Preserve independent unit layer state, provide a functioning deadline or event control for the open native Web stream, then report absent credentials as non-execution while retaining the optional provider assertions. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

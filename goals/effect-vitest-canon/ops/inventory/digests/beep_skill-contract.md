# @beep/skill-contract — P1 source-only digest

Root-reviewed P1 source inventory; P2 remains gated.

8 complete files, 32 rows: 10 review proposals / 22 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 8 |
| flake | 8 |
| property | 8 |
| observability | 8 |

Severity: 22 info, 10 minor.

 Mechanical rows remain separate open candidates.

Top files (all files, at most ten; descending action count):

- `packages/foundation/modeling/skill-contract/test/EvidenceLadder.test.ts`: 2 review items; full lines 1–113.
- `packages/foundation/modeling/skill-contract/test/SkillCompletion.test.ts`: 2 review items; full lines 1–394.
- `packages/foundation/modeling/skill-contract/test/EvidenceReceipt.test.ts`: 1 review items; full lines 1–103.
- `packages/foundation/modeling/skill-contract/test/Gate.test.ts`: 1 review items; full lines 1–183.
- `packages/foundation/modeling/skill-contract/test/GateSummary.test.ts`: 1 review items; full lines 1–148.
- `packages/foundation/modeling/skill-contract/test/Recovery.test.ts`: 1 review items; full lines 1–246.
- `packages/foundation/modeling/skill-contract/test/SkillContract.test.ts`: 1 review items; full lines 1–91.
- `packages/foundation/modeling/skill-contract/test/SkillProjection.test.ts`: 1 review items; full lines 1–220.

Layer topology: these assigned tests build no resource-bearing suite layers. Schema values and receipt/contract verification are the actual subjects. Effect evaluation here is in-memory computation. No database, process, native filesystem or external-provider acquisition was performed or proposed. MemoryFS would not strengthen these subjects. No layer rebuild costs or speedup are measured.

Review proposals:

- `L-PROP-02` `EvidenceLadder.test.ts:75`: Positive checks cover all four bound ladder rungs, but the malformed predicate case changes only the final delivered receipt of semanticallyApplied. Add negatives for each required earlier receipt at each cumulative rung. A delivered-rung guard that forgot to check accepted could otherwise pass this suite. Preserve all four positive shapes, exact transition identities and the existing final mismatch; no real persistence is implied.
- `L-OBS-01` `EvidenceLadder.test.ts:99`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `EvidenceReceipt.test.ts:89`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `Gate.test.ts:158`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `GateSummary.test.ts:134`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `Recovery.test.ts:232`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-PROP-02` `SkillCompletion.test.ts:61`: All named evidence subjects reuse one digest, and mismatch controls change names. Add a valid different SHA256 digest with the same name for both contract and output binding negatives. A name-only comparator could pass the current name-mismatch tests while accepting changed bytes. Production uses schema-derived EvidenceSubject equivalence and set equality. Preserve exact typed errors, reordered/duplicate output controls and the opaque live-proof boundary; do not perform file I/O.
- `L-OBS-01` `SkillCompletion.test.ts:380`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `SkillContract.test.ts:77`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.
- `L-OBS-01` `SkillProjection.test.ts:206`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the exact existing law, operands and fcRuns(25) options.

Root baseline: 46 registered tests, zero failed, whole command 7.421388630 seconds. All assigned files are represented; reporter hash dd1bd955943fd16a0fb1f85d2ae071af519c04d41dabea4d0a7318f01b5c2273. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. This is retained evidence, not a run in this lane.

Hosted attribution: 0 observations in 0 jobs. Zero mapped observations does not establish zero historical failures.

Completed campaign: 139 first timing attempts, 132 full-file-representation baselines, four configured subsets and three failures. Hosted history contains 527 failed runs, including 21 unavailable logs and one unresolved cause. Observations are not unique flakes, and production coverage paths are not named test failures. Passing once does not prove coverage, full package proof or absence of rare failures. No history or timing collection was rerun.

Proposed P2 order remains scope → assertions → property → flake → observability. Preserve current pure/native boundaries first, strengthen only the identified exact oracles, retain run floors and seed plumbing, and then improve counterexample diagnostics. No clock reset, retry, timeout increase, payload invention or lowering of run counts is proposed. P2 remains gated and the 90 inherited-main additions remain untouched.

The graph uses exact rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198. Vitest4.1.11 is recorded runtime, not a supported-peer assertion. All rows passed the strict public decoder. Remaining uncertainty is runtime reproduction and historical causal attribution. These source-backed proposals identify missing regression protection, not demonstrated production misbehavior.

Root P1 review of SkillProjection.test.ts:165 confirms that D5 permits this plain reasons-array comparison. Preserve the exact expected reasons and matcher. The detector recursively sees the ternary predicate and emits an ambiguous judgment candidate; that is not an automatic migration requirement. The separate failure-predicate assertion at line 164 remains a distinct candidate. Both detector rows remain open for coordinated P2 disposition; no waiver or baseline change is recorded.

Recovery provenance: the original supervisor exited 143 despite an inner completion event. A separate immutable recovery supplied fresh successful validation and outer exit 0; original evidence remains preserved.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

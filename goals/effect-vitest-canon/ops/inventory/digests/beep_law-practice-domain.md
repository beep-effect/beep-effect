# @beep/law-practice-domain — P1 source-only digest

Root-reviewed P1 source inventory; P2 remains gated.

5 complete files, 20 rows: 8 review proposals / 12 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 5 |
| flake | 5 |
| property | 5 |
| observability | 5 |

Severity: 12 info, 8 minor.

 Mechanical rows remain separate open candidates.

Top files (all files, at most ten; descending action count):

- `packages/law-practice/domain/test/LawPracticeDomain.test.ts`: 2 review items; full lines 1–798.
- `packages/law-practice/domain/test/LegalPositionTransitions.test.ts`: 2 review items; full lines 1–312.
- `packages/law-practice/domain/test/PatentDocument.test.ts`: 2 review items; full lines 1–342.
- `packages/law-practice/domain/test/CourtReporterVocabulary.test.ts`: 1 review items; full lines 1–476.
- `packages/law-practice/domain/test/Footnote.test.ts`: 1 review items; full lines 1–60.

Layer topology: these assigned tests build no resource-bearing suite layers. Schema values, fixed vocabulary artifacts and text parsing are the actual subjects. Effect evaluation here is in-memory computation. No database, process, native filesystem or external-provider acquisition was performed or proposed. MemoryFS would not strengthen these subjects. No layer rebuild costs or speedup are measured.

Review proposals:

- `L-PROP-04` `CourtReporterVocabulary.test.ts:277`: The union of change kinds across 13 reports and grouped compatibility checks does not bind each edit to its expected kind and subject IDs. Swapping two compatible kinds between reports could preserve both assertions. Add named per-report expected changes using the existing kind/subjectIds fields, retaining all 13 edits, the aggregate union and compatibility polarity. This is missing regression protection, not a demonstrated classifier defect.
- `L-PROP-04` `Footnote.test.ts:17`: The supported-marker case checks all three numbers but only substring containment for the first and third source slices. Wrong overlapping or overlong zones can retain those substrings. Assert exact start/end positions and slices for every marker against this literal input, preserving all three markers and existing list/heading/indentation negatives. Production ends each span at the next marker or section end.
- `L-PROP-03` `LawPracticeDomain.test.ts:137`: The local round-trip helper passes raw { runs } to native checkEffect. Preserve each existing 3/5/10 floor while applying the shared fcRuns options and CI seed/floor contract. The separate native it.prop(25) and assertSchemaArbitraryDecodesToSelf callers already use fcRuns directly or internally; do not classify them as missing options or reduce their budgets. Preserve full schema-derived equivalence.
- `L-OBS-01` `LawPracticeDomain.test.ts:137`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the schema identifier already included in the failure message, every schema comparator and the existing 3/5/10 floors.
- `L-PROP-03` `LegalPositionTransitions.test.ts:33`: The local round-trip helper passes raw { runs } with a default of 10. Preserve that floor and every schema law while routing options through fcRuns for the accepted environment floor/seed. The final shared pointer helper already merges fcRuns internally and needs no duplicate fix.
- `L-OBS-01` `LegalPositionTransitions.test.ts:33`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve every schema comparator and the 10-run floor; identify which schema failed.
- `L-PROP-03` `PatentDocument.test.ts:83`: The native generated-section check uses raw { runs: 20 }. Keep at least 20 trials and the exact section codec/recognition law while applying fcRuns so environment run floors and replay seed are honored. Preserve the billion-scale hostile range and 1025-claim input controls; they are separate fixed regression cases.
- `L-OBS-01` `PatentDocument.test.ts:83`: The direct native checkEffect result is reduced to Passed instead of exposing its structured counterexample/replay details. Throwing codec/assertion callbacks also bypass adapter property normalization. Use pinned adapter property registration/formatting for actionable failure context, without turning an expected failure into success. Preserve the generated-section codec law and 20-run floor.

Root baseline: 69 registered tests, zero failed, whole command 28.459759219 seconds. All assigned files are represented; reporter hash e176cfd49ba082e333b7f37ed0d149a0b41c84bf6ccfff4c7b9054483ef759ae. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. This is retained evidence, not a run in this lane.

Hosted attribution: 28 observations in 5 jobs. The following production coverage records are not named test failures:

- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured branches: new file has 1 uncovered unit(s) at 96.66% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured functions: new file has 1 uncovered unit(s) at 97.91% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured lines: new file has 2 uncovered unit(s) at 97.72% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured statements: new file has 2 uncovered unit(s) at 97.97% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured branches: new file has 5 uncovered unit(s) at 72.22% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured functions: new file has 5 uncovered unit(s) at 89.13% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured lines: new file has 5 uncovered unit(s) at 93.24% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured statements: new file has 5 uncovered unit(s) at 93.75% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured branches: new file has 6 uncovered unit(s) at 73.91% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured functions: new file has 4 uncovered unit(s) at 92.3% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured lines: new file has 6 uncovered unit(s) at 93.4% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured statements: new file has 6 uncovered unit(s) at 93.61% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured branches: new file has 5 uncovered unit(s) at 72.22% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured functions: new file has 5 uncovered unit(s) at 89.13% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured lines: new file has 5 uncovered unit(s) at 93.24% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`: Measured statements: new file has 5 uncovered unit(s) at 93.75% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured branches: new file has 6 uncovered unit(s) at 73.91% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured functions: new file has 4 uncovered unit(s) at 92.3% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured lines: new file has 6 uncovered unit(s) at 93.4% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: Measured statements: new file has 6 uncovered unit(s) at 93.61% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured branches: new file has 2 uncovered unit(s) at 95.45% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured functions: new file has 2 uncovered unit(s) at 97.01% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured lines: new file has 3 uncovered unit(s) at 97.5% (no baseline file identity); not test flakiness.
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: Measured statements: new file has 3 uncovered unit(s) at 97.7% (no baseline file identity); not test flakiness.

Completed campaign: 139 first timing attempts, 132 full-file-representation baselines, four configured subsets and three failures. Hosted history contains 527 failed runs, including 21 unavailable logs and one unresolved cause. Observations are not unique flakes, and production coverage paths are not named test failures. Passing once does not prove coverage, full package proof or absence of rare failures. No history or timing collection was rerun.

Proposed P2 order remains scope → assertions → property → flake → observability. Preserve current pure/native boundaries first, strengthen only the identified exact oracles, retain run floors and seed plumbing, and then improve counterexample diagnostics. No clock reset, retry, timeout increase, payload invention or lowering of run counts is proposed. P2 remains gated and the 90 inherited-main additions remain untouched.

The graph uses exact rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198. Vitest4.1.11 is recorded runtime, not a supported-peer assertion. All rows passed the strict public decoder. Remaining uncertainty is runtime reproduction and historical causal attribution. These source-backed proposals identify missing regression protection, not demonstrated production misbehavior.

Recovery provenance: the original supervisor exited 143 despite an inner completion event. A separate immutable recovery supplied fresh successful validation and outer exit 0; original evidence remains preserved.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Exact historical coverage paths and generated-output names are preserved in the
[reference evidence receipt](../../../history/2026-09-21-p1-reference-evidence/README.md).
They identify captured observations, not current tracked source files.

# Connected extraction method failure boundary

Single and paired source-document extract methods now expose only the declared
CitationEngineFailure union with R=never. Installation captures the extract
operation for admission, source verification and child timing. Trusted
installation errors remain separate from invocation failures.

The boundary uses Effect typed catch and an exhaustive Match over an explicit
schema union of the connected operation's error types. No unknown-error catch,
string-prefix dispatch or new orchestration framework is introduced. It
reconstructs only public fields and logs only operation and closed error class.
Canonical source and vocabulary failures retain their prerequisite categories;
known safety failures retain their resource. Private unsupported regex syntax
is an input refusal, not an invented unsupported public operation. Interruption
and defects bypass typed translation.

Native Unicode preparation and case lowering now retain the actual selected
deadline field in their private typed failure. The extraction boundary preserves
that producer metadata instead of guessing an extraction deadline when a helper
actually uses a cleaning timer. Missing legacy deadline or callback limit
metadata does not fabricate a safety category. This does not claim all helper
timers have been migrated to the final enclosing operation policy.

## Verification

The connected source-document, Unicode and case suites pass fourteen tests in
the four-file replay (33.41 seconds overall). The boundary suite initially
contained invalid test budget names, which the schema and compiler rejected.
After using the existing mentions/resolutionEdges fields, its two tests pass
in 2.63 seconds. All sixteen final applicable tests pass across these runs;
no implementation or expectation was weakened to accommodate the test error.

Actual Bun and Node connected paths reject malformed input before source
resolution, release outer admission, then successfully extract the expected
full case and Id. spans, group the two mentions under one authority and restore
the document exactly. Native children have independently confirmed exits.
The shortcut case continues to retain unverified semantic data without
asserting unsupported source anchors. Compile-time assignments and emitted
single/pair method declarations confirm the closed error union and R=never.
Controlled Clock tests retain exact cleaning/annotation deadline attribution.
Boundary controls preserve producer deadline/resource labels, evidence refusal
and redaction; absent metadata remains unclassified input refusal.

Package lint/types, declaration build and blocking laws pass. Scoped Fallow
passes with zero introduced findings and nine inherited duplication groups.
Existing thresholds, source expectations and baselines are unchanged.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationEngineFailure.test.ts
bunx --bun vitest run test/CitationSourceDocument.test.ts \
  test/CitationPythonUnicode.test.ts test/CitationPythonCase.test.ts
```

Public engine service/Layer, admitted public resolver composition, complete
operation reports, general host/model protocols, builtin difflib, lawful
transforms, whole-engine safety/scaling and exhaustive source/donor accounting
remain required. All eleven representation laws, four fidelity questions and
fifteen unfinished proof rows remain open without semantic waiver. Hosted
qualification of the new head remains separate from local component proof.

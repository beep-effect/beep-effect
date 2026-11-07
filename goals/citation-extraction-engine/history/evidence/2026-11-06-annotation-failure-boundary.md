# Closed source annotation failure boundary

The connected raw-source annotation method now exposes only the five declared
CitationEngineFailure members, with R=never. The generated declaration confirms
that no admission, callback, XML, diff, regex or Unicode adapter failure escapes
that method. Installation failures remain a separate trusted composition path.
This is a prerequisite for public Engine/Layer composition, not its completion.

The translator uses an explicit schema union and Effect Match.tagsExhaustive
across all current typed failures. There is no unknown-error fallback and no
catchCause conversion. Private adapter/native refusals become annotation errors;
invalid entry input becomes the input error. Existing prerequisite labels and
safety limits are retained with the enclosing annotation operation. Existing
explicit unsupported-mode failures are reconstructed; no private missing-native
or unsupported-regex-profile refusal becomes an unsupported requested mode.

Each failure is freshly constructed from declared fields. Incidental source,
frame, reason and cause properties do not escape. Debug events carry only the
fixed operation and typed failure-class label. Native Unicode limit/deadline
translation reuses the existing annotation helper and actual minimum deadline.
Typed failure handling uses Effect v4 catch; interruption and defects are not
converted by this boundary.

## Verification

Nine tests across the new translator, source annotation and its controlled clock
pass in 2.67 seconds. Seventeen private error classes become annotation failures
and drop injected source/frame/cause properties. Five additional vectors retain
input, prerequisite, explicit-mode and safety categories; three Unicode vectors
retain produced-text, total-deadline and annotation-deadline limits.

An actual captured callback returns NonText before a subsequent valid callback.
Both callbacks still execute, final join fails with CitationAnnotationError and
outer admission is released. Existing actual Bun/Node source mapping and the
combined resolver/callback deadline regression remain passing. A compile-time
assignment pins the installed method to the named result, CitationEngineFailure
and no requirements.

Package lint/types, declaration emission and blocking laws pass. Scoped Fallow
reports zero introduced findings and nine inherited clone groups with unchanged
policy. Initial use of the removed catchAll API was caught during package checks;
the owned failing test run was stopped and affected tests rerun with v4 catch.
No source expectation, prerequisite, baseline or threshold changed.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationFailure.test.ts \
  test/CitationSourceAnnotation.test.ts test/CitationSourceAnnotationTiming.test.ts
```

The public service/Layer, complete extraction/cleaning/resolution boundaries,
remaining host protocols, builtin difflib, lawful transforms, whole-engine
safety/scaling and exhaustive source/donor reconciliation remain required.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without semantic waiver or accounting promotion.
Hosted verification of the published head remains separate from local proof.

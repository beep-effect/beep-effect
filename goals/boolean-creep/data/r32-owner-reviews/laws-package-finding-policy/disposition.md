# LawsPackageFinding: D1 recommendation

Source HEAD: `f97a89bdfdc5bc71b69aab09b8d425591698d42a`.
Proposed disposition: **D1 independent flags**, 4/4 supported current projection.
No qualified replacement design, source migration, or owner question is needed.

## Complete owner and public contract

`packages/tooling/tool/cli/src/commands/Laws/LawsPackage.model.ts:73-82`
exports a five-field S.Class: law (five-literal LawsPackageLaw), nonnegative
integer findingCount, required Boolean advisory, required Boolean strictFailure,
and string-array diagnostics. There are no defaults, transforms, refinements or
cross-field checks. JSDoc61-68 calls these advisory and failure policy; neither
it nor package documentation says advisory excludes strictFailure. The model
is publicly reachable through package.json68 commands wildcard, as demonstrated
by its examples and package-alias tests. Report95-98 nests arbitrary findings
alongside nonnegative projectSourceFileCount, without narrowing.

This is not inferred solely from a permissive schema. The explicit production
schema property test at test/laws-package.test.ts61-90 generates arbitrary
Findings AND Reports and asserts full JSON encode/decode equality. There is no
filter or law-specific restriction. This meaningfully promises serialization
preservation, including both flags and arbitrary siblings. It is not a targeted
combined-true behavioral test, and this audit does not claim the randomized test
was run or happened to sample TT.

The consumer at Lint/Lint.command.ts737-742 separately logs advisory metadata,
prints all diagnostics and fails solely on strictFailure. Thus all four inputs
have coherent defined observation: advisory flag is rendered independently of
whether that result triggers failure. TT would display advisory=true and fail;
there is no combined-true rejection, exclusion guard or advisory override.
The scan command currently only supplies the narrower scanner output, so this
reader establishes preservation/defined behavior, not a live TT CLI fixture.

## Producer subset is not the entire owner

LawsPackage.ts102 emits false/false for empty package-test-imports. :127 emits
true/false for terse-effect. :139,154,166 emit advisory=false plus upstream
strictFailure for native-runtime, frozen-grant-set and effect-fn. :178 emits
advisory=false plus nonempty diagnostic result for package-test-imports.
The current scanner therefore emits FF, TF and FT, but not TT.

The R32 E1 citation130 accurately describes a same-operation exclusive write.
It does not prove that all legitimate instances of the exported class must be
produced there, nor that its general serialized contract excludes TT. The scanner
also correlates law and advisory, findingCount and diagnostics; importing all
such producer correlations into this public owner would silently replace its
existing domain. No explicit semantic rule authorizes that narrowing.

The source therefore supports retaining the whole existing four-state contract
as independent metadata/result flags. Do not ask the operator to invent a
restriction merely to manufacture a cardinality gap. A later explicit owner
ruling may change this contract, but this census should not require one.

## Full migration and guard accounting

No migration is proposed; no guards can be deleted under this disposition.
Preserve all six constructor sites, model example, exported Finding and Report,
property-test arbitraries, JSON encoders/decoders, complete siblings/defaults,
scanner execution law order, empty package behavior and Lint logging/exit order.
Do not introduce a three-policy LiteralKit, compatibility codec, stricter make,
constructor-only adapter or private surrogate under the same stable ID.
No evidence was found for separate coupled private locals to admit instead.

## Validation and limits

Exhaustive symbol search found model, scanner and package test; parent-report
and selected-field search identified the Lint command reader. Current source
and local Effect SCHEMA.md fromJsonString documentation were inspected. Existing
test assertions make round-trip preservation deliberate, but provide no explicit
statement that TT is a desirable producer policy. That distinction is recorded;
it is not a reason to shrink accepted inputs.

The attached four-row table is static contract analysis, not executed codec or
runtime proof. No source files, tests, canonical inventory/designs or frozen R32
inputs were changed. D1 remains a parent-reviewed proposed census disposition,
not independent P3 or census dry credit.

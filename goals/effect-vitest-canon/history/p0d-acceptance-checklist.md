# P0d acceptance checklist

P0c is complete; this checklist governs the graph phase. A valid JSON document
or lane exit alone does not establish completeness, semantics or package proof.

## Pinned source coverage

The orchestrator reverified these cached bytes with `git show` at
`@effect/vitest@4.0.0-rc.112`, commit
`2600f62f4532026928454dcea8d1c48557b3f942`. The four primary surfaces are
index.ts (259 lines), utils.ts (327), README.md (311), and internal.ts (373).
Charter modules Effect, Logger, testing/TestClock and Layer and the license were
also compared. The private hash receipt is `p0d-pinned-source-receipt.json`.

Check coverage derived from source, including these independently read surfaces:

- Index: the Vitest export-star boundary, API, namespace Vitest, and nine direct
  value exports: addEqualityTesters, effect, live, layer, flakyTest, prop, it,
  makeMethods and describeWrapped.
- Namespace types: TestFunction, Test, Arbitraries, Tester, MethodsNonLive and
  Methods. Preserve their environment/type distinctions and call signatures.
- Tester: skip, skipIf, runIf, only, each, fails and prop. Cover effect/live
  property behavior and the difference from synchronous prop.
- MethodsNonLive: effect, flakyTest, layer and prop. Methods: live and its
  broader layer signature. Layer options differ by interface: nested NonLive
  exposes timeout; Methods and the root export expose memoMap, timeout and
  excludeTestServices. Property fastCheck options belong to their real signatures.
- All 21 utils exports: fail, deepStrictEqual, notDeepStrictEqual, strictEqual,
  assertEquals, doesNotThrow, assertInstanceOf, assertTrue, assertFalse,
  assertInclude, assertMatch, throws, throwsAsync, assertNone, assertDefined,
  assertUndefined, assertSome, assertSuccess, assertFailure, assertExitFailure,
  assertExitSuccess.
- README title and all thirteen sections/subsections: Installation, Documentation,
  Overview, Writing Tests with it.effect, Testing Successful Operations, Testing
  Successes and Failures as Exit, Using the TestClock, Skipping Tests, Running a
  Single Test, Expecting Tests to Fail, Logging, Resource Safety and Scope,
  Writing Tests with it.flakyTest. The Overview feature table is part of coverage.
- All ten named charter APIs: five Effect helpers, two Logger helpers, two
  TestClock helpers and Layer.mock, with exact tag source anchors.

These are review expectations, not a substitute for the test that derives the
inventory from portable pinned source. Represent the re-export boundary honestly;
do not claim every export of a separate Vitest package is declared in index.ts.

The orchestrator's independent syntax-only source extraction found 75 items:
one export-star boundary, one direct type alias, one namespace, nine direct value
exports, six namespace types, thirteen interface members, nine inline options,
21 utilities and fourteen README headings. Ten charter APIs are additional.
The nine options include both property fastCheck signatures and all seven layer
option declarations across their three scopes. Private reproducible artifacts:
`p0d-source-inventory.mjs` and `p0d-independent-source-inventory.json`. This
extraction does not read the graph and does not use TypeChecker resolution.

The lane's early coverage table independently reaches the same 75 + 10 units
and distinguishes all nine inline options. Its declared decision to represent
the export-star boundary as a type preserves SPEC's kind domain; inherited
members are covered at their declaration owner and described on Methods.
This agreement establishes the inventory plan, not the finished graph or tests.

The orchestrator also compared all ten portable charter declaration excerpts
against the corresponding ranges of the verified full tag files; every excerpt
matches exactly and every recorded full-file hash matches. The independent
receipt is `p0d-charter-source-proof.json`. The four full index/utils/README/license
fixture copies also matched the pinned bytes before the text-extension correction.

The orchestrator independently compiled all 85 examples with the same real
ts-morph Project and getPreEmitDiagnostics boundary on graph hash
`9b2913fac004867602d4894756b5f6e0e3b0e4ebbd060232cb6dbd72142eb4d3`:
zero diagnostics, 2,158.9 ms for diagnostics, graph unchanged during the proof.
A separate negative control reported TS2322 for assigning a string to a number,
confirming semantic type checking. Receipt: p0d-independent-example-proof.json.
This is supporting working-snapshot evidence; final package proof remains open.

## Graph and behavior

- Every entry decodes through the existing EffectVitestPrimitive S.Class;
  document pins, uniqueness, ranges and replacement referential integrity validate.
- Every source anchor is in bounds and actually names the claimed API/section.
- Every example is self-contained and compile-checked at rc.112. Merely storing
  a string, parsing its syntax, or typechecking the graph schema is insufficient.
- Each entry explains use, non-use and gotchas. Empty replaces has an explicit
  reason; nonempty edges identify the repo candidate class and applicability.
- Every detector replacement ID resolves. Hints derive from graph content and
  replaces edges; mutation fixtures prove the effect, rather than just decoding.
- Installed package version checks the graph pin. Missing/malformed graph,
  duplicate/missing entries, dangling references and pin mismatch have clear
  typed failures and meaningful negative fixtures. No second drifting pin source.
- Semantic cautions remain: shared TestClock, nested memo maps, owned inner scope,
  no TestEnv in live tests, hooks versus task timeout, property floor preservation,
  and no flakyTest adoption without a reason.

## Integration proof

- Coverage tests run without workstation paths, .repos symlinks or network.
  Copied fixtures retain upstream license and reproducible hash provenance.
- New tests follow D5/D14 and use supported @beep package aliases.
- Complete focused suite, direct compiler, changed-file lint and package docgen
  pass. The orchestrator runs full package-verify after the source lane ends.
- Exact census/write/rows commands run twice under pinned Bun 1.4.1, with equal
  artifacts and under-10-second full process walls. Default ratchet stays green.
- Membership/classification/evidence changes require attribution. P0c starts
  this phase at 5,012 findings and 1,072 current census paths; generated support
  declarations and newly authored files may change the census honestly.

P0e starts only after all P0d gates are established. No git publication or merge
is authorized inside the implementation lane.

## Acceptance established

Every P0d checklist group is now supported by the final receipt at
history/2026-09-08-p0d-verification.md. Full package verification, exact
sub-ten-second commands, source stability, artifact determinism, canonical
membership preservation and independent census attribution are green.
The initiative remains active and P0e is the next gate.

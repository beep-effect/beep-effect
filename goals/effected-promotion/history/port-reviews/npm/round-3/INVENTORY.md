# npm — round-3 merged review inventory

Seats read: `grok.md` (three findings), `sol.md` (three findings), and `fable.md` (no findings), with both adjacent briefs, `BRIEF.md` and `BRIEF.grok3.md`. There are no `part-N` reports. The third seat identifies itself as the separate grok-4.7 medium fallback for Fable. Review baseline: `3ad7b305790c7f0903f6d55766c55186745ba2d1`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts: **Required 5 · Backlog 2 · Codemod 0 · Rejected 0 · Groups 3**. Six submitted findings become seven records because `sol-3-3` mixes test-code law violations with deferred documentation work. Each contributing seat finding id is retained. The three array-helper findings affect independent routines, so they remain distinct defects within one write group.

Binding basis: the complete operator revision block, including the 2026-10-09 rulings, later grilling, review cap and subsequent revisions; D1–D20; sections 12.4–12.5 and 14; and this task's stage and write restrictions. The briefs' claim that S2/S3 already ran does not override the instruction to backlog docs, JSDoc, coverage and vitest-canon work. Round 3 ends with a final fix wave and gates, without a fourth review.

The supplied checkout is on `@lab/effected-2`, rather than the requested `@lab/effected`. At inspection, HEAD was `843c475bfdf0e57f6f5d813d956a92b06bd73cdc`; `git diff 3ad7b305790c7f0903f6d55766c55186745ba2d1 -- scratchpad/effected/npm scratchpad/test/npm` was empty. Existing unrelated changes were left alone. Evidence from the seats' runtime probes is attributed below; this merge ran no tests or compiler probes.

The complete current `standards/effect-laws.allowlist.jsonc` has zero entries for `scratchpad/effected/npm/**` and zero `scratchpad/effected` entries overall. There are therefore no `allow-<n>` records to add. Historical allowlist findings are not current entries.

Read-only provenance checks used `git log --format=%h:%s -- <file>` and the available step-2/law and S1 diffs, including `03bf79d41b` and `cac22c4005`, plus round-2 commit `cac952b9c5`. Those diffs show forced record/collection helpers, finite predicates, tagged errors, date parsing and match conversions. The remaining array calls and seeded indexed lookup are also present in the pinned oracle. No finding establishes an unforced lab divergence or requests restoration of a diagnostic/law-forced change. No scratch-copy compiler check was run.

Write groups are disjoint: g1 owns three array-helper source files, g2 owns NpmRegistry and its regression test, and g3 owns two JSON test files with no production source assignment. No group exceeds six source files. Equivalent helper substitutions need no test-file edits; their existing suites remain verification inputs. New seeded-lookup regressions belong to g2's listed test. No group assigns repository configuration, the allowlist, ledger, or README Port notes. Supply any incidental deviation evidence to the central per-module, per-class codemod. Any subsequent vitest verification must use `bunx --no-install vitest run --maxWorkers=2 ...`, one run at a time; module-wide coverage must use `beep-heavy --slot-only`.

## Required

### npm-3-1

- file: scratchpad/effected/npm/ReleaseAgeGate.ts:133
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11
- evidence: `matchesExclude` uses `patterns.some` at :133; `combine` uses native `map`/`filter` at :221–223 and `flatMap` at :225; `filterVersions` uses native `filter` at :328. These dense arrays have equivalent Effect helper operations. `NoNativeRuntime.ts:68,459–467` checks array static methods and hotspot sorting, not these instance calls. `preferEffectArray` is absent from `tsconfig.base.json`'s severity map, and `.repos/effect-tsgo/docs/rules/prefer-effect-array.md` declares its default off. Thus the green gates do not enforce these sites. Round-2 npm-2-4 fixed the separate native string `includes` call, not these array calls.
- failure: Release-age matching, age merging, exclude collection and version filtering retain native array helpers despite equivalent `effect/Array` operations required by the cited standard.
- fix: Use `A.some` for exclusion matching, `A.filterMap` with an Option result for age extraction, `A.flatMap` for contributed exclusions and `A.filter` for versions. Preserve the `P.isNumber`/`Number.isFinite` guard, non-negative clamp, maximum selection, sorted/deduplicated excludes, inert-gate return of the original versions, and filtering order. Keep the wildcard scan, `Math.max` and `DateFromString` path. Preserve existing upstream assertions; no test edit is required for these equivalent substitutions.
- seats: grok-3-1
- group: g1

### npm-3-2

- file: scratchpad/effected/npm/Manifest.ts:314
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11
- evidence: `needsResolution` calls `DependencyField.literals.some` at :314 and `R.values(section).some` at :318. `A.some` preserves the short-circuit predicate behavior. The array-helper gate gap described in npm-3-1 also covers these calls. Step-2 commit `03bf79d41b` replaced `Object.values` with `R.values` while leaving `.some`; the pinned oracle has the same native predicate shape. Round-2 npm-2-1 fixed the separate dependency-map construction bug.
- failure: The manifest fast path still uses native array predicates where EF-5 requires the equivalent Effect helper.
- fix: Import `effect/Array` as `A` and replace both calls with `A.some`, preserving field traversal, absent-section behavior, short-circuit evaluation and catalog/workspace classification. Leave the own-key-preserving manifest resolution fixes intact. No test-file edit is required for this equivalent substitution.
- seats: grok-3-2
- group: g1

### npm-3-3

- file: scratchpad/effected/npm/PackageManagerCache.ts:111
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11
- evidence: `under` directly calls `[home, ...parts].join(windows ? "\\" : "/")`. The seat traces `A.join` to the same native join for array input, so the path bytes are preserved. Native-runtime does not inspect instance `join`, and `preferEffectArray` remains off. The S1 diff `cac22c4005` changes cache selection to Match without replacing this helper. The oracle retains the same join operation.
- failure: Default cache-directory construction retains a direct native array helper despite the equivalent Effect operation.
- fix: Import `effect/Array` as `A` and use `A.join([home, ...parts], windows ? "\\" : "/")`. Preserve separators, every platform/manager path and trailing-home-separator behavior. Keep existing cache-path assertions; no test-file edit is required.
- seats: grok-3-3
- group: g1

### npm-3-4

- file: scratchpad/effected/npm/NpmRegistry.ts:743
- class: bug   severity: required
- standard: D9/D11; section 14 verified-upstream-bug exception; NpmRegistry.makeSeeded absent-version contract
- evidence: `sol-3-1` reports read-only probes against the review baseline and pinned oracle with `{ registries: { [DEFAULT_REGISTRY]: { p: {} } } }`: both return `Some` for versions `toString` and `constructor`, but `None` for `1.0.0`. The seat also decoded the lab seed through RegistrySeed and reproduced the result with zero own version keys. Current source reads `seed.registries[key]` at :740 and `at(target)[name]?.[version]` at :743; the oracle uses the same lookup at :478/:481. Other seeded methods index the same maps at :758–762. `.repos/effect/packages/effect/src/Record.ts:465–471` confirms that `R.get` tests `Object.hasOwn`. The live registry already uses an own-key guard for version lookup. Existing test-double tests cover ordinary registry/package/version dimensions, not inherited-key absence.
- failure: The seeded registry reports versions that were never seeded, giving a false published-version answer. Inherited dictionary properties can also masquerade as registry/package/dist-tag entries. This is an upstream bug missed by green gates, rather than an unforced port change.
- fix: Use `R.get` and Option composition for registry, package and version axes, retaining the current empty/None defaults when a key is absent. Apply own-key lookup to versions, publishTimes and the optional distTags package map. Preserve explicitly seeded own keys, integrity parsing, timestamps and returned collection order. Add regressions in `scratchpad/test/npm/NpmRegistry.test.ts` for inherited version names on an empty package, inherited registry/package names and dist-tag lookup, plus an explicitly seeded own `constructor` version that still succeeds. Preserve all oracle assertions. Supply the verified upstream correction and new regression references to the central deviation codemod; do not edit ledger or Port notes.
- seats: sol-3-1
- group: g2

### npm-3-5

- file: scratchpad/test/npm/PackagePublish.test.ts:42
- class: law   severity: required
- standard: standards/effect-first-development.md EF-19; effect-first-development skill non-negotiable law 22, explicitly including tests/fixtures; D5/D11
- evidence: Native `JSON.stringify` occurs in `PackagePublish.test.ts:42,49,447` and `PackageManagerPin.test.ts:111`. Source confirms three pack-output fixtures and rejection-name quoting outside Effect generators. `preferSchemaOverJson` is enabled at error in the baseline and current `tsconfig.base.json:191`, but `.repos/effect-tsgo/internal/rules/prefer_schema_over_json.go:50–65` checks JSON inside Effect.try/gen/fn contexts. `NoNativeRuntime.ts`'s call detector has no JSON case. These concrete test sites therefore survive the reported green gates. This record excludes the documentation sites from the same seat finding.
- failure: Test fixtures and rejection names use native JSON serialization even though the binding JSON law applies to tests and fixtures. This is a codec law defect, not a coverage or vitest-canon migration request.
- fix: Replace pack fixture serialization with Schema JSON encoding through `S.fromJsonString(S.Unknown)`, using an explicit Result codec at static synchronous setup boundaries or Effect encoding in effectful setup. Preserve the npm 11 array and npm 12 keyed-object bytes and the malformed missing-filename payload; encode that payload as Unknown so the negative test stays malformed. Use a Schema string JSON codec for rejection-name quoting, preserving the existing test names and matrix. If a static Result is unwrapped, make the test-boundary failure explicit without introducing a sync Schema codec. Touch only `PackagePublish.test.ts` and `PackageManagerPin.test.ts` for this finding; its documentation portion is npm-3-b2.
- seats: sol-3-3 (test-code portion)
- group: g3

## Backlog

### npm-3-b1

- file: scratchpad/effected/npm/PackagePublish.ts:133
- class: jsdoc   severity: backlog
- standard: standards/effect-first-development.md EF-3; .patterns/jsdoc-documentation.md; D5/D11; task's deferred S2 rule
- evidence: `sol-3-2` identifies 17 synchronous Schema codec calls in comment examples: PackagePublish.ts:133,174,212,244; PackageManagerPin.ts:234–235; ReleaseAgeGate.ts:56; RegistryKind.ts:26; Manifest.ts:260; IntegrityHash.ts:704; DependencySpecifier.ts:515,810,812; DependencySection.ts:28,56,124,140. Read-only source inspection confirms these calls. Docgen compilation would establish typing rather than enforce EF-3's preferred codec composition.
- failure: Public examples teach throwing synchronous codecs as the default. The examples violate the cited idiom but belong to the deferred documentation stage.
- fix: During S2, use Effect codecs with execution at the example's outer runtime boundary, or schema `.make(...)` when construction is the point. Preserve each example's purpose and expected output.
- seats: sol-3-2
- reason: JSDoc findings are backlog under the task's explicit S2 restriction, irrespective of the briefs' stage claims.

### npm-3-b2

- file: scratchpad/effected/npm/Manifest.ts:215
- class: docs   severity: backlog
- standard: standards/effect-first-development.md EF-19; effect-first-development skill law 22; .patterns/jsdoc-documentation.md; task's deferred S2 rule
- evidence: The documentation portion of `sol-3-3` identifies `JSON.stringify` in Manifest.ts:215,379 and README.md:101. The source examples still contain those direct calls. These sites are separate from the executable test fixtures retained as npm-3-5.
- failure: Carried public examples teach native JSON serialization instead of Schema JSON encoding. This concerns documentation and example bodies, not production serialization behavior.
- fix: During S2, compose Schema JSON encoding into the Manifest examples, executing at their outer runtime boundary and preserving the shown JSON and teaching purpose. Update the README usage example in the same documentation pass. Leave README Port notes to the central codemod.
- seats: sol-3-3 (documentation portion)
- reason: Docs/JSDoc findings are backlog under the task's explicit S2 restriction.

## Handled by the deviation codemod

None as standalone findings. `sol-3-1` asks both to correct a demonstrated upstream bug and to record it; the code correction remains required as npm-3-4, while its bookkeeping belongs to the central codemod. Any new law-forced deviation evidence from the required fixes is supplied centrally without a ledger or Port-notes write assignment. No seat finding merely asks to record an already forced identity key, finite number, tagged error, export or native-runtime replacement.

## Rejected

None. Every submitted defect has evidence and a concrete fix. The accepted required records explain why the reported green gates missed them; documentation findings are reclassified to backlog, and `fable.md` contributes no finding. No finding contradicts an operator ruling or requires a repository-level write. No separate count is created for incidental bookkeeping within a substantive fix.

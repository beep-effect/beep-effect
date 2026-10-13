# env — round-2 merged review inventory

Read `grok.md` (9 records), `sol.md` (3 records), `fable.md` (11 records), and their shared `BRIEF.md`; no part-N report directories exist. All 23 seat records are accounted for; fable-2-10 is split into source drift, rejected coverage bookkeeping, and central diagnostic-record repair.

**Required: 6 · Backlog: 6 · Handled by the deviation codemod: 2 · Rejected: 1 · Groups: 4.**

The whole operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, §12.5 and §14 were read. The current merge instructions control S2/S3 classification even though the brief and history claim those stages green. Schema/law defects remain required; docs, property/coverage and vitest-canon work stay backlog. Seat probe results below are attributed evidence; no gates, tests, compiler probes or scratch-copy checks were run for this merge.

Review brief commit: `a12bef261998d2ad92153dada46373be06950692`. The supplied branch is `@lab/effected`, but the live checkout is `@lab/effected-2`; no branch switch or source edit was made. Comparisons use the brief-pinned oracle `~/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/env`.

Allowlist: read every entry in `standards/effect-laws.allowlist.jsonc`; zero match `scratchpad/effected/env/**`. There are no `allow-<n>` findings. The two native logger Sets are independently evidenced test-law misses, not allowlist entries.

History attribution: read path histories and relevant diffs for step-2 commits `7f67982f77`, `509362cc02`, `88bf408e18`, mechanical law commit `03bf79d41b`, S1 `2dd415236f`, round-1 `3cee0bb25c`, canon checkpoint `bdca1c58e5`, and S3 `ce9331673c`. Keep diagnostic/law-forced changes, including pipeable signatures, Effect.fn readers, collection replacements and schema ownership. Coverage-only source rewrites in ce9331673c do not acquire a qualifying law/diagnostic/ruling merely by being recorded under §11.3; the current unforced-change instruction requires their restoration. No already-closed round-1 finding is re-raised.

Write ownership: `g1` owns Audience.ts and the two logger-capture test files; `g2` owns detect.ts, semver.ts and EnvOverride.ts so the cross-file restoration cannot overlap the Osc8Info fix; `g3` owns TerminalEnv.ts; `g4` owns RuntimeEnv.test.ts and the new deliberatelyInvalid.ts helper. The largest group has three source files. Deferred properties are not required write assignments. No group owns a barrel, README Port notes, the ledger, root package.json, bun.lock, or repository configuration. Any test run by a later fix lane must use `bunx --no-install vitest run --maxWorkers=2`, one vitest at a time; module coverage requires `beep-heavy --slot-only`.

## Required

### env-r2-1 — Osc8Info and its named override domain lack schema ownership

- file: scratchpad/effected/env/internal/osc8/detect.ts:57
- class: schema   severity: required
- standard: D5/D11; ARCHITECTURE §5; effect-first-development EF-33; schema-first-development-prompt, Schema owns pure data; effect-laws-v1 law 19.
- evidence: All three seats identify the exported pure-data Osc8Info interface, its twelve fields, and Gate.override at :182 referencing the handwritten override union by name. ProcessSnapshot and Osc8Detection were converted in round 1, but Osc8Info was not. The four green law gates do not enforce pure-payload schema ownership.
- failure: The diagnostic result and its named override domain have no schema-derived contract, guard or equivalence.
- fix: Define identity-annotated Osc8Override = LiteralKit(["force-hyperlink", "no-hyperlink", "no-color"]) and Osc8Info = S.Struct composed from existing schemas, preserving all booleans, strings, nullable fields and plain-object results. Annotate fields, derive same-name types, import KnownTerminal/WrapperInfo/Osc8Capabilities as values, and derive Gate from the relevant Osc8Info fields. Preserve detect output and the type-only barrel surface. New D10 properties and JSDoc conversion are deferred to S3/S2; added-export bookkeeping is central.
- seats: grok-2-1, sol-2-1, fable-2-4

### env-r2-2 — StreamEnv.columns hand-declares the built-in number domain

- file: scratchpad/effected/env/TerminalEnv.ts:68
- class: schema   severity: required
- standard: effect-laws-v1 laws 17/21; SCHEMA.md, Declaring Custom Types; D9/D11; schemaNumber TS377098.
- evidence: grok-2-4 and fable-2-2 identify S.declare(P.isNumber) with an S.Finite arbitrary link and three extra imports. S.Number already accepts the same number domain. The cited schemaNumber diagnostic matches S.Number, so the declaration escapes that check; a passing gate does not establish compliance with the built-in-schema law. Commit 3cee0bb25c introduced the declaration during schema-first fixes; ce9331673c added the arbitrary workaround. Commit 7f67982f77 explicitly documents reasoned next-line schemaNumber exceptions when a finite-only schema changes behavior. The existing TerminalEnv.coverage.test.ts pins NaN and both infinities.
- failure: A custom opaque declaration duplicates a primitive schema and supplies an arbitrary narrower than its accepted domain.
- fix: Use S.Option(S.Number), retaining the StreamEnv.columns field identity and a reasoned @effect-diagnostics-next-line schemaNumber:off immediately on the affected line because the upstream Option<number> accepts non-finite numbers. Delete the implementation Predicate, SchemaGetter and identity imports and the custom arbitrary link. Retain existing non-finite assertions and property tests unchanged. Do not substitute S.Finite here or alter repository diagnostic configuration. Removal of StreamColumns from central identity bookkeeping belongs to the deviation codemod.
- seats: grok-2-4, fable-2-2

### env-r2-3 — Logger capture introduces native Sets in two test files

- file: scratchpad/test/env/Audience.test.ts:16
- class: law   severity: required
- standard: D5/D11; effect-laws-v1 law 6; section 16; Grilling, 2026-10-09 (later), Logger.CurrentLoggers ruling.
- evidence: Audience.test.ts:13–21 constructs Layer.succeed(Logger.CurrentLoggers, new Set(...)); EnvOverride.test.ts:13–18 constructs another Set and supplies it at :30/:61/:95. Commit bdca1c58e5 replaces the oracle Logger.layer capture with these native collections. Fable reports native-runtime scanned_files=1 when the test paths were included, because .test.ts is excluded; this is a demonstrated green-gate miss.
- failure: Two handwritten native logger collections violate the law and bypass the operator-approved logger installation route.
- fix: Restore Logger.layer([Logger.make(...)]) capture in both files. Install the logger context using the operator recipe: Effect.scopedWith, Layer.buildWithScope(loggerLayer, scope), and Effect.provideContext for the effect being tested, with existing audience/config layers composed so no multipleEffectProvide diagnostic returns. Adapt all capture consumers in both files, retaining warning counts, messages, levels and the valid/invalid positive control. Do not retain a CurrentLoggers Set or use only a direct Effect.provide(loggerLayer) substitute for the ruled scoped recipe.
- seats: grok-2-5, fable-2-3

### env-r2-4 — Reflect.apply hides deliberately invalid RuntimeEnv.make input

- file: scratchpad/test/env/RuntimeEnv.test.ts:198
- class: type-safety   severity: required
- standard: D15; Operator rulings, 2026-10-09, one deliberatelyInvalid<T> helper per module.
- evidence: The live test calls Reflect.apply(RuntimeEnv.make, RuntimeEnv, [{ ci: O.some("jenkins"), ... }]). Reflect.apply accepts ArrayLike<any>, erasing the make parameter contract outside the assertion scanner. The conditional type and assert.throws still assert rejection. The CLI helper shows the sanctioned single value as T shape.
- failure: The invalid input bypasses the named helper and hides type erasure from the agreed D15 search and gate.
- fix: Add scratchpad/test/env/deliberatelyInvalid.ts using the sanctioned helper shape, export const deliberatelyInvalid = <T>(value: unknown): T => value as T. Replace Reflect.apply with RuntimeEnv.make(deliberatelyInvalid<Parameters<typeof RuntimeEnv.make>[0]>({ agent: O.none(), ci: O.some("jenkins"), terminal: O.none() })). Retain the conditional-type proof and assert.throws. This is the ruling-authorized test cast, not a source assertion or diagnostic suppression.
- seats: grok-2-6, fable-2-5

### env-r2-5 — AudienceShape remains an interface-only pure service snapshot

- file: scratchpad/effected/env/Audience.ts:78
- class: schema   severity: required
- standard: D5/D11; effect-first-development EF-33; ARCHITECTURE §5; schema-first-development-prompt, Schema owns pure data; round-1 env-9.
- evidence: fable-2-8 identifies the two-field pure AudienceShape record, whose AudienceKind and AudienceSource already have LiteralKits. It contains no service operations or overload machinery. Round-1 env-9 required the equivalent StreamEnv pure snapshot conversion. The interface remains visible in the live source; green law gates do not enforce this model ownership.
- failure: The immutable audience value has no schema-derived runtime contract or field identities.
- fix: Define identity-annotated AudienceShape = S.Struct({ kind: AudienceKind, source: AudienceSource }) with field annotations and derive its existing type, preserving ordinary service objects and all literals. Use AudienceSource directly for layerTest source instead of AudienceShape["source"]. Keep the barrel export type-only. Defer new round-trip properties to S3 and added-export bookkeeping to the central codemod.
- seats: fable-2-8

### env-r2-6 — Coverage-only source rewrites diverge from the oracle without a qualifying force

- file: scratchpad/effected/env/EnvOverride.ts:34
- class: bug   severity: required
- standard: D9/D11; §14; Grilling, 2026-10-09 (later), restore unforced lab changes; current merge instruction deferring coverage findings.
- evidence: git log --all --format=%h:%s -- the three source paths distinguishes step-2/S1/law commits from ce9331673c (effected-port S3). Its diff changes EnvOverride from the oracle static class with private constructor to a plain object, moves wrapper-name normalization out of explanationFor in detect.ts:162–175/:256, removes the major-capture fallback in semver.ts:37, and replaces the indexed comparison loop/fallbacks at :42–43. The ledger labels all four coverage-only, citing §11.3, not a TypeScript/tsgo diagnostic, beep law or operator replacement ruling. The pinned oracle and the pre-S3 source contain the original shapes. The class-to-object change observably changes typeof EnvOverride.
- failure: The source has four coverage-motivated upstream divergences. Recording them as accepted deviations does not supply the law, diagnostic or ruling required by the current merge instruction.
- fix: Restore the oracle static EnvOverride class and private constructor, retaining the separately forced Effect.fn static readers, type narrowing and imports. Restore explanationFor wrapper: WrapperInfo | null, its wrapper?.name ?? "wrapper" expression and the call passing wrapper, retaining the law-forced Osc8Reason matcher and required schema additions. Restore semver major-capture zero fallback and the original indexed three-component loop with nullish fallbacks, retaining the step-2 diagnostic-forced dual signature and typed null checks. Restore any upstream test lines rewritten for these four source changes; ce9331673c changed no existing upstream test file for them, so no such test restoration is presently needed. Preserve existing upstream assertions and added edge tests. Central bookkeeping removes the obsolete coverage deviation claims; do not hand-edit README Port notes or PORT_LEDGER.json.
- seats: grok-2-9, fable-2-10 (source divergences identified by their bookkeeping evidence)

## Backlog

### backlog-1 — ProcessSnapshot round-trip property is missing

- file: scratchpad/test/env/internal/osc8/detect.property.test.ts:35
- class: test   severity: backlog
- standard: D10; §11.4; current merge instruction, S3/property work deferred.
- evidence: grok-2-2 and sol-2-2 show the suite generates its local string-only Snapshot instead of exported ProcessSnapshot, whose env allows undefined-valued entries. Coverage cannot enforce this property floor.
- failure: The production ProcessSnapshot codec has no generated encode/decode identity check for undefined-valued environment entries.
- fix: In S3 import ProcessSnapshot and add it.effect.prop over Arbitrary.schema(ProcessSnapshot), actual encoding/decoding, S.toEquivalence, re-encoding equality and fcRuns. Keep the narrower JSON snapshot property. Reason: deferred S3 property/coverage work, regardless of the seat brief claiming S3 green.
- seats: grok-2-2, sol-2-2

### backlog-2 — Unrestricted packed-format property has an oversized-number counterexample

- file: scratchpad/test/env/internal/osc8/semver.property.test.ts:25
- class: test   severity: backlog
- standard: D10; §11.4; D9; current merge instruction, S3/property work deferred.
- evidence: Both seats give raw = "1000000000000000000000": lab and oracle parse to "100000000000000000.0.0"; stringifyPacked emits "1e+21"; numeric-prefix reparsing returns "0.0.1", whose formatting is "1". Thus both asserted laws fail although the green random sample missed this input.
- failure: The test serializer does not satisfy the inverse-format law over the arbitrary it generates; this is a test-law defect, not an upstream parser bug.
- fix: In S3 generate the inverse-format property from the existing bounded Version tuple, retain unrestricted-input parity checks separately, and add the oversized input as a deterministic oracle-parity case. Preserve parseVteVersion and parseKonsoleVersion. Reason: deferred S3 property work.
- seats: grok-2-3, sol-2-3

### backlog-3 — StreamEnv example contains three accidental implementation imports

- file: scratchpad/effected/env/TerminalEnv.ts:30
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, Example quality; §10.2; current merge instruction, S2 deferred.
- evidence: ce9331673c inserts Predicate, SchemaGetter and identity imports after the Schema import inside the example fence as well as at file scope. Fable attributes a read-only TypeScript JSDoc parse confirming the lines are comment content. Unused imports are not docgen errors, so compilation stays green.
- failure: The rendered example and source hover contain unused imports and three unprefixed comment lines.
- fix: In S2 delete the three accidental imports inside the JSDoc fence, retaining the rest of the example. Implementation import removal belongs to env-r2-2. Reason: deferred S2/JSDoc work.
- seats: grok-2-7, fable-2-1

### backlog-4 — Nested terminal and terminal field reuse an identity segment

- file: scratchpad/effected/env/internal/osc8/detect.ts:290
- class: schema   severity: backlog
- standard: Operator step 4; @beep/identity annote/annoteKey; D11.
- evidence: Both seats identify Osc8Detection.terminal used for the inner Struct annotation and the outer Option field annotation. RuntimeEnv uses distinct DetectedTerminal and RuntimeEnv.terminal segments. Construction and current tests pass; neither seat demonstrates an actual registry or JSON Schema failure.
- failure: The metadata names two layers alike; a consumer collision is proposed but not demonstrated for this module.
- fix: Consider a distinct Osc8Terminal identity and Osc8Terminal.name/version keys, retaining Osc8Detection.terminal on the field. Reason: no demonstrated bug or cited requirement forbidding this specific shared segment, so the hypothetical registry collision remains outside D11 required.
- seats: grok-2-8, fable-2-7

### backlog-5 — CiName custom message repeats the default literal formatter

- file: scratchpad/effected/env/internal/agentCi.ts:29
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21; D11 maintenance preference.
- evidence: fable-2-6 reports byte-identical SchemaError(Expected "github-actions" | "generic") for CiName and the unannotated literal constructors. CiNameBase and the Array-built message exist solely for that customization.
- failure: The domain retains a second constant and formatting work without a demonstrated runtime failure or performance regression.
- fix: Consider annotating LiteralKit(["github-actions", "generic"]) directly and deleting CiNameBase, the custom message and unused Array import after preserving all error text. Reason: optional consolidation outside D11 required.
- seats: fable-2-6

### backlog-6 — Inherited test inventories and assertions await canon migration

- file: scratchpad/test/env/agentCi.test.ts:95
- class: test   severity: backlog
- standard: §11.2; effect-vitest-canon; effect-laws-v1 laws 6/11; current merge instruction, S3 deferred.
- evidence: fable-2-11 identifies upstream native Set inventories in agentCi.test.ts:95/:111, colorDepth.test.ts:113/:178 and osc8.terminals.test.ts:201; Object.keys in agentCi.test.ts:101 and entrypoints.test.ts:7; and the RuntimeEnv.test.ts:179–189 switch. These inherited lines are distinguished from the newly introduced logger Sets in env-r2-3.
- failure: Test-canon migration has not replaced these inherited helper and assertion forms.
- fix: In S3 use HashSet.fromIterable/HashSet.has for inventories, R.keys for key lists, and CiName.$match for the CI switch while retaining the compile-time exhaustiveness proof. Reason: deferred vitest-canon work, as explicitly required by the current merge instruction.
- seats: fable-2-11

## Handled by the deviation codemod

### codemod-1 — Added schema value exports are absent from the export inventory

- file: scratchpad/effected/env/README.md:100
- class: docs   severity: backlog
- standard: D2; Grilling, 2026-10-09 (later), per-module/per-class deviation codemod and exportsAdded.
- evidence: fable-2-9 lists law-forced module-file value exports (AudienceKind, AudienceSource, StreamEnv, CiName, ColorLevel and internal schema values) while README Added exports says None and exportsAdded is empty. Barrel runtime parity remains green.
- failure: The central inventory has not recorded added runtime schema values.
- fix: The central codemod records names, files, value kind and module entry paths in exportsAdded and README Added exports, including new law-required schemas after this wave. No fix group owns README Port notes or PORT_LEDGER.json.
- seats: fable-2-9

### codemod-2 — Forced diagnostic deviation cites a missing repair receipt

- file: scratchpad/effected/PORT_LEDGER.json (env deviations, tsgo-diagnostics)
- class: docs   severity: backlog
- standard: Operator step 2; §14; Grilling, 2026-10-09 (later), central deviation recording.
- evidence: fable-2-10 notes the missing repair-env.md:4,15 citation. History contains 509362cc02 (effected-port step 2), whose env diff adds pipeable compareSemver and result codec operations, plus the round-1 repair record in 3cee0bb25c. The missing receipt does not establish an unforced API change: diagnostic-forced shapes must not be restored merely because their bookkeeping citation is stale.
- failure: The forced diagnostic-deviation record points to evidence a reader cannot open.
- fix: The central per-module tsgo-diagnostics codemod replaces the missing receipt citation with source-bound commit/diff evidence for the specific repaired diagnostic, retaining forced shapes and listing adjusted upstream tests. This is central bookkeeping outside the port write surface; no group may edit the ledger.
- seats: fable-2-10 (missing diagnostic receipt only)

## Rejected

### rejected-1 — Request to retain the four coverage-only source deviations as Port notes

- file: scratchpad/effected/env/README.md:106
- class: docs   severity: backlog
- standard: Grilling, 2026-10-09 (later), restore unforced changes; current write-surface restriction.
- evidence: grok-2-9 and fable-2-10 ask for a coverage bullet covering the ce9331673c class-to-object, wrapper normalization and semver fallback/loop changes. Their underlying source evidence is retained in env-r2-6.
- failure: The proposed bookkeeping remedy would treat the unforced source rewrites as accepted deviations.
- fix: Restore those source shapes under env-r2-6; the central codemod cleans up obsolete claims afterward. Rejection reason: recording coverage-only drift instead of restoring it contradicts the operator ruling, and hand-editing Port notes is centrally owned.
- seats: grok-2-9, fable-2-10 (coverage bookkeeping remedy only)

REQUIRED: 6  BACKLOG: 6  CODEMOD: 2  REJECTED: 1  GROUPS: 4

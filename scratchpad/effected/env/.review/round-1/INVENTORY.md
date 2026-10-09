# env — round-1 merged review inventory

Read all three seats (`grok.md`, `sol.md`, `fable.md`) and their shared `BRIEF.md`; no part-N directories exist. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. Oracle: the brief-pinned cached `af7566a9da2eff169cb74955efcc5ede1e5de9f8` checkout, rather than the moving reference checkout.

**Required: 13 · Backlog: 12 · Handled by the deviation codemod: 1 · Rejected: 1 · Groups: 2.** All 32 original seat records are accounted for below, including split composite findings and the separately rejected remedy.

The full operator revision/rulings block, D1–D20, §12.5 and §14 govern these dispositions. S2 documentation and S3 test-canon/property work remain backlog. Named-domain and pure-data schema violations remain required even when a seat called them backlog; the four green law gates do not implement those requirements. Reviewer probe results are attributed evidence, not new gate runs.

**Allowlist:** parsed every entry in `standards/effect-laws.allowlist.jsonc`; zero files match `scratchpad/effected/env/**`. No `allow-<n>` findings apply to env.

**Write surfaces:** `g1` owns five source files (Audience, RuntimeEnv, agentCi, ColorLevel, TerminalEnv); `g2` owns four OSC8 source files and `osc8.env.test.ts`. The composite Sol domain/model reports are split by independently fixable domain/file so no group exceeds six source files. Existing behavior suites remain intact; schema-only fixes use plain `S.Struct` values and type-only barrel exports and require no existing test edits. New S3 properties are deferred. The OSC8 signature regression/restoration test belongs only to `g2`. No group owns `index.ts`, README or the ledger: barrel runtime keys remain unchanged and deviation/export bookkeeping is central.

## Required

### env-1

- file: scratchpad/effected/env/Audience.ts:17
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19; schema-first-development-prompt, Derive behavior instead of duplicating truth.
- evidence: AudienceKind at :17 is a handwritten union; KINDS at :45 repeats its members as ReadonlyArray<AudienceKind>; :100 searches it and :103 builds the warning from it. AudienceShape.source at :32 is another named finite domain, referenced as AudienceShape["source"] at :123. A missing member in KINDS still compiles. The green four-law gate does not implement this LiteralKit requirement (fable-1-1).
- failure: Named audience kind/source domains lack a schema source of truth; the type, override membership and warning members can drift.
- fix: Define identity-annotated AudienceKind and AudienceSource LiteralKits in Audience.ts, derive their types, derive membership from the kind kit and warning text from its literals, and use the source kit type in AudienceShape. Preserve literals, warning order, precedence and plain service values. Keep index.ts type-only exports; added subpath value exports are recorded centrally.
- seats: grok-1-4, sol-1-2, fable-1-1, fable-1-4 (AudienceShape.source)

### env-2

- file: scratchpad/effected/env/RuntimeEnv.ts:33
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19; schema-first-development-prompt, Derive behavior instead of duplicating truth.
- evidence: CiName at :33 and ci Schema.Literals at :53 repeat github-actions/generic; internal/agentCi.ts:80 repeats them in detectCi's return type. The schema is inferred independently of the public type. Existing RuntimeEnv tests pin these wire strings, but do not enforce a single domain definition.
- failure: CI detection, the exported type and the wire schema independently declare the same finite domain.
- fix: Define the identity-annotated CiName LiteralKit and derived type in internal/agentCi.ts, type detectCi with it, and import/re-export it from RuntimeEnv.ts for optionField(CiName). This avoids a RuntimeEnv/agentCi runtime cycle. Preserve the encoded strings and keep index.ts type-only CiName export; record added exports centrally.
- seats: grok-1-1, sol-1-2, fable-1-2
- related files: scratchpad/effected/env/internal/agentCi.ts

### env-3

- file: scratchpad/effected/env/ColorLevel.ts:6
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19.
- evidence: ColorLevel is a named exported four-literal union used by StreamEnv and colorDepth. It has no schema value. This schema-law omission is outside the four green beep-law checks, rather than a request for the deferred S3 property suite.
- failure: The named color-level domain has no required LiteralKit schema or derived guard.
- fix: Define an identity-annotated ColorLevel LiteralKit with none/basic/256/truecolor and derive the existing type. Keep the barrel export type-only and preserve all colorDepth outputs. Record any added subpath export centrally.
- seats: grok-1-5, sol-1-2, fable-1-4 (ColorLevel)

### env-4

- file: scratchpad/effected/env/internal/osc8/terminals.ts:6
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19.
- evidence: KnownTerminal is a named 22-member union used by TerminalEntry.name and detection. Its runtime schema is absent. Law 19 applies to named domains even without a parallel array; the vendored attribution header does not create an exception.
- failure: The named terminal domain lacks the required schema source of truth.
- fix: Define an identity-annotated KnownTerminal LiteralKit containing exactly the existing names and derive KnownTerminal from its Type. Retain the terminal table order, identification behavior and type-only consumers; do not expose a new barrel value.
- seats: grok-1-6, sol-1-2, fable-1-4 (KnownTerminal)

### env-5

- file: scratchpad/effected/env/internal/osc8/detect.ts:14
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19; schema-first-development-prompt, Derive behavior instead of duplicating truth.
- evidence: Osc8Reason is a named nine-member union; explanationFor at :68-79 separately spells each member in Match.when arms. No annotated runtime domain exists.
- failure: The diagnostic reason type and explanation dispatch maintain separate finite-domain definitions.
- fix: Introduce the identity-annotated Osc8Reason LiteralKit and derived type; derive explanation dispatch from the kit's matcher. Preserve all nine reason strings and every explanation byte.
- seats: grok-1-7, sol-1-2, fable-1-4 (Osc8Reason)

### env-6

- file: scratchpad/effected/env/internal/osc8/env.ts:12
- class: schema   severity: required
- standard: D5/D11; effect-laws-v1 laws 17/19.
- evidence: TruthySpec is the named default/no-color union in envIsTruthy's signature. There is no runtime schema for it; this is a named domain rather than an anonymous inline union.
- failure: The truthiness specification domain lacks its required LiteralKit schema.
- fix: Define an identity-annotated TruthySpec LiteralKit and derive its type in this internal file. Keep the exact two strings and existing truthiness semantics; combine with env-13's upstream-signature restoration, without adding a curried form.
- seats: grok-1-8, sol-1-2, fable-1-4 (TruthySpec)

### env-7

- file: scratchpad/effected/env/RuntimeEnv.ts:51
- class: schema   severity: required
- standard: Operator step 4 (identity annotations on fields and schemas); D5/D11; schema-first-development-prompt, Schema owns pure data and derived structural types.
- evidence: agent/ci/terminal at :51/:53/:55 use description-only annotateKey objects; the nested name/version Struct is anonymous and unannotated. RuntimeEnvOverrides.terminal at :88 repeats its plain shape. The class identity at :56 does not supply field or nested-schema identities. These omissions are present in the green reviewed source.
- failure: RuntimeEnv field and terminal submodel identities are missing; the terminal override type duplicates an existing schema shape.
- fix: Use $I.annoteKey for agent/ci/terminal and nested name/version fields, with stable field identities and descriptions. Extract the nested plain terminal shape into a named, identity-annotated local S.Struct (DetectedTerminal), reuse it in the terminal option field, and derive RuntimeEnvOverrides.terminal from its Type. Preserve wire keys, null/default decoding and plain terminal objects; do not introduce a RuntimeEnv-to-detect cycle. Central codemod records law-forced identity-key deviations.
- seats: grok-1-2, fable-1-5

### env-8

- file: scratchpad/effected/env/RuntimeEnv.ts:8
- class: law   severity: required
- standard: effect-laws-v1 law 1; effect-first-development EF-4; D11.
- evidence: The actual import is import * as Schema from "effect/Schema". Law 1 requires S. Both seats identify the surviving alias in the green commit; the effect-imports check rejects the root barrel but misses this alias.
- failure: Production source violates the canonical Schema namespace alias.
- fix: Rename the namespace import and implementation references to S; rename optionField's generic S parameter to avoid shadowing. Preserve all schema behavior and leave prose conversion to S2.
- seats: grok-1-3, sol-1-4

### env-9

- file: scratchpad/effected/env/TerminalEnv.ts:23
- class: schema   severity: required
- standard: D11; ARCHITECTURE §5; effect-first-development EF-33; schema-first-development-prompt, Schema owns pure data.
- evidence: StreamEnv is an interface containing only isTerminal, color, hyperlinks and Option columns. It is a pure snapshot rather than service operations or overload machinery. The existing gates do not supply a missing runtime schema.
- failure: The stream capability snapshot has no schema source for its structural type or validation.
- fix: Define an identity-annotated StreamEnv S.Struct and derive the existing same-name structural type, using ColorLevel's kit. Preserve plain-object construction, Option columns, booleans and existing accepted values; do not turn service/layer options into data schemas or add S3 properties in this wave. Keep barrel types unchanged.
- seats: sol-1-3 (StreamEnv)

### env-10

- file: scratchpad/effected/env/internal/osc8/terminals.ts:33
- class: schema   severity: required
- standard: D11; ARCHITECTURE §5; effect-first-development EF-33; schema-first-development-prompt, Schema owns pure data.
- evidence: Osc8Capabilities at :33 and IdentifyResult at :45 are interface-only pure payloads (capability booleans, nullable version and rawIdentifier). TerminalEntry.identify is a behavior contract and is a different case.
- failure: The capability and identification payloads lack schema-derived structural types.
- fix: Define named identity-annotated S.Struct values for Osc8Capabilities and IdentifyResult and derive their existing types. Preserve plain objects and nullable version values, existing defaults and table entries; keep TerminalEntry/TerminalMatch behavioral contracts structural where schemas are impractical.
- seats: sol-1-3 (Osc8Capabilities, IdentifyResult)

### env-11

- file: scratchpad/effected/env/internal/osc8/wrappers.ts:5
- class: schema   severity: required
- standard: D11; effect-first-development EF-33; schema-first-development-prompt, Schema owns pure data; effect-laws-v1 law 17.
- evidence: WrapperInfo is an interface-only pure name/passesThrough record, with an inline tmux/screen union at :6. detectWrapper returns ordinary records or null. The source purity scanner forbids node/platform/@effected imports, not effect/Schema or @beep/schema.
- failure: The wrapper diagnostic payload has no schema source of truth.
- fix: Define an identity-annotated WrapperInfo S.Struct and derive its same-name type, preserving plain objects, null for no wrapper and the existing conservative boolean. Use S.Literals for its anonymous inline name field, or a LiteralKit only if that domain is separately named/reused. Retain the vendored attribution header.
- seats: sol-1-3 (WrapperInfo), fable-1-4 (WrapperInfo.name)

### env-12

- file: scratchpad/effected/env/internal/osc8/detect.ts:57
- class: schema   severity: required
- standard: D11; ARCHITECTURE §5; effect-first-development EF-33; schema-first-development-prompt, Schema owns pure data.
- evidence: ProcessSnapshot at :57 and Osc8Detection at :160 are pure interface-only data models. They carry an env record and stream booleans, or stream verdicts and an Option terminal record. No schema is defined for either.
- failure: Detection input and projected result payloads lack schema-derived runtime contracts.
- fix: Introduce named identity-annotated S.Struct models for ProcessSnapshot and Osc8Detection and derive their existing types. Preserve the env record's string/undefined semantics, plain-object results and nested Option name/version values. Keep operational function contracts structural and do not change detection output or add a runtime import cycle.
- seats: sol-1-3 (ProcessSnapshot, Osc8Detection)

### env-13

- file: scratchpad/effected/env/internal/osc8/env.ts:23
- class: bug   severity: required
- standard: Later operator ruling (restore lab changes no law/diagnostic/ruling forced); D9/D11; section 14; effect-laws-v1 Dual-Arity Inventory Contract; EF-18.
- evidence: The port advertises (spec?: TruthySpec) => (value) => boolean, but dual(args => args.length >= 1, ...) routes every nonempty call data-first. Both seats' read-only probes report envIsTruthy("no-color") is a boolean; Sol reports an ensuing curried invocation throws TypeError. The pinned oracle has only the plain (value, spec = "default") function, an explicitly excluded (input, options?) shape. The relevant pipeability diagnostics were not enabled. Current osc8.env.test.ts retains only upstream direct-call tests, so green tests miss the added overload.
- failure: An unforced upstream API divergence advertises a curried specification overload that cannot work at runtime.
- fix: Restore the pinned upstream plain (value: string | undefined, spec: TruthySpec = "default") => boolean signature and body shape, retaining the law-forced HashSet replacement and env-6's domain kit; remove the dual import and both overload declarations. Restore any upstream test lines rewritten for this API (the current suite already uses direct forms), and add a focused direct-signature regression in osc8.env.test.ts. Do not retain or test the zero-argument curried extension as an accepted API.
- seats: sol-1-1, fable-1-3

## Backlog

### backlog-1

- file: scratchpad/effected/env/Audience.ts:50
- class: jsdoc   severity: backlog
- standard: Operator S2 deferral; section 10.2; .patterns/jsdoc-documentation.md.
- evidence: Legacy @remarks/@example carriers remain throughout the module, including Audience.ts:50 and RuntimeEnv.ts:38; exported declarations lack canonical category/since and titled examples. grok-1-9 also notes the flattened CiName link in field description prose.
- failure: Carried documentation has not yet undergone the scheduled beep JSDoc conversion.
- fix: In S2 convert all carried prose to Details/Gotchas/titled Examples, add canonical category and since 0.0.0, restore useful links and supply compiling examples without dropping upstream explanations or example bodies.
- seats: grok-1-9, sol-1-5

### backlog-2

- file: scratchpad/effected/env/README.md:46
- class: docs   severity: backlog
- standard: Operator documentation deferral; effect-laws-v1 law 2.
- evidence: README examples at :46/:66/:80 import Effect, Layer and Option from the root effect barrel.
- failure: Quick-start documentation teaches a forbidden import form.
- fix: During S2 rewrite examples to dedicated namespace imports and O references while preserving example behavior.
- seats: sol-1-6

### backlog-3

- file: scratchpad/test/env/RuntimeEnv.test.ts:21
- class: test   severity: backlog
- standard: Operator S3 deferral; effect-vitest-canon D5; section 11.2.
- evidence: Tests structurally compare Options with deepStrictEqual(O.some(...)); :36 combines O.isNone booleans instead of specialized assertions.
- failure: Option assertions do not use the scheduled canon helpers.
- fix: In S3 migrate Option assertions to assertSome/assertNone from @effect/vitest/utils and retain ordinary assertions for plain values.
- seats: sol-1-7

### backlog-4

- file: scratchpad/test/env/Audience.test.ts:1
- class: test   severity: backlog
- standard: Operator S3 deferral; effect-vitest-canon D14; sections 11.1/11.2.
- evidence: Audience, EnvOverride, TerminalEnv and RuntimeEnv tests construct effectful layers under per-test Effect.provide. File headers suppress strictEffectProvide/multipleEffectProvide; other files suppress nodeBuiltinImport, processEnv or asyncFunction for the inherited test shape. Audience.test.ts:155/:167-168 shows the stacked provisions.
- failure: Deferred layer-canon work and its broad diagnostic suppressions remain in the inherited suites.
- fix: In S3 move effectful/scoped setups to it.layer, preserving intentional memoization tests and pure stubs; remove the provide suppressions the migration makes unnecessary. Retain justified source-scanner, process mutation and dynamic-import diagnostic exceptions with reasons, and preserve all assertions.
- seats: grok-1-10, sol-1-8, fable-1-12

### backlog-5

- file: scratchpad/test/env/RuntimeEnv.test.ts:71
- class: test   severity: backlog
- standard: Operator S3 deferral; D10; section 11.4.
- evidence: RuntimeEnv has example/frozen-wire encode/decode tests, but no property registration, Arbitrary.schema or fcRuns in the module tests.
- failure: The exported schema lacks the scheduled generated round-trip property floor.
- fix: In S3 retain the frozen-wire tests and add it.effect.prop round-trip coverage with Arbitrary.schema(RuntimeEnv), fcRuns and success/equivalence assertions.
- seats: sol-1-9

### backlog-6

- file: scratchpad/effected/env/RuntimeEnv.ts:16
- class: effect-idiom   severity: backlog
- standard: D11 (maintenance preference); AGENTS.md Discovery & Reuse; module-organization internal shared implementation.
- evidence: isProvider is identical in RuntimeEnv.ts:16-18 and EnvOverride.ts:9-11; the source union appears in four signatures. Both use the same Predicate function guard, with no demonstrated behavior failure.
- failure: Repeated helper/type definitions create avoidable maintenance drift.
- fix: In a later consolidation, extract internal/configSource.ts with ConfigSource and the shared isProvider and use them in both modules; preserve dynamic record/provider reads.
- seats: fable-1-6

### backlog-7

- file: scratchpad/effected/env/EnvOverride.ts:62
- class: effect-idiom   severity: backlog
- standard: D11; effect-first-development EF-14 tracing preference.
- evidence: Span names are readResult/read/colorLevel; TerminalEnv.ts:110 also traces the private snapshot helper. EF-14 requires fn/fnUntraced but does not require Owner.method spelling; the report supplies no measured tracing regression.
- failure: Span naming may be ambiguous and private tracing may be unnecessary, without a demonstrated required defect.
- fix: Consider owner-qualified public span names and fnUntraced for snapshot after assessing trace consumers; preserve functional behavior.
- seats: fable-1-7

### backlog-8

- file: scratchpad/effected/env/internal/colorDepth.ts:57
- class: effect-idiom   severity: backlog
- standard: D11 (consolidation preference); effect-laws-v1 law 21.
- evidence: isSet exists in colorDepth, but equivalent undefined/empty checks recur in agentCi, wrappers, terminals, semver and detect. The terse-effect gate is green and the report shows duplication, not a missed scanner diagnostic or semantic regression.
- failure: Equivalent presence checks are maintained in several places.
- fix: Consider one internal/types.ts isSet guard and replace equivalent copies after checking exact semantics; preserve empty-string and undefined behavior and do not introduce trimming.
- seats: fable-1-8

### backlog-9

- file: scratchpad/effected/env/internal/colorDepth.ts:99
- class: effect-idiom   severity: backlog
- standard: D11 (optional representation preference); effect-laws-v1 laws 11/21.
- evidence: The TERM_PROGRAM matcher ends with Match.orElse(() => undefined) and a subsequent undefined check. The upstream switch has already been replaced, and no arm returns undefined or causes an observed failure.
- failure: The internal no-match sentinel could be expressed more explicitly with Option.
- fix: Consider Match.option plus O.isSome while preserving all fall-through/colorDepth behavior.
- seats: fable-1-9

### backlog-10

- file: scratchpad/effected/env/TerminalEnv.ts:2
- class: effect-idiom   severity: backlog
- standard: D11 (import simplification); effect-laws-v1 laws 2/21.
- evidence: StdioModule/TerminalModule type namespace imports duplicate dedicated-path Stdio/Terminal value namespaces. The cited dedicated-path rule is already satisfied; no checker miss or behavior/type failure is shown.
- failure: Two aliases per module add unnecessary reading overhead.
- fix: Delete the duplicate type namespace imports and use Stdio.Stdio/Terminal.Terminal in the existing type positions.
- seats: fable-1-10

### backlog-11

- file: scratchpad/effected/env/RuntimeEnv.ts:51
- class: effect-idiom   severity: backlog
- standard: D11 (formatting preference); formatter convention outside S1 gate.
- evidence: Fable reports 198/185/212-column RuntimeEnv field lines and import-order drift in agentCi/detect, plus long lines in other files. No required behavior or enabled lint failure is shown.
- failure: Unformatted source will generate later incidental formatter churn.
- fix: Apply the repository formatter in the scheduled editing wave or wrap the field annotations and sort the cited imports.
- seats: fable-1-13

### backlog-12

- file: scratchpad/effected/PORT_LEDGER.json (env.commits)
- class: docs   severity: backlog
- standard: D11; ledger bookkeeping; documentation deferral.
- evidence: fable-1-11 reports env.commits contains stage 0 with sha null and no S1 commit despite notes saying S1 is green. This is separate from the law-forced identity/export deviation record.
- failure: The progress ledger is not yet backed by recorded S0/S1 commit references.
- fix: In central ledger closeout, verify the module's actual stage commits and backfill their references; do not invent SHAs or treat report notes as commit proof.
- seats: fable-1-11 (commit bookkeeping)

## Handled by the deviation codemod

### codemod-1

- file: scratchpad/effected/env/README.md:1
- class: docs   severity: backlog
- standard: Later operator ruling: one per-module/per-systemic-class ledger and README deviation entry; D2/D9; section 14.
- evidence: Port notes say Deviations/Added exports: None; the ledger arrays are empty, while Audience, CurrentRuntimeEnv, TerminalEnv keys and RuntimeEnv schema identity use $I and RuntimeEnv.test.ts:733-734 re-keys two test services. The report requests recording those law-forced changes, not undoing them.
- failure: Law-forced identity changes and any new schema exports need central provenance bookkeeping.
- fix: Have the per-module identity-key deviation codemod enumerate affected identities and adjusted upstream tests in the env ledger/README; list new runtime exports in exportsAdded and Added exports. This bookkeeping is not a required fix lane. The separate env.commits request is backlog-12.
- seats: fable-1-11 (identity/export bookkeeping), sol-1-2 (record added exports/law-driven changes), fable-1-1 (conditional export bookkeeping)

## Rejected

### rejected-1

- file: scratchpad/effected/env/internal/osc8/env.ts:23
- class: bug   severity: backlog
- standard: Later operator ruling: unforced upstream divergences must be restored, not retained as deviations.
- evidence: sol-1-1 correctly demonstrates the overload failure, but proposes keeping a zero-argument data-last overload and adding a test for it; the oracle has no such extension and the optional-input signature is excluded from the dual inventory requirement.
- failure: The proposed repair retains part of the unforced public shape change.
- fix: Rejected proposed fix: narrow the added overload to () => (value) => boolean and test that curried form. Use env-13's upstream restoration instead; Sol's defect evidence remains a contributing seat there.
- seats: sol-1-1 (proposed remedy only)
- rejection: Keeping the unforced curried extension contradicts the later operator ruling to restore upstream shape.

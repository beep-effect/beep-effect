# tsconfig-json — round-1 merged inventory

Branch: `@lab/effected`. Reviewed commit in the shared brief: `3fa5876691901fccf3d1cd29e9324564df134b56`.
Seats read: `grok.md` (grok-1-1–5), `sol.md` (sol-1-1–13), `fable.md` (fable-1-1–10), and their shared `BRIEF.md`. No part-N reports exist. 28 original seat findings were adjudicated.
Counts after merging/splitting independent repair sites: **Required 11; Backlog 8; Codemod 3; Rejected 3; Groups 4**.
Binding precedence: the full operator revision/rulings/grilling block, D1–D20, sections 12.5 and 14. S2/S3 have not run. The green-gate statement is taken from the brief; this merge does not rerun or independently certify those gates.
`standards/effect-laws.allowlist.jsonc` contains **zero** entries under `scratchpad/effected/tsconfig-json/**`; therefore there are no synthetic `allow-<n>` findings for this module.
Duplicate reports of one defect are merged with all contributing seat ids. Aggregate seat records are split only where they identify independently repairable domains/APIs or mix required code, deferred work and central bookkeeping. Same source/test files are never assigned to two groups.
Repair lanes touch only their group files/tests. Ledger and README Port notes are centrally generated; no group owns them. No finding requires a repo-level edit. Keep all upstream tests except the smallest law-forced adjustments; restore any test lines rewritten by unforced changes.

## Required

| Group | Source ownership | Test ownership | Findings |
| --- | --- | --- | --- |
| g1 | `CompilerOptions.ts`, `TsconfigJson.ts`, `CompilerOptionsFromProgrammatic.ts`, `TsEnumCodec.ts` | `CompilerOptions.test.ts`, `TsconfigJson.test.ts`, `CompilerOptionsFromProgrammatic.test.ts`, `TsEnumCodec.test.ts`, `TsEnumCodec.assignability.test.ts` | `sol-1-1`, `sol-1-3`, `sol-1-4`, `sol-1-2-record`, `sol-1-6`, `sol-1-7-enums`, `fable-1-1-proof` |
| g2 | `ResolvedTsconfig.ts`, `PortableTsconfig.ts`, `TsconfigDiscovery.ts` | `ResolvedTsconfig.test.ts`, `PortableTsconfig.test.ts`, `TsconfigDiscovery.test.ts` | `sol-1-2-models`, `sol-1-7-resolved` |
| g3 | `JsxConfig.ts` | `JsxConfig.test.ts` | `sol-1-5` |
| g4 | `TsconfigLoader.ts`, `internal/extendsTarget.ts` | `TsconfigLoader.test.ts` | `fable-1-4-internals` |

### sol-1-1
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:251; scratchpad/effected/tsconfig-json/TsconfigJson.ts:178; scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:91; scratchpad/effected/tsconfig-json/TsEnumCodec.ts:303
- class: schema   severity: required
- standard: D5; operator Identity step 4; standards/effect-first-development.md EF-12.   evidence: sol-1-1 reports read-only probes with CompilerOptions.ast.annotations, TsconfigJson.ast.annotations and Target.ast.annotations undefined. grok-1-2/3/4 and fable-1-2 enumerate unannotated compiler/watch domains, Reference, WatchOptions, TypeAcquisition, the document and both codecs; ProgrammaticCompilerOptions instead has a bare identifier. Object fields also lack the step-4 annotations. The green gates missed this metadata obligation.
- failure: The public schema/codec surface lacks canonical IdentityComposer identities and field metadata.
- fix: Create file-local $ScratchpadId composers in the four named files; apply $I.annote to every affected schema/codec and meaningful field annotations to object fields, including the named internal PluginEntry and IgnoreDeprecations blocks. Preserve case folding, optionality and unknown-key passthrough. Generated identity-key deviation records belong to the central codemod.
- seats: grok-1-2, grok-1-3, grok-1-4, sol-1-1, fable-1-2

### sol-1-3
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:34; scratchpad/effected/tsconfig-json/TsconfigJson.ts:27; scratchpad/effected/tsconfig-json/TsEnumCodec.ts:57
- class: schema   severity: required
- standard: D5; effect-laws-v1 law 19; effect-first-development EF-12b.   evidence: The compiler and watch caseInsensitiveLiterals helpers construct named families using S.Literals; IgnoreDeprecations is another named S.Literals domain. EnumFamily is a handwritten nine-family type union. These named domains remain outside LiteralKit despite the green law gates.
- failure: Named literal domains have no canonical kit; EnumFamily additionally has no schema source of truth.
- fix: Use LiteralKit for Target, Module, ModuleResolution, Jsx, NewLine, ModuleDetection, Lib, IgnoreDeprecations, WatchFile, WatchDirectory, FallbackPolling and EnumFamily. Derive EnumFamily from its kit and retain the existing case-insensitive decodeTo transforms and canonical spellings. Kits can remain local when no public addition is needed. Do not replace the anonymous inline TsconfigExtendsError.reason union solely on this evidence.
- seats: grok-1-2, grok-1-3, sol-1-3, fable-1-3

### sol-1-4
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:396; scratchpad/effected/tsconfig-json/TsconfigJson.ts:178; scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:91
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md, Core Modeling Contract / Schema owns pure data (same-name type companion); D2.   evidence: CompilerOptions, Reference, WatchOptions and TypeAcquisition expose namespace Type/Encoded companions, while enum schemas and codecs lack export type Name = typeof Name.Type. The cited schema-first contract explicitly requires that companion; EF-3 alone is not the supporting rule.
- failure: Non-class schema values cannot consistently be used under the same identifier as their decoded types.
- fix: Add same-name schema-derived type aliases to the non-class schema/codec exports in CompilerOptions.ts, TsconfigJson.ts and CompilerOptionsFromProgrammatic.ts. Retain existing Type/Encoded namespaces and upstream export kinds. ProgrammaticCompilerOptions already has its alias at TsEnumCodec.ts:315. Leave added-export recording to the central codemod.
- seats: sol-1-4

### sol-1-2-record
- file: scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:45
- class: schema   severity: required
- standard: effect-first-development EF-33; schema-first-development-prompt.md / Schema owns pure data.   evidence: ProgrammaticRecord is a plain interface with readonly [key: string]: unknown, used as the codec encoded-side model. It is expressible as a record schema, not a service port or overload-only type.
- failure: The encoded-side data domain has a parallel handwritten type instead of a schema source of truth.
- fix: Define the unknown-valued ProgrammaticRecord schema, derive its public type, and use the schema consistently for the codec encoded-side model. Preserve invalid known-field inputs so decoding can reject them through typed schema issues; preserve unknown passthrough.
- seats: sol-1-2

### sol-1-2-models
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:34; scratchpad/effected/tsconfig-json/PortableTsconfig.ts:196; scratchpad/effected/tsconfig-json/TsconfigDiscovery.ts:12
- class: schema   severity: required
- standard: effect-first-development EF-33; schema-first-development-prompt.md / Schema owns pure data; later operator ruling on schema statics.   evidence: ResolvedTsconfig and PortableTsconfig declare property-based data interfaces merged with static facades; sol-1-2 reports ResolvedTsconfig.ast undefined. PortableTsconfigOptions and FindNearestOptions are handwritten configuration interfaces.
- failure: Resolved/portable data and discovery/projection configuration lack schema-derived types and runtime models.
- fix: Define schema sources of truth for ResolvedTsconfig, PortableTsconfig, PortableTsconfigOptions and FindNearestOptions and derive their public types. Use S.Opaque classes with static members where a schema must retain the existing facade. Preserve plain-object helper results, optional-key semantics, passthrough and existing helper names. Keep function-bearing SyncFileSystem/SyncPath ports as interfaces; avoid Object.assign/defineProperties facades.
- seats: sol-1-2

### sol-1-5
- file: scratchpad/effected/tsconfig-json/JsxConfig.ts:28
- class: schema   severity: required
- standard: effect-laws-v1 law 20; effect-first-development EF-13; D9 / section 14 law-forced deviations.   evidence: sol-1-5 reports Success for decoding both { runtime: "automatic" } and { runtime: "classic", importSource: "x" }. The current single optional-field bag does not model the case-specific outputs of fromCompilerOptions.
- failure: The automatic variant can lack its required import source, and the classic model carries an automatic-only field.
- fix: Model runtime variants with LiteralKit and the prescribed toTaggedUnion("runtime") construction, with importSource required on automatic and absent from the classic modeled/encoded variant. Preserve fromCompilerOptions, its defaults, Option results and upstream call sites. Retarget the smallest affected assertions for the law-forced representation and pin both variants in JsxConfig.test.ts; route deviation bookkeeping centrally.
- seats: sol-1-5

### sol-1-6
- file: scratchpad/effected/tsconfig-json/TsconfigJson.ts:238
- class: law   severity: required
- standard: effect-first-development.md, Tagged error with Identity composer template: cause-carrying errors explicitly use S.Defect({ includeStack: true }).   evidence: TsconfigParseError.cause uses S.Defect(). sol-1-6 reports encoding an Error("inner") cause as { name: "Error", message: "inner" }, without its stack. This is a missed law obligation, not merely a request to record a tagged-error conversion.
- failure: Encoding the parse error discards the diagnostic cause stack required by the error-field contract.
- fix: Change the cause schema to S.Defect({ includeStack: true }), retain its field annotation, and add a focused encoded stack-preservation assertion in TsconfigJson.test.ts. Central bookkeeping records the law-forced encoded-shape change.
- seats: sol-1-6

### sol-1-7-enums
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:372
- class: effect-idiom   severity: required
- standard: effect-first-development EF-18, exported reusable helper combinators support data-first and data-last forms.   evidence: The static encode/decode properties expose only two-argument implementations. sol-1-7 reports a one-argument encode call returning an Option instead of a function; the exported-function diagnostic did not detect helpers behind static properties.
- failure: Public enum combinators lack the required pipeable API.
- fix: Add typed data-first/data-last overloads backed by dual to TsEnumCodec.encode and decode, preserving all current two-argument results. Add curried-form parity assertions in TsEnumCodec.test.ts.
- seats: sol-1-7

### sol-1-7-resolved
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:369
- class: effect-idiom   severity: required
- standard: effect-first-development EF-18; green diagnostic missed static-property combinators.   evidence: ResolvedTsconfig.absolutize, merge and substituteConfigDir expose only their data-first implementations through statics at lines 369, 378 and 389.
- failure: These public resolved-config combinators lack the required data-last forms.
- fix: Add typed dual overloads for the existing fixed arities, retaining all existing data-first arguments and results. Verify curried/data-first equivalence in ResolvedTsconfig.test.ts while coordinating with the schema facade conversion in the same group.
- seats: sol-1-7

### fable-1-1-proof
- file: scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:18
- class: type-safety   severity: required
- standard: D9; section 11.1 upstream test meaning retained; section 16 no weakening. The D15-driven full-record widening remains accepted.   evidence: fable-1-1 identifies replacement of upstream CompilerOptionsReplica assignments with unknown-valued ProgrammaticRecord assignments at lines 18 and 27. The current extra check at lines 44-45 verifies only module: number | undefined, leaving the replica proof for the other still-guaranteed known enum/lib keys unrestored.
- failure: The adjusted upstream type test no longer proves the surviving known-key compiler shape. This is the concrete test repair in fable-1-1, separated from its central bookkeeping request.
- fix: Retain the upstream CompilerOptionsReplica and add a cast-free assignment of the known subset (target, module, moduleResolution, jsx, newLine, moduleDetection and lib) picked from encodeCompilerOptions output. Keep the new unknown-passthrough assertions. Do not claim that the entire unknown-valued result assigns to ts.CompilerOptions and do not restore the unsafe upstream assertion.
- seats: fable-1-1

### fable-1-4-internals
- file: scratchpad/effected/tsconfig-json/internal/extendsTarget.ts:155; scratchpad/effected/tsconfig-json/TsconfigLoader.ts:99
- class: effect-idiom   severity: required
- standard: D9; later operator ruling requires restoring unforced upstream divergence; effect-first-development EF-14 permits fnUntraced for internal hot paths.   evidence: Pinned upstream internal/extendsTarget.ts uses untraced Effect.gen for readManifest, resolveRelative and tryCandidate. The port adds Effect.fn("readManifest"), fn("resolveRelative") and fn("tryCandidate") at lines 155, 176 and 200, plus loadAbs/collect spans in TsconfigLoader.ts:99/:125. The fn law can be satisfied without these new spans; ancestor probes and recursive chain collection multiply them.
- failure: Internal loading now emits extra spans without a law/diagnostic requirement to add tracing. This is a tracing-behavior regression, not an unmeasured performance claim.
- fix: Use Effect.fnUntraced for loadAbs, collect, readManifest, resolveRelative and tryCandidate, retaining generator bodies and return contracts. Preserve qualified public loader spans. Restore any upstream tracing assertions rewritten for these internal spans and add a focused no-extra-internal-spans regression in TsconfigLoader.test.ts. Keep diagnostic-required fn/dual adaptations; do not revert to law-violating bare Effect.gen.
- seats: fable-1-4

## Backlog

### sol-1-10
- file: scratchpad/effected/tsconfig-json/TsconfigDiscovery.ts:33; scratchpad/effected/tsconfig-json/TsconfigLoaderSync.ts:220; scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:88
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; canonical JSDocCategories; S2 explicitly deferred.   evidence: Reports enumerate @example in discovery/loader, @remarks in the sync loader, missing titled examples/category/since tags and an unsupported @category codecs.
- failure: The documentation carriers do not meet the eventual docgen rubric; S2 has not run.
- fix: During S2 convert the remaining carriers, preserve their bodies/fences, add meaningful examples and required tags, and use a supported category such as schemas.
- seats: sol-1-10, fable-1-6

### sol-1-11
- file: scratchpad/test/tsconfig-json/CompilerOptions.test.ts:138; scratchpad/test/tsconfig-json/CompilerOptionsFromProgrammatic.test.ts
- class: test   severity: backlog
- standard: D10; section 11.4; effect-vitest-canon property-run configuration; S3 explicitly deferred.   evidence: The existing properties generate limited Subset/Canonical schemas in only two files and do not supply fcRuns(n).
- failure: The per-export schema/codec property floor and repository run counts are not yet established.
- fix: During S3 retain upstream properties and add schema-derived round-trip, normalization and fidelity properties with fcRuns(n), accounting for canonicalized lossy enum aliases.
- seats: sol-1-11

### sol-1-12
- file: scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:21; scratchpad/test/tsconfig-json/CompilerOptions.test.ts:47
- class: test   severity: backlog
- standard: effect-vitest-canon D5; section 11.2; S3 explicitly deferred.   evidence: Tests compare Option objects through deepStrictEqual and inspect Result._tag rather than using the public assertion helpers.
- failure: Assertions do not yet follow the eventual vitest canon.
- fix: During S3 migrate to assertSome/assertNone/assertSuccess/assertFailure from @effect/vitest/utils, preserving expected payloads and plain-value assertions.
- seats: sol-1-12

### sol-1-13
- file: scratchpad/effected/tsconfig-json/README.md:117; scratchpad/effected/tsconfig-json/README.md:161; scratchpad/effected/tsconfig-json/KNOWLEDGE.md:28
- class: docs   severity: backlog
- standard: D4; section 10.3; S2 explicitly deferred.   evidence: README promises a cast-free ts.CompilerOptions handoff, while TsEnumCodec JSDoc says the widened result does not establish it. KNOWLEDGE still mentions one documented internal assertion. Added-export/Port-notes recording is separated into the codemod section.
- failure: Consumer-facing prose describes the upstream narrower contract rather than the lab unknown-passthrough contract.
- fix: During S2 correct the integration prose to distinguish guaranteed numeric enum/lib fields from unknown passthrough and describe consumer-side validation/selection. Adapt the stale assertion claim without deleting carried documentation. Leave Port notes to the central codemod.
- seats: grok-1-1, sol-1-13, fable-1-5

### fable-1-7
- file: scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:97; scratchpad/effected/tsconfig-json/TsEnumCodec.ts:319
- class: perf   severity: backlog
- standard: D11 requires measurement or an algorithmic-class argument for required performance work.   evidence: The codec encode path runs a second CompilerOptions decode to avoid the upstream cast. The report proposes a wide-input encodeRecord helper but provides no measurement; eliminating one of two linear passes does not change the algorithmic class.
- failure: Encoding may incur redundant schema work; no required performance regression is established.
- fix: Benchmark first; if justified, factor a wide-input encodeRecord implementation and expose the existing narrower public signature without assertions, then compose the codec transform directly. Preserve validation and round-trip behavior.
- seats: fable-1-7

### fable-1-9
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:299; scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:341
- class: effect-idiom   severity: backlog
- standard: D11; tersest-equivalent-helper preference; no demonstrated bug or missed enforced gate.   evidence: The report identifies eight/four separate one-key O.getSomesStruct spreads and a paths object/function guard on a typed optional record; it explicitly reports no behavior difference.
- failure: Equivalent helper expressions are verbose, but no required contract defect is established.
- fix: Consolidate each result literal into one multi-key O.getSomesStruct call and simplify the paths presence guard during a later focused cleanup.
- seats: fable-1-9

### fable-1-10
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:70
- class: effect-idiom   severity: backlog
- standard: D11; D5 explicitly permits MutableHashMap as well as HashMap.   evidence: FamilyTable uses MutableHashMap tables built once and only read thereafter. The report shows no mutation bug or performance measurement; the native-map replacement itself was law-forced.
- failure: The internal table type advertises mutation that callers currently do not perform; immutable collections would improve intent.
- fix: Consider HashMap forward/reverse tables and HashMap.get, preserving alias last-row-wins semantics; treat this as an immutability preference rather than a new required native-runtime replacement.
- seats: fable-1-10

### fable-1-4-public
- file: scratchpad/effected/tsconfig-json/TsconfigDiscovery.ts:20
- class: effect-idiom   severity: backlog
- standard: D11; EF-14 prefers tracing reusable public effects but does not mandate module-qualified span names.   evidence: The public helper uses Effect.fn("findNearest"). The report cites qualified examples, not a rule forbidding this name; its fn conversion is justified by the law.
- failure: The public span is less identifiable than a module-qualified name, without an established required defect.
- fix: Consider naming the public span TsconfigDiscovery.findNearest; do not combine this naming preference with the required restoration of unforced internal spans.
- seats: fable-1-4

## Handled by the deviation codemod

### grok-1-1-deviation
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:292; scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:18
- class: law   severity: backlog
- standard: D15; D9 / section 14; later operator ruling: per-module, per-systemic-class deviation codemod.   evidence: All three seats compare the upstream narrower ProgrammaticCompilerOptionsValue index and return assertion with the lab unknown-valued schema and adjusted full-record assignments. Reports find empty deviation records.
- failure: The accepted D15/schema-first public-type deviation has not yet been centrally recorded. The remaining known-key proof repair is required separately as fable-1-1-proof.
- fix: Central codemod records the law-forced cast removal/type widening once for the module/class, lists sites and adjusted upstream tests, and writes the ledger and README Port notes. Retain the unknown-valued schema and never restore the unsafe assertion.
- seats: grok-1-1, sol-1-8, fable-1-1

### sol-1-9
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:385
- class: law   severity: backlog
- standard: schemaNumber TS377098; D9 / section 14; later operator ruling explicitly names S.Finite recording as systemic codemod work.   evidence: sol-1-9 reports upstream Success / port Failure for Infinity and NaN; the port uses S.Finite where upstream used Schema.Number. Reports find no deviation record. No evidence shows that the required S.Finite replacement itself is wrong.
- failure: The law-forced narrowing of maxNodeModuleJsDepth is missing its central deviation record.
- fix: Retain S.Finite. Central codemod generates one module/class entry listing the field and relevant adjusted upstream tests, with the README Port note. The alternate suppression proposal in grok-1-5 is rejected separately.
- seats: grok-1-5, sol-1-9

### codemod-exports
- file: scratchpad/effected/tsconfig-json/index.ts:41; scratchpad/effected/tsconfig-json/CompilerOptions.ts:396
- class: law   severity: backlog
- standard: D2; later operator ruling: added exports go to exportsAdded through the central codemod.   evidence: ProgrammaticCompilerOptions is now exported as a value as well as a type, but reports find exportsAdded empty and README Added exports None. sol-1-4 and fable-1-3 also request bookkeeping for prospective schema-derived aliases/kits.
- failure: Law-forced export additions lack central inventory records; this bookkeeping is not a repair-lane write.
- fix: Central codemod records actual added values/types in exportsAdded and README Port notes after the fix wave, including ProgrammaticCompilerOptions and any aliases/kits truly exported. Do not invent additional kit exports merely to satisfy a bookkeeping suggestion.
- seats: grok-1-1, sol-1-4, sol-1-13, fable-1-1, fable-1-3

## Rejected

### grok-1-5-suppression
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:385
- class: schema   severity: backlog
- standard: Later operator S.Finite ruling; green all-rules-at-error gate; no diagnostic suppression.   evidence: grok-1-5 proposes restoring S.Number with a schemaNumber suppression as one alternative; its retain-and-record alternative is merged into sol-1-9.
- failure: Rejection reason: restoring S.Number with a suppression contradicts the binding S.Finite ruling and defeats the already-green diagnostic gate.
- fix: Retain S.Finite; route the deviation record to the central codemod as sol-1-9.
- seats: grok-1-5

### fable-1-3-anonymous-reason
- file: scratchpad/effected/tsconfig-json/TsconfigLoader.ts:70
- class: schema   severity: backlog
- standard: effect-first-development EF-12b; AGENTS.md permits S.Literals for anonymous inline unions.   evidence: The report proposes turning the inline TsconfigExtendsError.reason S.Literals into a named exported kit because tests compare its strings. It identifies no pre-existing named literal domain or guard family for that field.
- failure: Rejection reason: this anonymous inline union is explicitly permitted; matching its values does not alone prove a named-domain law violation.
- fix: Keep the inline reason schema absent additional domain-reuse evidence; apply the genuine named-domain repairs under sol-1-3.
- seats: fable-1-3

### fable-1-8
- file: scratchpad/effected/tsconfig-json/internal/extendsTarget.ts:137; scratchpad/effected/tsconfig-json/internal/extendsTarget.ts:257
- class: effect-idiom   severity: backlog
- standard: EF-18; green exported-helper diagnostic; D9 allows law-forced changes.   evidence: resolveExports and resolveExtendsTarget are exported fixed-arity combinators with dual overloads. The one-argument resolveExports("./x") result is the declared curried function; the report demonstrates no incorrect two-argument result or gate miss.
- failure: Rejection reason: removing dual reverses a law/diagnostic-supported adaptation, and the reported one-argument function is the intended overload rather than a bug.
- fix: Retain dual forms and both existing data-first contracts.
- seats: fable-1-8

Codemod and rejected records use `severity: backlog` because section 12.4 has only required/backlog severities; their section determines disposition, and they are excluded from the Backlog count and required.json.

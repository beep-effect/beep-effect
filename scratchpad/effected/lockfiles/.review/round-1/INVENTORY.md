# lockfiles — round-1 merged inventory

Seats read: `grok.md` (6 records), `sol.md` (11), `fable.md` (15), and their shared `BRIEF.md`; no part-N subdirectories. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; branch: `@lab/effected`.

Required: 17 | Backlog: 10 | Handled by the deviation codemod: 2 | Rejected: 0 | Groups: 4.

Binding basis: the full operator revision and both 2026-10-09 ruling blocks, D1–D20, sections 12.4–12.5 and 14 of `scratchpad/EFFECTED_PORT_GOAL.md`. Allowlist scan: **0 lockfiles entries**, so there are no `allow-<n>` additions.

This is a merge of the seats’ supplied evidence, not a new gate/probe run. Duplicate defects retain all contributing finding ids. Broad findings are split by independent payload or ownership surface with suffixed ids. Only the two inventory artifacts are written; implementation, tests, configs, shared ledgers and README Port notes are not edited.

The required cause/version defects challenge the correctness of a change itself; the codemod entries address only recording systemic law-forced changes. Law-forced representations are not rejected merely because their bookkeeping is absent. The diagnostics-registry subfixes are separately Backlog with the reason "outside the port's write surface". Public native collections must move to Effect collections; fable-1-15’s old preserve-and-allowlist alternative is not selected.

Required ownership is in `required.json`: g1 owns six core/parser/guard source files; g2 the env parser and reader; g3 catalog/document schemas; g4 the format kit. Existing suites listed there are exclusive ownership, not authorization to perform S3 conversion. Core behavior fixes run together; g1 should land before g2/g3 so consumers can use its derived shared models.

## Required

### grok-1-1 — Restore npm syntax-cause preservation and the rewritten upstream assertion.
- file: scratchpad/effected/lockfiles/internal/npm.ts:72,153
- class: bug   severity: required
- standard: D9; section 11.1; section 14; D15.
- evidence: Pinned oracle preserves the JSON.parse throwable through Effect.try; hostile.test.ts:511 upstream asserts SyntaxError. The port asserts S.SchemaError at :515. Fable reports a malformed-input probe returning SchemaError and cites SchemaGetter.parseJson dropping the thrown value; the retained diagnostic-exception rationale explicitly names that lost contract.
- failure: The actual syntax cause, including engine position details and RangeError identity, is discarded. This is a demonstrated cause-preservation defect, beyond a request to record a law-forced replacement; a rewritten test hides it.
- fix: Restore the oracle Effect.try shape with try: (): unknown => JSON.parse(content), catch: syntaxFailure, and the narrowly reasoned preferSchemaOverJson next-line exception for original throwable preservation. Remove decodeJson, restore the original parser comment and hostile.test.ts SyntaxError assertion; retain all hostile-input tests. The separate diagnostic-registry correction is Backlog, outside this group.
- seats: grok-1-1, fable-1-1

### grok-1-2 — Restore upstream non-finite version handling across all four formats.
- file: scratchpad/effected/lockfiles/internal/shared.ts:305; internal/npm.ts:56,62; internal/pnpm.ts:45; internal/bun.ts:67; internal/yarn.ts:41
- class: bug   severity: required
- standard: D9; section 14; schemaNumber intentional-non-finite exception; user merge rule: defects in the change itself remain required.
- evidence: Grok cites all four oracle Number schemas and downstream version handling. Fable probes npm 1e999 and pnpm .inf producing SchemaError instead of UnsupportedLockfileVersion; bun 1e999 and yarn .inf are accepted upstream as version Infinity but rejected by the port. The version gate explicitly owns non-finite rejection.
- failure: Finite decoding changes the promised version-gate cause and prevents the ungated formats from reporting upstream-supported versions. Retained as a behavior defect; recording the systemic Number-to-Finite class alone does not repair it.
- fix: Restore intentional non-finite version acceptance at these boundary sites with S.Number and narrowly justified schemaNumber next-line exceptions, preserving the upstream version-gate and stringification behavior. Include pnpm.ts raw version schema. Add focused npm/pnpm unsupported-cause and bun/yarn accepted-version witnesses in hostile.test.ts without weakening any upstream assertions. Diagnostic-registry and deviation bookkeeping remain central/outside the lane.
- seats: grok-1-2, grok-1-3, grok-1-4, grok-1-5, fable-1-2, fable-1-3

### sol-1-1 — Make UnsupportedLockfileVersion narrowing validate the complete record.
- file: scratchpad/effected/lockfiles/UnsupportedLockfileVersion.ts:74
- class: type-safety   severity: required
- standard: EF-12b; EF-35; D11; section 14 upstream-bug exception.
- evidence: Sol probes both oracle and port: the guard accepts {_tag: UnsupportedLockfileVersion, format: npm, minimumSupported: 3}; accessing cause.message.length throws TypeError. It also accepts yarn outside the declared npm|pnpm domain. Lockfile.test.ts:1601 preserves the incomplete guard.
- failure: The predicate narrows unknown to a record with unchecked required fields and format literals.
- fix: Define a complete structural schema, derive validation with S.is while retaining the own _tag check, and validate lockfileVersion, message, minimumSupported and exact format domain. Adjust the incomplete-record near-miss assertion in Lockfile.test.ts and add absent-field/wrong-format cases. Preserve legitimate class and structural causes; send the demonstrated upstream-bug deviation to central bookkeeping.
- seats: sol-1-1

### sol-1-2 — Replace four native sorts while preserving resolution and output order.
- file: scratchpad/effected/lockfiles/internal/bun.ts:129; internal/pnpm.ts:250,386; internal/yarn.ts:196
- class: law   severity: required
- standard: Effect laws v1 law 10; EF-38.
- evidence: Both seats identify four native sorts; sol probes hotspot detection false for these files and fable cites NoNativeRuntime.ts:463 restricting sort detection to hotspot scope. No lockfiles allowlist entry covers them.
- failure: The native-sort law is violated at production sites the green gate misses.
- fix: Use A.sort and explicit Order: descending prefix length for bun, ascending UTF-16 string order for unresolved names in pnpm/yarn. Consume the returned array and retain stable equal-length ordering. Preserve existing ancestor-resolution and unresolved-edge expectations.
- seats: sol-1-2, fable-1-8

### sol-1-3a — Use a schema JSON codec in version-error formatting.
- file: scratchpad/effected/lockfiles/internal/shared.ts:288
- class: effect-idiom   severity: required
- standard: EF-3; EF-19.
- evidence: Sol identifies JSON.stringify(raw) in ordinary arrow-function error formatting; preferSchemaOverJson only checks recognized Effect contexts, and native-runtime has no JSON-method branch.
- failure: A concrete schema-codec law violation survives the green gates.
- fix: Encode the version-message scalar with an appropriate schema JSON codec using its non-throwing form; preserve exact quoted/string/number message bytes and the existing typed UnsupportedLockfileVersion failure. Do not add a native stringify wrapper to evade detection.
- seats: sol-1-3

### sol-1-3b — Use the existing JsonString codec in pnpm env key messages.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:90,94
- class: effect-idiom   severity: required
- standard: EF-3; EF-19.
- evidence: Sol identifies JSON.stringify(key) in ordinary arrow functions outside the diagnostic recognized contexts; the existing JsonString codec demonstrates an equivalent available representation.
- failure: Key-message serialization still bypasses Schema despite green gates.
- fix: Reuse JsonString through an explicit non-throwing schema encoder for these keys, preserving exact JSON quoting and typed failure messages. Avoid native JSON calls and unnecessary new failure channels.
- seats: sol-1-3

### sol-1-4a — Derive PnpmCatalogs from one shared catalog schema.
- file: scratchpad/effected/lockfiles/PnpmExtension.ts:17
- class: schema   severity: required
- standard: Architecture: Schemas Are Executable Contracts; EF-33; schema-first: Schema owns pure data.
- evidence: PnpmCatalogs separately spells the same catalog/specifier/version record shape used by PnpmExtension.catalogs.
- failure: A duplicate TypeScript domain definition can drift from its runtime schema.
- fix: Name and reuse the existing catalog schema for PnpmExtension.catalogs; derive PnpmCatalogs from that schema, keeping public record shape, optionality and encoding unchanged.
- seats: sol-1-4

### sol-1-4b — Derive shared payload and failure types from schemas.
- file: scratchpad/effected/lockfiles/internal/shared.ts:195,340,352,366,390,404
- class: schema   severity: required
- standard: EF-33; EF-12b; schema-first: Schema owns pure data.
- evidence: Sol names representable handwritten PeerDeclarations, ContentFailure, FramingFailure, ParseFailure, LockfileFields and WorkspaceEntry; the report distinguishes these payloads from overload and service types.
- failure: Named domain payloads and failure variants have no schema-authoritative definition.
- fix: Define annotated structural schemas preserving current plain-object shapes, with a stage-discriminated ParseFailure union; derive types from them. Model unknown causes without narrowing away engine throwables. Coordinate with the peerDeclarations and Effect-map fixes in the same group.
- seats: sol-1-4

### sol-1-4c — Model document and pnpm stream payloads with schemas.
- file: scratchpad/effected/lockfiles/internal/documents.ts:12,42
- class: schema   severity: required
- standard: EF-33; schema-first: Schema owns pure data.
- evidence: Sol identifies SelectedDocument and PnpmStream as representable handwritten domain payloads, rather than service/overload machinery.
- failure: Document-selection and stream payloads are TypeScript-only domain models.
- fix: Introduce annotated structural schemas for SelectedDocument and PnpmStream and derive their types without changing runtime objects, document order, framing or selection behavior.
- seats: sol-1-4

### sol-1-4d — Derive ResolvedEdges from a structural schema.
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:259
- class: schema   severity: required
- standard: EF-33; schema-first: Schema owns pure data.
- evidence: Sol identifies the ResolvedEdges interface as a named, representable dependency-resolution payload.
- failure: Resolution output has a parallel TypeScript-only domain model.
- fix: Define an annotated structural ResolvedEdges schema and derive its type, preserving edge records and unresolved-name arrays exactly.
- seats: sol-1-4

### sol-1-5 — Use LiteralKit for the named LockfileFormat domain.
- file: scratchpad/effected/lockfiles/LockfileFormat.ts:24
- class: schema   severity: required
- standard: Effect laws v1 law 19; EF-12b; D5.
- evidence: Both seats identify a named exported annotation-bearing S.Literals domain referenced by schemas, dispatch and filename mappings. The kit law is not enforced by the cited green gates; LiteralKit retains the literals tuple.
- failure: The central format domain violates the mandatory named-domain kit convention.
- fix: Use LiteralKit([bun, npm, pnpm, yarn]) with string literals, no as const, retaining identity annotations, same-name type alias, literal order and filename behavior. Keep existing format tests unchanged unless an actual representation assertion needs retargeting.
- seats: sol-1-5, fable-1-7

### sol-1-6a — Annotate parser boundary schemas and fields in the four format parsers and shared helpers.
- file: scratchpad/effected/lockfiles/internal/npm.ts:29,55,59; internal/bun.ts; internal/pnpm.ts; internal/yarn.ts; internal/shared.ts
- class: schema   severity: required
- standard: Operator revision step 4; EF-12.
- evidence: Sol identifies NpmPackageEntry, NpmVersionProbe and NpmLockfileRaw without composer/field annotations, and the same omission in named raw schemas in the other listed files. Public class annotations do not annotate those independent boundary schemas.
- failure: The identity requirement remains incomplete for internal boundary schemas; this metadata requirement is not established by a green type/lint gate.
- fix: Add file-local Scratchpad IdentityComposer identities and meaningful schema and field annotations to the named raw schemas in these five files. Preserve permissive decoding and public shapes; coordinate the version and shared-schema findings in this group.
- seats: sol-1-6

### sol-1-6b — Annotate pnpm env parser boundary schemas and fields.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts
- class: schema   severity: required
- standard: Operator revision step 4; EF-12.
- evidence: Sol includes pnpmEnv named raw schemas among missing schema and field IdentityComposer metadata; public class annotations do not cover them.
- failure: The env-preamble boundary schemas do not meet the identity requirement.
- fix: Add file-local Scratchpad IdentityComposer metadata and meaningful schema/field annotations to named raw schemas in pnpmEnv, preserving decoding. Coordinate with this group’s public collection and JSON-codec fixes.
- seats: sol-1-6

### fable-1-4 — Restore the unambiguous upstream peerDeclarations call shape.
- file: scratchpad/effected/lockfiles/internal/shared.ts:221
- class: bug   severity: required
- standard: D11; D15; missingPipeableSignature ambiguous-overload exception.
- evidence: The declared data-last (meta, optionalPeers?) overload accepts explicit undefined, but dual routes it data-first. Fable probes peerDeclarations({react:{optional:true}}, undefined) returning an object where the types promise a function; all six production calls are data-first, so tests miss it.
- failure: A type-valid call returns the wrong kind of value and can throw TypeError or emit peer metadata as dependency ranges.
- fix: Remove the ambiguous dual/data-last overload and restore the oracle fixed-arity (peers, meta, optionalPeers?) shape with the narrowly justified missingPipeableSignature next-line exception. Add helper-call regression cases to importers.test.ts, preserving all upstream cases. Centralize the diagnostic registry update separately.
- seats: fable-1-4

### fable-1-5 — Remove native Map backing access from workspace dependency extraction.
- file: scratchpad/effected/lockfiles/internal/shared.ts:435; internal/bun.ts:239; internal/npm.ts:273; internal/pnpm.ts:558; internal/yarn.ts:148
- class: law   severity: required
- standard: Effect laws v1 law 6; D5; section 16.
- evidence: extractWorkspaceDeps takes ReadonlyMap and all four parsers pass MutableHashMap.backing. The gate flags native constructors, so the native Map obtained through backing escapes detection. MutableHashMap is already iterable in insertion order.
- failure: Domain logic still consumes a native Map and depends on an Effect collection representation field.
- fix: Type both helper overloads over MutableHashMap<string, WorkspaceEntry>; pass workspaceEntries directly from bun/npm/pnpm/yarn and remove the backing-contract comments. Keep iterable traversal order and all workspace-edge behavior unchanged.
- seats: fable-1-5

### fable-1-6 — Use fnUntraced for pnpm’s nested per-row emitter.
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:505
- class: effect-idiom   severity: required
- standard: EF-14: internal hot paths use fnUntraced; EffectFn recommendation for nested owners.
- evidence: Nested emit uses Effect.fn(emit) once per snapshot and orphan package row (:538,:549); the oracle used an untraced closure. The fn gate permits traced wrappers, so it does not enforce the specific internal-hot-path standard.
- failure: The inner row emitter opens unnecessary spans and violates the cited hot-path idiom. Retained for the explicit idiom requirement, not an unmeasured performance claim.
- fix: Change only the nested emit wrapper to Effect.fnUntraced; preserve its generator body, arguments, output and outer parser tracing.
- seats: fable-1-6

### fable-1-15 — Expose Effect HashMap from configDependencies instead of a native backing Map.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:189,194; PnpmEnvLockfile.ts:84
- class: law   severity: required
- standard: Effect laws v1 law 6; later operator ruling permitting public Effect collection changes.
- evidence: readPnpmConfigDependencies returns locks.backing; the public reader promises ReadonlyMap and PnpmEnvLockfile.test.ts:466 uses native .get. As with workspace maps, constructor-only detection misses the backing access.
- failure: The public result remains a native Map. The report’s proposed preserve-and-allowlist alternative contradicts the later operator direction; select its Effect-collection fix.
- fix: Return HashMap.fromIterable(locks), update PnpmEnvLockfile’s reader result type to HashMap<string, ConfigDependencyLock>, and retarget native .get assertions in PnpmEnvLockfile.test.ts to HashMap.get with Option assertions. Preserve keys, integrity values and any promised iteration order explicitly. No new allowlist entry; deviation bookkeeping is central.
- seats: fable-1-15


## Backlog

### sol-1-8 — Convert carried JSDoc during S2.
- file: scratchpad/effected/lockfiles/index.ts:21
- class: jsdoc   severity: backlog
- standard: Section 10.2; JSDoc law; S2 deferred.
- evidence: Sol scans 21 TypeScript files: 29 remarks, three example tags, no category/since tags; entry example uses declare; BunExtension lacks a value example.
- failure: Carriers, metadata and examples await the scheduled S2 pass.
- fix: During S2 preserve upstream prose, convert to titled sections, add canonical categories and since 0.0.0, and supply compiling concrete examples.
- seats: sol-1-8

### sol-1-9 — Adapt the README during S2.
- file: scratchpad/effected/lockfiles/README.md:28,45,46
- class: docs   severity: backlog
- standard: Section 10.3; import law; S2 deferred.
- evidence: README retains registry badges/install guidance/stability boilerplate and root effect / @effected imports.
- failure: Readers are directed to upstream installation and examples rather than the lab port.
- fix: During S2 remove the specified release/install boilerplate, use lab and dedicated Effect imports, and preserve API explanations and attribution; Port-notes bookkeeping stays central.
- seats: sol-1-9

### sol-1-10 — Complete property coverage and run floors in S3.
- file: scratchpad/test/lockfiles/roundtrip.property.test.ts:181
- class: test   severity: backlog
- standard: D10; section 11.2; S3 deferred.
- evidence: Only six schema round-trip registrations; the report lists eight omitted exported schemas, no extension generation, no fcRuns and no generated parser-fidelity property.
- failure: The property floor and run configuration are incomplete ahead of S3.
- fix: During S3 add the missing schemas and extension cases, retain upstream suites, add oracle parser-fidelity properties and use fcRuns(n).
- seats: sol-1-10

### sol-1-11 — Migrate Option assertions during S3.
- file: scratchpad/test/lockfiles/Lockfile.test.ts:74,78-80
- class: test   severity: backlog
- standard: Vitest canon D5; section 11.2; S3 deferred.
- evidence: Effect tests assert Option predicates as booleans and unwrap through getOrUndefined.
- failure: Option outcomes do not use canonical narrowing assertions.
- fix: During S3 use assertSome/assertNone and narrowed Some.value, keeping plain-value assertions.
- seats: sol-1-11

### fable-1-9 — Simplify total string-message encoding.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:154,191
- class: effect-idiom   severity: backlog
- standard: D11; EF-19; terse-helper convention.
- evidence: String message fragments are encoded in the Effect error channel and mapped to validationFailure despite the codec being total for these inputs.
- failure: Readability and avoidable message-formatting plumbing; no demonstrated bug or measured regression.
- fix: Use a pure non-throwing JsonString schema encoder helper for the two message fragments, preserving exact quoting. Do not adopt the report’s native JSON.stringify alternative, which conflicts with EF-19.
- seats: fable-1-9

### fable-1-10 — Consider an Option-valued integrity helper.
- file: scratchpad/effected/lockfiles/internal/shared.ts:52
- class: effect-idiom   severity: backlog
- standard: D11; Option modeling preference.
- evidence: Missing integrity returns Effect.as(Effect.void, undefined); four callers immediately convert it to Option.
- failure: Possible allocation/readability improvement without a measured regression or proven incorrect output.
- fix: Consider returning Effect<Option<IntegrityHashBrand>, ParseFailure> with succeedNone/some and consuming integrity through getSomesStruct; preserve missing-integrity output semantics.
- seats: fable-1-10

### fable-1-11 — Profile or simplify workspace-name set construction.
- file: scratchpad/effected/lockfiles/internal/bun.ts:177; internal/npm.ts:193; internal/pnpm.ts:438,446; internal/yarn.ts:100
- class: perf   severity: backlog
- standard: D11 measured-regression/algorithmic-class threshold.
- evidence: Repeated immutable HashSet additions build workspaceNames; neighboring builders use MutableHashSet. No measurement or algorithmic-class improvement is established.
- failure: Potential allocation churn, below the required performance threshold.
- fix: Use MutableHashSet for build-then-query or build HashSet once from collected names if later profiling justifies it; HashSet.empty is the minimal empty-constructor cleanup.
- seats: fable-1-11

### fable-1-12-export — Consider exposing the pnpm env error for consumer narrowing.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:16; index.ts
- class: schema   severity: backlog
- standard: EF-12b/EF-35 intermediate-schema export guidance; D11.
- evidence: The report notes PnpmEnvPreambleError is module-local while its instance can appear as a public parse-error cause.
- failure: An optional new public narrowing API is proposed; the report does not establish a binding universal export requirement for this internal helper error.
- fix: Consider exporting the error where it materially clarifies the public cause contract; if accepted, added-export bookkeeping is handled centrally. Keep its existing typed representation.
- seats: fable-1-12

### fable-1-13 — Correct shared diagnostic-exception records centrally.
- file: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:27
- class: docs   severity: backlog
- standard: Section 17; outside the port's write surface.
- evidence: The row records npm.ts:150 preferSchemaOverJson with a rationale that current code no longer implements; the reported directive scan is empty.
- failure: The shared diagnostic ledger is stale. Reason: outside the port's write surface.
- fix: Central maintainer corrects the row after the npm cause fix, or removes it if the exception is not retained; no required group edits this file.
- seats: fable-1-13, fable-1-1, fable-1-2, fable-1-3, fable-1-4

### fable-1-14 — Consider a consistent internal tracing convention.
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:127; internal/bun.ts:153; internal/npm.ts:169; internal/pnpm.ts:401; internal/yarn.ts:79
- class: effect-idiom   severity: backlog
- standard: D11; EF-14 general tracing convention.
- evidence: Parsers mix traced/untraced wrappers and four transforms share toFields span names. The specific per-row emit defect is separately required.
- failure: A module-wide tracing convention is an unmeasured observability preference; no gate miss or mandatory rule for all these wrappers is demonstrated.
- fix: If useful later, use qualified span names or a documented internal-untraced convention, preserving behavior. The concrete emit change is owned by fable-1-6.
- seats: fable-1-14


## Handled by the deviation codemod

### sol-1-7 — Record the surviving Number-to-Finite deviation class centrally.
- file: scratchpad/effected/lockfiles/internal/yarn.ts:41; internal/shared.ts:305; internal/npm.ts:56,62; internal/pnpm.ts:45; internal/bun.ts:67
- class: docs   severity: backlog
- standard: Later operator ruling: one module/class deviation entry for Number-to-Finite.
- evidence: Sol asks only to record law:schemaNumber differences in accepted input and rejection cause; ledger/README currently record none.
- failure: Systemic law-forced bookkeeping is absent. Actual behavior defects are separately retained under grok-1-2.
- fix: The central codemod records the module’s final surviving Number-to-Finite sites and adjusted upstream tests after the fix wave; omit restored sites. Do not hand-edit PORT_LEDGER or README Port notes.
- seats: sol-1-7

### grok-1-6 — Record the native-error-to-tagged-error deviation class centrally.
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:16,80
- class: docs   severity: backlog
- standard: Native-error law 7; later operator per-module/per-class deviation-codemod ruling.
- evidence: Oracle new Error is replaced with PnpmEnvPreambleError; message remains equal while constructor and _tag change. Grok asks to keep the typed error and record it; fable adds the same bookkeeping request.
- failure: The law-forced tagged-error replacement is unrecorded; no defect in the replacement itself is demonstrated.
- fix: Central codemod records the tagged-error replacement class and PnpmEnvLockfile.test.ts cause-message sites. Retain PnpmEnvPreambleError. A possible new export is separately Backlog; any accepted addition is recorded in exportsAdded centrally.
- seats: grok-1-6, fable-1-12


## Rejected

None. Every merged defect has source/probe evidence and a concrete selected fix; no whole finding is rejected solely for being a duplicate. In mixed proposals, conflicting alternatives are excluded in the selected record rather than counted as another defect.

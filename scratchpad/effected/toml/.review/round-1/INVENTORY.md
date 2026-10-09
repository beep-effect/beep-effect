# toml — round-1 merged inventory

Seats read: `grok.md` (7 findings), `sol.md` (12 findings), `fable.md` (19 findings), and their shared `BRIEF.md`; no part subdirectories. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. Pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts after deduplication and repair-surface splitting: **Required 17 · Backlog 11 · Codemod 5 · Rejected 2 · Groups 3**. One allowlist entry is represented by `allow-1`, deduplicated with `fable-1-5`.

The full operator revision/rulings and later grilling override older instructions. S2/S3 work is deferred. Broad metadata, performance and error findings are split only into independent repair surfaces; contributing seat IDs are preserved on every subrecord. `fable-1-16` is split between required restoration of unforced oracle lines and deferred S3 canon migration. Report totals are advisory; classification follows each record's evidence.

Required ownership: **g1** owns model schemas (3 source files); **g2** owns edit/format/visitor (3); **g3** owns the engine (6). `required.json` lists the exclusive source and test files. No new shared guard export is needed for the performance fixes; guards can be local to their owners. Positional raw-error compatibility keeps `TomlDiagnostic.test.ts` exclusively in g1. Every referenced file is an evidence location; only `groups[].files/tests` are authorized write surfaces.

Do not assign `package.json`, `bun.lock`, repo config, `PORT_LEDGER.json`, `DIAGNOSTIC_EXCEPTIONS.md` or README Port notes to these groups. Central integration removes the resolved allowlist entry and generates deviation/exports bookkeeping. Performance numbers below are attributed seat evidence, not newly executed benchmarks.

## Required

### r-literals
- file: scratchpad/effected/toml/TomlNode.ts:18,42,72; scratchpad/effected/toml/TomlDiagnostic.ts:25,39,53,67
- class: schema   severity: required
- standard: D5; Effect laws 19; EF-12b   evidence: Seven named domains use S.Literals: NonFiniteSpelling, TomlKeyKind, TomlStringStyle, and four Toml*ErrorCode schemas. Seats identify this gate gap: the four green law gates do not require LiteralKit.
- failure: Named domains lack the mandated LiteralKit schema and Enum/is/$match surface.
- fix: Replace all seven named domains with LiteralKit, retaining literals, annotations, names and typeof X.Type aliases; annotate the internal NonFiniteSpelling. Pass existing const tuples directly and do not add as const to inline arrays. Keep TomlErrorCode as the union of the four kits and anonymous newline unions as S.Literals.
- seats: grok-1-1, grok-1-2, sol-1-3, fable-1-6

### r-calendar-check
- file: scratchpad/effected/toml/TomlDateTime.ts:36-41
- class: schema   severity: required
- standard: Effect laws 18; EF-12c   evidence: Reusable isRealCalendarDate is shared by three date classes, but its S.makeFilter metadata is only { title: "a real calendar date" }; these metadata fields are not enforced by the green law gates.
- failure: The reusable calendar constraint has no identifier or description.
- fix: Add an IdentityComposer-derived identifier and a meaningful description alongside the existing title. Preserve the predicate, accepted dates and user-facing failure text.
- seats: grok-1-3, sol-1-4

### r-metadata-model
- file: scratchpad/effected/toml/TomlNode.ts:29,183; scratchpad/effected/toml/TomlDateTime.ts:44-55
- class: schema   severity: required
- standard: Operator step 4; D5; EF-12   evidence: TomlValueNode is an unannotated suspended schema, IeeeNumber lacks canonical schema annotations, and the shared date/time field schemas lack field annotations. This is completed-stage identity work, not deferred S2 prose.
- failure: Identity and schema metadata are incomplete on model schemas and reused fields.
- fix: Annotate TomlValueNode and IeeeNumber with the local $I.annoteSchema/annote helpers and add meaningful annotations to shared date/time fields. Preserve suspension, IEEE codecs, arbitraries and all validation behavior. The NonFiniteSpelling metadata is owned by r-literals.
- seats: sol-1-5, fable-1-6

### r-metadata-facade
- file: scratchpad/effected/toml/TomlEdit.ts:17; scratchpad/effected/toml/TomlFormat.ts:48; scratchpad/effected/toml/TomlVisitor.ts:39
- class: schema   severity: required
- standard: Operator step 4; D5; EF-12   evidence: TomlEditInvariantError, TomlFormatInvariantError and TomlVisitorInvariantError have composer-derived constructor identities but no canonical schema metadata or message-field annotation.
- failure: Three facade invariant schemas omit the required schema and field metadata.
- fix: Add local composer-derived annotations and meaningful message-field annotations to the three existing S.TaggedError schemas. Preserve tags, construction and failure messages; do not consolidate their error identities.
- seats: sol-1-5

### r-metadata-engine
- file: scratchpad/effected/toml/internal/limits.ts:10; scratchpad/effected/toml/internal/semantic.ts:32; scratchpad/effected/toml/internal/stringifyValue.ts:25
- class: schema   severity: required
- standard: Operator step 4; D5; EF-12   evidence: TomlCapError, TomlSemanticInvariantError and TomlStringifyInvariantError lack canonical schema annotations and their message fields lack annotations.
- failure: Three engine invariant schemas omit required schema and field metadata.
- fix: Annotate each existing error schema with its local $I and annotate its message field, keeping current tags, messages and construction behavior. Do not replace schema metadata work with a JSDoc conversion.
- seats: sol-1-5

### r-visitor-schema
- file: scratchpad/effected/toml/TomlVisitor.ts:56-71
- class: schema   severity: required
- standard: AGENTS.md schema-first model law; D5; EF-13   evidence: TomlVisitorEvent is a public four-case Data.TaggedEnum type literal with Data.taggedEnum constructors; no schema defines the event payloads. The green gates do not enforce schema-first provenance.
- failure: The event domain has no schema source of truth for validation, codecs or arbitraries.
- fix: Define an annotated schema tagged union for TableStart, ArrayTableStart, KeyValue and Comment, deriving the event type from it. Preserve constructors, $is, $match, payloads and document-order behavior through a compatibility facade; derive any retained Data facade from the schema type.
- seats: sol-1-6

### r-sort
- file: scratchpad/effected/toml/TomlEdit.ts:79; scratchpad/effected/toml/TomlVisitor.ts:156
- class: law   severity: required
- standard: Effect laws 10; AGENTS.md Code Laws   evidence: The reviewed gate-green code contains [...edits].sort(...) and positioned.sort(...), with no matching exceptions. This explicitly demonstrates missed enforcement.
- failure: Two production paths retain forbidden native array sorting.
- fix: Use A.sort with explicit numeric projection Orders: descending edit offsets, ascending visitor offsets. Use the returned sorted collection, keep the edit input unmodified, and preserve stable ordering for ties.
- seats: sol-1-2

### r-error-modify
- file: scratchpad/effected/toml/TomlFormat.ts:532-545,985
- class: law   severity: required
- standard: Effect laws 7; D5; .patterns/error-handling.md   evidence: ModifyFailure extends Data.TaggedError with a type-literal payload, a positional constructor and an instanceof catch. It has no registered low-level exception despite the green gates.
- failure: The modification throw carrier is not schema-backed as the binding error law requires.
- fix: Convert ModifyFailure to an annotated S.TaggedError with code, message, offset and len fields; use an S.is-derived catch guard. Preserve tag, name, messages and facade error behavior. Keep a positional compatibility constructor or update failResolve within this same file; do not drop error names merely because tests omit them.
- seats: sol-1-7, fable-1-12

### r-error-engine
- file: scratchpad/effected/toml/internal/diagnostics.ts:70-77; scratchpad/effected/toml/internal/limits.ts:25-38
- class: law   severity: required
- standard: Effect laws 7; D5; .patterns/error-handling.md   evidence: RawTomlError and GuardExceeded extend Data.TaggedError with interface/type-literal payloads, and use instanceof guards; neither has an exception. Constructor callers exist in scanner, parser, semantic and stringifyValue, plus TomlDiagnostic.test.ts.
- failure: Raw diagnostic and guard carriers lack required schema-backed errors and identities.
- fix: Define an annotated RawDiagnostic schema and convert RawTomlError and GuardExceeded to annotated S.TaggedError schemas with annotated fields and S.is-derived guards. Preserve positional constructor compatibility (including new RawTomlError(diagnostic) used by TomlDiagnostic.test.ts), tags, name="Error", messages and facade catch behavior; alternatively adapt engine callers only within this group. Do not change the test constructor contract owned by g1.
- seats: sol-1-7, fable-1-12

### r-schema-alias
- file: scratchpad/effected/toml/internal/parser.ts:47,278-281
- class: law   severity: required
- standard: Effect laws 1   evidence: Parser imports effect/Schema as Schema and calls Schema.is four times. Seats explain the gate gap: effect-imports preserves local bindings rather than enforcing S.
- failure: The production Schema namespace violates the mandatory S alias.
- fix: Rename the namespace import to S and update all four references. If r-perf-engine replaces these guards, retain the S binding only where still needed; place remaining Effect imports together.
- seats: grok-1-4, sol-1-9, fable-1-2

### r-match-provenance
- file: scratchpad/effected/toml/internal/semantic.ts:102-116
- class: effect-idiom   severity: required
- standard: EF-7; Effect laws 11; AGENTS.md conditional-chain law   evidence: The upstream seven-case Provenance switch became a six-branch if/else-if ladder on existing.kind with no terminal else. The no-switch gate checks the keyword, missing the prescribed Match replacement.
- failure: Closed-domain dispatch loses an exhaustive-match obligation and silently falls through for a new variant.
- fix: Use exhaustive Match dispatch across table-explicit, table-implicit, table-dotted, array-tables, inline, static-array and value, returning the next SemNode. Preserve mutations, error codes, precedence and the last array-table selection.
- seats: sol-1-8, fable-1-3

### r-match-scalar
- file: scratchpad/effected/toml/internal/stringifyValue.ts:159-178
- class: effect-idiom   severity: required
- standard: EF-7; Effect laws 11; AGENTS.md conditional-chain law   evidence: renderScalar replaces upstream typeof-switch dispatch with five predicate branches; the green no-switch gate missed prescribed Match dispatch.
- failure: Scalar dispatch retains the conditional ladder prohibited by the cited Effect idiom.
- fix: Use Match for string, boolean, number, bigint and TOML datetime scalar cases with an undefined fallback. Preserve IntegerOutOfRange inside bigint handling and all rendered bytes. Coordinate with r-perf-engine so hoisted datetime guards are reused.
- seats: fable-1-4

### r-match-escapes
- file: scratchpad/effected/toml/internal/scanner.ts:164-183
- class: effect-idiom   severity: required
- standard: EF-7; Effect laws 11 and 23; AGENTS.md conditional-chain law   evidence: simpleEscape is an eight-case if/else-if chain replacing upstream switch dispatch. The same no-switch gate gap applies; a cold path does not waive D11 law/idiom findings.
- failure: Escape dispatch retains handwritten finite-case conditional branching.
- fix: Use Match with the existing undefined fallback or an Effect HashMap codepoint-to-character table and O.getOrUndefined. Preserve all eight mappings, including escape, quote and backslash; unknown codes must stay undefined.
- seats: sol-1-8, fable-1-18

### r-perf-facade
- file: scratchpad/effected/toml/TomlFormat.ts:148,154,160,317,332,334,436,438,583,644,821; scratchpad/effected/toml/TomlVisitor.ts:91,146
- class: perf   severity: required
- standard: D11 measured regression; instanceOfSchema diagnostic; EF-7   evidence: Seat fable-1-1 reports a pinned-oracle-equivalent 275,380-byte document (400 tables x 25 keys plus 400 array-tables), median of seven: parse 115.3/64.6 ms (1.79x), stringify 13.8/6.2 ms (2.24x), format 65.5/46.4 ms (1.41x). Per-call S.is costs 157 ns versus 5.5 ns instanceof; four datetime misses 642/9 ns; a hoisted guard 69 ns. These are seat measurements, not rerun by the inventory merger. Facade hot paths rebuild schema guards for already-typed tagged CST nodes.
- failure: Facade node dispatch contributes avoidable guard compilation and allocations to the measured formatter/visitor regression.
- fix: Use allocation-free Predicate.isTagged or exhaustive Match dispatch for already-typed TomlValueNode/TomlExpression unions in TomlFormat and TomlVisitor. Preserve schema validation at unknown boundaries, error order and bytes; do not restore banned instanceof checks. Re-run the seat benchmark after integration and report the comparison (the seat proposes a 1.1x target, not a new binding gate).
- seats: fable-1-1

### r-perf-engine
- file: scratchpad/effected/toml/internal/stringifyValue.ts:144-147; scratchpad/effected/toml/internal/parser.ts:278-281; scratchpad/effected/toml/internal/semantic.ts:213,216,227,231,268,271,278,332,335
- class: perf   severity: required
- standard: D11 measured regression; instanceOfSchema diagnostic; EF-7   evidence: Seat fable-1-1 reports a pinned-oracle-equivalent 275,380-byte document (400 tables x 25 keys plus 400 array-tables), median of seven: parse 115.3/64.6 ms (1.79x), stringify 13.8/6.2 ms (2.24x), format 65.5/46.4 ms (1.41x). Per-call S.is costs 157 ns versus 5.5 ns instanceof; four datetime misses 642/9 ns; a hoisted guard 69 ns. These are seat measurements, not rerun by the inventory merger. Engine datetime probes build up to four guards per value; semantic node dispatch recompiles guards 2-3 times per node.
- failure: Repeated engine guard compilation contributes to the measured parse/stringify/format regression.
- fix: Hoist the datetime schema guard once per parser/stringifier module (a local union avoids cross-group exports), and use Predicate.isTagged or exhaustive Match for already-typed semantic CST unions. Avoid datetime checks on arrays/plain objects when preserving scalar and unsupported-value classification. Keep unknown-input validation, circular-reference checks, bytes and error order unchanged. Re-run the seat workload after all groups integrate; do not replace Effect collections with native ones.
- seats: fable-1-1

### r-restore-test-lines
- file: scratchpad/test/toml/Toml.test.ts:39,50,62,72,80,89,277; scratchpad/test/toml/TomlDocument.test.ts:74; scratchpad/test/toml/hostile.test.ts:48,254; scratchpad/test/toml/e2e/toml-test.e2e.test.ts:66
- class: test   severity: required
- standard: Later operator ruling: restore unforced oracle divergences; D9; section 14   evidence: fable-1-16 identifies eleven replacements of upstream Effect.flip with Effect.result(...).pipe(Effect.map(result => result.pipe(Result.flip, Result.getOrThrow))). Read-only diffs against the pinned oracle confirm the rewrites; Effect.flip still appears in the same green module tests. No cited law, diagnostic or ruling requires replacing these calls.
- failure: Unforced upstream test rewrites change unexpected-success failure extraction and violate the operator restoration ruling.
- fix: Restore the eleven upstream Effect.flip extraction lines, retaining required import rewrites, current S.decodeEffect API names and diagnostic/D15-forced assertion guards. Remove only imports made unused by that restoration; retain legitimate Effect.result parity assertions. Preserve test names, bodies and assertions otherwise. Defer assertFailure/assertExitFailure migration to S3 (b-canon).
- seats: fable-1-16

### allow-1
- file: scratchpad/effected/toml/internal/stringifyValue.ts:181,188,225,270,330
- class: law   severity: required
- standard: beep-laws/no-native-runtime; kind: new-map-set; Effect laws 6; later operator cycle-detection ruling   evidence: Allowlist entry standards/effect-laws.allowlist.jsonc:453-460: file scratchpad/effected/toml/internal/stringifyValue.ts, kind new-map-set, issue EFFECTED-TOML-CYCLE-DETECTION. checkCircular and recursive render/emit paths thread Set<object> and create new Set(). This is toml's only allowlist entry; fable-1-5 reports the same defect.
- failure: Native identity-keyed Set cycle detection remains under an exception the operator explicitly removed.
- fix: Replace Set<object> with a ReadonlyArray<object> ancestor stack; scan using A.some(ancestors, ancestor => ancestor === value), never structural A.contains/HashSet. Pass [...ancestors, value] down recursive renderInline/emitTable branches and start with []; preserve branch-local ancestry, nesting limits and CircularReference diagnostics. Keep hostile.test.ts cycle cases and Toml.test.ts three-hop cycles unchanged and add/retain a shared-but-acyclic sibling case. The central integrator removes the allowlist entry and generated bookkeeping; this group must not edit standards or repo config.
- seats: fable-1-5, operator:allowlist:EFFECTED-TOML-CYCLE-DETECTION

## Backlog

### b-jsdoc
- file: scratchpad/effected/toml/Toml.ts:173-182; scratchpad/effected/toml/index.ts:4; scratchpad/effected/toml/TomlDocument.ts:58-70; scratchpad/effected/toml/TomlFormat.ts:852-866; scratchpad/effected/toml/TomlVisitor.ts:192-216
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; D4; S2 deferral   evidence: Seats identify @example/@remarks/@public carriers across public modules, absent @category/@since and missing examples. Fable counts 23 carriers each in Toml.ts/TomlFormat.ts, 21 in TomlNode.ts and 14 in TomlDiagnostic.ts.
- failure: Public docs have not reached beep carrier grammar and annotation/example coverage.
- fix: During S2, preserve upstream bodies and examples, convert to titled **Example** (Title) and **Details**/**Gotchas**, add canonical categories and @since 0.0.0, drop @public, and run example typechecks.
- seats: grok-1-5, sol-1-10, fable-1-10
- disposition: S2 has not run; docs and JSDoc are backlog by operator order.

### b-readme-imports
- file: scratchpad/effected/toml/README.md:50,70,85,118
- class: docs   severity: backlog
- standard: Effect laws 2; S2 deferral   evidence: README quick-start fences retain root effect barrel imports and @effected/toml package imports.
- failure: Documentation teaches forbidden imports and a package specifier different from the lab entry.
- fix: During S2, use dedicated effect/Effect and effect/Schema imports (Effect and S), update examples to the intended lab entry, and retain the demonstrated outcomes.
- seats: grok-1-7, sol-1-11
- disposition: Documentation is deferred to S2.

### b-properties
- file: scratchpad/test/toml/oracle.property.test.ts:300
- class: test   severity: backlog
- standard: D10; S3 property floor   evidence: Only two differential properties are registered, with literal runs: 250 and seed: 20260710, test-local generators, no fcRuns and no formatter-idempotence property.
- failure: Production-schema round trips and parser/formatter fidelity/idempotence properties are incomplete.
- fix: In S3 retain differential suites, route counts through fcRuns and add schema-derived round trips and parser/formatter fidelity and idempotence properties.
- seats: sol-1-12
- disposition: Coverage, property floor and canon have not run (S3).

### b-stale-exception
- file: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:32
- class: docs   severity: backlog
- standard: Diagnostic exception register; Allowlist Contract   evidence: Fable reports that the TomlNode.ts:90 schemaNumber suppression is absent, while the register still lists it; IeeeNumber now replaces the former suppressed float field. The oracle.property.test.ts:265 suppression remains live.
- failure: The exceptions register over-counts a nonexistent source suppression.
- fix: Central bookkeeping should remove the stale TomlNode row or explain the IeeeNumber replacement; retain the separate live test suppression.
- seats: fable-1-8
- disposition: outside the port's write surface

### b-description-links
- file: scratchpad/effected/toml/TomlDiagnostic.ts:116; scratchpad/effected/toml/TomlDocument.ts:88
- class: jsdoc   severity: backlog
- standard: S2 carrier conversion; section 10.2   evidence: Plain annotation strings contain literal (TomlErrorCode:type) and (TomlExpression:type), copied from upstream TSDoc link syntax.
- failure: Schema descriptions display declaration-reference artifacts as plain text.
- fix: Use the plain names in schema description strings; retain proper {@link (X:type)} syntax only in JSDoc bodies.
- seats: fable-1-9
- disposition: Prose/carrier cleanup belongs to deferred S2.

### b-diagnostic-collection
- file: scratchpad/effected/toml/TomlDocument.ts:106-117
- class: effect-idiom   severity: backlog
- standard: Effect laws 21; crispen rubric; D11   evidence: A mutable diagnostics array is captured by Effect.catch/Effect.sync to collect at most one semantic failure; the seat proposes Effect.match returning [diagnostic] or [].
- failure: The closure is less direct, but no behavior failure or mandatory helper-form violation is demonstrated.
- fix: Consider Effect.match with onFailure returning [diagnostic] and onSuccess returning [] while preserving defect passthrough and document construction.
- seats: fable-1-11
- disposition: Readability preference; outside D11 required without a demonstrated equivalent-form law violation.

### b-invariant-consolidation
- file: scratchpad/effected/toml/TomlFormat.ts:48; scratchpad/effected/toml/TomlEdit.ts:18; scratchpad/effected/toml/TomlVisitor.ts:39; scratchpad/effected/toml/internal/semantic.ts:33; scratchpad/effected/toml/internal/stringifyValue.ts:26; scratchpad/effected/toml/internal/limits.ts:10
- class: effect-idiom   severity: backlog
- standard: Discovery & Reuse; crispen rubric; D9/D11   evidence: Six private invariant classes and roughly 25 missing-element checks were added for noUncheckedIndexedAccess; the seat found no shared repo helper.
- failure: Repeated guard boilerplate obscures logic, but no bug, measured regression or required consolidation is shown.
- fix: Evaluate a module-local extraction only if it preserves each existing error identity, message and failure order. Do not adopt the seat's single-error replacement without a law or verified bug justifying that observable change.
- seats: fable-1-13
- disposition: Optional consolidation outside D11; collapsing error tags would require a section-14 cause.

### b-lookup-spelling
- file: scratchpad/effected/toml/TomlFormat.ts:505; scratchpad/effected/toml/internal/semantic.ts:lookup sites
- class: effect-idiom   severity: backlog
- standard: Effect laws 21; D11 perf evidence   evidence: Ten MutableHashMap lookups vary in pipe spelling. The reported 9.0 ms versus 4.0 ms native-Map microbenchmark measures collection implementation, not a benefit from extracting a lookup helper.
- failure: Lookup spelling varies; a helper has no measured or algorithmic regression benefit.
- fix: Consider a local lookup helper or consistent pipe form where it reduces code; retain Effect collections and do not claim the extraction removes hashing cost.
- seats: fable-1-14
- disposition: Style consolidation outside D11; benchmark does not establish a regression fixed by the proposed helper.

### b-canon
- file: scratchpad/test/toml/Toml.test.ts; scratchpad/test/toml/TomlDocument.test.ts; scratchpad/test/toml/hostile.test.ts; scratchpad/test/toml/e2e/toml-test.e2e.test.ts
- class: test   severity: backlog
- standard: effect-vitest-canon SPEC D5; S3 deferral   evidence: fable-1-16 proposes assertFailure/assertExitFailure migration for failure tests. Unforced extraction rewrites are separately required under r-restore-test-lines.
- failure: Tests are not yet migrated to canonical assertion helpers.
- fix: During S3 migrate failure assertions using Effect.exit/Effect.result and the canonical helpers, retaining all upstream assertion meaning; do not use S3 deferral to retain the unforced rewrites now.
- seats: fable-1-16
- disposition: Only canon migration is deferred; oracle restoration is required separately.

### b-tagged-json-wrapper
- file: scratchpad/test/toml/e2e/taggedJson.ts:136-146
- class: test   severity: backlog
- standard: Effect laws 21; missingPipeableSignature; S3 deferral   evidence: Two overloads and an args.length dispatch forward to assertMatchesTaggedDual, which already has both signatures. Pinned-oracle comparison confirms this surrounds the diagnostic-forced dual conversion.
- failure: The test helper has redundant dispatch and duplicated signatures, without a demonstrated test failure.
- fix: During test cleanup, expose the dual(3, ...) implementation directly with both signatures and remove the forwarding wrapper; preserve every tagged-JSON assertion and the diagnostic-required dual form.
- seats: fable-1-17
- disposition: Test helper cleanup outside D11; retain the diagnostic-forced dual contract.

### b-layout-newline
- file: scratchpad/effected/toml/internal/semantic.ts:1-25; scratchpad/effected/toml/internal/scanner.ts:1; scratchpad/effected/toml/internal/diagnostics.ts:1; scratchpad/effected/toml/internal/limits.ts:1-4; scratchpad/effected/toml/internal/stringifyValue.ts:1-18; scratchpad/effected/toml/internal/parser.ts:47-49; scratchpad/effected/toml/TomlFormat.ts:19-43,71; scratchpad/effected/toml/Toml.ts:41
- class: effect-idiom   severity: backlog
- standard: .patterns/module-organization.md; D11; Effect laws 19   evidence: Header comments split imports in several files; two anonymous inline newline unions use the same literals. The parser alias violation is already required under r-schema-alias.
- failure: Import layout is scattered; duplicate anonymous unions are legal and do not establish a required named domain.
- fix: Consider regrouping imports beneath headers in Effect/@beep/relative order. Extract a shared newline domain only if reuse warrants it; keep the current anonymous S.Literals unions otherwise.
- seats: fable-1-19
- disposition: Layout and optional extraction outside D11; anonymous inline literal unions are expressly allowed.

## Handled by the deviation codemod

### c-identity
- file: scratchpad/effected/toml/TomlNode.ts:class identities; scratchpad/effected/toml/README.md:158
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod; D9/section 14   evidence: All class/schema identifiers now use $ScratchpadId-derived keys; README and ledger report no deviations.
- failure: Identity-derived JSON Schema identifiers are not recorded.
- fix: The central codemod emits one toml identity-keys deviation class with all schema sites and adjusted upstream test lines (or none adjusted).
- seats: fable-1-7
- disposition: Recording only; README Port notes and PORT_LEDGER.json are centrally owned. Native-runtime bookkeeping for allow-1 also belongs to that central pass, not a module write group.

### c-finite
- file: scratchpad/effected/toml/TomlNode.ts:101; scratchpad/effected/toml/TomlDiagnostic.ts:109-112; scratchpad/effected/toml/TomlEdit.ts:47-48,64-65
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod; D9/section 14   evidence: Schema.Number became S.Finite in integer/spans/position fields. sol-1-1 confirms Infinity range construction now fails, but the later ruling explicitly recognizes the law-forced narrowing.
- failure: Law-forced numeric narrowing is missing from deviation records.
- fix: The central codemod emits one toml S.Finite systemic deviation with every site and adjusted tests; do not restore S.Number or widen these fields.
- seats: grok-1-6, fable-1-7
- disposition: Recording only; README Port notes and PORT_LEDGER.json are centrally owned. Native-runtime bookkeeping for allow-1 also belongs to that central pass, not a module write group.

### c-tagged-errors
- file: scratchpad/effected/toml/internal/limits.ts:49; scratchpad/effected/toml/TomlEdit.ts:87; scratchpad/effected/toml/internal/stringifyValue.ts:304; scratchpad/effected/toml/internal/semantic.ts:invariant throws; scratchpad/effected/toml/TomlFormat.ts:invariant throws
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod; D9/section 14   evidence: Native TypeError/Error defects became typed cap/invariant carriers; a sparse array-of-tables hole now throws TomlStringifyInvariantError instead of native TypeError.
- failure: Law-forced defect-carrier changes are absent from deviation bookkeeping.
- fix: The central codemod emits one toml tagged-errors class covering cap, overlap, sparse-array and invariant sites and adjusted tests, including the required Data-to-S.TaggedError repairs once applied. Conversion correctness remains required in r-error-engine and r-error-modify.
- seats: grok-1-6, fable-1-7
- disposition: Recording only; README Port notes and PORT_LEDGER.json are centrally owned. Native-runtime bookkeeping for allow-1 also belongs to that central pass, not a module write group.

### c-ieee-number
- file: scratchpad/effected/toml/TomlNode.ts:29,112
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod; D9/section 14   evidence: TomlFloat uses declared IeeeNumber with JSON, StringTree and Arbitrary links to retain inf/nan under schemaNumber.
- failure: The diagnostic-forced IEEE schema representation is not recorded.
- fix: The central codemod records the IEEE-number representation as a toml systemic diagnostic-driven deviation with its sites and any adjusted upstream tests; preserve non-finite float support.
- seats: fable-1-7
- disposition: Recording only; README Port notes and PORT_LEDGER.json are centrally owned. Native-runtime bookkeeping for allow-1 also belongs to that central pass, not a module write group.

### c-dual-overloads
- file: scratchpad/effected/toml/internal/scanner.ts:94,107,130,150,224,269,329,408,498,604; scratchpad/effected/toml/internal/limits.ts:44; scratchpad/effected/toml/internal/semantic.ts:257; scratchpad/effected/toml/internal/stringifyValue.ts:319
- class: docs   severity: backlog
- standard: Later operator ruling: per-module, per-class deviation codemod; D9/section 14   evidence: Exported fixed-arity engine functions gained data-last overloads for missingPipeableSignature, which the ledger records as an error gate.
- failure: Diagnostic-forced dual overload additions lack centralized bookkeeping.
- fix: The central codemod records one toml dual-overloads diagnostic class with all sites and adjusted test lines, retaining the gate-required overloads; record added exports separately through exportsAdded if any repair adds them.
- seats: fable-1-7
- disposition: Recording only; README Port notes and PORT_LEDGER.json are centrally owned. Native-runtime bookkeeping for allow-1 also belongs to that central pass, not a module write group.

## Rejected

### x-finite-reversal
- file: scratchpad/effected/toml/TomlEdit.ts:48
- class: bug   severity: backlog
- standard: schemaNumber; later operator law-forced S.Finite ruling   evidence: sol-1-1 measures the loss of Infinity-length range construction and asks to widen the schema back to the upstream numeric domain.
- failure: The behavior difference is real but is the explicitly accepted law-forced S.Finite change.
- fix: Reject numeric-domain restoration; retain S.Finite and route its deviation bookkeeping to c-finite.
- seats: sol-1-1
- rejection: Contradicts the operator acceptance of law-forced S.Finite narrowing; no evidence shows the change itself is wrong under that ruling.

### x-dual-suppression
- file: scratchpad/effected/toml/internal/scanner.ts:94; scratchpad/effected/toml/internal/limits.ts:44; scratchpad/effected/toml/internal/semantic.ts:257; scratchpad/effected/toml/internal/stringifyValue.ts:319
- class: tsgo   severity: backlog
- standard: missingPipeableSignature error gate; later operator restoration ruling applies only to unforced changes   evidence: fable-1-15 asks for skip-file exemptions and oracle arities despite identifying missingPipeableSignature as the forcing diagnostic; wrapper timing is 3.4 versus 1.9 ms per million scanWhitespace calls.
- failure: The finding treats diagnostic-forced dual additions as discretionary and proposes weakening their green gate.
- fix: Retain the required dual signatures and handle recording under c-dual-overloads; do not write DIAGNOSTIC_EXCEPTIONS.md or add blanket skip-file suppressions.
- seats: fable-1-15
- rejection: Contradicts retention of diagnostic-forced changes; no missed diagnostic or measured module regression attributable to this proposed fix is shown.

REQUIRED: 17  BACKLOG: 11  CODEMOD: 5  REJECTED: 2  GROUPS: 3

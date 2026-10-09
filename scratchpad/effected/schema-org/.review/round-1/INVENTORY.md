# schema-org — round-1 merged inventory

Read all six seat reports (`part-1/{grok,sol,fable}.md`, `part-2/{grok,sol,fable}.md`) and both adjacent `BRIEF.md` files. They review commit `3fa5876691901fccf3d1cd29e9324564df134b56` against pinned upstream `af7566a9da2eff169cb74955efcc5ede1e5de9f8`; current HEAD is `a8a7f89a303b878f475b9d23d5be5cbbbd17c88b`, with no tracked source/test diff for this module from the reviewed commit.

Counts after deduplication and clause-level classification: **Required 11 · Backlog 13 · Codemod 2 · Rejected 1 · Groups 2**. The 40 original records include one unnumbered test record; seat ids below include the part directory to distinguish repeated ids. Split clauses retain their contributing seat id in each disposition; these counts count merged dispositions, not original seat records.

Applied the complete operator revision/rulings/grilling block, D1–D20, §12.4–12.5 and §14. `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/schema-org/**`, so there are no `allow-<n>` findings to add. No independently unforced upstream source/test rewrite was established by these reports; the public Set codec workaround remains required because the replacement itself is wrong.

Write ownership: **g1** owns the four connected public source files and the four listed existing test files; **g2** owns only `internal/vocabulary.ts` and needs no test edits. All groups stay under six source files and share no source/test write paths. Tests may be run across groups without transferring write ownership. The root barrel, type-only conformance entrypoint, shared runner, configs, lockfiles, ledger and README Port notes are not assigned. The upstream-bug receipt in backlog-13 must be supplied centrally before the req-8 behavior change; law-forced bookkeeping is handled by the two codemod records.

## Required

### req-1
- file: scratchpad/effected/schema-org/Vocabulary.ts:20; scratchpad/effected/schema-org/JsonLdDocument.ts:19; scratchpad/effected/schema-org/Conformance.ts:401
- class: law   severity: required
- standard: D5; effect-laws-v1 law 6; operator grilling 2026-10-09, public native collections and explicit order.
- evidence: part-1/fable-1-1 reports a read-only Effect 4.0.2 probe: Vocabulary.ancestorsOf("TechArticle") instanceof Set and doc.nodeIds instanceof Set are both true. Both decodeStringSet constants use S.decodeResult(S.toCodecIso(S.ReadonlySet(S.String))). NoNativeRuntime.ts:69,390-397 checks constructor NewExpressions, so this codec construction escaped the green gate. Consumers still use defined.has(...). The current module matches the reviewed source.
- failure: The codec hides native Set construction rather than replacing it; ancestorsOf, propertiesOf and nodeIds retain the disallowed native public collection contract.
- fix: Remove both decodeStringSet constants and return HashSet.HashSet<string> from ancestorsOf, propertiesOf and nodeIds, using HashSet.empty/fromIterable and HashSet.has in Conformance.check and danglingReferences. Retain an explicit readonly sequence wherever public insertion order was promised; retain dangling-reference first-seen order with an output array plus a membership set. Retarget Vocabulary.test.ts membership/size assertions to HashSet helpers and add representation/order regressions in the existing Vocabulary.test.ts and JsonLdDocument.test.ts. D9 recording is codemod-2, not group work.
- seats: part-1/fable-1-1

### req-2
- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: required
- standard: Operator step 4; D5; EF-12/EF-12c; effect-laws-v1 law 18.
- evidence: All three part-1 seats identify export const NodeId = S.String.check(S.isPattern(NODE_ID_PATTERN)) without identity or check metadata. sol-1-2 reports NodeId.ast.annotations === undefined; fable-1-3 identifies the installed isPattern annotations parameter. This concrete omission remains despite the supplied green gates.
- failure: The reusable exported NodeId and its reusable pattern check have no canonical identity or descriptive filter metadata.
- fix: Keep the existing pattern and add identifier/title/description metadata to S.isPattern plus $I.annoteSchema("NodeId", { description: ... }) to NodeId. Derive identifiers through the existing IdentityComposer. Preserve accepted strings, deferred graph validation and the upstream decode message; the unforced generic-message proposal is rejected-1.
- seats: part-1/grok-1-1, part-1/sol-1-2, part-1/fable-1-3

### req-3
- file: scratchpad/effected/schema-org/NodeRef.ts:142
- class: schema   severity: required
- standard: Effect-laws-v1 law 17; EF-12b/EF-35; AGENTS.md derived schema guards.
- evidence: NodeRef.isValidId directly runs NODE_ID_PATTERN.test even though NodeId already declares the same constraint. JsonLdDocument.buildResult and NodeRef.toCheckedResult call this second predicate. part-1/fable-1-2 reports agreement with S.is(NodeId) over ordinary, whitespace, control, blank-node and Unicode examples; nodes.test.ts:171-191 currently locks a sample.
- failure: Graph assembly and checked reference construction bypass the schema as the source of validation truth.
- fix: Derive the guard once with S.is(NodeId), retaining the public (id: string) => boolean contract, for example static readonly isValidId = S.is(NodeId). Preserve deferred checking and retain the upstream agreement test lines unchanged.
- seats: part-1/grok-1-2, part-1/sol-1-6, part-1/fable-1-2

### req-4
- file: scratchpad/effected/schema-org/Conformance.ts:22
- class: schema   severity: required
- standard: D5; effect-laws-v1 law 19; EF-12b.
- evidence: TermKind is an exported named annotated S.Literals(["type", "property"]) domain, reused by UnknownTerm.kind and re-exported by conformance-entry.ts. part-1/sol-1-4 reports TermKind.Enum === undefined. This is a concrete named-domain violation on the green commit.
- failure: The reusable domain lacks the required LiteralKit enum, guard and matching surface.
- fix: Construct TermKind with LiteralKit(["type", "property"]) from @beep/schema/LiteralKit, retain $I.annoteSchema and the same-name type alias, and use TermKind.Enum.type/property at the two issue-construction sites. Preserve the encoded and decoded literals; do not add as const to the LiteralKit input.
- seats: part-1/grok-1-3, part-1/sol-1-4, part-1/fable-1-4

### req-5
- file: scratchpad/effected/schema-org/Vocabulary.ts:76,150,170,197,218
- class: effect-idiom   severity: required
- standard: EF-2; effect-laws-v1 law 21; D11 cited Effect-idiom violations.
- evidence: MutableHashMap.get already returns Option, but ancestorsOf/propertiesOf/isPropertyOn/supersededBy unwrap it through O.getOrUndefined and branch on undefined. supersedingName takes number | undefined and reconstructs an Option; supersededBy does this twice. fable-1-6 attributes these adaptations to the port replacing upstream Map.get.
- failure: Domain absence goes Option -> undefined -> Option and the lookup paths repeat nullable control flow.
- fix: Consume get results with O.match/O.flatMap/O.map; use A.get for name-table lookup and remove the nullable supersedingName adapter. Preserve empty-query and false outcomes and the existing type-first supersededBy lookup semantics, including returning none for a known unsuperseded type. Coordinate ancestorsOf/propertiesOf with req-1.
- seats: part-1/grok-1-4, part-1/fable-1-6

### req-6
- file: scratchpad/effected/schema-org/Conformance.ts:261,369,383,385
- class: effect-idiom   severity: required
- standard: EF-2; D11 cited Effect-idiom violations.
- evidence: nativeTerm returns string | undefined for declared foreign prefixes; the type/property checking paths repeatedly branch on that undefined result. The absence is an internal native-versus-foreign domain decision, not an external nullable API.
- failure: The conformance checker models an internal domain decision with a nullable sentinel and duplicates its none branches.
- fix: Return O.Option<string> from nativeTerm and consume it with O.match/O.flatMap at the type and property call sites. Preserve bare terms, schema: stripping, declared-foreign skips, undeclared-prefix unknown issues, issue order and the existing foreign-node reference checks.
- seats: part-1/grok-1-5

### req-7
- file: scratchpad/effected/schema-org/Conformance.ts:214,426
- class: schema   severity: required
- standard: EF-33/EF-34; schema-first-development-prompt schema-owned data and boundary defaults; D11.
- evidence: ConformanceOptions is an exported interface with three finite policy fields; validateResult supplies report/ignore/ignore by hand. sol-1-7 establishes that it is ordinary schema-representable configuration, not a service or type-level carve-out. fable-1-5 identifies schema-first lint as outside the lab gate, so the green gates do not cover this defect.
- failure: The policy data contract has no runtime schema from which its public type and metadata are derived.
- fix: Define an identity-annotated schema for the three policies and derive the current optional ConformanceOptions input type from it; use named LiteralKit policy domains. Model safe defaults at the schema boundary while preserving ordinary plain-object callers, omitted/explicit-undefined fields and existing non-failing handling of out-of-union runtime policy strings. Do not add throwing validation or new rejection behavior to validateResult/validate. Keep conformance-entry.ts type-only export unchanged. Added-export recording belongs to codemod-1.
- seats: part-1/grok-1-6, part-1/sol-1-7, part-1/fable-1-5

### req-8
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:95; scratchpad/effected/schema-org/Conformance.ts:283
- class: bug   severity: required
- standard: D9 verified upstream-bug exception; D11; section 14; JSON-LD node-reference semantics cited in part-1/sol-1-1.
- evidence: sol-1-1 reports the same read-only probe on port and pinned upstream: TechArticle.make({ "@id": "#article", additional: { mentions: { "@id": "#missing" } } }) serializes the reference yet returns danglingReferences: [], no conformance issues and Success from the explicitly enabled danglingReferences gate. Replacing #missing with "has space" also succeeds. Both collectors only inspect direct nominal NodeRef fields/array items, not the additional property entries.
- failure: Supported catch-all references bypass identifier validation and graph closure checking in both the port and upstream.
- fix: Extend reference discovery to scalar and array node-reference objects containing only a string @id within additional, retaining the originating property name. Share or consistently reuse that discovery in buildResult, danglingReferences and Conformance.check; preserve typed NodeRef behavior and treat JSON-LD value/embedded-node objects separately. Add regressions for missing, present, duplicate, scalar, array and malformed catch-all references in JsonLdDocument.test.ts and Conformance.test.ts. This changes upstream behavior on demonstrated bugs; its section-14 bookkeeping is backlog-13, outside group ownership.
- seats: part-1/sol-1-1

### req-9
- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: required
- standard: EF-3, same-name type aliases for non-class schemas; schema-first-development-prompt; D2.
- evidence: NodeId is an exported non-class schema with no export type NodeId = typeof NodeId.Type; its existing index.ts re-export names only that declaration. Green tsgo does not require a schema/type pairing unless a consumer tries to use the missing type.
- failure: Consumers cannot name the schema-derived runtime type through the NodeId identifier.
- fix: Add export type NodeId = typeof NodeId.Type in NodeRef.ts. Keep the existing root export, which re-exports the merged value/type symbol; do not edit index.ts solely for this. D2 added-export bookkeeping belongs to codemod-1.
- seats: part-1/sol-1-5

### req-10
- file: scratchpad/effected/schema-org/Conformance.ts:287,289; scratchpad/effected/schema-org/JsonLdDocument.ts:99,100; scratchpad/effected/schema-org/NodeRef.ts:103
- class: perf   severity: required
- standard: D11 measured upstream regression; schema-first-development-prompt Pattern 5; effect-laws-v1 law 21.
- evidence: fable-1-7 reports a read-only 200,000-iteration probe: per-call S.is(NodeRef)(x) 32.6 ms, hoisted guard 4.4 ms, upstream instanceof 1.7 ms. Installed SchemaParser.js:138-152 resolves the AST guard and allocates a closure on each is call. Four reference-collector call sites repeat this work for every field/item; the report verifies equivalent nominal acceptance.
- failure: Reference collection pays repeated parser lookups and closure allocation with about 19x the measured upstream guard cost.
- fix: Hoist S.is(NodeRef) once adjacent to NodeRef and share that guard with the two collectors, preferably a module-local-to-public-source export used directly by Conformance.ts and JsonLdDocument.ts without modifying the root barrel. Preserve nominal typed-reference acceptance; the additional wire-reference branch from req-8 uses its own schema-derived guard. Retain existing oracle tests. Any added export is recorded by codemod-1.
- seats: part-1/fable-1-7

### req-11
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4592
- class: effect-idiom   severity: required
- standard: EF-5 and its review checklist item 6; D5/D11.
- evidence: decodeRow calls row.split(","). part-2/sol-1-1 and fable-1-4 identify the green-gate gap: NoNativeRuntime.ts:467 checks string methods only in hotspot scope, and NoNativeRuntimeHotspots.ts excludes this module. sol-1-1 reports 7,934 oracle comparison checks passing, showing behavior-preserving replacement is available.
- failure: Vocabulary index-row decoding retains a direct native string helper in domain logic outside the scanner hotspot coverage.
- fix: Import effect/String as Str and replace row.split(",") with Str.split(row, ","). Keep the empty/undefined guard, numeric conversion, row indexes and upstream tests unchanged. Array/loop cleanup is separately deferred in backlog-12, so this fix needs no test-file edits.
- seats: part-2/grok-1-1, part-2/sol-1-1, part-2/fable-1-4 (native-string portion)

## Backlog

### backlog-1
- file: scratchpad/effected/schema-org/Thing.ts:30; scratchpad/effected/schema-org/CreativeWork.ts:26; scratchpad/effected/schema-org/TechArticle.ts:15
- class: schema   severity: backlog
- standard: Operator S2 deferral; EF-12; field descriptions from existing documentation.
- evidence: sol-1-3 reports AST probes showing missing description metadata on shared @id/name/author/headline while class-local Person.email has it. grok-1-8 and fable-1-9 enumerate the three spread field bags.
- failure: Inherited field descriptions are absent from the schema AST. This is the deferred documentation/annotation work, so sol-1-3 is reclassified from required.
- fix: During S2, add annotateKey descriptions at the three shared field bags using their carried prose; preserve S.optional semantics.
- seats: part-1/grok-1-8, part-1/sol-1-3, part-1/fable-1-9

### backlog-2
- file: scratchpad/effected/schema-org/NodeRef.ts:37,87; scratchpad/effected/schema-org/APIReference.ts:13; other part-1 focus exports
- class: jsdoc   severity: backlog
- standard: Operator S2 deferral; .patterns/jsdoc-documentation.md; D4 and section 10.
- evidence: All three part-1 seats identify retained @example/@remarks and missing @category/@since across the public schemas, classes, Vocabulary and barrels; sol-1-8 also identifies missing value-export examples.
- failure: Public export documentation still uses upstream carriers and lacks the final beep docgen metadata.
- fix: At S2 convert to titled **Example** (Title), **Details**/**Gotchas**, canonical @category and @since 0.0.0; add meaningful compiling examples while preserving every carried prose body.
- seats: part-1/grok-1-7, part-1/sol-1-8, part-1/fable-1-12

### backlog-3
- file: scratchpad/effected/schema-org/conformance-entry.ts:22
- class: jsdoc   severity: backlog
- standard: Operator S2 deferral; .patterns/jsdoc-documentation.md examples must compile.
- evidence: The complete example imports Conformance/Vocabulary then calls Conformance.check(graph), but never defines or imports graph.
- failure: The carried example cannot compile because graph is undeclared.
- fix: During S2 construct a small graph with JsonLdDocument, a node class and Result.getOrThrow before checking it, then convert the carrier.
- seats: part-1/sol-1-9

### backlog-4
- file: scratchpad/effected/schema-org/NodeRef.ts:67
- class: schema   severity: backlog
- standard: D11; schema-first-development-prompt carve-out for structural overload surfaces.
- evidence: HasNodeId is a one-field interface used as the structural parameter half of NodeRef.to(string | HasNodeId); the report explicitly recognizes the overload-surface carve-out.
- failure: A runtime schema could expose a reusable guard, but the report establishes no mandatory violation or observed bug for this structural parameter contract.
- fix: If promoted in later schema cleanup, add an annotated S.Struct and derive HasNodeId while retaining NodeRef.to behavior; added-export recording belongs to codemod-1.
- seats: part-1/fable-1-8

### backlog-5
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:95,120,316; scratchpad/effected/schema-org/Conformance.ts:271,283,431
- class: effect-idiom   severity: backlog
- standard: D11; effect-laws-v1 law 21; equivalent helper cleanup beyond its enforced lambda/pipe patterns.
- evidence: fable-1-10 lists imperative record filtering/reference accumulation, issues.some and SCRIPT_ESCAPES indexing, and supplies R.filter/A.flatMap/A.some/R.get alternatives. It reports behavior equivalence, no measured regression and no gate-missed forbidden pattern.
- failure: These are style/consolidation opportunities, not demonstrated bugs or mandatory idiom violations. The null-prototype dictionary ruling does not itself prohibit this ordinary escape-table lookup.
- fix: Defer the helper cleanup; when undertaken use R.filter, A.flatMap/filterMap/some and R.get as appropriate, preserving traversal order and reference semantics from req-8/req-10.
- seats: part-1/fable-1-10

### backlog-6
- file: scratchpad/effected/schema-org/Vocabulary.ts:47-65
- class: effect-idiom   severity: backlog
- standard: D11; EF-2; D9 upstream memoization behavior.
- evidence: fable-1-11 identifies sparse array caches read with undefined checks and proposes MutableHashMap keyed by row index; it explicitly calls the upstream cache shape harmless.
- failure: This is an alternative storage representation for cache misses; there is no measured regression, unsafe assertion or demonstrated semantic failure warranting this broader rewrite.
- fix: Consider Option-valued MutableHashMap caches during later cleanup, preserving lazy per-row decoding and memoization; do not fold this optional redesign into req-5.
- seats: part-1/fable-1-11

### backlog-7
- file: scratchpad/test/schema-org/nodes.test.ts:171; scratchpad/test/schema-org/Vocabulary.test.ts:51; scratchpad/test/schema-org/entrypoints.test.ts:18
- class: test   severity: backlog
- standard: Operator S3 deferral; D10; goals/effect-vitest-canon/SPEC.md.
- evidence: The final, unnumbered part-1 fable record reports no Arbitrary.schema properties, plain it registrations and native collections in tests. No S3 gate has run.
- failure: The schema round-trip property floor and vitest-canon migration remain pending.
- fix: At S3 add it.effect.prop properties with Arbitrary.schema and fcRuns for each exported schema/codec, and migrate assertions/collections under the canon while retaining upstream oracle suites.
- seats: part-1/fable.md, 13th record headed scratchpad/test/schema-org/nodes.test.ts

### backlog-8
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4580,4583,4586,4607,4610
- class: type-safety   severity: backlog
- standard: D5 allows both mutable and immutable Effect collections; D11; law-forced native replacement ruling.
- evidence: grok-1-2 and fable-1-1 in part-2 identify inferred MutableHashMap/MutableHashSet exports replacing upstream readonly native tables. They find no module consumer mutating them. fable measures mutable lookup medians of 9.1-12.9 ms versus immutable 22.4-49.3 ms over 1M lookups, and explicitly finds no law violation or observable change.
- failure: Immutable tables or encapsulated accessors would improve protection, but D5 does not mandate them and the native replacement class is law-forced. This is not evidence of an unforced independent upstream rewrite; the dropped readonly representation record is codemod-2.
- fix: Defer immutable-table/accessor design until justified; if adopted preserve exported names/kinds and update Vocabulary/Conformance consumers consistently. Explicit mutable annotations alone do not restore readonly protection.
- seats: part-2/grok-1-2, part-2/fable-1-1 (encapsulation alternatives)

### backlog-9
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:33,4579-4610
- class: jsdoc   severity: backlog
- standard: Operator S2 deferral; .patterns/jsdoc-documentation.md; section 10.2.
- evidence: part-2/grok-1-3 and fable-1-6 identify 14 one-line exported internal declarations without titled examples/category/version metadata. The stronger fable evidence notes @internal excludes them from the current public docgen surface; a current public gate failure is not assumed.
- failure: Internal carriers and lookup descriptions are not yet at the final documentation standard.
- fix: During S2 preserve @internal and the empty-row prose, add appropriate titled carriers/category/version and a compiling decodeRow example, and describe Option-returning lookups accurately.
- seats: part-2/grok-1-3, part-2/fable-1-6

### backlog-10
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4-9
- class: docs   severity: backlog
- standard: Operator S2 deferral; D4; section 10.3 attribution.
- evidence: fable-1-2 in part-2 identifies the header instructions to run lib/scripts/generate-data.ts from lib/data/schemaorg-current-https.jsonld; the pinned oracle has those files and the lab does not. KNOWLEDGE.md intentionally retains upstream paths verbatim.
- failure: The source header directs lab readers to an absent generator.
- fix: At S2 name the generator/data as upstream-only at pinned commit af7566a9da2eff169cb74955efcc5ede1e5de9f8 and put the vendoring notice above the imports. Keep KNOWLEDGE verbatim; attribution Port-notes work is backlog-11.
- seats: part-2/fable-1-2 (source-header portion)

### backlog-11
- file: scratchpad/effected/schema-org/README.md:136-146; scratchpad/effected/audit.ts attribution step
- class: docs   severity: backlog
- standard: Operator S2 deferral; section 10.3; user write-surface restriction.
- evidence: part-2/fable-1-3 identifies eleven raw path:line grep hits pasted as Attribution, including schema field declarations rather than notices. It identifies the same generated pattern in spdx/yaml and proposes a runner fix. fable-1-2 also requests a README Port-notes generator/CC-BY-SA notice.
- failure: Attribution misses the schema.org JSON-LD notice. The runner change and README Port-notes edits are outside the port's write surface.
- fix: Track centrally for S2: correct the shared attribution emitter and replace raw hits with the schema.org release 30.0 CC-BY-SA-3.0 notice and upstream generator/data location. Assign neither audit.ts nor README Port notes to a required group.
- seats: part-2/fable-1-2 (Port-notes portion), part-2/fable-1-3

### backlog-12
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4583,4586,4590-4593
- class: effect-idiom   severity: backlog
- standard: D11; AGENTS.md Effect helper preference; no measured regression or forbidden Array.map/push pattern.
- evidence: part-2/fable-1-4 proposes replacing decodeRow for/push with A.map; fable-1-5 proposes A.map for the two name-index initializers. The reports identify these array/loop forms as outside the S1 scanner and report no observable failure. The separately prohibited native split is req-11.
- failure: These equivalent array-transform rewrites are preference-level cleanup without a demonstrated mandatory violation or performance win.
- fix: Defer the optional A.map rewrites; when undertaken share the effect/Array import, preserve empty rows/numeric conversion and retain as const only for tuple typing.
- seats: part-2/fable-1-4 (array-accumulation portion), part-2/fable-1-5

### backlog-13
- file: scratchpad/effected/PORT_LEDGER.json; scratchpad/effected/schema-org/README.md Port notes
- class: bug   severity: backlog
- standard: Section 14 upstream-bug recording; user write-surface restriction.
- evidence: part-1/sol-1-1 explicitly requests a ledger and README deviation entry for its independently verified catch-all-reference bug; both oracle and port produce the demonstrated failure. This is not a record-only law-forced systemic class covered by the announced deviation codemod.
- failure: The required source repair in req-8 needs an upstream-bug deviation receipt; writing that receipt here is outside the port's write surface.
- fix: Route the upstream-bug receipt centrally before applying req-8 behavior changes: cite the pinned-oracle probe and the exact adjusted/added JsonLdDocument.test.ts and Conformance.test.ts regressions. Do not assign PORT_LEDGER.json or README Port notes to a group.
- seats: part-1/sol-1-1 (section-14 bookkeeping portion)

## Handled by the deviation codemod

### codemod-1
- file: scratchpad/effected/schema-org/NodeRef.ts:60; scratchpad/effected/schema-org/Conformance.ts:214; scratchpad/effected/schema-org/README.md Added exports; scratchpad/effected/PORT_LEDGER.json
- class: schema   severity: backlog
- standard: Operator grilling 2026-10-09, added exports go to exportsAdded; D2.
- evidence: sol-1-5 requests recording the added NodeId type; fable-1-5 requests listing a ConformanceOptions schema value; fable-1-8 requests listing an optional HasNodeId schema. fable-1-7 proposes an added shared NodeRef guard. These clauses concern bookkeeping after the underlying accepted change.
- failure: Added-export receipts must accompany the law-forced schema additions, but recording them is not an independent source defect.
- fix: The central per-module codemod records actual added exports in exportsAdded and README Added exports. req-9/req-7/req-10 remain required source changes; record an optional HasNodeId addition only if backlog-4 is later implemented. No ledger/README edits belong to either group.
- seats: part-1/sol-1-5 (recording clause), part-1/fable-1-5 (recording clause), part-1/fable-1-7 (added guard), part-1/fable-1-8 (recording clause)

### codemod-2
- file: scratchpad/effected/schema-org/Vocabulary.ts:20; scratchpad/effected/schema-org/JsonLdDocument.ts:19; scratchpad/effected/schema-org/internal/vocabulary.ts:4580-4610; scratchpad/effected/schema-org/README.md Deviations; scratchpad/effected/PORT_LEDGER.json
- class: law   severity: backlog
- standard: Operator grilling 2026-10-09, one per-module/per-systemic-class native-runtime receipt; D9.
- evidence: part-1/fable-1-1 requests recording the public Set replacement and retargeted tests; part-2/fable-1-1 requests recording the native-readonly-to-Effect-mutable lookup representation plus measured rationale. Both record clauses concern the native-runtime replacement class.
- failure: The systemic native-runtime deviation must be documented centrally; manual per-site record work is not required in the fixing groups.
- fix: Generate one schema-org native-runtime deviation entry listing the public Set replacements, existing mutable table substitutions and exact retargeted upstream tests, plus promised-order treatment. Keep req-1 required because the actual codec-created native Sets are wrong; this codemod item handles only recording.
- seats: part-1/fable-1-1 (D9 recording clause), part-2/fable-1-1 (record-only smallest proposal)

The `severity: backlog` record field means this disposition is excluded from required dispatch; its disposition is the section heading, not an additional backlog count.

## Rejected

### rejected-1
- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: backlog
- standard: D9; section 14; operator grilling 2026-10-09, restore unforced upstream behavior.
- evidence: part-1/fable-1-3 proposes message: "Invalid JSON-LD node id" for the pattern check. grok-1-1 supplies a metadata-only fix that leaves the upstream regexp issue text intact. Law 18 requires identifier/title/description and user-facing message wording, but does not force replacing the already user-facing default.
- failure: The optional generic message would introduce a decode-text change without a forcing law, diagnostic, ruling or verified upstream bug.
- fix: Reject only this message-replacement clause: no law or diagnostic forces the upstream decode-text change; preserve the upstream message while applying req-2.
- seats: part-1/fable-1-3 (generic-message proposal only)

The `severity: backlog` record field means this disposition is excluded from required dispatch; its disposition is the section heading, not an additional backlog count.

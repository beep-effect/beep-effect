### fable-1-1
- file: scratchpad/effected/templates/internal/scan.ts:145
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; A.sort with an explicit Order). Gate miss: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts has no sort detection (rg 'sort' hits only HashSet imports), so none of the four gated laws cover it.   evidence: `return hits.sort((left, right) => left.start - right.start);` is the one native-sort site in the module; a comparator lambda stands in for an Order and the sort mutates `hits` in place. Installed effect has `A.sort` (node_modules/effect/dist/Array.d.ts:4109) and `Order.mapInput` (Order.d.ts:487).
- failure: Law 10 violation that no gate can catch, so it survives into promotion; the comparator is not an Order value and the sort is a mutation of the local array.
- fix: `import * as A from "effect/Array"; import * as Order from "effect/Order";` then `return A.sort(hits, Order.mapInput(Order.number, (hit: MarkerHit) => hit.start));` — A.sort returns a new array and both sorts are stable, so hit order is unchanged.

### fable-1-2
- file: scratchpad/effected/templates/ManagedSection.ts:256
- class: law   severity: required
- standard: D9 + section 14 deviation procedure (ledger entry, adjusted upstream test cited, README Port notes → Deviations); cause law:7 (no native Error in production source). Precedent: scratchpad/effected/jsonc/README.md Port notes deviation 3 (native Error → JsoncEditOverlapError, law:7, citing the adjusted upstream test).   evidence: `unimplemented` now throws `ManagedSectionTestError.make(...)` where upstream threw `new Error(...)`. Upstream __test__/ManagedSection.test.ts:301 `(die?.defect as Error)?.message` was adjusted to scratchpad/test/templates/ManagedSection.test.ts:304-311 (`S.is(ManagedSectionTestError)(defect)`). README Port notes → Deviations reads 'None'; ledger row `deviations: []`. Runtime probe: the defect is still an Error with the upstream message, `_tag` ManagedSectionTestError, and `name` is now the $I identity string.
- failure: An observable deviation (defect class and `name`) with an adjusted upstream test has no ledger or README record, so it is invisible to `ledger --verify` and to the promotion re-grill.
- fix: Add the section-14 entry to the ledger `deviations` (test: scratchpad/test/templates/ManagedSection.test.ts:304; upstream: `new Error`; lab: `ManagedSectionTestError` tagged error; reason: law:7) and the matching numbered item under README Port notes → Deviations.

### fable-1-3
- file: scratchpad/effected/templates/ManagedSection.ts:249
- class: law   severity: required
- standard: D2 superset export rule ('Additions are allowed and listed in the module README under Port notes → Added exports'); ledger `exportsAdded`.   evidence: `export class ManagedSectionTestError` has no upstream counterpart; README 'Added exports: None' and ledger `exportsAdded: []`. It is not re-exported from index.ts:11-21, so scratchpad/test/templates/ManagedSection.test.ts:9 and the class's own JSDoc Example import it from the module file.
- failure: The parity record undercounts the lab surface, and a consumer of `ManagedSection.layerTest` cannot identify the unstubbed-member defect through the package barrel.
- fix: Re-export `ManagedSectionTestError` from index.ts (next to `SectionFileError`), list it under README Port notes → Added exports, and add `{ name: "ManagedSectionTestError", kind: "both", entry: "." }` to the ledger row's `exportsAdded`.

### fable-1-4
- file: scratchpad/test/templates/Section.test.ts:91
- class: law   severity: required
- standard: D9 ('each [deviation] is recorded in README Port notes → Deviations and the ledger, citing the adjusted upstream test'); cause law:D5 ($ScratchpadId identity annotations).   evidence: Upstream __test__/Section.test.ts:90 expects `definitions.SectionIdEncoded.properties.key.pattern`; the lab test expects `definitions.@beep/scratchpad/effected/templates/Section/SectionIdEncoded...`. Same adjustment at scratchpad/test/templates/SectionDialect.test.ts:149 (`SectionDialectEncoded`). `S.toJsonSchemaDocument` output is a public surface and now differs from upstream; README Deviations 'None', ledger `deviations: []`.
- failure: Two adjusted upstream tests pin a public-surface difference that has no deviation record.
- fix: One ledger `deviations` entry plus README item: tests Section.test.ts:91 and SectionDialect.test.ts:149; upstream keys JSON Schema definitions by bare class name; lab keys them by the $I identity; reason law:D5.

### fable-1-5
- file: scratchpad/effected/templates/SectionDialect.ts:18
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; S.Literals only for anonymous inline unions never referenced by name); D5 (LiteralKit for literal domains, applied at S4). Precedent: scratchpad/effected/jsonl/README.md Port notes `JournalResyncReason` (law:19).   evidence: `export type Eol = "\n" | "\r\n"` is a named domain referenced by name at SectionDialect.ts:145, SectionDocument.ts:229, internal/reconcile.ts:19,30 and internal/scan.ts:16,41, while SectionDocument.ts:125 re-spells it as `S.Literals(["\n", "\r\n"])` for the `eol` field — two sources of truth for one domain.
- failure: The schema and the type can drift independently; the domain has no `S.is` guard and no annotation-bearing schema value.
- fix: `export const Eol = LiteralKit(["\n", "\r\n"]).annotate($I.annote("Eol", { description: "The line ending a document uses." })); export type Eol = typeof Eol.Type;` and `eol: Eol` in SectionDocument. The type export survives (D2 superset); list the new value export under Added exports / `exportsAdded`.

### fable-1-6
- file: scratchpad/effected/templates/internal/scan.ts:21
- class: schema   severity: required
- standard: law 19; D5; .patterns/error-handling.md 'Error Reason Classification' (reason domains as LiteralKit with $I.annote).   evidence: `SCAN_FAILURE_REASONS` as-const tuple + `ScanFailureReason` type (scan.ts:21-28), consumed as `S.Literals(SCAN_FAILURE_REASONS)` at SectionDocument.ts:34 and as the key type of `REASON_PROSE: Record<(typeof SCAN_FAILURE_REASONS)[number], string>` at SectionDocument.ts:66 — a named, reused reason domain modelled as an array/type pair.
- failure: Same drift surface as fable-1-5; `SectionParseError.message` dispatches through a hand-keyed record instead of the kit's exhaustive `$match`.
- fix: `export const ScanFailureReason = LiteralKit(["unterminatedSection", "orphanedEnd", "overlappingSections", "duplicateSection"]).annotate($I.annote("ScanFailureReason", { description: "The ways a document can be structurally unreadable." })); export type ScanFailureReason = typeof ScanFailureReason.Type;` keep `SCAN_FAILURE_REASONS = ScanFailureReason.literals` for existing callers; `reason: ScanFailureReason` in SectionParseError; type `REASON_PROSE` as `Record<ScanFailureReason, string>` or replace it with `ScanFailureReason.$match`.

### fable-1-7
- file: scratchpad/effected/templates/Section.ts:29
- class: schema   severity: required
- standard: D5 ('$ScratchpadId identity annotations on every exported schema'); law 18 (reusable built-in check blocks carry identifier, title, description; message user-facing). Precedent: scratchpad/effected/jsonc/JsoncNode.ts:39-43 `JsoncSegment` via `.pipe($I.annoteSchema(...))`.   evidence: `export const SectionKey = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u));` is exported and reused by `SectionId.key` (Section.ts:56) and `Section.key` (Section.ts:109); it carries no `$I.annoteSchema` and the check has no identifier/title/description/message, while every class in the module carries `$I.annote`.
- failure: The only exported schema in the module without identity; a rejected key reports an anonymous pattern rather than the named constraint the JSDoc explains.
- fix: `S.String.check(S.isPattern(KEY_PATTERN, { identifier: $I`SectionKeyPatternCheck`, title: "SectionKey", description: "A section name: letters, digits, '.', '_' and '-', not starting with punctuation.", message: "Expected a section key matching ^[A-Za-z0-9][A-Za-z0-9._-]*$" })).pipe($I.annoteSchema("SectionKey", { description: "The name identifying a managed section, exactly as it appears in the markers." }))`. Then re-run scratchpad/test/templates/Section.test.ts:89: a top-level identifier may move `S.toJsonSchemaDocument(SectionKey)` from `schema.pattern` into `definitions`; if so, cite that adjustment in the same deviation entry as fable-1-4.

### fable-1-8
- file: scratchpad/effected/templates/CommentStyle.ts:21
- class: schema   severity: required
- standard: law 18 (reusable built-in check blocks must include identifier, title and description; message stays user-facing).   evidence: `const Delimiter = S.String.check(S.isPattern(/^\P{Cc}+$/u));` is reused by `prefix` (line 47) and `suffix` (line 49); the JSDoc above it explains why each constraint is load-bearing, but the check itself carries no identifier, title, description or message.
- failure: A rejected delimiter reports an anonymous regex, and the documented rationale is absent from the schema metadata that tooling and issues read.
- fix: `S.isPattern(DELIMITER_PATTERN, { identifier: $I`DelimiterCheck`, title: "Delimiter", description: "A comment delimiter: non-empty and free of control characters, so it cannot inject lines or collide with the NUL separator in CommentStyle.id.", message: "Expected a non-empty delimiter without control characters" })`.

### fable-1-9
- file: scratchpad/effected/templates/internal/attributes.ts:13
- class: schema   severity: required
- standard: law 17 ('Named or reused domain constraints are modeled as schemas first; prefer built-in schema constructors/checks before S.makeFilter, and derive guards with S.is(...)'); AGENTS.md Code Laws ('Prefer named schema building blocks, derived S.is(...) guards ... over ad-hoc predicate helpers').   evidence: `ATTRIBUTE_NAME_PATTERN` (line 13) and `isValidAttributeValue` (lines 16-17) are the named attribute grammar; `SectionDialect.render` consumes them at SectionDialect.ts:154 via `.test()` and a hand predicate. The grammar that `SectionRenderError.reason` prose cites exists only as a regex constant and a predicate, never as a schema.
- failure: No `S.is` guard, no annotations, and nothing a property test can derive the attribute domain from; the renderer's refusal and the schema layer cannot share one definition.
- fix: `export const AttributeName = S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9_-]*$/, { identifier: $I`AttributeNameCheck`, ... })); export const AttributeValue = S.String.check(S.isPattern(/^[^"\r\n]*$/, { identifier: $I`AttributeValueCheck`, ... })); export const isAttributeName = S.is(AttributeName); export const isValidAttributeValue = S.is(AttributeValue);` and use the guards in `render`. Booleans are unchanged (D9); `parseAttributeRun`'s char-code scanner stays for upstream's linear-time argument.

### fable-1-10
- file: scratchpad/effected/templates/SectionOutcome.ts:15
- class: schema   severity: backlog
- standard: D5 (@beep/schema kits where an equivalent exists); standards/schema-first-development-prompt.md 'Finite variants are discriminated' (S.Class members, S.TaggedUnion for canonical _tag unions); SectionDocument.ts:77-79 keeps `SectionReconciliation` a plain interface only because the outcomes are not schemas.   evidence: `SyncOutcome` and `CheckOutcome` are `Data.TaggedEnum`/`Data.taggedEnum`; lab tests discriminate on `._tag` only (no `$is`/`$match` usage), so the constructor API is free, but `Data.taggedEnum` and `S.Class` differ in `Equal`/`deepStrictEqual` prototype behaviour, which makes this a section-14 decision rather than a mechanical swap.
- failure: The two outcome unions and `SectionReconciliation` are the only data models in the module outside Schema; law 20 is satisfied today (they are discriminated unions), so this is a kit-substitution backlog, not a violation.
- fix: Ledger backlog row: `S.TaggedUnion([Created, Updated, Unchanged])` / `[Absent, UpToDate, Drifted]` of `S.Class` members with `$I.annote`, then `SectionReconciliation` as `S.Class`; decide and record under section 14 before changing.

### fable-1-11
- file: scratchpad/effected/templates/SectionDialect.ts:46
- class: effect-idiom   severity: backlog
- standard: law 19 ('especially when .Enum, .is, $match ... are part of the design'); .patterns/error-handling.md reason-domain pattern.   evidence: `reason: S.Literals([...4])` is anonymous (so S.Literals is lawful), but `message` (lines 53-63) is a four-arm `Match.value(this.reason).pipe(Match.when ×4, Match.exhaustive)` — the `$match` shape law 19 names. Runtime probe shows all four messages equal upstream's strings.
- failure: None observable; the Match chain re-implements what a LiteralKit `$match` provides, and `SectionRenderError.reason` is the one error reason in the module without a kit.
- fix: `const SectionRenderReason = LiteralKit(["markerInContent", "unknownCommentStyle", "duplicateDeclaration", "invalidAttribute"])`, `reason: SectionRenderReason`, and `SectionRenderReason.$match(this.reason, { ... })` in `message`.

### fable-1-12
- file: scratchpad/effected/templates/ManagedSection.ts:203
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL section 11.3 ('A branch that is unreachable by construction is a finding against the source: simplify it'); S3 has not run, so backlog by operator order.   evidence: `if (!A.isReadonlyArrayNonEmpty(outcomes)) { return yield* Effect.die(...) }` replaces upstream's `outcomes[0] as SyncOutcome` (D15). `reconcile` returns exactly one outcome per declared section (reconcile.ts:71), so the die branch can never execute and will fail per-file branch coverage at S3.
- failure: A defect path that no input reaches; S3 will have to cover it or restructure it.
- fix: Thread non-emptiness through types: an internal `syncMany(path, sections: A.NonEmptyReadonlyArray<Section>) => Effect<A.NonEmptyReadonlyArray<SyncOutcome>, ...>` whose outcomes come from `A.map` over the non-empty input inside `reconcile`, with `sync` = `A.headNonEmpty` of it and `syncAll` the ReadonlyArray wrapper; otherwise record a ledger backlog row for the branch.

### fable-1-13
- file: scratchpad/test/templates/SectionDocument.prop.test.ts:1
- class: test   severity: backlog
- standard: D10 / section 11.4 property floor (`Arbitrary.schema` encode∘decode round-trip for every exported schema; run counts via `@beep/fc-runs` `fcRuns(n)`).   evidence: 8 `it.prop` cases, 0 `fcRuns` references; no `Arbitrary.schema(<exported schema>)` round-trip for CommentStyle, SectionId, Section, PlacedSection, SectionDialect, SectionDocument, SectionParseError, SectionRenderError or SectionFileError — upstream's properties cover reconcile fixed points and attribute round trips only.
- failure: The property floor is not met; S3 will have to add it.
- fix: At S3 add one `it.effect.prop` per exported schema asserting encode∘decode identity (Effect equality) and that decode of an encoded value never fails, with run counts through `fcRuns(n)`.

### fable-1-14
- file: scratchpad/test/templates/ManagedSection.test.ts:313
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14 (`it.layer` for scoped/effectful layers; per-test `Effect.provide` only for pure stubs) and D5 (assert helpers from @effect/vitest/utils); section 11.2.   evidence: 5 per-test `Effect.provide(...)` sites across ManagedSection.test.ts and SectionAttributes.test.ts, kept green with `// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file` pragmas (ManagedSection.test.ts:1, SectionAttributes.test.ts:1); 0 `it.layer`; Option assertions as `assert.isTrue(O.isSome(x))` + `O.getOrThrow` rather than `assertSome`.
- failure: Sanctioned at S1 (upstream shape kept verbatim); S3 canon migration still owes the `it.layer` blocks and assert helpers, and the pragmas should go with them.
- fix: At S3: `it.layer(MemoryFileSystem.layer(seed))` blocks for the ManagedSection suites, `assertSome`/`assertNone` from `@effect/vitest/utils`, then remove the skip-file pragmas.

### fable-1-15
- file: scratchpad/effected/templates/README.md:3
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL section 10.3 README adaptation (remove badges, Install, the pre-1.0 stability block and pnpm-plugin-effect references; rewrite examples to lab imports).   evidence: Badges at lines 3-6, the pre-1.0/stability block with `@effected/pnpm-plugin-effect` at 9-20, `## Why @effected/templates` at 22, `## Install` with `npm install @effected/templates` at 28-36, and examples still importing from "@effected/templates" at 49 and 73. Only the title and the Port notes section were adapted.
- failure: The README still reads as the npm package page; the examples cannot compile in the lab.
- fix: Apply 10.3: drop lines 3-6, 9-20 and 28-36, rename the Why heading, and rewrite the two examples to `../../effected/templates/index.ts` imports.

### fable-1-16
- file: scratchpad/effected/templates/CommentStyle.ts:9
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; section 10.2 carrier conversion; AGENTS.md ('never @example or @remarks tags'; @category from JSDocCategories.ts; @since). S2 has not run, so backlog by operator order.   evidence: Across 34 exported declarations: 36 `@remarks`, 4 `@example`, 19 `@public`, 1 `@category`, 1 `@since`; only `ManagedSectionTestError` (ManagedSection.ts:235-248) is already on beep carriers (**Example** (Title), @category, @since).
- failure: Docgen with enforceDescriptions/enforceExamples/enforceVersion will fail on every other export until S2.
- fix: S2: mechanical `@remarks`→**Details**/**Gotchas**, `@example`→**Example** (Title), add `@category`/`@since 0.0.0`, drop `@public`; then the jsdoc-annotation-specialist pass.

### fable-1-17
- file: scratchpad/effected/templates/CommentStyle.ts:88
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL section 10.1 ('if [an upstream sentence] is wrong after a law-driven change, rewrite it and cite the change in Port notes'); .patterns/module-organization.md file-header placement.   evidence: `id` is documented as 'A stable string identity, for keying a plain `Map`', but after the law-6 move its only consumers key `MutableHashMap`/`MutableHashSet` (reconcile.ts:50,65; scan.ts:162). Separately, internal/attributes.ts:1 now places `import * as R from "effect/Record";` above the file's explanatory header comment (lines 2-10), splitting the header from the top of the file.
- failure: Stale prose contradicts the code it documents; the attributes.ts header no longer reads as a header.
- fix: Reword to 'for keying a hash map' (and note the law-6 move in Port notes), and move the import below the header comment in internal/attributes.ts.

REQUIRED: 9
BACKLOG: 8

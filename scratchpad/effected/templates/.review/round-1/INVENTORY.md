# templates — round-1 merged inventory

Seats read: `grok.md` (1 record), `sol.md` (14 records), `fable.md` (17 records), and their shared `BRIEF.md`; no part directories are present. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. Oracle: the brief's pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` templates snapshot. Current checkout: `@lab/effected`, HEAD `a8a7f89a303b878f475b9d23d5be5cbbbd17c88b`.

Counts after merging/splitting distinct defects: **Required 13 · Backlog 10 · Codemod 4 · Rejected 0 · Groups 3**. All 32 submitted seat records are accounted for below; a multi-defect record can contribute to more than one disposition. The one templates allowlist entry is added as `allow-1`.

Binding basis: the entire operator revision block, both 2026-10-09 rulings, D1–D20, section 12.5 and section 14. Reported green gates are evidence from the brief/ledger, not a new test run. The S1 gate runs tsgo, oxlint and four beep laws; it does not prove the schema-authority/metadata standards enforced by these required records. S2/S3 documentation, coverage and vitest-canon work remains backlog. Record-only law-forced deviations are central codemod work; no evidence here identifies an unforced lab/oracle shape divergence requiring restoration.

The outcome-schema severity disagreement is resolved by EF-33/EF-7: schema authority is required; a direct class/prototype substitution is not the selected fix. The native-sort finding retains concrete source evidence with corrected hotspot-scope evidence. The optional barrel expansion is split from its added-export bookkeeping and reclassified to backlog.

`required.json` owns source/test surfaces only: **g1** has six source files (dialect/document/outcomes/scan/reconcile/attributes), **g2** owns Section/CommentStyle, and **g3** owns ManagedSection. No source or test file overlaps. Shared ledger/README recording, including the two verified upstream-bug entries required before implementation by section 14, is integration work; those records are not parallel lane write surfaces. Central integration also removes the retired allowlist entry. This inventory does not perform any fix or gate run.

## Required

### sol-1-1

- file: scratchpad/effected/templates/SectionDialect.ts:236
- class: bug   severity: required
- standard: D9; section 14 upstream-bug exception; ManagedSection BOM-preserving decode contract.
- evidence: The Sol seat probed both the lab and pinned oracle with "\uFEFF# --- BEGIN tool MANAGED SECTION ---\nx\n# --- END tool MANAGED SECTION ---\n"; both returned orphanedEnd. The marker regex starts with ^ followed immediately by the comment prefix. The first-line BOM blocks BEGIN but not the later END.
- failure: A managed block at the start of a BOM-prefixed document cannot be parsed or read, and therefore cannot be checked, synced or removed.
- fix: Recognize the first-line opening marker after the leading BOM; report its start after the BOM so reconciliation preserves that byte. Add parse/read and preservation regressions in SectionDocument.test.ts, retaining the original upstream cases. Record the demonstrated upstream-bug deviation under section 14.
- seats: sol-1-1

### sol-1-2

- file: scratchpad/effected/templates/SectionDialect.ts:161
- class: bug   severity: required
- standard: D9; section 14 upstream-bug exception; SectionDialect.render EOL guarantee.
- evidence: The Sol seat rendered section content "a\r\nb" with CRLF output, then parsed and checked it. Both lab and pinned oracle emitted "a\r\r\nb" and returned Drifted. Source replaces every LF with the output EOL without first normalizing existing CRLF.
- failure: Rendering CRLF content into a CRLF document doubles carriage returns and produces a block that immediately drifts from its declaration.
- fix: Normalize existing CRLF to LF before converting LF to the requested EOL; retain marker-injection refusal and all upstream assertions. Add render/parse/check regressions to SectionDialect.test.ts and SectionDocument.test.ts, and record the verified upstream-bug deviation.
- seats: sol-1-2

### sol-1-3

- file: scratchpad/effected/templates/internal/reconcile.ts:141
- class: perf   severity: required
- standard: D11: measured regression or algorithmic-class win.
- evidence: For n new declarations in an empty document, itemIndexByDeclared has no anchors. Declaration i makes n-i-1 unsuccessful forward lookups and i backward lookups: exactly n(n-1) anchor lookups overall. Nearest existing anchors can be computed with two linear passes.
- failure: Initial reconciliation performs quadratic anchor-search work even when no existing section can anchor an insertion; the defect is inherited from the oracle.
- fix: Precompute nearest existing successor and predecessor anchors, then place missing sections in one pass. Preserve successor preference, declaration order, foreign spans and all existing output bytes. Extend SectionDocument.reconcile.test.ts with mixed-anchor and no-anchor regressions and retain its upstream cases; do not claim the whole algorithm is linear merely from fixing these searches.
- seats: sol-1-3

### sol-1-4

- file: scratchpad/effected/templates/SectionOutcome.ts:15
- class: schema   severity: required
- standard: D5; standards/effect-first-development.md EF-33 and EF-7; standards/schema-first-development-prompt.md: Schema owns pure data.
- evidence: SyncOutcome and CheckOutcome are pure-data Data.TaggedEnum families with Data.taggedEnum constructor objects (lines 15-30 and 41-56). Sol's S.isSchema probes returned false for both. Fable independently identifies the same non-schema models and warns that a direct S.Class swap changes Equal/deepStrictEqual behavior.
- failure: The public outcome domains have no schema authority for codecs, validation or arbitraries. A law-20-compliant discriminant does not satisfy the separate EF-33 schema requirement.
- fix: Define annotated schema authority for both tagged families and derive their public types. Preserve existing variant constructor names, $is/$match APIs, payloads and Data equality/prototype behavior through explicit compatibility constructors/statics; do not infer API freedom from the current tests. If schema values need statics, use an S.Opaque class with static members per the ruling. Add focused compatibility checks to SectionDocument.test.ts and retain all upstream tests.
- seats: sol-1-4, fable-1-10

### sol-1-5

- file: scratchpad/effected/templates/SectionDocument.ts:83; scratchpad/effected/templates/internal/reconcile.ts:24; scratchpad/effected/templates/internal/scan.ts:30
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md: Schema owns pure data.
- evidence: SectionReconciliation is a pure-data interface for text/outcomes/changed; ReconcileOutput independently repeats it. ReconcileInput, ScanFailure and ScanResult are also plain data shapes, not service contracts, overloads or type-level transforms.
- failure: Reconciliation and scan results have parallel TypeScript contracts with no runtime schema authority; public and internal reconciliation output can drift.
- fix: Define annotated structural schemas and schema-derived types for ReconcileInput, the shared reconciliation output, ScanFailure and ScanResult. Reuse one output schema for SectionReconciliation and ReconcileOutput. Preserve plain-object return representations, the ok discriminant and existing required-versus-optional fields (including ScanFailure.key explicitly allowing undefined). Use lazy references where necessary to avoid new initialization cycles. Retain upstream tests and verify the contracts in SectionDocument.test.ts and SectionDocument.reconcile.test.ts.
- seats: sol-1-5, fable-1-10

### fable-1-5

- file: scratchpad/effected/templates/SectionDialect.ts:18; scratchpad/effected/templates/SectionDocument.ts:125
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md law 19; EF-12b.
- evidence: Eol is a named type-only "\n" | "\r\n" union reused by render, scan and reconcile. SectionDocument.eol independently spells S.Literals(["\n", "\r\n"]).
- failure: The named EOL domain and its validator are maintained separately, without an annotation-bearing LiteralKit authority.
- fix: Define an annotated Eol LiteralKit and derive its same-name type; reuse it in SectionDocument.eol while preserving the existing type export, both literal values and defaults. Keep the existing barrel type surface; any added value export is recorded centrally. Retain EOL tests and verify schema acceptance in SectionDialect.test.ts and SectionDocument.test.ts.
- seats: sol-1-6, fable-1-5

### fable-1-6

- file: scratchpad/effected/templates/internal/scan.ts:21; scratchpad/effected/templates/SectionDocument.ts:34
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md law 19; EF-12b; error-handling reason-domain pattern.
- evidence: SCAN_FAILURE_REASONS is a const tuple and ScanFailureReason its indexed type. SectionParseError independently wraps the tuple in S.Literals; REASON_PROSE indexes the tuple again.
- failure: The named scan-failure domain lacks a single annotated LiteralKit authority shared by validation and reason dispatch.
- fix: Define an annotated ScanFailureReason LiteralKit, derive its type, retain SCAN_FAILURE_REASONS as the kit's literals for existing callers, and reuse the kit in SectionParseError and the scan-result schemas. Type REASON_PROSE exhaustively by ScanFailureReason, preserving messages and failure order; a $match rewrite is optional. Retain the malformed-document tests in SectionDocument.test.ts.
- seats: sol-1-6, fable-1-6

### fable-1-7

- file: scratchpad/effected/templates/Section.ts:29
- class: schema   severity: required
- standard: D5 identity step; EF-12, EF-3 same-name type alias and EF-12c; standards/effect-laws-v1.md law 18.
- evidence: SectionKey is an exported S.String.check(S.isPattern(...)) reused by SectionId.key and Section.key. It has no composer annotation, no same-name exported type, and its reusable pattern check lacks identifier/title/description/message. Sol's JSON Schema probe found only type/pattern and empty definitions.
- failure: The exported key domain was omitted from identity conversion and check metadata, and lacks its schema-derived public type.
- fix: Annotate SectionKey with its file-local $I composer, annotate its reusable check with identifier/title/description and a user-facing message, and add export type SectionKey = typeof SectionKey.Type. Preserve the exact pattern and unbranded strings. Update only JSON Schema paths that identity forces in Section.test.ts; keep every upstream assertion's meaning. Recording identity-key and added-export changes belongs to the central codemod.
- seats: sol-1-7, fable-1-7

### fable-1-8

- file: scratchpad/effected/templates/CommentStyle.ts:21
- class: schema   severity: required
- standard: EF-12 and EF-12c; standards/effect-laws-v1.md law 18; operator identity step.
- evidence: Delimiter is a named S.String.check(S.isPattern(/^\P{Cc}+$/u)) reused for prefix and suffix. The schema has no composer identity annotation and the reused check has no identifier/title/description/message despite the explanatory prose.
- failure: Reusable delimiter validation omits required identity/check metadata.
- fix: Annotate Delimiter using the existing file-local $I composer and add identifier/title/description plus a user-facing message to its pattern check. Preserve the nonempty, control-character-free grammar and optional suffix behavior; retain CommentStyle.test.ts's invalid-input assertions and adjust metadata expectations only if needed.
- seats: sol-1-7, fable-1-8

### fable-1-9

- file: scratchpad/effected/templates/internal/attributes.ts:13; scratchpad/effected/templates/SectionDialect.ts:154
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 18; EF-12b; AGENTS.md schema-derived guards.
- evidence: The named ATTRIBUTE_NAME_PATTERN regex and isValidAttributeValue boolean helper define reused grammar. SectionDialect.render validates with .test and the helper; neither domain has a schema or schema-derived guard.
- failure: Attribute validation is maintained outside schema authority, so renderer and reusable field/codec validation cannot share an annotated domain definition.
- fix: Define annotated AttributeName and AttributeValue schemas with built-in checks, derive guards through S.is, and use them in render. Retain ATTRIBUTE_NAME_PATTERN if its existing export must remain and retain the single-pass parser, invalidAttribute refusal and error order. Preserve the old regex's exact accepted-input semantics, including JavaScript $ behavior, rather than silently tightening trailing-newline handling. Keep and extend SectionAttributes.test.ts and SectionDialect.test.ts to prove equivalence.
- seats: sol-1-8, fable-1-9

### sol-1-9

- file: scratchpad/effected/templates/ManagedSection.ts:39
- class: schema   severity: required
- standard: standards/effect-first-development.md typed-error template: cause-carrying errors declare S.Defect({ includeStack: true }).
- evidence: SectionFileError.cause uses S.Defect() without includeStack. Sol encoded a SectionFileError whose cause was an Error("failed"); encoded cause keys were name/message and omitted stack.
- failure: Serializing a public filesystem error drops the underlying stack contrary to the explicit cause-preservation standard.
- fix: Use S.Defect({ includeStack: true }) while retaining field annotations. Add a focused encode/decode stack-preservation regression in ManagedSection.test.ts, retaining existing error-channel cases. Record the resulting law-forced encoding change with the central per-module deviation pass.
- seats: sol-1-9

### fable-1-1

- file: scratchpad/effected/templates/internal/scan.ts:145
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; green-gate exception with a demonstrated scope miss.
- evidence: Source returns hits.sort((left, right) => left.start - right.start). Corrected gate evidence: NoNativeRuntime.ts:463 DOES detect sort, but only when inHotspotScope is true. NoNativeRuntimeHotspots.ts's extra-check patterns exclude scratchpad/effected/templates/**. Gates.ts:569-571 uses that checker on real paths, so this native sort survives the green gate. The seat's claim that the checker has no sort detection is inaccurate.
- failure: The module violates the explicit native-sort law outside the checker's hotspot coverage.
- fix: Replace the native sort with A.sort(hits, Order.mapInput(Order.number, (hit: MarkerHit) => hit.start)), using dedicated Effect imports. Preserve stable ascending hit order. Retain the multi-style and malformed-structure cases in SectionDocument.test.ts.
- seats: fable-1-1

### allow-1

- file: scratchpad/effected/templates/SectionDialect.ts:79
- class: law   severity: required
- standard: beep-laws/no-native-runtime; allowlist kind: new-map-set; issue: EFFECTED-TEMPLATES-MATCHER-CACHE; Grilling, 2026-10-09 (later): remove every module allowlist entry, owner-local caches.
- evidence: The module has exactly one allowlist entry: file scratchpad/effected/templates/SectionDialect.ts, kind new-map-set, reason: a WeakMap caches compiled matchers per SectionDialect object with identity keys and weak retention. Source matcherCache is a WeakMap at lines 79-82, read in matchers():205 and written at :241.
- failure: The module retains a native WeakMap under an exception the operator explicitly withdrew.
- fix: Remove the external WeakMap and keep compiled matchers in a field owned by each SectionDialect instance, computing them with their owner. Preserve per-instance reuse, isolation between equal-but-distinct dialects, pure schema fields/wire form and repeated scans without lastIndex contamination. Do not use structural global maps or Equal.byReferenceUnsafe. Add ownership/reuse/isolation checks to SectionDialect.test.ts and retain scan regressions. Allowlist deletion and the native-runtime class's ledger/README record belong to the central wave, outside this inventory's write scope.
- seats: operator-allowlist-1

## Backlog

### backlog-1

- file: scratchpad/effected/templates/SectionDocument.ts:103; scratchpad/effected/templates/CommentStyle.ts:9; scratchpad/effected/templates/ManagedSection.ts:246
- class: jsdoc   severity: backlog
- standard: S2 deferral in the review brief and operator order; JSDoc law; section 10.2.
- evidence: Sol identifies an @example with undeclared source and noncanonical category Errors on ManagedSectionTestError. Fable inventories legacy @remarks/@example/@public carriers and missing category/since/value examples across exports.
- failure: Public docs do not yet satisfy grammar, self-contained example or canonical metadata requirements; S2 has not run.
- fix: During S2, convert retained prose to titled Details/Gotchas/Example sections, make examples self-contained, remove @public, add canonical categories and since tags, and preserve upstream documentation.
- seats: sol-1-10, fable-1-16

### backlog-2

- file: scratchpad/test/templates/ManagedSection.test.ts:19; scratchpad/test/templates/SectionAttributes.test.ts:309
- class: test   severity: backlog
- standard: S3 deferral; goals/effect-vitest-canon/SPEC.md D14.
- evidence: Effectful ManagedSection.layer and filesystem layers are provided inside individual tests; skip-file strictEffectProvide/multipleEffectProvide pragmas permit the upstream setup. No it.layer suites exist.
- failure: Effectful layer setup does not yet follow the S3 canonical runner contract.
- fix: During S3, move effectful setup into it.layer blocks using the ported memfs (D14 of the port goal), preserving fresh filesystem state per case and all oracle assertions; then remove suppressions made unnecessary by that migration.
- seats: sol-1-11, fable-1-14

### backlog-3

- file: scratchpad/test/templates/ManagedSection.test.ts:30
- class: test   severity: backlog
- standard: S3 deferral; goals/effect-vitest-canon/SPEC.md D5.
- evidence: Tests assert O.isSome(found) as a boolean then call O.getOrThrow(found), with repeated instances at line 42 and in integration tests; Fable reports the same Option pattern.
- failure: Option assertions lack canonical narrowing and payload-aware assertion diagnostics.
- fix: During S3, use assertSome/assertNone and applicable Result/Exit assertion helpers from @effect/vitest/utils, retaining plain-value assertions and case meanings.
- seats: sol-1-12, fable-1-14

### backlog-4

- file: scratchpad/test/templates/SectionDocument.prop.test.ts:67; scratchpad/test/templates/SectionAttributes.test.ts:334
- class: test   severity: backlog
- standard: S3 deferral; D10; section 11.4; @beep/fc-runs guidance.
- evidence: Both seats find no fcRuns usage and no schema-derived encode/decode round-trip floor for exported templates schemas. Existing properties cover selected reconcile/attribute behavior only.
- failure: The retained upstream properties do not yet cover the module's S3 schema/property and repository run floors.
- fix: During S3, preserve existing oracle properties, configure fcRuns(n), and add Arbitrary.schema-derived round trips for every exported schema/codec plus required parser/formatter fidelity and idempotence properties.
- seats: sol-1-13, fable-1-13

### backlog-5

- file: scratchpad/effected/templates/ManagedSection.ts:203
- class: test   severity: backlog
- standard: S3 deferral; section 11.3 unreachable-branch coverage rule; D15 explains the current law-forced rewrite.
- evidence: The nonempty outcomes guard dies on an empty result, but sync reconciles a singleton and reconciliation produces one outcome per declaration. Upstream's unsafe outcomes[0] cast was removed.
- failure: The unreachable defect branch will obstruct per-file branch coverage; no runtime failure is demonstrated.
- fix: During S3, carry nonempty inputs/outputs through a typed internal syncMany/reconcile path and use A.headNonEmpty for sync, preserving the ReadonlyArray syncAll wrapper and existing behavior. Keep the D15-safe implementation until then.
- seats: fable-1-12

### backlog-6

- file: scratchpad/effected/templates/SectionDialect.ts:46
- class: effect-idiom   severity: backlog
- standard: D11; law 19 permits anonymous inline S.Literals; error-reason kit preference.
- evidence: SectionRenderError.reason is an anonymous four-literal schema; its message uses an exhaustive Match chain. Fable's probe found all four messages equal upstream.
- failure: No demonstrated law violation or behavioral failure; replacing a lawful anonymous union with a named kit is a preference.
- fix: Optionally define an annotated SectionRenderReason LiteralKit and use its $match for messages, preserving all values, error order and message strings.
- seats: fable-1-11

### backlog-7

- file: scratchpad/effected/templates/README.md:3
- class: docs   severity: backlog
- standard: S2 deferral; section 10.3 README adaptation.
- evidence: The README retains npm badges, stability/pnpm-plugin-effect prose, Install instructions and @effected/templates example imports (lines 3-6, 9-20, 28-36, 49 and 73).
- failure: The lab README still describes the upstream npm package and examples.
- fix: During S2, remove release/install boilerplate, adapt the Why heading and rewrite examples to lab imports under section 10.3 without discarding carried substantive prose.
- seats: fable-1-15

### backlog-8

- file: scratchpad/effected/templates/CommentStyle.ts:88
- class: docs   severity: backlog
- standard: S2 deferral; section 10.1 accuracy after law-forced changes.
- evidence: CommentStyle.id still says it keys a plain Map, while reconcile/scan use MutableHashMap/MutableHashSet.
- failure: The carried prose names the old collection representation.
- fix: During S2, describe the stable string identity as keying Effect hash collections. Recording the law-forced native-runtime class is central codemod work.
- seats: fable-1-17

### backlog-9

- file: scratchpad/effected/templates/internal/attributes.ts:1
- class: docs   severity: backlog
- standard: S2 deferral; .patterns/module-organization.md file-header placement.
- evidence: An effect/Record import precedes the explanatory file header, which starts on line 2.
- failure: The explanatory header no longer occupies the file's header position.
- fix: During the documentation pass, place the import below the explanatory header.
- seats: fable-1-17

### backlog-10

- file: scratchpad/effected/templates/index.ts:11; scratchpad/effected/templates/ManagedSection.ts:249
- class: effect-idiom   severity: backlog
- standard: D2 superset export rule; D11 required definition.
- evidence: ManagedSectionTestError is exported by its source file and imported directly by its test, but is not re-exported from index.ts. It has no upstream counterpart.
- failure: Consumers cannot reach the added helper error through the barrel; no upstream export is missing and D2 allows additions without requiring this barrel expansion.
- fix: Optionally re-export ManagedSectionTestError from index.ts if a barrel consumer needs it. Reclassify the convenience expansion to backlog; its existing added-export bookkeeping is handled separately by codemod-2.
- seats: fable-1-3

## Handled by the deviation codemod

These records have no required fix-lane assignment. Their `severity: backlog` means excluded from the round's required set; their disposition is the mandated central codemod, not optional deferral.

### codemod-1

- file: scratchpad/effected/templates/ManagedSection.ts:256; scratchpad/test/templates/ManagedSection.test.ts:304
- class: law   severity: backlog
- standard: Later grilling ruling: per-module/per-systemic-class deviation codemod; D9; law 7.
- evidence: Grok and Fable compare the upstream native Error throw with the lab ManagedSectionTestError throw. The adjusted test narrows through S.is(ManagedSectionTestError) at lines 304-311; README/ledger still say no deviations. Sol independently reports the same defect-identity change.
- failure: The law-forced tagged defect changes constructor/tag/name while retaining the upstream message and Die channel; the required record is missing, but no seat proves the replacement itself is wrong.
- fix: Let the central tagged-error class codemod generate the module ledger/README deviation entry listing this site and adjusted upstream test. Keep the tagged throw; do not hand-author per-site bookkeeping as a required fix.
- seats: grok-1-1, fable-1-2, sol-1-14

### codemod-2

- file: scratchpad/effected/templates/ManagedSection.ts:249; scratchpad/effected/templates/README.md:124
- class: docs   severity: backlog
- standard: Later grilling ruling: added exports go to exportsAdded centrally; D2.
- evidence: ManagedSectionTestError is an exported class absent upstream; Added exports and ledger exportsAdded are empty. Fable couples this bookkeeping request to an optional barrel re-export; Sol also reports the missing entry.
- failure: The port's added-export inventory is incomplete.
- fix: Have the central codemod record the existing added export under its actual source entry and update README Added exports. Do not claim it is a root-barrel export unless backlog-10 is separately implemented. Record any new law-forced schema value/type exports from this wave in the same pass.
- seats: fable-1-3, sol-1-14

### codemod-3

- file: scratchpad/test/templates/Section.test.ts:91; scratchpad/test/templates/SectionDialect.test.ts:149
- class: law   severity: backlog
- standard: Later grilling ruling: identity-derived JSON Schema keys are one systemic-class entry per module; D5 and D9.
- evidence: Upstream asserts definitions.SectionIdEncoded and definitions.SectionDialectEncoded. Lab asserts the corresponding @beep/scratchpad/effected/templates/... identity keys; README and ledger have no deviation entry.
- failure: The observable JSON Schema naming change and adjusted upstream tests are unrecorded; the identity conversion itself is operator-forced.
- fix: Generate one identity-key deviation entry for templates listing both sites and adjusted tests, plus further identity-key changes from this wave. Do not make record-only work a required finding.
- seats: fable-1-4

### codemod-4

- file: scratchpad/effected/templates/Section.ts:143; scratchpad/effected/templates/Section.ts:145; scratchpad/effected/templates/Section.ts:147; scratchpad/effected/templates/SectionDocument.ts:36; scratchpad/effected/templates/README.md:124
- class: docs   severity: backlog
- standard: Later grilling ruling: S.Number to S.Finite belongs to one systemic-class entry per module.
- evidence: Sol compares PlacedSection.make with the pinned oracle: upstream accepts Infinity, -Infinity and NaN; lab rejects them through S.Finite. Source also uses S.Finite for SectionParseError.line; existing port notes report no deviations.
- failure: Law-forced narrowing of numeric constructor inputs is not recorded; no seat demonstrates the narrowing is itself wrong under the ruling.
- fix: Have the central finite-number class codemod list all affected module sites and any adjusted upstream tests in the ledger/README entry. Preserve S.Finite; do not restore S.Number or create per-site required bookkeeping.
- seats: sol-1-14

## Rejected

None. Each submitted finding has concrete evidence and a fix after deduplication, correction or reclassification; no whole finding contradicts the operator rulings.


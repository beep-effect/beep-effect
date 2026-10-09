# spdx — round-1 merged inventory

Read all three seats (`grok.md`, `sol.md`, `fable.md`) and their shared adjacent `BRIEF.md`; there are no `part-N` reports. Seat baseline: `3fa5876691901fccf3d1cd29e9324564df134b56`; oracle: pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` package. Binding inputs: the entire operator revision/rulings/grilling block, D1-D20, sections 12.4/12.5 and 14.

Counts: **Required 5 · Backlog 7 · Handled by the deviation codemod 0 · Rejected 1 · Groups 2**. All 24 seat records are accounted for. Composite property/assertion reports are split by defect; native-collection and matcher-allocation reports are deduplicated by root cause. The rejection counts only Grok's conflicting remedy, with its valid evidence retained in r1.

`standards/effect-laws.allowlist.jsonc` has **0 entries for `scratchpad/effected/spdx/**`**; no `allow-<n>` records apply. Gate-missed collection accesses and missing annotations remain required. S2/S3 findings remain backlog. None of the retained seat findings establishes an additional unforced lab behavior/test divergence requiring oracle restoration; b5 is an optional proposed refactor, and r5 corrects an evidenced inherited type-contract defect.

Write groups in `required.json`: g1 owns five catalog/constraint source files and the three tests whose collection assertions must change; g2 owns `SpdxExpression.ts`. Existing expression/oracle tests are validation inputs for g2 and need no edits. Groups exclude README/ledger bookkeeping, which is central codemod work. No source or test file is owned by two groups.

## Required

### r1 — Native catalog maps and id-set facades escape through MutableHashMap.backing.

- file: scratchpad/effected/spdx/License.ts:104; scratchpad/effected/spdx/LicenseException.ts:58; scratchpad/effected/spdx/internal/licenseIds.ts:745-773; scratchpad/effected/spdx/internal/exceptions.ts:91-119; scratchpad/effected/spdx/internal/licenseMeta.ts:780-787
- class: law   severity: required
- standard: D5; standards/effect-laws-v1.md law 6; Grilling, 2026-10-09 (later), public native collections ruling.
- evidence: Fable reports License.catalog, LicenseException.catalog and LICENSE_META instanceof Map as true; mutating License.catalog with set("NOT-A-LICENSE", ...) makes License.isKnownId return true. Both duplicated readonlyIdSet facades obtain native iterators through map.backing. Live source confirms all five sites. NoNativeRuntime.ts only detects native collection NewExpressions, so the green gate misses these backing accesses.
- failure: The public catalogs expose live native Maps, permit process-wide mutation of license resolution, and the internal id sets retain native collection APIs and iterators. All are the same native-collection escape root cause.
- fix: Replace License.catalog, LicenseException.catalog and LICENSE_META with Effect HashMap values; replace LICENSE_IDS, DEPRECATED_LICENSE_IDS, EXCEPTION_IDS and DEPRECATED_EXCEPTION_IDS with HashSet values and delete both IdSet/readonlyIdSet facades. Build catalogs from the existing active/deprecated arrays. Update membership, size and lookup consumers to HashMap/HashSet helpers and Option handling while preserving unknown-id behavior, metadata flags and errors. Use explicit ordered sequences wherever iteration order is promised; retain the existing ordered data arrays. Retarget License.test.ts:81-86, data.test.ts:7-24 and LicenseMetadata.test.ts:10-12 to Effect collection APIs without weakening payloads or counts. Do not introduce a native-shaped collection wrapper. Deviation bookkeeping belongs to the central per-module native-runtime codemod.
- seats: grok-1-1 (evidence only; wrapper fix rejected below), fable-1-1, fable-1-2, fable-1-3

### r2 — Recursive walkers rebuild exhaustive matchers on every node visit.

- file: scratchpad/effected/spdx/SpdxExpression.ts:37,175-186,270-286,361-367
- class: perf   severity: required
- standard: D11 measured-regression criterion; standards/effect-laws-v1.md law 11.
- evidence: Sol reports three 10,000-call serializer batches on an 80-leaf MIT OR expression: lab 221.75/248.32/286.63 ms versus pinned upstream 11.23/11.19/10.76 ms, with identical 7,140,000-character totals. Fable independently measures 5,000 calls at 110.14/120.45/122.55 ms versus 5.94/6.25/6.96 ms; a hoisted matcher takes 16.71/17.59/17.75 ms with byte-identical output. Fable also measures 1,000 parseResult calls at 105.03/113.05/135.03 ms versus 61.02/61.95/64.67 ms, and 5,000 licensesOf calls at 138.80/143.13/150.73 ms versus 8.92/10.37/14.13 ms. Source confirms per-node Match.value/Match.valueTags construction. Benchmarks are seat evidence, not rerun by this inventory pass.
- failure: Serialization is about 20 times slower, parsing about twice as slow, and license collection about 10-15 times slower on these workloads. Serializer and traversal findings share the same matcher-allocation root cause.
- fix: Build serialize, materialize, collectLicenses and primaryLicense exhaustive matchers once at module scope with explicit recursive function types, using Match.type and tagsExhaustive/discriminatorsExhaustive. Preserve existing handlers, the collector accumulator, first-occurrence id deduplication, errors, ordering and formatted bytes. Recheck the reported benchmarks against the pinned oracle and run the existing SpdxExpression and oracle suites; no upstream test edits are needed. Do not fold in the optional collector rewrite from b5.
- seats: sol-1-2, fable-1-4, fable-1-5

### r3 — The public AST union and string codec lack composer-derived schema annotations.

- file: scratchpad/effected/spdx/SpdxExpression.ts:157,236-254
- class: schema   severity: required
- standard: D5; operator revision step 4; standards/effect-first-development.md EF-12.
- evidence: Sol reports S.resolveAnnotations(SpdxExpression.Schema) and S.resolveAnnotations(SpdxExpression.FromString) returning undefined; Fable reports their ast.annotations as undefined while LicenseNode carries identifier/schemaId/iri/curie/title/description. Source confirms the union and codec have no annotation call. The green gates do not enforce composer annotations on these enclosing schemas.
- failure: Annotations on member classes do not identify the two enclosing public schemas, leaving the required identity step incomplete.
- fix: Apply distinct $I.annoteSchema annotations to SpdxExpressionUnion and FromString with descriptions of the AST and string-codec contracts. Preserve parsing, encoding and public decoded/encoded types. This is a missing annotation repair, not a request merely to record an identity-key deviation.
- seats: sol-1-1, fable-1-6

### r4 — The reused LicenseRef grammar remains an ad-hoc regular-expression guard.

- file: scratchpad/effected/spdx/License.ts:44,127,151
- class: law   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 18; standards/effect-first-development.md EF-12b and EF-35.
- evidence: LICENSE_REF_PATTERN is named at line 44 and its .test is called independently by isLicenseRef and parseResult; internal/parser.ts:251,260 consumes License.isLicenseRef. No schema models the constraint. The cited schema-first guard law is not checked by the green native-runtime/import gates.
- failure: The shared domain-string constraint is not composable as a schema and lacks reusable check metadata.
- fix: Define a module-local annotated branded LicenseRefId string schema with S.isPattern using the existing regex and composer-derived identifier/title/description metadata. Derive S.is(LicenseRefId) once and reuse it in isLicenseRef and parseResult. Keep public signatures, accepted strings and error behavior unchanged; keep License.id as S.String so License.of still accepts uncataloged ids. Existing license/parser tests remain unchanged.
- seats: sol-1-3, fable-1-8

### r5 — Recursive codecs claim encoded children are decoded schema-class instances.

- file: scratchpad/effected/spdx/SpdxExpression.ts:117,119,135,137
- class: type-safety   severity: required
- standard: Effect SCHEMA.md, Recursive Struct with Different Encoded and Type; recursive-schema explicit Decoded/Encoded contract; D11 type safety.
- evidence: All four suspensions return S.Codec<SpdxExpression>, whose encoded parameter defaults to its decoded type. Fable reports encoding MIT AND Apache-2.0 yields plain Object children (encoded.left instanceof LicenseNode is false), while the declared encoded type exposes the class-instance type. The encode comment at lines 246-250 independently explains this POJO representation. tsgo is green because the annotation erases the encoded distinction, rather than producing a diagnostic. The pinned upstream has the same one-parameter codec annotation: this is a supported type-contract correction, not an unforced lab-only divergence.
- failure: Callers can trust class-instance encoded types and invoke class toString or instanceof checks, receiving [object Object] or false for encoded children.
- fix: Specify S.Codec<SpdxExpression, SpdxNode> at the four S.suspend callbacks, using the existing structural POJO union. Preserve runtime decoding/encoding and avoid unsafe assertions. No added public export or upstream test rewrite is needed.
- seats: fable-1-7

## Backlog

### b1 — README adaptation, dataset attribution and dependency-backlog prose are incomplete.

- file: scratchpad/effected/spdx/README.md:3-48,92-168
- class: docs   severity: backlog
- standard: D4; section 10.3; standards/effect-laws-v1.md law 2; operator S2 deferral.
- evidence: Attribution is a source-line grep dump, badges/install/pre-1.0 text remain, the example imports the effect root barrel, and Dependency backlog says None despite the ledger listing oxc-parser. Fable identifies the omitted upstream generator/data context and the CC0-1.0 / CC-BY-3.0 dataset notices.
- failure: The README describes the npm package, omits usable dataset attribution and misstates dependency status.
- fix: At S2, write the four Port notes subsections with upstream version 0.11.0, pinned commit af7566a9da2eff169cb74955efcc5ede1e5de9f8, LICENSE and all three dataset notices. Remove release/install boilerplate and adapt examples to lab imports and effect/Effect. Reconcile generator/data status with the dependency ledger under D3; document the actual backlog rather than claiming None.
- seats: grok-1-2, fable-1-11

### b2 — Exported documentation retains upstream carriers and lacks canonical tags/examples.

- file: scratchpad/effected/spdx/License.ts:62,138; scratchpad/effected/spdx/LicenseException.ts:23,81; scratchpad/effected/spdx/SpdxExpression.ts:216,259,292,328,380-389; scratchpad/effected/spdx/index.ts:16
- class: jsdoc   severity: backlog
- standard: D4; section 10.2; .patterns/jsdoc-documentation.md; operator S2 deferral.
- evidence: All three seats identify @example/@remarks carriers and missing @category/@since; Sol also identifies value exports without examples. Fable notes the facade codec description says encoding uses node toString although its encode comment explains the shared serializer receives POJOs.
- failure: The deferred docgen contract is not satisfied and one inherited sentence misdescribes the encoding path.
- fix: At S2, convert carriers to titled **Example** (Title) and **Details**/**Gotchas**, preserve upstream prose and examples, add meaningful missing examples and canonical @category/@since 0.0.0. Correct the codec description to refer to the shared serializer used by node toString.
- seats: grok-1-3, sol-1-4, fable-1-12

### b3 — Schema round-trip property coverage and configurable property run counts are incomplete.

- file: scratchpad/test/spdx/SpdxExpression.test.ts:207; scratchpad/test/spdx/License.test.ts; scratchpad/test/spdx/LicenseException.test.ts
- class: test   severity: backlog
- standard: D10; section 11.4; operator S3 deferral.
- evidence: The existing constrained expression property has no fcRuns registration option. The seats report no Arbitrary.schema encode/decode properties for License, LicenseException and InvalidSpdxExpressionError.
- failure: The deferred per-export schema property floor and repository run-count floor are not established.
- fix: At S3, wire the existing expression property through @beep/fc-runs using the actual supported registration option and add own-schema Arbitrary.schema encode/decode properties for exported schemas/codecs. Retain the constrained expression generator, oracle suite and upstream assertions; do not assume unconstrained S.String AST leaves satisfy the SPDX grammar.
- seats: grok-1-4 (property portion), sol-1-5, fable-1-13 (property portion)

### b4 — Option, Result and Exit assertions have not migrated to the Vitest assertion canon.

- file: scratchpad/test/spdx/SpdxExpression.test.ts:111,187,198,226-257,294; scratchpad/test/spdx/LicenseMetadata.test.ts:18-30,69-70; scratchpad/test/spdx/License.test.ts:38; scratchpad/test/spdx/LicenseException.test.ts:19
- class: test   severity: backlog
- standard: section 11.2; goals/effect-vitest-canon/SPEC.md D5; operator S3 deferral.
- evidence: The seats cite deepStrictEqual against O.some, isTrue(O.isNone(...)), Result predicates/tag inspection and isTrue(Exit.isFailure(...)) instead of canonical outcome helpers.
- failure: The deferred test-canon migration remains incomplete.
- fix: At S3, use the corresponding @effect/vitest/utils Option, Result and Exit helpers, retaining expected payloads/causes and existing field checks. Keep upstream test meaning and do not weaken assertions.
- seats: grok-1-4 (assertion portion), sol-1-6, fable-1-13 (assertion portion)

### b5 — A pure license walker is proposed as an optional simplification.

- file: scratchpad/effected/spdx/SpdxExpression.ts:270-286,314-323
- class: effect-idiom   severity: backlog
- standard: D11 and D9; law 21 preference for equivalent helper forms.
- evidence: Fable identifies the mutable collector plus id-keyed MutableHashSet deduplication and proposes a pure walker followed by A.dedupe. These mechanisms already match the upstream accumulator/id-deduplication shape apart from law-forced dispatch and collection substitutions. No specific violated helper form, wrong result or measured improvement is shown for this additional rewrite.
- failure: Readers must trace collection mutation to see written-order uniqueness; no observable defect is established for the proposed simplification.
- fix: Retain as an optional follow-up: evaluate a pure walker and explicit id-based deduplication against the oracle, first-appearance ordering and allocation cost. Do not add this discretionary rewrite to r2 or retain any unforced upstream-test rewrite. Reclassified under D11 because a general terseness preference is not evidence that this accumulator violates the cited law.
- seats: fable-1-9

### b6 — Runtime schema-description prose contains a TSDoc selector artifact.

- file: scratchpad/effected/spdx/SpdxExpression.ts:120,138
- class: schema   severity: backlog
- standard: standards/effect-first-development.md EF-12; operator docs/S2 backlog classification.
- evidence: Both annotation descriptions contain the literal (SpdxExpression:type), copied from a JSDoc link selector.
- failure: The descriptions are less readable; no schema validation, identity or runtime behavioral defect is established.
- fix: Replace (SpdxExpression:type) with SpdxExpression in both annotation description strings as documentation cleanup. This metadata prose is not converted by the JSDoc carrier codemod.
- seats: fable-1-10

### b7 — The upstream differential-oracle shim explanation was dropped.

- file: scratchpad/test/spdx/spdx-expression-parse.d.ts:1
- class: docs   severity: backlog
- standard: D4 carried documentation; operator docs/S2 backlog classification.
- evidence: The pinned upstream types/spdx-expression-parse.d.ts begins with four comment lines explaining the untyped CommonJS oracle and throw/no-throw distinction. The lab ambient module has no header; the inventory pass read both files.
- failure: The test shim lacks the upstream explanation of its purpose.
- fix: Restore the four-line upstream header comment above the declare module block during S2.
- seats: fable-1-14

## Handled by the deviation codemod

None: no seat finding asks only to record a law-forced change. Recording instructions embedded in the substantive collection repairs (fable-1-1 through fable-1-3 and grok-1-1) are delegated centrally: one per-module native-runtime deviation entry, listing sites and adjusted upstream tests. They are not additional required findings. Composer-derived identity-key records and any added exports likewise stay with the central codemod; repairing the missing annotations in r3 remains required.

## Rejected

### grok-1-1-fix — Preserve the native ReadonlyMap/ReadonlySet surface through a delegating facade.

- file: scratchpad/effected/spdx/License.ts:104; scratchpad/effected/spdx/LicenseException.ts:58; scratchpad/effected/spdx/internal/licenseIds.ts:758; scratchpad/effected/spdx/internal/exceptions.ts:104; scratchpad/effected/spdx/internal/licenseMeta.ts:780
- class: law   severity: rejected
- standard: Grilling, 2026-10-09 (later), public native collections ruling; D5.
- evidence: Grok proposes keeping a ReadonlyMap/set-shaped projection over MutableHashMap and unwrapping Option into V | undefined; Fable explicitly identifies these facades as evading the ruled Effect collection shape.
- failure: The proposed remedy retains the native collection contract instead of adopting the operator-approved Effect collections. The native-leak evidence itself contributes to r1.
- fix: Use r1: genuine Effect HashMap/HashSet surfaces with explicit order where promised.
- seats: grok-1-1 (fix portion only)
- reason: Rejected fix only: preserving the native collection API behind a facade contradicts the operator ruling; the valid defect and evidence are deduplicated into r1.

REQUIRED: 5  BACKLOG: 7  CODEMOD: 0  REJECTED: 1  GROUPS: 2

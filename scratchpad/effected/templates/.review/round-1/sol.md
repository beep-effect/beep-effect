### sol-1-1
- file: scratchpad/effected/templates/SectionDialect.ts:236
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`); the BOM-preservation contract in `ManagedSection.ts:117–125`.   evidence: A read-only `bun --eval` probe passed `"\uFEFF# --- BEGIN tool MANAGED SECTION ---\nx\n# --- END tool MANAGED SECTION ---\n"` to both the lab and pinned oracle’s `SectionDocument.parseResult`. Both returned `orphanedEnd`. The opening marker’s regex requires the comment prefix at the start of the line; the leading BOM prevents that match, while the closing marker still matches.
- failure: A valid managed block immediately following a UTF-8 BOM cannot be read, checked, synced or removed. Preserving the BOM in `ManagedSection`’s decoder exposes this parser failure.
- fix: Recognize an opening marker immediately after the document’s leading BOM, keeping its span start **after** the BOM so reconciliation preserves that byte. Add the demonstrated parse/read regression and record the verified upstream-bug deviation.

### sol-1-2
- file: scratchpad/effected/templates/SectionDialect.ts:161
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`); `SectionDialect.render`’s documented EOL guarantee and the EOL-normalized comparison contract.   evidence: A read-only probe constructed `SectionId.make({ key: "tool", commentStyle: CommentStyle.hash }).section("a\r\nb")`, rendered it with `"\r\n"`, parsed the result and checked it against the original section. Both lab and pinned oracle emitted `"a\r\r\nb"` inside the block and returned `Drifted` from the check. Existing rendering tests exercise LF content with CRLF output, missing CRLF content.
- failure: Rendering ordinary CRLF content into a CRLF document doubles its carriage returns. Parsing the result leaves noncanonical content, so a section rendered by the dialect immediately reports drift against its declaration.
- fix: Normalize existing CRLF content to LF before converting LF to the requested output EOL. Retain the existing marker-injection refusal, add the demonstrated render/parse/check regression and record the upstream-bug deviation.

### sol-1-3
- file: scratchpad/effected/templates/internal/reconcile.ts:141
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: When reconciling `n` new sections into an empty document, `itemIndexByDeclared` contains no anchors. For each declaration at index `i`, the forward loop performs `n-i-1` unsuccessful lookups and the backward loop performs `i`. Across all declarations, these loops perform exactly `n(n-1)` unsuccessful lookups. Nearest successor and predecessor anchors can instead be computed in two linear passes.
- failure: Initial `syncAll` of an entirely new declaration set performs quadratic anchor-search work despite there being no existing sections to anchor against. This behavior is inherited from the pinned oracle.
- fix: Precompute the nearest existing successor and predecessor anchor for each declaration, then place missing sections in one pass. Preserve successor preference and declared insertion order.

### sol-1-4
- file: scratchpad/effected/templates/SectionOutcome.ts:15
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33 and EF-7; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5.   evidence: `SyncOutcome` and `CheckOutcome` are authored as `Data.TaggedEnum` types and `Data.taggedEnum` constructor objects at lines 15–30 and 41–56. A read-only probe returned `false` for both `S.isSchema(SyncOutcome)` and `S.isSchema(CheckOutcome)`. Their payloads are entirely schema-representable using the existing `Section` and `SectionId` schemas.
- failure: The public outcome models have no schema source of truth from which consumers can derive codecs, validation or arbitraries. Their non-schema representation also supplies the stated justification for leaving `SectionReconciliation` as a plain interface.
- fix: Author annotated schemas for the two tagged outcome families and derive their public types from those schemas. Preserve the existing variant constructors and `$is`/`$match` API through compatibility statics so D2 and D9 remain satisfied.

### sol-1-5
- file: scratchpad/effected/templates/SectionDocument.ts:83
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `SectionReconciliation` is a pure-data interface containing `text`, `outcomes` and `changed`. `internal/reconcile.ts:24–37` separately declares `ReconcileInput` and the identical output shape `ReconcileOutput`; `internal/scan.ts:30–38` declares pure-data `ScanFailure` and `ScanResult` without schemas. These are data records and result variants, rather than service contracts, overloads or type-level machinery.
- failure: The reconciliation and scanning models remain parallel TypeScript shapes with no runtime schema authority. In particular, the public reconciliation result and internal output duplicate the same contract.
- fix: Define structural schemas and derive the corresponding types, reusing one reconciliation-output schema for `SectionReconciliation` and `ReconcileOutput`. Preserve the current plain-object values and field optionality; schema construction need not introduce class instances into the existing return contract.

### sol-1-6
- file: scratchpad/effected/templates/internal/scan.ts:21
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: The named `ScanFailureReason` domain comes from `SCAN_FAILURE_REASONS`, a const array, while `SectionParseError.reason` independently constructs `S.Literals(SCAN_FAILURE_REASONS)`. Likewise, the named `Eol` domain is a type-only union at `SectionDialect.ts:18`, with its runtime representation separately authored as `S.Literals(["\n", "\r\n"])` at `SectionDocument.ts:125`.
- failure: Named literal domains lack the required `LiteralKit` schema authority and annotations. The EOL type and runtime validator are separately maintained declarations of the same domain.
- fix: Define annotated `LiteralKit` schemas for the scan-failure and EOL domains, derive their types and reuse the schemas in fields. Preserve `SCAN_FAILURE_REASONS` as an alias of the kit’s literals if its existing export must remain.

### sol-1-7
- file: scratchpad/effected/templates/Section.ts:29
- class: schema   severity: required
- standard: D5 and the operator’s identity step; `standards/effect-first-development.md` EF-12 and EF-3’s same-name type-alias requirement.   evidence: `SectionKey` ends at `S.String.check(S.isPattern(...))` without identity annotations or an exported `SectionKey` type. A read-only `S.toJsonSchemaDocument(SectionKey)` probe produced only `type` and `pattern`, with an empty `definitions` object. The reused `Delimiter` schema at `CommentStyle.ts:21` likewise has no composer annotations.
- failure: The exported key schema and reused delimiter schema were omitted from the identity conversion. `SectionKey` also lacks the required schema-derived public type.
- fix: Annotate both named schemas with their file-local `$I` composers and meaningful descriptions, and add `export type SectionKey = typeof SectionKey.Type`. Preserve the existing patterns and unbranded string behavior.

### sol-1-8
- file: scratchpad/effected/templates/internal/attributes.ts:13
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 17; `standards/effect-first-development.md` EF-12b.   evidence: The named attribute-name constraint is exported as a regex, and the reused attribute-value constraint is an ad-hoc boolean function at lines 16–17. `SectionDialect.render` applies these constraints directly at line 154. Neither constraint has a schema definition or a schema-derived guard.
- failure: Reused domain validation remains outside the schema model, so attribute constraints cannot be reused as schema fields or codecs and are maintained separately from the module’s schema definitions.
- fix: Define annotated attribute-name and attribute-value schemas and derive the renderer’s guards with `S.is`. Keep the single-pass attribute parser and the current typed `invalidAttribute` refusal, preserving accepted input and error order.

### sol-1-9
- file: scratchpad/effected/templates/ManagedSection.ts:39
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, typed-error template: “Cause-carrying errors declare `cause: S.Defect({ includeStack: true })` explicitly.”   evidence: `SectionFileError.cause` uses `S.Defect()` without that option. A read-only probe encoded `SectionFileError.make({ path: "x", operation: "read", cause: new Error("failed") })` through `S.encodeUnknownResult(SectionFileError)`; the encoded cause had keys `["name", "message"]`, with no stack.
- failure: Serializing the public filesystem error drops the underlying error’s stack, contrary to the explicit cause-preservation standard.
- fix: Use `S.Defect({ includeStack: true })` while retaining the existing field annotations. Record the law-driven encoding deviation under section 14.

### sol-1-10
- file: scratchpad/effected/templates/SectionDocument.ts:103
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy” and “Kind-split Example law”; operator deferral of S2.   evidence: This example still uses `@example` and references an undeclared `source`. Public documentation across `CommentStyle`, `Section`, `SectionDialect`, `SectionDocument`, `ManagedSection` and the outcome exports retains `@remarks`/`@example` carriers and omits required categories, since tags or value-level examples. `ManagedSectionTestError` uses the noncanonical category `Errors` at `ManagedSection.ts:246`.
- failure: The documentation remains incompatible with the required JSDoc grammar and example-compilation contract.
- fix: During S2, convert the retained prose to titled sections, make examples self-contained, and add canonical categories, since tags and required examples without dropping upstream documentation.

### sol-1-11
- file: scratchpad/test/templates/ManagedSection.test.ts:19
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; operator deferral of S3.   evidence: `withFs` provides `ManagedSection.layer` and the filesystem layer separately inside each test. `ManagedSection.layer` is a `Layer.effect`, so it is outside D14’s pure-stub exception. The same composition occurs directly at `SectionAttributes.test.ts:309`.
- failure: Effectful layer setup is owned by per-test `Effect.provide` wrappers rather than the canonical `it.layer` runner. File-level diagnostic suppressions permit the current composition to remain green.
- fix: During S3, move effectful layer setup to `it.layer`, retaining fresh per-case filesystem state where the tests require isolation.

### sol-1-12
- file: scratchpad/test/templates/ManagedSection.test.ts:30
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; operator deferral of S3.   evidence: Inside `it.effect`, the suite asserts `O.isSome(found)` and then calls `O.getOrThrow(found)`. Similar hand-rolled Option assertions appear at line 42 and in the integration suite.
- failure: Option assertions bypass the canonical narrowing assertion helpers and replace a payload-aware assertion failure with a boolean assertion followed by a potentially throwing extraction.
- fix: During S3, use `assertSome`, `assertNone` and the corresponding Result/Exit helpers from `@effect/vitest/utils` where applicable. Keep ordinary plain-value assertions unchanged.

### sol-1-13
- file: scratchpad/test/templates/SectionDocument.prop.test.ts:67
- class: test   severity: backlog
- standard: D10; `goals/effect-vitest-canon/SPEC.md` property-run guidance; operator deferral of S3.   evidence: Property registrations in this file and `SectionAttributes.test.ts:334` have no explicit `fcRuns` configuration. A source search found no `fcRuns` usage and no schema-derived round-trip properties over the exported templates schemas.
- failure: The retained properties exercise selected document fixtures but do not establish the required repository run floors or exported-schema encode/decode round-trip floor.
- fix: During S3, add `{ arbitrary: fcRuns(n) }` to property registrations and schema-derived round-trip properties for the exported schemas, preserving the existing oracle properties and their meaning.

### sol-1-14
- file: scratchpad/effected/templates/README.md:124
- class: docs   severity: backlog
- standard: D2, D9 and section 14; operator deferral of documentation work.   evidence: Port notes say `Added exports: None` and `Deviations: None`, and the templates ledger row has empty `exportsAdded` and `deviations` arrays. The module adds the exported `ManagedSectionTestError` at `ManagedSection.ts:249` and changes the unstubbed-member defect from a native `Error` to that tagged error. It also changes numeric fields from upstream `Schema.Number` to `S.Finite`; a read-only oracle comparison showed `PlacedSection.make` accepts `Infinity`, `-Infinity` and `NaN` upstream but rejects them in the lab.
- failure: Port notes omit an added export and observable changes to defect identity and accepted constructor input. Reviewers cannot distinguish these changes from accidental parity loss using the recorded deviation contract.
- fix: Record the added export and each deviation in the port notes and ledger, citing the exact law or verified upstream-bug basis and the smallest adjusted test. If a change has neither permitted basis, restore its upstream behavior.

REQUIRED: 9
BACKLOG: 5
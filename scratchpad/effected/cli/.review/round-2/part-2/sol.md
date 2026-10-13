### sol-2-1
- file: scratchpad/effected/cli/internal/failureTarget.ts:176
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; callable signatures must match runtime dispatch.   evidence: A read-only, in-memory TypeScript program assigned `refreshFailureTarget` to `(settings?: FailureSettings) => (audience?: AudienceShape) => Effect.Effect<void>` and called `curry(undefined)()`, with zero caller diagnostics. A runtime probe reported `typeof refreshFailureTarget(undefined) === "object"` and then threw `TypeError: curried is not a function`. The dispatch predicate explicitly selects the data-first implementation for an omitted or `undefined` first argument. The focused source is byte-identical to the reviewed commit.
- failure: The optional curried overload promises a callable result for an argument that actually returns an Effect. Consumers using the advertised overload can typecheck and fail before running any Effect.
- fix: Require a non-undefined `FailureSettings` argument in the curried overload. Retain the existing zero-argument and `undefined` data-first calls. Add an overload-dispatch regression covering both forms.

### sol-2-2
- file: scratchpad/effected/cli/internal/layout.ts:57
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; Doc.LinkTarget’s executable contract.   evidence: A virtual TypeScript caller passed `{ url: undefined, file: "src/a.ts" }` as `LinkTarget`, with zero diagnostics. Read-only runtime probes returned `true` from both `S.is(LinkTarget)(target)` and `S.is(Inline)(Doc.link(target, "source"))`. Rendering that link threw `TypeError: undefined is not an object (evaluating 'input.replace')`. The pinned oracle throws for the same input. The file member accepts the object, but `safeTarget` selects the URL member solely because `"url" in target` is true.
- failure: A schema-valid, type-correct file link crashes document rendering. Without an explicit label, the same presence-only dispatch in `Doc.link` at line 983 also derives an undefined default label.
- fix: Select the URL branch using a string/schema-derived guard, preserving URL precedence when its value is valid. Normalize the file branch without an invalid `url` property, and use the same branch selection for `Doc.link`’s default label. Add the regression and register the verified upstream-bug deviation centrally.

### sol-2-3
- file: scratchpad/effected/cli/internal/format.ts:104
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; `issueEntries` promises the rejected values once each, preserving their paths.   evidence: Decoding `S.Struct({ "a.b": S.String, a: S.Struct({ b: S.String }) })` against `{ "a.b": 1, a: { b: 2 } }` with `{ errors: "all" }` produced two core formatter entries: `{"path":["a.b"],"message":"Expected string"}` and `{"path":["a","b"],"message":"Expected string"}`. Both the port and pinned oracle returned only the first from `issueEntries`. Their deduplication key is identical: `"Expected string at a.b"`.
- failure: A literal dotted key and a nested property path collapse into one entry. The renderer silently drops a distinct rejected value, and the issue tree loses the nested branch.
- fix: Deduplicate by the message and the complete path sequence, using an unambiguous structural key rather than the formatted display string. Preserve existing display formatting. Add a dotted-key-versus-nested-path regression and register the upstream-bug deviation centrally.

### sol-2-4
- file: scratchpad/effected/cli/internal/layout.ts:148
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; `truncateSpans`’ documented grapheme-boundary guarantee and the retained layout tests’ whole-grapheme contract.   evidence: For adjacent nodes `Doc.text("👩"), Doc.text("\u200d"), Doc.text("💻")`, the port reports width 4; the equivalent joined node `Doc.text("👩‍💻")` reports width 2. At width 3, truncated rendering returns `"👩‍…"` for the split nodes and `"👩‍💻"` for the joined node. Wrapping returns `["👩‍", "💻"]` versus `["👩‍💻"]`. The pinned oracle reproduces all three differences. `widthOf` sums independently measured spans, and `cellsOf` segments each span independently.
- failure: Document-node boundaries become grapheme boundaries. A two-column emoji that fits is truncated or split across lines, leaving a partial ZWJ sequence and changing its displayed meaning.
- fix: Measure and segment the concatenated visible text across adjacent spans. Track source-span offsets so a grapheme remains one atomic layout unit while retaining its original style/link fragments. Add split-versus-joined emoji and combining-sequence regressions, and register the upstream-bug deviation centrally.

### sol-2-5
- file: scratchpad/effected/cli/internal/counts.ts:137
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11’s algorithmic-class criterion.   evidence: For one row containing `k` distinct counter keys, key collection performs `k(k−1)/2` comparisons through `keys.some`; cell construction performs another `k(k+1)/2` through repeated `row.counters.find`. Thus conversion is Θ(k²) for Θ(k) output cells. A read-only getter-count probe observed 200, 800 and 3,200 key reads for 10, 20 and 40 counters respectively, while producing 11, 21 and 41 cells. Multiple rows and the total row repeat the scans.
- failure: Counts-table conversion scales quadratically with the number of counter columns, even for a single row. Doubling the column count quadruples lookup work.
- fix: Keep the ordered first-seen counter array, add an Effect hash set/map for key discovery, and index each row once by key. Retain the first counter for duplicate keys so labels, tokens and totals preserve current behavior. This reduces conversion to expected linear work in the input plus the emitted table cells.

### sol-2-6
- file: scratchpad/effected/cli/GithubAnnotation.ts:10
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-laws-v1.md laws 17 and 19; standards/ARCHITECTURE.md §5.   evidence: `AnnotationLevel` remains the erased named domain `"error" | "warning" | "notice"`, and `GithubAnnotationProperties` remains a handwritten plain-data interface. `Doc.ts` separately defines the same metadata fields in `AnnotationOptions`, including another literal list for the annotation level. The recorded schema-first deviation covers Doc models and several other literal domains but does not provide a schema source of truth for these declarations.
- failure: Annotation metadata has parallel handwritten and executable definitions. The named severity domain has no annotation-bearing runtime value from which its type, enumeration and guard can be derived, contrary to the completed schema-first requirement.
- fix: Define an identity-annotated `AnnotationLevel` LiteralKit and one structural annotation-metadata schema; derive the existing types and reuse the schema fields/domain in `Doc.AnnotationOptions`. Preserve field optionality, literal order and formatted bytes.

### sol-2-7
- file: scratchpad/effected/cli/Glyphs.ts:8
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-laws-v1.md law 17.   evidence: `GlyphSet` is a named, exported plain-data model containing strings, arrays, nested records, a finite kind and a numeric interval. It is reused by `Glyphs`, `Status`, `Render`, `CliTheme` and UI contexts, but `Glyphs.ts` defines no executable schema for it. The accepted native-runtime deviation authorizes dropping freezing; it does not waive schema ownership.
- failure: The shared glyph configuration remains an erased interface. Its shape, metadata, decoder and schema-derived arbitrary cannot come from the required executable source of truth.
- fix: Define an identity-annotated structural `GlyphSet` schema and derive the existing type from it. Preserve the plain readonly representation, optionality and exact built-in glyph/frame values; add a schema round-trip property.

### sol-2-8
- file: scratchpad/effected/cli/Status.ts:28
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-laws-v1.md law 17.   evidence: `StatusDef` remains a handwritten interface used by vocabulary construction, resolution and ranking. `Doc.ts:22` recreates its fields in a private `StatusDefinition` schema and checks that schema with `satisfies S.Codec<StatusDef>`. The exported model is therefore authored independently rather than derived from the existing executable shape.
- failure: Status configuration and document status payloads have two owners for the same model. The public status-definition contract has no shared runtime schema, and field/annotation changes must be maintained separately in the interface and private Doc schema.
- fix: Move the existing annotated structural shape to `Status.ts` as the `StatusDef` schema, derive its same-name type, and have Doc reuse that schema. Preserve plain-object definitions and existing vocabulary behavior; add its round-trip property.

### sol-2-9
- file: scratchpad/effected/cli/internal/isExitCode.ts:20
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b, which requires named/reused domain constraints to be schema-authored and guards to derive from `S.is(...)`.   evidence: The reusable POSIX exit-status constraint is implemented solely as `Number.isInteger(code) && code >= 0 && code <= 255`. Both `CliExit` and `CliRuntime` consume it. There is no schema for this named domain in the helper, and no recorded deviation waives its schema ownership. The green syntax gates do not establish that requirement.
- failure: Exit validation has no executable domain contract or canonical metadata; callers share an ad-hoc predicate instead of the schema-derived guard required by EF-12b.
- fix: Define an identity-annotated integer schema bounded to `0..255`, and derive `isExitCode` with `S.is(...)`. Preserve the existing number-input predicate signature and all current acceptance/rejection behavior.

REQUIRED: 9
BACKLOG: 0
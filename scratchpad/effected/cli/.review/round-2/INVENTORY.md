# CLI round-2 merged inventory

Seats read: **12 reports** (grok, sol, fable in each of part-1 through part-4) and all four adjacent BRIEF.md files. Fable files identify the third-seat Grok 4.7 medium fallback. **43 seat findings** merge into **31 Required, 1 Backlog, 0 Handled by the deviation codemod, 2 Rejected; 9 groups**. No-findings reports: part-2/grok and part-3/grok.

Reviewed commit: 2f515ae2519cc72223c94917019bf7ebfe92a4a5; pinned oracle: af7566a9da2eff169cb74955efcc5ede1e5de9f8. Merge performed on live @lab/effected-2 without switching branches or editing source/tests. The complete operator revision block, both 2026-10-09 rulings, D1–D20, section 12.5 and section 14 bind dispositions. The user’s merge instructions supersede the briefs’ S2/S3-green claim for classification.

The live standards/effect-laws.allowlist.jsonc contains **zero entries for scratchpad/effected/cli/**, so no allow-* records are added. Semantic schema omissions escape the four green syntax laws; Confirm identifies a specific scanner miss. Deferred prose is backlog. Properties attached to schema fixes verify the new contracts, not a module-wide coverage or vitest-canon sweep.

Attribution used per-file git logs, retained pre-squash history, and step-2/laws/S1 diffs from 6f2154defb, 2688563f71, 03bf79d41b, f9aee5bcb2 and 08c5727e58. The filesystem/Effect conversion is forced. Select’s row lookup introduced by cf2c19c76b (S3) is unforced and must restore the upstream shape and any rewritten upstream test lines. No scratch-copy compiler checks, vitest runs, coverage, ledger or closeout commands were run. Probe outputs remain attributed seat evidence except where live read-only merge probes are identified.

required.json groups own every source/test path at most once, with at most six source files each. New test paths are reserved write surfaces, not files created here. Multi-file defects stay in one group; independent part-4 annotation omissions are split by concrete classes into widget and bridge records to meet the file cap. The part-3 metadata record fits its six-source-file group. Preserve D9 behavior and optional-key semantics.

No group owns root package.json, bun.lock, repo configs, PORT_LEDGER.json or README Port notes. Added exports and law/upstream-bug deviation recording are central: recording clauses in accepted fixes do not authorize those writes. Register verified upstream-bug deviations centrally before implementation. No standalone finding solely requests that bookkeeping, so the codemod count is zero.

## Required

### cli-r2-1 — EditorLinks duplicates its erased domain and runtime vocabulary.

- file: scratchpad/effected/cli/CliLinks.ts:32
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-first-development.md EF-12b; standards/effect-laws-v1.md laws 17 and 19.
- evidence: `EditorLinks` is an erased four-member literal union. Lines 91–94 separately enumerate its members in `MODES` and implement membership through `find`. The named domain, enumeration, and runtime parser are independent declarations; there is no schema or LiteralKit for this domain. This semantic modeling requirement is not established by the four green mechanical laws.
- failure: A named, reused, runtime-validated literal domain lacks the required annotation-bearing schema source of truth. Its public type, accepted settings, and warning vocabulary can drift independently.
- fix: Define an identity-annotated `EditorLinks` LiteralKit with the existing member order, derive the type from it, and derive enumeration and membership from the kit. Preserve the existing trim/case normalization, defaults, and warning text; list the added value export under D2.
- seats: part-1/sol-2-2, part-1/grok-2-1, part-1/fable-2-4

### cli-r2-2 — The audience flag duplicates the existing AudienceKind kit.

- file: scratchpad/effected/cli/CliAudience.ts:27
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; AGENTS.md Code Laws (named `LiteralKit` domains and `S.is` guards). Same bar as round-1 cli-14, which fixed `scanAudience` and left this call site.
- evidence: `const KINDS: ReadonlyArray<AudienceKind> = ["human", "agent", "ci"]` is passed to `Flag.Literals("audience", KINDS)` at line 199. `scratchpad/effected/env/Audience.ts:31` already owns `AudienceKind = LiteralKit(["human", "agent", "ci"])`, and `scanAudience.ts:62` guards with `S.is(AudienceKind)`. `env/index.ts:12` exports `AudienceKind` as a type only. A `ReadonlyArray<AudienceKind>` does not require every kit member. The four gated laws do not check this.
- failure: A fourth `AudienceKind` still typechecks in `KINDS`, so `--audience` stays blind to it while the pre-parse scan accepts it. The flag vocabulary and `scanAudience` can disagree.
- fix: Import the `AudienceKind` value from `../env/Audience.ts` and pass `AudienceKind.literals` to `Flag.Literals`. Delete `KINDS`. Leave `env/index.ts` unchanged.
- seats: part-1/grok-2-2, part-1/fable-2-3

### cli-r2-3 — Hostile string conversion loses the selected exit code after reporting.

- file: scratchpad/effected/cli/CliRuntime.ts:741
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified-upstream-bug exception; `CliRuntime.reportFailures` documents rendering a failure and re-failing with a marked error that preserves the chosen exit code.
- evidence: A read-only `bun --no-cache -e` probe ran both the port and the pinned oracle with `Effect.fail({ toString() { throw thrown; } })`, `reportFailures({ exitCode: 23 })`, and a capturing logger. Both wrote `[FAIL] [unprintable value]`, then returned `Die(thrown)` with `Runtime.getErrorReported(...) === true` and exit code `1`. The green suite misses the contract failure because `scratchpad/test/cli/CliRuntime.coverage.test.ts:26` explicitly expects this secondary defect.
- failure: After successfully rendering the fallback diagnostic, `reported` performs an unguarded second string conversion. An unprintable failure therefore replaces the original failure with a new defect, loses the requested exit code, and remains eligible for the platform runtime’s duplicate report.
- fix: Guard conversion of non-Error values in `reported`; on conversion failure, construct the existing `CliRuntimeError` with a fixed fallback message, then apply both runtime marks. Retarget the existing regression to require a marked typed failure, `errorReported === false`, and the requested exit code. Record the verified upstream bug under §14.
- seats: part-1/sol-2-1

### cli-r2-4 — CliTest subprocess data lacks executable schemas.

- file: scratchpad/effected/cli/CliTest.ts:18
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33.
- evidence: `Sandbox` at line 18, `RunOptions` at line 37, and `RunResult` at line 63 are handwritten interfaces containing only strings, numbers, records, optional fields, and another plain-data model. `sandbox` and `run` return plain objects at lines 139 and 192. These are executable input/result payloads, including the explicitly documented “what a spawned bin did, as data”; they are neither service contracts nor type-level machinery. No corresponding schemas exist.
- failure: The subprocess helper’s configuration and result models remain outside the required schema contract. Their runtime validation, metadata, codecs, and schema-derived arbitraries cannot be derived from a source of truth despite all mechanical gates passing.
- fix: Define identity-annotated structural schemas for `Sandbox`, `RunOptions`, and `RunResult`, and derive the existing types. Preserve plain-object results, optional-key semantics, and subprocess behavior. Register the added value exports and add the D10 round-trip properties.
- seats: part-1/sol-2-3

### cli-r2-5 — CliLogFile lacks a schema for its configuration cases.

- file: scratchpad/effected/cli/CliLog.ts:182
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-12b and EF-33.
- evidence: `CliLogFile` is a named, handwritten union of `{ envVar: string }` and `{ path: string }`, reused by `CliLogFileOptions.file` and interpreted at lines 623–628. It is a plain configuration payload with runtime case selection, and has no executable schema. The green syntax and diagnostic gates do not establish schema ownership of this payload.
- failure: The two file-sink configuration cases have only an erased TypeScript contract. Runtime decoding, case schemas, identity metadata, and schema-derived generation are unavailable for this named model.
- fix: Define an identity-annotated union of structural schemas for the existing `envVar` and `path` forms and derive `CliLogFile` from it. Preserve the public object shapes, current branch precedence, and unset/empty-variable behavior. Register the added schema export and its D10 properties.
- seats: part-1/sol-2-4

### cli-r2-6 — CliPromptTarget lacks a schema for its payload cases.

- file: scratchpad/effected/cli/CliPrompt.ts:21
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-12b and EF-33.
- evidence: `CliPromptTarget` is a named, handwritten payload union of `{ flag: string }` and `{ argument: string }`. It is reused in `CliPromptFallbackOptions<A>` and passed to `answerWithoutPerson` to choose the missing-parameter error. Both target variants are directly representable by structural schemas, but no target schema exists. The generic `otherwise` value does not prevent schema ownership of this non-generic target model.
- failure: The missing-parameter target domain is modeled only through an erased declaration, so its variants, metadata, validation, and generated test data have no executable schema source of truth.
- fix: Define an identity-annotated structural union for the existing flag and argument forms, derive `CliPromptTarget`, and retain the generic fallback-options composition. Preserve public keys and missing-parameter behavior; register the added value export and add the D10 target properties.
- seats: part-1/sol-2-5

### cli-r2-7 — The curried refreshFailureTarget overload promises the wrong result.

- file: scratchpad/effected/cli/internal/failureTarget.ts:176
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; callable signatures must match runtime dispatch.
- evidence: A read-only, in-memory TypeScript program assigned `refreshFailureTarget` to `(settings?: FailureSettings) => (audience?: AudienceShape) => Effect.Effect<void>` and called `curry(undefined)()`, with zero caller diagnostics. A runtime probe reported `typeof refreshFailureTarget(undefined) === "object"` and then threw `TypeError: curried is not a function`. The dispatch predicate explicitly selects the data-first implementation for an omitted or `undefined` first argument. The focused source is byte-identical to the reviewed commit.
- failure: The optional curried overload promises a callable result for an argument that actually returns an Effect. Consumers using the advertised overload can typecheck and fail before running any Effect.
- fix: Require a non-undefined `FailureSettings` argument in the curried overload. Retain the existing zero-argument and `undefined` data-first calls. Add an overload-dispatch regression covering both forms.
- seats: part-2/sol-2-1

### cli-r2-8 — A valid file link with url: undefined crashes rendering and default labels.

- file: scratchpad/effected/cli/internal/layout.ts:57; scratchpad/effected/cli/Doc.ts:983
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; Doc.LinkTarget’s executable contract.
- evidence: A virtual TypeScript caller passed `{ url: undefined, file: "src/a.ts" }` as `LinkTarget`, with zero diagnostics. Read-only runtime probes returned `true` from both `S.is(LinkTarget)(target)` and `S.is(Inline)(Doc.link(target, "source"))`. Rendering that link threw `TypeError: undefined is not an object (evaluating 'input.replace')`. The pinned oracle throws for the same input. The file member accepts the object, but `safeTarget` selects the URL member solely because `"url" in target` is true.
- failure: A schema-valid, type-correct file link crashes document rendering. Without an explicit label, the same presence-only dispatch in `Doc.link` at line 983 also derives an undefined default label.
- fix: Select the URL branch using a string/schema-derived guard, preserving URL precedence when its value is valid. Normalize the file branch without an invalid `url` property, and use the same branch selection for `Doc.link`’s default label. Add the regression and register the verified upstream-bug deviation centrally.
- seats: part-2/sol-2-2

### cli-r2-9 — Issue deduplication conflates dotted names and nested paths.

- file: scratchpad/effected/cli/internal/format.ts:104
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; `issueEntries` promises the rejected values once each, preserving their paths.
- evidence: Decoding `S.Struct({ "a.b": S.String, a: S.Struct({ b: S.String }) })` against `{ "a.b": 1, a: { b: 2 } }` with `{ errors: "all" }` produced two core formatter entries: `{"path":["a.b"],"message":"Expected string"}` and `{"path":["a","b"],"message":"Expected string"}`. Both the port and pinned oracle returned only the first from `issueEntries`. Their deduplication key is identical: `"Expected string at a.b"`.
- failure: A literal dotted key and a nested property path collapse into one entry. The renderer silently drops a distinct rejected value, and the issue tree loses the nested branch.
- fix: Deduplicate by the message and the complete path sequence, using an unambiguous structural key rather than the formatted display string. Preserve existing display formatting. Add a dotted-key-versus-nested-path regression and register the upstream-bug deviation centrally.
- seats: part-2/sol-2-3

### cli-r2-10 — Document span boundaries split graphemes during layout.

- file: scratchpad/effected/cli/internal/layout.ts:148
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified upstream-bug exception; `truncateSpans`’ documented grapheme-boundary guarantee and the retained layout tests’ whole-grapheme contract.
- evidence: For adjacent nodes `Doc.text("👩"), Doc.text("\u200d"), Doc.text("💻")`, the port reports width 4; the equivalent joined node `Doc.text("👩‍💻")` reports width 2. At width 3, truncated rendering returns `"👩‍…"` for the split nodes and `"👩‍💻"` for the joined node. Wrapping returns `["👩‍", "💻"]` versus `["👩‍💻"]`. The pinned oracle reproduces all three differences. `widthOf` sums independently measured spans, and `cellsOf` segments each span independently.
- failure: Document-node boundaries become grapheme boundaries. A two-column emoji that fits is truncated or split across lines, leaving a partial ZWJ sequence and changing its displayed meaning.
- fix: Measure and segment the concatenated visible text across adjacent spans. Track source-span offsets so a grapheme remains one atomic layout unit while retaining its original style/link fragments. Add split-versus-joined emoji and combining-sequence regressions, and register the upstream-bug deviation centrally.
- seats: part-2/sol-2-4

### cli-r2-11 — Counts-table discovery and lookup require quadratic work.

- file: scratchpad/effected/cli/internal/counts.ts:137
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11’s algorithmic-class criterion.
- evidence: For one row containing `k` distinct counter keys, key collection performs `k(k−1)/2` comparisons through `keys.some`; cell construction performs another `k(k+1)/2` through repeated `row.counters.find`. Thus conversion is Θ(k²) for Θ(k) output cells. A read-only getter-count probe observed 200, 800 and 3,200 key reads for 10, 20 and 40 counters respectively, while producing 11, 21 and 41 cells. Multiple rows and the total row repeat the scans.
- failure: Counts-table conversion scales quadratically with the number of counter columns, even for a single row. Doubling the column count quadruples lookup work.
- fix: Keep the ordered first-seen counter array, add an Effect hash set/map for key discovery, and index each row once by key. Retain the first counter for duplicate keys so labels, tokens and totals preserve current behavior. This reduces conversion to expected linear work in the input plus the emitted table cells.
- seats: part-2/sol-2-5

### cli-r2-12 — GitHub annotation metadata and levels have parallel owners.

- file: scratchpad/effected/cli/GithubAnnotation.ts:10; scratchpad/effected/cli/Doc.ts:582
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-laws-v1.md laws 17 and 19; standards/ARCHITECTURE.md §5.
- evidence: `AnnotationLevel` remains the erased named domain `"error" | "warning" | "notice"`, and `GithubAnnotationProperties` remains a handwritten plain-data interface. `Doc.ts` separately defines the same metadata fields in `AnnotationOptions`, including another literal list for the annotation level. The recorded schema-first deviation covers Doc models and several other literal domains but does not provide a schema source of truth for these declarations.
- failure: Annotation metadata has parallel handwritten and executable definitions. The named severity domain has no annotation-bearing runtime value from which its type, enumeration and guard can be derived, contrary to the completed schema-first requirement.
- fix: Define an identity-annotated `AnnotationLevel` LiteralKit and one structural annotation-metadata schema; derive the existing types and reuse the schema fields/domain in `Doc.AnnotationOptions`. Preserve field optionality, literal order and formatted bytes.
- seats: part-2/sol-2-6, part-2/fable-2-1

### cli-r2-13 — GlyphSet remains an erased shared configuration model.

- file: scratchpad/effected/cli/Glyphs.ts:8
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-laws-v1.md law 17.
- evidence: `GlyphSet` is a named, exported plain-data model containing strings, arrays, nested records, a finite kind and a numeric interval. It is reused by `Glyphs`, `Status`, `Render`, `CliTheme` and UI contexts, but `Glyphs.ts` defines no executable schema for it. The accepted native-runtime deviation authorizes dropping freezing; it does not waive schema ownership.
- failure: The shared glyph configuration remains an erased interface. Its shape, metadata, decoder and schema-derived arbitrary cannot come from the required executable source of truth.
- fix: Define an identity-annotated structural `GlyphSet` schema and derive the existing type from it. Preserve the plain readonly representation, optionality and exact built-in glyph/frame values; add a schema round-trip property.
- seats: part-2/sol-2-7

### cli-r2-14 — StatusDef and Doc.StatusDefinition independently author one contract.

- file: scratchpad/effected/cli/Status.ts:28; scratchpad/effected/cli/Doc.ts:22
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-laws-v1.md law 17.
- evidence: `StatusDef` remains a handwritten interface used by vocabulary construction, resolution and ranking. `Doc.ts:22` recreates its fields in a private `StatusDefinition` schema and checks that schema with `satisfies S.Codec<StatusDef>`. The exported model is therefore authored independently rather than derived from the existing executable shape.
- failure: Status configuration and document status payloads have two owners for the same model. The public status-definition contract has no shared runtime schema, and field/annotation changes must be maintained separately in the interface and private Doc schema.
- fix: Move the existing annotated structural shape to `Status.ts` as the `StatusDef` schema, derive its same-name type, and have Doc reuse that schema. Preserve plain-object definitions and existing vocabulary behavior; add its round-trip property.
- seats: part-2/sol-2-8

### cli-r2-15 — POSIX exit-code validation uses an ad-hoc predicate.

- file: scratchpad/effected/cli/internal/isExitCode.ts:20
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b, which requires named/reused domain constraints to be schema-authored and guards to derive from `S.is(...)`.
- evidence: The reusable POSIX exit-status constraint is implemented solely as `Number.isInteger(code) && code >= 0 && code <= 255`. Both `CliExit` and `CliRuntime` consume it. There is no schema for this named domain in the helper, and no recorded deviation waives its schema ownership. The green syntax gates do not establish that requirement.
- failure: Exit validation has no executable domain contract or canonical metadata; callers share an ad-hoc predicate instead of the schema-derived guard required by EF-12b.
- fix: Define an identity-annotated integer schema bounded to `0..255`, and derive `isExitCode` with `S.is(...)`. Preserve the existing number-input predicate signature and all current acceptance/rejection behavior.
- seats: part-2/sol-2-9

### cli-r2-16 — Actions after Enter change an already submitted answer.

- file: scratchpad/effected/cli/ui/Select.ts:164; scratchpad/effected/cli/ui/Confirm.ts:170; scratchpad/effected/cli/ui/MultiSelect.ts:164
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Select.View` documents that submission is single-shot and the view stays as submitted.
- evidence: Read-only `CliUiTest.render` probes sent keys in one `handle.chunk(...)`. Select received `("enter", "down")` while highlighting `"first"` and returned `"second"`; Confirm received `("enter", { char: "y" })` with an initial No and returned `confirmed: true`; MultiSelect received `("enter", "space")` with nothing selected and returned the first item. Pure reducer probes against the pinned oracle reproduced all three results. The existing coalesced-input test covers `y` **before** Enter.
- failure: Submission only sets `submitted`; subsequent actions in the same input batch keep changing state before the submission effect reads it. The answer returned can differ from the answer the user submitted. The same defect is present in `Confirm.ts:170` and `MultiSelect.ts:164`.
- fix: Make submitted reducer states terminal by returning the existing state for subsequent actions. Add the three Enter-then-action chunk regressions and record the verified upstream-bug deviation.
- seats: part-3/sol-2-1

### cli-r2-17 — Text immediately before a Markdown link turns it into an image.

- file: scratchpad/effected/cli/internal/renderMarkdown.ts:30
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Render.markdown` promises that document text cannot become Markdown syntax and that a link renders as a link.
- evidence: Both the port and pinned oracle render `Doc.paragraph("!", Doc.link({ url: "https://example.test/image.png" }, "guide"))` as `![guide](https://example.test/image.png)`. A read-only probe through the pinned upstream Markdown parser returned an `image` node rather than a text node followed by a link.
- failure: A literal exclamation mark immediately before a document link turns that link into an image. The exclamation disappears as text, the label becomes alternative text, and an image-capable reader can load the destination as an image.
- fix: Include `!` in `escapeText`’s escaped punctuation. Add a parser-backed regression for text immediately preceding a link and record the verified upstream-bug deviation.
- seats: part-3/sol-2-2

### cli-r2-18 — Rerendered choices disagree with mount-time submitted values.

- file: scratchpad/effected/cli/ui/Select.ts:369; scratchpad/effected/cli/ui/MultiSelect.ts:372
- class: bug   severity: required
- standard: D9, D11, §14 verified-upstream-bug exception; `Select.View` and `MultiSelect.View` document that their choices or sections are read once at mount.
- evidence: A read-only `CliUiTest.view` probe mounted a choice labelled `"original"` with value `"original"`, then rerendered the same view with label and value `"replacement"`. Select displayed `→ replacement` but Enter submitted `"original"`. MultiSelect displayed `→ ◉ replacement` but submitted `["original"]`. Inspection of the pinned oracle shows the same split between rendering current props and submitting mount-time state.
- failure: The displayed choices and submitted values come from different collections after a parent rerender. Select builds rows, labels and details from `props.choices` while submitting `state.choices`; MultiSelect similarly uses `props.sections` at `MultiSelect.ts:372` while submitting `state.sections`. A user can choose the displayed replacement and receive the original value.
- fix: Derive Select’s rows, rendered choices and detail from `state.choices`, and MultiSelect’s items and rows from `state.sections`. This preserves the documented mount-time snapshot. Add rerender-and-submit regressions and record the verified upstream-bug deviation.
- seats: part-3/sol-2-3

### cli-r2-19 — Fractional and NaN initial indices can select a disabled choice.

- file: scratchpad/effected/cli/ui/Select.ts:156
- class: bug   severity: required
- standard: D11 and §14 verified-upstream-bug exception; `SelectInitOptions.initial` promises an enabled starting choice.
- evidence: With choices `[disabled, enabled]`, read-only probes against both the port and pinned oracle returned `{ cursor: 0, disabled: true, submitted: false }` for `initial: 0.5` and `initial: NaN`; the control `initial: 1` selected and submitted the enabled choice. These are additional cases beyond round-1’s repaired out-of-range integer inputs. The new `NaN` coverage test uses an enabled first row.
- failure: Clamping does not normalize fractional indices or `NaN`. Fractional array lookups return `undefined`, which `enabled` treats as enabled because `choices[index]?.disabled !== true`; `NaN` skips both searches and falls back to row zero. Select can consequently highlight a disabled choice despite an enabled choice being available.
- fix: Normalize initial to an integer (use zero for NaN), preserve the finite clamp and boundary behavior for infinities, then search. Require an existing choice in enabled. Add fractional/NaN cases with a disabled first row; extend upstream-bug bookkeeping centrally.
- seats: part-3/sol-2-4, part-3/fable-2-2

### cli-r2-20 — An unforced S3 row lookup introduces quadratic repaint work.

- file: scratchpad/effected/cli/ui/Select.ts:375
- class: perf   severity: required
- standard: D9; operator Grilling 2026-10-09: restore unforced upstream shapes and rewritten tests; D11 algorithmic-class regression.
- evidence: The pinned oracle obtains each rendered choice with `props.choices[Number(row.key)]`, an O(1) lookup. The port calls `rows.indexOf(row)`, scanning up to N rows for each of V visible rows. Choice lookup therefore costs O(NV); when the configured height and terminal permit all N choices to be visible, one frame performs N(N+1)/2 identity comparisons. Including row construction, this changes O(N+V) work into O(N+NV), with an O(N²) case. Attribution: git log --all -G rows.indexOf identifies cf2c19c76b (S3). Its diff replaces upstream keyed lookup and optional fallbacks with A.getUnsafe(props.choices, rows.indexOf(row)). Step-2/laws/S1 diffs do not introduce it: this coverage-stage rewrite is unforced.
- failure: Large visible selections acquire quadratic lookup work on every repaint. This is a separate regression from the previously recorded matcher-allocation backlog.
- fix: Restore upstream row._tag === "Item" lookup using Number(row.key), its undefined/optional fallbacks, and any upstream test lines this rewrite altered. Remove the added Array import if unused. Apply the independently required mount-time snapshot fix to the indexed collection. Retain upstream tests and add a lookup-work regression; do not preserve the unforced rewrite through a new map.
- seats: part-3/sol-2-5

### cli-r2-21 — Confirm, Select and MultiSelect actions lack LiteralKit ownership.

- file: scratchpad/effected/cli/ui/Confirm.ts:104; scratchpad/effected/cli/ui/Select.ts:68; scratchpad/effected/cli/ui/MultiSelect.ts:96
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12b.
- evidence: `ConfirmAction` is a named, reused eight-member string union with no runtime schema. `SelectAction` at `Select.ts:68` and `MultiSelectAction` at `MultiSelect.ts:96` likewise remain erased literal domains used by reducers and typed key tables. The green mechanical gates accept these declarations without establishing schema ownership.
- failure: The action vocabularies have no annotation-bearing runtime source of truth from which their types, enumeration and membership checks can be derived. This leaves named domain concepts outside the required schema-first contract.
- fix: Define identity-annotated `LiteralKit` action domains and derive the existing action types from them, preserving every current member. Record any added runtime exports under D2.
- seats: part-3/sol-2-6

### cli-r2-22 — Six reducer/runtime errors lack schema or message metadata.

- file: scratchpad/effected/cli/ui/Confirm.ts:23; scratchpad/effected/cli/ui/Select.ts:19; scratchpad/effected/cli/ui/DocView.ts:14; scratchpad/effected/cli/ui/CliUiLive.ts:298; scratchpad/effected/cli/ui/CliUi.ts:41; scratchpad/effected/cli/ui/MultiSelect.ts:26
- class: schema   severity: required
- standard: Operator step 4 requires schema and field annotations; `standards/effect-first-development.md` EF-12 requires meaningful canonical schema metadata.
- evidence: Read-only probes caught `DuplicateToggleKeyError` and `NoEnabledChoiceError` and inspected their schema ASTs. Both contained only the composed `identifier` and tag sentinels, with no title or description; their `message` fields had no annotations. `MissingDocViewThemeError` at `DocView.ts:14` and `LiveTickError` at `CliUiLive.ts:298` have the same omission. These are additional error classes beyond round-1’s `cli-3` sites. `DuplicateToggleKeyError`, `MissingDocViewThemeError`, `NoEnabledChoiceError`, and `LiveTickError` pass only the identity tag into `S.TaggedError` and leave `message: S.String` bare. `ScreenExited` and `DuplicateItemKey` pass `$I.annote` on the schema and still leave `message` bare. The completed shape in `CliExit.ts` annotates both the schema and `message`.
- failure: These introduced schema errors supply identity strings but omit the domain and field metadata required by the completed annotation step. Schema inspection and documentation consumers receive no meaningful description of these failures or their message payloads.
- fix: Add meaningful $I.annote schema and message metadata to DuplicateToggleKeyError, NoEnabledChoiceError, MissingDocViewThemeError and LiveTickError; add missing message descriptions to ScreenExited and DuplicateItemKey. Preserve tags, names, messages and construction. Assert metadata in the reducer group’s dedicated test.
- seats: part-3/sol-2-7, part-3/fable-2-1

### cli-r2-23 — Confirm.result evades the native-runtime scanner with defineProperty.

- file: scratchpad/effected/cli/ui/Confirm.ts:201
- class: law   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 6; `standards/effect-first-development.md` EF-5.
- evidence: `Confirm.result` still calls native `Object.defineProperty` for each toggle in production reducer logic. The reviewed source matches commit `2f515ae`, despite the reported green native-runtime gate, and no Confirm exception appears in the law allowlist. A read-only probe compared the current construction with `R.fromEntries` for `__proto__` and `constructor` toggle keys; both produced the same serialized own properties and values. `result` builds `toggles` with `Object.defineProperty` for each toggle key. Upstream was `Object.fromEntries`, which the checker rejects. `defineProperty` is the same object-mutation surface with a callee the checker does not name.
- failure: Native `Object` manipulation remains in domain logic after the required native-runtime migration. The intact call on the green reviewed commit demonstrates a missed enforcement site.
- fix: Construct the toggle record with `R.fromEntries` over typed key/value tuples, retaining the `Partial<Record<K, boolean>>` result type. Keep regressions for special property names.
- seats: part-3/sol-2-8, part-3/fable-2-3

### cli-r2-24 — TextInput, Toggle and column Tabs wrap during immediate resize.

- file: scratchpad/effected/cli/ui/TextInput.ts:425; scratchpad/effected/cli/ui/Toggle.ts:67; scratchpad/effected/cli/ui/Tabs.ts:289
- class: bug   severity: required
- standard: `ui/UiTheme.ts` → `useTerminalSize` documents that hook-derived text widths lag Ink’s immediate resize repaint and require layout-time clipping; `TextInput` promises a one-line value; D11 and §14 permit verified upstream-bug corrections.
- evidence: A read-only `CliUiTest.session({ columns: 80, rows: 24, color: "none", renderPath: "production" })` probe mounted an input containing 100 `X` characters, then resized to 20 columns. The first new frame contained four physical value rows and two footer rows; the following frame returned to three total rows. The same probe exposed four-row interim output from `Toggle.View` and column-oriented `Tabs.View`. Evaluating the pinned oracle’s widget sources in memory, with imports redirected to the shared lab dependencies, reproduced all three failures. The affected rendering sites are also `ui/Toggle.ts:67` and `ui/Tabs.ts:289`; their rows have no layout-time clipping.
- failure: Shrinking the terminal temporarily expands widgets that should occupy one row into several rows. This invalidates the screen’s height budget and can push the frame into scrollback before React supplies the corrected text. Existing tests check fixed-width or settled output and miss the immediate repaint.
- fix: Clip each intended single-row element against Ink’s current layout: use `wrap: "truncate-end"` for direct text and a one-row, overflow-hidden wrapper for styled/composite rows, reserving the one-column margin through layout. Apply this to TextInput’s value and other single-row children, both Toggle branches, and column Tabs rows. Add production-path resize assertions covering every intermediate frame and record the correction under §14.
- seats: part-4/sol-2-1, part-4/fable-2-2

### cli-r2-25 — Viewport End-key jumps repeatedly scan prefixes.

- file: scratchpad/effected/cli/ui/Viewport.ts:188
- class: perf   severity: required
- standard: D11 permits required performance findings with an algorithmic-class argument.
- evidence: When a mounted viewport moves from the first item to the last, `slice` advances `start` one item at a time. Each iteration calls `linesFrom`, whose header search at `Viewport.ts:151` scans backward to the beginning when there are no headers. For a fixed ten-row window over `n` header-free items, the accumulated searches perform Θ(n²) work. A read-only Node probe evaluated the actual TypeScript helpers in memory with `previous = 0`, the last item selected, and budget 10. Port timings were approximately 12 ms for 4,000 items, 48 ms for 8,000, and 191 ms for 16,000. The pinned oracle produced approximately the same timings.
- failure: An ordinary End-key jump synchronously blocks rendering for increasingly long periods; doubling the list approximately quadruples the work even though only ten rows are drawn.
- fix: Compute the nearest preceding header for each item during the existing item-index pass and pass that lookup into `linesFrom`. This removes repeated prefix scans and makes this path linear in list length for a fixed viewport height, while preserving the current window-selection behavior. Add a scaling or operation-count regression.
- seats: part-4/sol-2-2

### cli-r2-26 — Terminal overwrites operate on code units instead of display cells.

- file: scratchpad/effected/cli/ui/testing/terminalModel.ts:51
- class: bug   severity: required
- standard: `screenAfter` promises what the terminal shows after printable text and supported cursor moves; D11 and §14 permit a reproduced upstream-bug correction.
- evidence: A read-only differential probe called the port and pinned oracle with `"😀\rX"`. Both returned `["X\uDE00"]`, containing an orphan low surrogate. For `"中a\rXY"`, both returned `["XY"]`, losing the trailing `a`. The printable-character regex consumes UTF-16 code units, and the overwrite logic treats string offsets as terminal columns. The current properties include wide characters but omit supplementary characters and do not assert cell-correct overwriting.
- failure: Transcript output can contain malformed Unicode and can delete text that remains visible on a terminal. These incorrect results propagate to `CliUiTest`’s combined, stdout, and stderr transcripts.
- fix: Represent printable content by graphemes and terminal cells, including continuation cells for wide graphemes. Apply carriage return and cursor coordinates to cell positions and replace whole affected graphemes. Add emoji and CJK overwrite regressions and record the verified upstream bug.
- seats: part-4/sol-2-3

### cli-r2-27 — Viewport and UiTheme errors lack schema and field metadata.

- file: scratchpad/effected/cli/ui/Viewport.ts:12; scratchpad/effected/cli/ui/UiTheme.ts:15
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12 requires meaningful canonical `$I.annote(...)` metadata on new schemas; EFFECTED_PORT_GOAL operator step 4 also requires annotations on schemas and fields.
- evidence: DuplicateViewportKeyError and MissingUiThemeError omit schema annotations and have bare message fields. The sol probe captured DuplicateViewportKeyError: identifier/sentinels only and undefined message annotations. These are different classes from round-1 cli-3.
- failure: Widget invariant-error ASTs lack required domain and message descriptions.
- fix: Add meaningful $I.annote schema metadata and message descriptions to DuplicateViewportKeyError and MissingUiThemeError. Preserve tags, payloads and behavior; assert metadata in the widget group’s dedicated test.
- seats: part-4/sol-2-4, part-4/fable-2-4

### cli-r2-28 — Viewport, TextInput state and Tabs actions lack schemas.

- file: scratchpad/effected/cli/ui/Viewport.ts:30,49,60; scratchpad/effected/cli/ui/TextInput.ts:22; scratchpad/effected/cli/ui/Tabs.ts:17
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` → Core Principle 5 makes Schema the source of truth for pure data models; `standards/schema-first-development-prompt.md` → “Schema owns pure data”; EF-12b, EF-13, EF-33; D5.
- evidence: `ViewportState` remains a handwritten data interface, `ViewportRow` at `Viewport.ts:49` remains a handwritten tagged payload union, and the named six-member `ViewportMove` domain at `Viewport.ts:60` remains an erased string union. The focused reducer surfaces also retain handwritten `TextInputState` (`ui/TextInput.ts:22`) and `TabsAction` (`ui/Tabs.ts:17`). These represent concrete reducer states, row payloads, and actions consumed by runtime branches. No corresponding executable schemas or derived types exist. The recorded schema-first deviation covers Doc, Style, key, color, token, status, and span domains; it does not exempt these models.
- failure: These UI models have no canonical runtime schema from which validation, equivalence, codecs, or arbitraries can be derived. Their handwritten declarations remain the source of truth, contrary to the binding pure-data modeling law. Existing properties construct separate test schemas rather than deriving the production models.
- fix: Define identity-annotated structural schemas for the states and payloads, a schema-backed tagged union for `ViewportRow`, and a `LiteralKit` for `ViewportMove`; represent `TabsAction` with a schema union preserving its existing literals and `{ jump }` shape. Derive the existing types, retain plain reducer results and current input behavior, and add schema-derived round-trip properties.
- seats: part-4/sol-2-5

### cli-r2-29 — Split sanitization exposes escape payloads and double-folds CRLF.

- file: scratchpad/effected/cli/ui/TextInput.ts:412
- class: bug   severity: required
- standard: D9 / D11; `ui/internal/lineText.ts` (widget text is sanitized before it is drawn); ledger deviation for round-1 cli-17 (`widgetText.test.ts:73,98`), which claims both display segments remove escapes. New
- evidence: that claim holds only when neither slice ends inside a sequence. `shownBefore` / `shownAfter` are `lineText` of each raw slice. `stripAnsi` only removes a complete CSI/OSC (`displayWidth.ts` `ANSI`), and `sanitize` then deletes a leftover ESC. For value `a\u001b[31mRED` with the cursor between ESC and `[`, the before-slice becomes `a` and the after-slice is the literal `[31mRED`. A cursor between `\r` and `\n` folds each half, so one CRLF is drawn as two spaces. `Intl.Segmenter` treats those bytes as separate graphemes, so Left/Right can land there. The hostile-value regression renders the initial state, whose cursor is `value.length`, so both slices are not split.
- failure: Moving the cursor through an ANSI or OSC span in the stored value paints the sequence payload, including a hyperlink target, and the visible text gains and loses characters as the cursor moves. ESC bytes and extra rows stay gone, so this is not the original cli-17 frame. The submitted value is unchanged.
- fix: Sanitize and fold the whole value once, map the raw cursor through the same pass, and split the sanitized result. A cursor inside a removed ANSI/OSC span maps to its output position; CRLF folds once. Preserve raw editing/submission. Add mid-CSI, mid-OSC and between-CR/LF regressions to widgetText.test.ts; lineText.ts is reserved for shared mapping if needed.
- seats: part-4/grok-2-1, part-4/fable-2-1

### cli-r2-30 — Chalk resolution recovers an injected filesystem interrupt.

- file: scratchpad/effected/cli/ui/internal/inkChalk.ts:109
- class: effect-idiom   severity: required
- standard: Effect interruption is a `Cause` that `Effect.catchCause` handles; recovering it continues the fiber. Upstream `inkChalk` was `async` inside `try/catch`, and `Effect.promise` still failed the effect with the interrupt. D11 effect-idiom. The native-runtime deviation records the FileSystem move, not this recovery.
- evidence: Live read-only bun --no-cache probe: FileSystem.makeNoop({ realPath: () => Effect.interrupt }) provided to inkChalk() returns Exit.Success(Option.None). The catchCause at line 109 recovers the interrupt. Control: externally aborting Effect.never.pipe(catchCause(...)) returns Exit.Failure(Interrupt), so the seat’s broad Ctrl-C claim is unestablished. The supported defect is recovery of self-interruption from an injected service. git log and 08c5727e58 (S1) show a forced filesystem/Effect conversion.
- failure: An injected filesystem interrupt becomes ordinary unresolved chalk and downstream warning/hold logic can succeed.
- fix: Recover only non-interrupt causes to None with catchCauseIf and a Cause predicate or equivalent typed recovery; propagate interrupt causes. Add an injected realPath self-interruption regression and retain missing-chalk fallback. Do not restore the law-forced native filesystem implementation.
- seats: part-4/fable-2-3

### cli-r2-31 — Five bridge/test-runtime errors lack schema or message metadata.

- file: scratchpad/effected/cli/ui/internal/ink.ts:15; scratchpad/effected/cli/ui/internal/ScreenContext.ts:9; scratchpad/effected/cli/ui/internal/lazyView.ts:11; scratchpad/effected/cli/ui/internal/inkConsole.ts:20; scratchpad/effected/cli/ui/testing/CliUiTest.ts:43
- class: schema   severity: required
- standard: Operator step 4 (annotations on fields and schemas); `standards/effect-first-development.md` EF-12. The four syntax gates do not read schema AST metadata. cli-3 fixed other CLI errors; these constructors are still bare. The identity-annotations deviation records errors that gained annotations, not these omissions.
- evidence: InkNotLoaded, ScreenContextError and LazyViewStateError omit schema annotations and have bare message fields. ConsoleTrace and CliUiTestError have schema annotations but bare message fields. The sol AST probe captured InkNotLoaded with identifier/sentinels only and no message annotations; MissingInkPeersError already has both. The same reports’ Viewport/UiTheme sites belong to cli-r2-27.
- failure: Bridge/test-runtime error ASTs lack domain and/or message descriptions.
- fix: Add $I.annote schema and message metadata to InkNotLoaded, ScreenContextError and LazyViewStateError; add message descriptions to ConsoleTrace and CliUiTestError. Preserve tags, name overrides, messages and construction; assert metadata in the bridge group’s dedicated test.
- seats: part-4/fable-2-4, part-4/sol-2-4

## Backlog

### cli-b2-1 — Doc and Block prose incorrectly says their values are never decoded or encoded.

- file: scratchpad/effected/cli/Doc.ts:545
- class: docs   severity: backlog
- standard: D11. Docgen already checks example execution and section shape. The prose contradicts the schemas those checks compile.
- evidence: Line 545 says "nothing decodes them" immediately before `S.is(Block)(Doc.paragraph("Ready"))`. Line 878 says "nothing decodes or encodes one" and that a document is not meant to be serialised. `scratchpad/test/cli/Doc.coverage.test.ts:23` encodes and decodes `Block`. `scratchpad/test/cli/Doc.property.test.ts:49` round-trips `AnnotationOptions`.
- failure: The public `Block` and `Doc` contracts tell callers that documents are neither decoded nor encoded, while the schemas and those tests do both. A later edit can drop the codecs on that instruction.
- fix: Rewrite both sentences so constructors still return plain objects and do not decode, and the schemas remain the decode and encode contract for structural nodes, with `overflow` and `total` staying function fields.
- seats: part-2/fable-2-2
- reason: Docs/JSDoc are deferred S2 work under the merge instructions.

## Handled by the deviation codemod

None. Recording clauses within accepted fixes remain central per-module/per-class codemod work, not separate required findings.

## Rejected

### cli-x2-1 — The alleged class-guard lookalike widening is not reproduced.

- file: scratchpad/effected/cli/CliFailure.ts:298
- class: bug   severity: rejected
- standard: D9 / section 14 (accepted input and formatted result); upstream `CliFailure.ts` dieBlocks/failBlocks use `instanceof Cancelled` and `instanceof NotInteractive`
- evidence: `Schema.is` (`SchemaParser.ts:143-157`) returns true when the parser succeeds, and `compilerAdaptersEnabled` defaults to false (`compilerRegistry.ts:37`). A class parser (`interpreter.ts:86-90`) decodes any value that is not already constructed, and the class transform builds `new self(input)` (`Schema.ts:15947-15949`). `{ _tag: "Cancelled", reason: "escape" }` and `{ _tag: "NotInteractive" }` therefore pass `S.is` without being instances. Line 298 and line 329 then read `.message` and return that single paragraph. Merge probe: Cancelled({_tag:"Cancelled",reason:"escape"}), NotInteractive({_tag:"NotInteractive"}) and ExitRequested({_tag:"ExitRequested",code:2}) all fail their S.is guards; an actual tagged-error instance passes the control.
- failure: A plain lookalike takes the one-line cancellation path. It does not carry the prototype getter (`cancelled; nothing written` / `not interactive: run in a terminal or pass the flag`), so the report prints that object's own `message` and skips the failure-status line upstream still builds for a non-instance.
- fix: Gate both short-circuits with `instanceof Cancelled` and `instanceof NotInteractive`, as upstream does. Real `S.TaggedError` instances still match; decoded lookalikes keep the generic report.
- seats: part-1/fable-2-1
- reason: Live Effect 4 S.is returns false for the exact plain-object lookalikes; the seat confuses encoded class decoding with class type guards.

### cli-x2-2 — The alleged class-guard lookalike widening is not reproduced.

- file: scratchpad/effected/cli/CliRuntime.ts:462
- class: bug   severity: rejected
- standard: D9 / section 14; `Cause.YieldableError` is what `yield*` can fail with (`Cause.ts:1186-1188`); upstream `CliRuntime.ts:379` and `:424-425` use `instanceof`
- evidence: Same parser path as fable-2-1. `ExitRequested` is `{ _tag: "ExitRequested", code: Finite }`, so `{ _tag: "ExitRequested", code: 2 }` passes `S.is(ExitRequested)` and is not iterable. The same widening sets `isCancelled` / `isNotInteractive` at lines 506-507. Merge probe: Cancelled({_tag:"Cancelled",reason:"escape"}), NotInteractive({_tag:"NotInteractive"}) and ExitRequested({_tag:"ExitRequested",code:2}) all fail their S.is guards; an actual tagged-error instance passes the control.
- failure: `reportFailures` treats that lookalike as an already-handled exit and then `yield*`s it. The generator throws because the object has no effect iterator, so the original failure becomes a defect in the reporter. A custom `render` also sees `isCancelled` or `isNotInteractive` for a non-instance and can suppress the report upstream would still print.
- fix: Use `instanceof ExitRequested`, `instanceof Cancelled`, and `instanceof NotInteractive` for these three branches. Keep `yield*` only for a real `ExitRequested` instance.
- seats: part-1/fable-2-2
- reason: Live Effect 4 S.is returns false for the exact plain-object lookalikes; the seat confuses encoded class decoding with class type guards.

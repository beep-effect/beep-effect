# CLI round-3 inventory

Read all 12 seat reports (grok, sol and fable in part-1 through part-4), all four BRIEF.md files and their BRIEF.grok3.md companions. Raw findings: 43. Merged disposition records: 32 required, 2 backlog, 0 codemod-only, 0 rejected. Required work: 10 non-overlapping groups, at most six source files each. The aggregated part-1/sol-3-8 is split into six independently owned model records; every contributing seat id is qualified by its part directory.

Report commit: `c3fc60bdbfd5574dc69623d132dced0a552a586a`. Merge checkout: `@lab/effected-2`, HEAD `fa292f07acd774e34641608f21cc8655fda406fa`; CLI source/tests have no diff from the report commit. The requested branch was `@lab/effected`; no checkout switch was made. Pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. The live allowlist and the report-commit allowlist both contain zero `scratchpad/effected/cli/**` entries, so there are no `allow-*` records.

Binding precedence: the entire operator revision block, D1-D20, section 12.5 and section 14, plus the current merge instructions. Green-gate claims come from the briefs, not a new execution. Semantic schema ownership, annotation meaning and behavioral counterexamples show gaps those gates miss. Docs and coverage/property-floor findings are backlog. Existing round-2 items are retained only where current implementation evidence shows an unclosed defect. The gates' purported S2/S3 completion does not override the requested disposition policy.

Each required fix is limited to its JSON group's source and test files. New test paths listed there are reserved to that group. New schemas may be exported directly from their source file; existing root type-only exports need not be changed unless explicitly assigned. Ledger, README Port notes and exportsAdded recording clauses from seats are centralized codemod responsibilities and confer no write authorization here. No repo-level configuration change is assigned. Only the two requested inventory files were written; no tests, probes, scratch compiler checks, graph refreshes, ledger commands or quality commands were run by the merger.

## Required

### cli-r3-1 — Schema-valid file targets retain an invalid URL key and crash raw-target consumers.

- file: scratchpad/effected/cli/CliLinks.ts:127; scratchpad/effected/cli/Doc.ts:943; scratchpad/effected/cli/internal/renderDoc.ts:60; scratchpad/effected/cli/internal/renderMarkdown.ts:99
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `LinkTarget`’s executable contract.
- evidence: A read-only probe passed `{ file: "/repo/a.ts", url: undefined }` to `CliLinks.layerTest("file")`’s `target`. `S.is(LinkTarget)(target)` returned `true`, and an in-memory TypeScript caller produced zero diagnostics. Both the reviewed port and pinned oracle threw `TypeError: undefined is not an object (evaluating 'input.replace')`. Round-2 cli-r2-8 repaired this input in `Doc.link` and layout; this public service remains a separate failing consumer. Part-2 grok-3-1 probed the stored Doc.link target: its own keys still include url despite successful rendering; direct CliLinks.target and targetText throw. Part-2 fable-3-2 traces target: { ...target } at Doc.ts:943 and linkUrl target.url.trim(). Round-2 cli-r2-8 only normalizes flattened spans; README line 225 overstates stored-node normalization.
- failure: A schema-valid, type-correct file target enters the URL branch because the unused `url` property exists. Direct service calls and calls through `CliLinks.linker` can throw instead of returning the file URL or label.
- fix: Normalize Doc.link targets using the URL-member guard, storing only the selected URL or file fields. Use S.is(LinkTarget.members[0]) in CliLinks.makeTarget, renderDoc.targetText and renderMarkdown.linkUrl so raw schema-valid targets are safe too. Preserve valid URL precedence. Extend Doc.test.ts with the stored-target assertion, CliLinks.test.ts with target/linker cases, and renderer tests with direct raw-target cases.
- seats: part-1/sol-3-1, part-1/grok-3-1, part-1/fable-3-1, part-2/grok-3-1, part-2/fable-3-2
- group: g1

### cli-r3-2 — File-sink dispatch and codec precedence disagree with valid configuration shapes.

- file: scratchpad/effected/cli/CliLog.ts:195,650
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `CliLogFile`’s executable contract.
- evidence: `{ envVar: "LOG_PATH", path: undefined }` passes `S.is(CliLogFile)` and compiles as `CliLogFile` with zero caller diagnostics. A read-only probe supplied `LOG_PATH=/logs/a.ndjson`, a stub filesystem, and the Path service. Building and using the logger returned a defect, `TypeError: undefined is not an object (evaluating 'path.length')`, in both the port and pinned oracle; the stub received zero writes. Sol-3-4 encoded and decoded { path: "/explicit.ndjson", envVar: "LOG_PATH" } to the envVar-only member; with LOG_PATH=/environment.ndjson, the original writes /explicit.ndjson but the round-tripped configuration writes /environment.ndjson. Both defects share branch ownership and precedence as their root cause.
- failure: A valid environment-variable configuration selects the path branch solely because `path` exists. `Path.resolve(undefined)` then kills logger construction instead of resolving the configured environment path.
- fix: Put the named path member first in CliLogFile and select it with its schema-derived guard. Otherwise resolve envVar. Preserve explicit-path precedence when both strings are valid. Add layer tests for path: undefined plus a valid envVar, and codec/runtime fidelity tests for two valid keys.
- seats: part-1/sol-3-2, part-1/sol-3-4, part-1/grok-3-2, part-1/fable-3-2
- group: g2

### cli-r3-3 — A valid argument fallback with an invalid flag sibling dies instead of failing MissingArgument.

- file: scratchpad/effected/cli/internal/fallbackAnswer.ts:40; scratchpad/effected/cli/CliPrompt.ts:134
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `CliPromptTarget` and the documented noninteractive missing-parameter behavior.
- evidence: `{ argument: "project", flag: undefined }` passes `S.is(CliPromptTarget)` and compiles as `CliPromptTarget` with zero caller diagnostics. Running `CliPrompt.fallback(Prompt.succeed("unused"), target)` with the default noninteractive reference returned `Failure(Die(Error: Schema validation failed))` in both the port and pinned oracle. The delegated `answerWithoutPerson` selects `MissingOption` using `"flag" in target` and constructs it with `option: undefined`.
- failure: A valid positional-argument target becomes a defect instead of the typed `MissingArgument("project")` usage error. Under failure reporting, it consequently follows the defect path rather than the expected missing-parameter path.
- fix: Select the valid flag member with a schema-derived guard in internal/fallbackAnswer.ts, otherwise construct MissingArgument. Reuse the target member schema or a local named structural member without creating a CliPrompt/CliUi import cycle. Keep otherwise handling and valid flag precedence. Add the public fallback regression.
- seats: part-1/sol-3-3, part-1/grok-3-3
- group: g3

### cli-r3-4 — Logger construction swallows platform self-interruption and executes the program.

- file: scratchpad/effected/cli/CliRuntime.ts:631
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-30, precise recovery; EFFECTED_PORT_GOAL.md D11 and §14’s verified-upstream-bug exception.
- evidence: A read-only probe supplied a platform layer whose first build self-interrupted and whose next build returned test Stdio and Terminal services. `CliRuntime.main` ran with `env.log: { format: "json", level: "None" }`. Both the port and pinned oracle returned `{ builds: 2, executed: 1, exit: "Success" }`. The unconditional logger-build `Layer.catchCause` recovered the first interruption. The recorded round-2 interruption correction concerns `inkChalk`, not this runtime fallback.
- failure: A platform interruption becomes a logger fallback. `main` rebuilds the platform, executes the program, and can report success after initialization explicitly interrupted.
- fix: Propagate logger-build causes containing interruption; fall back to the plain logger only for noninterrupt causes. Add the self-interrupting-platform regression, retaining noninterrupt fallback behavior.
- seats: part-1/sol-3-5
- group: g4

### cli-r3-5 — Runtime marker installation on immutable errors loses the original failure and chosen exit code.

- file: scratchpad/effected/cli/CliRuntime.ts:751
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `reportFailures`’ documented guarantee to render and re-fail with runtime marks preserving the chosen exit code.
- evidence: A read-only probe ran `Effect.fail(Object.freeze(new Error("original")))` through `reportFailures({ exitCode: 23 })` with a capturing logger. Both the port and pinned oracle emitted one diagnostic, then returned `Die(TypeError: Attempting to define property on object that is not extensible.)`; `Runtime.getErrorExitCode(Cause.squash(exit.cause))` returned `1`. Round-2 cli-r2-3 fixed throwing string conversion, not marker installation on immutable errors.
- failure: Successfully reporting an immutable error creates a secondary, unmarked defect while installing the runtime markers. The requested exit code is lost, and the platform runtime can report the secondary defect again.
- fix: Capture marker-installation failure and return a fresh marked error retaining the original failure as cause and the selected exit code. Retain in-place marking when it succeeds. Account for wrappers in the public reported signature and reportFailures channels, and replace yield* reported(...) with an explicitly typed failure where widening requires it. Add immutable-error exit-code/reporting regressions.
- seats: part-1/sol-3-6
- group: g4

### cli-r3-6 — reported advertises subtype fields that its structural-Error wrapper discards.

- file: scratchpad/effected/cli/CliRuntime.ts:739
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; the generic overload’s returned type must describe the implementation’s result.
- evidence: An in-memory TypeScript caller passed `{ name: "Error", message: "boom", _tag: "RemoteError", code: 42 }` to `CliRuntime.reported` and assigned `marked.code` to `number` and `marked._tag` to `string`, with zero caller diagnostics. A read-only runtime probe returned a different instance with `_tag: "CliRuntimeError"` and `code: undefined`. The pinned oracle likewise strips `code`. The prose at lines 720–725 acknowledges structural Error lookalikes, but neither that prose nor the recorded deviations makes the overload sound.
- failure: A valid structural `E extends Error` caller receives a wrapper typed as its original subtype. Code can typecheck against properties and methods that the returned object does not have; tagged recovery can also dispatch on a different tag than the advertised subtype.
- fix: Widen the generic reported overload to E | Error (or an equally sound fallback union). Adjust internal failure paths and typed recovery tests to narrow wrappers explicitly. Preserve runtime wrapping and valid in-place marking. Add a structural Error lookalike regression with code and _tag, and a compile-time assertion that stripped subtype members require narrowing.
- seats: part-1/sol-3-7
- group: g4

### cli-r3-7 — AudienceFlagInput and CliAudienceFlagsOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliAudience.ts:52,70
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: AudienceFlagInput and CliAudienceFlagsOptions are handwritten declarations in CliAudience.ts:52,70, containing audience arrays and hidden flag. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: AudienceFlagInput and CliAudienceFlagsOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for AudienceFlagInput and CliAudienceFlagsOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g5

### cli-r3-8 — CliLinksOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliLinks.ts:86
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: CliLinksOptions are handwritten declarations in CliLinks.ts:86, containing editorLinks, envVar and cwd. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: CliLinksOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for CliLinksOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g1

### cli-r3-9 — CliEnvTestOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliEnv.ts:129
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: CliEnvTestOptions are handwritten declarations in CliEnv.ts:129, containing tty, term, audience, columns, color and theme. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: CliEnvTestOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for CliEnvTestOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g5

### cli-r3-10 — CliThemeOptions and CliThemeTestOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliTheme.ts:84,98
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: CliThemeOptions and CliThemeTestOptions are handwritten declarations in CliTheme.ts:84,98, containing token overrides, glyphs and color levels. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: CliThemeOptions and CliThemeTestOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for CliThemeOptions and CliThemeTestOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g5

### cli-r3-11 — CliMessageOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliMessage.ts:17
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: CliMessageOptions are handwritten declarations in CliMessage.ts:17, containing the stdout/stderr stream choice. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: CliMessageOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for CliMessageOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g5

### cli-r3-12 — CliLogStatusOptions remain erased pure-data models.

- file: scratchpad/effected/cli/CliLog.ts:45
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.
- evidence: CliLogStatusOptions are handwritten declarations in CliLog.ts:45, containing severity and numeric/string indent. No executable production schema owns these shapes. The green syntax gates miss semantic schema ownership; no service methods or type-level transforms prevent these payloads from being modeled.
- failure: CliLogStatusOptions have no canonical schema from which types, validation, metadata or generated data derive.
- fix: Define identity-annotated structural schemas for CliLogStatusOptions and derive the same-name types, composing existing domain schemas. Preserve optional keys, explicit undefined compatibility and plain constructor behavior; do not introduce decoding into the runtime path. Add focused production-schema tests in the owning group. Direct-file value exports suffice; preserve existing type exports.
- seats: part-1/sol-3-8
- group: g2

### cli-r3-13 — An unprintable filesystem defect kills the logging drain and scope finalizer.

- file: scratchpad/effected/cli/internal/fileSink.ts:80
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14’s verified-upstream-bug exception; `makeFileSink`’s documented contract that a filesystem defect prints one warning and disables file logging.
- evidence: A read-only `bun --no-cache -e` probe provided `FileSystem.makeNoop` with an in-memory `writeFileString` implementation returning `Effect.die({ toString() { throw new Error("conversion exploded"); } })`. Both the reviewed port and pinned oracle performed one attempted append, captured no stderr warning, and returned `Exit.Failure` from scope closure. The port’s resulting cause points to `String(error)` at line 80. A `"disk gone"` control produced the documented warning and `Exit.Success`. No actual filesystem writes occurred.
- failure: Formatting the filesystem failure can itself throw. That secondary defect terminates the drain, suppresses the promised warning, and propagates through the finalizer’s `Fiber.join`, causing an otherwise successful enclosing scope to fail because diagnostics logging failed.
- fix: Capture the entire error-description operation, including message access and coercion, with Result.try and a stable fallback. Continue the existing one-warning disabled-drain path. Add throwing toString and message-getter regressions that assert successful scope closure.
- seats: part-2/sol-3-1, part-2/fable-3-3
- group: g2

### cli-r3-14 — Custom ellipsis markers can increase the assembled grapheme width past the requested limit.

- file: scratchpad/effected/cli/Fmt.ts:164
- class: bug   severity: required
- standard: D9, D11 and §14’s verified-upstream-bug exception; `Fmt.truncate` documents that its result is never wider than the requested width, including a custom ellipsis.
- evidence: Read-only probes against both the reviewed port and pinned oracle returned `Fmt.truncate("♥abc", 1, { ellipsis: "\uFE0F" }) === "♥️"`, whose `Fmt.width` is **2**. Likewise, truncating `"123"` to width 1 with `ellipsis: "\uFE0F\u20E3"` returned `"1️⃣"`, also width **2**. The ordinary `"hello"` / width 3 / `"…"` control returned `"he…"` at width 3. `truncateSpans([{ text: "♥abc" }], 1, "\uFE0F")` also returned a two-column result through `internal/layout.ts:233`.
- failure: The prefix and marker are measured separately, but concatenating them can change the final grapheme’s presentation and width. A zero-width variation selector or keycap suffix converts a retained one-column character into a two-column emoji, breaking the truncation guarantee and overflowing the layout.
- fix: Measure the assembled retained prefix plus marker, removing whole retained graphemes until it fits; apply the same boundary handling to truncateSpans while preserving span attributes. Retain the existing overwide-marker policy. Add variation-selector and keycap-marker regressions for Fmt and layout.
- seats: part-2/sol-3-2
- group: g1

### cli-r3-15 — KeyInput has no executable production schema.

- file: scratchpad/effected/cli/TestTerminal.ts:16
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: At the reviewed commit, `KeyInput` is a handwritten interface containing a string key name and three optional boolean modifiers. It is the public input payload consumed by `TestTerminalHandle.input` and translated into queued `Terminal.UserInput` values at lines 194–204. `TestTerminal.ts` has no executable schema for this payload. It is pure data, independently representable by a structural schema; the handle’s Layer and Effect members do not prevent modeling the key payload. The green syntax and coverage gates do not establish semantic schema ownership.
- failure: The public key-event model has no schema source of truth for its type, metadata, validation, codecs or schema-derived arbitrary, contrary to the binding pure-data modeling requirement.
- fix: Define an identity-annotated KeyInput structural schema and derive its same-name type. Preserve arbitrary string names, optional modifiers, explicit undefined and queue conversion without adding decoding to input. Re-export the value from testing.ts. Add focused codec tests derived from the production schema.
- seats: part-2/sol-3-3
- group: g6

### cli-r3-16 — The shared Span rendering payload has no executable production schema.

- file: scratchpad/effected/cli/internal/layout.ts:24
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-12b and EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: `Span` remains a handwritten plain-data interface for text, token/style, link and rendering flags. It is returned by `flatten`, transformed by truncation and wrapping, and consumed by painting and the renderers. Its constituent domains already have executable schemas in `Token.ts` and `Doc.ts`, but `layout.ts` defines no schema owning their composition. This is a named, reused intermediate rendering model, rather than a service contract or type-level utility. Prior findings concerning document AST ownership and cross-span grapheme handling do not supply a `Span` schema.
- failure: The shared layout payload remains outside the required executable modeling contract. Its shape, optionality, metadata and generated test data cannot be derived from a canonical production schema.
- fix: Define an identity-annotated structural Span schema using TokenName, Style and LinkTarget, and derive its type. Preserve optional keys, literal-true flags, plain construction and shared link identity; do not decode in layout operations. Add focused production-schema codec tests.
- seats: part-2/sol-3-4
- group: g1

### cli-r3-17 — Style field annotations repeat names without explaining their contracts.

- file: scratchpad/effected/cli/Token.ts:82
- class: schema   severity: required
- standard: D5 and D11; `standards/effect-first-development.md` EF-12 explicitly requires meaningful annotation metadata and says descriptions must encode intent rather than repeat the symbol name.
- evidence: All five `Style` field descriptions use the form `"The <field> field of Style."` at lines 82–92. A read-only AST probe confirmed that `Style.fields.fg.ast.annotations.description` is `"The fg field of Style."` and the bold field’s description is `"The bold field of Style."`. The retained field JSDoc already explains foreground colors and text attributes, but those semantics are absent from the schema annotations. The green gates establish metadata presence, not compliance with this semantic requirement.
- failure: Schema consumers receive descriptions that merely restate field names. The foreground annotation omits the named-color/hex contract and deliberate malformed-hex compatibility; the boolean annotations omit the terminal attribute each field enables.
- fix: Replace the five placeholder Style field descriptions with their existing foreground/color and terminal-attribute semantics. Keep identities, field types and rendering unchanged. Assert meaningful annotation text in the Token test surface.
- seats: part-2/sol-3-5
- group: g7

### cli-r3-18 — Document layout still treats span boundaries as grapheme boundaries.

- file: scratchpad/effected/cli/internal/layout.ts:154
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14 verified upstream-bug. Unfixed cli-r2-10 (round-2 inventory; required.json group g4). Not in scratchpad/effected/cli/README.md Deviations.
- evidence: `cellsOf` (line 154) runs `graphemes` on each span alone, and `widthOf` (line 144) sums those widths. The pinned oracle `packages/cli/src/internal/layout.ts:102-119` does the same and calls it deliberate. `scratchpad/test/cli/layout.test.ts:227-241` asserts the split: a regional-indicator flag and a ZWJ sequence measure as the sum of their pieces. Round-2 evidence, still true of this commit: `Doc.text("👩")`, `Doc.text("\u200d")`, `Doc.text("💻")` is width 4 and truncates or wraps as a broken joiner sequence, while one `Doc.text("👩‍💻")` is width 2. Current layout.ts:144 still sums displayWidth per span and :154 still segments each span independently. This is the unclosed cli-r2-10 implementation, not a duplicate of a repaired finding.
- failure: A span boundary is a grapheme boundary. A two-column emoji that fits is truncated or split across lines, so the displayed cluster changes.
- fix: Segment and measure concatenated visible text across adjacent spans. Track offsets so each grapheme is atomic while retaining style and link fragments. Retarget layout.test.ts:227-241 and add split-versus-joined emoji/combining-sequence regressions.
- seats: part-2/fable-3-1
- group: g1

### cli-r3-19 — Adjacent Markdown code nodes inject backticks into their displayed content.

- file: scratchpad/effected/cli/internal/renderMarkdown.ts:146
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified-upstream-bug exception; `Render.markdown`’s inline-code fidelity contract.
- evidence: A read-only `bun --no-cache -e` probe rendered `Doc.paragraph(Doc.code("a"), Doc.code("b"))` through both the reviewed port and the pinned oracle, then parsed each result with the pinned upstream Markdown parser. Both emitted `` `a``b` ``; both parsed as one `inlineCode` node whose value was `"a``b"`, rather than the original visible text `"ab"`.
- failure: Independently fencing adjacent code spans merges their closing and opening backticks into content. A reader sees two additional backticks, changing the code being displayed.
- fix: Fence concatenated consecutive compatible code spans as one code run, preserving link/emphasis boundaries. Add parser-backed regressions for adjacent code nodes and differing internal backtick runs.
- seats: part-3/sol-3-1
- group: g1

### cli-r3-20 — Splitting URL-like plain text across spans bypasses Markdown autolink escaping.

- file: scratchpad/effected/cli/internal/renderMarkdown.ts:146
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14; `escapeText`’s documented guarantee that URL-looking text cannot become a GFM autolink.
- evidence: Read-only probes against the port and pinned oracle rendered `Doc.paragraph("https", "://example.test")` as `"https://example.test"` and `Doc.paragraph(Doc.text("www"), Doc.text(".example.test"))` as `"www.example.test"`. The pinned upstream Markdown parser produced `link` nodes for both. The equivalent unsplit text passes through the intended autolink escaping.
- failure: Autolink detection operates independently on each span, so a scheme or `www.` prefix split across text nodes bypasses escaping. Plain document text becomes a clickable link depending on how callers partition it into nodes.
- fix: Apply contextual escaping to concatenated compatible non-code text runs while preserving explicit links and formatting boundaries. Add parser-backed split-versus-unsplit URL-prefix regressions.
- seats: part-3/sol-3-2
- group: g1

### cli-r3-21 — Describing a failed live callback can throw again and discard subsequent runs.

- file: scratchpad/effected/cli/ui/CliUiLive.ts:325
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14; `CliUi.live` documents that a failed drawing/final callback degrades its run, warns once, and allows the fold to continue.
- evidence: A read-only probe supplied two non-interactive runs with a `final` callback that first threw `{ toString() { throw "warning conversion failed"; } }` and would return a document on its second call. Both the port and pinned oracle returned a failed `done` with `"warning conversion failed"`, stopped at state `2` instead of `4`, invoked `final` once, emitted zero warnings, and printed nothing.
- failure: `DEGRADED` performs an unguarded string conversion while recovering the original callback failure. That secondary exception kills the controller and discards subsequent runs instead of degrading only the failed run.
- fix: Capture the full DEGRADED error-description operation, including message access, with Result.try and use a fixed fallback on failure. Add the two-run regression proving continued folding, one warning and the second run output.
- seats: part-3/sol-3-3
- group: g9

### cli-r3-22 — Confirm, Select and MultiSelect overflow their single-row budgets during immediate resize repaint.

- file: scratchpad/effected/cli/ui/KeyHelp.ts:98; scratchpad/effected/cli/ui/Confirm.ts:446,451,479; scratchpad/effected/cli/ui/Select.ts:431,437,444; scratchpad/effected/cli/ui/MultiSelect.ts:440,442,445
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D11 and §14; `KeyHelp` promises a one-line footer, `Select.View` promises a one-line detail, and `UiTheme.useTerminalSize` documents the need for layout-time clipping during immediate Ink resize repaints.
- evidence: Read-only production-path `CliUiTest.session` probes resized from 80 to 20 columns. Confirm produced an intermediate 8-row frame before settling to 3 rows; Select produced 12 rows before settling to 4; MultiSelect produced 15 rows before settling to 5. Long questions and details wrapped into four physical rows, and the footer wrapped into three to five rows. The pinned oracle retains the same unclipped footer, question and detail constructions. These are additional sites beyond round 2’s repaired TextInput, Toggle and Tabs.
- failure: The footer and surrounding widget text use the previous hook width during Ink’s immediate resize repaint. They exceed the widgets’ reserved row budgets and can push the frame into scrollback before React supplies the new width. Other affected sites are `Confirm.ts:449`, `Select.ts:434,442`, and `MultiSelect.ts:440,444`.
- fix: Clip KeyHelp and intended single-row message/detail elements with layout-time Text truncation or height: 1 overflow-hidden wrappers, and clip Confirm's answer row. Reserve the cursor column through layout. Extend widget-resize.test.ts with long Confirm/Select/MultiSelect content and assert every intermediate frame for 80-to-20 and 80-to-10 resizes.
- seats: part-3/sol-3-4, part-3/fable-3-1
- group: g8

### cli-r3-23 — Table width allocation performs quadratic work for short-header columns.

- file: scratchpad/effected/cli/internal/renderDoc.ts:197
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11’s algorithmic-class criterion.
- evidence: `shrink` recomputes the total and scans all columns to remove exactly one cell on each iteration. For `C` columns initially two cells wide and a narrow limit, it performs `C` decrements, each costing Θ(C), despite Θ(C) input and output. A read-only probe evaluated the actual helper extracted from the reviewed commit and counted numeric array reads: 329, 1,259, 4,919 and 19,439 for 10, 20, 40 and 80 columns respectively.
- failure: Width allocation alone takes Θ(C²) work for a table with short headers and no body rows. Doubling the column count approximately quadruples the work before any cells are rendered.
- fix: Batch widest-column reductions using sorted width levels or equivalent O(C log C) allocation. Preserve the exact leftmost tie rule and handling of zero/one-cell columns. Add operation-count and output-equivalence regressions.
- seats: part-3/sol-3-5
- group: g1

### cli-r3-24 — Confirm, Select and MultiSelect reducer-state families lack schema ownership.

- file: scratchpad/effected/cli/ui/Confirm.ts:98; scratchpad/effected/cli/ui/Select.ts:69; scratchpad/effected/cli/ui/MultiSelect.ts:95
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33.
- evidence: `ConfirmState<K>`, `SelectState<A>` at `Select.ts:69`, and `MultiSelectState<A>` at `MultiSelect.ts:95` remain handwritten pure-data interfaces. Their constituent toggle, choice and section/item payloads also remain handwritten. These are concrete reducer inputs and outputs, with booleans, collections, viewport data and parameterized values—not service contracts or overload machinery. Round 2 supplied schemas for actions, ViewportState and TextInputState, but did not supply schemas for these three state families.
- failure: The production reducer-state contracts still have no executable source of truth for validation, codecs, equivalence, metadata or schema-derived generation. Their generic parameters do not prevent schema composition through factories accepting key/value schemas.
- fix: Define annotated structural schema factories for the three state families and constituent toggle/choice/item/section payloads, parameterized by key/value schemas. Reuse ViewportState and S.HashSet, derive the public types and expose added values consistently in ui.ts. Preserve plain reducers, optional fields and input behavior. Add production-schema tests.
- seats: part-3/sol-3-6
- group: g8

### cli-r3-25 — Binding, KeyHelpRow and UseKeysOptions are modeled only by erased declarations and a test-only schema.

- file: scratchpad/effected/cli/ui/KeyTable.ts:19
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: `Binding<Action>`, `KeyHelpRow` at line 57, and `UseKeysOptions` at line 87 are handwritten data/configuration models without production schemas. `scratchpad/test/cli/ui/KeyTable.property.test.ts:14` separately defines `BindingInput` with the same keys/action/help/hidden fields and uses that test-only schema for serialization and generation. This demonstrates that the binding shape is schema-representable while its executable definition lives outside production.
- failure: Binding data has parallel TypeScript and test-schema owners. Changing the production fields or optionality need not update the codec/property contract, and production help/configuration payloads lack the required schema metadata and derived tooling.
- fix: Define an annotated Binding factory parameterized by the action schema, composing the existing key domain, plus structural KeyHelpRow and UseKeysOptions schemas. Derive types, expose values in ui.ts and make KeyTable.property.test.ts use the production Binding factory. Preserve KeyTable behavior, binding priority, normalization and optionality.
- seats: part-3/sol-3-7
- group: g8

### cli-r3-26 — AudienceFlagValues and AudienceTally remain erased shared payloads.

- file: scratchpad/effected/cli/internal/scanAudience.ts:12
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-12b and EF-33.
- evidence: AudienceFlagValues at line 12 and AudienceTally at line 25 are named, exported pure-data interfaces containing arrays of AudienceKind/boolean and a boolean result. `tallyAudience` constructs the result as a plain object. AudienceKind already has an executable schema, but neither containing payload has one. The recorded audience changes cover the literal domain and flag vocabulary, not these payload models.
- failure: The shared pre-parse and parsed-flag tally contract remains erased, so its shape, annotations, codecs and generated test data cannot derive from the production model.
- fix: Define identity-annotated structural AudienceFlagValues and AudienceTally schemas composing AudienceKind, and derive their types. Preserve plain results and exact tally behavior. Add focused production-schema tests.
- seats: part-3/sol-3-8
- group: g5

### cli-r3-27 — Markdown renderer Mode remains an erased named runtime literal domain.

- file: scratchpad/effected/cli/internal/renderMarkdown.ts:17
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12b.
- evidence: Mode is the named, reused literal domain `"flow" | "cell" | "line"`, consumed by `codeSpan`, `textPiece`, `emphasized` and `inlineMd`, including runtime case selection. It has no LiteralKit or annotation-bearing schema value. This declaration survives the green mechanical gates; those gates have not established ownership of this named runtime domain.
- failure: The renderer’s mode vocabulary remains an erased declaration rather than the required executable source of truth for its type, literals, guard and metadata.
- fix: Define an annotated module-local Mode LiteralKit for flow, cell and line, derive the type, and preserve all branch behavior.
- seats: part-3/sol-3-9
- group: g1

### cli-r3-28 — S3 replaced the upstream empty-on-None subscription check without a law or diagnostic forcing it.

- file: scratchpad/effected/cli/ui/CliUiLive.ts:859
- class: law   severity: required
- standard: D9 and the operator's 2026-10-09 later grilling ruling: restore unforced lab changes and rewritten upstream tests.
- evidence: git log --format=%h:%s -- scratchpad/effected/cli/ui/CliUiLive.ts names 7929b1f529 (port progress), 2f515ae251 (S3) and 9b55a0137c (round 2). The pre-S3 7929b1f529 source retains getOrElse. git show 2f515ae251 -- this file explicitly replaces getOrElse(..., () => 0) with remainingUnsafe/getOrThrow; its message attributes simplifications to unreachable-branch coverage. The round-2 diff only annotates/exports LiveTickError. Neither the step-2/law-bearing port version nor the later diff forces this replacement. The pinned oracle has the fallback. Upstream final-message assertions remain in CliUi.live.close.test.ts:192,216,231.
- failure: The lab introduces a throwing None contract where upstream supplies zero, without an allowed cause. The seat's shutdown-between-take-and-read race is not independently proven here; the required restoration rests on commit provenance and the operator ruling.
- fix: Restore O.getOrElse(PubSub.remainingUnsafe(sub), () => 0) === 0, preserving the surrounding final-message logic. Restore any upstream assertion weakened specifically for this replacement, retaining mechanical canon/import adaptations; no such rewritten assertion was found in the S3 diff. Keep the original shutdown and final-message cases in CliUi.live.close.test.ts. Add a focused None fallback regression without depending on an unproven scheduler race.
- seats: part-3/fable-3-2
- group: g9

### cli-r3-29 — Editing input after Enter in one chunk cancels TextInput submission.

- file: scratchpad/effected/cli/ui/TextInput.ts:176
- class: bug   severity: required
- standard: D9, D11 and §14; `TextInput.View` documents that a return submits the preceding text and drops input after submission (`TextInput.ts:350–353`).
- evidence: A read-only `bun --no-cache -e` probe mounted `TextInput.screen({ message: "Name", initial: "ac" })`, then called `handle.chunk("enter", "left")`. The frame became `a▏c`, and awaiting `handle.result` with a 100 ms timeout returned `Failure(Cause([Fail(TimeoutError: Operation timed out after '100ms')]))`. The pure reducer confirms the transition: Enter followed by Left produces `{ value: "ac", cursor: 1, submitted: false }`. The pinned oracle reproduced the same frame and timeout; its source was loaded with Ink/React peer import paths redirected in memory to the installed dependencies. Existing chunk tests cover printable text after a return, but not a subsequent escape-delimited arrow key. Round-2 `cli-r2-16` fixed Confirm, Select and MultiSelect; it did not cover TextInput.
- failure: Ink dispatches both keys before React commits. Left resets `submitted` to false, so the submission effect never observes Enter and the prompt remains waiting. Other editing actions after Enter can similarly cancel submission or change the text awaiting validation.
- fix: Return the existing state from step when submitted is already true. Retain the validation-failure reset that re-enables editing. Add Enter-then-arrow and rejected-validation-then-edit regressions.
- seats: part-4/sol-3-1, part-4/grok-3-1
- group: g10

### cli-r3-30 — TextInput scrolling splits multi-code-point graphemes.

- file: scratchpad/effected/cli/ui/TextInput.ts:199
- class: bug   severity: required
- standard: D9, D11 and §14; the input edits and masks by grapheme, and `windowAround` promises to keep the cursor and surrounding text within the available display cells (`TextInput.ts:226–247`).
- evidence: A read-only mounted probe used initial value `"👩‍💻👩‍💻👩‍💻"` with `{ columns: 6, color: "none" }`. Its value row was `"…‍💻▏"`; after Home, it was `"▏👩‍…"`. Both contain fragments of the joined emoji rather than complete graphemes. The pinned oracle reproduced `"…‍💻▏"` with the same installed Ink/React peers. `tail` at line 200 and `head` at line 217 iterate code points and measure them individually, although each complete `👩‍💻` occupies two cells. The coverage test titled “wide graphemes are cut whole” exercises CJK characters only.
- failure: Horizontal scrolling splits emoji and other grapheme clusters. A developer emoji becomes a standalone laptop or woman with a dangling joiner, and summing individual code-point widths discards text that could fit as complete graphemes. This is separate from round-2’s document-span layout finding.
- fix: Walk the shared graphemes(text) result in head and tail, measuring and retaining whole clusters with Fmt.width. Add prefix/suffix window tests for joined emoji and regional-indicator flags; preserve submitted raw text.
- seats: part-4/sol-3-2, part-4/grok-3-2
- group: g10

### cli-r3-31 — An ended screen handle can resize the currently mounted screen.

- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:744
- class: bug   severity: required
- standard: D9, D11 and §14; `CliUiTest.view` explicitly promises that resize after a deliberate end dies with the ended-screen error (`CliUiTest.ts:979–983`). The neighboring `send` implementation enforces the same screen ownership boundary at line 717.
- evidence: A read-only probe ran two TextInput screens in one session, submitted the first, and obtained the second with `session.next()`. Calling `first.resize(10, 24)` then returned `Exit.Success(undefined)` and changed the second screen’s value row from `"abcdefghijklmnopqrstuv▏"` to `"…pqrstuv▏"`. The pinned oracle reproduced both the successful stale resize and the changed second frame. The resize closure calls `fake.resize` without checking `ended()`, while session handles share those terminal streams. Existing ended-screen tests exercise press, type and chunk.
- failure: A handle belonging to an ended screen can resize the currently mounted screen. Tests that have lost track of their screen receive a successful operation and silently affect a later screen instead of the promised defect.
- fix: Check ended() inside resize's suspension before fake.resize and return the existing SCREEN_ENDED defect when true. Keep surfaced outside so recorded crashes retain precedence. Add a two-screen regression requiring stale resize failure and an unchanged second frame.
- seats: part-4/sol-3-3, part-4/grok-3-3
- group: g10

### cli-r3-32 — Shrinking uncontrolled tabs leaves the active window centered beyond the remaining list.

- file: scratchpad/effected/cli/ui/Tabs.ts:245
- class: bug   severity: required
- standard: D9, D11 and §14; `Tabs.View` describes an active tab and an overflow window containing the tabs that fit around it (`Tabs.ts:211–220`).
- evidence: A read-only probe mounted uncontrolled tabs Alpha/Beta with `defaultValue: "b"` at `{ columns: 5, color: "none" }`, then rerendered the same component with only `{ name: "a", label: "Long alpha" }`. The resulting frame was exactly `"…"`. Pressing Right subsequently produced `"[L…]"`. The pinned oracle reproduced both outputs. The uncontrolled `own` index remains 1 after the list shrinks to length 1; `fitAround` consequently starts outside the labels array. `Tabs.coverage.test.ts:40` exercises this case but only asserts that the removed Beta label disappears, accepting the empty selected position.
- failure: Shrinking a nonempty uncontrolled tab list can remove every visible tab label and active marker until another navigation key arrives. The overflow window is centered on an index that no longer names a tab.
- fix: Clamp the effective uncontrolled index to the current tab range before navigation refs and fitAround. Preserve empty-list behavior. Strengthen the shrinking-list test to require the remaining active marker and visible label immediately after rerender.
- seats: part-4/sol-3-4, part-4/grok-3-4
- group: g10

## Backlog

### cli-b3-1 — EditorLinks lacks a production-schema round-trip property.

- file: scratchpad/effected/cli/CliLinks.ts:44
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10’s per-exported-schema round-trip property requirement; D11’s law-violation criterion.
- evidence: `EditorLinks` is now an exported runtime schema. An exhaustive `rg -n 'EditorLinks' scratchpad/test/cli` finds only type imports and option annotations in the existing link tests. No test encodes or decodes `EditorLinks`, and no property uses `Arbitrary.schema(EditorLinks)`. The nearest property, `CliLinks.property.test.ts:40`, constructs a separate `S.Literals(["file", "vscode", "off"])`, excludes `"auto"`, and tests environment parsing rather than the production schema’s codec. Thus the green suite does not establish D10 for this added schema.
- failure: The required schema-derived round-trip proof is absent for `EditorLinks`; changes to its codec or complete vocabulary are outside the purported property floor.
- fix: Add an `fcRuns`-bounded property generated from `Arbitrary.schema(EditorLinks)` that encodes, decodes, and re-encodes every generated value, asserting value and encoded-form fidelity. Keep the environment-parser property as a separate behavior test.
- seats: part-1/sol-3-9
- reason: Coverage/property-floor work belongs to deferred S3 under the merge instruction.

### cli-b3-2 — Doc and Block prose denies their executable codec contract.

- file: scratchpad/effected/cli/Doc.ts:531
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D11. Unfixed cli-b2-1. Docgen checks example execution, not this prose.
- evidence: Line 531 says "Nodes are plain data and nothing decodes them". Line 835 says "nothing decodes or encodes one" and that a document is not meant to be serialised. `Doc.coverage.test.ts:24` and `:68` encode and decode `Block`. `Doc.property.test.ts:49` round-trips `AnnotationOptions`. The example at lines 533-539 is `S.is(Block)(Doc.paragraph("Ready"))`.
- failure: The public `Block` and `Doc` contracts say documents are neither decoded nor encoded, while those schemas and tests do both. A later edit can drop the codecs on that instruction.
- fix: Rewrite both sentences so constructors still return plain objects and do not decode, and the schemas remain the decode and encode contract. Leave `overflow` and `total` as function fields.
- seats: part-2/fable-3-4
- reason: Docs/JSDoc belong to deferred S2 under the merge instruction; retain existing backlog cli-b2-1.

## Handled by the deviation codemod

None as standalone findings. The seats' recording clauses attached to accepted behavioral or schema fixes remain centralized per-module/per-class bookkeeping. The codemod owns identity-key changes, finite-number schemas, tagged-error changes, native-runtime replacements and added-export inventory; those clauses are not counted as additional required findings and are omitted from the dispatch write surfaces. No report consists solely of a request to record such a forced change. A change's incorrect implementation remains required above.

## Rejected

None as whole findings. The fileSink finding retains Sol's actual throwing-coercion probe, rather than Fable's incorrect claim that String(Symbol()) throws. The PubSub finding uses the verified unforced S3 change, rather than treating its proposed scheduling race as proven. These corrections preserve supported defects without creating additional disposition records.


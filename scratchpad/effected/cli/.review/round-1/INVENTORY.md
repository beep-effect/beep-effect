# CLI round-1 merged inventory

Read: all 12 seat reports and 4 adjacent briefs in part-1..part-4; all 90 seat findings accounted for.
Required: **34**; Backlog: **18**; Handled by the deviation codemod: **6**; Rejected: **2**; Groups: **13**.
Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; pinned oracle revision: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Seat ids include their part to disambiguate repeated ids. Counts are deduplicated records;
bundled findings are split where their subclaims need different dispositions. The complete
operator revision/rulings, D1-D20, section 12.5 and section 14 bind this merge. All ten revoked
CLI allowlist entries are required. Docs/JSDoc, coverage and vitest canon remain S2/S3 backlog.

Forced-change attribution uses per-file git logs and diffs from `6f2154defb`, `2688563f71`,
`f7e0ee8d10`, `03bf79d41b`, `f9aee5bcb2`; no genuinely unforced rewrite was established.
Probe outputs below are attributed seat evidence. This merge ran no gate or scratch-copy
compiler check; the law commit records environmental test failures despite the briefs' green claim.

Dispatch owns only required.json group files/tests, including reserved new regression files
in g5/g11. No source or test overlaps groups; each group owns at most six source files.
Primary files in JSON are dispatch keys; groups also own every additional required fix file.
Ledger, README Port notes, exportsAdded and per-class deviation bookkeeping stay central;
verified upstream-bug entries must be registered centrally before their implementation wave.
Shared-config work is backlog with reason "outside the port's write surface".

## Required

### cli-1 — The optional curried makeCliLogger overload promises a function but returns a logger for undefined.

- file: scratchpad/effected/cli/CliLogger.ts:132
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11 and D15; callable signatures must describe their runtime result.
- evidence: An in-memory TypeScript probe assigned `makeCliLogger` to `(underActions?: (fiber: Fiber.Fiber<unknown, unknown>) => boolean) => (options?: CliLoggerOptions) => Logger.Logger<unknown, void>` and called `curried()({})`, with **zero semantic diagnostics**. Executing that call threw `TypeError: … is not a function`; supplying an actual `underActions` function succeeded.
- failure: The new curried overload promises a function when its optional argument is omitted or `undefined`. The dispatch predicate at line 133 selects the data-first implementation for those values, returning a logger object instead. A caller can therefore typecheck without assertions and fail at runtime.
- fix: Require underActions in the curried overload; retain the data-first zero-argument constructor. Add a type/runtime regression for valid overload dispatch.
- seats: part-1/sol-1-1

### cli-2 — Inherited LEVELS properties are accepted as log levels.

- file: scratchpad/effected/cli/CliLog.ts:229
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `readLevel`’s documented invalid-value behavior.
- evidence: A read-only probe ran both the pinned upstream oracle and the port with `CliLog.layer({ format: "json", envVar: "TEST_LOG_LEVEL", plainLogger: false })`. For `constructor`, `CliLog.Level` was a **function**; for `__proto__`, it was an **object**. Both inputs emitted an error diagnostic and produced no invalid-level warning. The control input `invalid` returned `"None"`, warned once, and emitted no diagnostic.
- failure: Indexing the ordinary `LEVELS` object accepts inherited properties as log levels. These invalid environment values escape the declared `LogLevel` domain and enable diagnostics instead of taking the warning-and-`None` fallback. This is an upstream bug retained by the port and missed by the existing tests.
- fix: Normalize the key, require R.has(LEVELS, key), and use the existing warning-and-None fallback otherwise. Add constructor and __proto__ regressions; forward upstream-bug evidence to the central deviation codemod.
- seats: part-1/sol-1-2

### cli-3 — Incomplete schema and field annotations on introduced CLI errors.

- file: scratchpad/effected/cli/CliExit.ts:11; scratchpad/effected/cli/CliAudience.ts:19; scratchpad/effected/cli/CliRuntime.ts:47; scratchpad/effected/cli/Status.ts:12
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; EFFECTED_PORT_GOAL.md operator step 4, requiring identity and annotations on schemas and fields.
- evidence: `InvalidExitCodeError` supplies the composed identifier but omits the `$I.annote(...)` argument and leaves `message` unannotated. A read-only probe captured the defect from `CliExit.set(256)` and inspected its constructor: schema annotations contained only `identifier` and `~sentinels`; `message.ast.annotations` was absent. `AudienceConflictError` at `CliAudience.ts:19` has the same omission. `CliRuntimeError` has schema annotations, but its `message` field at `CliRuntime.ts:47` is also unannotated. The newly introduced `UnknownStatusError` supplies `$I` as the schema identifier, but omits the schema’s `$I.annote(...)` metadata entirely. Its `message: S.String` field is also unannotated. Step 4 explicitly requires annotations on fields and schemas; EF-12 requires meaningful canonical metadata on new schemas. Typechecking and the four syntax laws do not establish that metadata requirement.
- failure: These newly introduced schemas do not satisfy the completed identity/annotation step. Tooling inspecting their ASTs receives no domain title or description for the first two errors and no field description for any of the three message fields. This is schema metadata work from step 4, separate from deferred S2 JSDoc conversion.
- fix: Add meaningful identity-backed schema annotations to InvalidExitCodeError, AudienceConflictError and UnknownStatusError, and field descriptions to their message fields and CliRuntimeError.message. Preserve current tags, names and messages; verify metadata without changing deferred JSDoc.
- seats: part-1/sol-1-3, part-2/sol-1-3, part-2/fable-1-5

### cli-4 — ExitRequested uses Data.TaggedError instead of the required schema error base.

- file: scratchpad/effected/cli/internal/ExitRequested.ts:11; scratchpad/effected/cli/CliRuntime.ts:607
- class: law   severity: required
- standard: D5; `standards/effect-laws-v1.md` short law 7; `.patterns/error-handling.md` structured-error contract.
- evidence: `ExitRequested` extends `Data.TaggedError`, has no schema contract, and has no `$ScratchpadId` identity. The cited law specifically requires typed errors to extend `S.TaggedError` directly. This escapes the reported green gates: the installed `@effect/tsgo` 0.47.2 schema has no `preferSchemaTaggedError` rule, and the pinned `tsconfig.base.json` has no configuration entry for it. Replacing native `Error` with `Data.TaggedError` therefore clears the native-error checks without meeting this separate law. No exception is recorded for this error.
- failure: The private exit failure remains outside the required schema and identity contract: it cannot supply schema-derived decoding, encoding or canonical annotation metadata.
- fix: Use identity-annotated S.TaggedError with an annotated exit-code field (S.Finite as required), derive message and Runtime.errorExitCode, and preserve name ExitRequested and errorReported=false. Update CliRuntime and CliRuntime.test.ts construction to .make({ code }); keep exit behavior and send bookkeeping centrally.
- seats: part-2/sol-1-2, part-2/grok-1-2, part-2/fable-1-4

### cli-5 — The plain-data document AST has no executable schema source of truth.

- file: scratchpad/effected/cli/Doc.ts:53
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5, “Schemas Are Executable Contracts”; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-13.
- evidence: The document model’s `Inline` and `Block` variants are handwritten TypeScript unions, and supporting node payloads such as `LinkTarget`, `TreeNode`, `Column` and `Counter` are handwritten types or interfaces. `Doc.ts` contains no schema definitions. These are the module’s explicitly documented plain-data AST, consumed and matched by the renderers, rather than service contracts or type-level machinery. The green syntax gates can accept these declarations without checking that the schema owns the model.
- failure: The document’s runtime variants and payloads have no executable schema contract. Guards, codecs, equivalence and schema-derived arbitraries cannot be derived from the source of truth required by the binding standards.
- fix: Define identity-annotated structural and recursive schemas for Inline, Block, LinkTarget, TreeNode, Column and Counter; derive the existing types while preserving plain-object variants, callbacks and optional fields. Coordinate with allow-3: runtime freezing is dropped under the later ruling, and its assertions are retargeted rather than preserved.
- seats: part-2/sol-1-4

### cli-6 — NamedColor and TokenName are erased named literal domains.

- file: scratchpad/effected/cli/Token.ts:13
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b.
- evidence: part-2/sol-1-5 identifies NamedColor and TokenName at Token.ts:13 as named, reused string unions without LiteralKit values. Other domains in that bundled seat report are owned separately by cli-7 and cli-8.
- failure: The color and token domains are erased declarations without one annotation-bearing schema source of truth for types, enumeration and membership.
- fix: Define identity-annotated LiteralKit values for NamedColor and TokenName and derive the existing types; preserve literal order and membership. Coordinate with allow-7.
- seats: part-2/sol-1-5

### cli-7 — CoreStatusName is an erased named literal domain.

- file: scratchpad/effected/cli/Status.ts:40
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b.
- evidence: part-2/sol-1-5 identifies CoreStatusName at Status.ts:40 as a reused type-only literal domain. The four green mechanical laws do not enforce schema-first domain ownership.
- failure: The finite vocabularies remain erased or duplicated declarations instead of annotation-bearing runtime domains. Their types, runtime membership checks and enumerated values cannot be derived from one schema as required.
- fix: Define an identity-annotated CoreStatusName LiteralKit and derive its type, preserving order and the existing vocabulary behavior.
- seats: part-2/sol-1-5

### cli-8 — Span settings duplicate a finite domain and a manual membership check.

- file: scratchpad/effected/cli/internal/failureTarget.ts:257
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b.
- evidence: part-2/sol-1-5 identifies SPAN_SETTINGS and readSpans at failureTarget.ts:257 as a duplicate literal domain and manual membership check not enforced by the four green laws.
- failure: The finite vocabularies remain erased or duplicated declarations instead of annotation-bearing runtime domains. Their types, runtime membership checks and enumerated values cannot be derived from one schema as required.
- fix: Define an identity-annotated LiteralKit for app, all and off; derive the enumeration and guard. Preserve order, case normalization and the invalid-setting message.
- seats: part-2/sol-1-5

### cli-9 — TestTerminal counts rejected post-end input as read.

- file: scratchpad/effected/cli/TestTerminal.ts:87
- class: bug   severity: required
- standard: D9, D11, section 14 `upstream-bug`; `TestTerminalHandle.reads` explicitly counts keys **taken**, and says all-zero counters prove that input was untouched.
- evidence: A read-only Node probe ran `TestTerminal.make()`, then `terminal.end`, then `terminal.input([{ name: "enter" }])`, without subscribing to or reading input. It returned `{"reads":{"keys":1,"lines":0,"subscriptions":0},"pending":0}`. An assertion expecting zero reads failed. The same probe against the frozen upstream oracle returned the same incorrect result, establishing an inherited bug. `offered` increases before `Queue.offerAll`, and the returned unaccepted inputs are discarded.
- failure: Offering input after the terminal has ended makes the double report a key read that never occurred. Tests using `reads` to prove that a noninteractive path left stdin untouched can fail falsely.
- fix: Increase offered only by the number Queue.offerAll accepted, accounting for its returned unaccepted array. Add an end-then-offer-without-reader regression; forward verified upstream-bug bookkeeping centrally.
- seats: part-2/sol-1-1

### cli-10 — makeFileSink has the inner writer's append span name.

- file: scratchpad/effected/cli/internal/fileSink.ts:36
- class: effect-idiom   severity: required
- standard: EF-14: a named Effect.fn span matches the function name; D11 effect-idiom with a cited standard.
- evidence: `export const makeFileSink = Effect.fn("append")(function* (path, installed, underActions) ...` at :36 reuses the inner helper's name (`const append = Effect.fn("append")` at :44), so the outer span is labelled `append`. Upstream had `Effect.gen` with no span on either. `rg -n 'Effect\.fn\(' scratchpad/effected/cli/internal/fileSink.ts` -> 36:`Effect.fn("append")`, 44:`Effect.fn("append")`. git show 6f2154defb -- internal/fileSink.ts confirms both Effect.fn("append") wrappers were added during step 2; the diagnostic forces the helper, not an incorrect function name.
- failure: Any trace or failure trail that passes through the file-sink layer construction reports a span named `append` for `makeFileSink`: wrong telemetry, and a second span upstream never opened. The signature line is also a single 260-column line with the body left at the old indentation, so the file no longer reads as the rest of the module does.
- fix: Name the outer Effect.fn wrapper makeFileSink, leaving the inner append name intact. Verify constructor-versus-write telemetry. The forced introduction of tracing is handled separately by codemod-2; this finding corrects the misleading name, not all port-added spans.
- seats: part-2/fable-1-2, part-2/grok-1-3

### cli-11 — CliUi.lazy throws synchronously where the oracle returned a rejected promise.

- file: scratchpad/effected/cli/ui/CliUi.ts:522
- class: bug   severity: required
- standard: D9 behaviour preservation; section 14 deviation protocol.
- evidence: A read-only Bun probe invoked `CliUi.lazy(() => { throw new Error("loader failed synchronously"); })(control)` in the port and pinned oracle. The port printed `threw before returning:loader failed synchronously`; the oracle printed `returned promise rejected:loader failed synchronously`. The reviewed CLI source is unchanged between commit `3fa5876691901fccf3d1cd29e9324564df134b56` and the probed checkout. git show 6f2154defb confirms async removal was diagnostic-forced, but the concrete loss of promise rejection is a wrong implementation, not bookkeeping.
- failure: Replacing the upstream `async` wrapper with `load().then(...)` changes a synchronous loader exception into a synchronous exception from the returned screen. Callers that handle the oracle’s rejected promise now throw before reaching their rejection handler. The `asyncFunction` rule explains removing `async`, but does not require this behaviour change; neither the README nor ledger records a deviation.
- fix: Use a synchronous-invocation promise boundary such as Promise.try(load).then(module => module.default(control)), preserving immediate loader invocation and rejection of synchronous exceptions without async. Add a rejection regression.
- seats: part-3/sol-1-1

### cli-12 — Out-of-range initial Select indices can select a disabled choice.

- file: scratchpad/effected/cli/ui/Select.ts:144
- class: bug   severity: required
- standard: D11 bug criterion; section 14 verified-upstream-bug exception; `SelectInitOptions.initial` documents “the first enabled one at or after it, or the nearest enabled one before it when none follows.”
- evidence: A read-only Bun probe used choices `[{ label: "disabled", value: "d", disabled: true }, { label: "enabled", value: "e" }]` with `initial` values `-1`, `2`, and `99`. Both the port and pinned oracle returned `cursor: 0`, `disabled: true`; applying `"submit"` left `submitted: false`.
- failure: When the initial index lies outside the choices, both searches immediately terminate and the fallback selects index zero. This can highlight a disabled choice despite an enabled choice being available, violating the documented initial-selection rule. This is a reproduced upstream bug, rather than a port regression.
- fix: Clamp the initial search position to the choices bounds before forward/backward search; preserve search preference. Add negative and above-bound initial-index cases and forward verified upstream-bug bookkeeping centrally.
- seats: part-3/sol-1-2

### cli-13 — Verbatim text loses trailing spaces in plain, ANSI and GitHub-log rendering.

- file: scratchpad/effected/cli/internal/renderDoc.ts:440
- class: bug   severity: required
- standard: D11 bug criterion; section 14 verified-upstream-bug exception; `Doc.verbatim` promises lines “kept exactly” and states that plain, ANSI, and GitHub-log renderers write them as they are (`Doc.ts:875–878`).
- evidence: A read-only Bun probe rendered `{ _tag: "Verbatim", text: "x  \n  ", indent: 2 }` through the port and pinned oracle. Both plain renderers produced `"  x\n"` instead of `"  x  \n    "`. Both Markdown renderers preserved the spaces inside their fences.
- failure: `trimLine` removes trailing content spaces and erases whitespace-only lines’ indentation. The text renderers therefore lose data that the `Verbatim` contract explicitly promises to preserve. This is a reproduced upstream bug.
- fix: Mark Verbatim line spans hold: true so branch-local and final trimLine passes preserve content and whitespace-only indentation. Add fidelity cases for the three text renderers and forward upstream-bug bookkeeping centrally.
- seats: part-3/sol-1-3

### cli-14 — scanAudience duplicates the existing audience kit with ad-hoc guards.

- file: scratchpad/effected/cli/internal/scanAudience.ts:43
- class: schema   severity: required
- standard: AGENTS.md Code Laws: "Prefer named schema building blocks, derived `S.is(...)` guards, and named `LiteralKit` internal domains over ad-hoc predicate helpers"; D5 (LiteralKit for literal domains, kits applied at S4); D11 (schema idiom violation with a cited standard)
- evidence: `const KINDS: ReadonlyArray<string> = ["human", "agent", "ci"]` (:38) and `isKind = (value: string): value is AudienceKind => KINDS.includes(value)` (:43), plus `isBoolean = (name): name is "human" | "agent" | "ci" => name === "human" || name === "agent" || name === "ci"` (:61-62) and `Record<"human" | "agent" | "ci", boolean[]>` (:60), spell the same three-literal domain by hand four times. The sibling env module already owns it as a kit: `export const AudienceKind = LiteralKit(["human", "agent", "ci"])` (scratchpad/effected/env/Audience.ts:21) with `const isAudienceKind = S.is(AudienceKind)` in use (:34). The hand guard asserts `value is AudienceKind` from a `ReadonlyArray<string>` nothing ties to the kit. Not covered by the four gated laws (effect-imports, effect-fn, terse-effect, native-runtime).
- failure: A fourth audience kind added to `AudienceKind` leaves `scanAudience` silently blind to it while the guard still claims `AudienceKind`; the literal domain lives in two unlinked places.
- fix: Import the existing AudienceKind kit directly from ../../env/Audience.ts (read-only dependency); derive both guards via S.is(AudienceKind), use the derived type for booleans, and delete KINDS. Preserve spellings and counts. Do not edit env/index.ts or create another audience kit.
- seats: part-3/fable-1-3, part-3/sol-1-4

### cli-15 — Buffered fake-stream writes recurse until the stack overflows.

- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:37
- class: bug   severity: required
- standard: D9 behavior preservation; D11 bug criterion.
- evidence: A read-only differential probe on Node v24.20.0 corked `makeFakeStreams().streams.stdout`, queued 12,000 one-byte writes with callbacks, then called `uncork()`. The pinned oracle completed with `length 12000 callbacks 12000`; the port threw `RangeError: Maximum call stack size exceeded` with `length 4326 callbacks 0`.
- failure: `_writev` calls `_write` with `writeNext`, and `_write` invokes that callback synchronously. Each buffered chunk adds another stack frame. A valid batched stream write therefore crashes, truncates captured output, and leaves the write callbacks incomplete.
- fix: Drain synchronous _write completions iteratively with a trampoline that resumes for genuine backpressure; preserve ordering and exactly one batch callback. Add a cork/12000 writes/uncork regression checking all bytes and callbacks.
- seats: part-4/sol-1-1

### cli-16 — Handle-less fake stdin ref/unref leaks connect listeners.

- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:12
- class: bug   severity: required
- standard: D9 (behaviour-preserving); upstream fakeStreams.ts gave stdin no-op `ref: () => stdin, unref: () => stdin`
- evidence: MemorySocket extends a handle-less net.Socket and inherits Node's `Socket.prototype.ref/unref`, which on `!this._handle` do `this.once('connect', this.ref)` and return (printed from node v24.20.0). Ink 7.1.1 calls `stdin.ref()` on raw-mode enable (node_modules/ink/build/components/App.js:225) and `stdin.unref()` on disable (App.js:137), so every input screen adds two `connect` listeners that never fire. Probe against the lab file (`bun -e` importing scratchpad/effected/cli/ui/testing/fakeStreams.ts, six setRawMode/ref/unref cycles): `connect listeners after 6 screens: 12` and `MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 connect listeners added to [MemoryInput]`. Current tests stay under the threshold (wizard.test.ts mounts at most 3 screens per session), so the gate did not see it.
- failure: A `CliUiTest.session` (one fake stdin for every screen) with six or more input screens, or any longer-lived fake, prints Node's MaxListenersExceededWarning on the real process stderr and leaks one closure per raw-mode toggle; upstream's fakes never registered a listener.
- fix: Override MemorySocket.ref and unref to return this without registering listeners; add repeated raw-mode/ref/unref cycles and assert no connect-listener growth or warning.
- seats: part-4/fable-1-1

### cli-17 — TextInput displays unsanitized ANSI and physical newlines from its value.

- file: scratchpad/effected/cli/ui/TextInput.ts:363
- class: bug   severity: required
- standard: `ui/internal/lineText.ts` requires widget text from data to be sanitized before measurement and cutting; `TextInput` promises a one-line input; D9 and section 14 permit a verified upstream-bug correction.
- evidence: A read-only differential probe rendered `TextInput.screen({ message: "Name", initial: "a\u001b[31mRED\u001b[0m\nSECOND" })` through `CliUiTest.render` with `{ color: "none", columns: 80 }`. Both the pinned oracle and port returned the raw frame `"Name\na\u001b[31mRED\u001b[39m\nSECOND▏\nenter submit · esc cancel"`.
- failure: The unmasked value bypasses `lineText`. An initial value can inject ANSI styling even at color `none` and add physical rows despite the input’s one-line contract. The message, placeholder, validation message, and mask are sanitized, but the value itself is not.
- fix: Sanitize and fold display segments before windowAround measurement and Ink rendering, while preserving the original editing, validation, submission and cursor semantics. Add hostile initial-value regressions at color none; forward upstream-bug bookkeeping centrally.
- seats: part-4/sol-1-2

### cli-18 — Viewport uses stale hook-derived Box widths during an immediate resize repaint.

- file: scratchpad/effected/cli/ui/Viewport.ts:264
- class: bug   severity: required
- standard: `ui/UiTheme.ts`, `useTerminalSize` documentation explicitly prohibits feeding the hook’s `columns` into a `Box` width because Ink repaints before React updates; `Viewport` promises clipped rows that do not wrap; D9 and section 14 permit a verified upstream-bug correction.
- evidence: A read-only differential probe mounted a one-row viewport containing 100 `X` characters in a production-path `CliUiTest.session` at 80 columns, then resized it to 20 columns. Both the pinned oracle and port captured two new frames: first 79 `X` characters, then 19.
- failure: Both the outer box and each row retain `width: size.columns` during Ink’s immediate resize repaint. On a real 20-column terminal, the interim 79-column row wraps before the corrected frame arrives, creating the stale-frame artifact described by `useTerminalSize`.
- fix: Remove both hook-derived widths; express the outer one-column margin through layout (for example marginRight: 1) and let clipped rows stretch within current layout. Retain clipping and add an 80-to-20-column resize regression; forward upstream-bug bookkeeping centrally.
- seats: part-4/sol-1-3

### cli-19 — terminalModel prints ST-terminated OSC 8 protocol as text.

- file: scratchpad/effected/cli/ui/testing/terminalModel.ts:30
- class: bug   severity: required
- standard: `screenAfter` promises to ignore other escape sequences and return what the terminal shows; D9 and section 14 permit a verified upstream-bug correction.
- evidence: A read-only differential probe passed `"\u001b]8;;https://example.com\u001b\\label\u001b]8;;\u001b\\\n"` to `screenAfter(text, 24)`. Both the pinned oracle and port returned `["]8;;https://example.com\\label]8;;\\"]`, rather than `["label"]`.
- failure: The OSC branch recognizes only BEL-terminated sequences. A valid ST-terminated OSC 8 hyperlink falls through to the printable-character branch, so `CliUiTest` transcripts display the hyperlink protocol and destination as visible text. This makes transcript assertions and snapshots disagree with the terminal.
- fix: Consume OSC sequences ending in either BEL or ST (ESC followed by backslash); add a hyperlink transcript regression that returns only label. Forward upstream-bug bookkeeping centrally.
- seats: part-4/sol-1-4

### cli-20 — UiKey and its named key inventory lack schema ownership.

- file: scratchpad/effected/cli/ui/UiKey.ts:11; scratchpad/effected/cli/ui/testing/CliUiTest.ts:KEY_BYTES
- class: schema   severity: required
- standard: D5 requires `LiteralKit` for literal domains; `standards/effect-first-development.md` EF-12b requires schema-first named domains; `standards/ARCHITECTURE.md`, Core Principle 5, makes Schema the source of truth for pure data models.
- evidence: `KeyName` is a handwritten 16-member literal union, while `UiKey` at line 38 is a handwritten payload union with independent constructors at lines 42 and 84. `CliUiTest.ts` separately enumerates the same named-key domain in `KEY_BYTES`. No canonical key schema or `LiteralKit` exists in `UiKey.ts`. These modeling requirements are not established by the four green mechanical law gates.
- failure: A named, reused key domain and its data variants remain TypeScript-only declarations. They provide no canonical schema-derived guard, decoder, or arbitrary, and the runtime key inventory is maintained separately from the domain definition. This violates the binding schema and literal-domain requirements.
- fix: Define identity-annotated KeyName LiteralKit and schema-backed Named/Char payload union; derive types while preserving fromInk, named, char and plain payloads. Tie the KEY_BYTES inventory in CliUiTest.ts to the derived domain without changing byte mappings.
- seats: part-4/sol-1-5

### cli-21 — The production missing-Ink-peers error uses Data.TaggedError.

- file: scratchpad/effected/cli/ui/internal/ink.ts:20
- class: law   severity: required
- standard: standards/effect-laws-v1.md §7 ("extend S.TaggedError from effect/Schema directly for typed errors"); .patterns/error-handling.md (S.TaggedErrorClass + $I identity); the laws commit itself describes the class as "S.TaggedError with unchanged messages"
- evidence: part-4/fable-1-4 identifies class TestError extends Data.TaggedError at ink.ts:20, the MISSING_PEERS defect reachable from loadInk. The native-error check accepts Data.TaggedError despite law 7 requiring S.TaggedError directly. This record owns only the ink.ts error; cli-22 owns lazyView errors.
- failure: Three typed errors in production source bypass the schema-backed error law and one carries a test-helper name as its public tag.
- fix: Replace TestError with an identity-annotated S.TaggedError with annotated message and optional cause, construct with .make, and preserve Error name, missing-peer message and cause. The tag may be named for missing peers; forward the law-forced tag/export bookkeeping centrally.
- seats: part-4/fable-1-4

### cli-22 — Lazy-view shape and load errors use Data.TaggedError.

- file: scratchpad/effected/cli/ui/internal/lazyView.ts:59,112
- class: law   severity: required
- standard: standards/effect-laws-v1.md §7 ("extend S.TaggedError from effect/Schema directly for typed errors"); .patterns/error-handling.md (S.TaggedErrorClass + $I identity); the laws commit itself describes the class as "S.TaggedError with unchanged messages"
- evidence: part-4/fable-1-4 identifies both production Data.TaggedError bases in lazyView.ts; law 7 requires S.TaggedError directly and the green native-error check does not enforce that base.
- failure: Three typed errors in production source bypass the schema-backed error law and one carries a test-helper name as its public tag.
- fix: Use identity-annotated S.TaggedError for LazyViewShapeError and LazyViewLoadError with annotated message/cause fields as appropriate, update constructors to .make, and preserve deterministic cached shape-error identity, retryable load failure, causes and Error display name. Coordinate the shape-error id with allow-8 in CliUiLive.ts.
- seats: part-4/fable-1-4

### cli-23 — inkChalk still reads node:fs through a scanner-missed builtin lookup.

- file: scratchpad/effected/cli/ui/internal/inkChalk.ts:7; scratchpad/effected/cli/ui/internal/ink.ts:loadInk
- class: law   severity: required
- standard: standards/effect-laws-v1.md §7 + Allowlist Contract ("Do not add entries for scanner misses or cleanup convenience… remediate the module"); EFFECTED_PORT_GOAL 2026-10-09 grilling (evasion rejected: "Object.defineProperties, which only evades the law"); D9 §14 (adjusted test must be recorded)
- evidence: `const { realpathSync } = process.getBuiltinModule("node:fs")` replaces upstream's `import { realpathSync } from "node:fs"`. The native-runtime checker (packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:87) flags only ImportDeclarations of node:fs/node:path/node:child_process, so the call form hides the site; no allowlist entry exists for inkChalk.ts. To keep the boundary test green, scratchpad/test/cli/boundary.test.ts:110-116 was rewritten: upstream line `"ui/internal/inkChalk.ts forbidImports node:fs"` became `"ui/internal/inkChalk.ts process process"` and the `process` waiver list gained inkChalk.ts, while the doc comment at line 107 still says the licence is `forbidImports` of node:fs. README Port notes → Deviations and the ledger row say None. git show 2688563f71 confirms the import-to-builtin rewrite was diagnostic-forced; it still misses the native-runtime requirement rather than merely lacking a deviation entry.
- failure: The native-runtime gate reports zero sites for a file that still reads node:fs synchronously; the upstream process-streams licence test no longer holds the licence it documents; the test edit is an unrecorded D9 deviation.
- fix: Replace process.getBuiltinModule("node:fs").realpathSync with the FileSystem service and propagate the Effect-based realpath resolution through inkChalk and loadInk in ink.ts, preserving selection of Ink's shared Chalk instance. Adapt inkChalk tests and the boundary licence to the service implementation; do not add an allowlist entry or change repo-level scanners. Forward forced boundary-test bookkeeping centrally.
- seats: part-4/fable-1-2

### cli-24 — CliUi.fallback wraps and immediately calls a local Effect.fn.

- file: scratchpad/effected/cli/ui/CliUi.ts:493-511
- class: tsgo   severity: required
- standard: effect-fn-iife diagnostic guidance; D11 diagnostic/Effect idiom.
- evidence: part-3/fable-1-1 identifies const fallback = Effect.fn(...)(gen); return fallback(); at 493-511. The two-statement form escapes the diagnostic's syntactic IIFE check; the documented replacement is a direct Effect.gen.
- failure: An unnecessary traced function is manufactured and invoked immediately; the diagnostic-forced helper rewrite is wrong for this IIFE shape.
- fix: Return the existing Effect.gen directly from this one-time fallback builder instead of defining and immediately calling a local Effect.fn. Preserve explained state lifetime, prompt behavior and error handling. Treat all other forced traced wrappers under codemod-2.
- seats: part-3/fable-1-1

### allow-1 — new-map-set: remove EFFECTED-CLI-CAUSE-CYCLE under the later operator replacement ruling.

- file: scratchpad/effected/cli/CliFailure.ts:254
- class: law   severity: required
- kind: new-map-set
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-CAUSE-CYCLE: kind=new-map-set; reason=Cause-chain cycle detection tracks arbitrary error objects by identity. Effect hash collections compare plain objects and arrays structurally, and these keys have no stable primitive id, so a HashSet/HashMap would merge distinct instances.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Use a per-cause-chain ancestor/visited array scanned with === instead of the native identity Set. Preserve cycle termination, MAX_DEPTH and distinct equal-looking object identity; add cycle and distinct-object regressions.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-2 — new-map-set: remove EFFECTED-CLI-CURRENT-LOGGERS under the later operator replacement ruling.

- file: scratchpad/effected/cli/CliRuntime.ts:578
- class: law   severity: required
- kind: new-map-set
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-CURRENT-LOGGERS: kind=new-map-set; reason=Logger.CurrentLoggers is typed by Effect as a native ReadonlySet of logger objects; the reference value must be that native set.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Replace the native CurrentLoggers Set using Logger.layer([makeCliLogger(...)]) through Effect.scopedWith, Layer.buildWithScope and Effect.provideContext. Preserve logger scope and warning routing; apply no diagnostic suppression and request no repo allowlist edit.
- seats: part-1/fable-1-6
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-3 — object-method: remove EFFECTED-CLI-FROZEN-DOC under the later operator replacement ruling.

- file: scratchpad/effected/cli/Doc.ts:385
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-FROZEN-DOC: kind=object-method; reason=Object.freeze makes document nodes and their child arrays immutable at runtime; Doc.test.ts and Doc.counter.plural.test.ts assert Object.isFrozen. TypeScript readonly cannot enforce this.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Drop Object.freeze and freeze/frozenArray wrappers while keeping readonly types and independent copied child arrays. Retarget every Object.isFrozen assertion in Doc.test.ts and Doc.counter.plural.test.ts to the new representation and constructor/aliasing semantics. Coordinate with cli-5 and send systemic D9 bookkeeping centrally.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-4 — object-method: remove EFFECTED-CLI-FROZEN-GLYPHS under the later operator replacement ruling.

- file: scratchpad/effected/cli/Glyphs.ts:63
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-FROZEN-GLYPHS: kind=object-method; reason=Object.freeze keeps the shared Unicode and ASCII glyph sets (spinner frames, path separators, tree parts) immutable at runtime for every consumer. TypeScript readonly cannot enforce this.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Drop all Object.freeze calls on unicode/ascii glyphs and nested spinner/path/tree members; retain readonly data and exact glyph/frame order. Retarget Glyphs.test.ts isFrozen assertions to the readonly representation and content guarantees; send systemic D9 bookkeeping centrally.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-5 — object-method: remove EFFECTED-CLI-HELP-ROUTING-PROTOTYPE under the later operator replacement ruling.

- file: scratchpad/effected/cli/internal/HelpRouting.ts:44
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-HELP-ROUTING-PROTOTYPE: kind=object-method; reason=Object.create plus Object.assign wrap the original help formatter and console while keeping them as the prototype, so inherited and non-enumerable members stay live. A spread copy would drop them.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Replace prototype-based formatter and console wrappers with fully typed explicit delegating objects. Delegate every unoverridden method/property to the original instance with correct binding and live access; preserve recording and stdout/stderr behavior and validate overrides structurally (no Object.create/assign or lib-sourced any).
- seats: part-2/fable-1-7
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-6 — object-method: remove EFFECTED-CLI-FROZEN-STATUS under the later operator replacement ruling.

- file: scratchpad/effected/cli/Status.ts:135
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-FROZEN-STATUS: kind=object-method; reason=Object.freeze returns the documented shallow frozen status snapshot (token identity kept); Status.test.ts asserts Object.isFrozen.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Drop Object.freeze on resolved status snapshots; preserve copied snapshot fields and token identity with readonly types. Retarget the isFrozen assertion in Status.test.ts to snapshot and identity semantics; send systemic D9 bookkeeping centrally.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-7 — object-method: remove EFFECTED-CLI-FROZEN-TOKENS under the later operator replacement ruling.

- file: scratchpad/effected/cli/Token.ts:63
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-FROZEN-TOKENS: kind=object-method; reason=Object.freeze keeps Token.defaults and each default style frozen; Token.test.ts asserts Object.isFrozen on every one.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Drop Object.freeze on Token.defaults and each default style; retain readonly style/default types and exact values. Retarget Token.test.ts isFrozen assertions to the new representation/content; send systemic D9 bookkeeping centrally.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-8 — new-map-set: remove EFFECTED-CLI-LAZY-VIEW-WARNED under the later operator replacement ruling.

- file: scratchpad/effected/cli/ui/CliUiLive.ts:338
- class: law   severity: required
- kind: new-map-set
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-LAZY-VIEW-WARNED: kind=new-map-set; reason=The warned-shapes set tracks LazyViewShapeError instances by identity so each failure warns once. Effect hash collections compare plain objects and arrays structurally, and these keys have no stable primitive id, so a HashSet/HashMap would merge distinct instances.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Give owned LazyViewShapeError instances stable ids and track warned errors by those primitive ids in MutableHashMap. Coordinate lazyView.ts with CliUiLive.ts; preserve once-per-cached-shape-error warning, distinct error identity and retry behavior. Do not mark user objects by reference globally.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-9 — new-map-set: remove EFFECTED-CLI-MULTISELECT-CHOSEN under the later operator replacement ruling.

- file: scratchpad/effected/cli/ui/MultiSelect.ts:73
- class: law   severity: required
- kind: new-map-set
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-MULTISELECT-CHOSEN: kind=new-map-set; reason=The public MultiSelect result exposes `chosen` as a native ReadonlySet<number>; Effect HashSet does not implement that interface, so changing it would change the public API.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Change public chosen from ReadonlySet<number> to Effect HashSet<number>, migrate init/step/render/selected membership and updates, and adapt tests and public state types. Preserve returned selection order explicitly by walking flattened document items, never by depending on hash iteration.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

### allow-10 — object-method: remove EFFECTED-CLI-TEST-AMBIENT-CONSOLE under the later operator replacement ruling.

- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:811
- class: law   severity: required
- kind: object-method
- standard: Operator Grilling 2026-10-09 (later): every effected allowlist entry is removed; prescribed class replacement.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-CLI-TEST-AMBIENT-CONSOLE: kind=object-method; reason=Object.create(ambient) keeps the live console as the prototype of the test double, including inherited and non-enumerable methods; a spread copy would drop them.
- failure: This native-runtime exception remains in CLI; the operator explicitly revoked every effected exception.
- fix: Replace Object.create(ambient) with a fully typed explicit delegating Console object; capture overridden stdout/stderr methods and forward every other member to ambient with correct binding and live behavior. Add delegation regressions; do not use prototype wrappers or spread-only copies.
- seats: operator/allowlist (no seat required)
- disposition: Required regardless of the brief's green gate: this is an explicitly removed allowlist exception.

## Backlog

### backlog-1 — Deferred JSDoc carriers, metadata and public Examples across all four parts.

- file: scratchpad/effected/cli/**/*.ts (all four BRIEF.md focus lists)
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; S2 deferral in the review brief.
- evidence: An exact-commit scan found legacy `@remarks`/`@example` carriers in **all 16 focus files**, with zero `@category` and zero `@since` tags in each. `Cancelled` also lacks the required value-level Example.
- failure: The carried documentation does not yet satisfy the repository’s carrier grammar, public-export metadata requirements, or value-level Example requirement. The green S1 gates do not establish S2 compliance.
- fix: During S2 preserve upstream bodies, convert carriers to titled Example and Details/Gotchas sections, add canonical category and since metadata, and validate example imports and compilation.
- seats: part-1/sol-1-4, part-2/sol-1-6, part-3/sol-1-5, part-3/fable-1-9, part-4/grok-1-9, part-4/sol-1-6
- disposition: S2 has not run; documentation is backlog by operator order.

### backlog-2 — ConfigIssueRenderer's example has no configFile producer.

- file: scratchpad/effected/cli/ConfigIssueRenderer.ts:26
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Example quality and compilation”; EFFECTED_PORT_GOAL.md D4; S2 deferral in the review brief.
- evidence: An in-memory compilation of the carried Example, using the port’s actual imports, reported `TS2304: Cannot find name 'configFile'`. The subsequent `catchTag` expression also reported TS2345 because the missing producer leaves no usable typed error channel.
- failure: The Example references a configuration loader that it neither defines nor imports, so it cannot serve as a compiling usage example.
- fix: Define a small, correctly typed configuration-loading effect or import and instantiate the intended loader before the `catchTag` call. Keep the example’s observable issue-rendering behavior.
- seats: part-1/sol-1-5
- disposition: S2 has not run; example compilation is deferred.

### backlog-3 — Deferred canonical lifecycle for effectful test setup and scoped platform layers.

- file: scratchpad/test/cli/CliFailure.test.ts:57,164; scratchpad/test/cli/CliTest.test.ts:18,27,35,46
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md prohibition on `Effect.runSync` in tests; goals/effect-vitest-canon/SPEC.md D14; S3 deferral in the review brief.
- evidence: `contextFor` calls `Effect.runSync` to build effectful rendering layers, and line 164 similarly runs an effectful schema decode synchronously. The first helper is called by the suite’s ordinary synchronous tests.
- failure: Effectful setup and decoding run outside the canonical Effect test lifecycle. Their services and execution are hidden inside synchronous helpers instead of being managed by the tester and layer harness.
- fix: During S3 return Effects from CliFailure helpers, use it.effect and it.layer for effectful setup and NodeServices, retaining resource scopes and assertions.
- seats: part-1/sol-1-6, part-1/sol-1-7
- disposition: S3 vitest canon has not run.

### backlog-4 — Cancelled lacks the deferred schema round-trip property.

- file: scratchpad/test/cli/Cancelled.test.ts:66
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10, requiring schema-derived encode/decode round-trip properties; S3 deferral in the review brief.
- evidence: The suite contains fixed decode/encode assertions and enumerates both cancellation reasons, but has no schema-derived property, `Arbitrary` integration, or `fcRuns` configuration.
- failure: The exported `Cancelled` schema’s explicit property floor remains unmet. The existing examples provide useful coverage of its finite reason domain, but do not implement the required round-trip property.
- fix: Add a canonical schema-derived property that encodes and decodes `Cancelled`, checks schema equality and the preserved exit-code behavior, and uses `fcRuns(n)`. Retain the existing fixed assertions.
- seats: part-1/sol-1-8
- disposition: S3 property floor has not run.

### backlog-5 — Viewport properties use raw run counts.

- file: scratchpad/test/cli/ui/Viewport.test.ts:54
- class: test   severity: backlog
- standard: D10 requires property run counts through `@beep/fc-runs` using `fcRuns(n)`; the review brief explicitly defers S3 and makes test-canon findings backlog.
- evidence: Both viewport properties use `{ arbitrary: { runs: 400, size: 300 } }`, at lines 54 and 65, without importing or calling `fcRuns`.
- failure: The property suites bypass the required centralized run-count policy. Their passing upstream tests do not establish compliance with the deferred S3 property contract.
- fix: During S3, import `fcRuns` from `@beep/fc-runs` and replace both raw run counts with `fcRuns(400)`, preserving the tested properties and size setting.
- seats: part-4/sol-1-7
- disposition: S3 property/canon migration has not run.

### backlog-6 — CliLog.layer union narrowing uses identical branches.

- file: scratchpad/effected/cli/CliRuntime.ts:546
- class: type-safety   severity: backlog
- standard: readability / overload design (upstream used a cast the port correctly removed; the replacement is a no-op branch)
- evidence: `("file" in envLog ? CliLog.layer(envLog) : CliLog.layer(envLog))` — both branches are textually identical; the conditional exists only to narrow `CliLogOptions | CliLogFileOptions` so one of the six `CliLog.layer` overloads (CliLog.ts:358-415) matches, because no overload accepts the union.
- failure: A reader sees a branch that selects nothing; the implementation signature (CliLog.ts:416-418) already accepts the union but is hidden by the overloads.
- fix: Add a public overload `static layer(options: CliLogOptions | CliLogFileOptions): Layer.Layer<never, never, Audience | TerminalEnv | FileSystem.FileSystem | PathModule.Path>` and call `CliLog.layer(envLog)` once.
- seats: part-1/fable-1-10
- disposition: D11: overload/readability improvement; the report establishes a cast-free narrowing workaround, not a runtime failure.

### backlog-7 — CliLog.status retains a redundant vocab alias.

- file: scratchpad/effected/cli/CliLog.ts:575
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21 spirit (tersest equivalent form); leftover from removing the upstream `as unknown as Status<...>` cast
- evidence: `const core = vocab;` followed by `core.def("failure")` / `core.def("warning")` — `core` is a bare alias of `vocab` now that the cast is gone (upstream CliLog.ts:574-577 needed the alias to hold the widened type). CliMessage.ts:67 already reads `vocab.def("warning")` directly.
- failure: Dead alias and a stale comment-free indirection in a public API body.
- fix: Delete the alias and use `vocab.def("failure")` / `vocab.def("warning")` as CliMessage does.
- seats: part-1/fable-1-11
- disposition: D11: advisory cleanup without a missed enforceable diagnostic or runtime failure.

### backlog-8 — README attribution contains pasted search fragments.

- file: scratchpad/effected/cli/README.md:226
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md 10.3 README adaptation; Port notes template (Attribution lists package, commit, licence)
- evidence: Lines 226-227 under `### Attribution` read `- scratchpad/effected/cli/ui/internal/processStreams.ts:5 * One of the three files licensed to touch Node: it reads` and `- scratchpad/effected/cli/ui/internal/processStreams.ts:7 * The boundary test holds that licence exact.` — truncated `rg` output pasted into the attribution list.
- failure: The attribution section carries two meaningless bullet fragments that read as licence claims.
- fix: During the central documentation pass remove the two pasted attribution fragments or replace them with a meaningful provenance statement; no worker edits README Port notes.
- seats: part-2/fable-1-9
- disposition: Documentation is backlog; README Port-notes bookkeeping stays central.

### backlog-9 — Serializer example and entrypoint prose retain upstream package paths.

- file: scratchpad/effected/cli/ui-testing-serializer.ts:13
- class: docs   severity: backlog
- standard: D13 (no `@effected/*` specifiers inside the lab) applied to carried examples; EFFECTED_PORT_GOAL.md 10.2 carrier conversion (S2 not yet run); TESTS_NOT_PASSING.md notes `scratchpad/vitest.effected.config.ts` registers no serializer
- evidence: The `@packageDocumentation` example still reads `test: { snapshotSerializers: ["@effected/cli/ui/testing/serializer"] }`; every other example in the focus files was rewritten to the lab path. Related prose mentions: TestTerminal.ts:63 (`@effected/cli/testing`), ui-testing.ts:2 (`@effected/cli/ui`). The parity gate checks import specifiers only, so it did not flag the string.
- failure: A reader following the example registers a module the lab does not have; the one upstream test that depends on registration (`CliUiTest.serializer.test.ts`) stays red for the same reason.
- fix: During S2 point the serializer example and entrypoint prose at the lab modules; retain the example body. Serializer registration in the shared config is tracked separately as backlog-10.
- seats: part-2/fable-1-10
- disposition: S2 documentation conversion has not run.

### backlog-10 — The shared Vitest config does not register the lab serializer.

- file: scratchpad/vitest.effected.config.ts; scratchpad/test/cli/ui/CliUiTest.serializer.test.ts
- class: test   severity: backlog
- standard: Later operator environmental-failure ruling (serializer must be fixed).
- evidence: part-2/fable-1-10 points to TESTS_NOT_PASSING.md and the missing serializer registration, connecting it to CliUiTest.serializer.test.ts.
- failure: The serializer-dependent environment-bound test remains unproven by the brief's blanket green-gate claim.
- fix: The central environment/config owner must register the existing lab ui-testing serializer in scratchpad/vitest.effected.config.ts and rerun the environment-bound serializer test; do not assign this config to a CLI fix group.
- seats: part-2/fable-1-10
- disposition: outside the port's write surface

### backlog-11 — Unused Biome suppression comments remain.

- file: scratchpad/effected/cli/internal/displayWidth.ts:6
- class: docs   severity: backlog
- standard: D4 (not carried: `biome.json` and release tooling); the lab lint gate is oxlint, not biome
- evidence: `// biome-ignore lint/suspicious/noControlCharactersInRegex: ...` survives at internal/displayWidth.ts:6 and Fmt.ts:28 while no biome configuration exists in the lab (`rg -n 'biome-ignore' <focus files>` -> those two lines; the oxlint gate is green without them).
- failure: Stale suppression directives for a linter that never runs here; a reader assumes a lint exception is in force when none is.
- fix: Drop both comments, or replace them with the oxlint directive if `no-control-regex` is ever enabled for the lab.
- seats: part-2/fable-1-11
- disposition: S2/docs cleanup; D11 establishes no active lint failure.

### backlog-12 — Per-call Match cases allocate closures and matchers on render/live paths.

- file: scratchpad/effected/cli/internal/renderDoc.ts:376
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; this is constant-factor, so backlog)
- evidence: `Match.valueTags(input, fields)` is `tagsExhaustive(fields)(makeTypeMatcher(identity, []))` followed by `match(input)` (node_modules/effect/dist/internal/matcher.js:136-139, :179-182): each call builds a matcher from the cases object and scans its cases linearly. `blockLines` (renderDoc.ts:376) and `blockMd` (renderMarkdown.ts:375) now allocate a 17-entry cases object with 17 closures plus a matcher per block, recursively; `control` (CliUiLive.ts:706) does the same per inbox message at tick rate, including a fresh `Effect.fnUntraced` wrapper for `Ended` (:709). Upstream was a `switch` jump with no allocation. No measurement taken.
- failure: Constant-factor slowdown and garbage per rendered block and per live-view tick.
- fix: Hoist the handlers out of the per-call path (a module-level `Match.typeTags<Block>()({...})` or a tag-keyed record of functions built once, taking `walk`/`width`/`compact` as arguments), or keep upstream's `switch`.
- seats: part-3/fable-1-4
- disposition: D11: no measured regression or algorithmic-class win; constant-factor performance remains backlog.

### backlog-13 — CliUiLive hard-codes the Stream TypeId and uses undefined sentinels.

- file: scratchpad/effected/cli/ui/CliUiLive.ts:295
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (use the module's own guards; validate against the installed Effect, not literals)
- evidence: `"~effect/Stream" in source` (:295-296) hard-codes `Stream.TypeId` (node_modules/effect/dist/Stream.js:63). In 4.0.2 `Stream.isStream` is a type guard, `(u: unknown) => u is Stream<unknown, unknown, unknown>` (Stream.d.ts:250), and narrows `Stream<E> | PubSub.Subscription<E>` on both branches, so the `as` casts upstream needed are gone without a magic string. The two derived `undefined` sentinels then leave a third, unreachable pump branch `subscription === undefined ? Effect.void : ...` (:779) that would never offer `Ended` and leave `control` waiting on `Queue.takeAll` if it were ever reached.
- failure: A TypeId rename in effect silently breaks the stream/subscription split; the dead branch encodes an impossible "no events" source.
- fix: Narrow once with `Stream.isStream(source)` and build `streamPull`, `pump` and `queuedTail` inside the two branches of that one check, so no `undefined` sentinel and no third branch remain.
- seats: part-3/fable-1-5
- disposition: D11: improvement against a hypothetical TypeId change, with no current failing input or cited mandatory modeling rule.

### backlog-14 — CliUiLive redundantly maps Effect.void to undefined.

- file: scratchpad/effected/cli/ui/CliUiLive.ts:329
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws "Prefer the tersest equivalent helper form" (terse-effect); tsgo effect-succeed-with-void
- evidence: `current === undefined ? Effect.as(Effect.void, undefined) : Effect.as(unmount(current), current)` — `Effect.as(Effect.void, undefined)` exists only to dodge `effect-succeed-with-void` on upstream's `Effect.succeed(undefined)`; 4.0.2 has no `Effect.undefined`.
- failure: No runtime effect; the detour reads as a lint evasion and hides that both branches end in `current`.
- fix: `Effect.as(current === undefined ? Effect.void : unmount(current), current)` — one expression with the same `Effect<Run<S> | undefined>` type.
- seats: part-3/fable-1-6
- disposition: D11: advisory equivalent-form cleanup; no missed gate or observable defect shown.

### backlog-15 — Several optional-field objects spread one getSomesStruct per field.

- file: scratchpad/effected/cli/internal/renderGithubLog.ts:17-22; scratchpad/effected/cli/ui/CliUi.ts:203-204; scratchpad/effected/cli/ui/CliUiLive.ts:501-502; scratchpad/effected/cli/ui/testing/CliUiTest.ts:1086-1091; scratchpad/effected/cli/ui/UiProvider.ts:87-88
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws "Prefer the tersest equivalent helper form"
- evidence: Six consecutive `...O.getSomesStruct({ one: ... })` spreads (:17-22). Read-only probe: `getSomesStruct({ a: O.none() })` → `{}` (key absent), `getSomesStruct({ a: O.some(1) })` → `{ a: 1 }`, so one call over all six fields is byte-for-byte equivalent to upstream's conditional spreads. Same two-spread shape at CliUi.ts:203-204 and CliUiLive.ts:501-502.
- failure: None at runtime; six struct allocations and six spreads where one does.
- fix: Collapse each object's adjacent single-field getSomesStruct calls into one call, preserving absent-field semantics. This is advisory, separate from the clock-helper suggestion in backlog-16.
- seats: part-3/fable-1-8, part-4/fable-1-12
- disposition: D11: equivalent-form/readability and unmeasured constant-factor allocation improvement.

### backlog-16 — CliUiTest repeats the default Clock read at many sites.

- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:573,640,653,686-688,712,770-789,999-1012,1105
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md §21 (shared thunk helpers already in scope; tersest equivalent form)
- evidence: `Clock.Clock.defaultValue().currentTimeMillisUnsafe()` is spelled out at 15 sites (573, 640, 653, 686-688, 712, 770-772, 775-776, 784, 788-789, 999-1000, 1012, 1105); `CliUiTest.live` spreads five single-key `O.getSomesStruct({ k: O.fromUndefinedOr(k) })` calls (1086-1091) and UiProvider.ts:87-88 two, where one call per object does the same.
- failure: Codemod residue that obscures the timing logic upstream wrote with `Date.now()`.
- fix: Optionally introduce a shared now thunk using the existing default Clock read; retain live wall-clock semantics.
- seats: part-4/fable-1-12
- disposition: D11: helper consolidation without a runtime failure or measured regression.

### backlog-17 — Lazy-view loader branch may be unreachable for owned handles.

- file: scratchpad/effected/cli/ui/internal/lazyView.ts:126
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL §11.3 (a branch unreachable by construction is a finding against the source)
- evidence: `loadView` reads `render[LOAD]` only after `P.hasProperty(render, LOAD)`, then inside `tryPromise.try` guards `if (!P.isFunction(ensure)) throw LazyViewStateError.make({ message: "lazy view loader is not a function" })`. `LOAD` is assigned only at lazyView.ts:106 (`render[LOAD] = ensure`, always a function), so the throw cannot execute and S3's per-file 100% branch floor will fail here; the message also lacks the module's `@effected/cli/ui:` prefix.
- failure: An untestable branch and an off-style message in the lazy-view loader.
- fix: Narrow once: `const ensure = P.hasProperty(render, LOAD) && P.isFunction(render[LOAD]) ? render[LOAD] : undefined;` and drop the inner throw.
- seats: part-4/fable-1-11
- disposition: S3 coverage has not run; the claimed unreachable branch must also account for externally supplied Symbol.for handles before deletion.

### backlog-18 — File-wide test diagnostic exceptions hide future occurrences.

- file: scratchpad/test/cli/ui/CliUi.run.test.ts:1
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL §3.2 (zero tsgo diagnostics is the gate) and §11.2 (S3 canon migration); goals/effect-vitest-canon/SPEC.md
- evidence: 68 files under scratchpad/test/cli carry file-wide `// @effect-diagnostics <rule>:skip-file` headers (strictEffectProvide, multipleEffectProvide, asyncFunction, globalTimers, newPromise, nodeBuiltinImport); e.g. this file, CliUiTest.crash.test.ts, wizard.test.ts, Tabs.test.ts, Holder.test.ts. S1 keeps upstream tests verbatim (vi.mock async factories, real timers), so the headers are the S1 trade-off, but a file-wide skip also hides every later instance.
- failure: The tsgo gate is blind to those rules across most of the module's tests, including sites S3 could rewrite (`new Promise`, `setTimeout`, async helpers).
- fix: In S3 narrow each header to `@effect-diagnostics-next-line` at the sites vitest's own API forces (vi.mock factories) and migrate the rest to Effect forms.
- seats: part-4/fable-1-13
- disposition: S3 canon migration has not run; narrow the upstream-test exceptions during that phase.

## Handled by the deviation codemod

### codemod-1 — Record systemic law/identity-forced tagged-error changes, names, stacks and own properties.

- file: scratchpad/effected/cli/{Cancelled,NotInteractive,CliExit,CliAudience,CliRuntime,Status}.ts; scratchpad/effected/cli/ui/{Confirm,Select,DocView,CliUi,CliUiLive,Viewport,UiTheme}.ts; scratchpad/effected/cli/ui/internal/{ScreenContext,ink,lazyView}.ts; scratchpad/effected/cli/ui/testing/CliUiTest.ts
- class: law   severity: backlog
- standard: D5/D9; operator later ruling: per-module/per-class tagged-error and identity bookkeeping is centralized.
- evidence: git log --format=%h:%s -- each affected file and git show 6f2154defb, f7e0ee8d10 and f9aee5bcb2 attribute these error conversions and composed schema identifiers to step 2, step 4 and law work. f7e0ee8d10 explicitly adds composed identifiers to Cancelled/NotInteractive; f9aee5bcb2 adds InvalidExitCodeError and other identity-named errors. The seats reproduce identity-bearing names, new _tag/message properties and .make stack capture; these are consequences of forced changes, not evidence of an unrelated edit.
- failure: Systemic forced deviations are not yet represented in the empty module deviation record.
- fix: The central per-module/per-class deviation codemod records tagged-error conversions and identity names, .make stack differences, adjusted upstream error assertions and added exports. Do not restore native Error or remove identity identifiers on the basis of these reports. cli-3/4/21/22 separately fix genuinely incomplete schema implementations.
- seats: part-1/grok-1-1, part-1/grok-1-3, part-1/fable-1-1, part-1/fable-1-4, part-1/fable-1-8, part-1/fable-1-9, part-2/grok-1-1, part-2/fable-1-3, part-3/grok-1-1, part-3/grok-1-2, part-3/grok-1-3, part-3/grok-1-4, part-3/grok-1-5, part-3/fable-1-2, part-4/grok-1-1, part-4/grok-1-2, part-4/grok-1-3, part-4/grok-1-4, part-4/grok-1-5, part-4/grok-1-7, part-4/grok-1-8, part-4/fable-1-3, part-4/fable-1-6
- disposition: Forced conversion bookkeeping is central; error-name-only restore requests lack evidence overriding the commit attribution.

### codemod-2 — Record diagnostic/law-forced Effect.fn helper and tracing additions.

- file: scratchpad/effected/cli/{CliExit,CliPrompt,CliLog,CliMessage,CliLinks,CliTest,Doc,Render,TestTerminal}.ts; scratchpad/effected/cli/internal/{HelpRouting,fileSink,autoFormat,failureTarget}.ts; scratchpad/effected/cli/ui/{CliUi,CliUiLive}.ts; scratchpad/effected/cli/ui/testing/CliUiTest.ts
- class: effect-idiom   severity: backlog
- standard: Operator forced-change provenance ruling; effect-fn law / step-2 diagnostics.
- evidence: git show 6f2154defb adds the two fileSink Effect.fn wrappers and CliUiTest.mount; git show f9aee5bcb2 adds CliExit.set, CliPrompt.fallback, readLevel/status/buildTimeDecision and the other reported law-pass wrappers. The laws commit records 32 such helper conversions. Seats reproduce added in: trails; no history diff establishes an edit independent of the diagnostic/law pass.
- failure: Forced helper migrations have observable tracing surfaces awaiting a central deviation record.
- fix: Record the effect-fn systemic class, affected wrappers, observable report/tracer differences and upstream tests centrally; do not dispatch a module-wide fnUntraced restore on the premise that these edits were unforced. cli-10 fixes the wrong file-sink function name and cli-24 fixes the incorrect immediate-invocation shape.
- seats: part-1/grok-1-2, part-1/fable-1-2, part-1/fable-1-3, part-1/fable-1-7, part-2/grok-1-3, part-2/fable-1-1, part-2/fable-1-2, part-2/fable-1-6, part-3/fable-1-1, part-4/fable-1-10
- disposition: Helper choice made in step-2/law commits is forced under the requested attribution rule, unless its implementation is independently wrong.

### codemod-3 — Record diagnostic-forced overloads and cast-free Status type widening.

- file: scratchpad/effected/cli/Status.ts:63,66,111; scratchpad/effected/cli/ui/KeyTable.ts:238; scratchpad/effected/cli/ui/UiTheme.ts:88; scratchpad/effected/cli/ui/testing/terminalModel.ts:22
- class: type-safety   severity: backlog
- standard: Operator forced-change provenance ruling; D15/missingPipeableSignature.
- evidence: git show 6f2154defb explicitly introduces dual overloads for inkProps and screenAfter in the diagnostic-clearing commit; the same step-2 chain supplies the hook dual and cast-free Status widening. The reports themselves identify missingPipeableSignature or removed unsafe assertions; no diff shows an independent unforced rewrite.
- failure: Added overload/widening surfaces are absent from central port records. The useKeys report offers a possible misuse, not a reproduced valid-caller hook-order failure.
- fix: Record diagnostic API-shape adjustments and added callable surface centrally, including inkProps, screenAfter, useKeys and Status.def. Added exports go to exportsAdded. Do not restore the plain arrows or reintroduce exceptions without evidence that the changes were unforced.
- seats: part-2/fable-1-8, part-3/fable-1-7, part-4/fable-1-8, part-4/fable-1-9
- disposition: The step-2 provenance defeats the proposed unforced-shape classification.

### codemod-4 — Record diagnostic-forced scoped layer provisioning.

- file: scratchpad/effected/cli/CliRuntime.ts:609-628; scratchpad/effected/cli/CliLog.ts:492-496,612-628; scratchpad/effected/cli/ui/testing/CliUiTest.ts:748,1099
- class: effect-idiom   severity: backlog
- standard: Operator forced-change provenance and Logger.CurrentLoggers rulings.
- evidence: git show 6f2154defb expands provides in CliRuntime, CliLog and CliUiTest while clearing diagnostics. The later operator ruling explicitly selects the same scope/layer/context sequence for Logger.CurrentLoggers. The reports propose restoring diagnosed Effect.provide and adding directives rather than identifying a changed scope outcome.
- failure: Diagnostic-forced provisioning has no centralized provenance/deviation record.
- fix: Record the strictEffectProvide/multipleEffectProvide-driven scopedWith/buildWithScope/provideContext rewrites centrally. Retain their ordered layer composition; Logger sites use the exact later operator-approved form. No CLI worker edits DIAGNOSTIC_EXCEPTIONS.md.
- seats: part-1/fable-1-5, part-4/fable-1-7
- disposition: Forced shape work goes to codemod; a blanket provide-and-suppress replacement conflicts with the Logger ruling (rejected-2).

### codemod-5 — Record native-runtime/diagnostic boundary and stream-double changes centrally.

- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:5; scratchpad/test/cli/boundary.test.ts:110-116; scratchpad/test/cli/ui/CliUi.run.test.ts:560
- class: law   severity: backlog
- standard: Later operator per-module/per-class native-runtime deviation ruling; D15.
- evidence: git show 2688563f71 removes file-wide nodeBuiltinImport directives, changes builtin lookup and boundary licence entries; f7e0ee8d10 states the remaining fake-stream casts were replaced by implemented Node TTY members. The reported plain-import restore was therefore not an unforced-change repair.
- failure: Forced native-boundary and test adaptation sites await a central deviation entry.
- fix: Record the per-class native-runtime replacements and diagnostic/D15-forced fake stream representation, builtin-loading and boundary-test changes with the adjusted upstream test lines. cli-15/16 repair real fake-stream bugs, cli-23 removes the scanner-missed node:fs access, and allow-1..10 cover the removed allowlist; none author ledger or README Port notes.
- seats: part-4/fable-1-5, part-4/fable-1-6
- disposition: Bookkeeping and forced API/representation changes belong to the central codemod; real incorrect implementations remain required.

### codemod-6 — Record identity-derived service/reference keys.

- file: scratchpad/effected/cli/ui/UiStreams.ts:38; scratchpad/effected/cli/ui/internal/renderOptions.ts:44
- class: schema   severity: backlog
- standard: Operator identity step and later centralized identity-key deviation ruling.
- evidence: part-4/fable-1-6 identifies composed Context.Reference keys added by the identity pass; f7e0ee8d10 records composer-derived service/reference keys across CLI.
- failure: The identity-key deviation class is not recorded centrally yet.
- fix: Generate the module identity-key class entry and affected tests centrally for UiStreams and renderOptions; do not create per-site README or ledger entries.
- seats: part-4/fable-1-6

## Rejected

### rejected-1 — Claim that the upstream bare Error subclass is named LazyViewShapeError.

- file: scratchpad/effected/cli/ui/internal/lazyView.ts:60
- class: bug   severity: backlog
- standard: Pinned upstream oracle; D9 evidence requirement.
- evidence: Pinned oracle src/ui/internal/lazyView.ts:41 is export class LazyViewShapeError extends Error {} with no name override. That bare subclass inherits Error.prototype.name = Error; git show 6f2154defb preserves it explicitly.
- failure: The proposed deletion would introduce the name difference it claims to repair.
- fix: Keep the Error display name when migrating the class in cli-22.
- seats: part-4/grok-1-6
- disposition: False upstream-name evidence: a bare Error subclass inherits name Error, so deleting the override would regress parity.

### rejected-2 — Proposed restore of Logger sites to Effect.provide with diagnostic suppressions.

- file: scratchpad/effected/cli/CliRuntime.ts:578-581; scratchpad/effected/cli/CliLog.ts:492-496,615-617
- class: law   severity: backlog
- standard: Later operator Logger.CurrentLoggers replacement ruling.
- evidence: These reports propose Effect.provide(Logger.layer(...)) plus suppression directives; the binding later ruling explicitly prescribes scopedWith/buildWithScope/provideContext.
- failure: The proposed helper/suppression fix contradicts the prescribed Logger replacement.
- fix: Use the approved Logger.layer + Effect.scopedWith + Layer.buildWithScope + Effect.provideContext form; see allow-2. Non-Logger forced provisioning bookkeeping is codemod-4.
- seats: part-1/fable-1-5, part-1/fable-1-6
- disposition: Contradicts the later operator Logger ruling; retain the defect in allow-2 with the mandated fix instead.

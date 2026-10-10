### sol-1-1
- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:37
- class: bug   severity: required
- standard: D9 behavior preservation; D11 bug criterion.   evidence: A read-only differential probe on Node v24.20.0 corked `makeFakeStreams().streams.stdout`, queued 12,000 one-byte writes with callbacks, then called `uncork()`. The pinned oracle completed with `length 12000 callbacks 12000`; the port threw `RangeError: Maximum call stack size exceeded` with `length 4326 callbacks 0`.
- failure: `_writev` calls `_write` with `writeNext`, and `_write` invokes that callback synchronously. Each buffered chunk adds another stack frame. A valid batched stream write therefore crashes, truncates captured output, and leaves the write callbacks incomplete.
- fix: Drain synchronous completions iteratively, using a trampoline that resumes when an input write genuinely waits for backpressure. Preserve ordering and invoke the batch callback exactly once.

### sol-1-2
- file: scratchpad/effected/cli/ui/TextInput.ts:363
- class: bug   severity: required
- standard: `ui/internal/lineText.ts` requires widget text from data to be sanitized before measurement and cutting; `TextInput` promises a one-line input; D9 and section 14 permit a verified upstream-bug correction.   evidence: A read-only differential probe rendered `TextInput.screen({ message: "Name", initial: "a\u001b[31mRED\u001b[0m\nSECOND" })` through `CliUiTest.render` with `{ color: "none", columns: 80 }`. Both the pinned oracle and port returned the raw frame `"Name\na\u001b[31mRED\u001b[39m\nSECOND▏\nenter submit · esc cancel"`.
- failure: The unmasked value bypasses `lineText`. An initial value can inject ANSI styling even at color `none` and add physical rows despite the input’s one-line contract. The message, placeholder, validation message, and mask are sanitized, but the value itself is not.
- fix: Sanitize and fold the display segments before `windowAround` measures them and before Ink renders them. Keep the original value and cursor semantics for editing, validation, and submission. Record the verified upstream-bug deviation under section 14.

### sol-1-3
- file: scratchpad/effected/cli/ui/Viewport.ts:264
- class: bug   severity: required
- standard: `ui/UiTheme.ts`, `useTerminalSize` documentation explicitly prohibits feeding the hook’s `columns` into a `Box` width because Ink repaints before React updates; `Viewport` promises clipped rows that do not wrap; D9 and section 14 permit a verified upstream-bug correction.   evidence: A read-only differential probe mounted a one-row viewport containing 100 `X` characters in a production-path `CliUiTest.session` at 80 columns, then resized it to 20 columns. Both the pinned oracle and port captured two new frames: first 79 `X` characters, then 19.
- failure: Both the outer box and each row retain `width: size.columns` during Ink’s immediate resize repaint. On a real 20-column terminal, the interim 79-column row wraps before the corrected frame arrives, creating the stale-frame artifact described by `useTerminalSize`.
- fix: Remove both widths derived from the hook. Express the outer one-column margin through layout, such as `marginRight: 1`, and let clipped row boxes stretch within that current layout. Record the verified upstream-bug deviation under section 14.

### sol-1-4
- file: scratchpad/effected/cli/ui/testing/terminalModel.ts:30
- class: bug   severity: required
- standard: `screenAfter` promises to ignore other escape sequences and return what the terminal shows; D9 and section 14 permit a verified upstream-bug correction.   evidence: A read-only differential probe passed `"\u001b]8;;https://example.com\u001b\\label\u001b]8;;\u001b\\\n"` to `screenAfter(text, 24)`. Both the pinned oracle and port returned `["]8;;https://example.com\\label]8;;\\"]`, rather than `["label"]`.
- failure: The OSC branch recognizes only BEL-terminated sequences. A valid ST-terminated OSC 8 hyperlink falls through to the printable-character branch, so `CliUiTest` transcripts display the hyperlink protocol and destination as visible text. This makes transcript assertions and snapshots disagree with the terminal.
- fix: Recognize both BEL and ST (`ESC \`) as OSC terminators and consume the complete sequence. The existing `CliUiTest` escape-stripper already handles both forms. Record the verified upstream-bug deviation under section 14.

### sol-1-5
- file: scratchpad/effected/cli/ui/UiKey.ts:11
- class: schema   severity: required
- standard: D5 requires `LiteralKit` for literal domains; `standards/effect-first-development.md` EF-12b requires schema-first named domains; `standards/ARCHITECTURE.md`, Core Principle 5, makes Schema the source of truth for pure data models.   evidence: `KeyName` is a handwritten 16-member literal union, while `UiKey` at line 38 is a handwritten payload union with independent constructors at lines 42 and 84. `CliUiTest.ts` separately enumerates the same named-key domain in `KEY_BYTES`. No canonical key schema or `LiteralKit` exists in `UiKey.ts`. These modeling requirements are not established by the four green mechanical law gates.
- failure: A named, reused key domain and its data variants remain TypeScript-only declarations. They provide no canonical schema-derived guard, decoder, or arbitrary, and the runtime key inventory is maintained separately from the domain definition. This violates the binding schema and literal-domain requirements.
- fix: Define `KeyName` with an identity-annotated `LiteralKit` and derive its type. Define the `Named` and `Char` payloads through a schema tagged union, retaining the existing `UiKey.fromInk`, `named`, and `char` API and plain payload behavior.

### sol-1-6
- file: scratchpad/effected/cli/ui/TextInput.ts:252
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; D4 preserves upstream prose; the review brief explicitly defers S2 and makes documentation findings backlog.   evidence: The class documentation retains `@example` at line 252 and `@remarks` at line 248. The same legacy carriers remain throughout the focused UI files, including `CliUiTest.ts:825` and `:1053`. Public exports also lack canonical `@category` and `@since` tags.
- failure: The documentation has not reached the required beep carrier and metadata format: examples lack titled `**Example** (Title)` sections, and detail prose remains under forbidden `@remarks` tags. This is deferred S2 work.
- fix: During S2, preserve the existing prose and examples, convert their carriers to titled Example and Details/Gotchas sections, and add canonical categories, `@since 0.0.0`, and useful examples where required by export kind.

### sol-1-7
- file: scratchpad/test/cli/ui/Viewport.test.ts:54
- class: test   severity: backlog
- standard: D10 requires property run counts through `@beep/fc-runs` using `fcRuns(n)`; the review brief explicitly defers S3 and makes test-canon findings backlog.   evidence: Both viewport properties use `{ arbitrary: { runs: 400, size: 300 } }`, at lines 54 and 65, without importing or calling `fcRuns`.
- failure: The property suites bypass the required centralized run-count policy. Their passing upstream tests do not establish compliance with the deferred S3 property contract.
- fix: During S3, import `fcRuns` from `@beep/fc-runs` and replace both raw run counts with `fcRuns(400)`, preserving the tested properties and size setting.

REQUIRED: 5
BACKLOG: 2
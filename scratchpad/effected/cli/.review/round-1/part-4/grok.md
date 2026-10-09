I'll review this CLI UI slice against the port decisions and the pinned upstream oracle, starting with the binding decisions, recorded deviations, and the files in scope.The review is scoped to the UI slice and the pinned oracle. Next I’ll load the deviation rules and the files themselves.Port notes record no deviations. I’ll diff this slice against the pinned upstream files and read anything that diverged.The assertion and law gates look clean on this slice. I’ll compare the widget and internal implementations with the pinned upstream sources for behavior drift.`inkProps` and a few thrown errors were reshaped. I’ll check those against Effect’s `dual` and the rest of the rewritten internals.I'll confirm the remaining candidates against the oracle and the decision text, then report only what those files still show.The decision text treats an unrecorded observable difference as a deviation. I'll check how earlier seats scored the same error-name pattern, then pin the line numbers.### grok-1-1
- file: scratchpad/effected/cli/ui/Viewport.ts:12
- class: bug   severity: required
- standard: D9, section 14 (formatted failure line)   evidence: `S.TaggedError($I\`DuplicateViewportKeyError\`)` goes through `Schema.Error`, and `makeClass` assigns `prototype.name` to that identifier (`Schema.ts` 16221–16223 and 15933–15935). `$I` is `@beep/scratchpad/effected/cli/ui/Viewport/DuplicateViewportKeyError` (`Id.ts` `appendIdentityValue`). `Error.prototype.toString` is `${name}: ${message}`. `CliFailure.dieBlocks` prints `String(defect)` (`CliFailure.ts` 99–102, 277). Upstream throws `new Error` (`Viewport.ts` 67), whose name is `Error`. The throw is line 80. `Viewport.test.ts` 201 asserts `defect.message` only, so the green suite misses the header.
- failure: A duplicate item key dies as `@beep/scratchpad/effected/cli/ui/Viewport/DuplicateViewportKeyError: @effected/cli/ui: Viewport item keys must be unique; "…" repeats`. Upstream prints `Error: @effected/cli/ui: Viewport item keys must be unique; "…" repeats`. The stack header uses the same name.
- fix: On the class, `override readonly name = "Error"`, the same override `TestError` and `ConsoleTrace` already use.

### grok-1-2
- file: scratchpad/effected/cli/ui/UiTheme.ts:15
- class: bug   severity: required
- standard: D9, section 14   evidence: Same `Schema.Error` name assignment as grok-1-1. Thrown at line 69. Upstream is `throw new Error(OUTSIDE)` (`UiTheme.ts` 54). `CliFailure.describe` prints `String(defect)`.
- failure: A theme hook outside a screen dies as `@beep/scratchpad/effected/cli/ui/UiTheme/MissingUiThemeError: @effected/cli/ui: a theme hook was used outside a screen mounted by CliUi.run or a UiProvider`. Upstream prints that sentence with the `Error:` prefix.
- fix: `override readonly name = "Error"` on `MissingUiThemeError`.

### grok-1-3
- file: scratchpad/effected/cli/ui/internal/ScreenContext.ts:9
- class: bug   severity: required
- standard: D9, section 14   evidence: Same name assignment. Thrown at line 62. Upstream is `throw new Error("…outside a screen…")` (`ScreenContext.ts` 54).
- failure: `useScreenCancel` outside a screen dies as `@beep/scratchpad/effected/cli/ui/internal/ScreenContext/ScreenContextError: @effected/cli/ui: a widget was used outside a screen mounted by CliUi.run or a UiProvider`. Upstream prints the `Error:` prefix.
- fix: `override readonly name = "Error"` on `ScreenContextError`.

### grok-1-4
- file: scratchpad/effected/cli/ui/internal/ink.ts:16
- class: bug   severity: required
- standard: D9, section 14   evidence: `InkNotLoaded` has no `name` override. `TestError` at line 21 does, and it is the missing-peers defect, so that path already matches `new Error`. `inkModules` throws `InkNotLoaded` at line 92. Upstream throws `new Error(READ_BEFORE_LOAD)` (`ink.ts` 79).
- failure: Rendering a kit before `loadInk` dies as `@beep/scratchpad/effected/cli/ui/internal/ink/InkNotLoaded: @effected/cli/ui read Ink before loading it: …`. Upstream prints the `Error:` prefix. The stack header changes with it.
- fix: `override readonly name = "Error"` on `InkNotLoaded`.

### grok-1-5
- file: scratchpad/effected/cli/ui/internal/lazyView.ts:12
- class: bug   severity: required
- standard: D9, section 14   evidence: `LazyViewStateError` has no `name` override. Thrown at line 104 (`NOT_LOADED`) and line 126 (loader is not a function). Upstream line 83 is `throw new Error(NOT_LOADED)`. `CliUiLive` dies with `error.cause`, so this object is the defect `CliFailure` prints.
- failure: A lazy render before load dies as `@beep/scratchpad/effected/cli/ui/internal/lazyView/LazyViewStateError: @effected/cli/ui: a CliUi.lazyView render was called before its module loaded; …`. Upstream prints the `Error:` prefix.
- fix: `override readonly name = "Error"` on `LazyViewStateError`.

### grok-1-6
- file: scratchpad/effected/cli/ui/internal/lazyView.ts:60
- class: bug   severity: required
- standard: D9, section 14   evidence: Upstream `export class LazyViewShapeError extends Error {}` (`lazyView.ts` 41) has `name === "LazyViewShapeError"`. `Data.TaggedError("LazyViewShapeError")` already sets `prototype.name` to that tag (`internal/core.ts` 697). The instance field forces `"Error"`. Thrown at line 72. `CliUiLive` mount dies with that object (`Effect.die(error.cause)`), and `dieBlocks` prints `String(defect)`. The degraded warning uses `.message` only, so the warning line matches; the defect header does not.
- failure: A load that resolves to no view dies as `Error: @effected/cli/ui: CliUi.lazyView's load resolved to …. Expected …`. Upstream prints `LazyViewShapeError: ` plus the same sentence.
- fix: Delete `override readonly name = "Error"`.

### grok-1-7
- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:41
- class: bug   severity: required
- standard: D9, section 14   evidence: `CliUiTestError` takes its name from `$I\`CliUiTestError\``. Dies at lines 516, 683, 777, 779, 790, and 1010. Upstream dies with `new Error(message)` at the same sites (`CliUiTest.ts` 503, 670, 767, 769, 780, 1002). Tests assert `defect.message` substrings (`CliUiTest.test.ts` 288 and 305, `session.test.ts` 60).
- failure: An unknown key, a key after the screen ended, a rerender before mount or after end, and a `session.next` timeout die as `@beep/scratchpad/effected/cli/ui/testing/CliUiTest/CliUiTestError: <message>`. Upstream dies as `Error: <message>`.
- fix: `override readonly name = "Error"` on `CliUiTestError`.

### grok-1-8
- file: scratchpad/effected/cli/ui/Viewport.ts:12
- class: docs   severity: backlog
- standard: section 14, law 7 (`standards/effect-laws-v1.md`)   evidence: `PORT_LEDGER.json` cli `deviations` is `[]`. README Port notes say `Deviations: None`. Each `S.TaggedError` / `Data.TaggedError` above adds an own `_tag` that upstream `Error` does not have. Law 7 forces that. The name overrides in grok-1-1 through grok-1-7 restore the printed line; they do not remove `_tag`.
- failure: The ledger and README record no deviation for the extra `_tag` on `DuplicateViewportKeyError`, `MissingUiThemeError`, `ScreenContextError`, `InkNotLoaded`, `TestError`, `LazyViewStateError`, `LazyViewShapeError`, `LazyViewLoadError`, and `CliUiTestError`.
- fix: One ledger row, cause `law:7`, naming those tags, plus the same sentence under README Port notes → Deviations. Cite the message-only tests.

### grok-1-9
- file: scratchpad/effected/cli/ui/TextInput.ts:68
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`   evidence: S2 has not run. This slice still uses `@remarks` and `@example` (`TextInput.ts` 68, 248, 252; `Tabs.ts` 106; `UiTheme.ts` 76; `UiStreams.ts` 10; `terminalModel.ts` 9; `ScreenContext.ts` 53; `ink.ts` 53; `CliUiTest.ts` class example).
- failure: Exported docs still use the tags the JSDoc law replaces with `**Details**` and `**Example**`.
- fix: Leave it for S2. Convert carriers only; do not drop bodies.

REQUIRED: 7
BACKLOG: 2

<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review this CLI UI slice read-only against the pinned upstream oracle, the port decisions, and the round-1 inventory, and report only new findings.### fable-2-1
- file: scratchpad/effected/cli/ui/TextInput.ts:413
- class: bug   severity: required
- standard: D9 and section 14; `ui/internal/lineText.ts` (widget text is sanitized before it is measured or cut); `Fmt.sanitize` (a sequence split across two strings must not reassemble, and a lone tail must not remain as text). The recorded TextInput upstream-bug entry only covers a cursor at the end of the value.
- evidence: `shownBefore` / `shownAfter` are `lineText` of each raw slice. `stripAnsi` only removes a complete CSI/OSC (`displayWidth.ts` `ANSI`), and `sanitize` then deletes a leftover ESC. For value `a\u001b[31mRED` with the cursor between ESC and `[`, the before-slice becomes `a` and the after-slice is the literal `[31mRED`. A cursor between `\r` and `\n` folds each half, so one CRLF is drawn as two spaces. `Intl.Segmenter` treats those bytes as separate graphemes, so Left/Right can land there. The hostile-value regression renders the initial state, whose cursor is `value.length`, so both slices are not split.
- failure: Moving into an initial or edited escape sequence paints the sequence tail at color `none` and can open another row. A cursor inside CRLF widens the folded line, so `windowAround` measures the wrong string.
- fix: Fold and strip the whole value in one pass, and map the raw cursor through that same pass (a CRLF or ANSI sequence that straddles the cursor counts once, as removed or as one space). Keep the submitted value raw. Extend the hostile-value regression with a mid-sequence cursor and a cursor between CR and LF.

### fable-2-2
- file: scratchpad/effected/cli/ui/TextInput.ts:421
- class: bug   severity: required
- standard: `UiTheme.ts` `useTerminalSize` (text cut to the hook’s `columns` is one paint stale; the prescribed clip is Ink `wrap: "truncate-end"`); section 14 upstream-bug, same mechanism as the Viewport resize fix. Upstream TextInput, Toggle, and the Tabs column have the same cut and no `truncate-end` (`Tabs.ts` sets it only on the row `ink.Text` at line 328).
- evidence: TextInput `windowAround` and the message/error `Fmt.truncate` calls size the string with `useTerminalSize().columns`. Toggle does the same at `Toggle.ts:66` and draws it with `ink.Text` at line 69. Tabs column mode draws those pre-cut labels with no `wrap`. Ink repaints the existing tree on `resize` before the hook’s effect re-renders. A value already cut to 79 cells is then painted into a 20-column terminal with Ink’s default wrap.
- failure: The immediate shrink frame wraps the stale row. That extra row is the scrollback wipe `lineText` documents, and it lands before the corrected window.
- fix: Set `wrap: "truncate-end"` on the TextInput value `ink.Text`, the Toggle label text, and the Tabs column label text (pass it through `Styled` for the message, error, and accent tabs). Add an 80-to-20 resize regression for a long TextInput value. Forward the upstream-bug entry centrally.

### fable-2-3
- file: scratchpad/effected/cli/ui/internal/inkChalk.ts:109
- class: effect-idiom   severity: required
- standard: Effect interruption is a `Cause` that `Effect.catchCause` handles; recovering it continues the fiber. Upstream `inkChalk` was `async` inside `try/catch`, and `Effect.promise` still failed the effect with the interrupt. D11 effect-idiom. The native-runtime deviation records the FileSystem move, not this recovery.
- evidence: `resolve` ends in `Effect.catchCause(() => Effect.succeed(O.none()))`, and both the injected-service path and the `NodeFileSystem` path run that effect. `withInkColour` is `Effect.flatMap(resolveChalk, holdChalkLevel)` and is yielded from screen mount. An interrupt during `realPath` or the dynamic `import` becomes `None`, then `holdChalkLevel` logs the unresolved-chalk warning and succeeds.
- failure: Ctrl-C or scope close during the first chalk resolution is swallowed. The mount continues, Ink keeps its own color level, and the warning claims the chalk module could not be resolved.
- fix: Use `Effect.catchCauseIf` so only non-interrupt causes become `O.none()`. Let an interrupt cause fail the effect unchanged.

### fable-2-4
- file: scratchpad/effected/cli/ui/internal/ink.ts:15
- class: schema   severity: required
- standard: Operator step 4 (annotations on fields and schemas); `standards/effect-first-development.md` EF-12. The four syntax gates do not read schema AST metadata. cli-3 fixed other CLI errors; these constructors are still bare. The identity-annotations deviation records errors that gained annotations, not these omissions.
- evidence: `InkNotLoaded` (`ink.ts:15`), `ScreenContextError` (`ScreenContext.ts:9`), `LazyViewStateError` (`lazyView.ts:11`), `DuplicateViewportKeyError` (`Viewport.ts:12`), and `MissingUiThemeError` (`UiTheme.ts:15`) pass no `$I.annote(...)` and leave `message` as plain `S.String`. `ConsoleTrace` (`inkConsole.ts:20`) and `CliUiTestError` (`CliUiTest.ts:43`) have a schema annotation and an unannotated `message` field. `MissingInkPeersError` in the same `ink.ts` file already has both.
- failure: Schema tooling sees no domain description for the five errors, and no field description for any of these `message` fields.
- fix: Add a meaningful `$I.annote` description and a `message` field annotation on each of these seven errors. Do not change tags, `name`, or messages.

REQUIRED: 4
BACKLOG: 0

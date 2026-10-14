<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the github-actions focus files read-only against the pinned upstream oracle, the round-2 inventory, and the port decisions, and report only new findings.### fable-3-1
- file: scratchpad/effected/github-actions/Artifact.ts:489
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). `UploadOptions.retentionDays` must be positive or the call fails `invalidOptions` before any upload.   evidence: `retentionDays <= 0` does not reject `NaN` or `Infinity` (`NaN <= 0` and `Infinity <= 0` are both false). The expiry is then `Clock.currentTimeMillis + retentionDays * 86_400_000`, and `DateTime.makeUnsafe` at line 539 calls `new Date(input)` and throws `IllegalArgumentError` on a non-finite or out-of-range epoch (`effect` `internal/dateTime.ts` `fromDateUnsafe`). The pinned oracle does the same with `new Date(...).toISOString()` after `transfer.uploadFile`. The throw sits in the `FinalizeArtifact` body thunk, which runs only after the zip upload at line 523, and `Effect.gen` turns it into a defect.
- failure: A non-finite or overflowing retention uploads the archive, never finalizes it, and dies instead of returning `ArtifactError` `invalidOptions`.
- fix: Before `scratch`, reject a retention that is not a finite number greater than 0, or whose epoch millis falls outside the ECMAScript date range, with the existing `invalidOptions` message. Record the verified upstream bug centrally and add an `Artifact.test.ts` case that performs no upload.

### fable-3-2
- file: scratchpad/effected/github-actions/Artifact.ts:498
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). `UploadOptions.compressionLevel` says out-of-range values are clamped to `0..9`.   evidence: `options?.compressionLevel ?? 6` keeps `NaN`. `clampLevel` is `Math.min(9, Math.max(0, Math.trunc(level)))`, and every `Math` step preserves `NaN`. POSIX argv becomes `"-NaN"`. On Windows, `dotnetCompressionLevel(NaN)` falls through every `<=` test and selects `SmallestSize`.
- failure: `NaN` is not clamped. POSIX fails the archive; Windows silently packs at `SmallestSize`.
- fix: If `compressionLevel` is present and not finite, fail `invalidOptions` before `zip`. Leave finite values to `clampLevel`. Add a regression that does not spawn `zip`.

### fable-3-3
- file: scratchpad/effected/github-actions/ActionOutputs.ts:415
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). `GITHUB_PATH` is one directory per line.   evidence: `addPath` appends `` `${path}\n` `` with no break check. `set`, `exportVariable`, and `ActionState` already refuse CR/LF via `isUsableName`. The pinned oracle uses the same template string. A path `"/opt/a\n/opt/b"` is two runner PATH entries.
- failure: One accepted path prepends extra directories for later steps, including an empty segment when the value itself contains a line break.
- fix: Before the append, reject a path containing LF or CR with a typed `ActionOutputError` that names `GITHUB_PATH`. Do this in `layer`, `layerDetached` is already a failure, and `recording`. Add an `ActionOutputs.test.ts` case that writes nothing. Record the upstream bug centrally.

### fable-3-4
- file: scratchpad/effected/github-actions/ActionCache.ts:452
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). Resolved tar paths must name the files that were matched.   evidence: `posix` is `replaceAll("\\", "/")` and is applied to every `readDirectory` entry. On POSIX, `\` is a legal filename character, and Node `readdir({ recursive: true })` returns that name. `foo\bar` becomes `foo/bar` before `set.matches`, the line-break guard, and the manifest. GNU `tar -T` also unescapes `\` unless `--verbatim-files-from` is set, and that flag is GNU-only (the file’s own note). The pinned oracle has the same `posix(entry)` call.
- failure: A matched file whose name contains `\` is archived as a different path, dropped, or turned into an extra manifest line by tar’s escape parser.
- fix: Normalize `\` only when `windows` is true. On POSIX, keep the entry text, then reject any resolved path that still contains `\` with `archiveFailed` before the manifest write, same as LF/CR. Add an `ActionCache.test.ts` case with a backslash in a filename and no tar spawn. Record the upstream bug centrally.

### fable-3-5
- file: scratchpad/effected/github-actions/Action.ts:172
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11. Round 2 r12: a boolean that chooses which effect to run is not caught by the green tsgo, oxlint, or four beep-law gates.   evidence: `stepDebug && LogLevel.isGreaterThan(minimum, "Debug") ? Effect.provideService(program, References.MinimumLogLevel, "Debug") : program`.
- failure: The step-debug level drop is boolean orchestration instead of `Bool.match`.
- fix: Import `effect/Boolean` as `Bool` and match with lazy branches, preserving the lower-only condition and the original program.

### fable-3-6
- file: scratchpad/effected/github-actions/Action.ts:350
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11. Same missed-gate evidence as fable-3-5.   evidence: `Exit.isSuccess(exit) ? Effect.void : Effect.gen(...)` selects the failure renderer.
- failure: The run verdict is a boolean branch over two effects.
- fix: Use `Exit.match` with `onSuccess` as `Effect.void` and `onFailure` as the current renderer. Keep `Console.log`, the debug dump, and `process.exitCode = 1`.

### fable-3-7
- file: scratchpad/effected/github-actions/ActionOutputs.ts:278
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `isUsableName(name) ? effect : Effect.fail(InvalidOutputNameError.make({ file, name }))`.
- failure: The heredoc name gate chooses an effect with a boolean ternary.
- fix: `Bool.match` with lazy branches. Keep the same error payload and the success effect.

### fable-3-8
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:350
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `Number.isFinite(parsed) ? Effect.succeed(parsed) : Effect.fail(ActionEnvironmentError.make(...))`.
- failure: `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT` parsing is boolean effect selection.
- fix: `Bool.match(Number.isFinite(parsed), { onTrue: () => Effect.succeed(parsed), onFalse: () => Effect.fail(...) })`. Keep the malformed detail string.

### fable-3-9
- file: scratchpad/effected/github-actions/ActionInput.ts:331
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `S.is(S.Literals(allowed))(raw) ? Effect.succeed(raw) : Effect.fail(configError(...))`.
- failure: Literal-input acceptance chooses an effect with a boolean ternary.
- fix: `Bool.match` on the `S.is` result with lazy branches. Keep the allowed-set message and the raw `actual`.

### fable-3-10
- file: scratchpad/effected/github-actions/ActionInput.ts:830
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `P.isString(name) ? ambient.load([inputVariable(name)]) : Effect.as(Effect.void, undefined)`.
- failure: Flat versus nested config lookup is boolean effect selection.
- fix: `Bool.match(P.isString(name), ...)` with lazy branches. Keep `inputVariable` for the string arm and the undefined miss for every other path.

### fable-3-11
- file: scratchpad/effected/github-actions/ActionLogger.ts:413
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `if (stepDebug || LogLevel.isLessThanOrEqualTo(minimum, "Debug")) return yield* effect`, otherwise the buffer is built.
- failure: Whether a step is buffered is a boolean orchestration branch.
- fix: `Bool.match` with lazy branches: the true arm yields `effect` unchanged; the false arm is the current buffer setup. Preserve the debug bypass, warn passthrough, and `onSuccess` flush policy.

REQUIRED: 11
BACKLOG: 0

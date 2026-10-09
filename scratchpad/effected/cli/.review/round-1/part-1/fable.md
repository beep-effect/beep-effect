### fable-1-1
- file: scratchpad/effected/cli/CliExit.ts:11
- class: bug   severity: required
- standard: D9 / EFFECTED_PORT_GOAL §14 (any different formatted byte is a deviation; none recorded: README Port notes 'Deviations: None', ledger deviations: [])   evidence: `S.TaggedError<X>(identifier)` resolves to `Error(identifier ?? tagValue)` (node_modules/effect/dist/Schema.js:9435-9444), so the `$I` identifier becomes the runtime `name`. Probe (bun -e, scratchpad/): `CliExit.set(256)` → `plainFailureLines(cause)` = ["[FAIL] @beep/scratchpad/effected/cli/CliExit/InvalidExitCodeError: CliExit.set: exit code must be an integer 0..255, received 256", …]; `String(defect)` and `defect.name` carry the same string. Upstream (oracle CliExit.ts:66) dies with `new Error(...)` → `[FAIL] Error: CliExit.set: …`. The port already knows the trick: CliRuntime.ts:50 sets `override readonly name = "Error"` on CliRuntimeError so CliMain.test.ts:112 keeps `[FAIL] Error: CliRuntime.main: …`; CliExit.test.ts:44-49 asserts only `defect.message`, so the gate cannot see this.
- failure: A program that calls `CliExit.set` with a bad code gets a different first line in the kit's own failure report (and in `String(err)`, `Cause.pretty`, bare `runMain` output): the `$I` path replaces `Error`.
- fix: Add `override readonly name = "Error";` to InvalidExitCodeError (exactly as CliRuntimeError does at CliRuntime.ts:50).

### fable-1-2
- file: scratchpad/effected/cli/CliExit.ts:83
- class: bug   severity: required
- standard: D9 / §14; law 22 allows `Effect.fn` or `Effect.fnUntraced`, the port chose the traced form upstream never used   evidence: `Effect.fn(name)` wraps the body in `useSpan(name)` and pushes a `CurrentStackFrame` (node_modules/effect/dist/internal/effect.js:880-927). `CliFailure.spanBlocks` (CliFailure.ts:364-382) keeps every span whose definition file is not under `node_modules/@effected/` or `node_modules/effect/` — the lab file is neither. Probe: `CliExit.set(256)` report lines include `"in: set"`; `Cause.pretty(cause)` now contains `at set (…/CliExit.ts…)`. Control `Effect.fnUntraced` version prints no `in:` line. `rg 'Effect\.fn\(' <oracle>/packages/cli/src` → no matches: upstream CliExit.set is a plain `Effect.gen`.
- failure: Every failure raised inside `CliExit.set` renders an extra `in: set` paragraph in the kit's default report and an extra frame in `Cause.pretty`; a consumer with a Tracer installed also receives a `set` span upstream never emitted.
- fix: Replace `Effect.fn("set")(function* …)` with `Effect.fnUntraced(function* …)` (same `Effect.fn.Return` annotation stays valid).

### fable-1-3
- file: scratchpad/effected/cli/CliPrompt.ts:69
- class: bug   severity: required
- standard: D9 / §14   evidence: Probe (CliInteractive default false): `CliPrompt.fallback(Prompt.succeed("x"), { flag: "name" })` → report lines ["[FAIL] ~effect/cli/CliError/MissingOption: Missing required flag: --name", "in: fallback"]; with `{ argument: "name" }` → ["…MissingArgument: Missing required argument: name", "in: fallback"]. The `Cancelled` die on QuitError (line 75) runs inside the same span. Upstream (oracle CliPrompt.ts:62-73) is `Effect.gen` with no span, so no `in:` trail exists. Mechanism as in fable-1-2.
- failure: A non-interactive run that lacks `otherwise`, or a cancelled prompt, prints an `in: fallback` line that upstream never printed; tracer consumers get a `fallback` span.
- fix: Use `Effect.fnUntraced(function* <A>(…) { … })` for `fallback`.

### fable-1-4
- file: scratchpad/effected/cli/Cancelled.ts:21
- class: bug   severity: required
- standard: D9 / §14; D5 asks for identity annotations, which `$I.annote(...)` (already passed as the third argument) carries without touching `name`   evidence: Probe: upstream form `S.TaggedError<U>()("Cancelled", …)` → `name === "Cancelled"`, `String(u) === "Cancelled"`; ported `Cancelled.make({reason:"escape"})` → `name === "@beep/scratchpad/effected/cli/Cancelled/Cancelled"`, `String(c) === "@beep/scratchpad/effected/cli/Cancelled/Cancelled: cancelled; nothing written"`, `Cause.pretty(Cause.die(c))` starts with that string. Same for NotInteractive.ts:19 (`name === "@beep/scratchpad/effected/cli/NotInteractive/NotInteractive"`). CliPrompt.ts:55-56 documents that under a bare `runMain` this error 'prints a stack' — that is `Cause.pretty`, whose first line changed. The kit's own fixed-line rendering (CliFailure.ts:276/307) is unaffected, which is why no test catches it.
- failure: `error.name`, `String(error)`, `error.toString()` in a consumer `render`, `Cause.pretty` and the default-logger output under a bare `runMain` all print the `$I` path instead of `Cancelled` / `NotInteractive`.
- fix: Add `override readonly name = "Cancelled";` to Cancelled (and `"NotInteractive"` to NotInteractive.ts:19), keeping `$I\`…\`` and `$I.annote` for schema identity; or drop the first-call identifier and keep identity solely in `$I.annote`.

### fable-1-5
- file: scratchpad/effected/cli/CliRuntime.ts:609
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form when behaviour is unchanged); tsgo `strictEffectProvide`/`multipleEffectProvide` are `error` in tsconfig.base.json:217/180 and the lab's sanctioned escape is a `// @effect-diagnostics-next-line <rule>:off` directive with a reason (DIAGNOSTIC_EXCEPTIONS.md, e.g. glob/GlobPattern.ts:41)   evidence: node_modules/effect/dist/internal/layer.js:6-8: `provideLayer = (self, layer) => effect.scopedWith(scope => effect.flatMap(Layer.buildWithScope(layer, scope), context => effect.provideContext(self, context)))` and `provide` dispatches to it. The lab inlines that exact body at CliRuntime.ts:609, 610, 611, 613 and CliLog.ts:492-496, 612-614, 615-617, 628 where upstream wrote `Effect.provide(...)` (oracle CliRuntime.ts:591-595, CliLog.ts:611-616, 628, 490-491). `rg 'Effect\.provide\(' scratchpad/effected/cli --glob '*.ts'` → only JSDoc examples survive, so the rewrite exists to silence the two diagnostics, not to change behaviour. The terse-effect law gate only detects helper-ref / thunk-helper / flow-candidate / option-compaction / nested-match / optional-spread / dual-overload kinds (packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:613-669), so it cannot see this.
- failure: Eight copies of a library internal replace one helper call, hide every `Effect.provide` from the diagnostics that exist to review them, and will silently diverge if effect changes `provideLayer` (e.g. memo-map handling); readers cannot see that the chain is upstream's deliberate provide order.
- fix: Restore `Effect.provide(layer)` at each site (the chained ones in `main` are deliberate: `inside` must build under `platform`, so they cannot be merged) and precede each with `// @effect-diagnostics-next-line strictEffectProvide:off` (plus `multipleEffectProvide:off` on the chained sites) carrying the reason, then list them in DIAGNOSTIC_EXCEPTIONS.md as the other exceptions are.

### fable-1-6
- file: scratchpad/effected/cli/CliRuntime.ts:578
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Set) and the Allowlist Contract ('Do not add entries for scanner misses or cleanup convenience … remediate the module when the exception is ordinary application code')   evidence: CliRuntime.ts:578-581 keeps upstream's `Effect.provideService(Logger.CurrentLoggers, new Set<Logger.Logger<unknown, unknown>>([makeCliLogger(envLog?.logger)]))` under allowlist row `EFFECTED-CLI-CURRENT-LOGGERS` (standards/effect-laws.allowlist.jsonc:262-269, reason: 'the reference value must be that native set'). `Logger.layer(loggers)` builds that set itself (node_modules/effect/dist/Logger.js:860-866: `Layer.effect(CurrentLoggers, … new Set(...) … add(logger))`), and the port already uses exactly that for the identical 'warn through a private CliLogger' pattern at CliLog.ts:492-496 (`Logger.layer([cliLogger])`) and for the empty set at CliLog.ts:616 (`Logger.layer([])`). The native-runtime gate is green only because of the allowlist row.
- failure: A native `Set` stays in domain logic behind an allowlist entry whose stated necessity is false; the two sibling sites in the same module already prove the Effect-native form.
- fix: `yield* Effect.logWarning(invalid).pipe(Effect.provide(Logger.layer([makeCliLogger(envLog?.logger)])))` (with the same directive as fable-1-5) and delete the `EFFECTED-CLI-CURRENT-LOGGERS` allowlist row.

### fable-1-7
- file: scratchpad/effected/cli/CliLog.ts:563
- class: bug   severity: required
- standard: D9 / §14 (same mechanism as fable-1-2 and fable-1-3)   evidence: `rg 'Effect\.fn\("' scratchpad/effected/cli` lists, in the focus files, CliLog.ts:221 (`readLevel`), CliLog.ts:563 (`CliLog.status`), CliLog.ts:622 (`buildTimeDecision`), CliMessage.ts:54 (`CliMessage.status`), CliLinks.ts:151 (`build`), CliTest.ts:101 (`sandbox`); the oracle `packages/cli/src` has zero `Effect.fn` / `Effect.fnUntraced` calls, so every named span is a port addition. Each installs a tracer span and a `CurrentStackFrame` entry (internal/effect.js:880-927); any die inside (`vocab.def(name)` on an unknown status in `status`, a `makeTempDirectoryScoped` PlatformError in `sandbox`, a Walker/FileSystem defect in `build`) renders `in: <name>` as fable-1-2 proved, and an installed Tracer receives spans named `status`, `readLevel`, `buildTimeDecision`, `build`, `sandbox`. NDJSON is not affected (`Logger.formatStructured` reads `CurrentLogSpans`, not tracer spans: Logger.js:478-511), which is why the logging tests stay green.
- failure: Failure reports gain `in: <name>` trails and tracer output gains spans that upstream never produced; the choice between `fn` and `fnUntraced` was made per site with no recorded rationale.
- fix: Switch these six sites (and, module-wide, every other port-added `Effect.fn("<name>")`: Render.ts:178, Doc.ts:964, TestTerminal.ts:75, internal/autoFormat.ts:32, internal/fileSink.ts:36/44, internal/HelpRouting.ts:29, internal/failureTarget.ts:94, ui/**) to `Effect.fnUntraced`, which satisfies law 22 without a span.

### fable-1-8
- file: scratchpad/effected/cli/CliExit.ts:86
- class: law   severity: required
- standard: D9 / §14 procedure: a gate-forced deviation needs a ledger `deviations` entry (`law:<id>`) and a README Port notes → Deviations row before the code change; both currently say none   evidence: Probe: inside `Effect.fnUntraced`, `Effect.die(new Error("x"))` reports ["[FAIL] Error: x","stack","  at <anonymous> …/[eval]:11:78","  (+1 internal frames hidden)"] and `Effect.die(new Tagged({message:"x"}))` keeps the user frame too, but `Effect.die(Tagged.make({message:"x"}))` reports ["[FAIL] Tagged: x","stack","  no user frames (2 internal frames hidden)"]: `.make` captures the stack inside Schema.js/interpreter.js. The port uses `.make` at CliExit.ts:86 and CliRuntime.ts:604 (upstream: `new Error(...)`), and `newSchemaClass` is `error` in tsconfig.base.json:183, so `new` is gate-forbidden — the deviation is forced, not fixable. A second forced surface: `CliRuntime.reported("x")` now returns a CliRuntimeError whose own keys are `["_tag","name"]` and `JSON.stringify` gives `{"_tag":"CliRuntimeError","message":"x","name":"Error"}` where upstream's `new Error(String(error))` gives `{}` (law 7 forces S.TaggedError). CliMain.test.ts:110-113 asserts only `err[0]`, so neither byte is test-pinned. README.md 'Deviations: None'; PORT_LEDGER.json w4-cli `deviations: []`.
- failure: Two observable differences from upstream (the `stack` block of a schema-error defect, and the own-property surface of `reported()`'s wrapper) exist with no recorded cause, so the next reviewer or consumer cannot tell a forced deviation from a regression.
- fix: Add ledger `deviations` entries for w4-cli with causes `law:newSchemaClass` (stack block of InvalidExitCodeError/CliRuntimeError defects: 'no user frames' instead of the call-site frame) and `law:7` (`reported()` wrapper carries `_tag`/`message`/`name` own properties), citing CliMain.test.ts:110-113 as the covering test, and mirror them under README Port notes → Deviations.

### fable-1-9
- file: scratchpad/effected/cli/CliAudience.ts:19
- class: bug   severity: backlog
- standard: D9 (observable only through `UserError.cause`, which the kit never renders)   evidence: AudienceConflictError carries `$I\`AudienceConflictError\`` so its `name` is `@beep/scratchpad/effected/cli/CliAudience/AudienceConflictError`; upstream (oracle CliAudience.ts:78) used `new Error(CONFLICT)` (name `Error`). `CliError.UserError`'s message getter returns `userMessage` (node_modules/effect/dist/cli/CliError.js:492) and `CliFailure.causeTree` only walks defects, so the kit's output is unchanged; only a consumer inspecting `error.cause.name` / `String(error.cause)` sees it.
- failure: `String(userError.cause)` differs from upstream for a consumer that introspects the conflict error's cause.
- fix: Add `override readonly name = "Error";` to AudienceConflictError for parity with CliRuntimeError.

### fable-1-10
- file: scratchpad/effected/cli/CliRuntime.ts:546
- class: type-safety   severity: backlog
- standard: readability / overload design (upstream used a cast the port correctly removed; the replacement is a no-op branch)   evidence: `("file" in envLog ? CliLog.layer(envLog) : CliLog.layer(envLog))` — both branches are textually identical; the conditional exists only to narrow `CliLogOptions | CliLogFileOptions` so one of the six `CliLog.layer` overloads (CliLog.ts:358-415) matches, because no overload accepts the union.
- failure: A reader sees a branch that selects nothing; the implementation signature (CliLog.ts:416-418) already accepts the union but is hidden by the overloads.
- fix: Add a public overload `static layer(options: CliLogOptions | CliLogFileOptions): Layer.Layer<never, never, Audience | TerminalEnv | FileSystem.FileSystem | PathModule.Path>` and call `CliLog.layer(envLog)` once.

### fable-1-11
- file: scratchpad/effected/cli/CliLog.ts:575
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21 spirit (tersest equivalent form); leftover from removing the upstream `as unknown as Status<...>` cast   evidence: `const core = vocab;` followed by `core.def("failure")` / `core.def("warning")` — `core` is a bare alias of `vocab` now that the cast is gone (upstream CliLog.ts:574-577 needed the alias to hold the widened type). CliMessage.ts:67 already reads `vocab.def("warning")` directly.
- failure: Dead alias and a stale comment-free indirection in a public API body.
- fix: Delete the alias and use `vocab.def("failure")` / `vocab.def("warning")` as CliMessage does.

REQUIRED: 8
BACKLOG: 3

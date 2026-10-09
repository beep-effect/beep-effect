### fable-1-1
- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:12
- class: bug   severity: required
- standard: D9 (behaviour-preserving); upstream fakeStreams.ts gave stdin no-op `ref: () => stdin, unref: () => stdin`   evidence: MemorySocket extends a handle-less net.Socket and inherits Node's `Socket.prototype.ref/unref`, which on `!this._handle` do `this.once('connect', this.ref)` and return (printed from node v24.20.0). Ink 7.1.1 calls `stdin.ref()` on raw-mode enable (node_modules/ink/build/components/App.js:225) and `stdin.unref()` on disable (App.js:137), so every input screen adds two `connect` listeners that never fire. Probe against the lab file (`bun -e` importing scratchpad/effected/cli/ui/testing/fakeStreams.ts, six setRawMode/ref/unref cycles): `connect listeners after 6 screens: 12` and `MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 connect listeners added to [MemoryInput]`. Current tests stay under the threshold (wizard.test.ts mounts at most 3 screens per session), so the gate did not see it.
- failure: A `CliUiTest.session` (one fake stdin for every screen) with six or more input screens, or any longer-lived fake, prints Node's MaxListenersExceededWarning on the real process stderr and leaks one closure per raw-mode toggle; upstream's fakes never registered a listener.
- fix: In MemorySocket add `override ref(): this { return this; }` and `override unref(): this { return this; }` (restores upstream's no-op semantics without a cast).

### fable-1-2
- file: scratchpad/effected/cli/ui/internal/inkChalk.ts:7
- class: law   severity: required
- standard: standards/effect-laws-v1.md §7 + Allowlist Contract ("Do not add entries for scanner misses or cleanup convenience… remediate the module"); EFFECTED_PORT_GOAL 2026-10-09 grilling (evasion rejected: "Object.defineProperties, which only evades the law"); D9 §14 (adjusted test must be recorded)   evidence: `const { realpathSync } = process.getBuiltinModule("node:fs")` replaces upstream's `import { realpathSync } from "node:fs"`. The native-runtime checker (packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:87) flags only ImportDeclarations of node:fs/node:path/node:child_process, so the call form hides the site; no allowlist entry exists for inkChalk.ts. To keep the boundary test green, scratchpad/test/cli/boundary.test.ts:110-116 was rewritten: upstream line `"ui/internal/inkChalk.ts forbidImports node:fs"` became `"ui/internal/inkChalk.ts process process"` and the `process` waiver list gained inkChalk.ts, while the doc comment at line 107 still says the licence is `forbidImports` of node:fs. README Port notes → Deviations and the ledger row say None.
- failure: The native-runtime gate reports zero sites for a file that still reads node:fs synchronously; the upstream process-streams licence test no longer holds the licence it documents; the test edit is an unrecorded D9 deviation.
- fix: Restore `import { realpathSync } from "node:fs"` and either add the allowlist entry with the upstream licence (okf/decisions/ui-binds-process-streams.md) as its reason or route realpath through the FileSystem service in the fix wave (operator green-lit the API change); restore the upstream NODE_LICENCE line and record the deviation (ledger + README) citing boundary.test.ts.

### fable-1-3
- file: scratchpad/effected/cli/ui/Viewport.ts:12
- class: law   severity: required
- standard: D9 / §14 (any observable difference: a different error name is one); the module's own precedent keeps `override readonly name = "Error"` on ConsoleTrace (inkConsole.ts), TestError (ink.ts) and LazyViewShapeError (lazyView.ts)   evidence: Installed effect: `class E extends S.TaggedError("id/E")("E",{message})` yields `e.name === "id/E"` and `String(e) === "id/E: boom"` (node probe). `$I\`DuplicateViewportKeyError\`` resolves to `@beep/scratchpad/effected/cli/ui/Viewport/DuplicateViewportKeyError`, so the thrown error's name and stack header change from upstream's `Error: @effected/cli/ui: Viewport item keys must be unique…`. Same at ScreenContext.ts:9 (ScreenContextError), UiTheme.ts:15 (MissingUiThemeError), internal/ink.ts:16 (InkNotLoaded), internal/lazyView.ts:12 (LazyViewStateError), testing/CliUiTest.ts:41 (CliUiTestError). inkConsole.ts:60 prints `arg.stack` for Errors and Inspectable.toStringUnknown emits `{"name":…}`, so the name reaches logs and test output. No deviation entry exists.
- failure: Every console/log/vitest rendering of these six errors now carries a long identity string where upstream printed `Error:`; law 7 forces S.TaggedError but not the name change, so this is an unforced, unrecorded behaviour difference.
- fix: Add `override readonly name = "Error";` to each of the six classes (as the module already does for its other three), or, if the new name is wanted, record one systemic tagged-errors deviation entry listing the sites.

### fable-1-4
- file: scratchpad/effected/cli/ui/internal/ink.ts:20
- class: law   severity: required
- standard: standards/effect-laws-v1.md §7 ("extend S.TaggedError from effect/Schema directly for typed errors"); .patterns/error-handling.md (S.TaggedErrorClass + $I identity); the laws commit itself describes the class as "S.TaggedError with unchanged messages"   evidence: `class TestError extends Data.TaggedError("TestError")<…>` is the production error `loadInk` dies with for MISSING_PEERS (ink.ts:66); internal/lazyView.ts:59 `LazyViewShapeError extends Data.TaggedError(...)` and :112 `LazyViewLoadError extends Data.TaggedError(...)` likewise. The lint only flags `new Error`, so Data.TaggedError passes the gate while violating the law's letter; `TestError` is a copy of the test helper in scratchpad/test/cli/ui/CliUiTest.ergonomics.test.ts and leaves a production failure tagged `_tag: "TestError"`, reachable through `Effect.catchTag`.
- failure: Three typed errors in production source bypass the schema-backed error law and one carries a test-helper name as its public tag.
- fix: Define them as `S.TaggedError<X>($I\`X\`)("X", { message: S.String, cause: S.optionalKey(S.Defect) })` (keep `override readonly name = "Error"`, construct with `.make`), and name the missing-peers error for what it is (e.g. `MissingInkPeers`).

### fable-1-5
- file: scratchpad/effected/cli/ui/testing/fakeStreams.ts:5
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL 2026-10-09 ruling (restore changes no law forced); D9 §14 (record adjusted tests)   evidence: `process.getBuiltinModule("node:net" | "node:readline" | "node:tty")` replaces plain imports although none of those modules is in the checker's NODE_RUNTIME_IMPORTS (only fs/path/child_process); D15 forced the cast removal, which `import { Socket } from "node:net"` serves equally. scratchpad/test/cli/boundary.test.ts:110-116 gained `"ui/testing/fakeStreams.ts process process"` and the `process` waiver list gained fakeStreams.ts; upstream's licence (`forbidImports node:stream` only) is now satisfied by a type-only `import("node:stream")`. Nothing recorded in README Port notes or the ledger.
- failure: The process-streams licence the boundary test documents as exact was widened silently; the file reads Node through a form the scanner cannot see.
- fix: Use plain `node:net`/`node:readline`/`node:tty` imports, add the matching `forbidImports` licence lines, and record the D15-forced deviation (sites + boundary.test.ts lines) in README Port notes → Deviations and the ledger.

### fable-1-6
- file: scratchpad/effected/cli/README.md:233
- class: docs   severity: backlog
- standard: D9; §14 procedure; 2026-10-09 ruling ("one ledger plus README deviation entry per module per systemic class … listing sites and adjusted upstream tests")   evidence: README `### Deviations` says None and the ledger row has `deviations: []`, while this part carries law-forced observable changes: identity keys on Context.Reference (ui/UiStreams.ts:38, ui/internal/renderOptions.ts:44), nine S.TaggedError/Data.TaggedError conversions with new `_tag`/name, the boundary-test licence rewrite (fable-1-2, fable-1-5), and `NodeServices.layer` added to scratchpad/test/cli/ui/CliUi.run.test.ts:560 to replace a cast.
- failure: The port's own contract has no record of what diverged from the oracle or which upstream tests were adjusted.
- fix: Generate the per-class entries (identity keys, tagged errors, native-runtime replacements, adjusted tests) in PORT_LEDGER.json `deviations` and README Port notes → Deviations in the fix wave.

### fable-1-7
- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:748
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md §21 (tersest equivalent helper); effect-tsgo docs/rules/strict-effect-provide.md ("If this is an entry point, you can safely disable this diagnostic")   evidence: `(self) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(terminal.layer, scope), (context) => Effect.provideContext(self, context)))` here and at :1099 is `Effect.provide(terminal.layer)` spelled out; upstream used `Effect.provide`. The expansion has the exact scope lifetime the rule warns about and only moves the site out of the rule's sight. The 2026-10-09 ruling blessed this shape for the two Logger.CurrentLoggers sites, not for a test harness mount. The port already uses scoped directives (`// @effect-diagnostics-next-line schemaNumber:off`, glob/GlobPattern.ts:41).
- failure: Two unreadable inlined provides that the strictEffectProvide gate cannot audit.
- fix: Restore `Effect.provide(terminal.layer)` under `// @effect-diagnostics-next-line strictEffectProvide:off` with a one-line entry-point reason, or extend the recorded ruling to name these sites.

### fable-1-8
- file: scratchpad/effected/cli/ui/UiTheme.ts:88
- class: effect-idiom   severity: backlog
- standard: EFFECTED_PORT_GOAL 2026-10-09 ruling (restore unforced shape changes); standards/effect-laws-v1.md Dual-Arity Inventory Contract ("A callable shaped `(input, options?)` is excluded because its one-argument form is already complete")   evidence: Public `inkProps(style, color?)` was wrapped in `dual((args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]), …)` with an added `(color?) => (style) => InkTextProps` overload. No law or diagnostic required it; it widens the public type so `inkProps()` / `inkProps(undefined)` now type-check and return a function instead of props. Callers (UiTheme.test.ts:11-27, Styled) all use the data-first form.
- failure: Unforced public API shape change versus the oracle.
- fix: Restore the plain `(style, color?) => InkTextProps` arrow (keeping the `O.getSomesStruct` body if wanted).

### fable-1-9
- file: scratchpad/effected/cli/ui/testing/terminalModel.ts:22
- class: effect-idiom   severity: backlog
- standard: EFFECTED_PORT_GOAL 2026-10-09 ruling (restore unforced shape changes); Dual-Arity Inventory Contract `(input, options?)` exclusion   evidence: `screenAfter(written, rows?)` became `dual((args) => P.isString(args[0]), …)` with a `(rows?) => (written) => …` overload; every caller (CliUiTest.ts:1022-1122, inkConsole.test.ts) is data-first and the optional second parameter already excludes it from the dual inventory.
- failure: Unforced internal shape change; `screenAfter()` now returns a function instead of failing to type-check.
- fix: Restore the plain function.

### fable-1-10
- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:734
- class: effect-idiom   severity: backlog
- standard: D9; standards/effect-laws-v1.md §22 (Effect.fn or Effect.fnUntraced)   evidence: `mount = Effect.fn("mount")(…)` and public `CliUiTest.live = Effect.fn("live")(…)` (:1083) add named spans that upstream's `Effect.gen` bodies never opened; law 22 is satisfied equally by `Effect.fnUntraced`, the zero-diff form, which the same file already uses for `swapTo` and `next`. Spans are observable through tracers and the kit's own span trail when kit files are not under node_modules (the lab layout).
- failure: Every live-view test and harness mount now carries a `live`/`mount` span the oracle never emitted.
- fix: Use `Effect.fnUntraced` for both.

### fable-1-11
- file: scratchpad/effected/cli/ui/internal/lazyView.ts:126
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL §11.3 (a branch unreachable by construction is a finding against the source)   evidence: `loadView` reads `render[LOAD]` only after `P.hasProperty(render, LOAD)`, then inside `tryPromise.try` guards `if (!P.isFunction(ensure)) throw LazyViewStateError.make({ message: "lazy view loader is not a function" })`. `LOAD` is assigned only at lazyView.ts:106 (`render[LOAD] = ensure`, always a function), so the throw cannot execute and S3's per-file 100% branch floor will fail here; the message also lacks the module's `@effected/cli/ui:` prefix.
- failure: An untestable branch and an off-style message in the lazy-view loader.
- fix: Narrow once: `const ensure = P.hasProperty(render, LOAD) && P.isFunction(render[LOAD]) ? render[LOAD] : undefined;` and drop the inner throw.

### fable-1-12
- file: scratchpad/effected/cli/ui/testing/CliUiTest.ts:573
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md §21 (shared thunk helpers already in scope; tersest equivalent form)   evidence: `Clock.Clock.defaultValue().currentTimeMillisUnsafe()` is spelled out at 15 sites (573, 640, 653, 686-688, 712, 770-772, 775-776, 784, 788-789, 999-1000, 1012, 1105); `CliUiTest.live` spreads five single-key `O.getSomesStruct({ k: O.fromUndefinedOr(k) })` calls (1086-1091) and UiProvider.ts:87-88 two, where one call per object does the same.
- failure: Codemod residue that obscures the timing logic upstream wrote with `Date.now()`.
- fix: Add `const now = (): number => Clock.Clock.defaultValue().currentTimeMillisUnsafe();` at module level and collapse each spread group into one `O.getSomesStruct({...})`.

### fable-1-13
- file: scratchpad/test/cli/ui/CliUi.run.test.ts:1
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL §3.2 (zero tsgo diagnostics is the gate) and §11.2 (S3 canon migration); goals/effect-vitest-canon/SPEC.md   evidence: 68 files under scratchpad/test/cli carry file-wide `// @effect-diagnostics <rule>:skip-file` headers (strictEffectProvide, multipleEffectProvide, asyncFunction, globalTimers, newPromise, nodeBuiltinImport); e.g. this file, CliUiTest.crash.test.ts, wizard.test.ts, Tabs.test.ts, Holder.test.ts. S1 keeps upstream tests verbatim (vi.mock async factories, real timers), so the headers are the S1 trade-off, but a file-wide skip also hides every later instance.
- failure: The tsgo gate is blind to those rules across most of the module's tests, including sites S3 could rewrite (`new Promise`, `setTimeout`, async helpers).
- fix: In S3 narrow each header to `@effect-diagnostics-next-line` at the sites vitest's own API forces (vi.mock factories) and migrate the rest to Effect forms.

REQUIRED: 4
BACKLOG: 9

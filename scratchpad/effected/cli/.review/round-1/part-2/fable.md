### fable-1-1
- file: scratchpad/effected/cli/internal/HelpRouting.ts:29
- class: bug   severity: required
- standard: D9 + section 14 (no law forces a span: law 22 / EF-14 accept `Effect.fnUntraced`, which EF-14 prefers for internal helpers); CliFailure span rule (CliFailure.ts:314 `isKitFile` only excludes `node_modules/@effected|effect`, so a lab-source span is the program's)   evidence: Upstream wrapped `program` in a bare `Effect.gen`; the port uses `Effect.fn("routeHelpOnUsageError")`, which opens a span around the whole user program. Read-only probe (bun, lab CliFailure.toDoc + Render.plain on a cause produced under each wrapper): `fn app "✗ Error: boom\nin: routeHelpOnUsageError"`, `fn all "✗ Error: boom\nin: routeHelpOnUsageError"`, `fnUntraced app "✗ Error: boom"`, `fnUntraced all "✗ Error: boom"`. CliRuntime.ts:596 applies this wrapper whenever `helpOnUsageError === "stderr"`. No upstream test combines `helpOnUsageError: "stderr"` with a rendered failure trail (CliHelpRouting.test.ts asserts only stream routing), so the green test gate did not see it.
- failure: Every failure report of a program run with `helpOnUsageError: "stderr"` gains an `in: routeHelpOnUsageError` line (appended to any real trail) under the default `spans: "app"` in a checkout and under `spans: "all"` everywhere; upstream prints none. An observable byte deviation with no `law:` or `upstream-bug:` cause and no ledger/README record.
- fix: Replace `Effect.fn("routeHelpOnUsageError")(function* <A, E, R>(...)` with `Effect.fnUntraced(function* <A, E, R>(...)` (same body, same `Effect.fn.Return` annotation).

### fable-1-2
- file: scratchpad/effected/cli/internal/fileSink.ts:36
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14 (span name is the function's name; `Effect.fnUntraced` for internal paths) and node_modules/effect/CLAUDE.md ("The name string should match the function name"); D9   evidence: `export const makeFileSink = Effect.fn("append")(function* (path, installed, underActions) ...` at :36 reuses the inner helper's name (`const append = Effect.fn("append")` at :44), so the outer span is labelled `append`. Upstream had `Effect.gen` with no span on either. `rg -n 'Effect\.fn\(' scratchpad/effected/cli/internal/fileSink.ts` -> 36:`Effect.fn("append")`, 44:`Effect.fn("append")`.
- failure: Any trace or failure trail that passes through the file-sink layer construction reports a span named `append` for `makeFileSink`: wrong telemetry, and a second span upstream never opened. The signature line is also a single 260-column line with the body left at the old indentation, so the file no longer reads as the rest of the module does.
- fix: Use `Effect.fnUntraced(function* (...) {...})` for both `makeFileSink` (:36) and the inner `append` (:44), restoring upstream's span-free behaviour; if a span is wanted, name it `"makeFileSink"` and record the deviation. Re-wrap the signature onto the module's line width.

### fable-1-3
- file: scratchpad/effected/cli/Status.ts:113
- class: law   severity: required
- standard: D9 ("each [deviation] is recorded in README Port notes → Deviations and the ledger, citing the adjusted upstream test") and section 14 procedure; precedent scratchpad/effected/jsonl/README.md:662-671 (deviation 21, "Error names carry the lab identity", pinned by ErrorDeviations.test.ts:82) and the jsonc ledger `deviations[]` records for `law:7` throws   evidence: Ledger row `w4-cli` has `deviations: []`; README Port notes → Deviations says `None`. Read-only probe against the pinned upstream source: `Status.core.def("nope")` upstream throws `{name:"Error", ctor:"Error", str:"Error: Unknown status \"nope\"; ..."}`; lab throws `{name:"@beep/scratchpad/effected/cli/Status/UnknownStatusError", tag:"UnknownStatusError", ctor:"UnknownStatusError", str:"@beep/scratchpad/effected/cli/Status/UnknownStatusError: Unknown status ..."}` (message identical). `new NotInteractive({})`: upstream `name:"NotInteractive"`, `String(e)` = `NotInteractive: not interactive: ...`; lab `name:"@beep/scratchpad/effected/cli/NotInteractive/NotInteractive"` (NotInteractive.ts:19 passes `$I`NotInteractive`` as the identifier). `internal/ExitRequested.ts:11` moved from `extends Error` to `Data.TaggedError("ExitRequested")` (`name`/`_tag` change). No test in scratchpad/test/cli mentions `Unknown status` or `UnknownStatusError`.
- failure: Three observable deviations (thrown value's `name`, `String(error)`, first stack line, `_tag`) are in the tree with valid causes (`law:7`, `law:D5`) but no ledger entry, no README entry and no pinning test, so the next round cannot tell an accepted deviation from a regression and the `ledger --verify` record understates the module's surface.
- fix: Append three `deviations` records to the `w4-cli` ledger row ({test, upstreamBehaviour, labBehaviour, reason}) and the matching README Port notes → Deviations entries, mirroring jsonl deviation 21: (1) `Status.def` throws `UnknownStatusError` (reason `law:7`), (2) `NotInteractive.name`/`String()` carry the `$ScratchpadId` identity (reason `law:D5`), (3) `ExitRequested` is a tagged error (reason `law:7`); pin (1) and (2) with a small `ErrorDeviations.test.ts` as jsonl does, and update the `def` JSDoc at Status.ts:107 ("throws an `Error`").

### fable-1-4
- file: scratchpad/effected/cli/internal/ExitRequested.ts:11
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 ("extend `S.TaggedError` from `effect/Schema` directly for typed errors"); .patterns/error-handling.md `S.TaggedErrorClass` pattern and checklist line 626; D5 (`$ScratchpadId` identity on every error)   evidence: `export class ExitRequested extends Data.TaggedError("ExitRequested")<{ readonly message: string }>` with a hand-written constructor (`super({ message: \`exit ${code}\` }); this.name = "ExitRequested"`). It is the only `Data.TaggedError` in this module (`rg -ln 'Data\.TaggedError' scratchpad/effected/cli` -> ExitRequested.ts plus two `ui/internal` files outside this part); `NotInteractive.ts:19` in the same module already shows the `S.TaggedError<Self>($I`...`)` + `override get [Runtime.errorExitCode]()` shape. Callers: CliRuntime.ts:607 `new ExitRequested(code)`, CliRuntime.ts:400 `instanceof`, scratchpad/test/cli/CliRuntime.test.ts:223 `new ExitRequested(2)`.
- failure: A typed error declared outside the schema layer: no `$ScratchpadId` identity, no schema for `code`, and a bespoke constructor the rest of the lab's errors do not have, so the module fails the D5 end-state bar and law 7's prescribed base class.
- fix: `const $I = $ScratchpadId.create("effected/cli/internal/ExitRequested"); export class ExitRequested extends S.TaggedError<ExitRequested>($I`ExitRequested`)("ExitRequested", { code: S.Number }, $I.annote("ExitRequested", { description: "A successful program recorded a non-zero exit code through CliExit." })) { override readonly [Runtime.errorReported] = false; override get [Runtime.errorExitCode](): number { return this.code; } override get message(): string { return `exit ${this.code}`; } }`; change `new ExitRequested(code)` to `new ExitRequested({ code })` at CliRuntime.ts:607 and CliRuntime.test.ts:223 (cite the test in the fable-1-3 deviation record).

### fable-1-5
- file: scratchpad/effected/cli/Status.ts:12
- class: schema   severity: required
- standard: .patterns/error-handling.md `S.TaggedErrorClass` pattern (every error carries `$I.annote("Name", { description })`); D5 identity annotations land in S4; same-module precedent NotInteractive.ts:19   evidence: `class UnknownStatusError extends S.TaggedError<UnknownStatusError>($I`UnknownStatusError`)("UnknownStatusError", { message: S.String })` has no third `$I.annote(...)` argument, while `NotInteractive` in this module and every jsonl error (JsonlError.ts:72-88) carry one; the `def` JSDoc at :107 still says the method "throws an `Error`".
- failure: The error's schema has an identifier but no title/description annotations, so docgen/`S.toJsonSchema` and the identity audit see a half-annotated error, and the carried JSDoc misdescribes what is thrown.
- fix: Add `$I.annote("UnknownStatusError", { description: "A status name the vocabulary does not have." })` as the third argument, and reword the `def` remark to "throws `UnknownStatusError`".

### fable-1-6
- file: scratchpad/effected/cli/Doc.ts:964
- class: effect-idiom   severity: backlog
- standard: D9 (behaviour-preserving by default) and EF-14 (`Effect.fnUntraced` where tracing is not needed; span names follow the `Module.method` form the standards use, e.g. `Effect.fn("User.load")`)   evidence: `rg -n 'Effect\.fn\(' <focus files>`: Doc.ts:964 `Effect.fn("print")`, Render.ts:178 `Effect.fn("context")`, TestTerminal.ts:75 `Effect.fn("make")`, internal/failureTarget.ts:94 `Effect.fn("build")`, internal/autoFormat.ts:32 `Effect.fn("autoFormat")`, internal/fileSink.ts:44 `Effect.fn("append")`. Upstream had plain `Effect.gen` at every site (no span). None of these can fail typed, so the added span only reaches a report on a defect path (e.g. a hostile document node dying inside `Doc.print` would print `in: print`), unlike fable-1-1 which wraps the user program.
- failure: Six spans upstream never opened, four with unqualified names (`print`, `context`, `make`, `build`) that are meaningless in a trace, plus the per-call stack capture `Effect.fn` performs on hot paths such as `autoFormat` (every print) and `build` (every audience refresh).
- fix: Switch all six to `Effect.fnUntraced` (behaviour-preserving). If spans are wanted on the public ones, name them `"Doc.print"`, `"Render.context"`, `"TestTerminal.make"` and record the span deviation under section 14.

### fable-1-7
- file: scratchpad/effected/cli/internal/HelpRouting.ts:44
- class: type-safety   severity: backlog
- standard: effect-laws-v1 law 4 (no `any`), D15; lib.es5.d.ts:186 `create(o: object | null): any`   evidence: `const recording: CliOutput.Formatter = Object.assign(Object.create(formatter), {...})` (:44) and `const routing: Console.Console = Object.assign(Object.create(sink), others)` (:82): `Object.create` returns `any`, so `Object.assign(any, X)` is `any` and the annotated `const` checks nothing about the override object. The D15 token gate cannot see a lib-sourced `any`. Upstream had the same hole behind an `as` cast; the `others` object at :63 is already checked by `satisfies Pick<Console.Console, Method>`, but the Formatter overrides at :45-54 are not.
- failure: A drift in `CliOutput.Formatter.formatHelpDoc`/`formatErrors` signatures (or a typo in a method name) compiles silently and only fails at runtime when help is printed.
- fix: Give `Object.assign` explicit type arguments so the second argument is checked: `Object.assign<CliOutput.Formatter, Pick<CliOutput.Formatter, "formatHelpDoc" | "formatErrors">>(Object.create(formatter), {...})` and `Object.assign<Console.Console, Pick<Console.Console, Method>>(Object.create(sink), others)`.

### fable-1-8
- file: scratchpad/effected/cli/Status.ts:111
- class: type-safety   severity: backlog
- standard: D2 (same name and kind; additions listed under Port notes → Added exports); README Port notes → Added exports says `None`   evidence: Upstream: `private readonly defs: Readonly<Record<Names, StatusDef>>`, `private constructor(defs: Readonly<Record<Names, StatusDef>>)`, `def(name: Names): StatusDef`. Lab (:63, :66, :111): all three widened to `Names | CoreStatusName`, apparently to drop the `as Readonly<Record<...>>` cast in `extend` (:96). Because the only constructor path is `Status.core` (`Status<CoreStatusName>`) plus `extend`, `Names` already contains `CoreStatusName` for every instance, so the widening is semantically a no-op but changes the public `def` signature upstream's declaration tests (`declarations.test.ts`, environment-bound) would compare.
- failure: A public method signature differs from upstream without being listed as an added/changed export; a future `Status<Names>` constructed another way would accept core names it does not hold and hit the throw at :113.
- fix: Restore `Names` on `defs`, the constructor and `def` if the cast-free `extend` still type-checks (the spread's inferred type is `Readonly<Record<Names, StatusDef>> & Extra`); otherwise keep the widening and list it under README Port notes → Added exports with the reason.

### fable-1-9
- file: scratchpad/effected/cli/README.md:226
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md 10.3 README adaptation; Port notes template (Attribution lists package, commit, licence)   evidence: Lines 226-227 under `### Attribution` read `- scratchpad/effected/cli/ui/internal/processStreams.ts:5 * One of the three files licensed to touch Node: it reads` and `- scratchpad/effected/cli/ui/internal/processStreams.ts:7 * The boundary test holds that licence exact.` — truncated `rg` output pasted into the attribution list.
- failure: The attribution section carries two meaningless bullet fragments that read as licence claims.
- fix: Delete the two lines (or, if a note about the Node-touching files is wanted, write it as a sentence under a separate heading).

### fable-1-10
- file: scratchpad/effected/cli/ui-testing-serializer.ts:13
- class: docs   severity: backlog
- standard: D13 (no `@effected/*` specifiers inside the lab) applied to carried examples; EFFECTED_PORT_GOAL.md 10.2 carrier conversion (S2 not yet run); TESTS_NOT_PASSING.md notes `scratchpad/vitest.effected.config.ts` registers no serializer   evidence: The `@packageDocumentation` example still reads `test: { snapshotSerializers: ["@effected/cli/ui/testing/serializer"] }`; every other example in the focus files was rewritten to the lab path. Related prose mentions: TestTerminal.ts:63 (`@effected/cli/testing`), ui-testing.ts:2 (`@effected/cli/ui`). The parity gate checks import specifiers only, so it did not flag the string.
- failure: A reader following the example registers a module the lab does not have; the one upstream test that depends on registration (`CliUiTest.serializer.test.ts`) stays red for the same reason.
- fix: Point the example at the lab module (`snapshotSerializers: ["./scratchpad/effected/cli/ui-testing-serializer.ts"]`) and, when S2 runs, rewrite the two prose mentions to the lab entrypoints; registering the serializer in `scratchpad/vitest.effected.config.ts` would also turn the environment-bound test green.

### fable-1-11
- file: scratchpad/effected/cli/internal/displayWidth.ts:6
- class: docs   severity: backlog
- standard: D4 (not carried: `biome.json` and release tooling); the lab lint gate is oxlint, not biome   evidence: `// biome-ignore lint/suspicious/noControlCharactersInRegex: ...` survives at internal/displayWidth.ts:6 and Fmt.ts:28 while no biome configuration exists in the lab (`rg -n 'biome-ignore' <focus files>` -> those two lines; the oxlint gate is green without them).
- failure: Stale suppression directives for a linter that never runs here; a reader assumes a lint exception is in force when none is.
- fix: Drop both comments, or replace them with the oxlint directive if `no-control-regex` is ever enabled for the lab.

REQUIRED: 5
BACKLOG: 6

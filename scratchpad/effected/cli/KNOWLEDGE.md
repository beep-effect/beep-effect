# cli — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/cli/CLAUDE.md -->
# @effected/cli

The boundary layer of an `effect/cli` program: `CliLogger`,
`CliRuntime` (including `CliRuntime.main`), `CliExit`, `CliColor`,
`SchemaIssueRenderer`, `ConfigIssueRenderer` — plus a `./testing` subpath
exporting `CliTest`, for spawning a built bin hermetically in tests. Every
export but `CliTest` is presentation, and `CliTest` is test tooling behind
its own entrypoint so it never enters a CLI's runtime import graph.

It also owns how a program's output is written for whoever is reading it: the
document IR (`Doc`, plain frozen nodes), the pure renderers over a
`RenderContext` (`Render.plain`, `ansi`, `markdown`, `githubLog`, and
`Render.context(stream)` to build one from the services), `Doc.print`,
`GithubAnnotation`, editor-aware `CliLinks`, and `CliFailure`, which is how the
default failure report is drawn. An agent is never written an escape of any
kind. Every string that enters a document is sanitised: escape sequences and
control characters are removed, a tab becomes a space, and line breaks are kept
as breaks. A status vocabulary's glyphs are sanitised too, at one source
(`Status.glyph`, which a theme's `status`, `CliMessage`, `CliLog.status` and
`Doc` all draw through), so a glyph built from data cannot inject an escape
on a trusted line; a theme's glyph set (separators, ellipsis) is configuration.
`okf/modules/cli.md` has the rows.

**Design doc:** `@./okf/modules/cli.md` — Load when:
changing the public surface, the logger's stream routing, the failure-reporting
combinator or the renderers. It carries the reasoning this file only
states. The consumer record behind it is
`@./okf/consumers/reposets.md` — Load when: weighing a
new request against what the first consumer actually reported.

## The rule that defines scope

**Not a CLI framework.** `effect/cli` owns parsing, flags, the command
tree and help. If a change here starts to look like parsing, it belongs upstream
or nowhere. Presentation and interactive UI are in scope —
`@./okf/decisions/cli-grows-presentation-layer.md` — Load when: deciding
whether a capability belongs in this package.

Tier: **boundary** for the root. No platform package, required or optional. The
moment `@effect/platform-node` appears here the package stops being usable from
Bun and Deno for no benefit. `./ui` is integrated, but only for a consumer who
installs its optional peers — `@./okf/decisions/ui-tier-is-integrated-on-opt-in.md`
— Load when: adding a dependency or a peer to this package.

**Nothing in the kit may depend on this but an application or a companion.**
The one kit package that does is `schemastore-cli`, a companion that carries no
tier and imports only the boundary root, so nothing inherits a tier from `./ui`.
Same posture as `app`: the two are siblings, not layers — `app` is the control
plane, `cli` the presentation boundary, and neither imports the other.

## The `./ui`, `./ui/testing` and `./ui/testing/serializer` subpaths

`./ui` holds the interactive screens: `CliUi` (`run`, `prompt`, `fallback`,
`lazy`, `map`, `live`, `lazyView`, `context`), `DocView`, `UiProvider`, the widgets (`Select`, `TextInput`, `MultiSelect`, `Confirm`,
`Toggle`, `Tabs`, `Viewport`), the key layer (`UiKey`, `KeyTable`, `useKeys`,
`KeyHelp`) and the theme bridge (`Styled`, `inkProps`, `useTheme`,
`useGlyphs`, `useTerminalSize`). `./ui/testing` holds `CliUiTest`: `render`
for one screen, `view` for a display-only element (no `result`), `session`
for a program that runs several (with a `transcript` and `written` of the terminal, and
`renderPath: "production"` to observe `clear`), `live` for a live view, and `chunk` on every handle to send keys in
one read. `./ui/testing/serializer` (`src/ui-testing-serializer.ts`)
default-exports `CliUiTest.serializer` for Vitest's `snapshotSerializers`; the root
`vitest.config.ts` registers it that way for this package's own project (#909), so a
snapshot test here uses `expect` for the snapshot alone. `okf/modules/cli.md` has the rows.

- **Optional peers `ink` (^7.1.1) and `react` (^19.2.0).** The root never
  reaches them, and `./ui` imports them only when a screen mounts (`loadInk`),
  so importing `./ui` or running a non-interactive program loads neither,
  except that an owned live view without a `final` document loads them to
  print its final frame as a string. `CliUi.lazyView(load)` defers a live
  view's own module (and its React) to the first Ink draw, and a `final`
  document prints through the `Doc` renderers with no Ink at all; both are
  held by `ui/CliUi.live.reach.test.ts` (#908).
  `src/ui/**` may only `import type` from them: only `ui/internal/ink.ts`
  loads them as values (held by `boundary.test.ts`); a missing peer in an interactive run is a defect
  naming both, never a silent fallback.
- **The ui declarations name the root by its package name.** `src/ui/**`
  imports root types as `import type * as Cli from "@effected/cli"`, and
  `savvy.build.ts` keeps `@effected/cli` and `@effected/cli/ui` external
  (`dtsExternals`), so `ui.d.ts` imports the root instead of inlining a copy
  a consumer's root layers could not satisfy —
  `@./okf/decisions/ui-declarations-reference-the-root-by-name.md` — Load
  when: touching `savvy.build.ts`, an entrypoint, or a root type a ui
  signature names. API Extractor's per-module pass cannot read those
  entries, so `declarations.test.ts` stands in for it: the built exports
  match the source and the pinned reviewed lists, every export carries a
  release tag, nothing is left unexported, and a consumer compiled against
  `dist/dev` resolves `CliTheme` from the root. `tsdocLinks.test.ts` keeps
  `{@link}` targets resolvable. The two "could not harvest per-module source
  locations" build warnings are those entries and are accepted.
- **`CliUi.live` is a scoped live view over a `Stream`, not a screen.** It folds
  events into state in a fiber of the caller's scope and draws runs: a run begins
  at `isStart` (or where an optional `begins(event, before, after)` says, for a
  consumer that joins mid-run) and ends at `isTerminal`; an event outside a run
  that begins none is folded and not drawn, so post-run events never mount a
  second copy, where Ink's own unmount leaves its frame on the terminal; the next
  run mounts afresh below, and `clear()` is never called —
  `@./okf/decisions/live-view-runs-and-modes.md`, `live-never-clears.md` — Load
  when: changing how runs start, end or redraw. One controller fiber owns every
  transition (events, the run's `Schedule.spaced` tick in the run's scope, render
  failures, the stream ending or dying); a failed render degrades the run (unmount
  first, then one warning, the last good frame kept), never kills the view; a
  start during a degraded run ends it and mounts afresh. Clearing a run and
  closing its scope is one uninterruptible step (an interrupt between them
  orphans the mount permit).
  - **Modes** differ only when not interactive (`CliInteractive`: a pipe, a
    non-human audience, or `TERM=dumb`, which cannot move the cursor): `owned`
    prints each run's final frame once as a string at stdout's width, `hosted`
    prints nothing. Neither
    mounts input: Ctrl-C stays the platform's SIGINT and closes the scope.
  - **Subscription and the end:** `events` is a `PubSub.Subscription` (subscribe
    first: the surest) or a stream, whose first pull `live` makes before
    returning (`Stream.fromPubSub` is subscribed; a stream that forks its
    upstream is not). End a view with `handle.close`, which folds what is still
    queued, a subscription's included, and ends the run as the events ending
    would; then close the scope. `PubSub.end(pubsub, last)` is lossless too (the
    view folds the buffer and `last` once, though core repeats it to every take).
    `PubSub.shutdown` drops what the view has not taken, and a bare scope close
    stops the fold at once: both lose a tail. A subscription is taken from
    directly (never `Stream.fromSubscription`), yield-free from a take to the
    inbox, so `close` never drops a taken message.
  - **Height, not width:** the frame is clipped to `rows - 1` (its content keeps
    its height and is clipped, never squeezed); the root takes no width at all —
    `@./okf/decisions/live-height-clamp-not-width.md` — Load when: touching the
    clamp or a widget's width.
  - **Logging while drawn goes through `handle.logConsole`**, which writes every
    `Console` method through Ink's own writers so lines land above the frame, and
    straight to `UiStreams` otherwise; any other write tears the frame —
    `@./okf/decisions/live-logs-through-ink.md`.
  - **An agent and the Actions runner:** an agent gets the colourless theme
    (`CliTheme.forAudience`, the same public rule `Render.context` and `CliLog.status` use) in every tree the
    kit mounts; under GitHub Actions `DocView` neutralizes workflow commands and a
    printed frame is neutralized whole.
  - **`DocView`** draws the `Doc` IR through `Render.ansi`/`Render.plain` as
    `truncate-end` rows, byte for byte the static output; **`UiProvider`** gives a
    tree the kit did not mount the same context (value from `CliUi.context`).
  - **`CliUiTest.live`** drives a view on the production render path under
    `it.effect` (`advance` moves the `TestClock`); `transcript` models the
    terminal, `written` is every raw byte.
- **Ink hands every key of one stdin read over before React re-renders.** A
  key handler must step from current state (a functional update, a reducer
  or a ref), never render-closure state; test it with `chunk` —
  `@./okf/gotchas/ink-delivers-a-chunk-of-keys-before-rerender.md` — Load
  when: writing or reviewing a key handler or a widget.

## Load-bearing decisions

**`CliLogger` reads `Console.Console` off the fiber.** Not a style choice:
`Logger.make` takes a *synchronous* callback and a `Sink` write is an `Effect`,
so `Stdio` is unreachable from a logger. Writing to `process.stdout` would work
and is what the consumer did first — it drags a platform assumption into a
library and makes the stream split untestable, because asserting it means
stubbing a global inside a runner that writes to those same streams.
`Console.Console` is a `Context.Reference`, so it carries a default, never
appears in `R`, and a test swaps it.

**Compare levels ordinally, never by string equality.**
`LogLevel.isGreaterThanOrEqualTo(logLevel, stderrFrom)` is the test; `logLevel
=== "Error" || logLevel === "Fatal"` hard-codes two names and silently misses
any level above them, including one added upstream. `stderrFrom` defaults to
`"All"` and the threshold is the option (#716; breaking on the 0.x line).

**`LogToStderr` is honoured in one direction only.** It can force everything to
stderr; it must never move an error onto stdout. That is the one guarantee this
logger makes and a reference should not be able to revoke it.

**`CliRuntime` is a combinator, not a `runMain`.** The failure it fixes is
*where the report happens*: a platform `runMain` composes its reporting
`tapCause` around the already-provided effect, so the report runs outside your
layers and prints through the default logger on stdout. The fix has to happen
inside the effect. Wrapping `runMain` itself would drag a platform choice into
this package.

**`Runtime.errorReported` has inverted polarity relative to its name.** `false`
is what suppresses the runtime's own report; the marker means "should this be
reported". The intuitive `errorReported: true` — "I have reported it, stay
quiet" — produces exactly the double report it was meant to prevent. The test
for this is written so that flipping the source value **fails**, not so that it
merely records the current one.

**`getErrorExitCode` cannot be used alone to decide a code.** It answers `1`
both for an error marked `1` and for an unmarked one, so an `exitCode` option
would silently override a deliberate `1`. Test for the marker with
`Runtime.errorExitCode in error` to keep "the error chose" distinct from
"nothing chose".

**`reportFailures` never renders `ShowHelp`.** `Command.runWith` already
printed the help text or the parse errors before a `ShowHelp` reaches
`reportFailures`, so rendering it again produces nothing but a stray "Help
requested" line. A `ShowHelp` carrying parse errors is instead remapped to
`usageExitCode` (default `64`, BSD `EX_USAGE`); a bare `--help` or root
invocation — `errors` empty — keeps exit `0`.

**`CliRuntime.main` uses a private `ExitRequested` sentinel, not
`process.exitCode`.** Node's `runMain` skips `process.exit(0)` on success, so
a handler that only sets `process.exitCode` on an otherwise-successful fiber
relies on Node's own process-exit machinery to eventually notice that field —
well after Effect's finalizers had their chance to run, and not at all on a
non-Node runtime. `CliExit.set(code)` records a findings code instead; after
the program succeeds, `main` reads the cell and, if non-zero, fails with the
internal `ExitRequested(code)` sentinel — marked with `Runtime.errorReported:
false` so it routes through core's `defaultTeardown` like any other error,
with finalizers intact, on any runtime. `reportFailures` never renders it:
there is nothing to say, only an exit code a successful program already
chose. Nothing outside this package constructs or matches `ExitRequested`.

**`CliExit.layer` is `Layer.fresh`.** Every provide mints a new cell —
without `Layer.fresh`, layers memoize by reference across `Effect.provide`
calls, so a second provide anywhere in the program (a nested
`CliRuntime.main`, a test helper) would silently share the first run's cell
and inherit its code. **A program run under `CliRuntime.main` must NOT
provide `CliExit.layer` itself** — `main` already provides a fresh cell, and
a second provide creates a second, unrelated cell: `CliExit.set` calls made
against that shadow cell never reach the one `main` reads, and a findings run
silently exits `0`.

**The kit never defaults `env.stderrIsTerminal` from the host.** Core's `Stdio` reports only stdout (Effect-TS/effect#8639), so without the option a redirected stderr is painted because it mirrors stdout. Reading `process.stderr.isTTY` inside the root would break the no-`process` rule ([ui-binds-process-streams](../../okf/decisions/ui-binds-process-streams.md)), so the bin's entry passes it, the one place a bin reads its host. Once core has a stderr check, `CliEnv.layer` reads that instead.

**`FailureDetails.isCancelled` / `isNotInteractive` are flags, `isDefect` is not redefined.** A fallback prompt's quit is a defect and a `CliUi.run` quit a typed failure, so `isDefect` cannot say "not a bug"; the flags test the squashed error's class and hold on either channel. `isDefect` stays `!Cause.hasFails(cause)` and no exit code depends on either.

**`CliColor` delegates to `@effected/env`, which reads the environment through `ConfigProvider`, never `process`.**
`enabled` is `TerminalEnv.colorLevel("stdout") !== "none"`, so it follows Node's
`getColorDepth` precedence: `FORCE_COLOR` first (and it beats `NO_COLOR`), then a
non-empty `NO_COLOR`, `NODE_DISABLE_COLORS` and `TERM=dumb`, then the TTY gate
([decision](../../okf/decisions/force-color-honoured-node-precedence.md)). A test
swaps the environment with `Effect.provideService(ConfigProvider.ConfigProvider, ...)`
instead of mutating `process.env`, or fixes the answer with `TerminalEnv.layerTest`.

**The `./testing` split has a reachability test.** `entrypoints.test.ts`
walks the import graph from `src/index.ts` and asserts nothing reachable from
it imports `CliTest` or `testing.ts`, with a positive control proving the
walker actually resolves imports (`./testing` DOES reach `CliTest`) and a
second control proving it resolves the main entry too (`index.ts` reaches
`CliRuntime`). A CLI that only imports `@effected/cli` therefore never pulls
test-spawning machinery — `effect/process`'s `ChildProcessSpawner`
included — into its runtime bundle.

## The optional peer, and the rule that makes it honest

`@effected/config-file` is a `workspace:^` peer with
`peerDependenciesMeta.optional: true`, consumed only by `ConfigIssueRenderer` —
the same arrangement `@effected/markdown` has with `yaml`/`toml`/`jsonc`.

**`ConfigIssueRenderer` must stay a module no other module imports.** An
optional peer whose import is reachable from a shared module is not optional; it
is a crash for every consumer who took the manifest at its word. Shared
rendering lives in `src/internal/format.ts`, which both renderers import and
neither re-exports. The entrypoint re-exporting `ConfigIssueRenderer` is fine.

Verify this with a build, not by reading: every runtime `import` in
`dist/prod/npm/pkg/**/*.js` must be `effect` or a relative path. The `.d.ts`
carries a type-only import of `ConfigValidationError`, which is erased.

## Testing

The whole surface is testable without stubbing globals: provide a capturing
`Console`, run, and assert on what was written **and on which stream**.

The discriminating mutant for `CliLogger` is **route everything to stdout**. A
suite that still passes is asserting on content and not on stream, which is half
a test — `Warn` is the boundary that catches it.

**Drive levels with `References.MinimumLogLevel`, provided as a service.**
`Logger.withMinimumLogLevel` **does not exist on the v4 line** and is the
obvious first reach. `@effect/vitest`, `it.effect`, `assert.*` — never
`expect`.

**Testing an actual built bin — a real subprocess, not the program in-process
— uses `@effected/cli/testing`'s `CliTest`.** `CliTest.sandbox({ path })`
mints a scoped temp directory with a fresh `HOME` and
`XDG_{CONFIG,DATA,STATE,CACHE}_HOME`, `NO_COLOR: "1"`, and the `path` you
pass as `PATH` — the host environment is never inherited. `CliTest.run(bin,
args, { sandbox, execPath, cwd?, env?, stdin? })` spawns `execPath` with
`[bin, ...args]` over core's `ChildProcess`/`ChildProcessSpawner` and returns
`{ exitCode, stdout, stderr }` as data — a non-zero exit is never a failure.
**When `stdin` is omitted, or passed as `""`, the child receives an
already-ended empty input (`Stream.empty`), never an open pipe** — core's
default `"pipe"` stdio stays open until something writes to and ends it, so a
stdin-reading bin would otherwise hang the test.

```bash
pnpm vitest run packages/cli        # from the repo root
pnpm build --filter @effected/cli   # cold; never the raw savvy.build.ts
```


---
<!-- okf/modules/cli.md -->
---
type: Module
title: "@effected/cli"
description: The presentation boundary of an effect/cli program — audience, colour, theme, messages, logging, failure reporting and schema-issue renderers in a React-free root, with interactive Ink screens behind ./ui and their test harness behind ./ui/testing.
status: stable
kind: package
resource: ../../packages/cli
tags: [dx]
generated:
  by: "okfit/claude-code"
  at: 2026-10-05T18:02:25Z
  body_sha256: 5a40d416487ff6fded47c2a81dfff632821f38ab15328fef41ba536531f0df61
---

# @effected/cli

`@effected/cli` is the presentation boundary of a command-line program built
on `effect/cli`: who the output is for, how it reaches them, how a failure is
reported, and how a schema issue is rendered into a sentence a user can act
on. The [presentation layer](../decisions/cli-grows-presentation-layer.md)
— audience, interactivity, theme, a status vocabulary, messages and logging
composition — lives in a React-free root; interactive screens live
behind a `./ui` subpath the root never reaches, with their test harness behind
`./ui/testing`. It is still not a CLI
framework: `effect/cli` owns argument parsing, flags, the command tree and the
help system, and this package must never grow a second one.

The distinguishing property of everything in scope: a consumer only
discovers the need by shipping bad output to a person. None of it fails a
type-check, a test, or a review of the code in isolation — the default
behaviour is wrong in a way the author cannot see from the call site.

## Motivation: three defaults that are wrong at a terminal

Each of these is found by running a binary, never by reading the code.

1. **Effect's default logger is a service log line, not CLI output.** It
   emits `[00:33:56.619] INFO (#2): message` — correct for a long-running
   service being scraped, wrong for a tool a person is watching. Every
   `effect/cli` program needs a logger that renders the message
   plainly.
2. **An unhandled failure reports through the default logger, on stdout.**
   `NodeRuntime.runMain` reports an unhandled failure using Effect's
   default logger, which sits outside the layers the program was
   provided — so a program that carefully installs a CLI logger still
   prints its failures in the structured format that logger exists to
   replace, and prints them on stdout, the one stream errors must not use
   (`mytool run > log.txt` must still show failures on the terminal).
3. **A `SchemaIssue` tree is not a sentence.** A config validation failure
   arrives as a structured tree; a user needs `unknown key at
   groups.g.cleanup.rulesetz`. Core ships formatters
   (`SchemaIssue.makeFormatterStandardSchemaV1`), but they are
   near-undiscoverable — named `makeFormatter*` rather than anything
   containing "render", living in `SchemaIssue` rather than `SchemaError`
   or `Schema`, and `SchemaError.message` does not use them.

## Kit positioning

**Tier: boundary.** It performs IO — writing to a terminal is IO — but
discharges it through core contracts required in `R`, takes no external
runtime dependency (`string-width` is a test-only `devDependency`; see
[the display-width decision](../decisions/own-display-width.md)), and must not
import a platform package. `@effected/env` is a required peer, so the audience
and terminal decisions are made once and read as services
([its own package](../decisions/env-is-its-own-package.md)); `ink` and `react`
are never imported from the root. This is the
same posture as `@effected/config-file`, and deliberately not
`@effected/github-actions`', which is the one package carrying
`@effect/platform-node` as a required peer.

The dependency closure is declared in full. Required peers: `effect`,
`@effected/env`, and `@effected/walker` with `@effected/glob` beneath it
(`CliLinks` finds the project root with `Walker`: [the walker
edge](../decisions/cli-takes-the-walker-edge.md)). Optional peers:
`@effected/config-file` (for `ConfigIssueRenderer`), and `ink`, `react` and
`@types/react` (for `./ui`). One regular dependency, the pure
[`@effected/github-commands`](github-commands.md), which has no
shared-instance contract and so no need to be a peer.

**Nothing in the kit may depend on it except an application**, the same
rule `@effected/app` carries. A library that reaches for CLI output has
made a decision that belongs to the program at the top. `app` and `cli` are
siblings, not layers: `app` is the control plane (directories, state,
cache, config), `cli` is the presentation boundary. Neither imports the
other.

`@effected/cli` is one of the surfaces the consumer register describes —
see [`reposets`](../consumers/reposets.md), the first repository to weigh
a new request against it.

## Public surface

Exports are static classes with a private constructor — never an
`as const` namespace object, which loses its members' TSDoc in the built
`.d.ts`.

| Export | What it is |
| --- | --- |
| `CliLogger` | A `Logger` rendering messages plainly, routing to stderr from `stderrFrom` down and everything else to stdout |
| `CliRuntime` | The failure-reporting wrapper: report through the program's own logger, set the exit code |
| `CliRuntime.main` | The full-program combinator: provides the platform layer inside failure reporting, a fresh `CliExit`, the `ShowHelp` remap, and the logger outermost. See "Findings are success" below. |
| `MainOptions<RP, EP>` | `ReportFailuresOptions & { platform: Layer<RP, EP>; logger?: Layer<never> }` — `platform` is passed in rather than owned so this package never imports one; `logger` defaults to `CliLogger.layer()`. |
| `CliExit` | A `Context.Service` holding a `MutableRef<number>`; `CliExit.set(code)` and `CliExit.layer` for in-process tests. **`CliExit.layer` is `Layer.fresh`** — every provide mints a new cell, so a program run under `CliRuntime.main` must not provide `CliExit.layer` itself, or `CliExit.set` writes to a second, unread cell and the run silently exits `0`. See "Findings are success" below. |
| `CliColor.enabled` | `Effect<boolean, never, Stdio>` — `TerminalEnv.colorLevel("stdout") !== "none"`, so it honours `FORCE_COLOR` with Node's precedence ([D-C](../decisions/force-color-honoured-node-precedence.md)). Reads go through `Config`, never `process`. |
| `CliColor.formatterLayer` | `(overrides?: Partial<CliOutput.Formatter>) => Layer<never, never, Stdio>` — builds `CliOutput.defaultFormatter({ colors })` from the same `CliColor.enabled` decision, so help text, parse errors and rendered output always agree. |
| `MainOptions.helpOnUsageError` | `"stdout" \| "stderr"`, default `"stdout"` (core's behaviour). Under `"stderr"`, `main` wraps `program` (inside the platform provide, so it sees the platform's Formatter) with `internal/HelpRouting.ts`: a recording `CliOutput.Formatter` notes the strings `formatHelpDoc`/`formatErrors` return, and a routing `Console` holds a `log` of a recorded help string until the next console call. If that call is `error` of a recorded errors string, the help goes to stderr ahead of it; anything else, or the program ending (`ensuring`), releases it to stdout. Needed because core prints help with the same `Console.log` for `--help`, a bare group invocation (a `ShowHelp` with no errors) and a usage error, and only the usage error prints `Console.error(formatErrors)` next (`cli/Command.ts` `showHelp`). Caveats: a Formatter or Console provided inside `program` bypasses it (a Formatter reaches the routing only through `env.formatter`, which `main` installs inside the platform; one the platform or the program provides is invisible to it), and `renderErrors: false` prints no errors, so help stays on stdout. |
| `ReportFailuresOptions.render` | `(error: unknown, details: FailureDetails) => string \| ReadonlyArray<string>`. `error` is `Cause.squash(cause)`; `FailureDetails` is `{ cause, isDefect, isCancelled, isNotInteractive, defaultLines, lines }`, with `isDefect = !Cause.hasFails(cause)` (the literal absence of a typed failure, unchanged) and `isCancelled` / `isNotInteractive` true when the squashed `error` is the kit's `Cancelled` / `NotInteractive`, whichever channel it arrived through (a `CliPrompt.fallback` quit is a defect, a `CliUi.run` one a typed failure), so a `render` that gives defects an issue-report footer checks them first; the flags change no exit code and no default line and `defaultLines` the report the kit would write for this run (its audience, colour, links and `displayPath`), so a `render` returning them writes exactly the default report — exact because `squash` prefers a `Fail` over a `Die`. `lines({ status? })` is the same report (`lines()` equals `defaultLines`); `status: false` drops the leading status and keeps the run's settings, so a prefixing render keeps `displayPath` (vitest-agent A2). Added so a consumer stops guessing "typed" from an `Error` carrying a string `_tag`, which a defect can also be. A one-parameter renderer still fits. A consumer `render`'s lines are text the kit did not build, so the report applies the output policy to them: neutralized under GitHub Actions (always when no environment services exist), and stripped of escapes for an agent or a CI audience (GitHub Actions detects as `ci`); for a person their own escapes are kept (the kit cannot tell colour from injection), so a `render` sanitises the data it interpolates. If that rendering dies, the report falls back to the plain path and then to the error's own text, sanitised and neutralized. The default is `CliFailure.toDoc` rendered through `Render.context("stderr")` and the audience-chosen renderer, still written through `CliLogger` (so `--log-level` and the logger options are unchanged). `reportFailures` catches outside the layers `main` provides, so `main` gives it a per-run cell the environment layer fills with the render target, and `CliAudience.runWith` rewrites it once an audience flag is read. `CliRuntime.defaultRender(error, details, { status? })` is the same document as plain lines, exported so a consumer `render` hands the failures it does not own back (`Cancelled` and `NotInteractive` are their own fixed line); `status: false` leaves off the leading status glyph or `[FAIL]`, so a program-name prefix reads cleanly. |
| `ReportFailuresOptions.usageExitCode` | Remaps a `ShowHelp` that carries errors to this code, default 64 (D7). A `ShowHelp` with no errors keeps exit 0. |
| `SchemaIssueRenderer` | `SchemaIssue` tree → actionable lines, over core's formatter |
| `ConfigIssueRenderer` | The same for `@effected/config-file`'s `ConfigValidationError` |

### The presentation layer

Exports the interactive CLI kit adds to the root. See
[the presentation-layer decision](../decisions/cli-grows-presentation-layer.md)
for why the package owns them.

| Export | Contract |
| --- | --- |
| `CliEnv.layer` | `(options?: CliEnvOptions) => Layer<CliEnvServices, never, Stdio \| Terminal>` with `CliEnvServices = CurrentRuntimeEnv \| TerminalEnv \| Audience \| CliTheme \| CliLinks \| Terminal` — builds the environment services once, in the right order, **sets** the `CliInteractive` reference from the audience and terminal, and installs `CliPrompt.gateTerminal`, `gateWizard` and `CliTheme.promptTheme` (core's prompts follow the theme), so the layer also outputs the gated `Terminal`, which `CliEnvServices` lists. Not interactive, that terminal's `readLine` fails as a quit and its `display` writes nothing. A reference's key type is `never`, so `CliInteractive` is not in the output type. Every read degrades to unset when `Config` fails, so only `Stdio` or `Terminal` failing fails the layer. `CliEnvOptions` is `{ audienceEnvVar?, stderrIsTerminal?, theme?, log?, editorLinks?, editorLinksEnvVar? }`; `log` is read only by `CliRuntime.main`. Without `stderrIsTerminal`, stderr mirrors stdout's terminal check (core's `Stdio` reports only stdout, upstream Effect-TS/effect#8639). The kit never reads the host for it — the root reads no `process` ([ui-binds-process-streams](../decisions/ui-binds-process-streams.md)) — so a Node bin passes the real check from its entry until core has one. |
| `MainOptions.env` | `CliEnvOptions`. When present, `CliRuntime.main` builds `CliEnv.layer(env)` inside failure reporting, where the platform sits, together with `CliColor.formatterLayer` so help text follows the same colour decision, so a failure building it renders one line and exits through the `exitCode` option rather than reaching the runtime's stack trace. `env.displayPath` is the path display (workspace-relative, say) for the default report's stack frames, and `env.stackFrames` (`app` by default, or `all`) which of them it shows, in the report, `defaultLines` and `lines()`; an audience flag's rewrite of the report target keeps both. `env.formatter` replaces methods of the coloured `CliOutput.Formatter` `main` installs (for example `formatVersion`). With `env.log`, `main` builds the platform UNDER the logger, so a line it logs while building goes to stderr, at the run's level and, under `format: "auto"`, in the format the build-time audience gets: an audience flag in `env.log.argv` (a Node host passes `process.argv.slice(2)`, since `Stdio` is the platform's own and the kit never reads `process`), else the `audienceEnvVar` override, else agent/CI detection from the environment, never the terminal; an agent or a CI gets NDJSON and anything else plain, the same audience-only rule the runtime lines follow, so a human piping stderr gets plain lines throughout and stderr's terminal state never decides the format (vitest-agent r5 F2; pass `format: "json"` for machine-readable logs) (vitest-agent A1, ruled (a)+(c): a buffer-and-replay was rejected because a hanging build would hide those lines); no `CurrentRuntimeEnv` exists while the platform builds, so the build-time logger detects one from the environment and uses it (or `env.log.runtimeEnv`) as the neutralization fallback in every format, the plain branch included, so a build-time line is neutralized under GitHub Actions as a runtime one is (r4 review, fix 3); the environment layer is built under its own build-time logger (`envBuildLogLayer`), so the audience-override warning, which interpolates the variable's value, is written exactly once in the build-time format (NDJSON alone for an agent or a CI, floored at `Warning`; a plain line otherwise), neutralized, and never silenced by `plainLogger: false` or an unset diagnostics level, since it is a configuration error; it goes to stderr alone, whatever `logger.stderrFrom` raises (the env build's plain logger alone is pinned at `stderrFrom: "All"`; the platform's build-time logger keeps the host's `stderrFrom`, which is the host's routing choice), and never to `extraLoggers` or the file sink (r4 re-review nit 2); it installs no `MinimumLogLevel` (fix 1 addendum, r4 fix round 2 R1), and uses `CliLog.layer(env.log)` as the logger set (`env.log` may carry the `file` option when the platform provides `FileSystem` and `Path`) instead of the default `CliLogger.layer()` (an explicit `logger` option still wins); the logger is built over the same env layer and falls back to `CliLogger` if that build fails. Not interactive, the program's `Terminal` is gated: `readLine` fails as a quit, so a program reading piped data must read `Stdio.stdin`. Without `env`, nothing is provided and `CliInteractive` keeps its non-interactive default, so forgetting it yields a CLI that never prompts. |
| `CliEnv.layerTest` | `(options?: CliEnvTestOptions) => Layer<CliEnvTestServices>` with `CliEnvTestServices = TerminalEnv \| Audience \| CliTheme`: the environment a test fixes in one layer, in the same build order as `CliEnv.layer`, and it sets `CliInteractive`. `CliEnvTestOptions` is `{ tty?, term?, audience?, columns?, color?, theme? }`: `tty` makes stdin, stdout and stderr all terminals (default `false`, a pipe), `audience` defaults to `human`, `color` to `none` for both streams and is fixed as given (`term` does not change it), `columns` to none, and `term` is the `TERM` that only the theme's glyph choice and the interactivity decision read while the layer builds, whatever the host's `TERM` is (`dumb` is not interactive and draws ASCII). It composes `TerminalEnv.layerTest`, `Audience.layerTest`, `CliTheme.layer` and `CliInteractive.layer`, so a test of a screen or a live view fakes a terminal without composing them by hand. It is in the root, not `./testing`, because it is a pure layer over the root's own services and needs none of the testing entry's platform requirements. |
| `CliAudience.flags` | `(options?: { hidden? }) =>` the four shared flags `audience`, `human`, `agent`, `ci`, each `Flag.atLeast(0)`; spread into `Command.withSharedFlags` on the root. `hidden` applies `Flag.withHidden`. `--audience` names its values once, through core's own `(choices: human, agent, ci)` suffix: it sets no metavar, which would list them a second time (so its placeholder is core's generic `choice`). Core lists shared flags in every subcommand's help, which is upstream (Effect-TS/effect issue 8642). |
| `CliAudience.provide` | Piped onto the composite root (after `withSubcommands`): resolves the flags with `Command.provideEffect` and re-provides env's `Audience` with `source: "flag"`. More than one occurrence is a `CliError.UserError`, exit 64. `run` and `runWith` apply it themselves, so it is the path for a bare `Command.run` only; it then covers the subcommand handler (with the same interactivity decision) but not a fallback prompt. See [the audience flag decision](../decisions/audience-flag-is-shared-root-flags.md). |
| `CliAudience.runWith`, `CliAudience.run` | THE wiring for the audience flag: `Command.make(...).pipe(Command.withSharedFlags(CliAudience.flags()), Command.withSubcommands([...]))`, then `CliRuntime.main(CliAudience.run(root, { version }), { platform, env })`. `runWith(root, config)(argv)` and `run(root, config)` (reads `Stdio.args` like `Command.run`) scan argv for the four flags BEFORE core parses, apply `provide` themselves, and run core inside a provided `Audience` (`{ kind, source: "flag" }` for exactly one flag) and a `CliInteractive` the flag decides from the audience and the TTY facts (`--human` is interactive when `TerminalEnv` reports a terminal on stdin and stdout, even under a detected agent, and never in a pipe; a non-human flag or a conflict makes it false; with no `TerminalEnv` a flag only narrows), with `--wizard` following that decision (restored only into the exact config object `gateWizard` produced when it dropped it, so a consumer's own `CliConfig`, from outside the gate or inside, never gets it back) and diagnostics switched to NDJSON for a non-human flag. A root without the shared flags does not compile (`RequiresAudienceFlags`). The scan and the resolver share one counting rule (true occurrences only). |
| `CliInteractive` | A `Context.Reference<boolean>` defaulting to `false`, read with `yield* CliInteractive` and never in `R`: `Audience` is `human`, stdin is a terminal, stdout is a terminal and `TERM` is not `dumb` (a dumb terminal cannot move the cursor or take synchronized output, so it gets what a pipe gets: a live view prints its final frame once, a screen is `NotInteractive`). The decision is `internal/canPrompt.ts`, shared by `layer` and the audience flag's recompute; `TERM` is read through `Config`, only when both streams are terminals, so it adds no requirement. Static `layer` (from `Audience` and `TerminalEnv`), `layerTest(value)` and `unless(condition)`, a scoped override that can only turn it off. Both layers are typed `Layer<never>` because they set the reference. |
| `Token`, `Style`, `TokenName` | A token is a style; applying it is identity when colour is `none`. `TokenName` is `success`, `failure`, `warning`, `info`, `error`, `muted`, `accent` or `emphasis`. `Token.hex`, `Token.named` and `Token.style` build custom styles. `Token.defaults` is the frozen default style of every token and `Token.resolve(token, overrides?)` the pure resolution `CliTheme.paint` applies (a name that is not a token resolves to the empty style), so a renderer with no Effect context reads styles as data. `NamedColor`'s bright variants are spelled as chalk and Ink spell them (`redBright`, `blackBright`, with `gray` as an alias); the `Style` to Ink props mapping is `inkProps` in `./ui`. A colour name that is not a `NamedColor` paints nothing. |
| `Status` | An open vocabulary: `Status.core` (`success`, `failure`, `warning`, `info`, `skip`, `pending`) and `Status.extend(extra)`, each entry a glyph, an ASCII glyph, a token and a rank. `resolve(name)` returns the full definition as a frozen copy, which the document IR stores, and, like `def`, throws on a name the vocabulary lacks (reachable only through a cast). `worst(names)` takes a non-empty list and returns the highest rank, ties to the first (rank is severity, not an aggregation policy: a consumer whose rule differs folds its own); `worstOption(names)` takes any array and returns an `Option`, `None` when empty. `glyph(name, glyphSet)` is the unpainted glyph from a set. Names are typed, so a misspelt one is a compile error. |
| `Glyphs` | `Glyphs.unicode` and `Glyphs.ascii`: the status glyphs, bullet, arrow, ellipsis, spinner frames, `spinnerIntervalMs` (80), `tree` segments (`branch`, `last`, `pipe`, `blank`: box-drawing in Unicode, `-`, `\` and pipe characters in ASCII) and `pathSeparator` (`human`, `agent`: `›` and ` > `, or `>` and ` > ` in ASCII). ASCII is chosen under `TERM=dumb` or by option. `Glyphs.select({ ascii?, term? })` is that choice as a pure function (`auto` is ASCII only for `term` `dumb`, passed in because `StreamEnv` carries no `TERM`), which `CliTheme.layer` calls after reading `TERM` through `Config`. |
| `CliTheme` | A `Context.Service` with `paint`, `style` (the resolved style `paint` renders, whatever the colour level), `sgr`, `glyphs`, `color` and `status` (the stdout ones) and `forStream("stdout" \| "stderr")`, a `StreamTheme` painting with THAT stream's colour from `TerminalEnv.stderr.color` or `.stdout.color`; anything written to stderr is painted through `forStream("stderr")`, as `CliMessage` does. `layer({ tokens?, glyphs? })` needs `TerminalEnv`; `layerTest` fixes the colour level; `promptTheme` sets core's `Prompt.Theme` from the tokens, with empty colour strings when colour is `none`. `CliTheme.forAudience(theme, audience)` is the audience rule as public API: an agent gets the theme at colour `none` (identity `paint`, empty `sgr`, unpainted `status`), anyone else, or an unknown audience, the theme itself. `Render.context`, `./ui`'s mounts and `CliLog.status` all apply it, so a consumer painting its own lines applies the kit's rule instead of copying it. |
| `Fmt` | `sanitize` (the renderers' own: escapes and controls removed, a tab a space, line breaks kept), `width`, `truncate` (grapheme-safe, ANSI-safe, result never wider than asked), `duration` (`250ms`, `1.2s`, `1m 3s`, `1h 2m`), `percent` (a 0 to 1 ratio, or a 0 to 100 number with `{ scale: 100 }`) and `plural`. Width comes from [the package's own implementation](../decisions/own-display-width.md). |
| `CliMessage` | `success`, `info`, `warning`, `failure` and `status(vocab, name, text)`: one themed line each through `Console`, never the logger, so no log level silences them. `warning` and `failure` go to stderr; the others to stdout, and `status` defaults to stderr for a rank at or above `warning`'s. Only the glyph is painted and the text stays plain; an `agent` audience gets the glyph and text, never colour, even when the theme has colour. A `ci` audience is themed like a human, with colour still gated by `TerminalEnv`. Empty text prints the glyph alone. Every kit path that writes consumer-supplied text — `Doc.print`, `CliMessage`, the failure report — sanitises it and neutralizes it under GitHub Actions, and so do the loggers: `CliLogger` sanitises the line (with the default render; a custom `render` receives sanitised string parts and owns its own output, a colour included) and `CliLog`'s pretty line sanitises the message, component and cause before painting, and both neutralize under Actions by reading `CurrentRuntimeEnv` from the logging fiber's context (a `Logger` callback is synchronous; `fiber.context` is how it reaches a service). NDJSON is not safe merely because `JSON.stringify` escapes controls: the runner's legacy parser reads `##[` anywhere in a line, so under Actions `##[` is written as the JSON escape `#\u0023[`, which decodes to the same text. The failure report's pre-rendered lines are marked trusted so the logger does not strip the escapes the kit painted into them. |
| `CliLog` | Diagnostics, kept apart from `CliMessage`. `Level` is a reference defaulting to `None`, filtered on its own threshold rather than `MinimumLogLevel`. `layer({ level?, envVar?, format?, plainLogger?, logger?, extraLoggers? })` **owns the whole logger set** (`extraLoggers`, for example a telemetry logger, are kept and floored like the `CliLogger`): it builds the `CliLogger` (floored at the minimum level it had) and the stderr sink, NDJSON or pretty, and replaces whatever was installed without reading it, so there is no order to get wrong; use it instead of `CliLogger.layer`, never on top of it, and a platform that installs its own `Logger.layer([...])` replaces it silently. `level` beats `envVar` and loses to core's `--log-level`; `plainLogger: false` is the diagnostics-only mode (no plain `CliLogger`, so no level means no stderr). The requirements follow a fixed `format`: `json` needs neither `Audience` nor `TerminalEnv`, `pretty` needs `TerminalEnv`, `auto` needs both. The NDJSON line is core's `Logger.formatJson`, whose `message` is a string for one argument and an array for several. Stderr is not pure NDJSON while diagnostics are on, so a parser reads the lines that start with `{`. `component(name)` annotates a line. `neutralize` is `"auto"` by default (the logging fiber's `CurrentRuntimeEnv`, else the one captured when the layer was built, so a host-built layer neutralizes records from fibers without one; a `runtimeEnv` option, when given, replaces and beats that capture, which is invisible in the layer's `R = never`: vitest-agent A9), or `true` or `false`; the layer's own plain `CliLogger` takes the same decision as its diagnostics sink, so both lines are neutralized alike. Under `CliRuntime.main` with `env.log`, the platform is built under the run's level too (the full `CliLog` in NDJSON for `json`, and for `auto` when the build-time audience is an agent or a CI; a floored `CliLogger` otherwise, both neutralizing under GitHub Actions from the detected environment). The `file: { envVar } \| { path }` option (or `undefined`, which keeps the file requirements in `R` for a stable host type) adds an async NDJSON file sink (a queue drained by a scoped fiber, the same NDJSON line as the stderr sink in json format) that reports its first write error once (a defect counts too) and then drops further lines, and closing the scope waits at most two seconds for the drain so a hung filesystem cannot hang exit; only a layer given `file` requires `FileSystem` and `Path`. `CliLog.status(vocab, name, text, { level?, indent? })`: `Effect<void, never, CliTheme>` (`indent`, round 2: a number of spaces or a string, sanitised and stripped of line breaks, written before the glyph on the trusted line) logs a status line on the log channel: the glyph painted with stderr's theme through `CliTheme.forAudience` (an `Audience` read with `serviceOption`), `text` sanitised, and the line marked with the internal `TrustedLine` so the plain `CliLogger` keeps the glyph's colour; the level follows the status's rank (`Error` at or above `failure`'s, `Warn` at or above `warning`'s, else `Info`) unless given. The CliLog sink's pretty line still sanitises it (bare glyph) and NDJSON JSON-escapes it. Review fix: the status glyph was raw on that trusted line (and in `CliMessage.status`), so a hostile vocabulary glyph reached an agent verbatim; `Status.glyph` now sanitises, and `StreamTheme.status`, `CliMessage` (through `CliTheme.forAudience`) and `CliLog.status` all draw through it, as `Doc`'s layout already sanitised its `StatusMark`. |
| `Cancelled` | A tagged error, `reason: "escape" \| "interrupt"`, carrying exit code 130 through the runtime-marker mechanism. Its `message` is the fixed line `cancelled; nothing written` (a prototype getter, not part of the encoded form), so a consumer `render` can print `error.message`; `NotInteractive` does the same with `not interactive: run in a terminal or pass the flag`. See [one Cancelled for two engines](../decisions/one-cancelled-for-two-prompt-engines.md). |
| `NotInteractive` | A tagged error for a prompt reached in a non-interactive run; exits 64. |
| `CliPrompt.fallback` | `(prompt, { flag \| argument, otherwise? }) => Param.FallbackPrompt` — prompts only when `CliInteractive` is true, else returns `otherwise` (`undefined` counts as not given), else fails as a missing flag or argument built from the given name (exit 64). The prompt runs inside the fallback so a quit becomes `Cancelled` (exit 130) instead of core's missing-flag error; `Cancelled` travels as a defect, so a handler's `catchTag` cannot see it and only `CliRuntime.main` renders it as one line. |
| `CliPrompt.gateTerminal` | `Layer<Terminal, never, Terminal>`, deciding on EVERY call from the current `CliInteractive`, not at build, so a later narrowing (an audience flag under `CliAudience.runWith`) reaches it. Not interactive, it behaves as a quiet `Terminal` (input an already-ended queue, `readLine` a quit, `display` a no-op) that delegates `columns` and `rows` to the real one; interactive, the real terminal passes through. It exists because core runs `Prompt.run` even on an answered fallback, and on the real Node terminal subscribing the input attaches a readline to stdin, dropping piped bytes and putting a TTY into raw mode. `CliEnv.layer` installs it (and `gateWizard`) after `TerminalEnv` is built from the real terminal, so consumers never compose it. |
| `CliPrompt.gateWizard` | A layer that drops core's `--wizard` built-in from the run when it is not interactive. |
| `Doc` | The document IR, plain frozen nodes discriminated by `_tag` and built by constructors (inlines `Doc.text`, `code`, `link` (with a `suffix` option, and a missing target as its label), `status`, `path`, `strong`, `em`, `file`; blocks `heading`, `paragraph`, `line` (optionally truncating), `lines`, `list` (optionally `compact`), `table` (optionally `style: "pipe"`), `tree`, `collapsible`, `callout`, `codeBlock`, `verbatim`, `diff`, `diffText` (with `truncate`, which cuts each line to the width with the glyph ellipsis in plain and `ansi`; inside a compact list item a blank line of an item's own content keeps the item's indent there: vitest-agent A5), `section`, `counts` (with `share`, `paint` and `suffix`), `countsTable` (every zero cell shows `0` and a counter's `showZero` has no effect there, only in `counts`; a counter `label` may be `{ one, other }` (`one` at exactly 1), chosen by the counter's own `n` everywhere except the share headline, which reads by the total, the noun it counts (`1/3 repos`; round 2, reposets' ask: `counterLabel(counter, count)` takes the total there, in plain, ansi and markdown, the markdown row's header included), and a `countsTable` column is headed by `other` — vitest-agent r5 F5, ruled docs only; with `labelHeader`, and a per-row `durationMs` that adds a `Fmt.duration` column, headed `durationHeader`, summed in the total row: vitest-agent A4), and `annotation`, which only `githubLog` writes, as one escaped workflow command), and `Doc.print(doc, { stream?, format?, displayPath?, width? })`, the effectful edge: it builds the context with `Render.context`, picks the renderer (`auto`: `plain` for an agent, `githubLog` for a CI that an optional `CurrentRuntimeEnv` says is GitHub Actions and `plain` for any other, `ansi` for a human; an explicit format wins) and writes with `Console.log` or `Console.error`; a document that renders to nothing prints nothing. A status node stores a `Status.resolve` definition. See [the IR decision](../decisions/doc-ir-is-plain-data.md). `Doc.line(content, { truncate?, wrap? })`: `wrap: false` keeps a line atomic in every renderer and audience (one line whatever the width) while carrying glyphs, tokens and links, which `verbatim`'s plain string cannot; `truncate` wins over it. |
| `Render` | Pure `plain`, `ansi`, `markdown` and `githubLog` renderers over a `RenderContext`, `Render.contextOf(options)` for a pure context outside Effect (escape-free by default and always for an agent, neutralizing by default for a `ci` audience; `RenderContext.linkBase` links markdown file targets to a repository URL), and `Render.context(stream, { width?, displayPath? })` to build one from `CliTheme`, `TerminalEnv`, `Audience` and `CliLinks`: the audience in force, THAT stream's colour and hyperlink support, `CliLinks.linker` as `link`, and for an agent colour `none` with an identity `paint` (an agent never gets an escape of any kind, so even an explicit `ansi` is escape-free for it), and a width that is `TerminalEnv.width()` for a human whose stream is a terminal and unbounded (`Infinity`) for a human whose stream is not one (a pipe or a file: `TerminalEnv[stream].isTerminal` false), an agent or a CI, so nothing a reader needs is cut or wrapped for a terminal that is not there (#911: a piped `path:line:col` finding used to split at a guessed 80 columns); an explicit width wins. The context also carries `neutralizeWorkflowCommands`, set whenever an optional `CurrentRuntimeEnv` says GitHub Actions, for every audience: the runner reads a line that starts with `::` or `##` as a command, so every renderer then puts a zero-width space in front of such a line (the one `neutralizeLines` that `githubLog` uses, which is idempotent, so it is never doubled). The failure report without any environment services always sets it. `Render.ansi` (for people) is built on the same walk as `Render.plain`: the same layout painted with the context's tokens and linked through `ctx.link`, and identical to plain at colour none apart from code markers and the path separator. `Render.githubLog` is plain text with a top-level collapsible as a `::group::`, nested collapsibles flattened, and any line a runner would read as a command neutralized. The runner has TWO parsers (`actions/runner`, `ActionCommand.cs`): V2 trims .NET whitespace then looks for `::` at the start, and the legacy one finds `##[` ANYWHERE in the line (a bare `##` is no command), so neutralizing puts a zero-width space before such a `::` and inside every `##[`; a markdown heading is untouched, and under Actions a zero-width space can land inside code or table text where it would otherwise have formed a command. That neutralizing is not `githubLog`'s alone: every format does it, through the same function, whenever the context says the runner is GitHub Actions (`neutralizeWorkflowCommands`, set by `Render.context`), whoever the audience is; `githubLog` always does. `Render.markdown` (GFM, for step summaries and files) is built and verified against `@effected/markdown` as a test-only oracle: text is escaped so it cannot become markdown, and links are only emitted for a safe scheme. `Render.plain` (for agents) is built: no escape of any kind, a path joined with `>`, a link as its label plus the target in parentheses, a long URL kept whole. No JSON renderer ([decision](../decisions/no-json-renderer.md)). |
| `GithubAnnotation` | `format(annotation, message)` for a GitHub workflow-command annotation: the message escapes `%`, CR and LF, a property also `:` and `,`, written in the order `WorkflowCommand` uses, because it renders through `WorkflowCommand` from the pure `@effected/github-commands` (a regular dependency: it has no shared-instance contract, so a duplicate copy is harmless): one escaping, no copy. `Render.githubLog` builds its groups with the same `WorkflowCommand` and neutralizes with `CommandNeutralizer`; the runner-command oracle in the cli tests is a separate, independent copy. |
| `CliLinks` | Where a file link opens: `vscode://file/<path>:<line>:<col>`, `file://<path>` or none. `auto` is `vscode` on the `vscode` terminal signal or a `.vscode/` directory at the project root (the nearest ancestor with `.git` or `pnpm-workspace.yaml`, found with `Walker.ascend`, at most 64 directories up, and `Walker.findRoot`: [decision](../decisions/cli-takes-the-walker-edge.md)); an environment variable the consumer names beats the option. `CliLinks.linker({ links, hyperlinks, audience })` is the `RenderContext.link` policy: OSC 8 only when hyperlinks are on and the audience is not an agent. `CliEnv.layer` provides it and takes `FileSystem` and `Path` from the environment when it has them, without requiring them. One link-scheme allow-list (`internal/linkScheme.ts`: `http`, `https`, `mailto`, `file`, `vscode`, `vscode-insiders` or a relative URL) serves the OSC 8 linker and `Render.markdown`, and one path-to-URL builder (`internal/linkTarget.ts`) serves both, so a file links the same way in each: a Windows drive path (`C:\x\y.ts`, `C:/x`) is absolute on any `Path` flavour and keeps its drive (`file:///C:/x/y.ts`); a colon anywhere else in a POSIX path is data and stays encoded (the one false positive is a relative `a:/b.txt`, read as drive `a`); a UNC path (`\\server\share`, `//server/share`) has no link target. The linker percent-encodes every character outside printable ASCII in a `{ url }` target without touching what is already encoded, and a bad `editorLinksEnvVar` value warns once and falls back to the option. |
| `CliFailure`, `CliDoc` | `CliFailure.toDoc(cause, { render?, displayPath?, stackFrames?, spans? })` is a failure as a `Document`, one run of blocks per `Cause` reason: an error that implements the `CliDoc` protocol draws itself, else the per-`_tag` `render` map, else `Cancelled` and `NotInteractive` as their fixed line, else a `Tree` of a schema error's rejected values (nested by path), else a failure status line. A defect is its message, a collapsible `stack` of the program's own frames as file links through `displayPath` (every `node:` frame, every frame with no file, and every `node_modules` frame, Effect's or any other dependency's, hidden, classified by the frame's file alone and never its function name, so a thunk V8 names by Effect's method alias stays the program's — vitest-agent r5 B1; the count follows the shown frames as `(+N internal frames hidden)`, or is `no user frames (N internal frames hidden)` when none are left — r5 F1; `stackFrames: "all"` keeps every frame — vitest-agent A3; when dropping `node_modules` frames would leave none, as for a program run from its own install under `node_modules` (a global install, `npx`, a pnpm store), only the runtime's and Effect's are dropped, so an installed CLI still shows its own frames — r4 review, fix 2), and an `Error.cause` chain as a tree. A reason that ran under spans is followed by `in: outer › inner`, read from the `Cause.StackTrace` annotation chain (innermost first). `spans` (#920) mirrors `stackFrames`: `app`, the default (following `stackFrames`' precedent), drops a span whose definition site is a file under `node_modules/@effected/` or `node_modules/effect/` (review fix: the bare `packages/effect/src/` rule is gone, since it hid any monorepo's own `packages/effect`), an `Effect.fn` call being judged by its `name (definition)` parent's site, so a kit function the program calls goes with its definition; a span with no captured stack is kept; `all` is every span, `off` no trail. The kit is identified by file, never by span name, as frames are: kit span names carry no common prefix (`ConfigFile.loadFrom`). In this monorepo the kit's own sources are not under `node_modules`, so its tests see every span as the program's. `appModule` (`CliFailureOptions`, `env.appModule`) names the running program: its package is derived lexically (through the last `node_modules/<name>` in the path, no file system; both sides compared with `/` separators and a lower-cased drive letter, so a backslashed CommonJS frame on Windows and a `c:`/`C:` mismatch still match), and spans defined in it are kept even under `node_modules/@effected/`, so a kit companion's bin (schemastore-cli) keeps its own `ConfigLoader.*` spans; nested and sibling kit packages are still dropped. The review asked for the entry to be resolved automatically from `process.argv[1]`; the root cannot read `process` or touch the file system (`boundary.test.ts`), and core's `Stdio.args` is `argv.slice(2)`, so the program names itself instead, which also avoids a realpath. The rule fails open (a linked kit, a bundle: more shown, never less), documented on `spans`. Round 2 (reposets' asks): an `Effect.fn` call and its `name (definition)` parent collapse into one entry under every setting (a lone or differently named definition frame is kept as it is); and `env.spansEnvVar` reads the setting at run time through `readSpans` in `failureTarget.ts`, exactly as `readLevel` reads `log.envVar`: `env.spans` beats it (then unread), unset or empty is the default, case-insensitive, and an invalid value logs one `VAR=value is not a span setting (app\|all\|off); ignoring it` warning. An interrupt-only cause is `interrupted`. The two issue renderers read the same rejected values, so `SchemaIssueRenderer.render` and `ConfigIssueRenderer.render` return exactly the lines they always did. |
| `./ui`, `./ui/testing` | Built: see the two sections below. `CliUi.live` (a scoped live view over a `Stream`, [runs and modes](../decisions/live-view-runs-and-modes.md), [tick](../decisions/live-tick-is-a-scoped-schedule.md), [never clears](../decisions/live-never-clears.md), [height clamp](../decisions/live-height-clamp-not-width.md), [logs through Ink](../decisions/live-logs-through-ink.md), [React's dev-build entries](../gotchas/react-dev-performance-entries.md)) has landed (tick, degrade and non-interactive output included), with `CliUiTest.live` and `DocView`. Behind the optional peers `ink` and `react`, which the root never reaches and `./ui` loads only when a screen mounts ([subpath](../decisions/ui-is-a-subpath-with-optional-peers.md), [tier](../decisions/ui-tier-is-integrated-on-opt-in.md), [process streams](../decisions/ui-binds-process-streams.md), [Ink's colour level](../decisions/ink-colour-via-inks-own-chalk.md), [reachability boundary](../decisions/root-boundary-is-reachability.md), [declarations](../decisions/ui-declarations-reference-the-root-by-name.md)). |

### `@effected/cli/ui`

Optional peers `ink` (^7.1.1), `react` (^19.2.0) and `@types/react` (^19.2.0, for the declarations). Kit files hold only
type imports from them; the modules are loaded on a screen's first mount, so
importing `./ui`, or running a program that is not interactive, loads
neither, except that an owned live view loads them to print its final frame
as a string. A missing peer in an interactive run is a defect naming both. The
reviewed export list is pinned in `__test__/declarations.test.ts`.

| Export | Contract |
| --- | --- |
| `CliUi` | `run(screen, { clear? })`: `Effect<A, Cancelled \| NotInteractive, CliTheme>`; not interactive, it fails with `NotInteractive` and loads nothing; interactive, it mounts the screen as one scoped resource (unmounted, raw mode off, cursor shown, bracketed paste off and Ink's colour level restored however it ends), Esc cancels with `"escape"` and Ctrl-C with `"interrupt"`, a throwing component or `useKeys` handler is a defect with nothing of Ink's crash screen on stdout, and screens run one at a time process-wide. A screen draws on stdout at stdout's colour level; there is no option to draw on stderr, since interactivity (`CliInteractive`) reads stdout's terminal, and a stderr screen needs it read per stream first ("human and not narrowed" apart from each stream's terminal fact), which can then add the option without a break. `clear` (default `false`) erases the last frame as the screen unmounts; without it the frame stays as a record of the answer. Nothing may log while a screen is mounted: Ink runs with `patchConsole` off, so a line written to the terminal from elsewhere tears the frame. `prompt(screen, { otherwise?, clear? })` is `run` with a non-interactive default, for a handler. `fallback(screen, CliUiFallbackOptions)` (`CliPromptFallbackOptions` plus `clear`) is `CliPrompt.fallback` for screens: a `Param.FallbackPrompt` that reads `CliTheme` if present (none counts as not interactive, said once at debug level when `CliInteractive` is on), raises `Cancelled` as a defect (exit 130), and answers `otherwise` or core's missing-parameter error (exit 64) when not interactive. `lazy(load)` defers a screen's module to its mount. `map(screen, f)` is a `Screen<B>` from a `Screen<A>`: it passes the inner screen a control whose `resolve` applies `f` and whose `cancel` is the outer one untouched, so a `Confirm` backs a `Flag.Boolean` fallback with no hand-written adapter; data-first only, like every `CliUi` static. `context` is `Effect<UiContextValue, never, CliTheme>`: stdout's theme and glyph set for a tree the kit did not mount, loading Ink and React on the way so `UiProvider` can render. |
| `CliUi.live`, `LiveOptions`, `LiveHandle` | `live({ events, initial, reduce, render, isStart, isTerminal, mode?, tickMillis?, drainPerformance? })`: `Effect<LiveHandle<S>, never, Scope \| CliTheme>`. It returns its handle without waiting for Ink: Ink and React load at the first run's mount (or the first owned print), and `close` before any mount is safe and drains. It makes the first pull of `events` before returning (the drain is forked with `startImmediately`, because a `PubSub`-backed stream subscribes on its first pull: `Channel.unwrap` is lazy), so `Stream.fromPubSub` is subscribed by then; a stream that forks its upstream (`merge`, `buffer`, a concurrent `flatMap`) subscribes later and loses what is published before, so the certain form is `PubSub.subscribe` first, passing the `PubSub.Subscription` itself as `events` (taken as `Stream.fromSubscription` takes it, ending when its `PubSub` is shut down); folds them in a fiber of the caller's scope, and draws runs on `UiStreams` when interactive: a run begins at `isStart` (or where an optional `begins(event, before, after)` says, for a consumer that joins mid-run; an event outside a run that begins none is folded and not drawn, so post-run events never mount a second copy), ends at `isTerminal` with Ink's own unmount (its frame committed, never `clear()`), and a start while drawn redraws in place. Each run holds the mount permit, `withInkColour` and its Ink instance in a scope of its own (released at once if the mount fails partway), so a `CliUi.run` during a run waits; closing the caller's scope runs one finalizer that interrupts the drain first and then ends the run drawn, so nothing is folded or drawn during the close. The tree is `ErrorBoundary > providers > console bridge > height clamp (rows - 1, from`useTerminalSize`, no width; the content keeps its own height,`flexShrink: 0`, and is clipped, never squeezed into a sample) > Holder > render(state, frame)`; a push swaps the Holder's element and waits for React's commit, resumed on a microtask so the controller never runs inside the commit (where a frame that threw is not yet reported), before the next event or the unmount. Clearing a run and closing its scope is one uninterruptible step, so an interrupt between them can never orphan the permit, the instance or the tick. No input is mounted. `LiveHandle` is `state`, `logConsole` (the bridge: lines above the frame while drawn), `done` and `close`. `close` (once, `Effect.cached`; later calls wait on the same end) interrupts the pump, then posts `Ended`; on any `Ended` the controller first takes what a subscription still holds (`PubSub.remainingUnsafe`, then `takeUpTo` without waiting, plus an ended PubSub's final message if not yet taken; a shut-down subscription is never asked, since a take from it interrupts) and folds it, then ends the run as the events ending does. A subscription is taken from directly, never through `Stream.fromSubscription`: each step is `uninterruptibleMask` around `restore(PubSub.takeAll)` and the inbox offer, under `PreventSchedulerYield`, so an interrupt can land only while it waits and a taken message is always in the subscription or the inbox (a test sweeps `MaxOpsBeforeYield` 3-18; through the stream machinery the tail was lost at 7, 8 and 13-18, and without `PreventSchedulerYield` at 3). The step is end-aware: `PubSub.end`'s final message is sticky in core (every later take returns it), so once `Subscription.ended` is `Some` the step takes the buffer and the final message once and ends; a take interrupted by the subscription's shutdown ends the events too. A plain stream keeps the masked `Stream.toPull` pull, made in the caller's scope; a chunk in flight inside the stream's own machinery can still be lost to a yield there, which is the stream's concern. `PubSub.shutdown` drops a subscriber's unread messages (pinned), so `close` or `PubSub.end` is the lossless end. `close` dies as `done` dies, except that after the caller's scope closed (interrupt only) it completes. One controller fiber owns every transition, fed by an unbounded inbox it drains with `Queue.takeAll` (event chunks queued together are folded as one and drawn once; a source that applies backpressure buffers there while the view draws): a pump of event chunks, which also reports the stream ending or dying (a dying stream unmounts the run, then `done` dies with its cause), the run's tick (`Schedule.spaced(tickMillis)` forked into the run's scope, carrying `floor(Clock.currentTimeMillis / tickMillis)` from when it fired; a `tickMillis` that is not positive and finite is a defect) and render-failure wake-ups. A failed render or mount degrades the run: unmounted first (an inner boundary draws the last good frame in place of the one that threw, so that frame stays), then one `Effect.logWarning`, the fold going on; a degraded run that never painted prints its final frame once at its terminal event; a render that throws only as the run ends is warned once at its end, after the unmount; a start during a degraded run ends it and mounts a fresh run. A throwing `reduce` unmounts, then `done` dies. Not interactive: `owned` prints each run's final frame once via `renderToString` at stdout's width (80 when unknown) with an unbounded `rows` size override (`useTerminalSize().rows` is `Infinity` there), loading Ink only then, escape-free at colour `none` and for an agent `Audience` when one is provided (read with `serviceOption`, so `Audience` is not in `R`): the tree is given the audience's theme, `CliTheme.forAudience` (public since #918; it was the internal `CliTheme.forAudience`) (colour `none`, identity `paint`, empty `sgr`, unpainted `status` for an agent), the same function `Render.context` takes its colour and `paint` from, so `useTheme`, `Styled` and the widgets' colour-`none` markers agree; `CliUi.run` and `CliUi.context` apply it too; `hosted` prints nothing. The frame index is monotonic: a stale tick never steps the spinner back. If the last good frame throws too, the run counts as unpainted and its end prints the string. Since #908: `LiveOptions.final?: (state) => Document`, given, makes an owned, not-interactive run print `final(state)` once per run at its end (replacing the Ink string, never both), rendered through `Render` with the renderer `autoFormat` picks and `Render.context("stdout")` when `TerminalEnv`, `Audience` and `CliLinks` are all in context (else `Render.contextOf` from the stdout theme and the optional `Audience`, unbounded width), and written through the console bridge to `UiStreams` stdout rather than `Console`, so `R` stays `Scope \| CliTheme` and `CliUiTest.live`'s transcript shows it; a throwing `final` degrades the run (`warnOnce`). `CliUi.lazyView(load)` (internal `ui/internal/lazyView.ts`; `load` resolves to the view itself or a module whose default export it is, so a named export needs no shim) returns a `render` carrying its loader under `Symbol.for("@effected/cli/ui/lazyView")`: `loadView` awaits it before a mount builds its first element and before `printFrame`, a failed import degrades the run and is retried by the next (review fixes: `pick` takes a function, else a function `default`, else throws a descriptive `LazyViewShapeError` naming what was received; a rejected IMPORT clears the shared load so the next run, and the run's own end, retry, so a transient failure still prints that run's frame; a SHAPE error is deterministic and stays the handle's one rejected load, and `CliUiLive` warns about each `LazyViewShapeError` once per handle by identity, so a watch session does not warn per run), and calling the render before load throws. `render` stays required and its type unchanged, so a consumer passes either a component or a thunk (vitest-agent's request); a `view` option beside `render` was rejected because `LiveOptions["render"]` would have turned optional, breaking `exactOptionalPropertyTypes` consumers. A live view never renders in Ink's debug mode (#917). |
| `Screen`, `ScreenControl`, `CliUiRunOptions`, `CliUiPromptOptions`, `CliUiFallbackOptions` | A `Screen<A>` is `(control) => ReactElement \| Promise<ReactElement>`; `ScreenControl<A>` is `resolve(value)` and `cancel(reason)`, first call wins. Text from data in a screen's own components (Ink's `Text`, `Styled`) is the screen author's to sanitise. |
| `UiStreams`, `UiStreamsShape` | A `Context.Reference` of the stdin, stdout and stderr a screen binds to, the process streams by default ([decision](../decisions/ui-binds-process-streams.md)). |
| `UiKey`, `KeyName` | The kit's own key model: `Named` (`up`, `down`, `left`, `right`, `enter`, `escape`, `space`, `tab`, `shift+tab`, `backspace`, `delete`, `home`, `end`, `pageup`, `pagedown`, `ctrl+c`) or `Char`. `UiKey.fromInk(input, key)` normalises Ink's input. |
| `KeyTable`, `Binding`, `KeyHelpRow`, `useKeys`, `UseKeysOptions` | A widget's keys as data, the one source for dispatch and help: `make(bindings)` (first binding wins), `match(key)`, `help(glyphs)`, and `KeyTable.root` (Esc and Ctrl-C). `useKeys(table, dispatch, { isActive? })` is one Ink `useInput`; text read in one go is split into a key per grapheme (CR LF one enter), a `{ char }` binding matches in NFC, a bracketed paste never reaches it (the screen takes pastes on Ink's paste channel; `TextInput` reads them as text), and several keys from one read are dispatched before React re-renders, so a handler steps from current state ([gotcha](../gotchas/ink-delivers-a-chunk-of-keys-before-rerender.md)). Ink calls input handlers outside React's error boundary, so inside a screen a `dispatch` that throws is caught and ends the screen as a defect, as do the kit's own paste handlers; a consumer's raw Ink `useInput` or `usePaste` is not guarded. |
| `KeyHelp`, `KeyHelpProps` | The help line from key tables, merged with the root keys and cut to the width with the root hint pinned. |
| `Styled`, `StyledProps`, `inkProps`, `InkTextProps`, `useTheme`, `useGlyphs`, `useTerminalSize`, `TerminalSize` | The theme bridge: `inkProps(style, color?)` maps a `Style` to Ink `Text` props (none at colour `none`; with `color` omitted, for an Ink tree the kit did not mount, every prop is emitted for Ink's chalk to gate: vitest-agent A7), `Styled` paints a token through the mounted screen's theme (its children drawn as given), and the hooks read the screen's `StreamTheme`, `GlyphSet` and usable terminal size (a width or height reported as 0 or not at all is unknown and reads as 80x24 before the one-cell margin: a pty `script` opens reports `0 0`, which drew every row as a bare ellipsis, okfit O1; `TerminalEnv.layer` already maps a 0 width to `None`. This is NOT Ink's fallback chain, which asks `terminal-size` (tty, `COLUMNS`, `tput`) before 80x24: `./ui` reads no `process`, so on a 0x0 pty with `COLUMNS=50` Ink lays out at 50 while the kit cuts rows at 79). |
| `UiProvider`, `UiContextValue` | `UiProvider({ value, children })` gives an Ink tree the kit did not mount the context `useTheme`, `useGlyphs`, `Styled` and `useTerminalSize` read; take `value` from `CliUi.context`. `UiContextValue` is `{ theme, glyphs, size? }`: with `size`, `useTerminalSize` reads it instead of the stdout (less one column and one row as ever), which `renderToString` needs because its terminal hooks see the process's own stdout whatever width it lays out at (probe L1). There is no screen under it: `useScreenCancel` does nothing and a kit widget's input handler is not guarded. `CliUi.run`'s screens are wrapped by the same internal provider. |
| `DocView`, `DocViewProps` | The `Doc` IR as Ink rows, laid out by the kit's own renderer (strategy S1, string passthrough): the whole document (or one block, as a one-block document) through `Render.ansi`, or `Render.plain` at colour `none`, split into one `Text` row per line with `wrap: "truncate-end"` (Ink never re-wraps; an empty line is a one-space row), in a `flexShrink: 0` column so a clipping parent shows the first rows. A collapsible is open and an annotation skipped, as in the static renderers, so a static report and a live view show a document byte for byte alike (pinned against `Render.plain` for a table, counts, a tree, a diff and a code block). Without `ctx` it builds a `RenderContext` from the tree's theme (its own `paint`, so token overrides hold; colour; glyphs; for an agent the audience-adjusted colourless theme), width `useTerminalSize().columns`, a human audience, links off and the identity `displayPath`: the public `RenderContext` shape, so the root's surface and `R` are unchanged. Under the GitHub Actions runner (`CurrentRuntimeEnv`, read with `serviceOption` through the shared `underGithubActions` by `CliUi.run`, `CliUi.live` and `CliUi.context`, and carried in the screen context and `UiContextValue.neutralizeWorkflowCommands`) the built context sets `neutralizeWorkflowCommands`, so text from data never forms a workflow command; the live view also neutralizes a frame it prints as a string whole, a consumer's raw `Text` included. A `ctx` prop replaces that entirely, neutralizing included, and needs no provider. The layout is memoised (`React.memo` and `useMemo`) on the document's identity and the context. |
| `Viewport` | A pure reducer over a window of items (`init`, `step`, `resize`, `keys`) and `View`, which never draws more lines than fit (so Ink never clears the scrollback), re-emits a section header scrolled off the top, clips each row to one line, and dies on a repeated item key. |
| `Select`, `TextInput`, `MultiSelect`, `Confirm`, `Toggle`, `Tabs` | Each a pure `init`/`step` (or `step` alone), a `keys` table, a `View`, and, except `Toggle` and `Tabs`, a ready-made `screen(options)`. Every string a widget draws from data (message, label, detail, placeholder, validation message, section title, toggle and tab label, tab separator, key help) is sanitised as `Fmt.sanitize` does and its line breaks folded to spaces before it is measured or cut, so data cannot paint colour at colour `none`, plant a hyperlink, or add a row the height budget did not count (which would make Ink wipe the scrollback). `Select` resolves the chosen value and skips disabled choices, which end in a `(disabled)` mark at colour `none`, where muted paints nothing; `TextInput` edits one line by code point, validates on submit, and types text read in one go as it reads; `MultiSelect` resolves the selected values in section order, with unique keys across sections; `Confirm` resolves `{ confirmed, toggles }` (`toggles` partial by key), its toggles scrolling in a window; `Tabs` is a controlled or uncontrolled component for a consumer's screen, with Tab and Shift-Tab cycling, digits jumping, `columnKeys` for a column, and brackets marking the active tab at colour `none`. The state, action, option and props types are exported beside each. `TextInput`'s `mask?: string \| true \| ((value) => boolean)` (#916; the predicate, round 2, is asked with the real value and LATCHES (a `useRef` in the View) from the first render it answers true until the value is empty: review found an unlatched predicate redrew `hp_SECRET123` in clear after home+delete; the advice is a giveaway anywhere, `/gh[pousr]_\|github_pat_/`, since a prefix match never masks `op://v/` plus a pasted token; a no-latch mutant turns the home+delete test red) draws one mask per grapheme (`Intl.Segmenter`), `•` for `true` (`*` under ASCII glyphs), a string through `lineText`; only the drawing changes: `validate`, the cursor and the result use the real text, and the placeholder is unchanged. No reveal key: not trivial beside paste handling, so left out. Review fix: the cursor now moves and deletes by grapheme (`Intl.Segmenter`, contained to `TextInput`'s `previous`/`following`), and the mask counts come from one segmentation of the whole value, graphemes starting before the cursor then the rest, so they always total the value's graphemes; a `validate` message is drawn unmasked (documented). |

### `@effected/cli/ui/testing`

| Export | Contract |
| --- | --- |
| `CliUiTest.render` | `(screen, options?) => Effect<CliUiTestHandle<A>, never, Scope>`: mounts one screen on in-memory streams under a marker-palette theme, with Ink in debug mode, and returns once it has drawn. Options are `columns`, `rows`, `color`, `glyphs` and `interactive`. A crash (a thunk or a component that throws, a classic-JSX `React is not defined` included) is never swallowed: `result` dies with it and so does the next read, key, resize or rerender (vitest-agent r5 B2). The guard lives once in `makeTerminal`'s `screen`, which `render`, `view` and a session's screens all build on; the run's `onMount`/`onUnmount` bracket now spans the whole run, so a thunk that throws before Ink draws still has a capture, and `onUnmount` carries the defect. |
| `CliUiTest.view` | `(element, options?) => Effect<CliUiTestView, never, Scope>`: mounts a display-only element (a status line, a live view) under the same harness as `render` (marker theme, fake streams, debug frames), wrapped in the kit's providers so `useTheme`, `useGlyphs` and `Styled` work in it; its handle has the frame readers, `press`/`type`/`chunk`, `resize` and `rerender(element)` but no `result`, since a display-only element never ends on its own (vitest-agent A10). With no `result` to re-raise how its run ended, a crash or a refusal (`interactive: false`, `NotInteractive`) is surfaced instead: `view` dies with the error when it happens before the first frame, and otherwise the next read, key, resize or rerender does, never a silent empty frame or the misleading "screen has ended" defect (r4 review, fix 1). A deliberate end (Esc or Ctrl-C, a `Cancelled`) is not a crash: the frames stay readable and only a later key, resize or rerender dies, saying the screen has ended (fix round 2, R2). After a crash every read dies with it, `frames` included, so the frames drawn before it are not readable (R3). `render` and `view` share one mount helper over `makeTerminal`. |
| `CliUiTest.live`, `CliUiTestLive` | `(options) => Effect<CliUiTestLive<E, S>, never, Scope>`: `CliUi.live`'s options without `events` plus the terminal's (`columns`, `rows`, `color`, `glyphs`, `interactive`). It mounts the live view on the PRODUCTION render path (Ink interactive, not debug) over an in-memory terminal whose stderr is its stdout, as on a tty. The handle has `publish(event)` (offers to the view's stream and settles like a key press), `end` (ends the stream and joins `done`, dying with what the view died of), `advance(duration)` (`TestClock.adjust`, which fires the run's tick, then settles: live tests use `it.effect`), `resize`, `frame`/`rawFrame`/`plainFrame`/`frames` (each frame is Ink's write after a render without its erase moves; a write of moves alone is Ink clearing for a log line, not a frame), `transcript` (what the terminal shows, scrollback included, through the shared terminal model `ui/testing/terminalModel.ts`, which the kit's own production-path tests import; it applies Ink's erases and its clear-terminal `ESC[2J`/`ESC[3J`/`ESC[H` against the terminal's rows, so a scrollback wipe shows as the loss of what was above the frame), `written` (every raw byte, the place to assert no `ESC[3J`) and `handle` (the `LiveHandle`). Frames are best-effort (an unchanged or empty render adds none, and a write after a run's unmount is never one); `transcript` and `written` are authoritative, and with `interactive: false` the printed strings show only there. `advance` needs `it.effect`'s `TestClock`; under `it.live` it dies. vitest-agent's eight live-view behaviours are pinned against it, each with a mutation that fails it. The harness mounts its production path with Ink's `maxFps: 1000` (internal `UiRenderOverrides.maxFps`): Ink 7 throttles renders and log writes to 30 fps by default, a trailing ~33 ms timer, so a second render right after a leading one landed after the settle (8 ms trailing quiet, then only timers already due) and a test read the previous frame under load (the flaky `CliUiTest.live` frame-index test). Every consumer of `CliUiTest.live` and of `session({ renderPath: "production" })` gets the same fix; `CliUiTest.throttle.test.ts` pins the option. |
| `CliUiTest.cancelReason` | `(exitOrCause) => Option<"escape" \| "interrupt">`: pure; finds a `Cancelled` in an `Exit` or `Cause`, typed or as a defect, matched by shape (`_tag` and `reason`) so a copy of the class bundled into this entry still matches, so a test never walks `cause.reasons` (okfit O2b). |
| `CliUiTest.session` | `(options?) => Effect<CliUiTestSession, never, Scope>` for a program that runs several screens: `layer` (fake streams, theme, `CliInteractive`, frame capture and a capturing `Console`; anything the program provides closer to its screens, `CliEnv` under `CliRuntime.main` with `env`, wins), `next({ contains? })` for each screen as it mounts (2 s cap, a defect naming what it waited for), `mounts`, `stdout` and `stderr`. Its TSDoc carries the recipe for driving a whole `Command` handler (the session's `layer`, a fresh `CliExit.layer`, a sandboxing `ConfigProvider` for `HOME`/XDG and the platform, forked, then `next`), pinned by a kit test, and says `mounts === 0` is the "nothing mounted" assertion, a test that itself sleeps needs `it.live`, and debug frames show neither `clear` nor the final scrollback (okfit O2c, O2e). A screen that crashes makes `next` die with the crash, whatever `contains` waited for, or else its next read, key or resize does; `mounts` counts a run whose thunk threw before Ink drew (r5 B2). Since #917 it also has `transcript` (the terminal model, `screenAfter`, over everything written to `UiStreams`) and `written` (every byte), stdout and stderr merged in write order as on a terminal, so lines a handler's live view writes through `handle.logConsole` are observable (review fix: the fake streams stay two streams with a combined log, `fakeStreams.written`, and the session also exposes `stdoutWritten`/`stderrWritten`, so a line on the wrong stream is catchable, and `stdoutTranscript`/`stderrTranscript`, each stream's bytes through the same `screenAfter` pipeline as `transcript`, for per-stream text assertions free of paint breaks; `CliUiTest.live` has no per-stream accessors); a live view never renders in Ink's debug mode (`CliUiLive` no longer reads `UiRenderOverrides.debug`), so in a session it runs on the production path; `onMount(kind)` tells the harness whether a screen or a live run mounted, and each capture reads writes by its own mode. `CliUiTestSessionOptions.renderPath: "debug" \| "production"` (default `debug`) puts screens on the production path too, which makes `clear: true` observable in `transcript`. Round 2 (reposets' ask 6): `layer` stays `Layer<CliTheme>`, which is honest: `UiStreams`, `CliInteractive`, the capture and `Console` are `Context.Reference`s with defaults, so they can never appear in a requirement and a type cannot carry them; the TSDoc instead states the ordering loudly (provide it closer to the program than a presentation layer whose values it should replace; shadowed, it fails quietly to the defaults). |
| `CliUiTestScreen`, `CliUiTestHandle`, `CliUiTestView`, `CliUiTestSession`, `CliUiTestNextOptions`, `CliUiTestOptions` | A screen handle: `press` (named keys, or `{ char }` items typed as `chunk` sends them; a bare string that names no key dies naming `type(...)` and `{ char }`, never a Node stream error: okfit O2a), `type`, `chunk` (keys or characters in ONE stdin write, which `press` can never show), `resize`, `frame` (token markup), `rawFrame`, `plainFrame`, `frames`; a key for a screen that has ended is a defect. `render`'s handle adds `rerender` and `result`; `view`'s adds `rerender(element)` only. |
| `CliUiTest.styled`, `CliUiTest.serializer` | ANSI decoded back to token markup, and a Vitest snapshot serializer that prints it. Since #909 the serializer is also the default export of its own subpath, `@effected/cli/ui/testing/serializer` (`src/ui-testing-serializer.ts`, built as `ui-testing-serializer.js`), so a consumer registers it with Vitest's `snapshotSerializers` config and no shim file; the root `vitest.config.ts` registers it that way for this package's own project, and the `./ui` boundary test counts the entry as a testing module. Snapshots are the one place a test here uses `expect`. |

### `@effected/cli/testing`

| Export | Contract |
| --- | --- |
| `CliTest.sandbox` | `Effect<Sandbox, PlatformError, FileSystem \| Path \| Scope>`. A temporary directory with a fresh `HOME` and `XDG_{CONFIG,DATA,STATE,CACHE}_HOME`, and `NO_COLOR=1`. `PATH` is taken from an injected value and never inherited through `extendEnv`. |
| `TestTerminal.make` | `(options?: { columns? }) =>` an `Effect` of a `Terminal` layer with `input(keys)`, `type(text)`, `end` and captured `output`. Core's own mock terminal is test-only and unexported; this one drives core `Prompt` and `CliPrompt.fallback` in tests. |
| `CliTest.run` | `(bin, args, { sandbox, execPath, cwd?, env?, stdin? }) => Effect<{ exitCode; stdout; stderr }, PlatformError, ChildProcessSpawner>`. Two deliberate differences from the original design: there is **no `path?` option** (`PATH` is fixed once by `CliTest.sandbox({ path })`, and a per-run override goes through `env`, which merges over the sandbox environment), and it **scopes itself** (`Effect.scoped` around the spawn), so `Scope` is not in `R` and a caller need not wrap each run. A non-zero exit is data, not a failure. Spawns `execPath` with `[bin, ...args]` over core `ChildProcess` (D9), no peer on `@effected/commands`. **When `stdin` is omitted OR passed as `""`, the spawned child receives an already-ended empty input, never an open pipe** — a test that does not pass `stdin` never hangs waiting for one. |

See [D9: `CliTest` uses core `ChildProcess`](../decisions/cli-testing-uses-core-child-process.md)
for why this subpath takes no dependency on `@effected/commands`.

### CliLogger, and why it does not need `Stdio`

The obvious design — write through `Stdio`'s `stdout()` / `stderr()`
sinks — does not fit: `Logger.make(log)` takes a synchronous callback,
while a `Sink` write is an `Effect`, and a logger cannot `yield*`. The
sanctioned path is the one core's own `defaultLogger` takes: read the
`Console` reference off the fiber, synchronously, and route the write
based on the log level.

Levels are compared ordinally, never by string equality —
`LogLevel.isGreaterThanOrEqualTo(logLevel, stderrFrom)`, never
`logLevel === "Error" || logLevel === "Fatal"`, which hard-codes two names
and silently misses any level added upstream above `Fatal`. **`stderrFrom`
defaults to `"All"`** ([D3](../decisions/cli-logger-defaults-all-to-stderr.md)):
every log level routes to stderr unless a consumer narrows it explicitly,
so a CLI's stdout carries only what the program writes with `Console.log`
— never a diagnostic `Effect.logInfo` line a consumer never chose to print
as output. This is a breaking 0.x change; the changeset says so. Any
consumer relying on the old `"Error"`-only default now sees `Info`-level
log lines move to stderr.

`Console.Console` is a public `Context.Reference<Console>` with
`globalThis.console` as its default value, so nothing is imposed on the
consumer's layer stack, the stderr/stdout split is directly expressible as
`console.error` versus `console.log`, and the surface is testable by
construction — swapping the reference is how `TestConsole` already works.
`References.LogToStderr` is a public reference too, and `CliLogger` honours
it only as a force-all-to-stderr override, never as a per-level one — a
consumer who sets it meant "this whole program's output is diagnostic".

### CliRuntime — wrap the reporting, not the runtime

The failure in motivation 2 is *where the report happens*, not that
`runMain` exists. The fix is to catch inside the effect, render through the
program's own logger, and set the exit code — all before any `runMain` is
called. This package provides a combinator applied inside the program, and
the consumer still calls their platform's `runMain` themselves:

```ts
NodeRuntime.runMain(program.pipe(CliRuntime.reportFailures, Effect.provide(MainLive)))
```

Wrapping `runMain` itself would drag a platform choice into a library that
has no business making one, and would make the package unusable from Bun or
Deno for no gain.

### Findings are success, exit codes still reach teardown

A handler that reports findings — validation errors, lint violations, any
result a program needs to surface with a non-zero exit but that is not
itself a crash — *succeeds*, and calls `CliExit.set(code)` to record the
code it wants. `CliExit` is a `Context.Service` holding a
`MutableRef<number>`, not a `Reference`: forgetting to provide it inside
`CliRuntime.main` is a type error, not a silently-ignored global. On
success, `main` reads the cell; if it is non-zero, `main` turns the
success into a failure carrying a private sentinel, marked with
`CliRuntime.reported(sentinel, code)`.

This exists because `process.exitCode` cannot be trusted to reach
teardown. Node's `runMain` skips `process.exit(0)` on success — it calls
`process.exit` only when the fiber received a signal or its own exit code
is non-zero (`@effect/platform-node-shared` `NodeRuntime.ts:58-65`) — so a
handler that only sets `process.exitCode` on an otherwise-successful fiber
relies on Node's own process-exit machinery to eventually notice that
field, well after Effect's own finalizers had their chance to run.
Turning the non-zero code into a failure instead routes it through core's
`defaultTeardown` on any runtime, exactly like an ordinary error, so
finalizers run before the process exits with the recorded code. `main`
packages no numeric taxonomy beyond 64 ([D7](../decisions/usage-exit-code-defaults-to-64.md))
and 130 (signal interrupt); codes 1 to 3 stay each consumer's own to
assign.

### `reportFailures` never renders `ShowHelp`

`Command.runWith` already printed the help text or the parse errors before
a `ShowHelp` reaches `reportFailures` (the `ShowHelp` `catchFilter` in
`runWith`: `Command.ts:1996-2001` in the vendored `.repos/effect` tree) — rendering
it a second time is what produced the stray "Help requested" line every
consumer previously worked around by hand. `reportFailures` now never
renders a `ShowHelp`, and never renders the `CliExit` sentinel either.
Nor does it render a `CliError.UserError` `runWith` already printed
(`showUserError` flips its `Runtime.errorReported` mark to `false` after
printing); that one exits with `usageExitCode`. Under `renderErrors: false`
the mark stays `true` and the error renders normally. It
still renders every other `errorReported: false` error: schemastore-cli's
`GateError` summary relies on that render path staying intact. A
`ShowHelp` that carries errors is remapped to `usageExitCode`
([D7](../decisions/usage-exit-code-defaults-to-64.md), default 64); a bare
`--help` invocation (`ShowHelp` with no errors) keeps exit 0.

### The renderers

`SchemaIssueRenderer` wraps `SchemaIssue.makeFormatterStandardSchemaV1`
rather than reimplementing it. Its job is discoverability, deduplication —
a three-member union otherwise prints the same unknown-key line three
times, once per member — and one phrasing override: core's `UnexpectedKey`
message is `"Expected no excess property"`, which describes the schema's
rule rather than the user's mistake, so it is rewritten to `unknown key
"rulesetz"`.

`ConfigIssueRenderer` is the same treatment for
`@effected/config-file`'s `ConfigValidationError`, whose `issue` tree is the
same shape. It is the reason this package peers on `@effected/config-file`
rather than the other way around: rendering is presentation and belongs at
the boundary.

**`@effected/config-file` is an optional peer**
(`peerDependenciesMeta.optional: true`), mirroring `@effected/markdown`'s
arrangement with `jsonc`/`toml`/`yaml`. The manifest declaration is the easy
half; the load-bearing half is that `ConfigIssueRenderer` is its own module
that nothing but the entry point imports, with shared rendering in
`packages/cli/src/internal/format.ts`. An optional peer reached from a
shared module is not optional — it is a runtime crash for every consumer
who believed the manifest. This is verified by build, not by reading: every
runtime import in every emitted chunk must be `effect` or relative, and the
package's only references to `@effected/config-file` are comments and one
type-only import in the `.d.ts`. One consequence follows: because that
type appears in a public signature, a consumer who has not installed the
optional peer sees the type fail to resolve in that one module — harmless
at runtime, invisible under the common `skipLibCheck: true`, but real. This
is the kit's established trade — `@effected/markdown` ships the identical
pattern — not a new one: an optional peer buys install-time freedom and
costs type resolution in the module that names it.

## Decisions settled against core's source

See the linked Decisions for full reasoning:

- [the exit code is set through core's own error markers](../decisions/cli-exit-code-via-runtime-markers.md)
- [`CliLogger` honours `LogToStderr` in one direction only](../decisions/cli-logger-force-all-stderr-only.md)
- [the `Command` handler-accessor gap is filed upstream, not shimmed](../decisions/cli-handler-accessor-gap-filed-upstream.md)

The presentation layer adds its own:

- [`@effected/cli` grows a presentation layer](../decisions/cli-grows-presentation-layer.md)
- [two prompt engines raise one `Cancelled`](../decisions/one-cancelled-for-two-prompt-engines.md)
- [the audience flag is four shared root flags](../decisions/audience-flag-is-shared-root-flags.md)
- [the package owns its display width](../decisions/own-display-width.md)
- [the document IR is plain data](../decisions/doc-ir-is-plain-data.md),
  [it has no JSON renderer](../decisions/no-json-renderer.md) and
  [`CliLinks` finds the project root with `@effected/walker`](../decisions/cli-takes-the-walker-edge.md),
  which supersedes the draft that had it [inline](../decisions/cli-links-inline-ascent.md)
  (all drafts, awaiting a human to verify them)
- [`FORCE_COLOR` is honoured](../decisions/force-color-honoured-node-precedence.md)
  and [`@effected/env` is its own package](../decisions/env-is-its-own-package.md),
  both recorded against the [`env` Module](env.md)

## Errors

**Two error classes, both about prompts:** `Cancelled` and `NotInteractive`.
Everything else here is presentation: it renders errors other packages raise
and must not wrap them. A renderer that fails has a defect, not a domain error
— a `SchemaIssue` tree that cannot be rendered is a bug in the renderer.

## Observability

**No spans.** Rendering a string and writing a line are not operations an
operator traces, and a span around a logger write would appear in every log
line's own trace. The package stays telemetry-agnostic, like every library
in the kit.

## Testing

The `Console` reference makes the whole surface testable without stubbing
globals: provide a capturing `Console`, run the program, and assert on what
was written and on which stream — the property most worth pinning, since it
is the one that silently regresses and the one `mytool run > log.txt`
depends on. The discriminating mutant for `CliLogger` is routing everything
to stdout; a suite that still passes is asserting on content and not on
stream, which is half a test.

Drive levels with `References.MinimumLogLevel`, provided as a service.
`Logger.withMinimumLogLevel` does not exist on the v4 line and is the
obvious first reach — verified absent from core's `Logger.ts` rather than
assumed.

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`.

## Non-goals

Out of scope, and staying out: argument parsing, flags, the command tree and
help (`effect/cli` owns them), a platform package, and a dependency edge from
anything but an application. Prompts and interactive UI used to be on this
list; [the presentation-layer decision](../decisions/cli-grows-presentation-layer.md)
moved them in, and the old boundary limitation is deprecated.

## Build

Standard package setup. Expected to need no API Extractor suppression: no
class factories here, so no synthesized `_base` symbol. Gate on a cold
`pnpm build --filter @effected/cli`, never the raw script.


---
<!-- okf/consumers/reposets.md -->
---
type: Consumer
title: spencerbeggs/reposets
description: A declarative GitHub repository management CLI — a committable TOML config names settings, secrets, variables, rulesets, deployment environments and CodeQL setup across groups of repositories, applied by one `sync` command.
repository: spencerbeggs/reposets
status: stable
tags: [bundle, dx]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: fd2f89b8740220fed513c7d26b8a71dcc8eb8b20035eb5715a81df974cb747ad
---

# spencerbeggs/reposets

`spencerbeggs/reposets` publishes `reposets`, a declarative GitHub
repository management CLI. Its published package is `package/`, not the
repository root. It is unlike every other consumer in this register, and
each difference is why its dogfood loop found what it found:

- It is a CLI, not a GitHub Action. Every other consumer runs on a
  GitHub-provided runner with one platform and one log sink; this one runs
  on a person's terminal, which is what surfaced
  [`@effected/cli`](../modules/cli.md).
- It is the first consumer of the application control plane —
  [`@effected/app`](../modules/app.md) and
  [`@effected/store`](../modules/store.md) had shipped and had never been
  driven from outside their own test suites before this loop.
- It is the first loop that upstreamed code rather than only findings.
  Two ports were written downstream against a design doc and landed in
  the kit: the repository resource services plus sealed-box crypto into
  [`@effected/github`](../modules/github.md), and the whole of
  [`@effected/cli`](../modules/cli.md). Both were folded, corrected and
  gated on the kit side; neither arrived as a merge of consumer source.

The loop that produced these findings is closed: its findings landed, the
wave it drove released, and the consumer resolves through published
`catalog:effect` pins. Verified against a survey of the checkout dated
2026-08-25; there is no local checkout at present, so everything here is
as of that survey.

## What it exercises

The whole application control plane, wired together rather than sampled:
`App.layer` gives it XDG-namespaced directories, a migrated SQLite store
and a TTL cache; `AppConfig` loads its TOML config over the same
namespace. Using all four capabilities together is what made gaps in
their *seams* visible — the resolver chain, read-through caching, the
UTF-8 codec and decode options were all seam findings, not feature
requests.

It exercises the GitHub resource surface in a direction no GitHub Action
consumer needs: the actions in this register read and report, while this
CLI *writes* configuration repeatedly across a fleet and needs to know
exactly what it sent. That produced `AppliedSettings`, a pagination sweep,
and a ruleset `source_type` fix, all landed in
[`@effected/github`](../modules/github.md)'s resource surface.

It is the first exercise of durable local state as a product feature
rather than an implementation detail: a sync journal, last-applied
fingerprints for drift detection, and a TTL cache over three GitHub
lookups — the first exercise of `@effected/store`'s rollback path against
a real database rather than an in-memory test suite.

It is also `@effected/schemastore`'s first consumer outside the repository
that scoped that package, using it as a devDependency to generate the
config's JSON Schema at build time.

## What this loop proves that the earlier ones did not

A consumer can report a genuinely missing capability, not merely a
misprojected one. Earlier consumers in this register mostly found
projections — surfaces the kit already had the pieces for, differently
shaped. This loop found absences: the resolver chain on `AppConfig.layer`,
a `Cache.through` combinator, a UTF-8 byte-array decode helper, decode
`parseOptions`, several unrepresented GitHub route families, and a
workflow-listing endpoint were all genuinely missing rather than
mis-projected. The difference is not consumer quality — it is that
earlier consumers exercised surfaces the kit had already been shaped
against, and this one arrived first at the application and store layers
and at the terminal. The first consumer of any surface should be expected
to find absence; later ones should be expected to find projections.

Absence and projection call for different responses: a projection gets
absorbed, while an absence gets designed — and this loop's two largest
absences were designed before being built. The `cli` package was written
up and reviewed by the consumer as a boundary decision before the port
began, which is what kept a considered `Stdio` dead end to a paragraph
rather than a rewrite.

A shared symptom across two call sites is as often a shared author habit
as a shared dependency defect. The consumer filed a blocking finding after
both a `doctor` command and a `sync` command reported "no config found"
for a present-but-invalid file, reasoning that two independent sites
producing identical bad output implicated the loader. The premise was
challenged rather than the fix accepted, and the actual cause was the
consumer's own `orElseSucceed(() => [])` written independently in both
places. A finding whose evidence is "it happens in two places" deserves
its premise challenged before its fix is implemented — same author, same
habit, twice, is a plausible alternative to a shared kit defect.

Withdrawal is a normal move and cheap when the reasoning is public.
Several findings — a discovery defect, core-API claims, a named-export
condition on a CommonJS dependency, and an `ownerType` scope exception —
were retracted by one side or the other after being tested against a
stated rule. Each retraction left a rule behind, stronger for having
survived a challenge than it would have been unopposed.

## Where the kit's edge sits

- Credential resolution, including the 1Password SDK. Secret *values*
  arrive by a mechanism the consumer chooses; the kit owns encrypting and
  sending them once resolved.
- The config dialect — group targeting, ruleset shorthand, cleanup
  policies with preserve lists, resolvable value labels. This is the
  product, and none of it is GitHub's vocabulary or the kit's.
- The sync engine — phase ordering, the decision table, dry-run
  reporting, GHAS-license and personal-account awareness. The kit answers
  what a repository *is* and what a write *sent*; which writes to make is
  the application's decision.
- Drift fingerprints. The consumer keeps its own content-hashing library
  for its own drift model after the sealed-box crypto moved upstream —
  the crypto that belonged to GitHub's API left the consumer, and the
  hashing that belongs to its own drift model stayed.

## Open questions

- It still has not adopted `@effected/cli`, the package its own design
  doc drove into existence. The port landed in the kit and has released,
  but as of the last survey the consumer had advanced its other pins past
  it without taking `cli` up — so the one piece of adoption evidence that
  package most needs is the one this loop did not produce. Whether the
  consumer's own CLI boundary collapses onto it cleanly is still
  unanswered.


---
<!-- okf/decisions/cli-grows-presentation-layer.md -->
---
type: Decision
title: "@effected/cli grows a presentation layer and interactive UI"
description: "@effected/cli takes on audience, interactivity, theme, status vocabulary, messages, the document IR, failure rendering and logging composition in its React-free root, and interactive screens behind ./ui, replacing the not-a-framework limitation's ban on prompts and spinners."
status: draft
supersedes: ../limitations/cli-is-not-a-framework.md
tags: [architecture, dx]
sources:
  - id: cli-presentation-audit
    resource: https://github.com/spencerbeggs/effected/issues/838
    title: "Issue 838: the audit of presentation code consumers re-derive"
generated:
  by: "okfit/claude-code"
  at: 2026-09-30T20:33:06Z
  body_sha256: 8292533ae4f0be2ff46c0e69f5a82e99446bbba7015354cbbd2af2ebced7ff8d
---

# @effected/cli grows a presentation layer and interactive UI

## Context

[The not-a-framework limitation](../limitations/cli-is-not-a-framework.md)
kept `@effected/cli` to a plain-text logger, failure reporting and two
renderers, and sent a consumer who wanted prompts or spinners to core's
`Prompt`. Consumers did not stop needing the rest: the audit in issue 838
found each of them re-deriving the same audience detection, colour decision,
status glyphs, truncation, duration and percent formatting, and log
composition, and getting it differently each time.[^cli-presentation-audit]
The interactive CLI kit is the answer, and it needs `@effected/cli` to own
that layer.

## Decision

`@effected/cli` grows a presentation layer in its **React-free root**:

- audience and interactivity: the `--audience` flags and `CliInteractive`;
- a theme: colour tokens, glyphs and an open status vocabulary;
- user-facing messages, separate from diagnostics;
- the document IR and its renderers (planned, P3);
- failure rendering on that IR (planned, P3);
- logging composition, for a diagnostics level and sinks that coexist with
  `CliLogger`.

It also grows interactive screens behind a `./ui` subpath (planned, P4),
which the root never reaches. The root stays
[boundary tier](../glossary/library-tier.md): no platform package, no
runtime dependency, and `@effected/env` as a required peer (see
[its own package](env-is-its-own-package.md)).

## What still holds

`effect/cli` owns argument parsing, flags, the command tree and the help
system. The kit never builds a second framework: nothing added here parses
arguments or declares a command tree, and a change that starts to look like
that belongs upstream or nowhere. Nothing in the kit may depend on
`@effected/cli` except an application.

## Alternatives rejected

- **A separate `@effected/cli-ui` package.** Rejected. The presentation layer
  is consumed by the same programs that already depend on `cli`, and a second
  package would split one boundary into two peers that must resolve to one
  copy of each service tag, for no install saving a consumer could use.
- **A separate `cli-ink` package for the interactive screens.** Rejected for
  the same reason, and because the optional peers `ink` and `react` cost a
  consumer who never imports `./ui` nothing.

## Consequences

The limitation is deprecated and this Decision supersedes it. Its one open
question, colour-aware output, is settled by
[honouring FORCE_COLOR](force-color-honoured-node-precedence.md) through
`@effected/env`. The [`cli` Module](../modules/cli.md) documents the new
surface, and the package's `CLAUDE.md` points here instead of banning prompts.

[^cli-presentation-audit]: <https://github.com/spencerbeggs/effected/issues/838>


---
<!-- okf/decisions/ui-tier-is-integrated-on-opt-in.md -->
---
type: Decision
title: The cli root stays boundary, and ./ui is integrated only for consumers who opt in
description: "@effected/cli keeps a boundary-tier root while its ./ui subpath imports the third-party ink and react, which makes ./ui integrated only for a consumer who installs those optional peers; R1-R4 are read per entrypoint for this package."
status: draft
tags: [architecture, deps, bundle]
sources:
  - id: dependency-policy
    resource: ../conventions/dependency-policy.md
    title: "Dependency policy: R1-R4"
  - id: cli-package-json
    resource: ../../packages/cli/package.json
    title: The cli manifest
  - id: schemastore-cli-package-json
    resource: ../../packages/schemastore-cli/package.json
    title: The schemastore-cli manifest, the one kit package that depends on cli
  - id: npm-optional-peers
    resource: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta
    title: "npm package.json docs, peerDependenciesMeta"
  - id: pnpm-auto-install-peers
    resource: https://pnpm.io/settings/peer-dependencies#autoinstallpeers
    title: "pnpm settings, autoInstallPeers"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T03:23:20Z
  body_sha256: 5951dba03d70fc3c782c2a7c72cacf5d9aacc2496fdbe9d9f50124912f8382b5
---

# The cli root stays boundary, and ./ui is integrated only for consumers who opt in

## Context

A [library's tier](../glossary/library-tier.md) is its own runtime
dependency surface. `@effected/cli`'s root is boundary: it imports `effect`
and `@effected/*` packages only, and does its IO through core's services.
The [./ui subpath](ui-is-a-subpath-with-optional-peers.md) imports `ink` and
`react`, which are third-party runtime packages, so by the tier definition
anything that loads `./ui` is integrated. R1 forbids an external runtime
dependency on a boundary package unless a retier is recorded.[^dependency-policy]

## Decision

The tier is read per entrypoint for this package, and this is the first
package in the kit to need that reading:

- **The root and `./testing` stay boundary.** They reach neither `ink` nor
  `react`, which the boundary test proves by walking the module graph.
- **`./ui` and `./ui/testing` are integrated, on opt-in.** `ink` and `react`
  are optional peers.[^cli-package-json] npm states that it "will not
  automatically install optional peer dependencies",[^npm-optional-peers]
  and pnpm's `autoInstallPeers` installs only missing **non-optional**
  peers.[^pnpm-auto-install-peers] So a consumer who imports `./ui` and
  installs the peers takes an integrated edge, and a consumer who does not
  installs nothing for it.

R1 to R4 apply as follows:

- **R1** is held by the root and `./testing`, which take no external runtime
  dependency. Only the opt-in subpaths name one.
- **R2** propagates tier only from a tier-3 package. The one kit package that
  depends on `@effected/cli` is `schemastore-cli`,[^schemastore-cli-package-json]
  a [companion](../glossary/companion-package.md) that carries no tier and
  imports only the boundary root, so nothing inherits a tier from `./ui`.
- **R3** keeps the root boundary despite its `@effected/*` edges (`env`,
  `walker`, `glob`, `config-file`, `github-commands`): each is boundary or
  pure, and a boundary edge does not propagate.
- **R4** holds, because the tier follows the surface a consumer actually
  imports, not what the manifest permits.

## Alternatives rejected

- **Call the whole package integrated.** Rejected. It would tell every
  consumer of the root that it pays for an external install it never makes,
  and the tier label would stop carrying the dependency fact.
- **Split `./ui` into its own package to keep one tier per package.**
  Rejected in [the subpath decision](ui-is-a-subpath-with-optional-peers.md):
  the optional peers already cost a non-consumer nothing.

## Consequences

- The project roster keeps `cli` at boundary. The per-entrypoint reading lives
  here and in the [cli Module](../modules/cli.md).
- The layering check reads `peerDependencies`, but it constrains `@effected/*`
  edges only, so the two new external peers do not move `cli` in
  `layers.json`.
- **"Installs nothing" holds only while no incompatible `react` is in the
  tree. This is not probed.** npm's resolver treats a present but out-of-range
  optional peer as a conflict, so a consumer tree that already holds, say,
  `react@18` may fail `npm install` with `ERESOLVE` even though it never
  imports `./ui`.

[^dependency-policy]: `../conventions/dependency-policy.md`
[^cli-package-json]: `../../packages/cli/package.json`
[^npm-optional-peers]: <https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta>
[^pnpm-auto-install-peers]: <https://pnpm.io/settings/peer-dependencies#autoinstallpeers>
[^schemastore-cli-package-json]: `../../packages/schemastore-cli/package.json`


---
<!-- okf/decisions/ui-declarations-reference-the-root-by-name.md -->
---
type: Decision
title: The ui declarations reference the root's types by the package's own name
description: "The ./ui and ./ui/testing declarations import the root's types from @effected/cli (kept external with dtsExternals) instead of carrying copies, with API Extractor's resulting noise suppressed for the ui entries only and re-pinned by tests over the built declarations."
status: draft
tags: [architecture, bundle, dx]
sources:
  - id: cli-build-config
    resource: ../../packages/cli/savvy.build.ts
    title: "The cli build: dtsExternals and the scoped suppression"
  - id: cli-declarations-test
    resource: ../../packages/cli/__test__/declarations.test.ts
    title: The gates over the built declarations
  - id: cli-boundary-test
    resource: ../../packages/cli/__test__/boundary.test.ts
    title: The self-name rules
  - id: split-declarations-probe
    resource: "Consumer probe over the built dist/prod/npm/pkg/index.d.ts and ui.d.ts, run 2026-10-01 during P4 review"
    title: The probe that found the split declarations
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T04:10:06Z
  body_sha256: d61b911ace21e180dc7a3e0ca049efe73187e330e192b4d811899bfcc3e66a3d
---

# The ui declarations reference the root's types by the package's own name

## Context

`@effected/cli` builds one rolled-up `.d.ts` per entrypoint. `CliUi.run`, in
`./ui`, names root types in its signature: it fails with `Cancelled` or
`NotInteractive` and requires `CliTheme`.

When `./ui` imported those types relatively, the rollup put **copies** of them
into `ui.d.ts`. `Status` has a private member, so a copy is nominally distinct
from the original. A consumer providing the root's `CliTheme` layer could not
then satisfy `CliUi.run`'s requirement: the probe failed with "Types have
separate declarations of a private property 'defs'".[^split-declarations-probe]

Re-exporting the root types from `./ui` did not help, because the copies remained.

## Decision

- **`./ui` names root types through the package's own name**, with
  `import type * as Cli from "@effected/cli"`. `./ui/testing` does the same,
  and also names `./ui`'s types through `@effected/cli/ui`. Values stay
  relative imports, so the runtime graph is unchanged.
- **The dts pass keeps those imports external.** `dtsExternals` is set to
  `["@effected/cli", "@effected/cli/ui"]`; the match is exact, so each subpath
  is listed. The emitted `ui.d.ts` imports from `@effected/cli`, and
  `ui-testing.d.ts` from `@effected/cli/ui`, instead of copying.[^cli-build-config]
- **API Extractor's resulting noise is suppressed for the ui entries only.**
  The meta pass follows the self-name back into source and reports every root
  type as a forgotten export. The suppression rule matches
  `entry point ui(?:-testing)?\.d\.ts$`, so the root entry is still checked in full.
- **Tests replace what the suppression hides:**[^cli-declarations-test]
  - a consumer compiled against the built declarations must discharge
    `CliUi.run`'s requirement with the root's `CliTheme` layer, with an
    unprovided control;
  - no top-level declaration in the built `ui.d.ts` or `ui-testing.d.ts` may be
    left unexported, since that is how a forgotten export shows up in a rollup;
  - each built entry must export exactly what its source entrypoint does, and
    import the package it keeps external. This is a content check, so a turbo
    cache replay of the build report cannot turn it red.
- **The boundary test holds the self-name rules:**[^cli-boundary-test]
  - ui files name `@effected/cli` through `import type` only;
  - a root module must not import the package's own name at all, which would
    make the root declarations import themselves;
  - the root must never reach `@effected/cli/ui`.

## Accepted cost

The meta pass also throws while harvesting per-module source locations for each
ui entry. It reports this once per ui entry as a non-fatal warning: "Could not
harvest per-module source locations", level `warn`, with no code and not
CI-fatal. So the prod build report carries one warning per ui entry, accepted as
a documented exception. The API model for the ui entries also duplicates the
root's members, with some wrong source paths. That model is generated and
gitignored, so only the website's API pages are affected.

The fix belongs upstream. The meta pass should treat the package's own name as
external when it is listed in `dtsExternals`, or model multi-entry packages so
that cross-entry types need no suppression. An issue for `@savvy-web/bundler` is
drafted and not yet filed.

## Alternatives rejected

- **Type-only re-exports of the root types from `./ui`.** Rejected: the copies
  stay nominally distinct, which is the defect itself.
- **The self-reference without `dtsExternals`.** Rejected: the rollup inlined
  the whole root into `ui.d.ts`.
- **Making the root types structurally interchangeable** by dropping private
  members. Rejected: the next private member would split them again.
- **Changing `CliUi.run` to name no root class.** Rejected: it changes the
  specified API.

[^split-declarations-probe]: Consumer probe over the built `index.d.ts` and `ui.d.ts`, 2026-10-01.
[^cli-build-config]: `../../packages/cli/savvy.build.ts`
[^cli-declarations-test]: `../../packages/cli/__test__/declarations.test.ts`
[^cli-boundary-test]: `../../packages/cli/__test__/boundary.test.ts`


---
<!-- okf/decisions/live-view-runs-and-modes.md -->
---
type: Decision
title: A live view is a scoped drain of runs, hosted or owned, with no input and the mount permit per run
description: "CliUi.live folds a Stream into state inside the caller's scope; a run begins at an isStart event (or where an optional begins predicate says, given the state before and after) and ends at an isTerminal event, which unmounts and commits the frame, and an event outside a run that begins none is folded and not drawn; hosted and owned differ only when not interactive, neither mounts input hooks, and interactive is passed explicitly rather than left to Ink's is-in-ci guess."
status: draft
tags: [architecture, dx]
sources:
  - id: pinned-by
    resource: ../../packages/cli/__test__/ui/CliUi.live.modes.test.ts
    title: "The live-view mode tests: hosted and owned, runs, mounting and the non-interactive final frame"
  - id: ink-render
    resource: "npm:ink@7.1.1"
    title: "Ink 7.1.1, build/ink.js:706-708: interactive defaults to !isInCi && stdout.isTTY"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T14:11:47Z
  body_sha256: 2329fc1131614fc5222318f96127e4748e4ef8118f21f26808002b4257538c3a
---

# A live view is a scoped drain of runs, hosted or owned, with no input and the mount permit per run

## Context

`CliUi.run` mounts one screen and waits for an answer. A reporter's progress
view is the other shape: a stream of events that may span several runs (a
watch mode) and never ends on a key. vitest-agent hand-rolled that view; the
kit takes it over.

Three probe findings shape it.[^pinned-by] Remounting on the same stdout
straight after `unmount()` is clean, while mounting twice warns, reuses the
instance and tears the frame. Inside a Vitest worker stdout is a
non-TTY socket and Ink's `is-in-ci` guess resolves to non-interactive, while
the main process is a TTY. `renderToString` honours the kit's colour
level and runs hooks, but terminal hooks there read the unprovided default
stdout.

## Decision

- **A scoped drain.** `live` acquires the stream's pull in the caller's
  scope before it returns, so a PubSub-backed stream is subscribed before
  the first publish, then forks a drain that folds each event into state.
  Closing the scope interrupts the drain and unmounts.
- **Runs.** A run begins at an `isStart` event and ends at an `isTerminal`
  event. An optional `begins(event, before, after)` widens what begins a run
  while none is going (its default is `isStart(event)`), for a consumer that
  joins a run mid-way: vitest-agent passes `RunStarted`, or the phase going
  from idle to anything else. An event while no run is going that begins none
  is folded and not drawn. The end of a run is Ink's own `unmount()`, which
  commits the final frame; the next start mounts fresh. A start while mounted
  re-renders in place. A start during a run that degraded ends it, as its
  terminal event would, and mounts a fresh run, so a host that restarts
  without a terminal event (a watch rerun mid-run) is drawn again. The fold is never reset by the kit: that is the
  reducer's job.
- **The mount permit is held per run,** from mount to unmount, not for the
  view's whole life, so a `CliUi.run` between runs mounts and one during a
  run waits.
- **Two modes, `owned` (default) and `hosted`, differ only when not
  interactive.** `owned` writes the final frame once as a string, through
  `renderToString` at the stdout width with the kit's size override;
  `hosted` writes nothing, since its host owns the output.
- **No input.** Neither mode mounts `useInput` or `usePaste`, so raw mode is
  never entered and Ctrl-C stays the platform's SIGINT, which interrupts the
  program and closes the scope.
- **`interactive` is passed to Ink explicitly,** from `CliInteractive`,
  never left to Ink's default.[^ink-render]

## Alternatives rejected

- **Any event while nothing is drawn begins a run.** It is what joins a run
  mid-way, but vitest-agent publishes `CoverageReady`, `ThresholdViolation`
  and `TrendComputed` after `RunFinished` (and `WatcherReady` in watch mode),
  so it mounted a second copy of the finished run and left a live frame up
  while idle. Joining mid-way is the consumer's to opt into, through `begins`.

- **Holding the permit for the view's whole life.** It would block every
  prompt for as long as a reporter lives, including between watch runs.
- **Skipping the permit.** Ink keys instances by stdout, so a prompt during
  a run would hijack the live instance.
- **Letting Ink decide `interactive`.** Its `is-in-ci` guess is wrong in a
  Vitest worker and ignores the kit's agent audience.
- **An `owned` mode with Ctrl-C handling.** It needs raw mode, which steals
  stdin from a host; SIGINT already ends the scope.

## Consequences

- A hosted view in a Vitest main process is torn by a worker's raw
  `process.stdout` or `process.stderr` writes, which Vitest pipes straight
  through. The kit cannot intercept them; it is documented, not fixed.
- `useTerminalSize` needs a size override for the `renderToString` path,
  which `UiProvider`'s `size` provides.

[^pinned-by]: `packages/cli/__test__/ui/CliUi.live.modes.test.ts` and `CliUi.live.test.ts`, which pin the runs, the two modes and the explicit `interactive`; `UiProvider.test.ts` pins the size override `renderToString` needs. The probes behind the three findings were run once and are not kept.
[^ink-render]: `npm:ink@7.1.1`, `build/ink.js:706-708`


---
<!-- okf/decisions/live-height-clamp-not-width.md -->
---
type: Decision
title: The live frame is clamped to rows - 1 in height, and its root width is never taken from a hook
description: "Ink 7.1.1 does not miscount a line exactly columns wide, but a frame taller than the terminal makes Ink emit ESC[3J and wipe the scrollback, and a root width read from useTerminalSize lags Ink's own resize repaint and strands a copy on shrink; so the clamp is on height, and a margin, if wanted, is marginRight 1."
status: draft
tags: [architecture, compat]
sources:
  - id: pinned-by
    resource: ../../packages/cli/__test__/ui/CliUiTest.live.test.ts
    title: "The live-view tests: the frame is clamped to rows - 1, and a resize repaints without stranding a copy"
  - id: ink-resize
    resource: "npm:ink@7.1.1"
    title: "Ink 7.1.1, build/ink.js:89-112,763-768 (clear-terminal for a tall frame) and 264-290 (resize re-layout)"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T14:11:47Z
  body_sha256: d7a5a2e1cdbfd4095a600425b93aceb162bdd214744cf42da4cfe9e6f944f3da
---

# The live frame is clamped to rows - 1 in height, and its root width is never taken from a hook

## Context

vitest-agent clamped its live frame's width to `columns - 1`, against a
belief that Ink miscounts `eraseLines` for lines exactly `columns` wide and
strands header copies. The first design carried the clamp over.

A probe found no such miscount in Ink 7.1.1, on a deferred-wrap emulator or
in iTerm2.[^pinned-by] It found a different hazard: a frame taller than the
viewport takes Ink's clear-terminal path, which writes `ESC[3J` and wipes the
scrollback on every overflowing frame.[^ink-resize] A second probe then found the
one real strand: Ink re-lays out the existing tree on `resize` before React
re-renders, so a root `width` read from `useTerminalSize` is one paint
stale, and on a shrink Ink first paints the wider frame into the narrower
terminal.

## Decision

- The live frame's height is `min(content, rows - 1)`, re-read from
  `UiStreams.stdout` on every render and on resize.
- The root `Box` takes no explicit width at all. If a one-column margin is
  wanted, it is `marginRight: 1` (or `paddingRight: 1`), which Yoga
  recomputes inside Ink's synchronous resize.
- Width-dependent content (truncation through `useTerminalSize().columns`)
  stays allowed; long rows use Ink's `wrap="truncate-end"` so Yoga clips
  rather than the terminal wrapping.

## Alternatives rejected

- **A `columns - 1` root width from a hook.** It causes the strand it was
  meant to cure.
- **No clamp.** A long run wipes the user's scrollback with `ESC[3J`.

## Consequences

- A frame with more rows than fit loses its bottom rows rather than the
  user's history; a consumer that cares windows its own rows (`Viewport`).
- A glyph some emulator draws wider than `string-width` counts can still
  strand a copy; `marginRight: 1` is the hedge if one turns up.
- The height clamp is itself hook-derived (`useTerminalSize().rows`), so it
  carries the resize lag in the other dimension: on a resize Ink re-lays out and
  repaints the tree it has before React re-renders, so after a **height**
  shrink a frame already at its full height is painted once taller than the
  terminal and takes the clear-terminal path. Yoga cannot read the terminal,
  so this is documented on `CliUi.live`, not fixed; a frame with spare rows
  never meets it.

[^pinned-by]: `packages/cli/__test__/ui/CliUiTest.live.test.ts` and `CliUi.live.test.ts`, the height clamp and the resize behaviour. The probes that found them (a deferred-wrap emulator and iTerm2 for the width question, a resize on a pty for the strand) were run once and are not kept.
[^ink-resize]: `npm:ink@7.1.1`, `build/ink.js:89-112`, `763-768` and `264-290`


---
<!-- okf/decisions/live-logs-through-ink.md -->
---
type: Decision
title: While a live view is mounted, kit logs go through Ink's own stdout and stderr writers
description: "The live view exposes a bridged Console whose writes go through Ink's useStdout().write and useStderr().write while a run is mounted, so a log line lands above the frame without tearing it, and straight to the stream before mount and after unmount, since Ink silently drops hook writes after unmount."
status: draft
tags: [architecture, observability]
sources:
  - id: pinned-by
    resource: ../../packages/cli/__test__/ui/inkConsole.test.ts
    title: "The console bridge writes above a live Ink frame on the production path"
  - id: ink-writers
    resource: "npm:ink@7.1.1"
    title: "Ink 7.1.1, build/ink.js:433-489 (writeToStdout/writeToStderr, early return when unmounted) and build/render.js:23-35 (the instance has no writers)"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T14:11:47Z
  body_sha256: 3f49640a467f009d31594c0ce958690470c1ce8940ad8c4bd964f1ec04c07c29
---

# While a live view is mounted, kit logs go through Ink's own stdout and stderr writers

## Context

`CliUi.run` forbids logging while a screen is mounted: Ink redraws by
counting the lines it last wrote, so a line from elsewhere lands inside the
frame and tears it. A live view lasts a whole test run, so "do not log" is
not an option.

A probe tried seven mechanisms on a pty.[^pinned-by] `<Static>`, the hook
writers (`useStdout().write`, `useStderr().write`) and `patchConsole` were
clean; raw `process.stdout` and `process.stderr` writes left stale frame
copies and erased the log lines; `clear()` then a raw write destroyed the
history. The instance `render()` returns has no writers: they live on the
internal `Ink` class, reached only through the hooks, and each returns early
once unmounted, so a write after unmount is silently lost.[^ink-writers]

## Decision

- A kit-internal bridge component, mounted inside the live tree, captures
  `useStdout().write` and `useStderr().write`.
- The live handle exposes a `Console` over that bridge: `log` and `info` go
  to the stdout writer and `error` and `warn` to the stderr writer, keeping
  the kit's stdout/stderr contract.
- Before a run mounts, and from just **before** `unmount()`, the same
  `Console` writes straight to `UiStreams`, so no line hits Ink's drop.

## Alternatives rejected

- **`<Static>`.** It needs an append-only items array in React state
  (unbounded in watch mode), is throttled, and puts stderr lines on stdout.
- **`patchConsole`.** It hijacks the global console, which a hosted view
  must leave to its host (Vitest), and the kit's loggers do not go through
  `console` reliably.

## Consequences

- A consumer provides the bridged `Console` around the work it does while
  the view is mounted; a log written any other way still tears the frame.
- A degrade warning is written after the unmount, never mid-frame.

[^pinned-by]: `packages/cli/__test__/ui/inkConsole.test.ts`, which asserts the bridged writes land above the frame on the production path. The seven-mechanism probe that chose it was run once and is not kept.
[^ink-writers]: `npm:ink@7.1.1`, `build/ink.js:433-489` and `build/render.js:23-35`


---
<!-- okf/gotchas/ink-delivers-a-chunk-of-keys-before-rerender.md -->
---
type: Gotcha
title: Ink delivers every key in one stdin read before React re-renders
description: A key handler that steps from state captured in its render works one key at a time and repeats a move when several keys arrive in one read, because Ink dispatches them all before React re-renders; step from a functional update, a reducer or a ref instead.
status: draft
resource: ../../packages/cli/src/ui/KeyTable.ts
stale_after: "2027-03-30T00:00:00Z"
tags:
  - dx
  - testing
sources:
  - id: tabs-one-chunk-probe
    resource: "../../packages/cli/__test__/ui/Tabs.test.ts"
    author: "agent:claude-code"
    last_modified: "2026-10-01T05:17:00Z"
  - id: chunk-test
    resource: "../../packages/cli/__test__/ui/CliUiTest.chunk.test.ts"
    author: "agent:claude-code"
    last_modified: "2026-10-01T05:29:00Z"
  - id: char-probe
    resource: "../../packages/cli/__test__/ui/CliUiTest.chunk.test.ts"
    author: "agent:claude-code"
    last_modified: "2026-10-01T05:50:00Z"
  - id: ink-input-parser
    resource: "npm:ink@7.1.1/build/input-parser.js"
    last_modified: "2026-10-01T05:17:00Z"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T06:22:24Z
  body_sha256: c365f3a18be22403427d24646ec3dda87362d5bc05977eb40b549216b30e3eed
---

# Ink delivers every key in one stdin read before React re-renders

## What a reader sees

A widget's key handler reads its position from the render it was created
in (`const next = step(index, count, action)`, with `index` from
`useState`), and every test passes: `CliUiTest` presses keys one write at
a time and waits for the next frame between them, so each key meets a
fresh render.

## What they would wrongly conclude

That the handler is correct, because pressing → twice moved two tabs in
every test, and because React state "is the current state".

## What is actually true

Ink splits one stdin read into keys (at escape sequences and backspace
bytes) and dispatches them all synchronously, before React re-renders. A
second key in the same read runs the same handler closure and sees the
same captured `index`, so it repeats the first key's move instead of
continuing from it. A fast typist, a held arrow key or a terminal that
batches writes all produce such reads.

The probe that showed it wrote `\x1b[C\x1b[C` (→ →) as one `fake.input`
through the production `CliUi.run` path. The Tabs `onChange` calls came
out as `alpha 0, beta 1, beta 1` instead of `alpha 0, beta 1, gamma 2`.
`\x1b[Z\x1b[Z` (Shift-Tab twice) repeated the same way[^tabs-one-chunk-probe].

Two related facts bound the trap:

- **Plain text is never split.** Ink leaves `\t` and `\r` together
  because they can appear inside pasted text, so `\t\t` in one read
  reaches `useInput` as a single two-character string rather than as two
  Tab keys[^ink-input-parser]. A probe of single reads found Ink drops
  nothing either: `"yy"`, `"y\r"` and `"\t\t"` each arrive as one input
  string with no `return` or `tab` flag, and only a backspace byte is
  split out as its own key[^char-probe]. `useKeys` therefore splits text
  of more than one grapheme into a key per grapheme (a decomposed letter
  or a ZWJ emoji is one key; CR, LF or CR LF is one enter; `\t` is tab;
  a space is space) and compares `{ char }` bindings in NFC, so
  `{ char: "y" }` matches each `y` of `"yy"`.
- **A bracketed paste is not keys.** The screen registers a paste
  handler, which turns on bracketed paste and moves every paste onto
  Ink's paste channel, so a pasted `q` or `yes` and a newline cannot
  cancel or answer a widget. `TextInput` reads a paste as text, its line
  breaks as spaces.
- **`TextInput` splits such text at its control characters.** It inserts
  each printable run whole, which is right for a paste; a `\r` submits
  what came before it, and anything after is dropped; a backspace byte
  deletes; a line feed becomes a space; any other control is dropped. So
  `"foo\r"` read in one go submits `foo`.
- **`press` and `type` cannot show it.** They write each key as its own
  chunk and settle between them, so every key meets a fresh render. The
  screen handles of `CliUiTest.render` and `CliUiTest.session` also have
  `chunk(...keys)`, which writes all the keys in one stdin read and
  settles once: that is the call that shows this bug class[^chunk-test].

## The check

A `useKeys` dispatch must step from current state, never render-closure
state. Use any of:

- a functional update, `setState((current) => step(current, action))`;
- a `useReducer` dispatch;
- a ref that the handler itself advances.

Select, MultiSelect, Confirm and TextInput use functional updates. Tabs,
which also reports each step through `onChange` and may be controlled,
advances a ref that every render re-syncs. When reviewing a new widget,
cover it with a one-chunk test of two keys: `handle.chunk("right",
"right")` from `@effected/cli/ui/testing`.

[^tabs-one-chunk-probe]: `__test__/ui/Tabs.test.ts`, "Tabs input in one chunk"
[^chunk-test]: `__test__/ui/CliUiTest.chunk.test.ts`
[^char-probe]: `__test__/ui/CliUiTest.chunk.test.ts`, "coalesced characters"; the raw probe recorded `useInput`'s `(input, key)` on fake streams
[^ink-input-parser]: Ink 7.1.1, `build/input-parser.js`, `splitBackspaceBytes`


---
<!-- okf/decisions/ui-binds-process-streams.md -->
---
type: Decision
title: Only ./ui may bind Node's process streams, and only in three named files
description: "@effected/cli/ui alone may rely on Node's process streams, because Ink has exactly one platform shape; the licence is file-scoped to processStreams.ts, inkChalk.ts and the testing-only fakeStreams.ts, and does not generalize the platform-node licence."
status: draft
tags: [architecture, compat]
sources:
  - id: ink-render
    resource: "npm:ink@7.1.1"
    title: "Ink 7.1.1, build/render.js: render() defaults stdout, stdin and stderr to the process streams"
  - id: cli-boundary-test
    resource: ../../packages/cli/__test__/boundary.test.ts
    title: The boundary test that holds the waived set exact
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T03:17:21Z
  body_sha256: 5a8f9c4dd1a7dfceda390530ff82346e4d55c3f48f3c40d1d84df206e09e9113
---

# Only ./ui may bind Node's process streams, and only in three named files

## Context

The `@effected/cli` root reads no `process` and imports no `node:` module. It
reaches the terminal through core's services (`Console`, `Terminal`) and
`@effected/env`, so it runs anywhere Effect runs.

Ink cannot be written that way. Its `render()` defaults `stdout`, `stdin` and
`stderr` to the process streams, and every stream it takes must be a Node
stream: `isTTY`, `columns`, `rows`, `setRawMode`, `ref` and `unref`, and an
event emitter.[^ink-render] Core's `Stdio` hands out Effect sinks and streams,
not Node stream objects. Ink has exactly one platform shape, so `./ui` is
Node-only by nature; Bun is compatible because it provides the same objects.

## Decision

`./ui` alone may rely on Node's process streams. The licence is granted on
its own argument, and it is scoped to three named files:

- `src/ui/internal/processStreams.ts` reads `process.stdin`, `process.stdout`
  and `process.stderr`, and nothing else. It is the default `UiStreams`.
- `src/ui/internal/inkChalk.ts` imports `node:module`, `node:url` and
  `node:fs`, to resolve the chalk that Ink itself imports
  ([why](ink-colour-via-inks-own-chalk.md)).
- `src/ui/testing/fakeStreams.ts` is **testing-only** and reachable only from
  `./ui/testing`. It may import `node:events` and `node:stream`, to build the
  in-memory TTY streams the screen harness drives.

Every other file under `src/ui/` is held to the root's rules. Each file joins
the boundary test's exact waiver list when it lands, so a waiver that waives
something unexpected, or a fourth file that touches Node, fails the
test.[^cli-boundary-test]

This does not generalize
[the platform-node licence](platform-node-peer-in-one-package.md). `./ui`
takes no platform package, required or optional; the licence is three files
of one subpath, not a package edge.

## Alternatives rejected

- **Bind Ink through `TerminalEnv` or core's `Stdio`.** Rejected. Neither
  provides a Node stream, and wrapping an Effect sink in a fake Node stream
  for production would re-implement the stream contract Ink already gets
  from the process.
- **Take `@effect/platform-node` as a peer of `./ui`.** Rejected. It would
  still have to hand Ink the process streams, and it drags a platform package
  into the manifest for no capability.
- **Waive `process` and `node:*` for all of `src/ui/**`.** Rejected. A
  directory-wide waiver lets any new widget read the environment directly,
  which is exactly what the root's rules exist to stop.

## Consequences

The licence is the boundary test's waiver list, so widening it is a reviewed
edit to one test. A consumer on a runtime without Node's stream objects can
still use the root; it cannot mount a screen.

[^ink-render]: `npm:ink@7.1.1`, `build/render.js`
[^cli-boundary-test]: `../../packages/cli/__test__/boundary.test.ts`


---
<!-- okf/decisions/force-color-honoured-node-precedence.md -->
---
type: Decision
title: "FORCE_COLOR is honoured, with Node's getColorDepth precedence"
description: "@effected/env reads FORCE_COLOR ahead of NO_COLOR, NODE_DISABLE_COLORS, TERM=dumb and the TTY gate, in the order Node's tty getColorDepth uses, replacing the kit's earlier decision to ignore it."
status: draft
supersedes: cli-color-ignores-force-color.md
tags: [architecture, dx]
sources:
  - id: boundary-test
    resource: ../../packages/env/__test__/colorDepth.test.ts
    title: "The colour-depth precedence tests: FORCE_COLOR ahead of NO_COLOR, NODE_DISABLE_COLORS, TERM=dumb and the TTY gate"
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T15:30:50Z
  body_sha256: f592932ed3c63fce4e1d5a78425dea3418dc4998feb16481480eef48510039ff
---

# FORCE_COLOR is honoured, with Node's getColorDepth precedence

## Context

[D8](cli-color-ignores-force-color.md) kept `FORCE_COLOR` unread so that
`CliColor` would agree with core's own formatter. The interactive CLI kit
moves the colour decision into [`@effected/env`](../modules/env.md), where
it is shared by the CLI, MCP servers and test tooling, and where a consumer
running under a CI log or an agent transcript routinely sets `FORCE_COLOR`
to get colour through a non-TTY pipe. Ignoring it there is a defect, not a
posture.[^boundary-test]

## Decision

`TerminalEnv` honours `FORCE_COLOR`, using the order of Node's
`tty.getColorDepth`, highest first:

1. `FORCE_COLOR`: `''`, `'1'` and `'true'` give 16 colours, `'2'` gives 256,
   `'3'` gives truecolor, and any other value gives none.
2. A non-empty `NO_COLOR` or `NODE_DISABLE_COLORS`, and `TERM=dumb`.
3. The TTY gate: a stream that is not a terminal has no colour.
4. Node's win32 branch, keyed on `OS=Windows_NT` in place of
   `process.platform`: truecolor, approximating Node on Windows 10 build
   14931 and later.
5. Node's environment table (`TERM`, `COLORTERM`, `TERM_PROGRAM`, CI
   vendors).

`FORCE_COLOR` beating `NO_COLOR` matches Node, which is the point: a
consumer reading the two documents together sees one behaviour.

## Alternatives rejected

- **Keep D8.** Rejected. Leaving `FORCE_COLOR` unread means a forced colour
  request over a pipe is silently dropped, and the package would keep
  disagreeing with Node itself, the reference every other tool is measured
  against.
- **Diverge from Node's order by letting `NO_COLOR` beat `FORCE_COLOR`.**
  Rejected. It reads as the safer default but produces a third precedence
  that matches neither Node nor the conventional `FORCE_COLOR` documentation,
  so two tools in one pipeline disagree about the same environment.

## Consequences

### Known disagreements with core

Three places in core do not follow this precedence. Each is to be raised as
an upstream issue in Effect-TS/effect and is named here so a reader does not
mistake the gap for a bug in `env`:

- Core's `Logger.consolePretty` in auto mode checks the TTY only.
- Core's `Prompt` and the wizard colour unconditionally.
- `CliOutput.defaultFormatter` reads `process` directly.

### Two documented divergences from Node

- An empty variable reads as unset here, because `readEnv` normalizes an empty
  string to absent under every `ConfigProvider`, including one built with
  `preserveEmptyStrings`. That covers every variable, not only `FORCE_COLOR`:
  Node treats `FORCE_COLOR=""` as 16 colours, and `{ CI: "", TERM:
  "xterm-256color" }` as none (an empty `CI` still enters its CI branch), where
  `env` reads 256 because the empty `CI` is dropped.
- There is no win32 branch, because `env` reads no `process.platform`.

[^boundary-test]: `packages/env/__test__/colorDepth.test.ts`, the precedence pinned case by case against Node's `getColorDepth`

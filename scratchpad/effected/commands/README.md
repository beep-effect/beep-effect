# commands (lab port of @effected/commands)


Structured command running and CLI tool discovery over Effect's core `ChildProcessSpawner` contract. `Run.collect` / `text` / `lines` / `json` turn a spawned process into a typed result instead of a bag of streams to check by hand, and `ToolDiscovery` answers "is `biome` here, and which copy should I run" without a shell probe. `effect` is the only dependency of any kind.

## Why @effected/commands

Every subprocess concept in this package is core's, and no implementation of one is. A predecessor version of this package tried the opposite twice: first inventing its own `Command`/`CommandRunner` types, then — after deleting those — quietly re-implementing core's spawner underneath core's own names. Neither survived review. `Run` is free functions over core's `ChildProcess.Command` and `ChildProcessSpawner`, never a second runner service wrapping them, and this package supplies only what core deliberately leaves unclassified: a typed outcome for a non-zero exit, secret redaction, transience vocabulary, and tool discovery.

Two of core's sharper edges get one clean fix each. `ChildProcess.setEnv` merges values into the command's environment but never sets `extendEnv`, so a command built with bare `setEnv({ TOKEN: x })` spawns a child whose *entire* environment is that one variable — no `PATH`, no `HOME`, silent at the type level. `Run.extendEnv` adds variables without losing the parent environment. And a non-zero exit, which core reports as a plain success, becomes a typed `CommandFailedError` for `Run.text`, `Run.lines` and `Run.json` — the three combinators whose callers actually want to branch on failure.

Requires Node.js >=24.11.0. `effect` v4 is the only peer dependency, and the only dependency of any kind — no `node:child_process` import, no platform package, no parallel command vocabulary.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`ChildProcessSpawner` comes from `effect` core, not from a platform package, so a consumer provides it once at the edge (`NodeServices.layer` from `@effect/platform-node` on Node) and a test scripts it directly with this package's own `ScriptedSpawner`.

## Quick start

Run a command and get back trimmed stdout, with a non-zero exit as a typed failure instead of a stray stderr string to parse:

```ts
import { Run } from "@beep/scratchpad/effected/commands/Run";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";

const program = Run.text(ChildProcess.make("git", ["rev-parse", "--short", "HEAD"]));

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then(console.log);
// example output (varies by environment): "a1b2c3d"
```

Resolve a CLI tool before running it, globally or through a project's package manager:

```ts
import { Run } from "@beep/scratchpad/effected/commands/Run";
import { Tool } from "@beep/scratchpad/effected/commands/Tool";
import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const program = Effect.gen(function* () {
  const discovery = yield* ToolDiscovery;
  const biome = yield* discovery.resolve(Tool.named("biome"));
  return yield* Run.text(biome.command("--version"));
});

const AppLayer = ToolDiscovery.layer.pipe(Layer.provide(LocalExec.layerNone), Layer.provide(NodeServices.layer));

Effect.runPromise(program.pipe(Effect.provide(AppLayer))).then(console.log);
// example output (varies by environment): "Version: 1.9.4"
```

## Features

- `Run` — `collect` / `collectTee` / `text` / `lines` / `json` / `jsonLine` / `exitCode` / `succeeds` / `stream` / `detach` over a core `ChildProcess.Command`, plus the `extendEnv` combinator that adds environment variables without dropping `PATH`/`HOME`.
- `Run.collect` is the kit's **one** spawn-and-collect primitive — spawn, drain stdout and stderr concurrently under one scope, await the exit code, and hand back all three as data (a non-zero exit is a result, not an error). Reach for it whenever you need a typed subprocess wrapper the kit does not already ship: it is what `@effected/git`'s README points a consumer at for a git command `Git` itself does not have. Hand-rolling the triple-collect gets you an unbounded-memory capture and, sooner or later, a deadlock the moment either OS pipe buffer fills.
- `Run.jsonLine` — the framing variant for a child that speaks a JSON protocol on stdout: it decodes the last non-empty line, so the child's own logging before the payload is tolerated, and it decodes regardless of the exit code, because an envelope that carries its own `ok` field has already reported. `Run.json` remains the whole-stdout, exit-code-first form.
- `CommandFailedError` / `CommandOutputError` — structurally routable failures (`kind: "nonZero" | "spawn" | "timeout"`, `"notJson" | "schema" | "tooLarge"`) instead of a `reason: string` to substring-match. An output error from a combinator that parsed independently of the exit code carries that code and both redacted streams, so a bad payload is diagnosable without a second run.
- `ToolDiscovery` — resolves a tool globally or project-locally by spawning it (never a shell `command -v`), with an evidence cache so two callers with different constraints never share a stale answer.
- `LocalExec` — the narrow, inverted contract for "how do I run a project-local binary here", implemented by `@effected/workspaces` so a single-package consumer never installs a workspace-detection engine to ask whether `tar` exists. The resulting `ExecContext` carries all three launcher spellings — `apply` for a project-local binary, `applyDlx` for a fetched one, `applyScript` for a `package.json` script (npm's is `npm run --`, since a bare `npm run <script> --flag` claims the flag for npm itself).
- `Redaction` — value-based secret scrubbing from captured output and argv, with a flag-heuristic backstop for secrets a caller forgot to declare.
- `Retry` — transience classification (`isTransient`, `transient()`) as vocabulary for core's `Effect.retry`, not a retrying runner.
- `ScriptedSpawner` — a public test double that provides core's own `ChildProcessSpawner` from a scripted outcome table, with zero casts required at the call site.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/commands` 0.11.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/commands/internal/capture.ts:8 * Internal and never exported from the package: `Run` maps it to the public

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Redaction uses persistent HashSet and Effect Array/Order helpers in place of native Set, and native Error sites become schema-tagged errors with their original messages. (scratchpad/test/commands/Redaction.test.ts:94; scratchpad/test/commands/ScriptedSpawner.test.ts:135; scratchpad/test/commands/Run.test.ts:343; scratchpad/test/commands/ToolDiscovery.test.ts:476)
- **tagged-errors** — Capture failures and empty-output/pipeline/unstubbed errors have owning S.TaggedError schemas instead of Data.TaggedError or native Error, retaining the existing failure/defect channels. (scratchpad/test/commands/Run.test.ts:98; scratchpad/test/commands/Run.test.ts:343; scratchpad/test/commands/ScriptedSpawner.test.ts:135; scratchpad/test/commands/ToolDiscovery.test.ts:476)
- **schema-first** — Named literal domains and erased data types gain LiteralKit/schema values, while Schema JSON codecs replace native parsing and expose SchemaError causes with the existing notJson classification. (scratchpad/test/commands/LocalExec.test.ts:179; scratchpad/test/commands/Run.test.ts:244,362,808; scratchpad/test/commands/ScriptedSpawner.test.ts:154,169; scratchpad/test/commands/ToolDiscovery.test.ts:481,494)
- **numeric-domains** — Process exit fields use shared S.Int and capture-error limits use S.Finite instead of upstream numeric shapes, while policy inputs and scripted exits retain their numeric domain. (scratchpad/test/commands/Run.test.ts:793; scratchpad/test/commands/Run.test.ts:98; scratchpad/test/commands/Run.test.ts:808; scratchpad/test/commands/ScriptedSpawner.test.ts:154)
- **type-safety** — Predicate/schema narrowing and scoped service provision replace upstream casts and the Sink callback suppression while preserving oracle assertions. (scratchpad/test/commands/ScriptedSpawner.test.ts:135; scratchpad/test/commands/e2e/Run.e2e.test.ts:28; scratchpad/test/commands/Run.test.ts:631; module suite scratchpad/test/commands/**)
- **tsgo-diagnostics** — Dual capture overloads, scoped Context provision and live-clock lifecycle tests replace upstream generator-only, Layer-provide and Promise/timer forms to satisfy Effect diagnostics. (module suite scratchpad/test/commands/**; scratchpad/test/commands/Run.test.ts:98; scratchpad/test/commands/e2e/Run.e2e.test.ts:156,179)
- **effect-first** — Effect.fn/fnUntraced and native Effect/Option helpers replace equivalent generator wrappers, re-failing catch handlers, Option constructors and conditional spreads. (module suite scratchpad/test/commands/**; scratchpad/test/commands/Run.test.ts:666; scratchpad/test/commands/ToolDiscovery.test.ts:58; scratchpad/test/commands/Retry.test.ts:67)
- **effect-imports** — Executable Effect imports use dedicated effect/Module paths instead of root/process/testing barrels, with remaining process imports in examples deferred to S2. (module suite scratchpad/test/commands/**)
- **identity-annotations** — Commands schemas and service keys use $ScratchpadId-derived identities, descriptions and field annotations instead of upstream short identifiers and unannotated fields. (module suite scratchpad/test/commands/**)

### Dependency backlog

None.

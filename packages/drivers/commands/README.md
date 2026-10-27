# @beep/commands

Structured command running and CLI tool discovery over Effect's core `ChildProcessSpawner` contract. `Run.collect` / `text` / `lines` / `json` turn a spawned process into a typed result instead of a bag of streams to check by hand, `ToolDiscovery` answers "is `biome` here, and which copy should I run" without a shell probe, and `ScriptedSpawner` scripts the spawner for tests. Every subprocess concept is core's: this package adds only what core leaves unclassified — a typed outcome for a non-zero exit, secret redaction, transience vocabulary and tool discovery.

## Why

A predecessor of the upstream package tried twice to own the subprocess vocabulary: first by inventing its own `Command`/`CommandRunner` types, then by re-implementing core's spawner underneath core's own names. Neither survived review. `Run` is free functions over core's `ChildProcess.Command` and `ChildProcessSpawner`, never a second runner service wrapping them.

Two of core's sharper edges get one fix each. `ChildProcess.setEnv` merges values into the command's environment but never sets `extendEnv`, so a command built with bare `setEnv({ TOKEN: x })` spawns a child whose *entire* environment is that one variable — no `PATH`, no `HOME`, silent at the type level. `Run.extendEnv` adds variables without losing the parent environment. And a non-zero exit, which core reports as a plain success, becomes a typed `CommandFailedError` for `Run.text`, `Run.lines` and `Run.json`.

`ChildProcessSpawner` comes from `effect` core, not from a platform package, so a consumer provides it once at the edge (`NodeServices.layer` from `@effect/platform-node` on Node) and a test scripts it with this package's own `ScriptedSpawner`. There is no `node:child_process` import and no platform dependency; runtime dependencies are `effect` plus the workspace foundation packages `@beep/identity`, `@beep/schema` and `@beep/utils`. The package is ESM-only.

## Usage

Run a command and get back trimmed stdout, with a non-zero exit as a typed failure instead of a stray stderr string to parse:

```ts
import { Run } from "@beep/commands/Run";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";

const program = Run.text(ChildProcess.make("git", ["rev-parse", "--short", "HEAD"]));

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then(console.log);
// example output (varies by environment): "a1b2c3d"
```

Resolve a CLI tool before running it, globally or through a project's package manager:

```ts
import { LocalExec } from "@beep/commands/LocalExec";
import { Run } from "@beep/commands/Run";
import { Tool } from "@beep/commands/Tool";
import { ToolDiscovery } from "@beep/commands/ToolDiscovery";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const program = Effect.gen(function* () {
  const discovery = yield* ToolDiscovery;
  const biome = yield* discovery.resolve(Tool.named("biome"));
  return yield* Run.text(biome.command("--version"));
});

const AppLayer = ToolDiscovery.layer.pipe(Layer.provide(LocalExec.layerNone), Layer.provide(NodeServices.layer));

Effect.runPromise(program.pipe(Effect.provide(AppLayer), Effect.provide(NodeServices.layer))).then(console.log);
// example output (varies by environment): "Version: 1.9.4"
```

Script the spawner in a test instead of launching a real process:

```ts
import { Run } from "@beep/commands/Run";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";

const spawner = ScriptedSpawner.make(() => ({ stdout: "a1b2c3d\n" }));

const program = Run.text(ChildProcess.make("git", ["rev-parse", "--short", "HEAD"])).pipe(
  Effect.provide(spawner.layer),
);
```

The package root `@beep/commands` re-exports every public module; the per-module subpaths above (`@beep/commands/Run`, `@beep/commands/ToolDiscovery`, ...) are equivalent.

## Features

- `Run` — `collect` / `collectTee` / `text` / `lines` / `json` / `jsonLine` / `exitCode` / `succeeds` / `stream` / `detach` over a core `ChildProcess.Command`, plus the `extendEnv` combinator that adds environment variables without dropping `PATH`/`HOME`.
- `Run.collect` is the kit's **one** spawn-and-collect primitive — spawn, drain stdout and stderr concurrently under one scope, await the exit code, and hand back all three as data (a non-zero exit is a result, not an error). Reach for it whenever you need a typed subprocess wrapper the kit does not already ship: it is what upstream `@effected/git`'s README (and `@beep/git` here) points a consumer at for a git command `Git` itself does not have. Hand-rolling the triple-collect gets you an unbounded-memory capture and, sooner or later, a deadlock the moment either OS pipe buffer fills.
- `Run.jsonLine` — the framing variant for a child that speaks a JSON protocol on stdout: it decodes the last non-empty line, so the child's own logging before the payload is tolerated, and it decodes regardless of the exit code, because an envelope that carries its own `ok` field has already reported. `Run.json` remains the whole-stdout, exit-code-first form.
- `CommandFailedError` / `CommandOutputError` — structurally routable failures (`kind: "nonZero" | "spawn" | "timeout"`, `"notJson" | "schema" | "tooLarge"`) instead of a `reason: string` to substring-match. An output error from a combinator that parsed independently of the exit code carries that code and both redacted streams, so a bad payload is diagnosable without a second run.
- `ToolDiscovery` — resolves a tool globally or project-locally by spawning it (never a shell `command -v`), with an evidence cache so two callers with different constraints never share a stale answer.
- `LocalExec` — the narrow, inverted contract for "how do I run a project-local binary here", implemented upstream by `@effected/workspaces` so a single-package consumer never installs a workspace-detection engine to ask whether `tar` exists. The resulting `ExecContext` carries all three launcher spellings — `apply` for a project-local binary, `applyDlx` for a fetched one, `applyScript` for a `package.json` script (npm's is `npm run --`, since a bare `npm run <script> --flag` claims the flag for npm itself).
- `Redaction` — value-based secret scrubbing from captured output and argv, with a flag-heuristic backstop for secrets a caller forgot to declare.
- `Retry` — transience classification (`isTransient`, `transient()`) as vocabulary for core's `Effect.retry`, not a retrying runner.
- `ScriptedSpawner` — a public test double that provides core's own `ChildProcessSpawner` from a scripted outcome table, with zero casts required at the call site.

## Development

Run from the repository root:

```sh
bun run beep quality package-verify @beep/commands   # full package gate
bun run --cwd packages/drivers/commands check         # tsrs over src and test
bun run --cwd packages/drivers/commands test          # vitest unit and property suites
bun run --cwd packages/drivers/commands test:integration
```

Tests live in `test/` (unit, `*.property.test.ts`, `*.coverage.test.ts`, and `e2e/`), import package source through `@beep/commands/*` and internals through `@beep/commands/internal/*`. `KNOWLEDGE.md` carries the upstream knowledge bundle verbatim; its `packages/commands/...` paths refer to the upstream checkout, whose `src/` and `__test__/` map to this package's `src/` and `test/`.

## Provenance

Ported from upstream `@effected/commands` 0.11.0 (MIT, C. Spencer Beggs) at commit `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (reference checkout `~/YeeBois/references/effect/effected`) through the effected kit port, then promoted from `scratchpad/effected/commands` into this workspace package by `goals/effected-promotion`. The package [LICENSE](./LICENSE) carries both the beep-effect and the upstream copyright notices.

## License

[MIT](./LICENSE)

## Port notes

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Redaction uses persistent HashSet and Effect Array/Order helpers in place of native Set, and native Error sites become schema-tagged errors with their original messages. (packages/drivers/commands/test/Redaction.test.ts:94; packages/drivers/commands/test/ScriptedSpawner.test.ts:135; packages/drivers/commands/test/Run.test.ts:343; packages/drivers/commands/test/ToolDiscovery.test.ts:476)
- **tagged-errors** — Capture failures and empty-output/pipeline/unstubbed errors have owning S.TaggedError schemas instead of Data.TaggedError or native Error, retaining the existing failure/defect channels. (packages/drivers/commands/test/Run.test.ts:98; packages/drivers/commands/test/Run.test.ts:343; packages/drivers/commands/test/ScriptedSpawner.test.ts:135; packages/drivers/commands/test/ToolDiscovery.test.ts:476)
- **schema-first** — Named literal domains and erased data types gain LiteralKit/schema values, while Schema JSON codecs replace native parsing and expose SchemaError causes with the existing notJson classification. (packages/drivers/commands/test/LocalExec.test.ts:179; packages/drivers/commands/test/Run.test.ts:244,362,808; packages/drivers/commands/test/ScriptedSpawner.test.ts:154,169; packages/drivers/commands/test/ToolDiscovery.test.ts:481,494)
- **numeric-domains** — Process exit fields use shared S.Int and capture-error limits use S.Finite instead of upstream numeric shapes, while policy inputs and scripted exits retain their numeric domain. (packages/drivers/commands/test/Run.test.ts:793; packages/drivers/commands/test/Run.test.ts:98; packages/drivers/commands/test/Run.test.ts:808; packages/drivers/commands/test/ScriptedSpawner.test.ts:154)
- **type-safety** — Predicate/schema narrowing and scoped service provision replace upstream casts and the Sink callback suppression while preserving oracle assertions. (packages/drivers/commands/test/ScriptedSpawner.test.ts:135; packages/drivers/commands/test/e2e/Run.e2e.test.ts:28; packages/drivers/commands/test/Run.test.ts:631; module suite packages/drivers/commands/test/**)
- **tsgo-diagnostics** — Dual capture overloads, scoped Context provision and live-clock lifecycle tests replace upstream generator-only, Layer-provide and Promise/timer forms to satisfy Effect diagnostics. (module suite packages/drivers/commands/test/**; packages/drivers/commands/test/Run.test.ts:98; packages/drivers/commands/test/e2e/Run.e2e.test.ts:156,179)
- **effect-first** — Effect.fn/fnUntraced and native Effect/Option helpers replace equivalent generator wrappers, re-failing catch handlers, Option constructors and conditional spreads. (module suite packages/drivers/commands/test/**; packages/drivers/commands/test/Run.test.ts:666; packages/drivers/commands/test/ToolDiscovery.test.ts:58; packages/drivers/commands/test/Retry.test.ts:67)
- **effect-imports** — Executable Effect imports use dedicated effect/Module paths instead of root/process/testing barrels, with remaining process imports in examples deferred to S2. (module suite packages/drivers/commands/test/**)
- **identity-annotations** — Commands schemas and service keys use $CommandsId-derived identities (`@beep/commands/<Module>`), descriptions and field annotations instead of upstream short identifiers and unannotated fields. (module suite packages/drivers/commands/test/**)
- **numeric-domains** — The lab restricts scripted exits to the shared integer ExitCode domain, while upstream permits fractional and non-finite numbers (packages/drivers/commands/test/ScriptedSpawner.test.ts:156).
- **schema-first** — The lab permits Tool.make to omit three schema-defaulted fields while upstream requires them, retaining required decoded and encoded fields (packages/drivers/commands/test/Tool.property.test.ts:32; packages/drivers/commands/test/Tool.property.test.ts:79).
- **added-exports** — The lab newly exports the ExitCode schema and derived type from Run.ts, while upstream exposes neither (packages/drivers/commands/src/Run.ts:104; packages/drivers/commands/test/ScriptedSpawner.test.ts:156).
- **schema-first** — The lab SpawnRecord validator now rejects invalid stream/sink payloads under numeric FD spellings such as fd 3 and fd0x3 while preserving valid carrier identity; upstream only declares the record type (packages/drivers/commands/test/ScriptedSpawner.test.ts:196; packages/drivers/commands/test/ScriptedSpawner.test.ts:213).
- **tsgo-diagnostics** — The lab adds nominal brand type parameters to 18 schema classes/errors where upstream and earlier port declarations omit them, preserving runtime and encoded fields (packages/drivers/commands/src/LocalExec.ts:124; packages/drivers/commands/src/Run.ts:191; packages/drivers/commands/src/Tool.ts:93; packages/drivers/commands/src/ToolDiscovery.ts:83; packages/drivers/commands/src/ScriptedSpawner.ts:16; packages/drivers/commands/src/internal/capture.ts:36).

### Dependency backlog

None.

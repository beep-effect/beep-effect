# commands (lab port of @effected/commands)

[![npm](https://img.shields.io/npm/v/@effected%2Fcommands?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/commands)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Structured command running and CLI tool discovery over Effect's core `ChildProcessSpawner` contract. `Run.collect` / `text` / `lines` / `json` turn a spawned process into a typed result instead of a bag of streams to check by hand, and `ToolDiscovery` answers "is `biome` here, and which copy should I run" without a shell probe. `effect` is the only dependency of any kind.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/commands

Every subprocess concept in this package is core's, and no implementation of one is. A predecessor version of this package tried the opposite twice: first inventing its own `Command`/`CommandRunner` types, then — after deleting those — quietly re-implementing core's spawner underneath core's own names. Neither survived review. `Run` is free functions over core's `ChildProcess.Command` and `ChildProcessSpawner`, never a second runner service wrapping them, and this package supplies only what core deliberately leaves unclassified: a typed outcome for a non-zero exit, secret redaction, transience vocabulary, and tool discovery.

Two of core's sharper edges get one clean fix each. `ChildProcess.setEnv` merges values into the command's environment but never sets `extendEnv`, so a command built with bare `setEnv({ TOKEN: x })` spawns a child whose *entire* environment is that one variable — no `PATH`, no `HOME`, silent at the type level. `Run.extendEnv` adds variables without losing the parent environment. And a non-zero exit, which core reports as a plain success, becomes a typed `CommandFailedError` for `Run.text`, `Run.lines` and `Run.json` — the three combinators whose callers actually want to branch on failure.

## Install

```bash
npm install @effected/commands effect
```

```bash
pnpm add @effected/commands effect
```

Requires Node.js >=24.11.0. `effect` v4 is the only peer dependency, and the only dependency of any kind — no `node:child_process` import, no platform package, no parallel command vocabulary.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`ChildProcessSpawner` comes from `effect` core, not from a platform package, so a consumer provides it once at the edge (`NodeServices.layer` from `@effect/platform-node` on Node) and a test scripts it directly with this package's own `ScriptedSpawner`.

## Quick start

Run a command and get back trimmed stdout, with a non-zero exit as a typed failure instead of a stray stderr string to parse:

```ts
import { Run } from "@effected/commands";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";

const program = Run.text(ChildProcess.make("git", ["rev-parse", "--short", "HEAD"]));

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then(console.log);
// example output (varies by environment): "a1b2c3d"
```

Resolve a CLI tool before running it, globally or through a project's package manager:

```ts
import { Run, Tool, ToolDiscovery, LocalExec } from "@effected/commands";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";

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

None.

### Dependency backlog

None.

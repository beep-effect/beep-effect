# env (lab port of @effected/env)

[![npm](https://img.shields.io/npm/v/@effected%2Fenv?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/env)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Effect-native environment detection for any front end of a tool: **who is running it** (an AI agent, a CI job, or neither), **what the terminal can do** (colour level, OSC 8 hyperlinks and width, per stream), and **who the output is for** (a human, an agent or CI). Every answer is read once through `Config`, never from `process`, and every service has a `layerTest`, so a test sets the environment it wants without touching a global.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version. Full
> policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/env

Every tool that prints ends up asking these questions, usually by reading `process.env` and `process.stdout.isTTY` wherever the answer is needed. The answers then drift (the help text and the report disagree about colour), they cannot be tested without mutating globals, and the rules are subtle: `FORCE_COLOR` beats `NO_COLOR`, an empty `NO_COLOR` means unset, `TERM=dumb` is a terminal that cannot move the cursor, a Windows console sets no `TERM` at all yet draws truecolor, and an agent running inside CI should get agent output.

This package makes each decision once, as a service, from rules taken from established sources: colour depth from Node's own `getColorDepth` (with `OS=Windows_NT` standing in for its platform check, which gives a Windows terminal truecolor as Node does from Windows 10 build 14931), hyperlink support from std-osc8's terminal table, and agent detection from std-env's table.

## Install

```bash
npm install @effected/env effect
```

```bash
pnpm add @effected/env effect
```

Requires Node.js >=24.11.0. `effect` v4 is the only peer. There are no runtime dependencies, no platform import and no `@effected/*` edge, so it runs unchanged on Node, Bun and Deno.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import from an ES module.

## Quick start

Decide the audience once, as a service, and let anything that prints ask it:

```ts
import { Audience, CurrentRuntimeEnv } from "@effected/env";
import { Effect, Layer } from "effect";

// A valid MYTOOL_AUDIENCE beats detection; then an agent, then CI, then a human.
const AudienceLive = Audience.layer({ envVar: "MYTOOL_AUDIENCE" }).pipe(Layer.provide(CurrentRuntimeEnv.layer));

const program = Effect.gen(function* () {
  const audience = yield* Audience;
  if (audience.kind === "agent") {
    // plain text, no escapes
  }
});

Effect.runPromise(program.pipe(Effect.provide(AudienceLive)));
```

What the terminal can do comes from `TerminalEnv`, which reads core's `Stdio` and `Terminal` from your platform layer:

```ts
import { TerminalEnv } from "@effected/env";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";

const describe = Effect.gen(function* () {
  const terminal = yield* TerminalEnv;
  return `${terminal.stdout.color} colour, ${terminal.width()} columns`;
});

Effect.runPromise(describe.pipe(Effect.provide(TerminalEnv.layer()), Effect.provide(NodeServices.layer)));
```

In a test, fix the answers instead:

```ts
import { Audience, TerminalEnv } from "@effected/env";
import { Layer, Option } from "effect";

const Environment = Layer.mergeAll(
  Audience.layerTest("agent"),
  TerminalEnv.layerTest({ stdout: { isTerminal: true, color: "256", columns: Option.some(120) } }),
);
```

## What it exports

- **`RuntimeEnv`**: a schema-class snapshot of the agent, the CI and the terminal program, persistable as plain JSON. `RuntimeEnv.fromRecord(env)` builds one as a pure function.
- **`CurrentRuntimeEnv`**: that snapshot as a service. `layer` reads the ambient `ConfigProvider` once; `layerFrom(source)` reads a record or provider of your own, fresh on every use, for a long-lived host; `layerTest(overrides)` fixes it.
- **`TerminalEnv`**: per-stream `isTerminal`, colour level (`none`, `basic`, `256`, `truecolor`), `hyperlinks` and `columns`, plus `width(fallback)`. `layer()` needs `Stdio` and `Terminal`; `layerStdio()` needs only `Stdio`; `colorLevel("stdout")` decides colour alone.
- **`Audience`**: `human`, `agent` or `ci`, and the `source` that decided it. `layer({ envVar })` decides from `CurrentRuntimeEnv` and an override variable you name.
- **`EnvOverride`**: reads a variable that picks a mode *within* an audience, accepting only the literals you list per audience. `readResult` reports without logging; `read` logs one warning for a rejected value.

## Documentation

The guides and the full API reference are at [effected.spencerbeg.gs/env](https://effected.spencerbeg.gs/env). [`@effected/cli`](https://www.npmjs.com/package/@effected/cli) builds its whole presentation layer on these services.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/env` 0.1.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/env/internal/colorDepth.ts:1 // Port of Node v26.10.0 lib/internal/tty.js getColorDepth (MIT). Differences: the win32 branch reads OS=Windows_NT
- scratchpad/effected/env/internal/osc8/detect.ts:1 // Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/detect.ts. Pure: no process reads.
- scratchpad/effected/env/internal/osc8/env.ts:1 // Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/env.ts. Pure: no process reads.
- scratchpad/effected/env/internal/osc8/semver.ts:1 // Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/semver.ts. Pure: no process reads.
- scratchpad/effected/env/internal/osc8/terminals.ts:1 // Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/terminals.ts. Pure: no process reads.
- scratchpad/effected/env/internal/osc8/wrappers.ts:1 // Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/wrappers.ts. Pure: no process reads.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.

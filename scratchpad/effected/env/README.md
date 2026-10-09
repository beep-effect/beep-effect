# env (lab port of @effected/env)

Effect-native environment detection for any front end of a tool: **who is running it** (an AI agent, a CI job, or neither), **what the terminal can do** (colour level, OSC 8 hyperlinks and width, per stream), and **who the output is for** (a human, an agent or CI). Every answer is read once through `Config`, never from `process`, and every service has a `layerTest`, so a test sets the environment it wants without touching a global.

## Why @effected/env

Every tool that prints ends up asking these questions, usually by reading `process.env` and `process.stdout.isTTY` wherever the answer is needed. The answers then drift (the help text and the report disagree about colour), they cannot be tested without mutating globals, and the rules are subtle: `FORCE_COLOR` beats `NO_COLOR`, an empty `NO_COLOR` means unset, `TERM=dumb` is a terminal that cannot move the cursor, a Windows console sets no `TERM` at all yet draws truecolor, and an agent running inside CI should get agent output.

This package makes each decision once, as a service, from rules taken from established sources: colour depth from Node's own `getColorDepth` (with `OS=Windows_NT` standing in for its platform check, which gives a Windows terminal truecolor as Node does from Windows 10 build 14931), hyperlink support from std-osc8's terminal table, and agent detection from std-env's table.

Requires Node.js >=24.11.0. `effect` v4 is the only peer. There are no runtime dependencies, no platform import and no `@effected/*` edge, so it runs unchanged on Node, Bun and Deno.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import from an ES module.

## Quick start

Decide the audience once, as a service, and let anything that prints ask it:

```ts
import { Audience } from "@beep/scratchpad/effected/env/Audience";
import { CurrentRuntimeEnv } from "@beep/scratchpad/effected/env/RuntimeEnv";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";

const describe = Effect.gen(function* () {
  const terminal = yield* TerminalEnv;
  return `${terminal.stdout.color} colour, ${terminal.width()} columns`;
});

Effect.runPromise(describe.pipe(Effect.provide(TerminalEnv.layer()), Effect.provide(NodeServices.layer)));
```

In a test, fix the answers instead:

```ts
import { Audience } from "@beep/scratchpad/effected/env/Audience";
import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const Environment = Layer.mergeAll(
  Audience.layerTest("agent"),
  TerminalEnv.layerTest({ stdout: { isTerminal: true, color: "256", columns: O.some(120) } }),
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

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab uses Effect HashMap, HashSet, Array.dedupe and Record helpers where upstream uses native collections and Object record operations, preserving detection and filtering results (scratchpad/test/env/colorDepth.test.ts:71,81; scratchpad/test/env/osc8.env.test.ts:28,47; scratchpad/test/env/envRecord.test.ts:6; scratchpad/test/env/RuntimeEnv.test.ts:197).
- **schema-first** — The lab derives literal domains, guards and pure payload types from LiteralKit and S.Struct schemas where upstream uses handwritten unions and interfaces, preserving wire and plain-object values (module suite scratchpad/test/env/**; scratchpad/test/env/Audience.test.ts:42; scratchpad/test/env/RuntimeEnv.test.ts:71,87,99,107,119).
- **type-safety** — The lab narrows provider sources and accepted literals without the unsafe casts used upstream (scratchpad/test/env/EnvOverride.test.ts:83,155; scratchpad/test/env/RuntimeEnv.test.ts:218).
- **tsgo-diagnostics** — The lab adds dual APIs and requires explicit specifications in direct envIsTruthy calls where upstream accepts an omitted specification, with codec tests using Result-based schema calls (scratchpad/test/env/osc8.env.test.ts:6,15,29,32,35,40; scratchpad/test/env/colorDepth.test.ts; scratchpad/test/env/osc8.detect.test.ts; scratchpad/test/env/osc8.semver.test.ts; scratchpad/test/env/RuntimeEnv.test.ts:71,87,99,107,119,163).
- **effect-first** — The lab uses named Effect.fn wrappers, matchers and Effect helpers where upstream uses Effect.gen wrappers, switches and native or trivial helper forms (scratchpad/test/env/EnvOverride.test.ts; scratchpad/test/env/TerminalEnv.test.ts; scratchpad/test/env/Audience.test.ts; scratchpad/test/env/osc8.detect.test.ts; module suite scratchpad/test/env/**).
- **effect-imports** — The lab source, affected tests and source examples use dedicated effect/* imports and canonical aliases where upstream uses the root effect barrel (module suite scratchpad/test/env/**).
- **identity-annotations** — The lab supplies composer-based service keys, schema and field identities and re-keyed test services where upstream uses @effected identifiers and unannotated payloads (module suite scratchpad/test/env/**; scratchpad/test/env/RuntimeEnv.test.ts:218,219,220).
- **test-environment** — The lab source-scanning tests resolve scratchpad/effected/env paths where the inherited upstream paths target ../src (scratchpad/test/env/purity.test.ts:9; scratchpad/test/env/agentCi.test.ts:93,103; scratchpad/test/env/colorDepth.test.ts:175; scratchpad/test/env/osc8.terminals.test.ts:196).

### Dependency backlog

None.

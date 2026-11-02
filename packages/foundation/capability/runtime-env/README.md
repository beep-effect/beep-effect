# @beep/runtime-env

Effect-native environment detection for any front end of a tool: **who is running it** (an AI agent, a CI job, or neither), **what the terminal can do** (colour level, OSC 8 hyperlinks and width, per stream), and **who the output is for** (a human, an agent or CI). Every answer is read once through `Config`, `Stdio` and `Terminal`, never from `process`, and every service has a `layerTest`, so a test sets the environment it wants without touching a global. The colour decision is also a pure function, `fromEnv` in `@beep/runtime-env/ColorLevel`, for a caller that has no layer.

## Why this package

Every tool that prints ends up asking these questions, usually by reading `process.env` and `process.stdout.isTTY` wherever the answer is needed. The answers then drift (the help text and the report disagree about colour), they cannot be tested without mutating globals, and the rules are subtle: `FORCE_COLOR` beats `NO_COLOR`, an empty `NO_COLOR` means unset, `TERM=dumb` is a terminal that cannot move the cursor, a Windows console sets no `TERM` at all yet draws truecolor, and an agent running inside CI should get agent output.

This package makes each decision once, from rules taken from established sources: colour depth from Node's own `getColorDepth` (with `OS=Windows_NT` standing in for its platform check), hyperlink support from std-osc8's terminal table, and agent detection from std-env's table.

The package is ESM-only (`"type": "module"`) and browser-safe: its runtime dependencies are `effect` v4 plus the workspace `@beep/identity` and `@beep/schema` packages, it imports no `node:` module and no platform package, and nothing is read at import time. Every symbol is exported by name from a leaf module (`@beep/runtime-env/Audience`, `@beep/runtime-env/ColorLevel`, `@beep/runtime-env/EnvOverride`, `@beep/runtime-env/RuntimeEnv`, `@beep/runtime-env/TerminalEnv`).

## Usage

Decide the audience once, as a service, and let anything that prints ask it:

```ts
import { Audience } from "@beep/runtime-env/Audience";
import { CurrentRuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// A valid MYTOOL_AUDIENCE beats detection; then an agent, then CI, then a human.
const AudienceLive = Audience.layer({ envVar: "MYTOOL_AUDIENCE" }).pipe(Layer.provide(CurrentRuntimeEnv.layer));

const program = Effect.map(Audience, (audience) => audience.kind).pipe(Effect.provide(AudienceLive));

console.log(Effect.isEffect(program)); // true
```

What the terminal can do comes from `TerminalEnv`, which reads core's `Stdio` and `Terminal` from the platform layer the application provides once at its edge:

```ts
import { TerminalEnv } from "@beep/runtime-env/TerminalEnv";
import * as Effect from "effect/Effect";

const describe = Effect.map(TerminalEnv, (terminal) => `${terminal.stdout.color} colour, ${terminal.width()} columns`);

// Effect<string, never, TerminalEnv>: provide TerminalEnv.layer() over the platform's Stdio and Terminal.
console.log(Effect.isEffect(describe)); // true
```

A caller without a layer, such as a colour library that decides at import time, uses the pure decision:

```ts
import * as ColorLevel from "@beep/runtime-env/ColorLevel";

console.log(ColorLevel.fromEnv({ FORCE_COLOR: "3", NO_COLOR: "1" }, false)); // truecolor
console.log(ColorLevel.fromEnv({ TERM: "xterm-256color" }, true)); // 256
```

In a test, fix the answers instead:

```ts
import { Audience } from "@beep/runtime-env/Audience";
import { TerminalEnv } from "@beep/runtime-env/TerminalEnv";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const Environment = Layer.mergeAll(
  Audience.layerTest("agent"),
  TerminalEnv.layerTest({ stdout: { isTerminal: true, color: "256", columns: O.some(120) } })
);

console.log(Layer.isLayer(Environment)); // true
```

## Features

- `RuntimeEnv`: a branded `S.Opaque` snapshot of the agent, the CI and the terminal program, persistable as plain JSON. `RuntimeEnv.fromRecord(env)` builds one as a pure function.
- `CurrentRuntimeEnv`: that snapshot as a service. `layer` reads the ambient `ConfigProvider` once; `layerFrom(source)` reads a record or provider of your own, fresh on every use, for a long-lived host; `layerTest(overrides)` fixes it.
- `TerminalEnv`: per-stream `isTerminal`, colour level (`none`, `basic`, `256`, `truecolor`), `hyperlinks` and `columns`, plus `width(fallback)`. `layer()` needs `Stdio` and `Terminal`; `layerStdio()` needs only `Stdio`; `colorLevel("stdout")` decides colour alone.
- `ColorLevel.fromEnv(env, isTTY)`: the one colour-level decision, dual and pure. `FORCE_COLOR` present decides alone and exactly; then `NO_COLOR`, `NODE_DISABLE_COLORS` and `TERM=dumb` disable; then a stream that is not a TTY has none (CI alone never enables colour); then Node's terminal table decides.
- `Audience`: `human`, `agent` or `ci`, and the `source` that decided it. `layer({ envVar })` decides from `CurrentRuntimeEnv` and an override variable you name.
- `EnvOverride`: reads a variable that picks a mode *within* an audience, accepting only the literals you list per audience. `readResult` reports without logging; `read` logs one warning for a rejected value.
- Option schemas: `AudienceOptions`, `RuntimeEnvOverrides` and `TerminalEnvTestOptions` are branded `S.Opaque` schemas; the functions accept their unbranded `Encoded` shapes, so callers pass object literals.

## Named importers

The capability gate for `foundation/capability` requires at least two importing packages:

- `@beep/chalk`: the per-stream colour level behind `supportsColor` and `supportsColorStderr` (`SupportsColor`), which delegates to `ColorLevel.fromEnv`.
- `@beep/colors`: colour detection for `supportsColor` and `isColorSupported` (`Colors`), which delegates to `ColorLevel.fromEnv`.

`@beep/cli-kit` builds its presentation layer on these services.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/runtime-env

# from packages/foundation/capability/runtime-env
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/runtime-env/<Module>` aliases; `test/support/` holds the shared helpers (the OSC 8 environment fixtures, the deliberately invalid input seam, and the bundled source text the purity and key-coverage scans read). `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Provenance

Ported from upstream `@effected/env` (MIT, C. Spencer Beggs) through the effected port, then promoted from the scratchpad into this workspace package by `goals/effected-promotion` (wave 2b). The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. Schema identities moved from `@beep/scratchpad/effected/env/*` to `@beep/runtime-env/*`.

### Attribution

- Upstream package: `@effected/env` 0.1.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)
- `src/internal/colorDepth.ts`: a port of Node v26.10.0 `lib/internal/tty.js` `getColorDepth` (MIT).
- `src/internal/osc8/{detect,env,semver,terminals,wrappers}.ts`: ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs).
- `src/internal/agentCi.ts`: the agent table is transcribed, in order, from std-env 4.3.0 (MIT).

### Deviations

The module-level port deviations recorded in the scratchpad port carry over unchanged: Effect collections and helpers in place of native runtime operations, schema-derived literal domains and payloads, dual APIs, per-module Effect imports, and `@beep/identity` annotations. On promotion:

- `AudienceShape`, `AudienceOptions`, `RuntimeEnv` (previously an `S.Class`), `RuntimeEnvOverrides`, `StreamEnv`, `TerminalEnvTestOptions` and the internal OSC 8 records (`Osc8Info`, `Osc8Detection`, `ProcessSnapshot`, `Osc8Capabilities`, `IdentifyResult`, `WrapperInfo`) became branded `S.Opaque` schemas constructed with `X.make`, and the functions that take option records take the `X.Encoded` shapes. The upstream `TerminalEntry` and `TerminalMatch` interfaces are now schemas: an allowlist row is data, and its identification function sits beside it in the internal table. `TerminalEnvShape` is the new `TerminalSnapshot` schema plus the `width` function.
- `StreamEnv.columns` is `Option<Finite>`: a non-finite width is rejected, where the upstream `Option<number>` accepted `NaN` and the infinities. Core's `Terminal` never reports one, and a non-finite width from it now reads as unknown.
- The internal OSC 8 helpers `lookupTerminal`, `detectWrapper`, `parseVteVersion` and `parseKonsoleVersion` return `Option` instead of `null`; the persisted `Osc8Info` record keeps its upstream `null` fields. A wrapper without a name from a replaced collaborator is now rejected by `Osc8Info.make` instead of being explained as "wrapper".
- New public entrypoint `ColorLevel.fromEnv`, the dual pure form of the internal `colorDepth`, for the synchronous colour libraries that delegate to it.
- The colour table, the OSC 8 precedence ladder and the agent detector are ordered rule tables instead of branch chains, with no change in precedence. Span names are qualified (`TerminalEnv.colorLevel`, `EnvOverride.read`, `EnvOverride.readResult`).
- The purity scan and the detector-key coverage tests read the bundled source text through `import.meta.glob(..., { query: "?raw" })` instead of `node:fs` and the lab's `SourceBoundary`.

## License

[MIT](LICENSE)

# engine (lab port of @effected/engine)

[![npm](https://img.shields.io/npm/v/@effected%2Fengine?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Platform-free primitives shared by every front end of an Effect v4 tool. A carrier-pattern tool (a CLI, an MCP server, an LSP server) ships more than one bin behind one meta-package, and every one of those front ends needs to answer the same handful of questions the same way: which carrier was I installed through, and what version line does that make me. This package holds those primitives once, so a consumer's own `engine` package can depend on them without also depending on `@effected/cli` or any other front end.

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

## Install

```bash
npm install @effected/engine effect
```

```bash
pnpm add @effected/engine effect
```

Requires Node.js >=24.11.0.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 is the only peer dependency, and it is the only dependency of any kind — no parser, no polyfill, no platform package rides in behind it. There is no IO here: every export is a schema, a reference with a default, or a pure function.

## Distribution

`Distribution` is the carrier package a tool's bins were installed through — its `name` and `version`. A plain `Schema.Struct` rather than a `Schema.Class`, because it travels as a plain object inside a machine-readable envelope and is compared structurally, never constructed on its own.

```ts
import { Distribution } from "@effected/engine";
import { Schema } from "effect";

const decoded = Schema.decodeUnknownSync(Distribution)({ name: "@okfit/plugin", version: "0.5.1" });
console.log(decoded);
// => { name: "@okfit/plugin", version: "0.5.1" }
```

`DistributionField` is the `distribution` field of an envelope: `Schema.NullOr(Distribution)`, where `null` means the front end was installed directly rather than through a carrier — not "not yet known."

## CurrentDistribution

`CurrentDistribution` is a `Context.Reference<Option<Distribution>>`, not a `Context.Service`: it carries its own default (`Option.none()`), so reading it never appears in an effect's `R` and a direct install needs no provision at all. A front end's `main` provides it once, at the top of the program, once it has resolved what installed it.

```ts
import { CurrentDistribution } from "@effected/engine";
import { Effect, Option } from "effect";

const program = Effect.gen(function* () {
  const current = yield* CurrentDistribution;
  return Option.isSome(current) ? current.value.name : "direct install";
});

console.log(Effect.runSync(program));
// => "direct install"
```

Providing a value scopes it to the sub-effect, the same way any `Context.Reference` scopes:

```ts
program.pipe(
  Effect.provideService(CurrentDistribution, Option.some({ name: "@okfit/plugin", version: "0.5.1" })),
);
```

## distributionSuffix

`distributionSuffix` turns a `CurrentDistribution` read into the trailing text a `--version` line or a startup log line appends — `""` for a direct install, `" via <name> <version>"` for a carrier. A free function, not a static on `Distribution`, because a `Schema.Struct` value carries no statics to hang it from.

```ts
import { distributionSuffix } from "@effected/engine";
import { Option } from "effect";

distributionSuffix(Option.none());
// => ""

distributionSuffix(Option.some({ name: "@okfit/plugin", version: "0.5.1" }));
// => " via @okfit/plugin 0.5.1"
```

## Tier

Pure tier: `effect` is the only peer, no `process`, no `node:` import, no platform package. Nothing in the kit depends on `@effected/engine` except `@effected/mcp`; `@effected/cli` never does — the two sit at the same layer, both consumed by a front end, never by each other.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/engine` 0.4.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab replaces upstream native injected errors and the exit sentinel with schema-tagged errors, retaining their covered payload and policy contracts. (scratchpad/test/engine/ProcessGuard.test.ts:159,381,401 (injected payloads and exit policies))
- **identity-keys** — The lab composes CurrentDistribution's key through IdentityComposer instead of upstream's @effected literal, retaining the default and provision behavior. (scratchpad/test/engine/Distribution.test.ts:48,55 (CurrentDistribution default and provision))
- **tagged-errors** — The lab adds tagged crash and exit-error schemas where upstream used plain Error classes, with the injected stderr name retargeted to InjectedCrash. (scratchpad/test/engine/ProcessGuard.test.ts:159,381,401 (tagged payload and load/connected policies))
- **schema-first** — The lab replaces upstream type-only input and policy models plus manual injection validation with runtime schemas, derived types and schema guards. (scratchpad/test/engine/LaunchContext.test.ts:36; scratchpad/test/engine/ProcessGuard.test.ts:74,80,97,199; scratchpad/test/engine/Distribution.test.ts:16,33)
- **numeric-domains** — The lab declares the test exit sentinel's code with S.Finite instead of upstream's unrefined number field. (scratchpad/test/engine/ProcessGuard.test.ts:16,235,381,401 (ExitCalled schema and exit-code assertions))
- **type-safety** — The lab removes upstream host and policy casts and routes intentionally invalid injection inputs through the one authorized test helper. (scratchpad/test/engine/ProcessGuard.test.ts:25,346,381,401; scratchpad/test/engine/deliberatelyInvalid.ts:13)
- **tsgo-diagnostics** — The lab replaces upstream async/manual-timer guard code and synchronous schema test calls with diagnostic-compliant Promise chains, Effect sleeps and Result codecs. (scratchpad/test/engine/ProcessGuard.test.ts:109,133,208,297; scratchpad/test/engine/Distribution.test.ts:10,16,40; scratchpad/test/engine/Remediation.test.ts:7,23,29)
- **effect-first** — The lab uses effect/String splitting for the injection grammar where upstream called the native string method. (scratchpad/test/engine/ProcessGuard.test.ts:74,80 (all injection pairs and invalid grammar))
- **effect-imports** — The lab uses dedicated effect/* imports instead of upstream's root Effect barrel, and the formerly package-free guard imports only Effect modules. (module suite scratchpad/test/engine/**; scratchpad/test/engine/entrypoints.test.ts:59)
- **identity-annotations** — The lab gives Distribution, DistributionField, Remediation and ProjectDirInput composed schema identities and field descriptions where upstream had none. (scratchpad/test/engine/Distribution.test.ts:21; scratchpad/test/engine/LaunchContext.test.ts:26; scratchpad/test/engine/Remediation.test.ts:7,13,18)
- **test-environment** — The lab retargets upstream package-local source/build paths to engine's scratchpad directory and supplies compiler emission through Vitest global setup. (scratchpad/test/engine/entrypoints.test.ts:50; scratchpad/test/engine/purity.test.ts:17; scratchpad/test/engine/build.setup.ts:49)
- **reachability** — The lab retargets upstream's package-free guard graph assertions to allow only effect/* while retaining the exact local-module lists and isolated subpath. (scratchpad/test/engine/entrypoints.test.ts:43,50,59,65)

### Dependency backlog

None.

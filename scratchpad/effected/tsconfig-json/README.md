# tsconfig-json (lab port of @effected/tsconfig-json)

[![npm](https://img.shields.io/npm/v/@effected%2Ftsconfig-json?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/tsconfig-json)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Composable tsconfig.json handling for Effect: document and compiler-option schemas, `extends`-chain resolution with tsc's own merge semantics, nearest-config discovery and a portable-config filter for virtual TypeScript environments. Every parse is JSONC — comments and trailing commas are legal everywhere, exactly as tsc treats them — and options the schemas do not know pass through decode and encode untouched instead of being dropped.

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

## Why @effected/tsconfig-json

Reading a tsconfig.json correctly means reproducing what tsc does, and what tsc does is more than `JSON.parse` plus `Object.assign`. An `extends` target resolves like a module: a bare specifier walks ancestor `node_modules` directories, a package's `exports` map can redirect or block it, and a `tsconfig` field in its manifest can point somewhere else entirely. Merging the chain is per-field, path options absolutize against the config that declared them rather than the one you loaded, and `${configDir}` substitutes once at the end against the top config's directory. These rules were extracted from the TypeScript compiler's source and encoded here as data-driven tests, so the resolution you get is the resolution tsc computes.

The package does all of this without importing `typescript`, not even as a type. It works at the string level — `"target": "es2023"` stays a string through schema, merge and discovery — and the version-coupled numeric enum mappings live in `TsEnumCodec` as plain data tables, so converting to the numeric shape a real compiler expects is an explicit final step rather than a dependency you carry everywhere. Malformed input always fails through a typed error channel, and the recursive `extends` walk carries cycle and depth guards, because a config file is untrusted input.

## Install

```bash
npm install @effected/tsconfig-json @effected/jsonc @effected/walker effect
```

```bash
pnpm add @effected/tsconfig-json @effected/jsonc @effected/walker effect
```

Requires Node.js >=24.11.0. `effect` v4, `@effected/jsonc` and `@effected/walker` are peer dependencies; there are no runtime dependencies of its own.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

All IO goes through `FileSystem` and `Path` from `effect` core, not a platform package, so a consumer provides them once at the edge (`@effect/platform-node` on Node, `@effect/platform-bun` on Bun) and a test provides core's `Path.layer` plus an in-memory volume from `@effected/memfs` — no platform package installed.

## Quick start

Resolve a config and its full `extends` chain:

```ts
import { TsconfigLoader } from "@effected/tsconfig-json";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const resolved = await Effect.runPromise(TsconfigLoader.resolve("./tsconfig.json").pipe(Effect.provide(PlatformLive)));

console.log(resolved.extendedPaths);
// every config on the extends chain as normalized absolute paths, base-most first and your own config last
console.log(resolved.compilerOptions);
// the merged options after folding the whole chain — later configs win per field, paths replaced wholesale
```

`TsconfigLoader.compilerOptions("./tsconfig.json")` is the same pipeline projected down to the merged options, for when the effective options are all you want.

Find the nearest config first when you only have a starting directory:

```ts
import { TsconfigDiscovery } from "@effected/tsconfig-json";
import { Effect, Option } from "effect";

const nearest = TsconfigDiscovery.findNearest(process.cwd());
// Effect<Option<string>, never, FileSystem | Path> — absence is Option.none(), never an error
```

Hand the result to a real compiler by encoding the enum families to their numeric form, or narrow it to the portable subset a virtual TypeScript environment can safely reuse:

```ts
import { PortableTsconfig, TsEnumCodec } from "@effected/tsconfig-json";

console.log(TsEnumCodec.encodeCompilerOptions({ target: "es2023", strict: true, lib: ["esnext"] }));
// { target: 10, strict: true, lib: [ 'lib.esnext.d.ts' ] }

console.log(PortableTsconfig.make(resolved).compilerOptions.noEmit);
// true — always forced, whatever the source config declared

console.log(PortableTsconfig.make(resolved, { includeTypes: true }).compilerOptions.types);
// carries the source config's `types` package names when it declares them, omitted when absent
```

`includeTypes` is opt-in and defaults to `false` because emitting `types` makes tsc demand those `@types` packages resolve — a hard error in a virtual environment with no `node_modules`. Pass it when your environment materializes `@types` itself; leave it off for the permissive default where TypeScript auto-includes whatever it finds.

## Synchronous loading

Bundler plugin hooks and config factories often cannot await. `TsconfigLoaderSync` runs the unchanged loader pipeline synchronously over file and path operations you supply — the package still imports no `node:*` module, and Node's built-ins satisfy the operations directly:

```ts
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { TsconfigLoaderSync } from "@effected/tsconfig-json";

const options = {
  fileSystem: { exists: existsSync, readFile: (p: string) => readFileSync(p, "utf8") },
  path, // node:path satisfies SyncPath verbatim; path.win32 / path.posix force a convention
};

const compilerOptions = TsconfigLoaderSync.compilerOptions("./tsconfig.json", options);
// the merged options for the full extends chain — the same result TsconfigLoader.resolve computes
```

`load` and `resolve` have the same synchronous forms. Failures are the async pipeline's own typed errors thrown as themselves — `TsconfigParseError`, `TsconfigExtendsError` or a `PlatformError` wrapping whatever your `readFile` threw — never a fiber-failure wrapper.

## TypeScript 7 and the classic compiler API

TypeScript 7's native `tsc` ships a version-only stub as its `.` export — there is no JS compiler API behind it. A package that drives the typechecker as a library (`@typescript/vfs`, the language service, the Program API) can neither type against nor runtime-load a TypeScript 7 install, and the obvious fix of pinning the dev `typescript` back to 6 forfeits the native `tsc` and leaves toolchain peers on `^7` unmet. The recipe that keeps both starts here, because this package is what removes the compile-time half of the dependency.

1. Type against the tsconfig JSON form, not the compiler. Public option types use `CompilerOptions.Type` — `{ target: "es2022" }`, strings all the way down — so nothing in `src` or the tests imports `typescript`, not even as a type. The dev `typescript` stays on 7, native `tsc --noEmit` still runs the typecheck, and the toolchain's `^7` peer stays satisfied.
2. Convert at a single runtime seam. `TsEnumCodec.encodeCompilerOptions` maps the string form to the numeric enums a real compiler expects and returns `ProgrammaticCompilerOptions`, the shape a `ts.CompilerOptions`-typed API takes without a cast. Only that one call site knows a compiler exists. The inbound direction is `CompilerOptionsFromProgrammatic`, a schema rather than a function: hand it a live `ts.CompilerOptions`, a numeric enum literal or the output of `encodeCompilerOptions` and validated `CompilerOptions.Type` comes back, with an unmappable numeric failing decode instead of leaking through.
3. Alias a classic install for the test runtime, where the JS API is genuinely needed: a dev-only `"typescript-classic": "npm:typescript@^6.0.3"` plus a vitest `resolve.alias` mapping `typescript` to it. The consumer-facing peer stays an optional `^6` — runtime-only, for callers of the compiler-touching module.
4. Pass `tsLibDirectory` explicitly when you drive `@typescript/vfs`. It locates `lib.*.d.ts` through `require.resolve("typescript")`, which under this setup resolves the TypeScript 7 install, and that install has no lib directory: the map comes back **empty**, silently, with no error to follow. Derive the directory from the module you actually loaded.

```json
{
  "devDependencies": {
    "typescript-classic": "npm:typescript@^6.0.3"
  }
}
```

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { typescript: "typescript-classic" } },
});
```

```ts
import { dirname } from "node:path";
import { TsEnumCodec } from "@effected/tsconfig-json";
import { createDefaultMapFromNodeModules } from "@typescript/vfs";
import ts from "typescript";

const fsMap = createDefaultMapFromNodeModules(
  TsEnumCodec.encodeCompilerOptions({ target: "es2023", lib: ["esnext"] }),
  ts,
  dirname(ts.sys.getExecutingFilePath()),
);

console.log(fsMap.size);
// the lib files the loaded compiler ships; drop the third argument and this is 0
```

## Features

- `TsconfigJson` / `TsconfigJsonFromString` — the document schema and its JSONC string codec. Comments and trailing commas are legal in every parse; there is no JSON-strict path.
- `CompilerOptions` — string-level schemas for `compilerOptions`: enum values decode case-insensitively and encode to canonical lowercase, and unknown or removed options survive a round trip as passthrough.
- `TsconfigLoader.load` / `TsconfigLoader.resolve` / `TsconfigLoader.compilerOptions` — read and decode one config, resolve its full `extends` chain depth-first with per-branch cycle stacks (diamond chains are legal), a depth guard and tsc's target resolution for relative, rooted and bare-specifier targets including `exports` maps, or project the resolved chain straight down to its merged options.
- `TsconfigLoaderSync` — the synchronous facade for sync-only hosts: `load`, `resolve` and `compilerOptions` over consumer-supplied `{ fileSystem, path }` operations, running the same pipeline and throwing the same typed errors.
- `ResolvedTsconfig` — the pure merge engine behind `resolve`: per-field merge semantics, path-option absolutization against the declaring config's directory, final `${configDir}` substitution and `pathsBase` provenance, with no filesystem access at all.
- `TsconfigDiscovery.findNearest` — the nearest `tsconfig.json` (or any filename via `options.filename`) at or above a starting directory, over `@effected/walker`; one unreadable ancestor cannot hide a config above it.
- `TsEnumCodec` — the string↔numeric enum tables as plain data with zero `typescript` imports. `encodeCompilerOptions` returns the exported `ProgrammaticCompilerOptions` type — the numeric shape `ts.CompilerOptions` expects, so you hand it to a `ts.CompilerOptions`-shaped API without a cast — with `lib` entries in the file-name form the compiler resolves verbatim; `decodeCompilerOptions` reverses it.
- `CompilerOptionsFromProgrammatic` — the same tables as a validating codec, for callers holding TypeScript's programmatic spelling. Decode accepts numeric enums, canonical strings, case-varying strings, any mixture of the three and `lib` in any of its three spellings; encode returns the numeric form. A numeric with no table entry fails decode as a typed schema issue rather than passing through, which is the check `TsEnumCodec.decodeCompilerOptions` deliberately does not make.
- `PortableTsconfig.make` — an allow-list projection down to machine-independent type-semantics options, with `composite: false` and `noEmit: true` forced: the slice a virtual TypeScript environment (Twoslash, API Extractor, an in-memory language service) can safely inherit. An optional `{ includeTypes }` argument carries the source config's `types` package names onto the portable shape too, for a caller whose virtual environment can resolve `@types` packages itself; `typeRoots` stays dropped either way, since it names machine-specific, config-location-dependent directories.
- `JsxConfig.fromCompilerOptions` — the JSX transform a bundler can configure, projected from decoded options: `react-jsx` / `react-jsxdev` select the automatic runtime with its import source (defaulting to `react`, tsc's own default), `react` selects classic, and `preserve`, `react-native` or an absent `jsx` yield `Option.none()`.
- Typed failures everywhere: a malformed file is a `TsconfigParseError` carrying its path, a broken chain is a `TsconfigExtendsError` with a `not-found` / `cycle` / `depth` / `empty` reason and the full resolution chain, and IO errors flow through as `PlatformError`. Nothing fails as a defect.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/tsconfig-json` 0.13.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Lab replaces upstream Map/Set and Object helper sites with MutableHashMap, HashSet and Record helpers, and replaces the sync adapter native Error with a schema error while preserving lookup and filtering contracts (scratchpad/test/tsconfig-json/TsEnumCodec.test.ts:114; scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts:137; scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:364; module suite scratchpad/test/tsconfig-json/**).
- **tagged-errors** — Lab gives the upstream sync adapter error a schema tag and preserves diagnostic stacks in parse-error cause encoding that upstream omitted (scratchpad/test/tsconfig-json/TsconfigJson.test.ts:189; scratchpad/test/tsconfig-json/TsconfigLoaderSync.test.ts:94; scratchpad/test/tsconfig-json/TsconfigLoaderSync.test.ts:108).
- **schema-first** — Lab replaces upstream handwritten models and literal domains with schemas and LiteralKit, retains facade statics through S.Opaque, and requires automatic JSX importSource while stripping it from classic variants (scratchpad/test/tsconfig-json/JsxConfig.test.ts:49; scratchpad/test/tsconfig-json/JsxConfig.test.ts:63; scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts:26; scratchpad/test/tsconfig-json/PortableTsconfig.test.ts:9; scratchpad/test/tsconfig-json/TsconfigDiscovery.test.ts:13; scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:35).
- **numeric-domains** — Lab narrows upstream maxNodeModuleJsDepth from Number to Finite and uses finite enum fields in the new programmatic runtime schema (scratchpad/test/tsconfig-json/CompilerOptions.test.ts:70; scratchpad/test/tsconfig-json/CompilerOptions.test.ts:144; scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:35; no dedicated non-finite rejection test).
- **type-safety** — Lab removes upstream unsafe casts and full-record compiler assignability, preserves unknown passthrough, and restores cast-free assignability of the known enum/lib subset (scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:35; scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:52; scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:66; scratchpad/test/tsconfig-json/TsEnumCodec.test.ts:204; module suite scratchpad/test/tsconfig-json/**).
- **tsgo-diagnostics** — Lab adds diagnostic-required dual overloads to the two upstream data-first exports-resolution helpers without changing their full-arity results (scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:66; scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:364; module suite scratchpad/test/tsconfig-json/**).
- **effect-first** — Lab uses Effect functions and helpers and adds pipeable static combinators while retaining upstream internal tracing behavior and existing data-first results (scratchpad/test/tsconfig-json/TsEnumCodec.test.ts:114; scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts:40; scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts:49; scratchpad/test/tsconfig-json/ResolvedTsconfig.test.ts:59; scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:22; scratchpad/test/tsconfig-json/JsxConfig.test.ts:15).
- **effect-imports** — Lab uses individual effect/* imports throughout source, tests and examples where upstream used the root Effect barrel (module suite scratchpad/test/tsconfig-json/**).
- **identity-annotations** — Lab attaches canonical file-local identity annotations and field metadata to upstream unannotated schema and codec surfaces (module suite scratchpad/test/tsconfig-json/**).

### Dependency backlog

None.

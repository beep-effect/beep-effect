# @beep/tsconfig

The tsconfig.json document model as Effect schemas: document and compiler-option schemas, tsc's own `extends` merge semantics as pure transforms, a portable-config filter for virtual TypeScript environments, and the string↔numeric enum codec a real compiler needs. Every parse is JSONC (comments and trailing commas are legal everywhere, exactly as tsc treats them), and options the schemas do not know pass through decode and encode untouched instead of being dropped. No IO.

## Why this package

Reading a tsconfig.json correctly means reproducing what tsc does, and what tsc does is more than `JSON.parse` plus `Object.assign`. Merging an `extends` chain is per-field, path options absolutize against the config that declared them rather than the one you loaded, and `${configDir}` substitutes once at the end against the top config's directory. These rules were extracted from the TypeScript compiler's source and encoded here as data-driven tests, so the merge you get is the merge tsc computes.

The package does this without importing `typescript`, not even as a type. It works at the string level (`"target": "es2023"` stays a string through schema and merge), and the version-coupled numeric enum mappings live in `TsEnumCodec` as plain data tables, so converting to the numeric shape a real compiler expects is an explicit final step rather than a dependency you carry everywhere. Malformed input fails through a typed error channel.

Reading configs from disk (resolving `extends` targets through `node_modules` and `exports` maps, discovering the nearest config) is the filesystem half of the same upstream package. It is not here yet; see [Provenance](#provenance).

## Usage

Decode a tsconfig.json document from JSONC text:

```ts
import { TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const doc = Effect.runSync(
  S.decodeEffect(TsconfigJsonFromString)(`{
    // comments are legal
    "compilerOptions": { "target": "ES2022", "strict": true, },
  }`)
);

console.log(doc.compilerOptions?.target); // "es2022": enum values decode case-insensitively
```

Fold a chain of configs with tsc's merge semantics. `ResolvedTsconfig.merge` is the pure engine a loader runs base-most first, own config last:

```ts
import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";

const base = ResolvedTsconfig.make({
  configPath: "/project/base.json",
  extendedPaths: ["/project/base.json"],
  compilerOptions: { strict: true, outDir: "${configDir}/dist" },
});

const merged = ResolvedTsconfig.merge(base, { compilerOptions: { strict: false } }, "/project/app/tsconfig.json");
const resolved = ResolvedTsconfig.substituteConfigDir(merged, "/project/app");

console.log(resolved.compilerOptions.strict); // false: the derived config wins per field
console.log(resolved.compilerOptions.outDir); // "/project/app/dist"
```

Hand the result to a real compiler by encoding the enum families to their numeric form, or narrow it to the portable subset a virtual TypeScript environment can safely reuse:

```ts
import { PortableTsconfig } from "@beep/tsconfig/PortableTsconfig";
import { TsEnumCodec } from "@beep/tsconfig/TsEnumCodec";

console.log(TsEnumCodec.encodeCompilerOptions({ target: "es2023", strict: true, lib: ["esnext"] }));
// { target: 10, strict: true, lib: [ 'lib.esnext.d.ts' ] }

const portable = PortableTsconfig.make({ strict: true, outDir: "/project/dist", types: ["node"] }, { includeTypes: true });
console.log(portable.compilerOptions.noEmit); // true: always forced
console.log("outDir" in portable.compilerOptions); // false: machine paths never travel
console.log(portable.compilerOptions.types); // [ 'node' ]: carried only when opted in
```

`includeTypes` defaults to `false` because emitting `types` makes tsc demand those `@types` packages resolve, a hard error in a virtual environment with no `node_modules`. Pass it when your environment materializes `@types` itself.

## TypeScript 7 and the classic compiler API

TypeScript 7's native `tsc` ships a version-only stub as its `.` export, with no JS compiler API behind it. A package that drives the typechecker as a library (`@typescript/vfs`, the language service, the Program API) can neither type against nor runtime-load a TypeScript 7 install. This package removes the compile-time half of that dependency:

1. Type against the tsconfig JSON form, not the compiler. Public option types use `CompilerOptions.Type` (`{ target: "es2022" }`, strings all the way down), so nothing imports `typescript`.
2. Convert at a single runtime seam. `TsEnumCodec.encodeCompilerOptions` maps the string form to the numeric enums a real compiler expects and returns `ProgrammaticCompilerOptions`, the shape a `ts.CompilerOptions`-typed API takes without a cast. The inbound direction is `CompilerOptionsFromProgrammatic`, a schema: hand it a live `ts.CompilerOptions` and validated `CompilerOptions.Type` comes back, with an unmappable numeric failing decode instead of leaking through.
3. Alias a classic install for the test runtime, where the JS API is genuinely needed (`"typescript-classic": "npm:typescript@^6.0.3"` plus a vitest `resolve.alias`), and pass `tsLibDirectory` explicitly to `@typescript/vfs`, whose `require.resolve("typescript")` otherwise finds the TypeScript 7 install and silently returns an empty lib map.

## Features

- `TsconfigJson` / `TsconfigJsonFromString`: the document schema and its JSONC string codec. A malformed document fails as `TsconfigParseError`.
- `CompilerOptions`: string-level schemas for `compilerOptions`. Enum values decode case-insensitively and encode to canonical lowercase; unknown or removed options survive a round trip as passthrough.
- `ClosedCompilerOptions` and `ClosedTsconfigJson`: the same typed fields with no passthrough record at any level, so an unknown key is an excess property (rejected under `onExcessProperty: "error"`, dropped by default). `@beep/repo-tsconfig`'s `TsconfigValidator` builds the strict model on these views, so the strict and the passthrough key universe is one.
- `ResolvedTsconfig`: the pure merge engine. `absolutize` resolves path options against the declaring config's directory, `merge` applies tsc's per-field rules (paths replaced wholesale, `files`/`include`/`exclude` re-rooted, `references` and `typeAcquisition` never inherited, `pathsBase` provenance), and `substituteConfigDir` runs the final `${configDir}` phase.
- `PortableTsconfig.make`: an allow-list projection down to machine-independent type-semantics options with `composite: false` and `noEmit: true` forced, the slice Twoslash, API Extractor or an in-memory language service can inherit.
- `JsxConfig.fromCompilerOptions`: the JSX transform a bundler can configure (`react-jsx` / `react-jsxdev` select the automatic runtime with its import source, `react` selects classic, anything else yields `Option.none()`).
- `TsEnumCodec` and `CompilerOptionsFromProgrammatic`: the string↔numeric enum tables as plain data, as a pair of functions and as a validating schema.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/tsconfig

# from packages/foundation/modeling/tsconfig
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` (`*.test.ts`, `*.property.test.ts`, `*.coverage.test.ts`, `*.assignability.test.ts`) and import package source through `@beep/tsconfig/*`; the shared `deliberatelyInvalid` helper lives in `test/support/`. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Provenance

Ported from upstream `@effected/tsconfig-json` (MIT, C. Spencer Beggs) through the effected port, then split-promoted from the scratchpad into this workspace package by `goals/effected-promotion` (wave 2a). Schema identities moved from `@beep/scratchpad/effected/tsconfig-json/*` to `@beep/tsconfig/*`. The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices.

Promoted here, the pure half: `CompilerOptions`, `CompilerOptionsFromProgrammatic`, `JsxConfig`, `PortableTsconfig`, `ResolvedTsconfig`, `TsconfigJson` and `TsEnumCodec`, with their tests.

Still in `scratchpad/effected/tsconfig-json`, the filesystem half: `TsconfigLoader`, `TsconfigLoaderSync`, `TsconfigDiscovery` and `internal/extendsTarget`. They read configs through `FileSystem` and `Path`, and discovery walks ancestor directories through the upstream walker, which has no `@beep` home yet. Wave 3 promotes them as `@beep/repo-tsconfig` in the tooling library family once `@beep/walker` exists; until then they import this package's modules by subpath.

## Port notes

### Attribution

- Upstream package: `@effected/tsconfig-json` 0.13.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence. Deviations that belong to the filesystem half are listed in the scratchpad README until wave 3.

- **native-runtime**: Lab replaces upstream Map/Set and Object helper sites with MutableHashMap, HashSet and Record helpers while preserving lookup and filtering contracts (`packages/foundation/modeling/tsconfig/test/TsEnumCodec.test.ts`; `packages/foundation/modeling/tsconfig/test/ResolvedTsconfig.test.ts`).
- **tagged-errors**: Lab preserves diagnostic stacks in parse-error cause encoding that upstream omitted (`packages/foundation/modeling/tsconfig/test/TsconfigJson.test.ts`).
- **schema-first**: Lab replaces upstream handwritten models and literal domains with schemas and LiteralKit, retains facade statics through branded `S.Opaque` (`ResolvedTsconfig`, `PortableTsconfig`, `PortableTsconfigOptions`, `JsxConfig`), and requires automatic JSX importSource while stripping it from classic variants (`packages/foundation/modeling/tsconfig/test/JsxConfig.test.ts`; `packages/foundation/modeling/tsconfig/test/ResolvedTsconfig.test.ts`; `packages/foundation/modeling/tsconfig/test/PortableTsconfig.test.ts`; `packages/foundation/modeling/tsconfig/test/TsEnumCodec.assignability.test.ts`).
- **schema-first**: A `ResolvedTsconfig` value is constructed with `ResolvedTsconfig.make`, and `ResolvedTsconfig.merge` builds its result the same way, so a merged result is validated and its nested data is copied (an inherited `watchOptions` is equal to the base's, no longer the same object). `substituteConfigDir` still copies its input field by field and keeps upstream's preservation of invalid entries (`packages/foundation/modeling/tsconfig/test/ResolvedTsconfig.coverage.test.ts`; `packages/foundation/modeling/tsconfig/test/ResolvedTsconfig.test.ts`).
- **schema-first**: The lab uses a precise portable-options schema and public type that enforce flag and field constraints and strip nonportable codec keys, and `PortableTsconfig.make` validates its projection, while upstream exposes `Record<string, unknown>` and enforces portability only through make (`packages/foundation/modeling/tsconfig/test/PortableTsconfig.test.ts`; `packages/foundation/modeling/tsconfig/test/PortableTsconfig.property.test.ts`).
- **numeric-domains**: Lab narrows upstream maxNodeModuleJsDepth from Number to Finite and uses finite enum fields in the programmatic runtime schema (`packages/foundation/modeling/tsconfig/test/CompilerOptions.test.ts`; `packages/foundation/modeling/tsconfig/test/TsEnumCodec.assignability.test.ts`; no dedicated non-finite rejection test).
- **type-safety**: Lab removes upstream unsafe casts and full-record compiler assignability, preserves unknown passthrough, and restores cast-free assignability of the known enum/lib subset (`packages/foundation/modeling/tsconfig/test/TsEnumCodec.assignability.test.ts`; `packages/foundation/modeling/tsconfig/test/TsEnumCodec.test.ts`).
- **effect-first**: Lab uses Effect functions and helpers and adds pipeable static combinators while retaining existing data-first results (`packages/foundation/modeling/tsconfig/test/TsEnumCodec.test.ts`; `packages/foundation/modeling/tsconfig/test/ResolvedTsconfig.test.ts`; `packages/foundation/modeling/tsconfig/test/JsxConfig.test.ts`).
- **effect-imports**: Lab uses individual effect/* imports throughout source, tests and examples where upstream used the root Effect barrel (module suite `packages/foundation/modeling/tsconfig/test/**`).
- **identity-annotations**: Lab attaches canonical `$TsconfigId` identity annotations and field metadata to upstream unannotated schema and codec surfaces (module suite `packages/foundation/modeling/tsconfig/test/**`).

### Dependency backlog

None.

## License

[MIT](LICENSE)

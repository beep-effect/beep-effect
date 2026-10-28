# @beep/repo-tsconfig

`tsconfig.json` loading for repo tooling, with tsc's semantics. `TsconfigLoader` reads and decodes one config, resolves its whole `extends` chain the way `tsc` does, and folds it into one `ResolvedTsconfig`. `TsconfigLoaderSync` runs the same pipeline synchronously over file and path operations the caller supplies. `TsconfigDiscovery.findNearest` finds the nearest config above a directory. `TsconfigValidator` is the strict door: the same document closed to the typed fields of `@beep/tsconfig` (an unknown key, a `null` option or a removed enum value is a failure) plus the uniqueness and cross-field rules tsc enforces, over an in-memory value or a file read through the loader. All IO goes through `FileSystem` and `Path` from `effect` core, so the caller provides a platform once, at the edge.

## Why this package

Resolving an `extends` chain takes more than `JSON.parse` and a recursive read. tsc reads every config as JSONC. It resolves a bare specifier through `node_modules` the way the module resolver does: it honours `exports` maps (which block every same-package fallback), the `tsconfig` manifest field and the `.json` retry, and it realpaths the result. Relative paths in an inherited config are re-rooted against the config that declared them, and `${configDir}` is substituted once, against the top config. A loader that gets one of these wrong does not fail. It returns slightly wrong options, and every gate that reads them inherits the error.

This package replaces `get-tsconfig` in `@beep/repo-cli`. It is checked against `tsc` itself rather than against another resolver: the differential in `goals/effected-promotion/ops/repo-tsconfig-differential.ts` covers every tracked `tsconfig*.json` in the repo and 666 synthetic package specifiers over the real `node_modules`.

The document model (`TsconfigJson`, `CompilerOptions`, `ResolvedTsconfig` and the rest) lives in `@beep/tsconfig`, which has no IO. This package is the IO half. It is ESM-only. Its runtime dependencies are `effect` v4 and the workspace packages `@beep/identity`, `@beep/jsonc`, `@beep/schema`, `@beep/tsconfig` and `@beep/walker`.

## Usage

Resolve a config and its full `extends` chain:

```ts
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const program = TsconfigLoader.resolve("./tsconfig.json").pipe(
  Effect.tap((resolved) => Effect.log(resolved.extendedPaths)),
  Effect.provide(PlatformLive)
);
```

`extendedPaths` lists every config on the chain as a normalized absolute path, base-most first and the given config last. `compilerOptions` holds the merged options, with path-valued options absolute. `TsconfigLoader.compilerOptions(path)` projects the resolution straight down to the merged options.

Find the nearest config when all you have is a starting directory:

```ts
import { TsconfigDiscovery } from "@beep/repo-tsconfig/TsconfigDiscovery";
import * as Effect from "effect/Effect";

const nearest = TsconfigDiscovery.findNearest("/repo/packages/app/src");
// Effect<Option<string>, never, FileSystem | Path>: absence is Option.none(), never an error
console.log(Effect.isEffect(nearest)); // true
```

Load synchronously inside a hook that cannot await. Node's built-ins satisfy the operations directly, and the package itself imports no `node:*` module:

```ts
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import * as path from "node:path";
import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";

const options = TsconfigLoaderSync.compilerOptions("./tsconfig.json", {
  fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8"), realPath: realpathSync,
    isFile: (p) => {
      try { return statSync(p).isFile(); } catch { return false; }
    } },
  path,
});
console.log(typeof options); // object
```

Validate a config the user named, strictly, and take its effective options:

```ts
import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
import * as Effect from "effect/Effect";

// The named file passes the strict closed check, its extends chain is merged with tsc semantics,
// and the merged options pass the check too. Requires FileSystem and Path from a platform layer.
const program = TsconfigValidator.compilerOptions("./tsconfig.json");
console.log(Effect.isEffect(program)); // true

// In memory: a typo, a null option or a duplicate lib entry fails typed as TsconfigValidationError.
console.log(Effect.runSyncExit(TsconfigValidator.validate({ compilerOptions: { stirct: true } }))._tag); // Failure
```

`StrictTsconfig` and `StrictCompilerOptions` are the schemas behind it; encoding a validated value gives the on-disk JSON shape with every enum in its canonical lower-case spelling. docgen renders its examples `tsconfig.json` through them.

`isFile` is optional and defaults to `exists`, preserving existing sync adapters. Supply it to distinguish files from directories (following symlinks) and return false for stat errors, including missing paths and paths through files (`ENOTDIR`). Directory targets then fall through to a `.json` sibling, later export candidate or ancestor package, as tsc does. The async loader uses the platform `stat` operation for this classification.

`realPath` is optional. Without it, a package target reached through a `node_modules` symlink is used as found, so its own relative `extends` resolves from the link's directory. Failures are the async pipeline's typed errors thrown as themselves (`TsconfigParseError`, `TsconfigExtendsError`, or a `PlatformError` wrapping what your operation threw), never a fiber-failure wrapper.

## Features

- `TsconfigLoader.load`, `.resolve`, `.compilerOptions`: read and decode one config; resolve its `extends` chain depth-first with per-branch cycle stacks (diamond chains are legal) and a depth guard; or project the result down to the merged options.
- Target resolution as tsc does it. Relative and rooted targets try the exact file, then the `.json` retry. Bare specifiers walk the ancestor `node_modules` chain: `exports` maps with longest-prefix `*` patterns, conditions in insertion order, and `.d.ts`/`.ts`/`.js` targets read as their `.json` sibling, taking the first target that exists (a missing one falls through to the next condition or array entry; a `null` target stops the lookup); then the `tsconfig` manifest field and `<pkg>/tsconfig.json`. A package target is realpathed (`preserveSymlinks: false`).
- `TsconfigLoaderSync`: the same pipeline under `Effect.runSyncExit` over `{ fileSystem, path }` operations the caller supplies, Windows-correct when the caller passes a win32 `path`.
- `TsconfigDiscovery.findNearest`: the nearest `tsconfig.json` (or another file name through `FindNearestOptions.filename`) at or above a directory, over `@beep/walker`. An unreadable ancestor cannot hide a config above it.
- `TsconfigValidator.validate`, `.validateCompilerOptions`, `.load`, `.compilerOptions`: the strict closed check over `@beep/tsconfig`'s `ClosedTsconfigJson` / `ClosedCompilerOptions` views (one key universe with the passthrough model), with unique `files`/`include`/`exclude`/`references`/`lib`/`types`/`typeRoots`/`rootDirs`/`customConditions`/`moduleSuffixes`/`paths` lists, a non-negative integer `maxNodeModuleJsDepth`, and tsc's cross-field rules (`allowImportingTsExtensions` needs `noEmit`, `emitDeclarationOnly` or `rewriteRelativeImportExtensions`; `reactNamespace` needs `jsx: react`; `maxNodeModuleJsDepth` needs `allowJs`). Every issue names the rejected value and its path.
- Typed failures. A malformed file is a `TsconfigParseError` carrying its path. A document the strict rules reject is a `TsconfigValidationError` carrying its path and the schema failure. A broken chain is a `TsconfigExtendsError` with an `ExtendsFailureReason` (`not-found`, `cycle`, `depth`, `empty`) and the full chain. IO errors flow through as `PlatformError`. Hostile manifests never defect.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/repo-tsconfig
bun goals/effected-promotion/ops/repo-tsconfig-differential.ts

# from packages/tooling/library/repo-tsconfig
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/repo-tsconfig/<Module>` aliases. `test/support/fixtures.ts` builds in-memory volumes on `@beep/memfs`; the symlink suite uses a real temporary directory, since the realpath behaviour needs real links. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Port notes

### Attribution

- Upstream package: `@effected/tsconfig-json` 0.13.0, the loader half (`TsconfigLoader`, `TsconfigLoaderSync`, `TsconfigDiscovery`, `internal/extendsTarget`). The document model half is `@beep/tsconfig`.
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)

### Deviations

The module-level port deviations recorded in the scratchpad port carry over: Effect collections and helpers in place of native runtime operations, a schema-tagged `UnsupportedPathOperationError` in place of the sync adapter's native `Error`, dual overloads on the exports-resolution helpers, per-module Effect imports, and `@beep/identity` annotations. On promotion (`goals/effected-promotion`, wave 3-2):

- **Realpathed package targets (bug fix).** A package-resolved `extends` target is realpathed, as tsc does. The lab kept the `node_modules` path, so a workspace package linked under `node_modules` resolved its own relative `extends` from the link and failed with `not-found`. Relative and rooted targets are still not realpathed, which matches tsc. `SyncFileSystem.realPath` is new and optional; it defaults to the identity.
- **`.json` siblings of export targets (bug fix).** An `exports` target ending in `.d.ts`, `.ts` or `.js` is read as its `.json` sibling, as tsc's config lookup does. The lab accepted only `.json` targets.
- **`exports` falls through like tsc (bug fix).** Every `exports` target is a candidate in tsc's order, and the first that exists wins: a missing target falls through to later conditions, fallback-array entries and outer conditions. Targets that do not start with `./`, or carry a `.`, `..` or `node_modules` segment (in the target or in a `*` capture), are skipped. A `null` target stops the lookup, ancestors included. An `exports` of `null`, `false` or `""` counts as absent. The lab stopped at the first target, whether or not it existed. Measured on tsgo 7.0.2; Node's exports algorithm differs and is not the oracle.
- **`exports` blocks the fallback.** A manifest with `exports` that does not resolve the subpath ends the lookup for that package, as in tsc; `get-tsconfig` falls back to the plain file (249 of the 714 corpus-B specifiers).
- **No expansion of tsc defaults.** The resolution reports declared options only: no implied options (`strict` does not expand) and no implicit `outDir` entry in `exclude`.
- **Schema-first.** `FindNearestOptions` is a branded `S.Opaque` (`findNearest` takes its `Encoded` shape, so object literals still work), and `ExtendsFailureReason` is a `LiteralKit` whose `match` builds the error message.
- **Span and identities.** The discovery span is `TsconfigDiscovery.findNearest` (upstream `findNearest`). Schema identities moved from `@beep/scratchpad/effected/tsconfig-json/*` to `@beep/repo-tsconfig/*`.

## License

[MIT](LICENSE)

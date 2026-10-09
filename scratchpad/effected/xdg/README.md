# xdg (lab port of @effected/xdg)


XDG Base Directory resolution for Effect. `Xdg` reads the environment — `$HOME`, the four `*_HOME` variables, `$XDG_RUNTIME_DIR`, and the `$XDG_CONFIG_DIRS` / `$XDG_DATA_DIRS` search paths — once, at layer construction. `AppDirs` turns that into the config, data, cache, state and runtime directories for one application namespace, with on-demand creation. `NativeDirs` supplies the macOS and Windows conventions for applications that want them, and `XdgConfig` plugs the whole thing into [`@effected/config-file`](../config-file) as a resolver chain and a save target.

## Why @effected/xdg

Path resolution is not IO, and modeling it as IO poisons everything downstream. The environment is fixed for the life of a process, so this package reads it exactly once — when the layer is built — and the service's shape *is* the resolved value. `appDirs.dirs.config` is a `string`, not an `Effect<string, XdgEnvError>`. Reading a path cannot fail, cannot be observed to do IO and drops straight into config-file's `defaultPath` slot, which is typed `Effect<string, never, R>` and would otherwise need an `orDie` to satisfy.

Two more things follow from taking the spec seriously. The system search paths are half of XDG and are usually skipped: a config lookup here probes the app's own config directory — whichever rung of the precedence below resolved it — *and then* each `$XDG_CONFIG_DIRS` entry, namespaced, and it absorbs failure per candidate — an unreadable `/etc/xdg` means "this candidate did not match", never "abort the search and hide the perfectly readable file below it". And the runtime directory has no fallback ladder, because there is no defensible one: it must be user-owned and mode 0700, so when `$XDG_RUNTIME_DIR` is unset the key is simply absent rather than pointing somewhere invented.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 is a peer dependency, and so are `@effected/walker` (the upward-traversal and search primitives the resolvers are built on) and `@effected/config-file` (whose `ConfigResolver` seam `XdgConfig` implements). Package managers that install peers automatically will pull them in; add them to your manifest explicitly if yours does not. There are no runtime dependencies.

Creating directories needs a `FileSystem` and a `Path` implementation, provided once at the edge — from `@effect/platform-node` on Node. Resolution itself needs neither.

## Quick start

Build `AppDirs` for your namespace, provide it the `Xdg` environment and the platform layers, and read the paths:

```ts
import { AppDirs, Xdg } from "@beep/scratchpad/effected/xdg/index";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const AppDirsLive = AppDirs.layer({ namespace: "myapp", native: true }).pipe(
  Layer.provide(Layer.mergeAll(Xdg.layer, PlatformLive)),
);

const program = Effect.gen(function* () {
  const appDirs = yield* AppDirs;
  console.log(appDirs.dirs.config);
  // Linux, XDG_CONFIG_HOME set:   $XDG_CONFIG_HOME/myapp
  // Linux, XDG_CONFIG_HOME unset: $HOME/.myapp
  // macOS with `native: true`:    $HOME/Library/Application Support/myapp
  return yield* appDirs.ensureConfig;
  // The same path, now created on disk.
});

Effect.runPromise(program.pipe(Effect.provide(AppDirsLive)));
```

`AppDirs.layer` is a layer-returning *function*, not a layer: calling it twice builds two independent services. Bind its result to a const, as above, and provide that const.

## Precedence

Each of `config`, `data`, `cache` and `state` resolves through five rungs, first match wins:

1. an explicit `dirs.<kind>` override — an absolute path, and it wins outright;
2. the XDG variable, namespaced: `$XDG_CONFIG_HOME/<namespace>`;
3. the OS-native directory, when `native: true` and the platform has one;
4. `$HOME/<fallbackDir>` — all four kinds collapse into that one directory;
5. `$HOME/.<namespace>`.

Rungs 4 and 5 are deliberately not the spec's per-kind defaults (`~/.config`, `~/.local/share`): an application that wants those passes them as `dirs` overrides. The runtime directory skips the ladder entirely — an override, or `$XDG_RUNTIME_DIR/<namespace>`, or nothing.

`NativeDirs.resolve` is pure — platform, namespace, environment and `Path` all arrive as parameters — so the whole matrix is testable with no filesystem and no `process.platform` read. On macOS `config`, `data` and `state` collapse to `~/Library/Application Support/<ns>` while `cache` stays under `~/Library/Caches/<ns>`; on Windows they split across `%APPDATA%` and `%LOCALAPPDATA%`. Everywhere else it returns `Option.none()`, because on Linux XDG *is* the native convention and there is nothing to override.

The platform is a `Context.Reference`, never a global read. Pin it in a test with `Layer.succeed(CurrentPlatform, "win32")` and exercise the Windows paths on a Mac.

## Config files

`XdgConfig` is the bridge into `@effected/config-file`. `resolver` searches the app's whole config search path, `nativeResolver` probes the OS-native directory, and `savePath` names the default write target:

```ts
import { ConfigFile, JsonCodec, MergeStrategy } from "@beep/scratchpad/effected/config-file/index";
import { XdgConfig } from "@beep/scratchpad/effected/xdg/index";
import * as S from "effect/Schema";

class AppShape extends S.Class<AppShape>("AppShape")({
  port: S.Number,
  host: S.String,
}) {}

class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("myapp/Config") {}

export const AppConfigLive = ConfigFile.layer(AppConfig, {
  schema: AppShape,
  codec: JsonCodec,
  resolvers: [
    XdgConfig.resolver({ filename: "config.json" }),
    XdgConfig.nativeResolver({ namespace: "myapp", filename: "config.json" }),
  ],
  strategy: MergeStrategy.firstMatch<AppShape>(),
  defaultPath: XdgConfig.savePath("config.json"),
});
```

Order matters: put `resolver` before `nativeResolver` so an existing `~/.config/<app>/config.json` still wins over the OS-native directory. `savePath` does not create the directory — `ConfigFile.save` already creates the parent of whatever path it is handed.

## Errors

| Tag | Means | Recovery |
| --- | --- | --- |
| `XdgEnvError` | `$HOME` is not set. Carries `variable` and the structural `cause` — the underlying `ConfigError`. | The one environment failure there is. Every other XDG variable is optional by construction, and its absence is a resolved default rather than an error. |
| `AppDirsError` | A directory could not be created. Carries `directory` (which kind), `path` and the structural `cause`. | The only way `AppDirs` fails, because resolution already happened. Check permissions. |

A namespace that is empty, or contains a path separator, or is exactly `.` or `..`, is a **defect** at layer construction rather than a typed error. It can only come from code, and `namespace: "../.."` would resolve the application's directories outside `$HOME` entirely.

## Testing

`@effected/memfs` virtualizes the filesystem, not the platform. `AppDirs` and `XdgConfig` read the platform through the `CurrentPlatform` reference, which defaults to the host's `process.platform`, so a test that only swaps the filesystem still takes the host's darwin, linux or win32 branch. Pin the platform as well:

```ts
import { MemoryFileSystem } from "@beep/scratchpad/effected/memfs/index";
import { AppDirs, CurrentPlatform, Xdg, XdgPaths } from "@beep/scratchpad/effected/xdg/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const TestEnv = Layer.mergeAll(
  Xdg.layerFrom(XdgPaths.make({ home: "/home/ada", configDirs: ["/etc/xdg"], dataDirs: ["/usr/share"] })),
  MemoryFileSystem.layer,
  Path.layer,
);

const config = Effect.gen(function* () {
  const appDirs = yield* AppDirs;
  return appDirs.dirs.config;
}).pipe(
  Effect.provide(AppDirs.layer({ namespace: "myapp", native: true }).pipe(Layer.provide(TestEnv))),
  Effect.provideService(CurrentPlatform, "linux"),
);
// "/home/ada/.myapp" on every host; pin "darwin" and the same program answers
// "/home/ada/Library/Application Support/myapp"
```

`Layer.succeed(CurrentPlatform, "win32")` is the equivalent layer form, for composing the pin into a test layer graph.

## Features

- `Xdg` / `XdgPaths` — the resolved XDG environment as a value, including the `$XDG_CONFIG_DIRS` and `$XDG_DATA_DIRS` search paths, split and defaulted per the spec. `Xdg.layerFrom` serves fixed paths for tests.
- `AppDirs` / `ResolvedAppDirs` — the five app-namespaced directories plus the config and data search paths, with `ensureConfig`, `ensureData`, `ensureCache`, `ensureState`, `ensureRuntime` and `ensure` for on-demand creation.
- `NativeDirs` — the macOS and Windows conventions, resolved purely from a platform, a namespace and an environment.
- `CurrentPlatform` — the platform as a `Context.Reference`, defaulting to `process.platform` and overridable in a test.
- `XdgConfig` — `resolver`, `nativeResolver` and `savePath`, dropping straight into `@effected/config-file`'s `ConfigResolver` and `defaultPath` slots.
- `XdgEnvError` / `AppDirsError` — tagged errors carrying their cause structurally.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/xdg` 0.9.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Namespace validation now creates AppDirsNamespaceError instead of native Error while preserving defects and messages (scratchpad/test/xdg/AppDirs.test.ts:464,480-485,487).
- **tagged-errors** — Tagged schema errors now preserve encoded cause stacks, and namespace defects use the added tagged error model (scratchpad/test/xdg/Xdg.test.ts:155; scratchpad/test/xdg/AppDirs.test.ts:182,464).
- **schema-first** — LiteralKit domains, schema option values, namespace guards and schema JSON decoding replace upstream literal schemas, interfaces, predicates and JSON.parse (scratchpad/test/xdg/Xdg.test.ts:124; scratchpad/test/xdg/AppDirs.test.ts:86,112,127,138,487; scratchpad/test/xdg/XdgConfig.test.ts:192).
- **numeric-domains** — The savePath integration fixture now uses S.Finite instead of Schema.Number (scratchpad/test/xdg/XdgConfig.test.ts:192,197).
- **type-safety** — The upstream cause cast is replaced by property narrowing, and later diagnostic skip directives are removed (scratchpad/test/xdg/Xdg.test.ts:61,69-71; module suite scratchpad/test/xdg/**).
- **tsgo-diagnostics** — Scoped layer builds and context provision replace effectful Effect.provide fixtures, with corrected instance types and direct platform provision (module suite scratchpad/test/xdg/**).
- **effect-first** — Effect.fn, Bool.match, Effect.asSome and direct service effects replace generator wrappers, Boolean ternaries and redundant helper forms (scratchpad/test/xdg/XdgConfig.test.ts:185,192; scratchpad/test/xdg/NativeDirs.test.ts:31; module suite scratchpad/test/xdg/**).
- **effect-imports** — Implementation, tests and the converted AppDirs example now import effect modules individually instead of the root barrel (module suite scratchpad/test/xdg/**).
- **identity-annotations** — Composer keys, identifiers and field annotations replace upstream service keys and short schema identities (module suite scratchpad/test/xdg/**).
- **upstream-bug** — Empty optional environment directory values now become absent keys and follow fallbacks instead of producing relative paths (scratchpad/test/xdg/Xdg.test.ts:99; scratchpad/test/xdg/AppDirs.test.ts:157).
- **upstream-bug** — Empty HOME now fails with typed XdgEnvError instead of resolving relative fallback paths (scratchpad/test/xdg/Xdg.test.ts:108).

### Dependency backlog

None.

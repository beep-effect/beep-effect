# @beep/xdg

XDG Base Directory resolution for Effect. `Xdg` reads the environment (`$HOME`, the four `*_HOME` variables, `$XDG_RUNTIME_DIR` and the `$XDG_CONFIG_DIRS` / `$XDG_DATA_DIRS` search paths) once, at layer construction. `XdgBase` resolves one base directory with its spec default, purely or through `Config`. `AppDirs` turns the environment into the config, data, cache, state and runtime directories of one application namespace, with on-demand creation. `NativeDirs` supplies the macOS and Windows conventions, and the `@beep/xdg/XdgConfig` subpath plugs the whole thing into [`@beep/config-file`](../config-file) as a resolver chain and a save target.

## Why this package

Path resolution is not IO, and modeling it as IO poisons everything downstream. The environment is fixed for the life of a process, so `Xdg` reads it exactly once, when the layer is built, and the service's shape *is* the resolved value. `appDirs.dirs.config` is a `string`, not an `Effect<string, XdgEnvError>`, so it drops straight into config-file's `defaultPath` slot.

Taking the spec seriously means three things. Only absolute values count: an empty, whitespace-only or relative `$XDG_*` value is invalid and ignored, as `systemd-path` ignores it, and the two inputs that cannot be ignored, `$HOME` and an explicit `dirs` override, must be absolute or the layer fails. The system search paths are half of XDG: a config lookup probes the app's own config directory and then each `$XDG_CONFIG_DIRS` entry, namespaced, and absorbs failure per candidate. And the runtime directory has no fallback, because there is no defensible one.

Creating directories needs a `FileSystem` and a `Path` implementation, provided once at the edge. Resolution itself needs neither.

## Usage

### One base directory

`XdgBase` is the small entry point for code that needs one directory, such as a state root, without an `AppDirs` namespace:

```ts
import { XdgBase } from "@beep/xdg/XdgBase";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

// Pure: the variable's value wins when it is absolute, else the spec default under an absolute HOME.
console.log(O.getOrNull(XdgBase.resolve("state", { home: "/home/ada", value: "relative" }))); // /home/ada/.local/state

// Through Config: `dir` answers Option.none() when nothing resolves; `require` fails with a ConfigError naming HOME.
const provider = ConfigProvider.fromUnknown({ HOME: "/home/ada" });
console.log(Effect.runSync(XdgBase.require("data").parse(provider))); // /home/ada/.local/share
```

`XdgBase` is HOME-optional: a missing or relative `$HOME` makes the default absent instead of failing, so `dir` can say "no directory" and the caller decides. The runtime kind never has a default.

### Application directories

Build `AppDirs` for your namespace, provide it the `Xdg` environment and the platform layers, and read the paths:

```ts
import { AppDirs, Xdg } from "@beep/xdg";
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

### Precedence

Each of `config`, `data`, `cache` and `state` resolves through five rungs, first match wins:

1. an explicit `dirs.<kind>` override, which must be absolute (POSIX, a drive root or a UNC share) and wins outright, used verbatim;
2. the XDG variable, namespaced: `$XDG_CONFIG_HOME/<namespace>`;
3. the OS-native directory, when `native: true` and the platform has one;
4. `$HOME/<fallbackDir>` — all four kinds collapse into that one directory;
5. `$HOME/.<namespace>`.

Rungs 4 and 5 are deliberately not the spec's per-kind defaults (`~/.config`, `~/.local/share`): an application that wants those passes them as `dirs` overrides. The runtime directory skips the ladder entirely — an override, or `$XDG_RUNTIME_DIR/<namespace>`, or nothing.

`NativeDirs.resolve` is pure — platform, namespace, environment and `Path` all arrive as parameters — so the whole matrix is testable with no filesystem and no `process.platform` read. On macOS `config`, `data` and `state` collapse to `~/Library/Application Support/<ns>` while `cache` stays under `~/Library/Caches/<ns>`; on Windows they split across `%APPDATA%` and `%LOCALAPPDATA%`. Everywhere else it returns `Option.none()`, because on Linux XDG *is* the native convention and there is nothing to override.

The platform is read through `@beep/utils/HostProcess` `HostProcessPlatform`, never a global read; `currentPlatform` maps it onto `XdgPlatform` and treats anything else (a browser, a worker, an unknown OS) as Linux. Pin it in a test with `Layer.succeed(HostProcessPlatform, "win32")` and exercise the Windows paths on a Mac.

### Config files

`XdgConfig` is the bridge into `@beep/config-file`, served from its own `@beep/xdg/XdgConfig` subpath so the root never loads config-file. `resolver` searches the app's whole config search path, `nativeResolver` probes the OS-native directory, and `savePath` names the default write target:

```ts
import { ConfigFile, JsonCodec, MergeStrategy } from "@beep/config-file";
import { XdgConfig } from "@beep/xdg/XdgConfig";
import * as S from "effect/Schema";

class AppShape extends S.Class<AppShape>("AppShape")({
  port: S.Number,
  host: S.String,
}) {}

class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("myapp/Config") {}

const resolvers = [
  XdgConfig.resolver({ filename: "config.json" }),
  XdgConfig.nativeResolver({ namespace: "myapp", filename: "config.json" }),
];

export const AppConfigLive = ConfigFile.layer(AppConfig, {
  schema: AppShape,
  codec: JsonCodec,
  resolvers,
  strategy: MergeStrategy.firstMatch<AppShape>(),
  defaultPath: XdgConfig.savePath("config.json"),
});
```

Order matters: put `resolver` before `nativeResolver` so an existing `~/.config/<app>/config.json` still wins over the OS-native directory. `savePath` does not create the directory — `ConfigFile.save` already creates the parent of whatever path it is handed.

### Errors

| Tag | Means | Recovery |
| --- | --- | --- |
| `XdgEnvError` | `$HOME` is unset, empty or relative. Carries `variable` and the structural `cause` — the underlying `ConfigError`. | The one environment failure there is. Every other XDG variable is optional by construction, and its absence is a resolved default rather than an error. |
| `AppDirsError` | A directory could not be created. Carries `directory` (which kind), `path` and the structural `cause`. | The only way `AppDirs` fails, because resolution already happened. Check permissions. |

A namespace that is empty, or contains a path separator, or is exactly `.` or `..`, is a **defect** at layer construction rather than a typed error (`AppDirsNamespaceError`). It can only come from code, and `namespace: "../.."` would resolve the application's directories outside `$HOME` entirely. A relative `dirs` override is the same kind of defect (`AppDirsOverrideError`, naming the first relative kind in `AppDirKind` order): used as given it would resolve against the working directory.

### Testing

`@beep/memfs` virtualizes the filesystem, not the platform. `AppDirs` and `XdgConfig` read the platform through `HostProcessPlatform`, which defaults to the host's `process.platform`, so a test that only swaps the filesystem still takes the host's branch. Provide `Layer.succeed(HostProcessPlatform, "linux")` (or `Effect.provideService`) beside `Xdg.layerFrom(...)` and `MemoryFileSystem.layer` to pin it, and drive `Xdg.layer` and `XdgBase` with `ConfigProvider.fromUnknown({ ... })` instead of mutating the real environment.

## Features

- `Xdg` / `XdgPaths`: the resolved XDG environment as a branded value, absolute values only, including the `$XDG_CONFIG_DIRS` and `$XDG_DATA_DIRS` search paths, split and defaulted per the spec. `Xdg.layerFrom` serves fixed paths for tests.
- `XdgBase` / `XdgBaseKind`: one base directory with its spec default. `resolve` is pure; `dir` and `require` are `Config` wrappers; `variable` names the environment variable.
- `AppDirs` / `ResolvedAppDirs`: the five app-namespaced directories plus the config and data search paths, with `ensureConfig`, `ensureData`, `ensureCache`, `ensureState`, `ensureRuntime` and `ensure` for on-demand creation. `AppDirsOptions` and `AppDirOverrides` are branded schemas; `AppDirs.layer` takes their encoded form.
- `NativeDirs`: the macOS and Windows conventions, resolved purely from a platform, a namespace and an environment.
- `currentPlatform`: `HostProcessPlatform` mapped onto `XdgPlatform`.
- `@beep/xdg/Absolute`: `isAbsolutePosix`, `isAbsoluteWin32`, `absolutePathPattern` and the `AbsolutePosixPath` / `AbsolutePath` schemas, the one meaning of an absolute root shared with callers that keep a Windows rung beside `XdgBase` (repo-cli person-match cache, ai-metrics state home).
- `@beep/xdg/XdgConfig` (subpath only): `resolver`, `nativeResolver` and `savePath` for `@beep/config-file`'s `ConfigResolver` and `defaultPath` slots.
- `XdgEnvError` / `AppDirsError` / `AppDirsNamespaceError` / `AppDirsOverrideError`: tagged errors carrying their cause structurally.

## Named importers

The capability gate for `foundation/capability` requires at least two importing packages:

- `@beep/m365-mcp`: `OutboxConfig` resolves the default attachment staging root and the audit directory through `XdgBase.dir("data")` and `XdgBase.dir("state")`.
- `@beep/repo-cli`: `internal/state/WorkstationState.ts` `resolveWorkstationStateDir` resolves the workstation state root through `XdgBase.require("state")` for its five callers (Accounts, Palantiri, Session Register, SessionLedger and the Yeet PR-session registry).

The adoption PR 4-X-A moved nine further sites onto `XdgBase`: `@beep/repo-ai-metrics` (`data-root.ts` `aiMetricsStateHome` and the forwarder's hook-evidence root), `@beep/repo-cli` (`BeepCacheRoot`, the Fleet scanner cache, the HarnessLedger hook-pulse directory, the ai-metrics command data root through `aiMetricsStateHome`, and the `files match-person` cache), `@beep/docket-intake` (`stateDirectory`) and `@beep/practice-m365-contacts` (the contacts state root). `aiMetricsStateHome` and the person-match cache keep their Windows branches beside it, because `XdgBase` is POSIX-only. Hand-written XDG reads remain, each with a recorded reason in `goals/effected-promotion/history/reuse-ledger.md`: `apps/practice-mail-tagging`, `apps/practice-gateway` and `apps/practice-kg-mcp` are deployed practice services that would change directory under a new rule, and `@beep/repo-workspaces` `configDependencyResolution` mirrors pnpm's own store lookup rather than resolving a beep directory.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/xdg

# from packages/foundation/capability/xdg
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/xdg/<Module>` aliases. `test/fixtures/systemd-path.golden.json` freezes 900 `systemd-path` answers that `test/XdgBase.test.ts` replays; `goals/effected-promotion/ops/xdg-systemd-differential.ts` regenerates it (`--golden`) and compares the live `systemd-path` with `XdgBase` and `Xdg.layer` (record: `goals/effected-promotion/research/xdg-systemd-differential-w4.json`). `test/rootClosure.test.ts` walks the raw `src` modules (`test/support/rawModules.ts`) and pins that the root barrel never loads `XdgConfig`, `@beep/config-file` or `@beep/walker`. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Port notes

### Added exports

- `XdgBase` and `XdgBaseKind` (`src/XdgBase.ts`), new in the promotion.
- `currentPlatform` replaces the upstream `CurrentPlatform` reference.
- `AppDirsNamespaceError` is exported from the root.
- `AppDirsOverrideError` (`src/AppDirs.ts`), new in 4-X-A.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Namespace validation now creates AppDirsNamespaceError instead of native Error while preserving defects and messages (test/AppDirs.test.ts:464,480-485,487).
- **tagged-errors** — Tagged schema errors now preserve encoded cause stacks, and namespace defects use the added tagged error model (test/Xdg.test.ts:155; test/AppDirs.test.ts:182,464).
- **schema-first** — LiteralKit domains, schema option values, namespace guards and schema JSON decoding replace upstream literal schemas, interfaces, predicates and JSON.parse (test/Xdg.test.ts:124; test/AppDirs.test.ts:86,112,127,138,487; test/XdgConfig.test.ts:192).
- **numeric-domains** — The savePath integration fixture now uses S.Finite instead of Schema.Number (test/XdgConfig.test.ts:192,197).
- **type-safety** — The upstream cause cast is replaced by property narrowing, and later diagnostic skip directives are removed (test/Xdg.test.ts:61,69-71; module suite test/**).
- **tsgo-diagnostics** — Scoped layer builds and context provision replace effectful Effect.provide fixtures, with corrected instance types and direct platform provision (module suite test/**).
- **effect-first** — Effect.fn, Bool.match, Effect.asSome and direct service effects replace generator wrappers, Boolean ternaries and redundant helper forms (test/XdgConfig.test.ts:185,192; test/NativeDirs.test.ts:31; module suite test/**).
- **effect-imports** — Implementation, tests and the converted AppDirs example now import effect modules individually instead of the root barrel (module suite test/**).
- **identity-annotations** — Composer keys, identifiers and field annotations replace upstream service keys and short schema identities (module suite test/**).
- **upstream-bug** — Empty optional environment directory values now become absent keys and follow fallbacks instead of producing relative paths (test/Xdg.test.ts:99; test/AppDirs.test.ts:157).
- **upstream-bug** — Empty HOME now fails with typed XdgEnvError instead of resolving relative fallback paths (test/Xdg.test.ts:108).

### Promotion shifts (wave 4-X)

- **absolute-only** — `Xdg.layer` ignores empty, whitespace-only and relative `$XDG_*_HOME` and `$XDG_RUNTIME_DIR` values, drops relative `$XDG_CONFIG_DIRS` / `$XDG_DATA_DIRS` entries (a list left empty takes the default), and keeps `APPDATA` / `LOCALAPPDATA` only as drive or UNC roots (test/Xdg.test.ts "invalid environment values").
- **host-platform** — `CurrentPlatform` and its `globalThis.process` read are replaced by `currentPlatform` over `@beep/utils/HostProcess` `HostProcessPlatform` (test/Xdg.coverage.test.ts).
- **opaque-records** — `XdgPaths`, `NativeDirs`, `ResolvedAppDirs`, `AppDirOverrides` and `AppDirsOptions` are branded `S.Opaque` schemas, admitted once where they are built; `AppDirs.layer` takes `AppDirsOptions.Encoded`, and `AppDirsShape` is derived from the service (test/AppDirs.test.ts).
- **subpath** — `XdgConfig` is no longer re-exported from the root; import `@beep/xdg/XdgConfig` (test/rootClosure.test.ts).
- **known gaps (closed in 4-X-A)** — 4-X carried two lab gaps where absolute-only did not reach. Both are closed: `Xdg.layer` now fails with `XdgEnvError` on a relative `HOME` instead of keeping it verbatim, and `XdgEnvError`'s message reads "not set to an absolute path" (test/Xdg.test.ts "rejects a relative HOME"); `AppDirOverrides` fields are absolute-path schemas and `AppDirs.layer` dies with `AppDirsOverrideError` on a relative override instead of using it as rung 1 (test/AppDirs.test.ts "the override guard"). A POSIX path, a drive root or a UNC share counts as absolute for both. `XdgBase` still treats a relative `HOME` as absent, because it is HOME-optional.
- **absolute HOME, two meanings** — `Xdg.layer` and the `AppDirs` overrides take an absolute path of either platform (`src/Absolute.ts` `AbsolutePath`), because `HOME` and an override can name a Windows directory: `HOME="C:/x"` builds the layer on Linux. `XdgBase` takes only an absolute POSIX path (`AbsolutePosixPath`) for both its variable and `HOME`, as the spec and `systemd-path` do, so the same `HOME` is absent to `XdgBase`. Both schemas are built from the same two patterns (test/Xdg.test.ts "keeps an absolute HOME"; test/XdgBase.test.ts).
- **systemd-path oracle** — `XdgBase` matches `systemd-path` on every recorded case except the documented `passwd-fallback` rows, where `systemd-path` reads the user database and `XdgBase` answers none (test/XdgBase.test.ts).

## Provenance

Ported from upstream `@effected/xdg` (MIT, C. Spencer Beggs) through the effected port, then promoted from the scratchpad into this workspace package by `goals/effected-promotion` (wave 4, PR 4-X). The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. Schema identities moved from `@beep/scratchpad/effected/xdg/*` to `@beep/xdg/*`.

### Attribution

- Upstream package: `@effected/xdg` 0.9.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)
- Vendored-engine notices: none found in source headers.

## License

[MIT](LICENSE)

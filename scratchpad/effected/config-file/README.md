# config-file (lab port of @effected/config-file)

Composable config file loading for Effect. Declare a resolver chain — an explicit path, an upward walk from the cwd, the workspace or git root, `/etc` — decode every discovered file through an Effect `Schema`, and combine the results with a merge strategy. JSON, JSONC, YAML and TOML all decode with no extra install. Codecs, resolvers and merge strategies are pluggable seams, and failures arrive as tagged errors carrying structured payloads rather than prose, so "no config anywhere" is routable separately from "the config I found is broken".

## Why @effected/config-file

Config loading is where a well-typed application usually gives up: a library finds a file, parses it, validates it, and reports every one of those distinct failures as the same opaque error with a `reason` string. This package refuses that. Discovery, reading, parsing, validation and persistence each fail with their own tagged error, and each carries its cause structurally — a `ConfigValidationError` hands you the schema issue tree, not `String(ParseError)`. Resolver requirements flow into the layer's type rather than being cast away, the merge step reports every source that contributed rather than only the first, and a loaded document can be handed to `Config` accessors as a v4 `ConfigProvider` layered beneath the environment.

## Quick start

Declare a schema, mint a service class for it with `ConfigFile.Service`, and build its live layer with `ConfigFile.layer`. The platform layers are provided once, at the edge:

```ts
import { ConfigFile } from "@beep/scratchpad/effected/config-file/ConfigFile";
import { ConfigResolver } from "@beep/scratchpad/effected/config-file/ConfigResolver";
import { JsonCodec } from "@beep/scratchpad/effected/config-file/JsonCodec";
import { MergeStrategy } from "@beep/scratchpad/effected/config-file/MergeStrategy";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

class AppShape extends S.Class<AppShape>("AppShape")({
  port: S.Finite,
  host: S.String,
}) {}

class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("app/Config") {}

const AppConfigLive = ConfigFile.layer(AppConfig, {
  schema: AppShape,
  codec: JsonCodec,
  resolvers: [ConfigResolver.upwardWalk({ filename: ".apprc" })],
  strategy: MergeStrategy.firstMatch<AppShape>(),
});

const program = Effect.gen(function* () {
  const config = yield* AppConfig;
  return yield* config.load;
});

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

// With `.apprc` containing { "port": 3000, "host": "localhost" }:
Effect.runPromise(program.pipe(Effect.provide(AppConfigLive), Effect.provide(PlatformLive))).then((config) => {
  console.log(`${config.port} ${config.host}`) // 3000 localhost
});
```

`ConfigFile.layer` is a layer-returning *function*, not a layer: calling it twice builds two independent service instances. Bind its result to a const, as above, and provide that const.

Resolvers are consulted in priority order, highest first. `MergeStrategy.firstMatch` takes the winner; `MergeStrategy.layeredMerge` deep-merges every source that matched, with higher-priority keys overwriting lower ones:

```ts
import { ConfigFile } from "@beep/scratchpad/effected/config-file/ConfigFile";
import { ConfigResolver } from "@beep/scratchpad/effected/config-file/ConfigResolver";
import { MergeStrategy } from "@beep/scratchpad/effected/config-file/MergeStrategy";
import { YamlCodec } from "@beep/scratchpad/effected/config-file/YamlCodec";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

class Settings extends S.Class<Settings>("Settings")({ port: S.Finite }) {}
class SettingsConfig extends ConfigFile.Service<SettingsConfig, Settings>()("app/Settings") {}

export const SettingsLive = ConfigFile.layer(SettingsConfig, {
  schema: Settings,
  codec: YamlCodec,
  resolvers: [
    ConfigResolver.upwardWalk({ filename: ".apprc.yaml" }),
    ConfigResolver.workspaceRoot({ filename: ".apprc.yaml" }),
    ConfigResolver.systemEtc({ app: "myapp", filename: "config.yaml" }),
  ],
  strategy: MergeStrategy.layeredMerge<Settings>(),
});
console.log(Layer.isLayer(SettingsLive)) // true
```

## Reading one known path

Not every caller has a config file — some just have one path a caller already vouched for, such as a CLI's `--config` flag. `ConfigFile.read` is the one-shot escape from the service, the layer and the resolver chain: read, decode and validate a single path, with the schema and codec named per call rather than bound to a service class:

```ts
import { ConfigFile } from "@beep/scratchpad/effected/config-file/ConfigFile";
import { JsonCodec } from "@beep/scratchpad/effected/config-file/JsonCodec";
import { NodeFileSystem } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

class MyConfig extends S.Class<MyConfig>("MyConfig")({ port: S.Finite }) {}

const program = ConfigFile.read("./app.config.json", { schema: MyConfig, codec: JsonCodec });

// With `app.config.json` containing { "port": 3000 }:
Effect.runPromise(program.pipe(Effect.provide(NodeFileSystem.layer))).then((config) => {
  console.log(config.port) // 3000
});
```

It is deliberately read-only and discovery-free — no resolver chain, no `save`/`update`. Reach for `ConfigFile.layer` the moment either is wanted.

## Rejecting keys the schema does not know

Effect's decoder ignores unknown keys by default, which for a config loader means a typo'd section is dropped in silence. The user gets no error, the setting they wrote has no effect, and nothing in the run says why. `parseOptions` threads decode options into every decode the loader performs, on `ConfigFile.layer` and `ConfigFile.read` alike:

```ts
import { ConfigFile } from "@beep/scratchpad/effected/config-file/ConfigFile";
import { ConfigResolver } from "@beep/scratchpad/effected/config-file/ConfigResolver";
import { JsonCodec } from "@beep/scratchpad/effected/config-file/JsonCodec";
import { MergeStrategy } from "@beep/scratchpad/effected/config-file/MergeStrategy";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

class Settings extends S.Class<Settings>("Settings")({ port: S.Finite }) {}
class SettingsConfig extends ConfigFile.Service<SettingsConfig, Settings>()("app/Settings") {}

export const SettingsLive = ConfigFile.layer(SettingsConfig, {
  schema: Settings,
  codec: JsonCodec,
  resolvers: [ConfigResolver.upwardWalk({ filename: ".apprc" })],
  strategy: MergeStrategy.firstMatch<Settings>(),
  parseOptions: { onExcessProperty: "error", errors: "all" },
});
// A file carrying `{ "port": 3000, "prot": 3001 }` now fails with a
// ConfigValidationError whose issue tree names the offending path.
console.log(Layer.isLayer(SettingsLive)) // true
```

The `validate` option cannot stand in for this: it runs on the decoded value, by which point the excess keys are already gone. Pair `onExcessProperty: "error"` with `errors: "all"` — the decoder reports only the first problem otherwise, so a file with three typos costs the user three fix-and-rerun cycles. The extra work happens only on a document that is already failing.

A schema that deliberately admits a pass-through section keeps working under `"error"` — but know why, because the shape suggests the opposite: a `Schema.StructWithRest` rest **switches excess checking off for that struct entirely**, not merely for the keys the rest covers. Structs without a rest stay strict independently, so strictness is decided per level rather than per key. Omitting `parseOptions` changes nothing, which makes turning this on a per-loader decision rather than a migration.

## Errors

Every failure is a tagged error you route on with `Effect.catchTag`. The tags exist so that recovery can differ:

| Tag | Means | Recovery |
| --- | --- | --- |
| `ConfigFileNotFoundError` | The resolver chain matched nothing. Carries `searched`, the resolver names probed, and `candidates`, the paths they actually checked on disk. | Fall back to defaults — the one failure that is often not an error. `loadOrDefault` handles it for you. |
| `ConfigFileReadError` | A file was found but could not be read. Carries `path` and the structural `cause`. | Usually fatal: the file exists and the process cannot read it. Check permissions. |
| `ConfigFileWriteError` | A file could not be written. Carries `path` and the structural `cause`. | Retry elsewhere, or surface to the user. |
| `ConfigDefaultPathMissingError` | `save` or `update` was called on a service configured without a `defaultPath`. | A wiring bug, not a data condition. Fix the layer, or call `write` with an explicit path. |
| `ConfigValidationError` | The document did not satisfy the schema, or a caller-supplied `validate` rejected it. Carries the structured `issue` tree and an optional `path`. | Report the issue; do not run on config you could not validate. |
| `ConfigCodecError` | The codec could not parse or stringify. Carries `codec`, `operation` and the structural `cause`. | The file is corrupt. Report the path and the cause. |
| `ConfigMigrationError` | A versioned migration failed. Carries `version`, `name`, `phase` and the structural `cause`. | Report which step failed; the config on disk is left untouched. |
| `ConfigEncryptionError` | An encrypt, decrypt, key-derivation or base64 step failed. Carries `phase` and the structural `cause`. | A wrong passphrase and a corrupt envelope both land here; inspect `phase`. |

`ConfigLoadError`, `ConfigReadError`, `ConfigEncodeError`, `ConfigWriteError`, `ConfigSaveError` and `ConfigUpdateError` are exported unions naming exactly the failures each method can produce — `ConfigEncodeError` is `ConfigWriteError` minus `ConfigFileWriteError`, because `encode` never touches the disk. Catching one tag narrows the union, leaving the rest to propagate:

```ts
import { ConfigFile, type ConfigFileShape } from "@beep/scratchpad/effected/config-file/ConfigFile";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

class AppShape extends S.Class<AppShape>("AppShape")({ port: S.Finite }) {}

const fallback = AppShape.make({ port: 3000 });

// `load` fails with ConfigLoadError. Handling the not-found tag leaves
// ConfigReadError — the file-is-broken failures, which we let propagate.
export const loadOrFallback = (config: ConfigFileShape<AppShape>) =>
  config.load.pipe(Effect.catchTag("ConfigFileNotFoundError", () => Effect.succeed(fallback)));

class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("app/Config") {}
const program = Effect.gen(function* () {
  const config = yield* AppConfig;
  return yield* loadOrFallback(config);
});
console.log(Effect.isEffect(program)) // true
```

## Codecs

Four codecs ship in the package, each a free-standing named export:

| Codec | Format | Engine |
| ----- | ------ | ------ |
| `JsonCodec` | JSON | the host `JSON` global, no parser at all |
| `JsoncCodec` | JSONC | `@effected/jsonc` |
| `YamlCodec` | YAML | `@effected/yaml` |
| `TomlCodec` | TOML | `@effected/toml` |

One install covers every format, and you still pay only for the parser you name. The codecs are free-standing exports rather than properties of a namespace object, so importing `TomlCodec` never references the YAML or JSONC bindings, their parsing engines are unreachable from your entrypoint and a bundler drops them. A JSON-only application ships no parser at all.

Codecs compose. `EncryptedCodec` wraps any codec with AES-GCM, and `ConfigMigration.make` wraps any codec so parsed content is brought up to the latest version. Each *widens* the error channel rather than flattening its failures into the inner codec's error:

```ts
import { ConfigMigration } from "@beep/scratchpad/effected/config-file/ConfigMigration";
import { EncryptedCodec, EncryptedCodecKey } from "@beep/scratchpad/effected/config-file/EncryptedCodec";
import { JsonCodec } from "@beep/scratchpad/effected/config-file/JsonCodec";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const migrating = ConfigMigration.make({
  codec: JsonCodec,
  migrations: [
    {
      version: 2,
      name: "add-port",
      up: (raw) =>
        S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(raw).pipe(
          Effect.map((doc) => ({ ...doc, port: 8080 })),
        ),
    },
  ],
});

// `parse` now fails with ConfigCodecError | ConfigMigrationError | ConfigEncryptionError.
export const secret = EncryptedCodec(migrating, EncryptedCodecKey.fromPassphrase("hunter2", new Uint8Array(16)));
console.log(Effect.isEffect(secret.parse("encrypted-config"))) // true
```

## Features

- `ConfigFile.Service` / `ConfigFile.layer` / `ConfigFile.testLayer` — a per-schema service class and its layers. `testLayer` seeds files into a temp directory and wires the *real* implementation over them, so tests exercise the actual pipeline rather than a stub that can drift from it.
- `parseOptions` — decode options threaded into every decode, on the layer and on `read`. `onExcessProperty: "error"` is the only way to report a typo'd section or a field the schema deliberately removed.
- `ConfigFile.read` — the one-shot escape from the service: read, decode and validate one explicit path, schema and codec named per call, with no resolver chain and no write path.
- `encode` / `write` / `save` / `update` — the write path. `encode(value, options?)` returns the serialized text a `write` would put on disk without writing, emitting an event or naming a path in its errors: the primitive behind a `--dry-run` flag. `write` takes an explicit path the caller vouches for; `save` and `update` resolve the layer's `defaultPath` and create its parent directory. `encode` and `write` accept `{ header }`, text prepended verbatim above the document with exactly one newline between — a `#:schema https://…` directive atop a TOML file, say. The caller owns its validity in the target format; JSON has no comment syntax, so a header on `JsonCodec` yields an unparseable file by construction.
- `ConfigResolver` — `explicitPath`, `staticDir`, `upwardWalk`, `workspaceRoot`, `gitRoot` and `systemEtc`. A resolver's error channel is `never` by contract: every filesystem failure becomes `Option.none()`, so one unreadable tier never aborts the chain.
- `MergeStrategy` — `firstMatch` and `layeredMerge`, combining discovered sources in priority order.
- `JsonCodec`, `JsoncCodec`, `YamlCodec`, `TomlCodec` — JSON, JSONC, YAML and TOML in the box, exported free-standing so an unused format's engine is tree-shaken away.
- `ConfigCodec` / `EncryptedCodec` / `ConfigMigration` — a pluggable codec seam, generic in its error type so decorators widen rather than flatten. `ConfigCodec` is the interface: bring your own format by satisfying it.
- `ConfigEvents` — an opt-in `PubSub` of `ConfigEvent`, honestly zero-cost when omitted: no `events` option means no context lookup at all. Failure events carry the structured typed error, never a `reason` string.
- `asConfigProvider` / `layerConfigProvider` — expose a loaded, validated document as a v4 `ConfigProvider`, layered beneath the ambient one so an environment variable overrides the file it was deployed with.

## License

[MIT](LICENSE)

## Port notes

### Attribution

- Upstream package: `@effected/config-file` 0.14.2
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab uses Effect Record, Array, Order and DateTime helpers instead of native runtime operations, including a recorded change to migration ordering around NaN. (scratchpad/test/config-file/ConfigMigration.test.ts:43; scratchpad/test/config-file/MergeStrategy.test.ts:132,171,209)
- **tagged-errors** — The lab uses schema-tagged version-access and short-ciphertext causes instead of native Error causes while preserving their messages and failure phases. (scratchpad/test/config-file/ConfigMigration.test.ts:111,295; scratchpad/test/config-file/EncryptedCodec.test.ts:72,83)
- **schema-first** — The lab uses schema JSON boundaries and schema-derived error guards, changing native JSON causes and rejecting top-level undefined serialization. (scratchpad/test/config-file/JsonCodec.test.ts:28,40; scratchpad/test/config-file/JsoncCodec.test.ts:59; scratchpad/test/config-file/ConfigCodecPath.test.ts:53; scratchpad/test/config-file/EncryptedCodec.test.ts:133; scratchpad/test/config-file/ConfigMigration.test.ts:123)
- **numeric-domains** — The lab gives numeric test fixtures and examples finite domains instead of Schema.Number while retaining the upstream numeric domain for migration errors. (scratchpad/test/config-file/ConfigFile.test.ts:18; scratchpad/test/config-file/ConfigFileEncode.test.ts:35; scratchpad/test/config-file/ConfigProvider.test.ts:18; scratchpad/test/config-file/MergeStrategy.test.ts:152,184)
- **type-safety** — The lab replaces unsafe casts with typed unions, nonempty-array and value guards, routing intentional wrong-input tests through the sanctioned helper. (scratchpad/test/config-file/ConfigFileEncode.test.ts:103; scratchpad/test/config-file/ConfigEvent.test.ts:310; scratchpad/test/config-file/ConfigMigration.test.ts:194; scratchpad/test/config-file/MergeStrategy.test.ts:158,182)
- **tsgo-diagnostics** — The lab adds pipeable overloads, schema .make construction, deterministic test keys and a diagnostic-compatible migration version schema to the upstream API shapes. (module suite scratchpad/test/config-file/**)
- **effect-first** — The lab wraps reusable generators with Effect.fn or Effect.fnUntraced and uses direct Effect helpers instead of the upstream callback shapes. (module suite scratchpad/test/config-file/**)
- **effect-imports** — The lab source and tests use dedicated effect/* imports and canonical aliases instead of the upstream root barrel imports. (module suite scratchpad/test/config-file/**)
- **identity-annotations** — The lab uses composed @beep/identity schema and service identities plus annotations instead of upstream short identities and bare fields. (module suite scratchpad/test/config-file/**)
- **upstream-bug** — The lab preserves valid own constructor/prototype fields that upstream deepMerge deletes, maintaining schema validity and source priority. (scratchpad/test/config-file/MergeStrategy.test.ts:48,71)
- **upstream-bug** — The lab checks ownership before reading merge fields, preventing inherited accessor calls that can make the upstream merge throw. (scratchpad/test/config-file/MergeStrategy.test.ts:95)

### Dependency backlog

None.

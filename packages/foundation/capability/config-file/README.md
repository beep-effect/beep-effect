# @beep/config-file

Composable config file loading for Effect. Declare a resolver chain — an explicit path, an upward walk from the cwd, the workspace or git root, `/etc` — decode every discovered file through an Effect `Schema`, and combine the results with a merge strategy. JSON, JSONC, YAML and TOML all decode with no extra install. Codecs, resolvers and merge strategies are pluggable seams, and failures arrive as tagged errors carrying structured payloads rather than prose, so "no config anywhere" is routable separately from "the config I found is broken".

## Why this package

Config loading is where a well-typed application usually gives up: a library finds a file, parses it, validates it, and reports every one of those distinct failures as the same opaque error with a `reason` string. This package refuses that. Discovery, reading, parsing, validation and persistence each fail with their own tagged error, and each carries its cause structurally — a `ConfigValidationError` hands you the schema issue tree, not `String(ParseError)`. Resolver requirements flow into the layer's type rather than being cast away, the merge step reports every source that contributed rather than only the first, and a loaded document can be handed to `Config` accessors as a v4 `ConfigProvider` layered beneath the environment.

## Usage

### Quick start

Declare a schema, mint a service class for it with `ConfigFile.Service`, and build its live layer with `ConfigFile.layer`. The platform layers are provided once, at the edge:

```ts
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
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
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { YamlCodec } from "@beep/config-file/YamlCodec";
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

### Reading one known path

Not every caller has a config file — some just have one path a caller already vouched for, such as a CLI's `--config` flag. `ConfigFile.read` is the one-shot escape from the service, the layer and the resolver chain: read, decode and validate a single path, with the schema and codec named per call rather than bound to a service class:

```ts
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { JsonCodec } from "@beep/config-file/JsonCodec";
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

### Rejecting keys the schema does not know

Effect's decoder ignores unknown keys by default, which for a config loader means a typo'd section is dropped in silence. The user gets no error, the setting they wrote has no effect, and nothing in the run says why. `parseOptions` threads decode options into every decode the loader performs, on `ConfigFile.layer` and `ConfigFile.read` alike:

```ts
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
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

### Errors

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
import { ConfigFile, type ConfigFileShape } from "@beep/config-file/ConfigFile";
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

### Codecs

Four codecs ship in the package, each a free-standing named export:

| Codec | Format | Engine |
| ----- | ------ | ------ |
| `JsonCodec` | JSON | the host `JSON` global, no parser at all |
| `JsoncCodec` | JSONC | `@beep/jsonc` |
| `YamlCodec` | YAML | `@beep/yaml` |
| `TomlCodec` | TOML | `@beep/toml` |

One install covers every format, and you still pay only for the parser you name. The codecs are free-standing exports rather than properties of a namespace object, so importing `TomlCodec` never references the YAML or JSONC bindings, their parsing engines are unreachable from your entrypoint and a bundler drops them. A JSON-only application ships no parser at all.

Codecs compose. `EncryptedCodec` wraps any codec with AES-GCM, and `ConfigMigration.make` wraps any codec so parsed content is brought up to the latest version. Each *widens* the error channel rather than flattening its failures into the inner codec's error:

```ts
import { ConfigMigration } from "@beep/config-file/ConfigMigration";
import { EncryptedCodec, EncryptedCodecKey } from "@beep/config-file/EncryptedCodec";
import { JsonCodec } from "@beep/config-file/JsonCodec";
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

## Named importers

The capability gate for `foundation/capability` requires at least two importing packages:

- `@beep/repo-docgen`: `Configuration.ts` reads `package.json` and `docgen.json` through `ConfigFile.read` with `JsoncCodec` (it dropped `jsonc-parser`).
- `@beep/repo-cli`: `ModelsManifestStore.load` reads the operator models manifest through `ConfigFile.read` with `YamlCodec`; the manifest writers keep the npm `yaml` stringifier and the atomic rename.

The scratchpad `xdg` module imports it too, until xdg is promoted in wave 4.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/config-file

# from packages/foundation/capability/config-file
bun run check
bun run lint
bun run test
bun run test:integration
bun run docgen
```

Tests live in `test/` and import package source through `@beep/config-file/<Module>` aliases; `test/helpers.ts` builds the `@beep/memfs` platforms, and the integration suite in `test/integration` runs on memfs too. `test/conformance/codec-corpus.test.ts` compares the four codecs' parse results with `jsonc-parser`, `yaml` and `smol-toml` over frozen copies of repo config files in `test/fixtures/codec-corpus` (loaded through `test/support/codec-corpus.ts`); `goals/effected-promotion/ops/config-file-codec-differential.ts` runs the same comparison over every tracked file. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Port notes

### Added exports

- `ConfigReadSchema<A, I>`: the schema bound of `ConfigFile.read`, so an `S.Opaque` schema can be read (it is not assignable to `S.Codec<Self, I>`).
- `ConfigMatch`, `ConfigProbe`, `ConfigSourceRef` and `ConfigEvent` are exported from the root barrel as schema values, not only as types.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab uses Effect Record, Array, Order and DateTime helpers instead of native runtime operations, including a recorded change to migration ordering around NaN. (test/ConfigMigration.test.ts:43; test/MergeStrategy.test.ts:132,171,209)
- **tagged-errors** — The lab uses schema-tagged version-access and short-ciphertext causes instead of native Error causes while preserving their messages and failure phases. (test/ConfigMigration.test.ts:111,295; test/EncryptedCodec.test.ts:72,83)
- **schema-first** — The lab uses schema JSON boundaries and schema-derived error guards, changing native JSON causes and rejecting top-level undefined serialization. (test/JsonCodec.test.ts:28,40; test/JsoncCodec.test.ts:59; test/ConfigCodecPath.test.ts:53; test/EncryptedCodec.test.ts:133; test/ConfigMigration.test.ts:123)
- **numeric-domains** — The lab gives numeric test fixtures and examples finite domains instead of Schema.Number while retaining the upstream numeric domain for migration errors. (test/ConfigFile.test.ts:18; test/ConfigFileEncode.test.ts:35; test/ConfigProvider.test.ts:18; test/MergeStrategy.test.ts:152,184)
- **type-safety** — The lab replaces unsafe casts with typed unions, nonempty-array and value guards, routing intentional wrong-input tests through the sanctioned helper. (test/ConfigFileEncode.test.ts:103; test/ConfigEvent.test.ts:310; test/ConfigMigration.test.ts:194; test/MergeStrategy.test.ts:158,182)
- **tsgo-diagnostics** — The lab adds pipeable overloads, schema .make construction, deterministic test keys and a diagnostic-compatible migration version schema to the upstream API shapes. (module suite test/**)
- **effect-first** — The lab wraps reusable generators with Effect.fn or Effect.fnUntraced and uses direct Effect helpers instead of the upstream callback shapes. (module suite test/**)
- **effect-imports** — The lab source and tests use dedicated effect/* imports and canonical aliases instead of the upstream root barrel imports. (module suite test/**)
- **identity-annotations** — The lab uses composed @beep/identity schema and service identities plus annotations instead of upstream short identities and bare fields. (module suite test/**)
- **upstream-bug** — The lab preserves valid own constructor/prototype fields that upstream deepMerge deletes, maintaining schema validity and source priority. (test/MergeStrategy.test.ts:48,71)
- **upstream-bug** — The lab checks ownership before reading merge fields, preventing inherited accessor calls that can make the upstream merge throw. (test/MergeStrategy.test.ts:95)
- **upstream-bug** — Lab merges only compatible plain records and retains atomic class identity and private state, whereas upstream manufactures class instances without private-field brands (test/MergeStrategy.test.ts:95,254,272; test/MergeStrategy.property.test.ts:50; test/internal/deepMerge.property.test.ts:27,120).
- **upstream-bug** — Lab preserves enumerable symbol fields and schema validity during merging, whereas upstream drops those fields through string-only enumeration (test/MergeStrategy.test.ts:145,187; test/internal/deepMerge.property.test.ts:52,100).
- **upstream-bug** — The lab rejects schema-invalid merged configurations before success events, whereas upstream returns them successfully. (test/ConfigFile.test.ts:231,256,279)
- **upstream-bug** — The lab terminates compatible cyclic record merges by reusing active-pair results, whereas upstream exhausts the stack. (test/internal/deepMerge.property.test.ts:27,48; test/MergeStrategy.test.ts:29; test/ConfigFile.test.ts:313)

### Promotion shifts (wave 3-3)

Each is pinned by a test (`goals/effected-promotion` SPEC W3-e and W3-h (3-3)):

- `ConfigMigrationError`'s `name` payload field is now `migration`, so it no longer shadows `Error.name`.
- `ConfigResolver.systemEtc` reads the `HostProcessPlatform` reference from `@beep/utils` instead of `globalThis.process.platform`; provide the reference to pin a platform in tests.
- `ConfigMatch`, `ConfigProbe`, `ConfigSourceRef`, `ConfigEvent`, `ConfigEncodeOptions` and `LayerConfigProviderOptions` are branded `S.Opaque` schemas. Construct values with `X.make`; option parameters accept `typeof X.Encoded`, so object literals still work. `ConfigEvent` values are no longer class instances, so `instanceof` no longer applies. A hand-written resolver builds its match with `ConfigMatch.make`.
- `ConfigEventsShape` is the `ConfigEvents` service type.
- `EncryptedCodec` derives its key once per passphrase key through the internal `PassphraseKeyDerivation` reference; the codec's requirements stay `never`.
- The codec spans are named `EncryptedCodec.parse`, `EncryptedCodec.stringify` and `ConfigMigration.parse`.
- `EncryptedCodec` keeps `globalThis.crypto.subtle` for PBKDF2 and AES-GCM, which the effect 4.0 crypto service did not provide (effect 4.1.0 adds them as `effect/crypto/Kdf` and `effect/crypto/Aead`). It is used as an algorithm primitive inside the codec and not re-exposed.

### Dependency backlog

None.

## Provenance

Ported from upstream `@effected/config-file` (MIT, C. Spencer Beggs) through the effected port, then promoted from the scratchpad into this workspace package by `goals/effected-promotion` (wave 3, sub-wave 3-3). The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. Schema identities moved from `@beep/scratchpad/effected/config-file/*` to `@beep/config-file/*`.

### Attribution

- Upstream package: `@effected/config-file` 0.14.2
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`$HOME/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)
- Vendored-engine notices: none found in source headers.

## License

[MIT](LICENSE)

/**
 * The bridge from a loaded config document to Effect's `ConfigProvider`, so `Config` accessors can
 * read the file beneath the ambient provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ConfigFileId } from "@beep/identity/packages";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Layer from "effect/Layer";
import type { ConfigFileShape, ConfigLoadError } from "./ConfigFile.ts";

const $I = $ConfigFileId.create("ConfigProvider");

/**
 * Expose a loaded, merged, schema-validated document as a `ConfigProvider`,
 * so it can be read through `Config.String("port")` and layered beneath other
 * providers.
 *
 * **Gotchas**
 *
 * Strictly additive, and deliberately in its own module so it never becomes a
 * required import. The schema-validated whole-document
 * {@link ConfigFileShape.load} remains the primary API: `Config` has no
 * whole-document story, and this function is the bridge, not a replacement.
 *
 * Three properties, in order of how easy they are to lose:
 *
 * 1. **A missing file is a failure, not an empty provider.** The
 *    {@link ConfigFileNotFoundError} propagates. Handing back an empty provider
 *    would silently turn every subsequent `Config` read into "not found".
 * 2. **Nested keys are structural, not dotted.** `fromUnknown` descends one path
 *    segment at a time, so `{ db: { host } }` is reached with
 *    `Config.nested(Config.String("host"), "db")` — never `Config.String("db.host")`,
 *    which is looked up as a single literal key and fails. No flattening happens
 *    here, because none is needed.
 * 3. **The decoded value is handed over as-is.** `fromUnknown` descends with
 *    `Object.hasOwn`, and a `Schema.Class` instance carries its fields as own
 *    properties, so no encoding step is required. The corollary: leaves are read
 *    in their **decoded** form, and a field whose decoded type is not a JSON
 *    primitive is exposed **structurally**, not turned into a value — with no
 *    two decoded types exposed the same way. A `Date` has no own enumerable
 *    properties, so it descends as an empty record and any nested read finds
 *    nothing. Such a field reports the same `ConfigError` as a missing key —
 *    `Expected string, got undefined` — so a `Config` read of a present `Date`
 *    field looks exactly like a typo in the key name. An `Option.some`
 *    descends as a record carrying Effect's internal `value` own-property, so
 *    `Config.nested(Config.String("value"), "field")` happens to read the
 *    wrapped value straight through — an internal representation, not a
 *    supported spelling. An `Option.none` has no own keys and so reads as
 *    absent, making `Some` and `None` asymmetric. None of this is a supported
 *    way to read such a field: `load` is the API that was designed to carry it.
 *
 * Descent by own property is also why a prototype getter and `__proto__` are
 * both unreachable through the returned provider.
 *
 * **Example** (Use file configuration as an environment fallback)
 *
 * ```ts
 * import { ConfigFile } from "@beep/config-file/ConfigFile";
 * import { asConfigProvider } from "@beep/config-file/ConfigProvider";
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 *
 * class AppConfig extends ConfigFile.Service<AppConfig, { readonly port: string }>()("app/Config") {}
 * const program = Effect.gen(function* () {
 *   const cfg = yield* AppConfig;
 *   const fileProvider = yield* asConfigProvider(cfg);
 *   return ConfigProvider.orElse(ConfigProvider.fromEnv(), fileProvider);
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category adapters
 * @since 0.0.0
 */
export const asConfigProvider = <A>(
  service: ConfigFileShape<A>
): Effect.Effect<ConfigProvider.ConfigProvider, ConfigLoadError> =>
  Effect.map(service.load, (value) => ConfigProvider.fromUnknown(value));

/**
 * **Example** (Make the file the primary source)
 *
 * ```ts
 * import { LayerConfigProviderOptions } from "@beep/config-file/ConfigProvider";
 *
 * const options = LayerConfigProviderOptions.make({ asPrimary: true });
 * console.log(options.asPrimary) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class LayerConfigProviderOptions extends S.Opaque<
  LayerConfigProviderOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    /**
     * Make the config file the primary source, consulted before the ambient
     * provider rather than after it.
     *
     * **Details**
     *
     * Defaults to `false`, which is the precedence almost every application
     * wants: an environment variable overrides the file it was deployed with.
     *
     * @since 0.0.0
     */
    asPrimary: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LayerConfigProviderOptions.asPrimary", {
        description: "Make the config file the primary source, consulted before the ambient provider.",
      })
    ),
  }).pipe($I.annoteSchema("LayerConfigProviderOptions", { description: "Options for layerConfigProvider." }))
) {}

/**
 * Install a loaded config document as a fallback beneath the **ambient**
 * `ConfigProvider`, so `Config` accessors read env first and the file second.
 *
 * **Details**
 *
 * This layer composes beneath the **ambient** `ConfigProvider` (a
 * `Context.Reference`), so a consumer supplying `ConfigProvider.layer(...)` controls
 * precedence explicitly: whatever that provider resolves wins, and the config
 * file supplies whatever it lacks. That reference's own default is
 * `ConfigProvider.fromEnv()`, which is what most applications want; this
 * module composes beneath whichever provider is ambient rather than pinning
 * that default itself, so verify the precedence you need with the provider
 * you actually wire in.
 *
 * The load happens when the layer is built, and a {@link ConfigFileNotFoundError}
 * surfaces in the layer's error channel rather than degrading to an empty
 * provider — the same honesty {@link asConfigProvider} keeps.
 *
 * **Example** (Provide a config service to the fallback provider layer)
 *
 * ```ts
 * import { ConfigFile } from "@beep/config-file/ConfigFile";
 * import { layerConfigProvider } from "@beep/config-file/ConfigProvider";
 * import { JsonCodec } from "@beep/config-file/JsonCodec";
 * import { MergeStrategy } from "@beep/config-file/MergeStrategy";
 * import * as Layer from "effect/Layer";
 * import * as S from "effect/Schema";
 *
 * const AppShape = S.Struct({ port: S.String });
 * class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("app/Config") {}
 * const AppConfigLive = ConfigFile.layer(AppConfig, { schema: AppShape, codec: JsonCodec, resolvers: [], strategy: MergeStrategy.firstMatch() });
 * const stack = layerConfigProvider(AppConfig).pipe(Layer.provide(AppConfigLive));
 * console.log(Layer.isLayer(stack)) // true
 * ```
 *
 * @public
 * @category layers
 * @since 0.0.0
 */
export const layerConfigProvider: {
  (
    options?: typeof LayerConfigProviderOptions.Encoded
  ): <Self, A>(tag: Context.Key<Self, ConfigFileShape<A>>) => Layer.Layer<never, ConfigLoadError, Self>;
  <Self, A>(
    tag: Context.Key<Self, ConfigFileShape<A>>,
    options?: typeof LayerConfigProviderOptions.Encoded
  ): Layer.Layer<never, ConfigLoadError, Self>;
} = dual(
  (args) => Context.isKey(args[0]),
  <Self, A>(
    tag: Context.Key<Self, ConfigFileShape<A>>,
    options?: typeof LayerConfigProviderOptions.Encoded
  ): Layer.Layer<never, ConfigLoadError, Self> => {
    const provider = Effect.flatMap(tag, asConfigProvider);
    return ConfigProvider.layerAdd(provider, { asPrimary: options?.asPrimary });
  }
);

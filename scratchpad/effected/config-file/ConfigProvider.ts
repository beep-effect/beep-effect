import type * as Layer from "effect/Layer";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import type { ConfigFileShape, ConfigLoadError } from "./ConfigFile.ts";

/**
 * Expose a loaded, merged, schema-validated document as a `ConfigProvider`,
 * so it can be read through `Config.String("port")` and layered beneath other
 * providers.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { asConfigProvider } from "./index.ts";
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 * 	const cfg = yield* AppConfig; // a ConfigFile.Service class
 * 	const fileProvider = yield* asConfigProvider(cfg);
 * 	return ConfigProvider.orElse(ConfigProvider.fromEnv(), fileProvider);
 * });
 * ```
 *
 * @public
 */
export const asConfigProvider = <A>(
	service: ConfigFileShape<A>,
): Effect.Effect<ConfigProvider.ConfigProvider, ConfigLoadError> =>
	Effect.map(service.load, (value) => ConfigProvider.fromUnknown(value));

/**
 * Options for {@link layerConfigProvider}.
 *
 * @public
 */
export interface LayerConfigProviderOptions {
	/**
	 * Make the config file the primary source, consulted before the ambient
	 * provider rather than after it.
	 *
	 * @remarks
	 * Defaults to `false`, which is the precedence almost every application
	 * wants: an environment variable overrides the file it was deployed with.
	 */
	readonly asPrimary?: boolean;
}

/**
 * Install a loaded config document as a fallback beneath the **ambient**
 * `ConfigProvider`, so `Config` accessors read env first and the file second.
 *
 * @remarks
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
 * @example
 * ```ts
 * const stack = layerConfigProvider(AppConfig).pipe(Layer.provide(AppConfigLive));
 * ```
 *
 * @public
 */
export const layerConfigProvider: {
	(options?: LayerConfigProviderOptions): <Self, A>(tag: Context.Key<Self, ConfigFileShape<A>>) => Layer.Layer<never, ConfigLoadError, Self>;
	<Self, A>(tag: Context.Key<Self, ConfigFileShape<A>>, options?: LayerConfigProviderOptions): Layer.Layer<never, ConfigLoadError, Self>;
} = dual((args) => Context.isKey(args[0]), <Self, A>(
	tag: Context.Key<Self, ConfigFileShape<A>>,
	options?: LayerConfigProviderOptions,
): Layer.Layer<never, ConfigLoadError, Self> => {
	// A `Context.Key` *is* an `Effect<Shape, never, Identifier>`, so the service
	// lookup needs no `asEffect`, and `Self` flows straight into the layer's `R`.
	const provider = Effect.flatMap(tag, asConfigProvider);
	// `layerAdd`'s own options type is `{ asPrimary?: boolean | undefined }`, so
	// forwarding `options?.asPrimary` directly — rather than branching on it — is
	// not the "explicit undefined" pitfall a `Schema`-validated constructor would
	// have: `layerAdd` reads the field with `?.`, so an explicit `undefined` and
	// an omitted key are identical here.
	return ConfigProvider.layerAdd(provider, { asPrimary: options?.asPrimary });
});

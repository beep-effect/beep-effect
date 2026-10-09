// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Config, ConfigProvider, Effect, Layer, Path, Schema } from "effect";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { asConfigProvider, layerConfigProvider } from "../../effected/config-file/ConfigProvider.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

class DbShape extends Schema.Class<DbShape>("DbShape")({ host: Schema.String }) {}
class AppShape extends Schema.Class<AppShape>("AppShape")({
	port: Schema.Finite,
	host: Schema.String,
	db: DbShape,
}) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/ProviderConfig") {}

const layerFor = (files: Record<string, string>) =>
	ConfigFile.layer(AppConfig, {
		schema: AppShape,
		codec: JsonCodec,
		resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
		strategy: MergeStrategy.firstMatch<AppShape>(),
	}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer)));

const document = `{"port":8080,"host":"from-file","db":{"host":"db-from-file"}}`;
const found = layerFor({ "/app/.apprc": document });
const missing = layerFor({});

describe("asConfigProvider", () => {
	it.effect("exposes a loaded document through Config accessors", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const provider = yield* asConfigProvider(cfg);
			const port = yield* Effect.provide(Config.Number("port"), ConfigProvider.layer(provider));
			assert.strictEqual(port, 8080);
		}).pipe(Effect.provide(found)),
	);

	it.effect("reads nested keys structurally, through Config.nested rather than a dotted key", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const provider = yield* asConfigProvider(cfg);
			const layer = ConfigProvider.layer(provider);

			const host = yield* Effect.provide(Config.nested(Config.String("host"), "db"), layer);
			assert.strictEqual(host, "db-from-file");

			// The dotted spelling is NOT a synonym: `fromUnknown` descends segment by
			// segment, so "db.host" is looked up as a single literal key.
			const dotted = yield* Effect.flip(Effect.provide(Config.String("db.host"), layer));
			assert.strictEqual(dotted._tag, "ConfigError");
		}).pipe(Effect.provide(found)),
	);

	it.effect("composes under an env provider via orElse — env wins, file fills the gaps", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const fileProvider = yield* asConfigProvider(cfg);
			const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
			// `orElse` takes a provider, not a thunk: v4 dropped v3's `LazyArg`.
			const composed = ConfigProvider.orElse(envProvider, fileProvider);
			const layer = ConfigProvider.layer(composed);

			const host = yield* Effect.provide(Config.String("host"), layer);
			const port = yield* Effect.provide(Config.Number("port"), layer);
			assert.strictEqual(host, "from-env");
			assert.strictEqual(port, 8080);
		}).pipe(Effect.provide(found)),
	);

	it.effect("propagates ConfigFileNotFoundError rather than yielding an empty provider", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(asConfigProvider(cfg));
			assert.strictEqual(error._tag, "ConfigFileNotFoundError");
		}).pipe(Effect.provide(missing)),
	);
});

describe("layerConfigProvider", () => {
	it.effect("installs the document as a fallback beneath the ambient provider", () =>
		Effect.gen(function* () {
			const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
			const stack = layerConfigProvider(AppConfig).pipe(
				Layer.provide(ConfigProvider.layer(envProvider)),
				Layer.provide(found),
			);

			const host = yield* Effect.provide(Config.String("host"), stack);
			const port = yield* Effect.provide(Config.Number("port"), stack);
			assert.strictEqual(host, "from-env");
			assert.strictEqual(port, 8080);
		}),
	);

	it.effect("asPrimary flips the precedence: the document wins over the ambient provider", () =>
		Effect.gen(function* () {
			const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
			const stack = layerConfigProvider(AppConfig, { asPrimary: true }).pipe(
				Layer.provide(ConfigProvider.layer(envProvider)),
				Layer.provide(found),
			);

			const host = yield* Effect.provide(Config.String("host"), stack);
			assert.strictEqual(host, "from-file");
		}),
	);

	it.effect("surfaces ConfigFileNotFoundError in the layer's error channel", () =>
		Effect.gen(function* () {
			const stack = layerConfigProvider(AppConfig).pipe(Layer.provide(missing));
			const error = yield* Effect.flip(Effect.provide(Config.String("host"), stack));
			assert.strictEqual(error._tag, "ConfigFileNotFoundError");
		}),
	);
});

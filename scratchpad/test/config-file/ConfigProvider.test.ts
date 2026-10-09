import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { ConfigLoadError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { asConfigProvider, layerConfigProvider } from "../../effected/config-file/ConfigProvider.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

class DbShape extends S.Class<DbShape>("DbShape")({ host: S.String }) {}
class AppShape extends S.Class<AppShape>("AppShape")({
	port: S.Finite,
	host: S.String,
	db: DbShape,
}) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/ProviderConfig") {}

class ProviderFailure extends Context.Service<ProviderFailure, ConfigLoadError>()(
	"@beep/scratchpad/test/config-file/ConfigProvider.test/ProviderFailure",
) {}

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
	it.layer(found, { timeout: "30 seconds" })((it) => {
		it.effect("exposes a loaded document through Config accessors", () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const provider = yield* asConfigProvider(cfg);
				const port = yield* Effect.provideService(Config.Number("port"), ConfigProvider.ConfigProvider, provider);
				assert.strictEqual(port, 8080);
			}),
		);
	});

	it.layer(found, { timeout: "30 seconds" })((it) => {
		it.effect("reads nested keys structurally, through Config.nested rather than a dotted key", () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const provider = yield* asConfigProvider(cfg);

				const host = yield* Effect.provideService(
					Config.nested(Config.String("host"), "db"),
					ConfigProvider.ConfigProvider,
					provider,
				);
				assert.strictEqual(host, "db-from-file");

				// The dotted spelling is NOT a synonym: `fromUnknown` descends segment by
				// segment, so "db.host" is looked up as a single literal key.
				const dotted = yield* Effect.flip(
					Effect.provideService(Config.String("db.host"), ConfigProvider.ConfigProvider, provider),
				);
				assert.strictEqual(dotted._tag, "ConfigError");
			}),
		);
	});

	it.layer(found, { timeout: "30 seconds" })((it) => {
		it.effect("composes under an env provider via orElse — env wins, file fills the gaps", () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const fileProvider = yield* asConfigProvider(cfg);
				const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
				// `orElse` takes a provider, not a thunk: v4 dropped v3's `LazyArg`.
				const composed = ConfigProvider.orElse(envProvider, fileProvider);

				const host = yield* Effect.provideService(Config.String("host"), ConfigProvider.ConfigProvider, composed);
				const port = yield* Effect.provideService(Config.Number("port"), ConfigProvider.ConfigProvider, composed);
				assert.strictEqual(host, "from-env");
				assert.strictEqual(port, 8080);
			}),
		);
	});

	it.layer(missing, { timeout: "30 seconds" })((it) => {
		it.effect("propagates ConfigFileNotFoundError rather than yielding an empty provider", () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const error = yield* Effect.flip(asConfigProvider(cfg));
				assert.strictEqual(error._tag, "ConfigFileNotFoundError");
			}),
		);
	});
});

describe("layerConfigProvider", () => {
	{
		const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
		const stack = layerConfigProvider(AppConfig).pipe(
			Layer.provide(ConfigProvider.layer(envProvider)),
			Layer.provide(found),
		);
		it.layer(stack, { timeout: "30 seconds" })((it) => {
			it.effect("installs the document as a fallback beneath the ambient provider", () =>
				Effect.gen(function* () {
					const host = yield* Config.String("host");
					const port = yield* Config.Number("port");
					assert.strictEqual(host, "from-env");
					assert.strictEqual(port, 8080);
				}),
			);
		});
	}

	{
		const envProvider = ConfigProvider.fromUnknown({ host: "from-env" });
		const stack = layerConfigProvider(AppConfig, { asPrimary: true }).pipe(
			Layer.provide(ConfigProvider.layer(envProvider)),
			Layer.provide(found),
		);
		it.layer(stack, { timeout: "30 seconds" })((it) => {
			it.effect("asPrimary flips the precedence: the document wins over the ambient provider", () =>
				Effect.gen(function* () {
					const host = yield* Config.String("host");
					assert.strictEqual(host, "from-file");
				}),
			);
		});
	}

	{
		const stack = layerConfigProvider(AppConfig).pipe(Layer.provide(missing));
		it.layer(Layer.effect(ProviderFailure, Layer.build(stack).pipe(Effect.flip)), { timeout: "30 seconds" })((it) => {
			it.effect("surfaces ConfigFileNotFoundError in the layer's error channel", () =>
				Effect.gen(function* () {
					const error = yield* ProviderFailure;
					assert.strictEqual(error._tag, "ConfigFileNotFoundError");
				}),
			);
		});
	}
});

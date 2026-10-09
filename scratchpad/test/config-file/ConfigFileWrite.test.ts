// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { MemoryFileSystemSeed } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import type { ConfigCodec as ConfigCodecShape } from "../../effected/config-file/ConfigCodec.ts";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import type { ConfigSaveError, ConfigUpdateError, ConfigWriteError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigDefaultPathMissingError, ConfigFile, ConfigFileWriteError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import type { RecordingFs } from "./helpers.ts";
import { hostileFs, recordingFs } from "./helpers.ts";

const JsonValue = S.fromJsonString(S.Unknown);

class AppShape extends S.Class<AppShape>("AppShape")({ port: S.Finite }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/WriteConfig") {}

const layerFor = (host: RecordingFs, defaultPath?: string, codec: ConfigCodecShape = JsonCodec) =>
	ConfigFile.layer(AppConfig, {
		schema: AppShape,
		codec,
		resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
		strategy: MergeStrategy.firstMatch<AppShape>(),
		...(defaultPath !== undefined && { defaultPath: Effect.succeed(defaultPath) }),
	}).pipe(Layer.provide(Layer.mergeAll(host.layer, Path.layer)));

describe("ConfigFile.write", () => {
	it.effect("encodes and writes to an explicit path without creating directories", () =>
		Effect.gen(function* () {
			// `write` trusts the caller's path, so the target directory must already exist.
			const host = recordingFs({ "/explicit": MemoryFileSystem.directory() });
			yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				yield* cfg.write(AppShape.make({ port: 9090 }), "/explicit/.apprc");
			}).pipe(Effect.provide(layerFor(host)));

			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/explicit/.apprc") as string)), { port: 9090 });
			// `write` never mkdirs — the documented distinction from `save`.
			assert.deepStrictEqual(host.mkdirs, []);
		}),
	);

	it.effect("fails with ConfigFileWriteError when the filesystem rejects the write", () =>
		Effect.gen(function* () {
			const error = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* Effect.flip(cfg.write(AppShape.make({ port: 1 }), "/ro/.apprc"));
			}).pipe(Effect.provide(layerFor(hostileFs())));

			assert.instanceOf(error, ConfigFileWriteError);
			assert.strictEqual((error as ConfigFileWriteError).path, "/ro/.apprc");
			// The filesystem failure survives structurally; v3 flattened it to String(e).
			const cause = (error as ConfigFileWriteError).cause;
			if (cause instanceof PlatformError.PlatformError && cause.reason._tag !== "BadArgument") {
				assert.strictEqual(cause.reason._tag, "Unknown");
				assert.strictEqual(cause.reason.pathOrDescriptor, "/ro/.apprc");
			} else {
				assert.fail(`expected the host's typed SystemError as the cause, got ${String(cause)}`);
			}
		}),
	);

	it.effect("fails with ConfigCodecError when the codec cannot stringify", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const brokenCodec: ConfigCodecShape = {
				name: "broken",
				parse: JsonCodec.parse,
				stringify: () =>
					Effect.fail(ConfigCodecError.make({ codec: "broken", operation: "stringify", cause: new Error("nope") })),
			};

			const error = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* Effect.flip(cfg.write(AppShape.make({ port: 1 }), "/x/.apprc"));
			}).pipe(Effect.provide(layerFor(host, undefined, brokenCodec)));

			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error._tag, "ConfigCodecError");
			// A failed stringify must not have written a partial file.
			assert.deepStrictEqual(host.volume.paths(), []);
		}),
	);
});

describe("ConfigFile.save", () => {
	it.effect("creates the parent directory, writes, and returns the path", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const written = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.save(AppShape.make({ port: 7070 }));
			}).pipe(Effect.provide(layerFor(host, "/home/u/.config/app/.apprc")));

			assert.strictEqual(written, "/home/u/.config/app/.apprc");
			assert.deepStrictEqual(host.mkdirs, ["/home/u/.config/app"]);
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/home/u/.config/app/.apprc") as string)), { port: 7070 });
		}),
	);

	it.effect("fails with ConfigDefaultPathMissingError when no defaultPath is configured", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const error = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* Effect.flip(cfg.save(AppShape.make({ port: 1 })));
			}).pipe(Effect.provide(layerFor(host)));

			assert.instanceOf(error, ConfigDefaultPathMissingError);
			assert.strictEqual(error._tag, "ConfigDefaultPathMissingError");
			// It is its own tag, not a ConfigFileWriteError carrying a fabricated `path`.
			assert.notInstanceOf(error, ConfigFileWriteError);
			assert.deepStrictEqual(host.mkdirs, []);
			assert.deepStrictEqual(host.volume.paths(), []);
		}),
	);

	it.effect("routes the missing-defaultPath failure by tag", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const label = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.save(AppShape.make({ port: 1 })).pipe(
					Effect.as("saved"),
					Effect.catchTags({
						ConfigDefaultPathMissingError: () => Effect.succeed("no-default-path"),
						ConfigFileWriteError: () => Effect.succeed("unwritable"),
						ConfigCodecError: () => Effect.succeed("bad-syntax"),
						ConfigValidationError: () => Effect.succeed("bad-shape"),
					}),
				);
			}).pipe(Effect.provide(layerFor(host)));

			assert.strictEqual(label, "no-default-path");
		}),
	);
});

describe("ConfigFile.update", () => {
	it.effect("loads, transforms, saves, and returns the updated value", () =>
		Effect.gen(function* () {
			const host = recordingFs({ "/app/.apprc": `{"port":1}` });
			const updated = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }));
			}).pipe(Effect.provide(layerFor(host, "/app/.apprc")));

			assert.strictEqual(updated.port, 2);
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/app/.apprc") as string)), { port: 2 });
		}),
	);

	it.effect("uses defaultValue when nothing is found, then saves it", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const updated = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }), AppShape.make({ port: 10 }));
			}).pipe(Effect.provide(layerFor(host, "/app/.apprc")));

			assert.strictEqual(updated.port, 11);
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/app/.apprc") as string)), { port: 11 });
		}),
	);

	it.effect("propagates ConfigFileNotFoundError when nothing is found and no defaultValue is given", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const error = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* Effect.flip(cfg.update((current) => current));
			}).pipe(Effect.provide(layerFor(host, "/app/.apprc")));

			assert.strictEqual(error._tag, "ConfigFileNotFoundError");
			// Nothing was written: update failed before reaching save.
			assert.deepStrictEqual(host.volume.paths(), []);
		}),
	);
});

describe("ConfigFile write-path error-union narrowing (type-level)", () => {
	// These assignments FAIL THE TYPECHECK if a method's error channel is wider
	// than the design permits. `write` takes an explicit path, so it can never
	// fail with ConfigFileNotFoundError.
	it.effect("narrows each write-path method's error channel", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;

			// No ConfigFileNotFoundError: the path is explicit. No
			// ConfigDefaultPathMissingError: no default path is consulted.
			const _write: (value: AppShape, path: string) => Effect.Effect<void, ConfigWriteError, never> = cfg.write;
			// No ConfigFileNotFoundError: `save` never discovers anything.
			const _save: (value: AppShape) => Effect.Effect<string, ConfigSaveError, never> = cfg.save;
			// `update` loads, so it inherits the whole load union, plus save's.
			const _update: (
				fn: (current: AppShape) => AppShape,
				defaultValue?: AppShape,
			) => Effect.Effect<AppShape, ConfigUpdateError, never> = cfg.update;

			assert.isFunction(_write);
			assert.isFunction(_save);
			assert.isFunction(_update);
		}).pipe(Effect.provide(layerFor(recordingFs({})))),
	);
});

describe("ConfigFile.layer with an empty resolver chain", () => {
	// Regression for the RR inference gap: `resolvers: []` with no other
	// resolver gives `RR` zero inference candidates. Before `RR` defaulted to
	// `never`, this configuration failed to typecheck at all — `RR` inferred
	// `unknown`, collapsing the layer's `R` to `unknown` and breaking
	// `Effect.provide` downstream. A write-only config service (discovery
	// disabled, `save` still wired through `defaultPath`) is a legitimate
	// configuration this must support.
	it.effect("saves via defaultPath alone when resolvers is empty", () =>
		Effect.gen(function* () {
			const host = recordingFs({});
			const writeOnlyLayer = ConfigFile.layer(AppConfig, {
				schema: AppShape,
				codec: JsonCodec,
				resolvers: [],
				strategy: MergeStrategy.firstMatch<AppShape>(),
				defaultPath: Effect.succeed("/write-only/.apprc"),
			}).pipe(Layer.provide(Layer.mergeAll(host.layer, Path.layer)));

			const written = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.save(AppShape.make({ port: 42 }));
			}).pipe(Effect.provide(writeOnlyLayer));

			assert.strictEqual(written, "/write-only/.apprc");
			assert.deepStrictEqual(host.mkdirs, ["/write-only"]);
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/write-only/.apprc") as string)), { port: 42 });
		}),
	);
});

describe("ConfigFile.update — concurrency", () => {
	/**
	 * A pinned memfs volume whose `readFileString` yields to the scheduler, so two fibers
	 * genuinely interleave between `load` and `save`. Without that boundary the
	 * effects run to completion one after the other and no race is possible —
	 * a test over a synchronous FileSystem passes whether or not `update` is
	 * serialized, which proves nothing.
	 */
	const yieldingFs = (seed: MemoryFileSystemSeed) =>
		MemoryFileSystem.makeSync(seed, {
			faults: (base) => ({
				readFileString: Effect.fn("readFileString")(function* (path, encoding) {
						// Read before yielding: a real read observes the file as it was when the
						// read began. Reading after the yield would silently hand the second
						// fiber the first fiber's write, masking the very race under test.
						const snapshot = yield* base.readFileString(path, encoding);
						yield* Effect.yieldNow;
						return snapshot;
					}),
			}),
		});

	it.effect("two concurrent updates both land; neither write is lost", () =>
		Effect.gen(function* () {
			const host = yieldingFs({ "/app/.apprc": `{"port":0}` });
			const layer = ConfigFile.layer(AppConfig, {
				schema: AppShape,
				codec: JsonCodec,
				resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
				strategy: MergeStrategy.firstMatch<AppShape>(),
				defaultPath: Effect.succeed("/app/.apprc"),
			}).pipe(Layer.provide(Layer.mergeAll(host.layer, Path.layer)));

			yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const bump = cfg.update((current) => AppShape.make({ port: current.port + 1 }));
				// Unserialized, both fibers read port=0 across the yield and both write 1.
				yield* Effect.all([bump, bump], { concurrency: 2 });
			}).pipe(Effect.provide(layer));

			const final = Result.getOrThrow(S.decodeResult(JsonValue)(host.volume.text("/app/.apprc") as string)) as { port: number };
			assert.strictEqual(final.port, 2, "both increments must survive");
		}),
	);
});

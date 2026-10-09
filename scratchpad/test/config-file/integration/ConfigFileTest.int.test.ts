// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file
import * as nodeFs from "node:fs/promises";
import * as nodePath from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Path, Schema } from "effect";
import { ConfigFile } from "../../../effected/config-file/ConfigFile.ts";
import { JsonCodec } from "../../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../../effected/config-file/MergeStrategy.ts";

class AppShape extends Schema.Class<AppShape>("AppShape")({ port: Schema.Number }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/SeededConfig") {}

const Platform = Layer.mergeAll(NodeFileSystem.layer, Path.layer);

/** Does `target` still exist on the real filesystem? */
const existsOnDisk = (target: string): Effect.Effect<boolean> =>
	Effect.promise(() =>
		nodeFs.access(target).then(
			() => true,
			() => false,
		),
	);

describe("ConfigFile.testLayer", () => {
	it.effect("seeds files, runs the real pipeline over them, and cleans up on scope close", () =>
		Effect.gen(function* () {
			let seededPath = "";

			yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;

				const sources = yield* cfg.discover;
				assert.strictEqual(sources.length, 1);
				seededPath = sources[0]?.path ?? "";
				assert.notStrictEqual(seededPath, "");
				assert.strictEqual(nodePath.basename(seededPath), ".apprc");
				assert.strictEqual(yield* existsOnDisk(seededPath), true);

				const value = yield* cfg.load;
				assert.strictEqual(value.port, 4242);
				// The REAL decode ran, not a stub: a mock returning a plain object would fail here.
				assert.instanceOf(value, AppShape);
			}).pipe(
				Effect.provide(
					ConfigFile.testLayer(AppConfig, {
						schema: AppShape,
						codec: JsonCodec,
						strategy: MergeStrategy.firstMatch<AppShape>(),
						files: { ".apprc": `{"port":4242}` },
					}).pipe(Layer.provide(Platform)),
				),
			);

			// The finalizer removed the whole temp directory, not just the file.
			assert.strictEqual(yield* existsOnDisk(seededPath), false);
			assert.strictEqual(yield* existsOnDisk(nodePath.dirname(seededPath)), false);
		}),
	);

	// No `options.validate` is supplied here: the failure comes from the schema
	// itself, decoded through the real pipeline the test layer wires up.
	it.effect("surfaces a real schema decode failure as ConfigValidationError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.gen(function* () {
				const cfg = yield* AppConfig;
				return yield* cfg.load;
			}).pipe(
				Effect.provide(
					ConfigFile.testLayer(AppConfig, {
						schema: AppShape,
						codec: JsonCodec,
						strategy: MergeStrategy.firstMatch<AppShape>(),
						files: { ".apprc": `{"port":"not-a-number"}` },
					}).pipe(Layer.provide(Platform)),
				),
				Effect.flip,
			);

			// A stubbed layer could not produce this: it comes from the real schema decode.
			assert.strictEqual(result._tag, "ConfigValidationError");
		}),
	);
});

import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem } from "effect";
import { Effect, Layer, Path, Schema } from "effect";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

const platform = (files: Record<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer);

const Doc = Schema.Struct({ from: Schema.String });

class DocConfig extends ConfigFile.Service<DocConfig, typeof Doc.Type>()("test/CodecPathConfig") {}

/** A chain that finds whichever of the two files exists, never an explicit path. */
const discovery = ConfigFile.layer(DocConfig, {
	schema: Doc,
	codec: JsonCodec,
	strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
	resolvers: [ConfigResolver.upwardWalk({ filenames: [".app.json", "app.json"], cwd: "/repo/pkg" })],
	defaultPath: Effect.succeed("/repo/out.json"),
});

class WriteConfig extends ConfigFile.Service<WriteConfig, typeof Doc.Type>()("test/CodecPathWriteConfig") {}

/** A codec that parses like JSON but refuses to serialize anything. */
const UnserializableCodec = {
	name: "json",
	parse: JsonCodec.parse,
	stringify: () =>
		Effect.fail(new ConfigCodecError({ codec: "json", operation: "stringify", cause: new Error("nope") })),
};

const writing = ConfigFile.layer(WriteConfig, {
	schema: Doc,
	codec: UnserializableCodec,
	strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
	resolvers: [],
});

describe("ConfigCodecError.path", () => {
	// The point of the field: under discovery the caller never named a path, so
	// without this it cannot say WHICH of several candidates was malformed.
	it.effect("names the discovered file that failed to parse", () =>
		Effect.gen(function* () {
			const config = yield* DocConfig;
			const error = yield* Effect.flip(config.load);
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual((error as ConfigCodecError).path, "/repo/pkg/app.json");
			// The path travels in the FIELD, never in the rendered message: a wrapper
			// that names the file too would otherwise print it twice.
			assert.strictEqual(error.message, "json parse failed");
			// Re-raising to attach `path` must carry the ORIGINAL cause through
			// structurally. Asserting only `instanceOf ConfigCodecError` would still
			// pass if the re-wrap stringified it.
			assert.instanceOf((error as ConfigCodecError).cause, SyntaxError);
		}).pipe(Effect.provide(discovery.pipe(Layer.provide(platform({ "/repo/pkg/app.json": "{ not json" }))))),
	);

	it.effect("names the file for the one-shot ConfigFile.read", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(ConfigFile.read("/repo/app.json", { schema: Doc, codec: JsonCodec }));
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual((error as ConfigCodecError).path, "/repo/app.json");
			assert.instanceOf((error as ConfigCodecError).cause, SyntaxError);
		}).pipe(Effect.provide(platform({ "/repo/app.json": "{ not json" }))),
	);

	it.effect("names the target a stringify failure was headed for", () =>
		Effect.gen(function* () {
			const config = yield* WriteConfig;
			const error = yield* Effect.flip(config.write({ from: "ok" }, "/repo/written.json"));
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual((error as ConfigCodecError).path, "/repo/written.json");
			assert.instanceOf((error as ConfigCodecError).cause, Error);
			assert.strictEqual(((error as ConfigCodecError).cause as Error).message, "nope");
		}).pipe(Effect.provide(writing.pipe(Layer.provide(platform({}))))),
	);

	it("is absent when a codec is driven directly, outside the pipeline", () => {
		const error = Effect.runSync(Effect.flip(JsonCodec.parse("{ not json")));
		assert.instanceOf(error, ConfigCodecError);
		assert.strictEqual(error.path, undefined);
		assert.strictEqual(error.message, "json parse failed");
	});
});

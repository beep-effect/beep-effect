// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import type { ConfigCodec as ConfigCodecShape } from "../../effected/config-file/ConfigCodec.ts";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { ConfigEvents } from "../../effected/config-file/ConfigEvent.ts";
import type { ConfigEncodeError, ConfigWriteError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigFile, ConfigValidationError } from "../../effected/config-file/ConfigFile.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import { TomlCodec } from "../../effected/config-file/TomlCodec.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const platform = (): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(
		// `write` never mkdirs, so the target directories must pre-exist.
		MemoryFileSystem.layerWith({
			"/out": MemoryFileSystem.directory(),
			"/x": MemoryFileSystem.directory(),
			"/legacy": MemoryFileSystem.directory(),
		}),
		Path.layer,
	);

class Doc extends S.Class<Doc>("Doc")({ name: S.String, port: S.Finite }) {}
class DocConfig extends ConfigFile.Service<DocConfig, Doc>()("test/EncodeConfig") {}

const layerFor = (codec: ConfigCodecShape) =>
	ConfigFile.layer(DocConfig, {
		schema: Doc,
		codec,
		resolvers: [],
		strategy: MergeStrategy.firstMatch<Doc>(),
		// `provideMerge`, not `provide`: the test body reads the same volume the service writes.
	}).pipe(Layer.provideMerge(platform()));

const HEADER = "#:schema https://example/schema.json";
const value = Doc.make({ name: "svc", port: 8080 });

/** Encode in memory and write to disk under the same options; return both texts. */
const both = Effect.fn("both")(function* (target: string, options?: { readonly header?: string }) {
		const cfg = yield* DocConfig;
		const fs = yield* FileSystem.FileSystem;
		const encoded = yield* cfg.encode(value, options);
		yield* cfg.write(value, target, options);
		const written = yield* fs.readFileString(target);
		return { encoded, written };
	});

describe("ConfigFile.encode", () => {
	it.effect("produces byte-for-byte what write puts on disk (TOML)", () =>
		Effect.gen(function* () {
			const { encoded, written } = yield* both("/out/config.toml");
			assert.strictEqual(encoded, written);
			// A positive control on the content itself, so an empty-string pair cannot pass.
			assert.include(encoded, "port = 8080");
		}).pipe(Effect.provide(layerFor(TomlCodec))),
	);

	it.effect("produces byte-for-byte what write puts on disk (JSON)", () =>
		Effect.gen(function* () {
			const { encoded, written } = yield* both("/out/config.json");
			assert.strictEqual(encoded, written);
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(encoded)), { name: "svc", port: 8080 });
		}).pipe(Effect.provide(layerFor(JsonCodec))),
	);

	it.effect("prepends the header verbatim, one newline, then the document — on both paths", () =>
		Effect.gen(function* () {
			const cfg = yield* DocConfig;
			const bare = yield* cfg.encode(value);
			const { encoded, written } = yield* both("/out/config.toml", { header: HEADER });
			assert.strictEqual(encoded, `${HEADER}\n${bare}`);
			assert.strictEqual(written, encoded);
			// Exactly one newline separates the header from the document.
			assert.isTrue(encoded.startsWith(`${HEADER}\n`));
			assert.isFalse(encoded.startsWith(`${HEADER}\n\n`));
		}).pipe(Effect.provide(layerFor(TomlCodec))),
	);

	it.effect("does not double the newline when the header already ends in one", () =>
		Effect.gen(function* () {
			const cfg = yield* DocConfig;
			const bare = yield* cfg.encode(value);
			const withNewline = yield* cfg.encode(value, { header: `${HEADER}\n` });
			const without = yield* cfg.encode(value, { header: HEADER });
			assert.strictEqual(withNewline, `${HEADER}\n${bare}`);
			assert.strictEqual(withNewline, without);
		}).pipe(Effect.provide(layerFor(TomlCodec))),
	);

	it.effect("fails with ConfigValidationError whose path is none for an invalid value", () =>
		Effect.gen(function* () {
			const cfg = yield* DocConfig;
			// Bypass the constructor's own validation: the schema encode is what must reject this.
			const bogus = deliberatelyInvalid<Doc>({ name: "svc", port: "not-a-number" });
			const error = yield* Effect.flip(cfg.encode(bogus));
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
			assert.isTrue(O.isNone(error.path));
		}).pipe(Effect.provide(layerFor(JsonCodec))),
	);

	it.effect("a stringify failure carries no path from encode but the target path from write", () =>
		Effect.gen(function* () {
			const broken: ConfigCodecShape = {
				name: "broken",
				parse: JsonCodec.parse,
				stringify: () =>
					Effect.fail(ConfigCodecError.make({ codec: "broken", operation: "stringify", cause: new Error("nope") })),
			};
			const program = Effect.gen(function* () {
				const cfg = yield* DocConfig;
				const fromEncode = yield* Effect.flip(cfg.encode(value));
				const fromWrite = yield* Effect.flip(cfg.write(value, "/x/config.json"));
				return { fromEncode, fromWrite };
			});
			const { fromEncode, fromWrite } = yield* program.pipe(Effect.provide(layerFor(broken)));

			assert.instanceOf(fromEncode, ConfigCodecError);
			assert.isTrue(S.is(ConfigCodecError)(fromEncode));
			assert.strictEqual(fromEncode.path, undefined);
			assert.instanceOf(fromWrite, ConfigCodecError);
			assert.isTrue(S.is(ConfigCodecError)(fromWrite));
			assert.strictEqual(fromWrite.path, "/x/config.json");
		}),
	);

	it.effect("a stringify failure emits StringifyFailed from write but nothing at all from encode", () =>
		Effect.gen(function* () {
			const broken: ConfigCodecShape = {
				name: "broken",
				parse: JsonCodec.parse,
				stringify: () =>
					Effect.fail(ConfigCodecError.make({ codec: "broken", operation: "stringify", cause: new Error("nope") })),
			};
			const eventful = Layer.mergeAll(
				ConfigEvents.layer,
				ConfigFile.layer(DocConfig, {
					schema: Doc,
					codec: broken,
					resolvers: [],
					strategy: MergeStrategy.firstMatch<Doc>(),
					events: ConfigEvents,
				}).pipe(Layer.provide(platform())),
			);
			const program = Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* DocConfig;

				yield* Effect.flip(cfg.encode(value));
				const afterEncode = yield* PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);

				// Positive control: the same failure through `write` still publishes, so
				// an empty `afterEncode` cannot be a subscription that never worked.
				yield* Effect.flip(cfg.write(value, "/x/config.json"));
				const afterWrite = yield* PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);
				return { afterEncode, afterWrite };
			});
			const { afterEncode, afterWrite } = yield* program.pipe(Effect.scoped, Effect.provide(eventful));

			assert.deepStrictEqual(
				afterEncode.map((e) => e.event._tag),
				[],
			);
			assert.deepStrictEqual(
				afterWrite.map((e) => e.event._tag),
				["StringifyFailed"],
			);
		}),
	);

	it.effect("write keeps its two-argument form and encode's error type excludes the write error", () =>
		Effect.gen(function* () {
			const cfg = yield* DocConfig;
			// Compile-time pins: the shapes the design promises.
			const _write: (value: Doc, path: string) => Effect.Effect<void, ConfigWriteError> = cfg.write;
			const _encode: (value: Doc) => Effect.Effect<string, ConfigEncodeError> = cfg.encode;
			yield* _write(value, "/legacy/config.json");
			const fs = yield* FileSystem.FileSystem;
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(JsonValue)(yield* fs.readFileString("/legacy/config.json"))), { name: "svc", port: 8080 });
			assert.strictEqual(yield* _encode(value), yield* fs.readFileString("/legacy/config.json"));
		}).pipe(Effect.provide(layerFor(JsonCodec))),
	);
});

// `ConfigFile.read` — the one-shot form: a path and a schema in one expression,
// with no service class, no layer and no tag.
//
// `ConfigFile.layer` binds schema and codec at layer-construction time, which is
// right for a config file an application HAS (several candidate locations,
// save/update, migrations, events) and heavy for a call site that decodes one
// known path once. That heaviness is what the old
// `@savvy-web/github-action-effects` `ConfigLoader` existed for, and this is the
// shape that replaces it — with the narrowed error union rather than one
// stringly mega-error.

import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem } from "effect";
import { Effect, Layer, Option, Path, Schema } from "effect";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { ConfigFile, ConfigFileReadError, ConfigValidationError } from "../../effected/config-file/ConfigFile.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { JsoncCodec } from "../../effected/config-file/JsoncCodec.ts";

class AppShape extends Schema.Class<AppShape>("AppShape")({ port: Schema.Number }) {}

const platform = (files: Record<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
	Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer);

describe("ConfigFile.read", () => {
	it.effect("reads, decodes and validates one explicit path", () =>
		Effect.gen(function* () {
			const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
			assert.strictEqual(value.port, 8080);
			// The decoded value is a real class instance, exactly as `loadFrom` gives.
			assert.instanceOf(value, AppShape);
		}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":8080}` }))),
	);

	it.effect("needs no service class, no layer and no tag", () =>
		// The whole point: this is the entire call site. Under `ConfigFile.layer`
		// the same read costs a `ConfigFile.Service` subclass, a layer bound to a
		// const, and a provide at the boundary.
		Effect.gen(function* () {
			const value = yield* ConfigFile.read("/etc/app.json", { schema: AppShape, codec: JsonCodec });
			assert.strictEqual(value.port, 1);
		}).pipe(Effect.provide(platform({ "/etc/app.json": `{"port":1}` }))),
	);

	it.effect("a missing file fails with ConfigFileReadError, carrying the path", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(ConfigFile.read("/nope.json", { schema: AppShape, codec: JsonCodec }));
			assert.instanceOf(error, ConfigFileReadError);
			assert.strictEqual(error.path, "/nope.json");
		}).pipe(Effect.provide(platform({}))),
	);

	it.effect("unparseable content fails with ConfigCodecError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
			assert.instanceOf(error, ConfigCodecError);
		}).pipe(Effect.provide(platform({ "/app/.apprc": "{ not json" }))),
	);

	it.effect("a schema mismatch fails with ConfigValidationError carrying the STRUCTURED issue", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
			assert.instanceOf(error, ConfigValidationError);
			// The whole error-ladder point: the schema issue tree is carried
			// structurally, never stringified into a `reason` field the way the old
			// ConfigLoaderError did it.
			assert.isDefined(error.issue);
		}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":"nope"}` }))),
	);

	it.effect("the path is recorded on a validation failure", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
			assert.instanceOf(error, ConfigValidationError);
			// `Option.some(path)` — a one-shot read always knows where it read from,
			// unlike `validate`, which decodes an in-memory value and has no path.
			assert.deepStrictEqual(error.path, Option.some("/app/.apprc"));
		}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":"nope"}` }))),
	);

	it.effect("the codec is an explicit argument — JSONC comments parse under JsoncCodec", () =>
		// The codec stays a parameter rather than being inferred or defaulted, so a
		// JSON-only consumer never references the JSONC/YAML/TOML modules and the
		// free-standing-codec tree-shaking rule is untouched.
		Effect.gen(function* () {
			const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsoncCodec });
			assert.strictEqual(value.port, 3000);
		}).pipe(Effect.provide(platform({ "/app/.apprc": `{ /* the port */ "port": 3000 }` }))),
	);

	it.effect("the SAME path can be read through two different schemas", () =>
		// The shape `ConfigFile.layer` cannot express without a second service class:
		// schema is per CALL here, not per layer.
		Effect.gen(function* () {
			class NameShape extends Schema.Class<NameShape>("NameShape")({ name: Schema.String }) {}
			const asPort = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
			const asName = yield* ConfigFile.read("/app/.apprc", { schema: NameShape, codec: JsonCodec });
			assert.strictEqual(asPort.port, 8080);
			assert.strictEqual(asName.name, "app");
		}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":8080,"name":"app"}` }))),
	);
	describe("parseOptions", () => {
		const withExtra = { "/app/.apprc": `{"port":8080,"removedCredential":"stale"}` };

		it.effect("drops unknown keys silently by default", () =>
			Effect.gen(function* () {
				const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
				assert.strictEqual(value.port, 8080);
			}).pipe(Effect.provide(platform(withExtra))),
		);

		it.effect("onExcessProperty error rejects a leftover field and names its path", () =>
			Effect.gen(function* () {
				// A config loader that silently discards part of a user's file cannot
				// report a typo'd section, and cannot enforce a field the schema
				// deliberately removed.
				const error = yield* Effect.flip(
					ConfigFile.read("/app/.apprc", {
						schema: AppShape,
						codec: JsonCodec,
						parseOptions: { onExcessProperty: "error" },
					}),
				);
				assert.instanceOf(error, ConfigValidationError);
				assert.include(JSON.stringify(error.issue), "removedCredential");
			}).pipe(Effect.provide(platform(withExtra))),
		);

		it.effect("onExcessProperty error leaves a clean document alone", () =>
			Effect.gen(function* () {
				const value = yield* ConfigFile.read("/app/.apprc", {
					schema: AppShape,
					codec: JsonCodec,
					parseOptions: { onExcessProperty: "error" },
				});
				assert.strictEqual(value.port, 8080);
			}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":8080}` }))),
		);

		it.effect("a rest switches excess checking off for its struct, not just for the keys it covers", () =>
			Effect.gen(function* () {
				// The half that decides whether this is usable: a schema that
				// deliberately admits a pass-through section must keep working under
				// "error", or strictness would break a documented feature.
				const Passthrough = Schema.StructWithRest(Schema.Struct({ port: Schema.Number }), [
					Schema.Record(Schema.String, Schema.Unknown),
				]);
				const value = yield* ConfigFile.read("/app/.apprc", {
					schema: Passthrough,
					codec: JsonCodec,
					parseOptions: { onExcessProperty: "error" },
				});
				assert.strictEqual(value.port, 8080);
				// The rest is `Record(String, Unknown)`, so every key at this level is
				// admitted — the excess pass does not run at all for a struct that
				// owns an index signature. Measured rather than assumed: the shape
				// suggests a rest exempts only what it covers, and it does not.
				assert.strictEqual((value as Record<string, unknown>).anything, "goes");
			}).pipe(Effect.provide(platform({ "/app/.apprc": `{"port":8080,"anything":"goes"}` }))),
		);
	});
});

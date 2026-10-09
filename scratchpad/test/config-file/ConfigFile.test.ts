// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import type { ConfigLoadError, ConfigReadError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigFile, ConfigFileNotFoundError, ConfigFileReadError, ConfigValidationError } from "../../effected/config-file/ConfigFile.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

class AppShape extends S.Class<AppShape>("AppShape")({ port: S.Finite }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/AppConfig") {}

const layerFor = (
	files: Record<string, string>,
	resolvers = [ConfigResolver.explicitPath("/app/.apprc")],
	validate?: (value: AppShape) => Effect.Effect<AppShape, ConfigValidationError>,
) =>
	ConfigFile.layer(AppConfig, {
		schema: AppShape,
		codec: JsonCodec,
		resolvers,
		strategy: MergeStrategy.firstMatch<AppShape>(),
		...(validate !== undefined && { validate }),
	}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer)));

describe("ConfigFile.load", () => {
	it.effect("loads, decodes and validates the highest-priority source", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const value = yield* cfg.load;
			assert.strictEqual(value.port, 8080);
			assert.instanceOf(value, AppShape);
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":8080}` }))),
	);

	it.effect("fails with ConfigFileNotFoundError when no resolver matches", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			assert.instanceOf(error, ConfigFileNotFoundError);
			assert.isTrue(S.is(ConfigFileNotFoundError)(error));
			assert.strictEqual(error._tag, "ConfigFileNotFoundError");
			// It reports which tiers were probed — v3's mega-error could not.
			assert.include(error.searched, "explicit");
			// ...and which paths those tiers checked — one name can hide N candidates.
			assert.deepStrictEqual(error.candidates, ["/app/.apprc"]);
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("ConfigFileNotFoundError.candidates carries the full walk, in probe order", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			if (!S.is(ConfigFileNotFoundError)(error)) throw error;
			assert.deepStrictEqual(error.searched, ["explicit", "walk:project"]);
			assert.deepStrictEqual(error.candidates, [
				"/app/.apprc",
				"/repo/pkg/.app.json",
				"/repo/pkg/app.json",
				"/repo/.app.json",
				"/repo/app.json",
			]);
			// The message names the search without dumping every path; the field carries them.
			assert.include(error.message, "walk:project");
			assert.include(error.message, "5 candidate paths checked");
		}).pipe(
			Effect.provide(
				layerFor({}, [
					ConfigResolver.explicitPath("/app/.apprc"),
					ConfigResolver.upwardWalk({
						filenames: [".app.json", "app.json"],
						cwd: "/repo/pkg",
						stopAt: "/repo",
						name: "walk:project",
					}),
				]),
			),
		),
	);

	it.effect("a resolver without resolveProbe contributes no candidates but still names itself", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			if (!S.is(ConfigFileNotFoundError)(error)) throw error;
			assert.deepStrictEqual(error.searched, ["hand-rolled", "explicit"]);
			// The hand-rolled tier is opaque; the built-in still reports its probe.
			assert.deepStrictEqual(error.candidates, ["/app/.apprc"]);
			// No probe count in the message beyond what the field holds.
			assert.include(error.message, "1 candidate path checked");
		}).pipe(
			Effect.provide(
				layerFor({}, [
					{ name: "hand-rolled", resolve: Effect.succeedNone },
					ConfigResolver.explicitPath("/app/.apprc"),
				]),
			),
		),
	);

	it.effect("fails with ConfigCodecError — distinguishable from NotFound", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error._tag, "ConfigCodecError");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": "{ not json" }))),
	);

	it.effect("fails with ConfigValidationError carrying a structured issue, not a string", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
			assert.strictEqual(error._tag, "ConfigValidationError");
			const { issue } = error;
			assert.notStrictEqual(typeof issue, "string");
			// The structured schema issue tree survives, rather than String(ParseError).
			assert.strictEqual(typeof issue, "object");
			assert.isTrue(P.isObjectKeyword(issue));
			assert.property(issue, "_tag");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":"nope"}` }))),
	);

	it.effect("ConfigValidationError names the offending path", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
			assert.deepStrictEqual(error.path, O.some("/app/.apprc"));
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":"nope"}` }))),
	);

	it.effect("preserves the read failure structurally rather than stringifying it", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.loadFrom("/nope/.apprc"));
			assert.instanceOf(error, ConfigFileReadError);
			assert.isTrue(S.is(ConfigFileReadError)(error));
			// v3 collapsed this to `reason: String(e)`; the host's typed PlatformError survives.
			const cause = error.cause;
			assert.instanceOf(cause, PlatformError.PlatformError);
			assert.isTrue(PlatformError.isPlatformError(cause));
			assert.strictEqual(cause.reason._tag, "NotFound");
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("the three failure modes are routable by catchTag — the v3 defect this fixes", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const label = yield* cfg.load.pipe(
				Effect.as("ok"),
				Effect.catchTags({
					ConfigFileNotFoundError: () => Effect.succeed("not-found"),
					ConfigCodecError: () => Effect.succeed("bad-syntax"),
					ConfigValidationError: () => Effect.succeed("bad-shape"),
					ConfigFileReadError: () => Effect.succeed("unreadable"),
				}),
			);
			assert.strictEqual(label, "bad-syntax");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": "{ not json" }))),
	);
});

describe("ConfigFile bare non-object documents", () => {
	// JsonCodec.parse happily accepts `null`, `42` and `"str"` — a bare,
	// non-object JSON document. The service is where that becomes a decision:
	// the schema rejects it as a ConfigValidationError, never a defect.
	for (const [label, raw] of [
		["null", "null"],
		["a bare number", "42"],
		["a bare string", `"hello"`],
		["an array", "[]"],
	] as const) {
		it.effect(`rejects ${label} as ConfigValidationError, not a defect`, () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const error = yield* Effect.flip(cfg.load);
				assert.instanceOf(error, ConfigValidationError);
				assert.isTrue(S.is(ConfigValidationError)(error));
				assert.strictEqual(error._tag, "ConfigValidationError");
			}).pipe(Effect.provide(layerFor({ "/app/.apprc": raw }))),
		);
	}
});

describe("ConfigFile.loadOrDefault", () => {
	it.effect("returns the default when nothing is found", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const value = yield* cfg.loadOrDefault(AppShape.make({ port: 1 }));
			assert.strictEqual(value.port, 1);
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("still propagates a codec failure — a corrupt file is not a missing file", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.loadOrDefault(AppShape.make({ port: 1 })));
			assert.strictEqual(error._tag, "ConfigCodecError");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": "{ not json" }))),
	);
});

describe("ConfigFile.discover", () => {
	it.effect("returns an empty array rather than failing when nothing is found", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const sources = yield* cfg.discover;
			assert.deepStrictEqual(sources, []);
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("labels each source with the resolver that found it", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const sources = yield* cfg.discover;
			assert.strictEqual(sources[0]?.resolver, "explicit");
			assert.strictEqual(sources[0]?.path, "/app/.apprc");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":8080}` }))),
	);
});

describe("ConfigFile.loadFrom / validate", () => {
	it.effect("loadFrom fails with ConfigFileReadError on an unreadable path", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.loadFrom("/nope/.apprc"));
			assert.instanceOf(error, ConfigFileReadError);
			assert.isTrue(S.is(ConfigFileReadError)(error));
			assert.strictEqual(error.path, "/nope/.apprc");
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("validate decodes an unknown value", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const value = yield* cfg.validate({ port: 3000 });
			assert.strictEqual(value.port, 3000);
		}).pipe(Effect.provide(layerFor({}))),
	);

	it.effect("validate fails with ConfigValidationError carrying no path", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.validate({ port: "nope" }));
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
			assert.isTrue(O.isNone(error.path));
		}).pipe(Effect.provide(layerFor({}))),
	);
});

describe("ConfigFile options.validate", () => {
	const rejectPort0 = (value: AppShape): Effect.Effect<AppShape, ConfigValidationError> =>
		value.port === 0
			? Effect.fail(ConfigValidationError.make({ path: O.none(), issue: "port must not be 0" }))
			: Effect.succeed(value);

	it.effect("cfg.load fails with ConfigValidationError when the caller hook rejects a schema-valid document", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.load);
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
			assert.strictEqual(error._tag, "ConfigValidationError");
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":0}` }, undefined, rejectPort0))),
	);

	it.effect("cfg.load succeeds when the caller hook passes the value through", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const value = yield* cfg.load;
			assert.strictEqual(value.port, 8080);
		}).pipe(Effect.provide(layerFor({ "/app/.apprc": `{"port":8080}` }, undefined, rejectPort0))),
	);

	it.effect("cfg.validate(value) also runs the caller hook, not just the schema", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			const error = yield* Effect.flip(cfg.validate({ port: 0 }));
			assert.instanceOf(error, ConfigValidationError);
			assert.isTrue(S.is(ConfigValidationError)(error));
		}).pipe(Effect.provide(layerFor({}, undefined, rejectPort0))),
	);

	it.effect("loadOrDefault returns defaultValue as-is, without running the schema or options.validate on it", () =>
		Effect.gen(function* () {
			const cfg = yield* AppConfig;
			// port: 0 would be rejected by rejectPort0 if it were run, and by the
			// schema if re-decoded. Its return unmolested pins the v3-parity behavior.
			const defaultValue = AppShape.make({ port: 0 });
			const value = yield* cfg.loadOrDefault(defaultValue);
			assert.strictEqual(value, defaultValue);
			assert.strictEqual(value.port, 0);
		}).pipe(Effect.provide(layerFor({}, undefined, rejectPort0))),
	);
});

describe("ConfigFile error-union narrowing (type-level)", () => {
	// These assignments do not run anything meaningful; they FAIL THE TYPECHECK
	// if a method's error channel is wider than the design permits. That is the
	// deliverable of this task, and the v3 defect it repairs.
	it("narrows each method's error channel", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const cfg = yield* AppConfig;

				const _load: Effect.Effect<AppShape, ConfigLoadError, never> = cfg.load;
				// No ConfigFileNotFoundError: the path is explicit.
				const _loadFrom: (p: string) => Effect.Effect<AppShape, ConfigReadError, never> = cfg.loadFrom;
				// No ConfigFileNotFoundError: an empty array is success.
				const _discover: Effect.Effect<
					ReadonlyArray<{ readonly value: AppShape }>,
					ConfigReadError,
					never
				> = cfg.discover;
				// No ConfigFileNotFoundError: that is the branch it handles.
				const _loadOrDefault: (d: AppShape) => Effect.Effect<AppShape, ConfigReadError, never> = cfg.loadOrDefault;
				// ConfigValidationError and nothing else.
				const _validate: (v: unknown) => Effect.Effect<AppShape, ConfigValidationError, never> = cfg.validate;

				assert.isFunction(_validate);
				assert.isFunction(_loadFrom);
				assert.isFunction(_loadOrDefault);
				assert.isDefined(_load);
				assert.isDefined(_discover);
			}).pipe(Effect.provide(layerFor({}))),
		));
});

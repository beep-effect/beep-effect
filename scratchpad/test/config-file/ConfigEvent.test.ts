import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSuccess } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ConfigEvent } from "../../effected/config-file/ConfigEvent.ts";
import { ConfigEventPayload, ConfigEvents } from "../../effected/config-file/ConfigEvent.ts";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import type { RecordingFs } from "./helpers.ts";
import { recordingFs } from "./helpers.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

class AppShape extends S.Class<AppShape>("AppShape")({ port: S.Finite }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/EventConfig") {}

/**
 * One `ConfigEvents.layer` value, bound to a const and reused. Calling
 * `ConfigEvents.layer` is cheap, but building it twice inside one provide graph
 * would mint two PubSubs — the subscriber would watch one and `emit` would
 * publish to the other.
 */
const eventsLayer = ConfigEvents.layer;

/** Read every event buffered on `sub` without blocking and without a clock. */
const drain = (sub: PubSub.Subscription<ConfigEvent>): Effect.Effect<ReadonlyArray<ConfigEvent>> =>
	PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);

const tagsOf = (events: ReadonlyArray<ConfigEvent>): ReadonlyArray<string> => events.map((e) => e.event._tag);

/** A read-only config service wired to `ConfigEvents`, over an in-memory host. */
const readLayer = (files: Record<string, string>, resolvers = [ConfigResolver.explicitPath("/app/.apprc")]) =>
	Layer.mergeAll(
		eventsLayer,
		ConfigFile.layer(AppConfig, {
			schema: AppShape,
			codec: JsonCodec,
			resolvers,
			strategy: MergeStrategy.layeredMerge<AppShape>(),
			events: ConfigEvents,
		}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer))),
	);

/** A writable config service wired to `ConfigEvents`. */
const writeLayer = (host: RecordingFs, defaultPath: string) =>
	Layer.mergeAll(
		eventsLayer,
		ConfigFile.layer(AppConfig, {
			schema: AppShape,
			codec: JsonCodec,
			resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
			strategy: MergeStrategy.firstMatch<AppShape>(),
			defaultPath: Effect.succeed(defaultPath),
			events: ConfigEvents,
		}).pipe(Layer.provide(Layer.mergeAll(host.layer, Path.layer))),
	);

describe("ConfigEventPayload", () => {
	// The v3 union declared `Stringified` and `ResolutionFailed` and never emitted
	// either. A variant that cannot occur is a lie in the type. Decoding is the
	// honest probe: if the variant is gone, its tag does not decode.
	it.effect("does not define the never-emitted v3 variants", () =>
		Effect.gen(function* () {
			for (const tag of ["Stringified", "ResolutionFailed"] as const) {
				const result = yield* Effect.result(S.decodeUnknownEffect(ConfigEventPayload)({ _tag: tag }));
				assertFailure(
					result,
					Result.match(result, {
						onFailure: (error) => error,
						onSuccess: () => assert.fail(`"${tag}" must not be a ConfigEventPayload variant`),
					}),
				);
			}
		}),
	);

	it.effect("still defines the variants the pipeline does emit", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(S.decodeEffect(ConfigEventPayload)({ _tag: "NotFound" }));
			assertSuccess(result, { _tag: "NotFound" });
		}),
	);
});

describe("ConfigEvent source reporting", () => {
	// v3 reported `sources[0].path` on `Resolved` and `Loaded`. Under
	// `layeredMerge` EVERY source contributed to the merged value, so naming only
	// the first is simply wrong.
	it.layer(
		readLayer({ "/a/.apprc": `{"port":8080}`, "/etc/.apprc": `{"port":80}` }, [
			ConfigResolver.explicitPath("/a/.apprc"),
			ConfigResolver.explicitPath("/etc/.apprc"),
		]),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("Resolved carries every contributing source under layeredMerge", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.load;

				const collected = yield* drain(sub);
				const resolved = collected.map((e) => e.event).find((p) => p._tag === "Resolved");
				if (resolved === undefined || resolved._tag !== "Resolved") {
					return assert.fail("expected a Resolved event");
				}

				assert.deepStrictEqual(
					resolved.sources.map((s) => s.path),
					["/a/.apprc", "/etc/.apprc"],
				);
				assert.deepStrictEqual(
					resolved.sources.map((s) => s.resolver),
					["explicit", "explicit"],
				);
				assert.strictEqual(resolved.strategy, "layered-merge");
			}),
		);
	});

	it.layer(
		readLayer({ "/a/.apprc": `{"port":8080}`, "/etc/.apprc": `{"port":80}` }, [
			ConfigResolver.explicitPath("/a/.apprc"),
			ConfigResolver.explicitPath("/etc/.apprc"),
		]),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("Loaded carries every contributing source too", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.load;

				const collected = yield* drain(sub);
				const loaded = collected.map((e) => e.event).find((p) => p._tag === "Loaded");
				if (loaded === undefined || loaded._tag !== "Loaded") {
					return assert.fail("expected a Loaded event");
				}

				assert.deepStrictEqual(
					loaded.sources.map((s) => s.path),
					["/a/.apprc", "/etc/.apprc"],
				);
			}),
		);
	});
});

describe("ConfigEvent per-operation granularity", () => {
	// These two pin that `Written` and `Saved` ARE live variants, so the
	// `update` test below cannot pass vacuously by simply never emitting them.
	// `write` never mkdirs, so the explicit target's directory must pre-exist.
	it.layer(
		writeLayer(recordingFs({ "/explicit": MemoryFileSystem.directory() }), "/app/.apprc"),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("write emits Written", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.write(AppShape.make({ port: 3 }), "/explicit/.apprc");

				assert.include(tagsOf(yield* drain(sub)), "Written");
			}),
		);
	});

	it.layer(
		writeLayer(recordingFs({}), "/app/.apprc"),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("save emits Saved", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.save(AppShape.make({ port: 3 }));

				assert.include(tagsOf(yield* drain(sub)), "Saved");
			}),
		);
	});

	// v3 emitted Written + Saved + Updated for a single `update` call and
	// documented it as a known smell: `update` called the public `save`, which
	// emitted its own events. `update` now drives the internal write path.
	it.layer(
		writeLayer(recordingFs({ "/app/.apprc": `{"port":1}` }), "/app/.apprc"),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("update emits Updated exactly once and does not emit Written or Saved", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }));

				const tags = tagsOf(yield* drain(sub));
				assert.lengthOf(
					tags.filter((t) => t === "Updated"),
					1,
				);
				assert.notInclude(tags, "Written");
				assert.notInclude(tags, "Saved");
			}),
		);
	});

	it.layer(
		writeLayer(recordingFs({ "/app/.apprc": `{"port":1}` }), "/app/.apprc"),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("Updated names the path that was written", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }));

				const updated = (yield* drain(sub)).map((e) => e.event).find((p) => p._tag === "Updated");
				if (updated === undefined || updated._tag !== "Updated") {
					return assert.fail("expected an Updated event");
				}
				assert.strictEqual(updated.path, "/app/.apprc");
			}),
		);
	});
});

describe("ConfigEvent failure variants carry structured errors", () => {
	// v3 stringified every failure's `reason`. If a subscriber's only way to
	// branch on a failure is `error.message`, the structured-error contract this
	// package exists to enforce is a claim nobody is checking.
	it.layer(
		readLayer({ "/app/.apprc": "{ not json" }),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("ParseFailed is emitted with a structured ConfigCodecError, never a string", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* Effect.result(cfg.load);

				const collected = yield* drain(sub);
				const parseFailed = collected.map((e) => e.event).find((p) => p._tag === "ParseFailed");
				if (parseFailed === undefined || parseFailed._tag !== "ParseFailed") {
					return assert.fail("expected a ParseFailed event");
				}

				assert.isNotString(parseFailed.error);
				if (!P.hasProperty(parseFailed.error, "_tag")) return assert.fail("expected a tagged error");
				assert.strictEqual(parseFailed.error._tag, "ConfigCodecError");
			}),
		);
	});

	// `port` must be a number; `decode`, not the codec, rejects this string.
	it.layer(
		readLayer({ "/app/.apprc": `{"port":"not-a-number"}` }),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("ValidationFailed is emitted with a structured ConfigValidationError, never a string", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* Effect.result(cfg.load);

				const collected = yield* drain(sub);
				const validationFailed = collected.map((e) => e.event).find((p) => p._tag === "ValidationFailed");
				if (validationFailed === undefined || validationFailed._tag !== "ValidationFailed") {
					return assert.fail("expected a ValidationFailed event");
				}

				assert.isNotString(validationFailed.error);
				if (!P.hasProperty(validationFailed.error, "_tag")) return assert.fail("expected a tagged error");
				assert.strictEqual(validationFailed.error._tag, "ConfigValidationError");
			}),
		);
	});
});

describe("ConfigEvents opt-in", () => {
	/** The same service, built WITHOUT the `events` option. */
	const noEventsLayer = ConfigFile.layer(AppConfig, {
		schema: AppShape,
		codec: JsonCodec,
		resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
		strategy: MergeStrategy.firstMatch<AppShape>(),
	}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ "/app/.apprc": `{"port":8080}` }), Path.layer)));

	it.layer(
		noEventsLayer,
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a layer built without `events` loads with no ConfigEvents in context", () =>
			Effect.gen(function* () {
				// If `emit` required the service rather than short-circuiting, this
				// would fail to build: nothing provides ConfigEvents here.
				assertNone(yield* Effect.serviceOption(ConfigEvents));

				const cfg = yield* AppConfig;
				const value = yield* cfg.load;
				assert.strictEqual(value.port, 8080);
			}),
		);
	});

	it.layer(
		Layer.mergeAll(eventsLayer, noEventsLayer),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("publishes nothing when `events` is omitted, even if ConfigEvents is in context", () =>
			Effect.gen(function* () {
				const svc = yield* ConfigEvents;
				const sub = yield* PubSub.subscribe(svc.events);
				const cfg = yield* AppConfig;
				yield* cfg.load;

				// `emit` is gated on `options.events`, not on service availability: it
				// never even looks the service up. Zero-cost, not a no-op subscriber.
				assert.deepStrictEqual(tagsOf(yield* drain(sub)), []);
			}),
		);
	});

	it.layer(
		Layer.mergeAll(
			// A hub shaped nothing like a real PubSub. `PubSub.publish` is a free
			// function that reads the hub's internal fields directly, so this does
			// not invoke `publish` below — it throws from inside `PubSub.publish`
			// itself when it dereferences a field that does not exist. That throw
			// is exactly the class of defect `catchDefect` must absorb.
			Layer.succeed(ConfigEvents, {
				events: deliberatelyInvalid<PubSub.PubSub<ConfigEvent>>({
					publish: () => {
						throw new Error("subscriber exploded");
					},
				}),
			}),
			ConfigFile.layer(AppConfig, {
				schema: AppShape,
				codec: JsonCodec,
				resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
				strategy: MergeStrategy.firstMatch<AppShape>(),
				events: ConfigEvents,
			}).pipe(
				Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ "/app/.apprc": `{"port":8080}` }), Path.layer)),
			),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a structurally invalid consumer-supplied hub never fails a config load", () =>
			Effect.gen(function* () {
				const cfg = yield* AppConfig;
				const value = yield* cfg.load;
				assert.strictEqual(value.port, 8080);
			}),
		);
	});
});

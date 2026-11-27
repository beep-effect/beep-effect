import { ConfigEventPayload, ConfigEvents } from "@beep/config-file/ConfigEvent";
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import { recordingFs } from "./helpers.ts";
import type { ConfigEvent } from "@beep/config-file/ConfigEvent";
import type { RecordingFs } from "./helpers.ts";

class AppShape extends S.Class<AppShape, { readonly brand: unique symbol }>("AppShape")({ port: S.Finite }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/EventConfig") {}

const sharedEventsLayer = ConfigEvents.layer;

const drain = (sub: PubSub.Subscription<ConfigEvent>): Effect.Effect<ReadonlyArray<ConfigEvent>> =>
  PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);

const tagsOf = (events: ReadonlyArray<ConfigEvent>): ReadonlyArray<string> => A.map(events, (e) => e.event._tag);

const findEvent = <T extends ConfigEventPayload["_tag"]>(
  events: ReadonlyArray<ConfigEvent>,
  tag: T
): O.Option<Extract<ConfigEventPayload, { readonly _tag: T }>> =>
  A.findFirst(
    A.map(events, (e) => e.event),
    (payload): payload is Extract<ConfigEventPayload, { readonly _tag: T }> => payload._tag === tag
  );

const readLayer = (files: Record<string, string>, resolvers = [ConfigResolver.explicitPath("/app/.apprc")]) =>
  Layer.mergeAll(
    sharedEventsLayer,
    ConfigFile.layer(AppConfig, {
      schema: AppShape,
      codec: JsonCodec,
      resolvers,
      strategy: MergeStrategy.layeredMerge<AppShape>(),
      events: ConfigEvents,
    }).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer)))
  );

const writeLayer = (host: RecordingFs, defaultPath: string) =>
  Layer.mergeAll(
    sharedEventsLayer,
    ConfigFile.layer(AppConfig, {
      schema: AppShape,
      codec: JsonCodec,
      resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
      strategy: MergeStrategy.firstMatch<AppShape>(),
      defaultPath: Effect.succeed(defaultPath),
      events: ConfigEvents,
    }).pipe(Layer.provide(Layer.mergeAll(host.layer, Path.layer)))
  );

describe("ConfigEventPayload", () => {
  it.effect("does not define the never-emitted v3 variants", () =>
    Effect.gen(function* () {
      for (const tag of ["Stringified", "ResolutionFailed"] as const) {
        const result = yield* Effect.result(S.decodeUnknownEffect(ConfigEventPayload)({ _tag: tag }));
        assertFailure(
          result,
          Result.match(result, {
            onFailure: (error) => error,
            onSuccess: () => assert.fail(`"${tag}" must not be a ConfigEventPayload variant: it is never emitted`),
          })
        );
      }
    })
  );

  it.effect("still defines the variants the pipeline does emit", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(S.decodeEffect(ConfigEventPayload)({ _tag: "NotFound" }));
      assertSuccess(result, { _tag: "NotFound" });
    })
  );
});

describe("ConfigEvent source reporting", () => {
  it.layer(
    readLayer({ "/a/.apprc": `{"port":8080}`, "/etc/.apprc": `{"port":80}` }, [
      ConfigResolver.explicitPath("/a/.apprc"),
      ConfigResolver.explicitPath("/etc/.apprc"),
    ]),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("Resolved carries every contributing source under layeredMerge", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.load;

        const collected = yield* drain(sub);
        const resolvedEvent = findEvent(collected, "Resolved");
        if (O.isNone(resolvedEvent)) {
          return assert.fail("expected a Resolved event");
        }
        const resolved = resolvedEvent.value;

        assert.deepStrictEqual(
          A.map(resolved.sources, (s) => s.path),
          ["/a/.apprc", "/etc/.apprc"],
          "every layeredMerge source contributed, so naming only the first would be wrong"
        );
        assert.deepStrictEqual(
          A.map(resolved.sources, (s) => s.resolver),
          ["explicit", "explicit"]
        );
        assert.strictEqual(resolved.strategy, "layered-merge");
      })
    );
  });

  it.layer(
    readLayer({ "/a/.apprc": `{"port":8080}`, "/etc/.apprc": `{"port":80}` }, [
      ConfigResolver.explicitPath("/a/.apprc"),
      ConfigResolver.explicitPath("/etc/.apprc"),
    ]),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("Loaded carries every contributing source too", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.load;

        const collected = yield* drain(sub);
        const loadedEvent = findEvent(collected, "Loaded");
        if (O.isNone(loadedEvent)) {
          return assert.fail("expected a Loaded event");
        }
        const loaded = loadedEvent.value;

        assert.deepStrictEqual(
          A.map(loaded.sources, (s) => s.path),
          ["/a/.apprc", "/etc/.apprc"],
          "the subscriber and emit share one PubSub through sharedEventsLayer"
        );
      })
    );
  });
});

describe("ConfigEvent per-operation granularity", () => {
  it.layer(writeLayer(recordingFs({ "/explicit": MemoryFileSystem.directory() }), "/app/.apprc"), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("write emits Written", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.write(AppShape.make({ port: 3 }), "/explicit/.apprc");

        const drain1 = yield* drain(sub);
        assert.include(
          tagsOf(drain1),
          "Written",
          "Written is live, so the update test cannot pass vacuously; write never mkdirs, so /explicit pre-exists"
        );
      })
    );
  });

  it.layer(writeLayer(recordingFs({}), "/app/.apprc"), { timeout: "30 seconds" })((it) => {
    it.effect("save emits Saved", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.save(AppShape.make({ port: 3 }));

        const drain2 = yield* drain(sub);
        assert.include(tagsOf(drain2), "Saved", "Saved is live, so the update test cannot pass vacuously");
      })
    );
  });

  it.layer(writeLayer(recordingFs({ "/app/.apprc": `{"port":1}` }), "/app/.apprc"), { timeout: "30 seconds" })((it) => {
    it.effect("update emits Updated exactly once and does not emit Written or Saved", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }));

        const drain3 = yield* drain(sub);
        const tags = tagsOf(drain3);
        assert.lengthOf(
          A.filter(tags, (t) => t === "Updated"),
          1
        );
        assert.notInclude(tags, "Written");
        assert.notInclude(tags, "Saved", "update drives the internal write path, not the public save");
      })
    );
  });

  it.layer(writeLayer(recordingFs({ "/app/.apprc": `{"port":1}` }), "/app/.apprc"), { timeout: "30 seconds" })((it) => {
    it.effect("Updated names the path that was written", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.update((current) => AppShape.make({ port: current.port + 1 }));

        const drain4 = yield* drain(sub);
        const updatedEvent = findEvent(drain4, "Updated");
        if (O.isNone(updatedEvent)) {
          return assert.fail("expected an Updated event");
        }
        const updated = updatedEvent.value;
        assert.strictEqual(updated.path, "/app/.apprc");
      })
    );
  });
});

describe("ConfigEvent failure variants carry structured errors", () => {
  it.layer(readLayer({ "/app/.apprc": "{ not json" }), { timeout: "30 seconds" })((it) => {
    it.effect("ParseFailed is emitted with a structured ConfigCodecError, never a string", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* Effect.result(cfg.load);

        const collected = yield* drain(sub);
        const parseFailedEvent = findEvent(collected, "ParseFailed");
        if (O.isNone(parseFailedEvent)) {
          return assert.fail("expected a ParseFailed event");
        }
        const parseFailed = parseFailedEvent.value;

        assert.isNotString(parseFailed.error, "subscribers branch on the structured error, not on error.message");
        if (!P.hasProperty(parseFailed.error, "_tag")) return assert.fail("expected a tagged error");
        assert.strictEqual(parseFailed.error._tag, "ConfigCodecError");
      })
    );
  });

  it.layer(readLayer({ "/app/.apprc": `{"port":"not-a-number"}` }), { timeout: "30 seconds" })((it) => {
    it.effect("ValidationFailed is emitted with a structured ConfigValidationError, never a string", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* Effect.result(cfg.load);

        const collected = yield* drain(sub);
        const validationFailedEvent = findEvent(collected, "ValidationFailed");
        if (O.isNone(validationFailedEvent)) {
          return assert.fail("expected a ValidationFailed event");
        }
        const validationFailed = validationFailedEvent.value;

        assert.isNotString(validationFailed.error);
        if (!P.hasProperty(validationFailed.error, "_tag")) return assert.fail("expected a tagged error");
        assert.strictEqual(
          validationFailed.error._tag,
          "ConfigValidationError",
          "decode, not the codec, rejects the string port"
        );
      })
    );
  });
});

describe("ConfigEvents opt-in", () => {
  const noEventsLayer = ConfigFile.layer(AppConfig, {
    schema: AppShape,
    codec: JsonCodec,
    resolvers: [ConfigResolver.explicitPath("/app/.apprc")],
    strategy: MergeStrategy.firstMatch<AppShape>(),
  }).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ "/app/.apprc": `{"port":8080}` }), Path.layer)));

  it.layer(noEventsLayer, { timeout: "30 seconds" })((it) => {
    it.effect("a layer built without `events` loads with no ConfigEvents in context", () =>
      Effect.gen(function* () {
        const serviceOption5 = yield* Effect.serviceOption(ConfigEvents);
        assertNone(serviceOption5);

        const cfg = yield* AppConfig;
        const value = yield* cfg.load;
        assert.strictEqual(value.port, 8080, "emit short-circuits, so the layer builds with no ConfigEvents provided");
      })
    );
  });

  it.layer(Layer.mergeAll(sharedEventsLayer, noEventsLayer), { timeout: "30 seconds" })((it) => {
    it.effect("publishes nothing when `events` is omitted, even if ConfigEvents is in context", () =>
      Effect.gen(function* () {
        const svc = yield* ConfigEvents;
        const sub = yield* PubSub.subscribe(svc.events);
        const cfg = yield* AppConfig;
        yield* cfg.load;

        const drain6 = yield* drain(sub);
        assert.deepStrictEqual(tagsOf(drain6), [], "emit is gated on options.events and never looks the service up");
      })
    );
  });

  it.layer(
    Layer.mergeAll(
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
      }).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ "/app/.apprc": `{"port":8080}` }), Path.layer)))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a structurally invalid consumer-supplied hub never fails a config load", () =>
      Effect.gen(function* () {
        const cfg = yield* AppConfig;
        const value = yield* cfg.load;
        assert.strictEqual(value.port, 8080, "PubSub.publish throws reading the fake hub, and catchDefect absorbs it");
      })
    );
  });
});

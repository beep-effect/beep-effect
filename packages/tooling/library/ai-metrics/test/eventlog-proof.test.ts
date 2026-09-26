import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref, Schema } from "effect";
import * as EventGroup from "effect/eventlog/EventGroup";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as EventLog from "effect/eventlog/EventLog";
import * as EventLogEncryption from "effect/eventlog/EventLogEncryption";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const TurnProjectedPayload = Schema.Struct({
  sourcePathHash: Schema.String,
  turnId: Schema.String,
});

const AiMetricsProofGroup = EventGroup.empty.add({
  payload: TurnProjectedPayload,
  primaryKey: (payload) => payload.turnId,
  tag: "TurnProjected",
});

const schema = EventLog.schema(AiMetricsProofGroup);

const handlerLayer = (handled: Ref.Ref<ReadonlyArray<string>>) =>
  EventLog.group(AiMetricsProofGroup, (handlers) =>
    handlers.handle("TurnProjected", ({ payload }) => Ref.update(handled, (values) => [...values, payload.turnId]))
  ).pipe(Layer.provide(EventLog.layerRegistry));

const logLayer = (handled: Ref.Ref<ReadonlyArray<string>>) =>
  EventLog.layer(schema, handlerLayer(handled)).pipe(
    Layer.provide(EventJournal.layerMemory),
    Layer.provide(
      Layer.effect(EventLog.Identity, EventLog.makeIdentity).pipe(Layer.provide(EventLogEncryption.layerSubtle))
    )
  );

describe("@beep/repo-ai-metrics EventLog proof", () => {
  it.effect(
    "projects sanitized turn events through an in-memory EventLog",
    Effect.fn(function* () {
      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* Effect.gen(function* () {
        const log = yield* EventLog.EventLog;
        yield* log.write({
          event: "TurnProjected",
          payload: {
            sourcePathHash: "source-hash",
            turnId: "turn-1",
          },
          schema,
        });

        const entries = yield* log.entries;
        const seen = yield* Ref.get(handled);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.event).toBe("TurnProjected");
        expect(seen).toEqual(["turn-1"]);
      }).pipe(provideScopedLayer(logLayer(handled)));
    })
  );
});

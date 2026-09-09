import {
  ActorStoppedError,
  createEffectActor,
  type EffectActor,
  emitted,
  fromEffect,
  inspect,
  join,
  send,
  snapshots,
  waitFor,
} from "@beep/scratchpad/xstate-effect";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Stream from "effect/Stream";
import { type AnyActorRef, createMachine, type SnapshotFrom, types } from "xstate";

/**
 * Polls until `predicate` holds. The actor processes events on its own fiber,
 * so tests wait for the condition they assert on.
 */
const until = (predicate: () => boolean, timeoutMs = 1000) =>
  Effect.whileLoop({ while: () => !predicate(), body: () => Effect.sleep("1 millis"), step: () => {} }).pipe(
    Effect.timeout(timeoutMs)
  );

/**
 * Runs `drive` right after the API under test subscribes to the actor, so
 * tests never race the Effect scheduler with a timer.
 */
const afterSubscribe = (actor: AnyActorRef, drive: () => void): void => {
  const actorSubscribe = actor.subscribe.bind(actor);
  let driven = false;
  actor.subscribe = ((...args: Parameters<typeof actorSubscribe>) => {
    const subscription = actorSubscribe(...args);
    if (!driven) {
      driven = true;
      queueMicrotask(drive);
    }
    return subscription;
  }) as typeof actor.subscribe;
};

/** The `actor.inspect` counterpart of {@link afterSubscribe}. */
const afterInspect = (actor: EffectActor<typeof counterMachine>, drive: () => void): void => {
  const actorInspect = actor.inspect.bind(actor);
  actor.inspect = ((observer: Parameters<typeof actorInspect>[0]) => {
    const subscription = actorInspect(observer);
    queueMicrotask(drive);
    return subscription;
  }) as typeof actor.inspect;
};

const counterMachine = createMachine({
  schemas: {
    events: {
      INCREMENT: types<Record<never, never>>(),
      FINISH: types<Record<never, never>>(),
    },
  },
  context: { count: 0 },
  initial: "counting",
  states: {
    counting: {
      on: {
        INCREMENT: ({ context }) => ({
          context: { count: context.count + 1 },
        }),
        FINISH: { target: "finished" },
      },
    },
    finished: { type: "final" },
  },
  output: ({ context }) => ({ count: context.count }),
});

type CounterSnapshot = SnapshotFrom<typeof counterMachine>;
type DoneCounterSnapshot = CounterSnapshot & { status: "done" };

/** A type-predicate predicate, so `waitFor` narrows what it resolves with. */
const isDone = (snapshot: CounterSnapshot): snapshot is DoneCounterSnapshot => snapshot.status === "done";

const emitterMachine = createMachine({
  initial: "active",
  states: {
    active: {
      on: {
        PING: (_args, enq) => {
          enq.emit({ type: "pinged" });
        },
      },
    },
  },
});

describe("send", () => {
  it.live(
    "sends an event to the actor",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      yield* send(actor, { type: "INCREMENT" });

      yield* send(actor, { type: "INCREMENT" });

      yield* waitFor(actor, (state) => state.context.count === 2);

      expect(actor.getSnapshot().context).toEqual({ count: 2 });
    })
  );

  it.live(
    "accepts the data-last form",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      yield* send({ type: "INCREMENT" } as const)(actor);

      yield* waitFor(actor, (state) => state.context.count === 1);

      expect(actor.getSnapshot().context).toEqual({ count: 1 });
    })
  );

  it.live(
    "rejects events the actor cannot receive",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      const sendUnknownEvent = () =>
        // @ts-expect-error -- the event type is derived from the actor
        send(actor, { type: "UNKNOWN" });

      void sendUnknownEvent;
    })
  );
});

describe("snapshots", () => {
  it.live(
    "emits the current snapshot, then every change, and ends on completion",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.send({ type: "INCREMENT" });
        actor.send({ type: "FINISH" });
      });
      const collected = yield* Stream.runCollect(snapshots(actor));

      expect(collected.map((snapshot) => snapshot.context.count)).toEqual([0, 1, 1]);
      expect(collected.map((snapshot) => snapshot.status)).toEqual(["active", "active", "done"]);
    })
  );

  it.live(
    "emits the error snapshot and ends when the actor errors",
    Effect.fnUntraced(function* () {
      const failure = { code: "BOOM" as const };

      const actor = yield* Effect.fail(failure).pipe(
        Effect.delay(10),
        (value) => fromEffect(value),
        (value) => createEffectActor(value)
      );
      const collected = yield* Stream.runCollect(snapshots(actor));

      expect(collected.map((snapshot) => snapshot.status)).toEqual(["active", "error"]);
      expect(collected[1].error).toEqual(failure);
    })
  );

  it.live(
    "unsubscribes from the actor when the stream is interrupted",
    Effect.fnUntraced(function* () {
      let unsubscribed = 0;

      const actor = yield* createEffectActor(counterMachine);

      const actorSubscribe = actor.subscribe.bind(actor);

      actor.subscribe = ((...args: Parameters<typeof actorSubscribe>) => {
        const subscription = actorSubscribe(...args);
        queueMicrotask(() => {
          actor.send({ type: "INCREMENT" });
          actor.send({ type: "INCREMENT" });
        });
        return {
          unsubscribe: () => {
            unsubscribed++;
            subscription.unsubscribe();
          },
        };
      }) as typeof actor.subscribe;
      const collected = yield* Stream.runCollect(snapshots(actor).pipe(Stream.take(2)));

      expect(collected.map((snapshot) => snapshot.context.count)).toEqual([0, 1]);
      expect(unsubscribed).toBe(1);
    })
  );
});

describe("emitted", () => {
  it.live(
    "streams emitted events and ends when the actor stops",
    Effect.fnUntraced(function* () {
      const collected: unknown[] = [];

      const actor = yield* createEffectActor(emitterMachine);

      let listening = false;

      const actorOn = actor.on.bind(actor);

      actor.on = ((...args: Parameters<typeof actorOn>) => {
        listening = true;
        return actorOn(...args);
      }) as typeof actor.on;

      const fiber = yield* Effect.forkScoped(
        Stream.runForEach(emitted(actor), (event) =>
          Effect.sync(() => {
            collected.push(event);
          })
        )
      );

      yield* until(() => listening);

      actor.send({ type: "PING" });

      actor.send({ type: "PING" });

      yield* until(() => collected.length === 2);

      actor.stop();

      yield* Fiber.join(fiber);

      expect(collected).toEqual([{ type: "pinged" }, { type: "pinged" }]);
    })
  );
});

describe("waitFor", () => {
  it.live(
    "resolves immediately when the current snapshot matches",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);
      const snapshot = yield* waitFor(actor, (state) => state.context.count === 0);

      expect(snapshot.context).toEqual({ count: 0 });
    })
  );

  it.live(
    "resolves on the first later snapshot that matches",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.send({ type: "INCREMENT" });
        actor.send({ type: "INCREMENT" });
      });
      const snapshot = yield* waitFor(actor, (state) => state.context.count === 2);

      expect(snapshot.context).toEqual({ count: 2 });
    })
  );

  it.live(
    "accepts the data-last form",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.send({ type: "INCREMENT" });
      });
      const snapshot = yield* waitFor((state: CounterSnapshot) => state.context.count === 1)(actor);

      expect(snapshot.context).toEqual({ count: 1 });
    })
  );

  it.live(
    "narrows the snapshot with a type-predicate predicate",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.send({ type: "FINISH" });
      });
      const snapshot = yield* waitFor(actor, isDone);

      snapshot satisfies { status: "done" };
      expect(snapshot.output).toEqual({ count: 0 });
    })
  );

  it.live(
    "narrows the snapshot with a data-last refinement",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);
      afterSubscribe(actor, () => {
        actor.send({ type: "FINISH" });
      });
      const snapshot = yield* waitFor(isDone)(actor);

      snapshot satisfies { status: "done" };
      expect(snapshot.output).toEqual({ count: 0 });
    })
  );

  it.live(
    "fails with ActorStoppedError when the actor stops first",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.stop();
      });
      const error = yield* Effect.flip(waitFor(actor, (state) => state.context.count === 10));

      expect(error).toBeInstanceOf(ActorStoppedError);
      expect(error.message).toMatch(/stopped before completing/);
    })
  );

  it.live(
    "fails with TimeoutError when the timeout elapses",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);
      const error = yield* Effect.flip(
        waitFor(actor, (state) => state.context.count === 10, {
          timeout: Duration.millis(10),
        })
      );

      expect(Cause.isTimeoutError(error)).toBe(true);
    })
  );
});

describe("join", () => {
  it.live(
    "succeeds with the actor output when it is done",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.send({ type: "INCREMENT" });
        actor.send({ type: "FINISH" });
      });
      const output = yield* pipe(actor, join, Effect.orDie);

      expect(output).toEqual({ count: 1 });
    })
  );

  it.live(
    "fails with the typed actor error",
    Effect.fnUntraced(function* () {
      const failure = { code: "X" as const };

      const actor = yield* Effect.fail(failure).pipe(
        Effect.delay(10),
        (value) => fromEffect(value),
        (value) => createEffectActor(value)
      );
      const error = yield* Effect.flip(join(actor));

      error satisfies { code: "X" } | ActorStoppedError;
      expect(error).toEqual(failure);
    })
  );

  it.live(
    "fails with ActorStoppedError when the actor is stopped",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterSubscribe(actor, () => {
        actor.stop();
      });
      const exit = yield* pipe(actor, join, Effect.exit);
      const failed = Exit.isFailure(exit);
      assert(failed);
      expect(Cause.squash(exit.cause)).toBeInstanceOf(ActorStoppedError);
    })
  );
});

describe("inspect", () => {
  it.live(
    "streams inspection events from the actor system",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(counterMachine);

      afterInspect(actor, () => {
        actor.send({ type: "INCREMENT" });
      });
      const events = yield* Stream.runCollect(inspect(actor).pipe(Stream.take(1)));

      expect(events.map((event) => event.type)).toEqual(["@xstate.transition"]);
      expect(events[0]).toMatchObject({ event: { type: "INCREMENT" } });
    })
  );
});

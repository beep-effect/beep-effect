import type { EffectActionArgs, EffectSourceArgs } from "@beep/scratchpad/xstate-effect";
import {
  createEffectActor,
  deadLetters,
  type EffectActor,
  EffectInterruptedError,
  emitted,
  fromEffect,
  fromEffectStream,
  setupEffect,
  waitFor,
} from "@beep/scratchpad/xstate-effect";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { TestClock } from "effect/testing";
import { type AnyActorRef, createMachine, setup } from "xstate";

/**
 * Polls until `predicate` holds. Effects run on detached fibers, so tests wait
 * for the condition they assert on instead of for a fixed number of ticks.
 */
const until = (predicate: () => boolean, timeoutMs = 1000) =>
  Effect.whileLoop({ while: () => !predicate(), body: () => Effect.sleep("1 millis"), step: () => {} }).pipe(
    Effect.timeout(timeoutMs)
  );

describe("@xstate/effect runtime", () => {
  it.live(
    "stops the actor and interrupts its Effect when the enclosing scope closes",
    Effect.fnUntraced(function* () {
      let started = false;
      let interrupted = false;
      const logic = Effect.ensuring(
        Effect.sync(() => {
          started = true;
        }).pipe(Effect.andThen(Effect.never)),
        Effect.sync(() => {
          interrupted = true;
        })
      ).pipe((value) => fromEffect(value));
      let actor!: EffectActor<typeof logic>;

      yield* Effect.gen(function* () {
        actor = yield* createEffectActor(logic);
        yield* until(() => started);

        expect(actor.getSnapshot().status).toBe("active");
        expect(interrupted).toBe(false);
      }).pipe(Effect.scoped);

      expect(actor.getSnapshot().status).toBe("stopped");
      expect(interrupted).toBe(true);
    })
  );

  it.live(
    "releases actor-scoped finalizers when the actor is stopped",
    Effect.fnUntraced(function* () {
      let started = false;
      let released = 0;
      const logic = Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            released++;
          })
        );
        started = true;
        return yield* Effect.never;
      }).pipe((value) => fromEffect(value));
      const actor = yield* createEffectActor(logic);
      yield* until(() => started);

      expect(released).toBe(0);

      actor.stop();
      yield* until(() => released === 1);

      expect(released).toBe(1);
    })
  );

  it.live(
    "releases actor-scoped finalizers when the enclosing scope closes",
    Effect.fnUntraced(function* () {
      let started = false;
      let released = 0;

      yield* Effect.gen(function* () {
        yield* Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              released++;
            })
          );
          started = true;
          return yield* Effect.never;
        }).pipe(
          (value) => fromEffect(value),
          (value) => createEffectActor(value)
        );
        yield* until(() => started);

        expect(released).toBe(0);
      }).pipe(Effect.scoped);

      expect(released).toBe(1);
    })
  );

  it.live(
    "keeps actor-scoped finalizers open after the Effect itself completes",
    Effect.fnUntraced(function* () {
      let completed = false;
      let released = 0;
      const machine = setupEffect({
        actions: {
          work: Effect.fn("work")(function* (_args: EffectActionArgs) {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                released++;
              })
            );
            completed = true;
          }),
        },
      }).createMachine({
        on: {
          WORK: (args, enq) => enq(args.actions.work, args),
        },
      });
      const actor = yield* createEffectActor(machine);

      actor.send({ type: "WORK" });
      yield* until(() => completed);

      expect(released).toBe(0);
      expect(actor.getSnapshot().status).toBe("active");

      actor.stop();
      yield* until(() => released === 1);

      expect(released).toBe(1);
    })
  );

  it.live(
    "runs a hosted finalizer before Effect.scoped resolves",
    Effect.fnUntraced(function* () {
      const order: string[] = [];
      let started = false;

      yield* Effect.gen(function* () {
        yield* Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              order.push("finalizer");
            })
          );
          started = true;
          return yield* Effect.never;
        }).pipe(
          (value) => fromEffect(value),
          (value) => createEffectActor(value)
        );
        yield* until(() => started);
      }).pipe(Effect.scoped);
      order.push("scope closed");

      expect(order).toEqual(["finalizer", "scope closed"]);
    })
  );

  it.live(
    "runs a hosted finalizer when the actor errors",
    Effect.fnUntraced(function* () {
      let released = 0;
      const logic = Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            released++;
          })
        );
        return yield* Effect.fail({ code: "BOOM" as const }).pipe(Effect.delay(1));
      }).pipe((value) => fromEffect(value));
      const actor = yield* createEffectActor(logic);
      actor.subscribe({ error: () => {} });
      yield* until(() => actor.getSnapshot().status === "error");
      yield* until(() => released === 1);

      expect(released).toBe(1);
    })
  );

  it.live(
    "tolerates stopping an actor before its scope closes",
    Effect.fnUntraced(function* () {
      let started = false;
      let released = 0;

      yield* Effect.gen(function* () {
        const actor = yield* Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              released++;
            })
          );
          started = true;
          return yield* Effect.never;
        }).pipe(
          (value) => fromEffect(value),
          (value) => createEffectActor(value)
        );
        yield* until(() => started);

        actor.stop();
        actor.stop();
        yield* until(() => released === 1);

        expect(actor.getSnapshot().status).toBe("stopped");
      }).pipe(Effect.scoped);

      expect(released).toBe(1);
    })
  );

  it.effect(
    "drives delayed transitions with the Effect clock",
    Effect.fnUntraced(function* () {
      const machine = createMachine({
        initial: "green",
        states: {
          green: { after: { 1000: { target: "yellow" } } },
          yellow: {},
        },
      });

      yield* Effect.gen(function* () {
        const actor = yield* createEffectActor(machine);

        expect(actor.getSnapshot().value).toBe("green");

        yield* TestClock.adjust("1 second");
        yield* waitFor(actor, (snapshot) => snapshot.value === "yellow");

        expect(actor.getSnapshot().value).toBe("yellow");
      }).pipe(Effect.scoped);
    })
  );

  it.effect(
    "interrupts a pending after timer when the enclosing scope closes",
    Effect.fnUntraced(function* () {
      let entered = 0;
      const machine = createMachine({
        initial: "green",
        states: {
          green: { after: { 1000: { target: "yellow" } } },
          yellow: {
            entry: () => {
              entered++;
            },
          },
        },
      });

      yield* Effect.gen(function* () {
        yield* createEffectActor(machine);
        yield* TestClock.adjust("500 millis");
      }).pipe(Effect.scoped);

      // The timer fiber lived in the actor scope, which is now closed.
      yield* TestClock.adjust("5 seconds");

      expect(entered).toBe(0);
    })
  );

  it.live(
    "reports self-interruption as an EffectInterruptedError",
    Effect.fnUntraced(function* () {
      const actor = yield* Effect.interrupt.pipe(
        (value) => fromEffect(value),
        (value) => createEffectActor(value)
      );
      yield* until(() => actor.getSnapshot().status === "error");

      const snapshot = actor.getSnapshot();
      const error: unknown = snapshot.error;
      expect(error).toBeInstanceOf(EffectInterruptedError);
      expect((error as EffectInterruptedError)._tag).toBe("EffectInterruptedError");
    })
  );

  it.live(
    "reports an Effect.timeout as a TimeoutError failure",
    Effect.fnUntraced(function* () {
      const logic = Effect.timeout(Effect.never, Duration.millis(1)).pipe((value) => fromEffect(value));
      const actor = yield* createEffectActor(logic);
      actor.subscribe({ error: () => {} });
      yield* until(() => actor.getSnapshot().status === "error");

      const error: unknown = actor.getSnapshot().error;
      expect((error as { _tag?: string })._tag).toBe("TimeoutError");
      expect(error).not.toBeInstanceOf(EffectInterruptedError);
    })
  );

  it.live(
    "reports a defect from Effect.die as the actor error",
    Effect.fnUntraced(function* () {
      const defect = new Error("defect");
      const actor = yield* Effect.die(defect).pipe(
        (value) => fromEffect(value),
        (value) => createEffectActor(value)
      );
      yield* until(() => actor.getSnapshot().status === "error");

      expect(actor.getSnapshot().status).toBe("error");
      expect(actor.getSnapshot().error).toBe(defect);
    })
  );

  it.live(
    "routes an interrupted invoked Effect to onError",
    Effect.fnUntraced(function* () {
      let received: unknown;
      const worker = Effect.interrupt.pipe((value) => fromEffect(value));
      const machine = setup({ actors: { worker } }).createMachine({
        initial: "pending",
        states: {
          pending: {
            invoke: {
              src: "worker",
              onError: ({ event }) => {
                received = event.error;
                return { target: "failed" };
              },
            },
          },
          failed: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      yield* until(() => actor.getSnapshot().value === "failed");

      expect(received).toBeInstanceOf(EffectInterruptedError);
    })
  );

  it.live(
    "does not report interruption when the invoking state exits",
    Effect.fnUntraced(function* () {
      let interrupted = false;
      const worker = Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      ).pipe((value) => fromEffect(value));
      const machine = setup({ actors: { worker } }).createMachine({
        initial: "working",
        states: {
          working: {
            invoke: { src: "worker", id: "worker" },
            on: { CANCEL: { target: "cancelled" } },
          },
          cancelled: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      const child = actor.getSnapshot().children.worker;

      actor.send({ type: "CANCEL" });
      yield* until(() => interrupted);

      expect(actor.getSnapshot().value).toBe("cancelled");
      expect(actor.getSnapshot().status).toBe("active");
      expect(child?.getSnapshot().status).toBe("stopped");
      expect(child?.getSnapshot().error).toBeUndefined();
    })
  );

  it.live(
    "interrupts a running Effect action when its actor is stopped",
    Effect.fnUntraced(function* () {
      let started = false;
      let interrupted = false;
      const machine = setupEffect({
        actions: {
          work: (_args) =>
            Effect.ensuring(
              Effect.sync(() => {
                started = true;
              }).pipe(Effect.andThen(Effect.never)),
              Effect.sync(() => {
                interrupted = true;
              })
            ),
        },
      }).createMachine({
        initial: "active",
        states: {
          active: {
            on: {
              WORK: (args, enq) => enq(args.actions.work, args),
            },
          },
        },
      });
      const actor = yield* createEffectActor(machine);

      actor.send({ type: "WORK" });
      yield* until(() => started);
      actor.stop();
      yield* until(() => interrupted);

      expect(interrupted).toBe(true);
    })
  );

  it.live(
    "does not block the actor while an Effect action runs",
    Effect.fnUntraced(function* () {
      let started = false;
      let finished = false;
      const machine = setupEffect({
        actions: {
          work: Effect.fn("work")(function* (_args: EffectActionArgs) {
            started = true;
            return yield* Effect.never.pipe(
              Effect.andThen(
                Effect.sync(() => {
                  finished = true;
                })
              )
            );
          }),
        },
      }).createMachine({
        context: { count: 0 },
        on: {
          WORK: (args, enq) => enq(args.actions.work, args),
          PING: ({ context }) => ({ context: { count: context.count + 1 } }),
        },
      });
      const actor = yield* createEffectActor(machine);

      actor.send({ type: "WORK" });
      yield* until(() => started);
      actor.send({ type: "PING" });
      yield* until(() => actor.getSnapshot().context.count === 1);

      expect(actor.getSnapshot().context).toEqual({ count: 1 });
      expect(finished).toBe(false);
    })
  );

  it.live(
    "runs an Effect action provided through machine.provide in the host context",
    Effect.fnUntraced(function* () {
      class Audit extends Context.Service<Audit, { record: (value: string) => void }>()(
        "@beep/scratchpad/test/xstate-effect/runtime.test/Audit"
      ) {}
      const recorded: string[] = [];
      const machine = setupEffect({
        actions: {
          audit: (_args) => Audit.use((audit) => Effect.sync(() => audit.record("declared"))),
        },
      }).createMachine({
        on: {
          AUDIT: (args, enq) => enq(args.actions.audit, args),
        },
      });
      const provided = machine.provide({
        actions: {
          audit: (_args: unknown) => Audit.use((audit) => Effect.sync(() => audit.record("provided"))),
        },
      });

      const actor = yield* Effect.provideService(createEffectActor(provided), Audit, {
        record: (value) => recorded.push(value),
      });
      actor.send({ type: "AUDIT" });
      yield* until(() => recorded.length > 0, 50);

      expect(recorded).toEqual(["provided"]);
    })
  );

  it.live(
    "runs a plain action provided through machine.provide",
    Effect.fnUntraced(function* () {
      const recorded: string[] = [];
      const machine = setupEffect({
        actions: {
          audit: (_args) => Effect.sync(() => recorded.push("declared")),
        },
      }).createMachine({
        on: {
          AUDIT: (args, enq) => enq(args.actions.audit, args),
        },
      });
      const provided = machine.provide({
        actions: {
          audit: () => {
            recorded.push("provided");
          },
        },
      });

      const actor = yield* createEffectActor(provided);
      actor.send({ type: "AUDIT" });
      yield* until(() => recorded.length > 0);

      expect(recorded).toEqual(["provided"]);
      yield* Effect.yieldNow;
      expect(actor.getSnapshot().status).toBe("active");
    })
  );

  it.live(
    "observes events emitted from the fromEffect source args",
    Effect.fnUntraced(function* () {
      const gate = yield* Deferred.make<void>();
      const logic = fromEffect(
        Effect.fn("source")(function* ({ emit }: EffectSourceArgs<undefined>) {
          yield* Deferred.await(gate);
          emit({ type: "progress", value: 1 });
          emit({ type: "progress", value: 2 });
          return "done";
        })
      );

      const collected: unknown[] = [];

      const actor = yield* createEffectActor(logic);

      let listeners = 0;

      const actorOn = actor.on.bind(actor);

      actor.on = ((...args: Parameters<typeof actorOn>) => {
        listeners++;
        return actorOn(...args);
      }) as typeof actor.on;

      yield* Effect.forkScoped(
        Stream.runForEach(emitted(actor), (event) =>
          Effect.sync(() => {
            collected.push(event);
          })
        )
      );

      yield* until(() => listeners > 0);

      yield* Deferred.succeed(gate, undefined);

      yield* until(() => collected.length === 2);

      expect(collected).toEqual([
        { type: "progress", value: 1 },
        { type: "progress", value: 2 },
      ]);
    })
  );

  it.live(
    "reports a failing Effect stream as an actor error",
    Effect.fnUntraced(function* () {
      const failure = { code: "STREAM_FAILED" as const };
      const actor = yield* Stream.fail(failure).pipe(
        (value) => fromEffectStream(value),
        (value) => createEffectActor(value)
      );
      yield* until(() => actor.getSnapshot().status === "error");

      expect(actor.getSnapshot().error).toEqual(failure);
    })
  );

  it.live(
    "interrupts an Effect stream when the invoking state exits",
    Effect.fnUntraced(function* () {
      let interrupted = false;
      const worker = Stream.fromEffect(
        Effect.ensuring(
          Effect.never,
          Effect.sync(() => {
            interrupted = true;
          })
        )
      ).pipe((value) => fromEffectStream(value));
      const machine = setup({ actors: { worker } }).createMachine({
        initial: "streaming",
        states: {
          streaming: {
            invoke: { src: "worker" },
            on: { CANCEL: { target: "cancelled" } },
          },
          cancelled: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      actor.send({ type: "CANCEL" });
      yield* until(() => interrupted);

      expect(actor.getSnapshot().value).toBe("cancelled");
    })
  );

  it.live(
    "does not report interruption of an Effect that loses an internal race",
    Effect.fnUntraced(function* () {
      let loserReleased = false;
      const logic = Effect.race(
        Effect.as(Effect.sleep("5 millis"), "winner"),
        Effect.ensuring(
          Effect.never,
          Effect.sync(() => {
            loserReleased = true;
          })
        )
      ).pipe((value) => fromEffect(value));

      const actor = yield* createEffectActor(logic);
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().output).toBe("winner");
      expect(actor.getSnapshot().error).toBeUndefined();
      expect(loserReleased).toBe(true);
    })
  );

  it.live(
    "resolves the Effect host through the parent chain",
    Effect.fnUntraced(function* () {
      class Greeting extends Context.Service<Greeting, { value: string }>()(
        "@beep/scratchpad/test/xstate-effect/runtime.test/Greeting"
      ) {}
      const leaf = fromEffect(Greeting.use((greeting) => Effect.succeed(greeting.value)));
      const child = setup({ actors: { leaf } }).createMachine({
        context: { greeting: "" },
        initial: "pending",
        states: {
          pending: {
            invoke: {
              src: "leaf",
              onDone: {
                target: "done",
                context: ({ event }) => ({ greeting: event.output }),
              },
            },
          },
          done: { type: "final" },
        },
      });
      const root = setup({ actors: { child } }).createMachine({
        initial: "pending",
        states: {
          pending: {
            invoke: { src: "child", id: "child", onDone: { target: "done" } },
          },
          done: {},
        },
      });

      const actor = yield* Effect.provideService(createEffectActor(root), Greeting, {
        value: "from the root",
      });
      yield* until(() => actor.getSnapshot().value === "done");

      expect(actor.getSnapshot().value).toBe("done");
    })
  );

  it.live(
    "runs spawned Effect logic in the host Effect context",
    Effect.fnUntraced(function* () {
      class Greeting extends Context.Service<Greeting, { value: string }>()(
        "@beep/scratchpad/test/xstate-effect/runtime.test/Greeting"
      ) {}
      const leaf = fromEffect(Greeting.use((greeting) => Effect.succeed(greeting.value)));
      const machine = setup({ actors: { leaf } }).createMachine({
        context: { ref: undefined as AnyActorRef | undefined },
        entry: ({ actors }, enq) => ({
          context: { ref: enq.spawn(actors.leaf) },
        }),
      });

      const actor = yield* Effect.provideService(createEffectActor(machine), Greeting, {
        value: "spawned",
      });
      const ref = O.getOrThrow(O.fromUndefinedOr(actor.getSnapshot().context.ref));
      yield* until(() => ref.getSnapshot().status === "done");

      expect(ref.getSnapshot().output).toBe("spawned");
    })
  );

  it.live(
    "rejects inline Effect logic passed to enq.spawn",
    Effect.fnUntraced(function* () {
      const machine = setup({}).createMachine({
        context: { ref: undefined as AnyActorRef | undefined },
        entry: (_args, enq) => ({
          context: { ref: enq.spawn(Effect.succeed("inline").pipe((value) => fromEffect(value))) },
        }),
      });

      const actor = yield* createEffectActor(machine);
      const ref = O.getOrThrow(O.fromUndefinedOr(actor.getSnapshot().context.ref));
      yield* until(() => ref.getSnapshot().status === "error");

      expect(String(ref.getSnapshot().error)).toMatch(/must be declared in setup\(\{ actors \}\)/);
    })
  );

  it.live(
    "rejects inline spawned logic even when another invoke has a dynamic src",
    Effect.fnUntraced(function* () {
      const leaf = Effect.succeed("leaf").pipe((value) => fromEffect(value));
      const machine = setup({ actors: { leaf } }).createMachine({
        context: {
          declared: undefined as AnyActorRef | undefined,
          inline: undefined as AnyActorRef | undefined,
        },
        initial: "working",
        states: {
          working: {
            invoke: {
              src: ({ actors }) => actors.leaf,
              id: "dynamic",
              onDone: { target: "done" },
            },
            entry: ({ actors }, enq) => ({
              context: {
                declared: enq.spawn(actors.leaf),
                inline: enq.spawn(Effect.succeed("inline").pipe((value) => fromEffect(value))),
              },
            }),
          },
          done: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      const declared = O.getOrThrow(O.fromUndefinedOr(actor.getSnapshot().context.declared));
      const inline = O.getOrThrow(O.fromUndefinedOr(actor.getSnapshot().context.inline));
      yield* until(() => declared.getSnapshot().status === "done");
      yield* until(() => inline.getSnapshot().status === "error");
      yield* until(() => actor.getSnapshot().value === "done");

      // A declared actor spawned by name is allowed…
      expect(declared.getSnapshot().output).toBe("leaf");
      // …an inline one is not, even though a dynamic `invoke.src` is nearby…
      expect(String(inline.getSnapshot().error)).toMatch(/must be declared in setup\(\{ actors \}\)/);
      // …and the dynamically invoked child still ran.
      expect(actor.getSnapshot().value).toBe("done");
    })
  );

  it.live(
    "routes a defect in an Effect action to onError",
    Effect.fnUntraced(function* () {
      const defect = new Error("boom");
      let received: unknown;
      const machine = setupEffect({
        actions: {
          boom: (_args) => Effect.die(defect),
        },
      }).createMachine({
        initial: "active",
        states: {
          active: {
            on: { BOOM: (args, enq) => enq(args.actions.boom, args) },
            onError: ({ event }) => {
              received = event.error;
              return { target: "failed" };
            },
          },
          failed: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      actor.send({ type: "BOOM" });
      yield* until(() => actor.getSnapshot().value === "failed");

      expect(received).toBe(defect);
    })
  );

  it.live(
    "reports a send to a stopped actor as a dead letter",
    Effect.fnUntraced(function* () {
      const worker = Effect.never.pipe((value) => fromEffect(value));
      const machine = setup({ actors: { worker } }).createMachine({
        initial: "working",
        states: {
          working: {
            invoke: { src: "worker", id: "worker" },
            on: { CANCEL: { target: "cancelled" } },
          },
          cancelled: {},
        },
      });
      const letters: Array<{ reason: string; type: string }> = [];

      const actor = yield* createEffectActor(machine);

      const actorInspect = actor.inspect.bind(actor);

      let inspecting = false;

      actor.inspect = ((observer: Parameters<typeof actorInspect>[0]) => {
        inspecting = true;
        return actorInspect(observer);
      }) as typeof actor.inspect;

      yield* Effect.forkScoped(
        Stream.runForEach(deadLetters(actor), (event) =>
          Effect.sync(() => {
            letters.push({
              reason: event.reason,
              type: event.event.type,
            });
          })
        )
      );

      yield* until(() => inspecting);

      const child = O.getOrThrow(O.fromUndefinedOr(actor.getSnapshot().children.worker));

      actor.send({ type: "CANCEL" });

      yield* until(() => child.getSnapshot().status === "stopped");

      child.send({ type: "TO_CHILD" });

      actor.stop();

      actor.send({ type: "TO_ROOT" });

      yield* until(() => letters.length === 2);

      expect(letters).toEqual([
        { reason: "stopped", type: "TO_CHILD" },
        { reason: "stopped", type: "TO_ROOT" },
      ]);
    })
  );

  it.live(
    "accepts a fromEffect config without schemas",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        id: "loadUser",
        effect: ({ input }: { input: { id: string } }) => Effect.succeed({ greeting: `Hello ${input.id}` }),
      });

      // `EffectActorLogic` does not surface the `id` that `createLogic` sets.
      expect(logic.id).toBe("loadUser");

      const actor = yield* createEffectActor(logic, { input: { id: "42" } });
      yield* until(() => actor.getSnapshot().status === "done");

      actor.getSnapshot().output satisfies { greeting: string } | undefined;
      expect(actor.getSnapshot().output).toEqual({ greeting: "Hello 42" });
    })
  );

  it.live(
    "runs hosted Effects inside spans named after their source",
    Effect.fnUntraced(function* () {
      const spans: Array<{ name: string; attributes: Record<string, unknown> }> = [];
      const record = Effect.gen(function* () {
        const span = yield* Effect.currentSpan;
        spans.push({
          name: span.name,
          attributes: Object.fromEntries(span.attributes),
        });
      });
      const worker = Effect.as(record, "ok").pipe((value) => fromEffect(value));
      const machine = setupEffect({
        actors: { worker },
        actions: { audit: (_args) => record },
      }).createMachine({
        initial: "pending",
        on: { AUDIT: (args, enq) => enq(args.actions.audit, args) },
        states: {
          pending: {
            invoke: { src: "worker", id: "worker", onDone: { target: "done" } },
          },
          done: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      yield* until(() => actor.getSnapshot().value === "done");
      actor.send({ type: "AUDIT" });
      yield* until(() => spans.length === 2);

      expect(spans[0]).toEqual({
        name: "fromEffect",
        attributes: {
          "xstate.actor.id": "worker",
          "xstate.actor.address": `${actor.address}/worker`,
        },
      });
      expect(spans[1]).toEqual({
        name: "action.audit",
        attributes: {
          "xstate.actor.id": actor.id,
          "xstate.actor.address": actor.address,
        },
      });
    })
  );
});

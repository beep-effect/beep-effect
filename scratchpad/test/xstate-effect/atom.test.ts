import { fromEffect, setupEffect } from "@beep/scratchpad/xstate-effect";
import { createActorAtoms, NotReadyError } from "@beep/scratchpad/xstate-effect/atom";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { createMachine, setup } from "xstate";

const until = (predicate: () => boolean, timeoutMs = 1000) =>
  Effect.whileLoop({ while: () => !predicate(), body: () => Effect.sleep("1 millis"), step: () => {} }).pipe(
    Effect.timeout(timeoutMs)
  );

const counterMachine = createMachine({
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } }),
  },
});

describe("createActorAtoms", () => {
  it.live(
    "accepts the data-last form",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.empty);
      const atoms = createActorAtoms(counterMachine)(runtime);

      const unmount = registry.mount(atoms.snapshot);
      yield* until(() => AsyncResult.isSuccess(registry.get(atoms.snapshot)));
      registry.set(atoms.send, { type: "INC" });
      yield* until(() => {
        const snapshot = registry.get(atoms.snapshot);
        return AsyncResult.isSuccess(snapshot) && snapshot.value.context.count === 1;
      });
      unmount();
    })
  );

  it.live(
    "starts the actor on first read and exposes its snapshot",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.empty);
      const atoms = createActorAtoms(runtime, counterMachine);

      const unmount = registry.mount(atoms.snapshot);
      yield* until(() => AsyncResult.isSuccess(registry.get(atoms.snapshot)));

      const snapshot = registry.get(atoms.snapshot);
      expect(AsyncResult.isSuccess(snapshot) && snapshot.value.context).toEqual({
        count: 0,
      });
      unmount();
    })
  );

  it.live(
    "sends events through the send atom and updates the snapshot",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.empty);
      const atoms = createActorAtoms(runtime, counterMachine);
      const counts: number[] = [];

      const unsubscribe = registry.subscribe(
        atoms.select((snapshot) => snapshot.context.count),
        (result) => {
          if (AsyncResult.isSuccess(result)) {
            counts.push(result.value);
          }
        },
        { immediate: true }
      );
      yield* until(() => counts.length > 0);

      registry.set(atoms.send, { type: "INC" });
      registry.set(atoms.send, { type: "INC" });
      yield* until(() => counts.at(-1) === 2);

      expect(counts).toEqual([0, 1, 2]);
      unsubscribe();
    })
  );

  it.live(
    "runs Effect logic with services from the runtime layer",
    Effect.fnUntraced(function* () {
      class Greeting extends Context.Service<Greeting, { value: string }>()(
        "@beep/scratchpad/test/xstate-effect/atom.test/Greeting"
      ) {}
      const greet = fromEffect(Greeting.use((greeting) => Effect.succeed(greeting.value)));
      const machine = setup({ actors: { greet } }).createMachine({
        context: { greeting: "" },
        initial: "loading",
        states: {
          loading: {
            invoke: {
              src: "greet",
              onDone: {
                target: "done",
                context: ({ event }) => ({ greeting: event.output }),
              },
            },
          },
          done: {},
        },
      });
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.succeed(Greeting, { value: "hello" }));
      const atoms = createActorAtoms(runtime, machine);

      const unmount = registry.mount(atoms.snapshot);
      yield* until(() => {
        const result = registry.get(atoms.snapshot);
        return AsyncResult.isSuccess(result) && result.value.value === "done";
      });

      const result = registry.get(atoms.snapshot);
      expect(AsyncResult.isSuccess(result) && result.value.context).toEqual({
        greeting: "hello",
      });
      unmount();
    })
  );

  it("rejects a runtime that does not provide a required service", () => {
    class Greeting extends Context.Service<Greeting, { value: string }>()(
      "@beep/scratchpad/test/xstate-effect/atom.test/Greeting"
    ) {}
    const machine = setupEffect({
      actions: {
        greet: (_args) => Greeting.use(() => Effect.void),
      },
    }).createMachine({
      on: { GREET: (args, enq) => enq(args.actions.greet, args) },
    });
    const runtime = Atom.runtime(Layer.empty);

    const create = () => {
      // @ts-expect-error -- the runtime layer does not provide Greeting
      createActorAtoms(runtime, machine);
    };
    void create;
  });

  it.live(
    "stops the actor when its atoms are released",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.empty);
      const atoms = createActorAtoms(runtime, counterMachine);

      const unmount = registry.mount(atoms.snapshot);
      yield* until(() => AsyncResult.isSuccess(registry.get(atoms.actor)));
      const result = registry.get(atoms.actor);
      const actor = AsyncResult.isSuccess(result) ? result.value : undefined;
      expect(actor?.getSnapshot().status).toBe("active");

      unmount();
      yield* until(() => actor?.getSnapshot().status === "stopped");

      expect(actor?.getSnapshot().status).toBe("stopped");
    })
  );

  it.live(
    "reports NotReadyError when an event is sent before the runtime is ready",
    Effect.fnUntraced(function* () {
      class Slow extends Context.Service<Slow, { ready: true }>()(
        "@beep/scratchpad/test/xstate-effect/atom.test/Slow"
      ) {}
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(
        Layer.effect(Slow, Effect.delay(Effect.succeed({ ready: true as const }), "5 millis"))
      );
      const atoms = createActorAtoms(runtime, counterMachine);

      const unmount = registry.mount(atoms.send);
      registry.set(atoms.send, { type: "INC" });
      const early = registry.get(atoms.send);
      expect(AsyncResult.isFailure(early)).toBe(true);
      expect(AsyncResult.isFailure(early) && Cause.squash(early.cause)).toBeInstanceOf(NotReadyError);

      yield* until(() => AsyncResult.isSuccess(registry.get(atoms.actor)));
      registry.set(atoms.send, { type: "INC" });
      const late = registry.get(atoms.actor);
      yield* until(() => AsyncResult.isSuccess(late) && late.value.getSnapshot().context.count === 1);
      expect(AsyncResult.isSuccess(late) && late.value.getSnapshot().context).toEqual({
        count: 1,
      });
      expect(AsyncResult.isSuccess(registry.get(atoms.send))).toBe(true);
      unmount();
    })
  );

  it.live(
    "exposes an errored actor as a failed result",
    Effect.fnUntraced(function* () {
      const failure = { code: "BOOM" as const };
      const registry = AtomRegistry.make();
      const runtime = Atom.runtime(Layer.empty);
      const atoms = createActorAtoms(runtime, fromEffect(Effect.fail(failure)));

      const unmount = registry.mount(atoms.result);
      yield* until(() => AsyncResult.isFailure(registry.get(atoms.result)));

      const result = registry.get(atoms.result);
      expect(AsyncResult.isFailure(result) && Cause.squash(result.cause)).toEqual(failure);
      unmount();
    })
  );
});

import { assert } from "@effect/vitest";

const prototypeKey = "__proto__";

import type { RequirementsFrom } from "@beep/scratchpad/xstate-effect";
import {
  createEffectActor,
  fromEffect,
  fromEffectEventStream,
  fromEffectStream,
  setupEffect,
} from "@beep/scratchpad/xstate-effect";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { createActor, createMachine, initialTransition, type StandardSchemaV1, setup, types } from "xstate";
import { standardSchemaValidator } from "xstate/validation";

/**
 * Polls until `predicate` holds. Effects run on detached fibers, so tests wait
 * for the condition they assert on instead of for a fixed number of ticks.
 */
const until = (predicate: () => boolean, timeoutMs = 1000) =>
  Effect.whileLoop({ while: () => !predicate(), body: () => Effect.sleep("1 millis"), step: () => {} }).pipe(
    Effect.timeout(timeoutMs)
  );

/**
 * Runs a value through a converted schema with the Standard Schema interface
 * XState validates against, and reports whether the schema rejected it.
 */
const rejects = (schema: StandardSchemaV1, value: unknown): boolean => {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) {
    throw new Error("Expected a synchronous schema");
  }
  return result.issues !== undefined;
};

describe("@xstate/effect", () => {
  it.live(
    "accepts Effect schemas in setupEffect with full type inference",
    Effect.fnUntraced(function* () {
      const effectSetup = setupEffect({
        schemas: {
          context: S.Struct({ count: S.Finite }),
          events: {
            ADD: S.Struct({ value: S.Finite }),
            RESET: types<Record<never, never>>(),
          },
        },
      });
      const machine = effectSetup.createMachine({
        context: { count: 0 },
        initial: "active",
        states: {
          active: {
            on: {
              ADD: ({ context, event }) => {
                context.count satisfies number;
                event.value satisfies number;
                return { context: { count: context.count + event.value } };
              },
              RESET: { context: { count: 0 } },
            },
          },
        },
      });

      const actor = yield* createEffectActor(machine);
      actor.send({ type: "ADD", value: 3 });
      const sendInvalidEvent = () => {
        // @ts-expect-error -- Effect schemas constrain event payloads
        actor.send({ type: "ADD", value: "invalid" });
      };
      void sendInvalidEvent;
      yield* until(() => actor.getSnapshot().context.count === 3);

      expect(actor.getSnapshot().context).toEqual({ count: 3 });
    })
  );

  it.live(
    "validates converted context and event schemas at runtime",
    Effect.fnUntraced(function* () {
      const machine = setupEffect({
        validator: standardSchemaValidator(),
        schemas: {
          context: S.Struct({ count: S.Finite }),
          events: { ADD: S.Struct({ value: S.Finite }) },
        },
      }).createMachine({
        context: { count: 0 },
        on: {
          ADD: ({ context, event }) => ({
            context: { count: context.count + event.value },
          }),
        },
      });
      const actor = yield* createEffectActor(machine);

      actor.send({ type: "ADD", value: 2 });
      yield* until(() => actor.getSnapshot().context.count === 2);

      // The converted event schema is what runtime validation asserts against,
      // so an invalid payload is rejected instead of transitioning. A second
      // valid event, processed after it, proves the invalid one was dropped.
      // @ts-expect-error -- invalid wire payload exercises runtime validation.
      actor.send({ type: "ADD", value: "invalid" });
      actor.send({ type: "ADD", value: 1 });
      yield* until(() => actor.getSnapshot().context.count === 3);
      expect(actor.getSnapshot().context).toEqual({ count: 3 });

      const invalidContext = setupEffect({
        validator: standardSchemaValidator(),
        schemas: { context: S.Struct({ count: S.Finite }) },
      });
      // @ts-expect-error -- invalid initial context exercises runtime validation.
      const invalidContextMachine = invalidContext.createMachine({ context: { count: "invalid" } });

      expect(() => initialTransition(invalidContextMachine)).toThrow("Invalid context");
    })
  );

  it.live(
    "accepts Effect schemas when extending setupEffect",
    Effect.fnUntraced(function* () {
      const effectSetup = setupEffect({
        schemas: {
          context: S.Struct({ count: S.Finite }),
        },
      }).extend({
        schemas: {
          events: {
            ADD: S.Struct({ value: S.Finite }),
          },
        },
        guards: {
          canAdd: ({ context, event }) => {
            context.count satisfies number;
            event.value satisfies number;
            return event.value > 0;
          },
        },
      });
      const machine = effectSetup.createMachine({
        context: { count: 0 },
        on: {
          ADD: {
            context: ({ context, event }) => ({
              count: context.count + event.value,
            }),
          },
        },
      });
      const actor = yield* createEffectActor(machine);

      actor.send({ type: "ADD", value: 2 });
      yield* until(() => actor.getSnapshot().context.count === 2);

      expect(actor.getSnapshot().context).toEqual({ count: 2 });
      expect(rejects(effectSetup.schemas.events.ADD, { value: "invalid" })).toBe(true);
    })
  );

  it("preserves runtime validation compatibility through setupEffect.extend", () => {
    const validated = setupEffect({
      validator: standardSchemaValidator(),
    });
    const incompatibleSchemas = setupEffect({
      schemas: { input: S.FiniteFromString },
    });
    const incompatibleStates = setupEffect({
      states: {
        loading: { schemas: { input: S.FiniteFromString } },
      },
    });

    const incompatibleExtensions = () => {
      validated.extend({
        schemas: {
          // @ts-expect-error -- extended schemas inherit runtime validation
          input: S.FiniteFromString,
        },
      });

      // @ts-expect-error -- validation cannot be installed over a transforming schema
      incompatibleSchemas.extend({ validator: standardSchemaValidator() });

      // @ts-expect-error -- inherited state schemas must also be compatible
      incompatibleStates.extend({ validator: standardSchemaValidator() });
    };

    void incompatibleExtensions;
    validated.extend({
      validator: undefined,
      schemas: { input: S.FiniteFromString },
    });
  });

  it("preserves Effect action requirements when extending setupEffect", () => {
    class Audit extends Context.Service<Audit, { record: () => void }>()(
      "@beep/scratchpad/test/xstate-effect/index.test/Audit"
    ) {}
    const machine = setupEffect()
      .extend({
        actions: {
          audit: (_args) => Audit.use((audit) => Effect.sync(() => audit.record())),
        },
      })
      .createMachine({
        on: {
          AUDIT: (args, enq) => enq(args.actions.audit, args),
        },
      });
    expectTypeOf<RequirementsFrom<typeof machine>>().toEqualTypeOf<Audit>();
  });

  it("converts nested Effect state schemas", () => {
    const effectSetup = setupEffect({
      states: {
        running: {
          schemas: {
            input: S.Struct({ timeout: S.Finite }),
          },
          states: {
            retrying: {
              schemas: {
                context: S.Struct({ attempt: S.Finite }),
              },
            },
          },
        },
      },
    });

    const running = effectSetup.states.running;
    assert(running.schemas !== undefined);
    assert(running.schemas.input !== undefined);
    assert(running.states !== undefined);
    const retrying = running.states.retrying;
    assert(retrying.schemas !== undefined);
    assert(retrying.schemas.context !== undefined);
    expect(rejects(running.schemas.input, {})).toBe(true);
    expect(rejects(running.schemas.input, { timeout: 5 })).toBe(false);
    expect(rejects(retrying.schemas.context, { attempt: "no" })).toBe(true);
  });

  it("converts Effect schemas in every setup schema map", () => {
    const effectSetup = setupEffect({
      schemas: {
        internalEvents: {
          TICK: S.Struct({ count: S.Finite }),
        },
        actions: {
          track: { params: S.Struct({ key: S.String }) },
        },
        guards: {
          hasAccess: { params: S.Struct({ role: S.String }) },
        },
        emitted: {
          changed: S.Struct({ value: S.Finite }),
        },
        meta: S.Struct({ label: S.String }),
        tags: S.Literals(["active"]),
        children: {
          child: S.Unknown,
        },
      },
    });

    expect(rejects(effectSetup.schemas.internalEvents.TICK, { count: "no" })).toBe(true);
    expect(rejects(effectSetup.schemas.actions.track.params, { key: 1 })).toBe(true);
    expect(rejects(effectSetup.schemas.guards.hasAccess.params, { role: 1 })).toBe(true);
    expect(rejects(effectSetup.schemas.emitted.changed, { value: "no" })).toBe(true);
    expect(rejects(effectSetup.schemas.meta, { label: 1 })).toBe(true);
    expect(rejects(effectSetup.schemas.tags, "inactive")).toBe(true);
    // `S.Unknown` accepts anything; converting it must not change that.
    expect(rejects(effectSetup.schemas.children.child, "anything")).toBe(false);
  });

  it("preserves __proto__ schema and state keys while converting", () => {
    const effectSetup = setupEffect({
      schemas: {
        events: { [prototypeKey]: S.String },
      },
      states: {
        [prototypeKey]: {
          schemas: { input: S.String },
        },
      },
    });

    expect(Object.hasOwn(effectSetup.schemas.events, "__proto__")).toBe(true);
    expect(rejects(effectSetup.schemas.events[prototypeKey], 42)).toBe(true);
    expect(Object.hasOwn(effectSetup.states, "__proto__")).toBe(true);
    const schemas = effectSetup.states[prototypeKey].schemas;
    assert(schemas !== undefined);
    assert(schemas.input !== undefined);
    expect(rejects(schemas.input, 42)).toBe(true);
  });

  it("uses converted Effect schemas with XState runtime validation", () => {
    const machine = setupEffect({
      validator: standardSchemaValidator(),
      schemas: {
        input: S.Struct({ count: S.Finite }),
      },
    }).createMachine({
      context: ({ input }) => ({ count: input.count }),
    });

    // @ts-expect-error -- invalid initial input exercises runtime validation.
    expect(() => initialTransition(machine, { count: "invalid" })).toThrow("Invalid input");
  });

  it("reports asynchronous Effect schemas as unsupported by runtime validation", () => {
    const asyncString = S.String.pipe(S.catchDecoding(() => Effect.succeedSome("fallback").pipe(Effect.delay(1))));
    const machine = setupEffect({
      validator: standardSchemaValidator(),
      schemas: { input: asyncString },
    }).createMachine({});

    // @ts-expect-error -- invalid input exercises asynchronous validation rejection.
    expect(() => initialTransition(machine, 42)).toThrow("Async schema validation is unsupported for input");
  });

  it("rejects transforming Effect schemas when runtime validation is enabled", () => {
    const invalidSetup = () =>
      setupEffect({
        validator: standardSchemaValidator(),
        schemas: {
          // @ts-expect-error -- XState validation asserts values but does not transform them
          input: S.FiniteFromString,
        },
      });
    const invalidLogic = () =>
      fromEffect({
        // @ts-expect-error -- XState validation asserts values but does not transform them
        validator: standardSchemaValidator(),
        schemas: {
          input: S.FiniteFromString,
        },
        effect: ({ input }: { input: number }) => Effect.succeed(input),
      });

    void invalidSetup;
    void invalidLogic;
  });

  it.live(
    "accepts Effect schemas for fromEffect input and output",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        schemas: {
          input: S.Struct({ id: S.String }),
          output: S.Struct({ greeting: S.String }),
        },
        effect: ({ input }) => {
          input.id satisfies string;
          return Effect.succeed({ greeting: `Hello ${input.id}` });
        },
      });

      const actor = yield* createEffectActor(logic, { input: { id: "42" } });
      const createWithInvalidInput = () => {
        // @ts-expect-error -- input comes from the Effect schema
        const invalid = createEffectActor(logic, { input: { id: 42 } });
        void invalid;
      };
      void createWithInvalidInput;
      yield* until(() => actor.getSnapshot().status === "done");

      actor.getSnapshot().output?.greeting satisfies string | undefined;
      expect(actor.getSnapshot().output).toEqual({ greeting: "Hello 42" });
    })
  );

  it("rejects invalid fromEffect input with XState runtime validation", () => {
    const logic = fromEffect({
      validator: standardSchemaValidator(),
      schemas: {
        input: S.Struct({ id: S.String }),
        output: S.Struct({ greeting: S.String }),
      },
      effect: ({ input }) => Effect.succeed({ greeting: `Hello ${input.id}` }),
    });

    // @ts-expect-error -- invalid actor input exercises runtime validation.
    expect(() => initialTransition(logic, { id: 42 })).toThrow("Invalid input");
  });

  it("checks fromEffect results against the output schema", () => {
    const invalidLogic = () =>
      fromEffect({
        // @ts-expect-error -- the Effect result must match the output schema
        schemas: { output: S.String },
        effect: Effect.succeed(42),
      });

    void invalidLogic;
  });

  it("preserves failures and requirements with input and output schemas", () => {
    class Service extends Context.Service<Service, { name: string }>()(
      "@beep/scratchpad/test/xstate-effect/index.test/Service"
    ) {}
    const failure = { code: "NOT_FOUND" as const };
    const logic = fromEffect({
      schemas: {
        input: S.Struct({ id: S.String }),
        output: S.Struct({ name: S.String }),
      },
      effect: ({ input }) =>
        Service.use((service) =>
          input.id === "missing" ? Effect.fail(failure) : Effect.succeed({ name: service.name })
        ),
    });
    setup({ actors: { logic } }).createMachine({
      invoke: {
        src: "logic",
        input: { id: "42" },
        onError: ({ event }) => {
          event.error.code satisfies "NOT_FOUND";
          return {};
        },
      },
    });
    expectTypeOf<RequirementsFrom<typeof logic>>().toEqualTypeOf<Service>();
  });

  it("infers fromEffect output and requirements with only an input schema", () => {
    class Service extends Context.Service<Service, { prefix: string }>()(
      "@beep/scratchpad/test/xstate-effect/index.test/Service"
    ) {}
    const logic = fromEffect({
      schemas: {
        input: S.Struct({ id: S.String }),
      },
      effect: ({ input }) => Service.use((service) => Effect.succeed(`${service.prefix}${input.id}`)),
    });

    expectTypeOf<RequirementsFrom<typeof logic>>().toEqualTypeOf<Service>();
  });

  it.live(
    "accepts a constant Effect with only an input schema",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        schemas: {
          input: S.Struct({ id: S.String }),
        },
        effect: Effect.succeed("ok"),
      });
      const actor = yield* createEffectActor(logic, { input: { id: "42" } });
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().output).toBe("ok");
    })
  );

  it.live(
    "accepts an output-only Effect schema",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        schemas: { output: S.String },
        effect: Effect.succeed("ok"),
      });
      const actor = yield* createEffectActor(logic);
      yield* until(() => actor.getSnapshot().status === "done");

      actor.getSnapshot().output satisfies string | undefined;
      expect(actor.getSnapshot().output).toBe("ok");
    })
  );

  it.live(
    "infers actor input with only an output schema",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        schemas: { output: S.String },
        effect: ({ input }: { input: number }) => Effect.succeed(String(input)),
      });
      const actor = yield* createEffectActor(logic, { input: 42 });
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().output).toBe("42");
    })
  );

  it.live(
    "validates fromEffect schemas when a validator is provided",
    Effect.fnUntraced(function* () {
      const logic = fromEffect({
        validator: standardSchemaValidator(),
        schemas: { output: S.String },
        effect: Effect.succeed("ok"),
      });
      const actor = yield* createEffectActor(logic);
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().status).toBe("done");
    })
  );

  it.live(
    "rejects invalid fromEffect output with XState runtime validation",
    Effect.fnUntraced(function* () {
      const output = yield* Deferred.make<number>();
      const logic = fromEffect({
        // @ts-expect-error -- inject an invalid output to exercise runtime validation.
        validator: standardSchemaValidator(),
        schemas: { output: S.String },
        effect: Deferred.await(output),
      });
      const errors: unknown[] = [];
      const actor = yield* createEffectActor(logic);
      actor.subscribe({ error: (error) => errors.push(error) });
      yield* Deferred.succeed(output, 42);
      yield* until(() => actor.getSnapshot().status === "error");

      expect(errors).toHaveLength(1);
    })
  );

  it.live(
    "runs setupEffect actions inside the host Effect context",
    Effect.fnUntraced(function* () {
      class Audit extends Context.Service<Audit, { record: (value: number) => void }>()(
        "@beep/scratchpad/test/xstate-effect/index.test/Audit"
      ) {}
      const recorded: number[] = [];

      const effectSetup = setupEffect({
        actions: {
          audit: ({ context }) => Audit.use((audit) => Effect.sync(() => audit.record(context.count))),
        },
      });
      const machine = effectSetup.createMachine({
        context: { count: 1 },
        initial: "active",
        states: {
          active: {
            on: {
              AUDIT: (args, enq) => {
                enq(args.actions.audit, args);
              },
            },
          },
        },
      });

      const actor = yield* Effect.provideService(createEffectActor(machine), Audit, {
        record: (value) => recorded.push(value),
      });
      expectTypeOf<RequirementsFrom<typeof machine>>().toEqualTypeOf<Audit>();

      actor.send({ type: "AUDIT" });
      yield* until(() => recorded.length === 1);

      expect(recorded).toEqual([1]);
    })
  );

  it.live(
    "keeps Layer services alive until the caller-owned scope closes",
    Effect.fnUntraced(function* () {
      class Resource extends Context.Service<Resource, { value: string }>()(
        "@beep/scratchpad/test/xstate-effect/index.test/Resource"
      ) {}
      let acquired = 0;
      let released = 0;
      let observed: string | undefined;
      const layer = Layer.effect(
        Resource,
        Effect.acquireRelease(
          Effect.sync(() => {
            acquired++;
            return { value: "scoped" };
          }),
          () =>
            Effect.sync(() => {
              released++;
            })
        )
      );
      const machine = setupEffect({
        actions: {
          read: (_args) =>
            Resource.use((resource) =>
              Effect.sync(() => {
                observed = resource.value;
              })
            ),
        },
      }).createMachine({
        on: {
          READ: (args, enq) => enq(args.actions.read, args),
        },
      });

      yield* Effect.gen(function* () {
        const scope = yield* Effect.scope;
        const services = yield* Layer.buildWithScope(layer, scope);
        const actor = yield* createEffectActor(machine).pipe(Effect.provideContext(services));
        expect(acquired).toBe(1);
        expect(released).toBe(0);
        actor.send({ type: "READ" });
        yield* until(() => observed !== undefined);
        expect(observed).toBe("scoped");
        actor.stop();
        expect(released).toBe(0);
      }).pipe(Effect.scoped);

      expect(released).toBe(1);
    })
  );

  it.live(
    "routes failed Effect actions through the machine error transition",
    Effect.fnUntraced(function* () {
      const failure = { code: "AUDIT_FAILED" as const };
      let received: unknown;
      const effectSetup = setupEffect({
        actions: {
          fail: (_args) => Effect.fail(failure),
        },
      });
      const machine = effectSetup.createMachine({
        initial: "active",
        states: {
          active: {
            on: {
              FAIL: (args, enq) => enq(args.actions.fail, args),
            },
            onError: ({ event }) => {
              received = event.error;
              return { target: "failed" };
            },
          },
          failed: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      actor.send({ type: "FAIL" });
      yield* until(() => actor.getSnapshot().value === "failed");

      expect(received).toEqual(failure);
    })
  );

  it.live(
    "invokes an Effect actor and routes success to onDone",
    Effect.fnUntraced(function* () {
      const logic = Effect.succeed("ok").pipe((value) => fromEffect(value));
      const machine = createMachine({
        initial: "pending",
        states: {
          pending: {
            invoke: {
              src: logic,
              onDone: {
                target: "success",
                context: ({ event }) => ({ result: event.output }),
              },
            },
          },
          success: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      yield* until(() => actor.getSnapshot().value === "success");

      expect(actor.getSnapshot().context).toEqual({ result: "ok" });
    })
  );

  it.live(
    "uses the Effect runtime brand when distinguishing config objects",
    Effect.fnUntraced(function* () {
      const directEffect = Object.assign(Effect.succeed("direct"), {
        effect: Effect.succeed("nested"),
      });
      const actor = yield* directEffect.pipe(
        (value) => fromEffect(value),
        (value) => createEffectActor(value)
      );
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().output).toBe("direct");
    })
  );

  it.live(
    "routes typed Effect failures to onError",
    Effect.fnUntraced(function* () {
      const failure = { code: "NOT_FOUND" as const };
      const logic = Effect.fail(failure).pipe((value) => fromEffect(value));
      const machine = createMachine({
        initial: "pending",
        states: {
          pending: {
            invoke: {
              src: logic,
              onError: {
                target: "failed",
                context: ({ event }) => ({ error: event.error }),
              },
            },
          },
          failed: {},
        },
      });

      const actor = yield* createEffectActor(machine);
      yield* until(() => actor.getSnapshot().value === "failed");

      expect(actor.getSnapshot().context).toEqual({ error: failure });
    })
  );

  it("preserves typed Effect errors through registered v6 actors", () => {
    const failure = { code: "NOT_FOUND" as const };
    const request = Effect.fail(failure).pipe((value) => fromEffect(value));
    const effectSetup = setupEffect({ actors: { request } });
    const machine = effectSetup.createMachine({
      initial: "pending",
      states: {
        pending: {
          invoke: {
            src: "request",
            onError: ({ event }) => {
              const code: "NOT_FOUND" = event.error.code;
              // @ts-expect-error -- the Effect failure is discriminated
              const other: "OTHER" = code;
              void other;
              return { target: "failed" };
            },
          },
        },
        failed: {},
      },
    });

    expect(machine).toBeDefined();
  });

  it("collects requirements from registered Effect actors", () => {
    class Service extends Context.Service<Service, { value: number }>()(
      "@beep/scratchpad/test/xstate-effect/index.test/Service"
    ) {}
    const logic = fromEffect(Service.use((service) => Effect.succeed(service.value)));
    expectTypeOf<RequirementsFrom<typeof logic>>().toEqualTypeOf<Service>();
    const machine = setup({ actors: { logic } }).createMachine({
      initial: "pending",
      states: {
        pending: {
          invoke: { src: "logic" },
        },
      },
    });

    expectTypeOf<RequirementsFrom<typeof machine>>().toEqualTypeOf<Service>();
  });

  it("rejects running Effect logic through ordinary createActor", () => {
    const actor = Effect.succeed("ok").pipe(
      (value) => fromEffect(value),
      (value) => createActor(value)
    );
    actor.subscribe({ error: () => {} });
    actor.start();

    expect(actor.getSnapshot().status).toBe("error");
  });

  it.live(
    "exposes the latest item from an Effect stream and completes",
    Effect.fnUntraced(function* () {
      const actor = yield* Stream.make(1, 2, 3).pipe(
        (value) => fromEffectStream(value),
        (value) => createEffectActor(value)
      );
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().context).toBe(3);
    })
  );

  it.live(
    "infers stream input from the fromEffectStream config form",
    Effect.fnUntraced(function* () {
      const logic = fromEffectStream({
        schemas: { input: S.Struct({ n: S.Finite }) },
        stream: ({ input }) => {
          input satisfies { readonly n: number };
          return Stream.make(input.n, input.n + 1);
        },
      });

      const actor = yield* createEffectActor(logic, { input: { n: 5 } });
      yield* until(() => actor.getSnapshot().status === "done");

      expect(actor.getSnapshot().context).toBe(6);
    })
  );

  it.live(
    "relays a configured Effect event stream to its parent",
    Effect.fnUntraced(function* () {
      const relay = fromEffectEventStream({
        schemas: { input: S.Struct({ n: S.Finite }) },
        stream: ({ input }) => {
          input satisfies { readonly n: number };
          return Stream.make(
            { type: "VALUE" as const, value: input.n },
            { type: "VALUE" as const, value: input.n * 2 }
          );
        },
      });
      const machine = setup({
        schemas: { events: { VALUE: types<{ value: number }>() } },
        actors: { relay },
      }).createMachine({
        context: { seen: 0 },
        initial: "active",
        states: {
          active: {
            invoke: { src: "relay", input: { n: 3 } },
            on: {
              VALUE: {
                context: ({ context, event }) => ({
                  seen: context.seen + event.value,
                }),
              },
            },
          },
        },
      });

      const actor = yield* createEffectActor(machine);
      yield* until(() => actor.getSnapshot().context.seen === 9);

      expect(actor.getSnapshot().context).toEqual({ seen: 9 });
    })
  );
});

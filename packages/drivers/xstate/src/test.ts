/**
 * Model-based testing bridges between effect Schema, fast-check and
 * `@xstate/test`, plus a system-under-test adapter for `@xstate/effect` actors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createEffectActor, waitFor } from "@xstate/effect";
import { Effect, Exit, ManagedRuntime, pipe, Scope } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as fc from "fast-check";
import type { EffectActorOptions, RequirementsFrom } from "@xstate/effect";
import type { TestSut, TestSutContext, TestSutSession } from "@xstate/test";
import type { Duration, Layer } from "effect";
import type { AnyActorLogic, EventFromLogic, SnapshotFrom } from "xstate";

/**
 * Sampling options for {@link arbitraryFromSchema}.
 *
 * @category models
 * @since 0.0.0
 */
export interface SchemaArbitraryOptions {
  /** How many values to sample from the schema arbitrary. Defaults to 32. */
  readonly count?: number;
  /** Seed for deterministic sampling. Defaults to 0. */
  readonly seed?: string | number;
}

const sampleOptions = (options?: SchemaArbitraryOptions): Arbitrary.SampleOptions => ({
  count: options?.count ?? 32,
  seed: options?.seed ?? 0,
});

/**
 * Builds a fast-check arbitrary from an effect Schema by sampling effect's own
 * schema arbitrary. The sampled values are drawn with `fc.constantFrom`, so
 * fast-check shrinks towards the first sample.
 *
 * **Details**
 *
 * `@xstate/test` generates payloads with fast-check, while effect 4 derives
 * arbitraries from schemas through `effect/Arbitrary`. This bridge keeps the
 * schema as the single source of truth for event payloads.
 *
 * **Example** (Derive a payload generator)
 *
 * ```ts
 * import { arbitraryFromSchema } from "@beep/xstate/test"
 * import { pipe } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Reviewer = S.Struct({ reviewer: S.NonEmptyString })
 * const dataFirst = arbitraryFromSchema(Reviewer, { count: 8 })
 * const dataLast = pipe(Reviewer, arbitraryFromSchema({ count: 8 }))
 * console.log(dataFirst, dataLast)
 * ```
 *
 * @param schema - Schema the payload must satisfy.
 * @param options - Sampling options.
 * @returns A fast-check arbitrary over sampled schema values.
 * @category generators
 * @since 0.0.0
 */
export const arbitraryFromSchema: {
  (
    options?: SchemaArbitraryOptions
  ): <Schema extends S.Constraint>(
    schema: Schema
  ) => Effect.Effect<fc.Arbitrary<Schema["Type"]>, Arbitrary.SampleError>;
  <Schema extends S.Constraint>(
    schema: Schema,
    options?: SchemaArbitraryOptions
  ): Effect.Effect<fc.Arbitrary<Schema["Type"]>, Arbitrary.SampleError>;
} = dual(
  (args) => S.isSchema(args[0]),
  <Schema extends S.Constraint>(
    schema: Schema,
    options?: SchemaArbitraryOptions
  ): Effect.Effect<fc.Arbitrary<Schema["Type"]>, Arbitrary.SampleError> =>
    Effect.map(Arbitrary.sampleEffect(Arbitrary.schema(schema), sampleOptions(options)), (values) =>
      fc.constantFrom(...values)
    )
);

/**
 * Event generator map derived from a record of payload schemas.
 *
 * @category models
 * @since 0.0.0
 */
export type EventArbitraries<Schemas extends Readonly<Record<string, S.Constraint>>> = {
  readonly [Key in keyof Schemas]: fc.Arbitrary<Schemas[Key]["Type"]>;
};

const isSchemaRecord = (input: unknown): input is Readonly<Record<string, S.Constraint>> =>
  P.isObject(input) && A.every(R.values(input), S.isSchema);

/**
 * Derives one fast-check arbitrary per event type from the payload schemas a
 * machine declares, for the `events` option of `propertyTest()` and `testPaths()`.
 *
 * **Example** (Derive generators for two events)
 *
 * ```ts
 * import { eventsFromSchemas } from "@beep/xstate/test"
 * import * as S from "effect/Schema"
 *
 * const program = eventsFromSchemas({
 *   APPROVE: S.Struct({ reviewer: S.NonEmptyString }),
 *   CANCEL: S.Struct({}),
 * })
 * console.log(program)
 * ```
 *
 * @param schemas - Payload schemas keyed by event type.
 * @param options - Sampling options shared by every event.
 * @returns Generators keyed by event type.
 * @category generators
 * @since 0.0.0
 */
export const eventsFromSchemas: {
  (
    options?: SchemaArbitraryOptions
  ): <const Schemas extends Readonly<Record<string, S.Constraint>>>(
    schemas: Schemas
  ) => Effect.Effect<EventArbitraries<Schemas>, Arbitrary.SampleError>;
  <const Schemas extends Readonly<Record<string, S.Constraint>>>(
    schemas: Schemas,
    options?: SchemaArbitraryOptions
  ): Effect.Effect<EventArbitraries<Schemas>, Arbitrary.SampleError>;
} = dual(
  (args) => isSchemaRecord(args[0]),
  <const Schemas extends Readonly<Record<string, S.Constraint>>>(
    schemas: Schemas,
    options?: SchemaArbitraryOptions
  ): Effect.Effect<EventArbitraries<Schemas>, Arbitrary.SampleError> =>
    pipe(
      Effect.forEach(R.toEntries(schemas), ([key, schema]) =>
        Effect.map(arbitraryFromSchema(schema, options), (arbitrary) => [key, arbitrary] as const)
      ),
      Effect.map((entries) => R.fromEntries(entries) as EventArbitraries<Schemas>)
    )
);

const isReadonlyUnknownArray = (input: unknown): input is ReadonlyArray<unknown> => A.isArray(input);

const structurallyEquivalent = (left: unknown, right: unknown): boolean => {
  if (isReadonlyUnknownArray(left) && isReadonlyUnknownArray(right)) {
    return left.length === right.length && A.every(left, (item, index) => structurallyEquivalent(item, right[index]));
  }
  if (P.isObject(left) && P.isObject(right)) {
    const leftKeys = R.keys(left);
    const rightKeys = R.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      A.every(leftKeys, (key) => R.has(right, key) && structurallyEquivalent(left[key], right[key]))
    );
  }
  return left === right;
};

/**
 * Default projection compared between the model and an Effect actor: the state
 * value and context.
 *
 * **Example** (Project a snapshot)
 *
 * ```ts
 * import { projectValueAndContext } from "@beep/xstate/test"
 * import { createMachine, initialTransition } from "xstate"
 *
 * const toggle = createMachine({ initial: "off", states: { off: {}, on: {} } })
 * const [snapshot] = initialTransition(toggle)
 * console.log(projectValueAndContext(snapshot)) // { value: "off", context: undefined }
 * ```
 *
 * @param snapshot - Snapshot to project.
 * @returns The snapshot's `value` and `context`.
 * @category projections
 * @since 0.0.0
 */
export const projectValueAndContext = (snapshot: {
  readonly value?: unknown;
  readonly context?: unknown;
}): unknown => ({
  value: snapshot.value,
  context: snapshot.context,
});

/**
 * Options for {@link effectActorSut}.
 *
 * @category models
 * @since 0.0.0
 */
export interface EffectActorSutOptions<TLogic extends AnyActorLogic> {
  /** Services the machine's Effect actions and actors require. */
  readonly layer: Layer.Layer<RequirementsFrom<TLogic>>;
  /** Projects a snapshot onto the shape compared with the model. Defaults to {@link projectValueAndContext}. */
  readonly project?: (snapshot: SnapshotFrom<TLogic>) => unknown;
  /** How long `settle` waits for the actor to reach the model's projection. Defaults to one second. */
  readonly settleTimeout?: Duration.Input;
}

const makeEffectActorSession = <TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: EffectActorSutOptions<TLogic>,
  context: TestSutContext<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>
): Promise<TestSutSession<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>> => {
  const project = options.project ?? projectValueAndContext;
  const settleTimeout: Duration.Input = options.settleTimeout ?? "1 second";
  const runtime = ManagedRuntime.make(options.layer);
  return runtime.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const actor = yield* pipe(
        createEffectActor(logic, { input: context.input } as EffectActorOptions<TLogic>),
        Scope.provide(scope)
      );
      let expected: O.Option<unknown> = O.none();
      const session: TestSutSession<SnapshotFrom<TLogic>, EventFromLogic<TLogic>> = {
        send: (event, sendContext) => {
          expected = O.some(project(sendContext.snapshot));
          actor.send(event);
        },
        read: () => project(actor.getSnapshot()),
        settle: () =>
          O.match(expected, {
            onNone: () => Promise.resolve(),
            onSome: (target) =>
              runtime.runPromise(
                pipe(
                  waitFor(actor, (snapshot) => structurallyEquivalent(project(snapshot), target), {
                    timeout: settleTimeout,
                  }),
                  Effect.catchTag("TimeoutError", () => Effect.void),
                  Effect.asVoid
                )
              ),
          }),
        dispose: () => runtime.runPromise(Scope.close(scope, Exit.void)).then(() => runtime.dispose()),
      };
      return session;
    })
  );
};

/**
 * Runs the machine under `createEffectActor` as the system under test, so
 * `propertyTest()` and `testPaths()` check the Effect-hosted interpreter against
 * xstate's pure transitions.
 *
 * **Details**
 *
 * Every run creates a fresh `ManagedRuntime` from `layer`, starts the actor in
 * its own scope and sends the generated events to it. After each event the
 * session waits until the actor's projection equals the model's projection or
 * `settleTimeout` elapses; the runner then reports any remaining divergence.
 *
 * **Gotchas**
 *
 * The model runs in `'pure'` mode by default, where invoked actors never
 * start. Provide fake actors through `machine.provide(...)` so the Effect
 * actor stays comparable, or restrict the campaign to events that do not enter
 * invoking states.
 *
 * **Example** (Compare an Effect actor with its model)
 *
 * ```ts
 * import { effectActorSut } from "@beep/xstate/test"
 * import { Layer, pipe } from "effect"
 * import { createMachine } from "xstate"
 *
 * const toggle = createMachine({ initial: "off", states: { off: { on: { TOGGLE: { target: "on" } } }, on: {} } })
 * const dataFirst = effectActorSut(toggle, { layer: Layer.empty })
 * const dataLast = pipe(toggle, effectActorSut({ layer: Layer.empty }))
 * console.log(dataFirst, dataLast)
 * ```
 *
 * @param logic - Machine or actor logic to host.
 * @param options - Runtime layer, projection and settle timeout.
 * @returns A `TestSut` for `@xstate/test`.
 * @category sut
 * @since 0.0.0
 */
export const effectActorSut: {
  <TLogic extends AnyActorLogic>(
    options: EffectActorSutOptions<TLogic>
  ): (logic: TLogic) => TestSut<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>;
  <TLogic extends AnyActorLogic>(
    logic: TLogic,
    options: EffectActorSutOptions<TLogic>
  ): TestSut<SnapshotFrom<TLogic>, EventFromLogic<TLogic>>;
} = dual(
  2,
  <TLogic extends AnyActorLogic>(
    logic: TLogic,
    options: EffectActorSutOptions<TLogic>
  ): TestSut<SnapshotFrom<TLogic>, EventFromLogic<TLogic>> => ({
    create: (context) => makeEffectActorSession(logic, options, context),
    projectModel: options.project ?? projectValueAndContext,
    equivalent: structurallyEquivalent,
  })
);

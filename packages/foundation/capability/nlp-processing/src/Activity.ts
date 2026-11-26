/**
 * Attributed operation runs: every run of a wrapped {@link Operation} records
 * one `prov:Activity`, on success and on a typed failure.
 *
 * **Details**
 *
 * {@link withActivity} is a Writer: it mints the activity id from the
 * start-time facts before the run (decision 2026-11-19-p0-activity-id-minted-at-start),
 * provides {@link CurrentActivity} to the run, and returns the value with a
 * one-record log, or fails with a {@link LoggedFailure} that still carries the
 * failed record. {@link composeLogged} joins two logged arrows: the downstream
 * run starts no earlier than every upstream activity ended, through
 * {@link ActivityFloor}, so a generated entity is never used before it was
 * generated, under any clock.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityStart, ActivityStartFields, mintActivityId } from "@beep/jsonc/ActivityStart";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Reducer from "effect/Reducer";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  ActivityGeneratedCountAttribute,
  ActivityIdAttribute,
  ActivityOutcomeAttribute,
  ActivityUsedCountAttribute,
  OperationTermAttribute,
} from "./NlpProcessing.instruments.ts";
import type { TermIri } from "@beep/identity/Term";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { ActivityId, ContentHash } from "@beep/schema/ContentHash";
import type * as Digest from "effect/crypto/Digest";
import type { Operation } from "./Operation.ts";

const $I = $NlpProcessingId.create("Activity");

/**
 * The start-time facts an attributed run states about itself: its pin, its
 * prompt digest and the entities it reads. The operation term and the start
 * time come from the arrow and the clock, so a caller cannot state either.
 *
 * **Example** (State the facts of an engine run)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { ActivityPin } from "@beep/jsonc/ActivityStart"
 * import { ActivityFacts } from "@beep/nlp-processing/Activity"
 *
 * const facts = ActivityFacts.make({
 *   pin: ActivityPin.cases.Engine.make({ engine: "wink", edition: "1.0.0" }),
 *   promptDigest: O.none(),
 *   used: HashSet.empty(),
 * })
 *
 * console.log(facts.pin._tag) // "Engine"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActivityFacts extends S.Opaque<ActivityFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    pin: ActivityStartFields.pin,
    promptDigest: ActivityStartFields.promptDigest,
    used: ActivityStartFields.used,
  }).pipe($I.annoteSchema("ActivityFacts", { description: "The start-time facts an attributed run states." }))
) {}

/**
 * How {@link withActivity} reads an operation's facts and the entities its
 * output generated.
 *
 * **Example** (Describe a run that reads and generates nothing)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { ActivityPin } from "@beep/jsonc/ActivityStart"
 * import { ActivityFacts, type ActivityDescriptor } from "@beep/nlp-processing/Activity"
 *
 * const descriptor: ActivityDescriptor<string, number> = {
 *   facts: () =>
 *     Effect.succeed(
 *       ActivityFacts.make({
 *         pin: ActivityPin.cases.Engine.make({ engine: "wink", edition: "1.0.0" }),
 *         promptDigest: O.none(),
 *         used: HashSet.empty(),
 *       })
 *     ),
 *   generated: () => [],
 * }
 *
 * console.log(descriptor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ActivityDescriptor<A, B, EF = never, RF = never> {
  readonly facts: (input: A) => Effect.Effect<ActivityFacts, EF, RF>;
  readonly generated: (output: B) => Iterable<ContentHash>;
}

/**
 * Service tag for the activity a wrapped run executes under; only
 * {@link withActivity} provides it.
 *
 * **Details**
 *
 * `stamp` reads the clock and returns a time no earlier than the activity's
 * start or any earlier stamp, recording it, so stamps within one activity
 * never decrease. A run reads its generation times through `stamp`.
 *
 * **Example** (Log the service key)
 *
 * ```ts
 * import { CurrentActivity } from "@beep/nlp-processing/Activity"
 *
 * console.log(CurrentActivity.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurrentActivity extends Context.Service<
  CurrentActivity,
  {
    readonly id: ActivityId;
    readonly stamp: Effect.Effect<DateTime.Utc>;
    readonly start: ActivityStart;
  }
>()($I`CurrentActivity`) {}

/**
 * The earliest time the next attributed run may start; `None` by default.
 *
 * **Example** (Read the default floor)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { ActivityFloor } from "@beep/nlp-processing/Activity"
 *
 * const floor = Effect.runSync(Effect.gen(function* () { return yield* ActivityFloor }))
 *
 * console.log(O.isNone(floor)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const ActivityFloor = Context.Reference<O.Option<DateTime.Utc>>($I`ActivityFloor`, {
  defaultValue: O.none,
});

/**
 * **Example** (Build a logged number schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Logged } from "@beep/nlp-processing/Activity"
 *
 * console.log(Logged(S.Finite).fields.value === S.Finite) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Logged = <Value extends S.Top>(value: Value) =>
  S.Struct({ value, activities: S.HashSet(ActivityRecord) }).pipe(
    $I.annoteSchema("Logged", { description: "A value paired with the activities that produced it." })
  );

/**
 * @category models
 * @since 0.0.0
 */
export type Logged<B> = S.Struct.Type<{
  readonly value: S.Codec<B>;
  readonly activities: S.HashSet<typeof ActivityRecord>;
}>;

/**
 * Schema of a logged failure: the typed error and the activities that started,
 * the failed one included.
 *
 * **Example** (Build a logged failure schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LoggedFailure } from "@beep/nlp-processing/Activity"
 *
 * console.log(LoggedFailure(S.String).fields._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LoggedFailure = <Error extends S.Top>(error: Error) =>
  S.TaggedStruct("LoggedFailure", { error, activities: S.HashSet(ActivityRecord) }).pipe(
    $I.annoteSchema("LoggedFailure", { description: "A typed failure with the activities that started." })
  );

/**
 * A typed failure with the activities that started, the failed one included.
 *
 * @category models
 * @since 0.0.0
 */
export type LoggedFailure<E> = S.Struct.Type<{
  readonly _tag: S.Literal<"LoggedFailure">;
  readonly error: S.Codec<E>;
  readonly activities: S.HashSet<typeof ActivityRecord>;
}>;

/**
 * Joins activity logs by set union.
 *
 * **Example** (Join two empty logs)
 *
 * ```ts import.meta.vitest name="Join two empty logs"
 * import * as HashSet from "effect/HashSet"
 * import { ActivityLogReducer } from "@beep/nlp-processing/Activity"
 *
 * HashSet.size(ActivityLogReducer.combine(HashSet.empty(), HashSet.empty())) // => 0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const ActivityLogReducer: Reducer.Reducer<HashSet.HashSet<ActivityRecord>> = Reducer.make<
  HashSet.HashSet<ActivityRecord>
>((self, that) => HashSet.union(self, that), HashSet.empty());

const unstarted = <E>(error: E): LoggedFailure<E> => ({ _tag: "LoggedFailure", error, activities: HashSet.empty() });

const latestEnd = (activities: HashSet.HashSet<ActivityRecord>): O.Option<DateTime.Utc> =>
  HashSet.reduce(activities, O.none<DateTime.Utc>(), (latest, record) =>
    O.some(O.match(latest, { onNone: () => record.ended, onSome: DateTime.max(record.ended) }))
  );

/**
 * Wrap an operation so every run records one `prov:Activity`.
 *
 * **Details**
 *
 * The facts and the id come before the run; their failures carry an empty
 * log. The run's typed failure carries the `failed` record; a defect or an
 * interruption records nothing. `ended` is no earlier than `started` or any
 * stamp, so a clock that steps backwards never fails a run.
 *
 * **Example** (Attribute a trimming run)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { ActivityPin } from "@beep/jsonc/ActivityStart"
 * import { ActivityFacts, withActivity } from "@beep/nlp-processing/Activity"
 * import { pure } from "@beep/nlp-processing/Operation"
 *
 * const trim = pure({ name: TermIri.make(iri("operation:Trim")), f: (text: string) => text.trim() })
 * const attributed = withActivity<string, string>({
 *   facts: () =>
 *     Effect.succeed(
 *       ActivityFacts.make({
 *         pin: ActivityPin.cases.Engine.make({ engine: "wink", edition: "1.0.0" }),
 *         promptDigest: O.none(),
 *         used: HashSet.empty(),
 *       })
 *     ),
 *   generated: () => [],
 * })(trim)
 *
 * console.log(attributed.name)
 * ```
 *
 * @param descriptor - How to read the run's facts and generated entities.
 * @category combinators
 * @since 0.0.0
 */
export const withActivity =
  <A, B, EF = never, RF = never>(descriptor: ActivityDescriptor<A, B, EF, RF>) =>
  <E, R>(
    operation: Operation<A, B, E, R>
  ): Operation<
    A,
    Logged<B>,
    LoggedFailure<E | EF | PreimageMintError>,
    Exclude<R, CurrentActivity> | RF | Digest.Digest
  > => ({
    name: operation.name,
    run: Effect.fn("Operation.run")(function* (
      input: A
    ): Effect.fn.Return<
      Logged<B>,
      LoggedFailure<E | EF | PreimageMintError>,
      Exclude<R, CurrentActivity> | RF | Digest.Digest
    > {
      const facts = yield* Effect.mapError(descriptor.facts(input), unstarted);
      const floor = yield* ActivityFloor;
      const now = yield* DateTime.now;
      const started = O.match(floor, { onNone: () => now, onSome: DateTime.max(now) });
      const start = ActivityStart.make({ ...facts, operation: operation.name, started });
      const id = yield* Effect.mapError(mintActivityId(start), unstarted);
      const lastStamp = yield* Ref.make(started);
      const stamp = Effect.flatMap(DateTime.now, (at) => Ref.updateAndGet(lastStamp, DateTime.max(at)));
      const result = yield* Effect.result(
        Effect.provideService(
          Effect.suspend(() => operation.run(input)),
          CurrentActivity,
          CurrentActivity.of({ id, start, stamp })
        )
      );
      const ended = yield* stamp;
      const record = ActivityRecord.make({
        id,
        start,
        generated: Result.match(result, {
          onFailure: () => HashSet.empty<ContentHash>(),
          onSuccess: (value) => HashSet.fromIterable(descriptor.generated(value)),
        }),
        ended,
        outcome: Result.isSuccess(result) ? "completed" : "failed",
      });
      yield* Effect.annotateCurrentSpan({
        [OperationTermAttribute]: operation.name,
        [ActivityIdAttribute]: record.id,
        [ActivityUsedCountAttribute]: HashSet.size(start.used),
        [ActivityGeneratedCountAttribute]: HashSet.size(record.generated),
        [ActivityOutcomeAttribute]: record.outcome,
      });
      const activities = HashSet.make(record);
      return yield* Result.match(result, {
        onFailure: (error) => Effect.fail<LoggedFailure<E>>({ _tag: "LoggedFailure", error, activities }),
        onSuccess: (value) => Effect.succeed<Logged<B>>({ value, activities }),
      });
    }),
  });

/**
 * Compose two logged arrows: run `f`, then `g` on its value no earlier than
 * every activity of `f` ended, and join both logs.
 *
 * **Details**
 *
 * A failure of `g` carries `f`'s log joined with its own. The composite is a
 * derived view: it takes the name given and records no activity of its own.
 *
 * **Example** (Compose two attributed steps)
 *
 * ```ts
 * import type { Operation } from "@beep/nlp-processing/Operation"
 * import { composeLogged, type Logged, type LoggedFailure } from "@beep/nlp-processing/Activity"
 *
 * const chain = <E, R>(
 *   f: Operation<string, Logged<string>, LoggedFailure<E>, R>,
 *   g: Operation<string, Logged<number>, LoggedFailure<E>, R>
 * ) => composeLogged(f, g, f.name)
 *
 * console.log(chain)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const composeLogged: {
  <B, C, E, R>(
    g: Operation<B, Logged<C>, LoggedFailure<E>, R>,
    name: TermIri
  ): <A>(f: Operation<A, Logged<B>, LoggedFailure<E>, R>) => Operation<A, Logged<C>, LoggedFailure<E>, R>;
  <A, B, C, E, R>(
    f: Operation<A, Logged<B>, LoggedFailure<E>, R>,
    g: Operation<B, Logged<C>, LoggedFailure<E>, R>,
    name: TermIri
  ): Operation<A, Logged<C>, LoggedFailure<E>, R>;
} = dual(
  3,
  <A, B, C, E, R>(
    f: Operation<A, Logged<B>, LoggedFailure<E>, R>,
    g: Operation<B, Logged<C>, LoggedFailure<E>, R>,
    name: TermIri
  ): Operation<A, Logged<C>, LoggedFailure<E>, R> => ({
    name,
    run: (input) =>
      Effect.flatMap(
        Effect.suspend(() => f.run(input)),
        (first) => {
          const downstream = Effect.suspend(() => g.run(first.value));
          const floored = O.match(latestEnd(first.activities), {
            onNone: () => downstream,
            onSome: (floor) => Effect.provideService(downstream, ActivityFloor, O.some(floor)),
          });
          return Effect.mapBoth(floored, {
            onFailure: (failure): LoggedFailure<E> => ({
              ...failure,
              activities: ActivityLogReducer.combine(first.activities, failure.activities),
            }),
            onSuccess: (second): Logged<C> => ({
              value: second.value,
              activities: ActivityLogReducer.combine(first.activities, second.activities),
            }),
          });
        }
      ),
  })
);

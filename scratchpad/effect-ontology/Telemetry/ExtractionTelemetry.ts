/**
 * Request-scoped extraction telemetry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ExtractionTelemetry, ProviderTokenUsage } from "../Domain/Model/ExtractionTelemetry.ts";
import { PosInt } from "../Schema/PosInt.ts";

export { ExtractionTelemetry, ProviderTokenUsage } from "../Domain/Model/ExtractionTelemetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Telemetry/ExtractionTelemetry");

class UsageState extends S.Class<UsageState>($I`UsageState`)(
  {
    chunkCount: S.Natural,
    attemptCount: S.Natural,
    recordedAttempts: S.Natural,
    reportedAttempts: S.Natural,
    completeAttempts: S.Natural,
    inputTokens: S.Natural,
    outputTokens: S.Natural,
  },
  $I.annote("UsageState", {
    description: "Mutable-ref payload used to aggregate provider usage within one extraction request.",
  })
) {}

const emptyUsageState = (): UsageState =>
  UsageState.make({
    chunkCount: S.Natural.make(0),
    attemptCount: S.Natural.make(0),
    recordedAttempts: S.Natural.make(0),
    reportedAttempts: S.Natural.make(0),
    completeAttempts: S.Natural.make(0),
    inputTokens: S.Natural.make(0),
    outputTokens: S.Natural.make(0),
  });

const decodeUnknownNatural = S.decodeUnknownOption(S.Natural);

const increment = (value: number): number => S.Natural.make(value + 1);
const add = (left: number, right: number): number => S.Natural.make(left + right);

const toUsage = (state: UsageState): ProviderTokenUsage => {
  if (state.reportedAttempts === 0) {
    return ProviderTokenUsage.cases.Unavailable.make({ attemptCount: state.attemptCount });
  }
  if (state.completeAttempts === state.attemptCount) {
    return ProviderTokenUsage.cases.Complete.make({
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      attemptCount: PosInt.make(state.attemptCount),
    });
  }
  return ProviderTokenUsage.cases.Partial.make({
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
    attemptCount: PosInt.make(state.attemptCount),
    missingAttempts: PosInt.make(state.attemptCount - state.completeAttempts),
  });
};

/**
 * Request-local collector used by language-model wrappers during extraction.
 *
 * **Details**
 *
 * Each call to {@link captureExtractionTelemetry} installs a fresh collector,
 * so concurrent extractions cannot share counters.
 *
 * **Gotchas**
 *
 * {@link recordProviderAttempt}, {@link recordProviderUsage}, and
 * {@link recordExtractionChunkCount} are silent no-ops when no collector is
 * in scope.
 *
 * **Example** (Capture a provider attempt into a snapshot)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { captureExtractionTelemetry, recordProviderAttempt } from "@effect-ontology/Telemetry/ExtractionTelemetry"
 *
 * const [, snapshot] = Effect.runSync(captureExtractionTelemetry(recordProviderAttempt))
 * console.log(snapshot.usage._tag) // "Unavailable"
 * ```
 *
 * @see {@link captureExtractionTelemetry} for installing this collector around an extraction.
 * @category services
 * @since 0.0.0
 */
export class ExtractionTelemetryCollector extends Context.Service<
  ExtractionTelemetryCollector,
  {
    readonly startAttempt: Effect.Effect<void>;
    readonly recordUsage: (
      inputTokens: O.Option<number>,
      outputTokens: O.Option<number>
    ) => Effect.Effect<void>;
    readonly recordChunkCount: (chunkCount: number) => Effect.Effect<void>;
    readonly snapshot: Effect.Effect<ExtractionTelemetry>;
  }
>()($I`ExtractionTelemetryCollector`) {}

const makeExtractionTelemetry = Effect.fn("ExtractionTelemetry.make")(function* () {
  const state = yield* Ref.make(emptyUsageState());
  return ExtractionTelemetryCollector.of({
    startAttempt: Ref.update(state, (current) =>
      UsageState.make({ ...current, attemptCount: increment(current.attemptCount) })
    ),
    recordUsage: Effect.fn("ExtractionTelemetry.recordUsage")(
      (inputTokens: O.Option<number>, outputTokens: O.Option<number>) =>
        Ref.update(state, (current) => {
          const reported = O.isSome(inputTokens) || O.isSome(outputTokens);
          const complete = O.isSome(inputTokens) && O.isSome(outputTokens);
          const hasPendingAttempt = current.recordedAttempts < current.attemptCount;
          const attemptCount = hasPendingAttempt ? current.attemptCount : increment(current.attemptCount);
          return UsageState.make({
            chunkCount: current.chunkCount,
            attemptCount,
            recordedAttempts: increment(current.recordedAttempts),
            reportedAttempts: reported ? increment(current.reportedAttempts) : current.reportedAttempts,
            completeAttempts: complete ? increment(current.completeAttempts) : current.completeAttempts,
            inputTokens: O.match(inputTokens, {
              onNone: () => current.inputTokens,
              onSome: (count) => add(current.inputTokens, count),
            }),
            outputTokens: O.match(outputTokens, {
              onNone: () => current.outputTokens,
              onSome: (count) => add(current.outputTokens, count),
            }),
          });
        })
    ),
    recordChunkCount: Effect.fn("ExtractionTelemetry.recordChunkCount")((chunkCount: number) =>
      Ref.update(state, (current) => UsageState.make({ ...current, chunkCount }))
    ),
    snapshot: Ref.get(state).pipe(
      Effect.map((current) =>
        ExtractionTelemetry.make({
          chunkCount: current.chunkCount,
          usage: toUsage(current),
        })
      )
    ),
  });
});

/**
 * Records one provider attempt when an extraction telemetry scope is active.
 *
 * **Gotchas**
 *
 * Outside {@link captureExtractionTelemetry} this effect succeeds and writes
 * nothing.
 *
 * **Example** (Count an attempt without token totals)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { captureExtractionTelemetry, recordProviderAttempt } from "@effect-ontology/Telemetry/ExtractionTelemetry"
 *
 * const [, snapshot] = Effect.runSync(captureExtractionTelemetry(recordProviderAttempt))
 * console.log(snapshot.usage._tag) // "Unavailable"
 * ```
 *
 * @see {@link recordProviderUsage} for attaching token totals to an attempt.
 * @category observability
 * @since 0.0.0
 */
export const recordProviderAttempt: Effect.Effect<void> = Effect.serviceOption(ExtractionTelemetryCollector).pipe(
  Effect.flatMap(
    O.match({
      onNone: () => Effect.void,
      onSome: (telemetry) => telemetry.startAttempt,
    })
  )
);

/**
 * Records provider-reported token totals when an extraction telemetry scope is
 * active.
 *
 * **Example** (Capture complete token usage)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { captureExtractionTelemetry, recordProviderAttempt, recordProviderUsage } from "@effect-ontology/Telemetry/ExtractionTelemetry"
 *
 * const [, snapshot] = Effect.runSync(
 *   captureExtractionTelemetry(
 *     Effect.gen(function* () {
 *       yield* recordProviderAttempt
 *       yield* recordProviderUsage({ inputTokens: 12, outputTokens: 4 })
 *     })
 *   )
 * )
 * console.log(snapshot.usage._tag) // "Complete"
 * ```
 *
 * @see {@link captureExtractionTelemetry} for the scope that materializes Complete, Partial, or Unavailable usage.
 * @category observability
 * @since 0.0.0
 */
export const recordProviderUsage = (usage: {
  readonly inputTokens: unknown;
  readonly outputTokens: unknown;
}): Effect.Effect<void> =>
  Effect.serviceOption(ExtractionTelemetryCollector).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.void,
        onSome: (telemetry) =>
          telemetry.recordUsage(
            decodeUnknownNatural(usage.inputTokens),
            decodeUnknownNatural(usage.outputTokens)
          ),
      })
    )
  );

/**
 * Records the actual number of chunks produced by the extraction workflow.
 *
 * **Example** (Record two chunks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 * import { captureExtractionTelemetry, recordExtractionChunkCount } from "@effect-ontology/Telemetry/ExtractionTelemetry"
 *
 * const [, snapshot] = Effect.runSync(
 *   captureExtractionTelemetry(recordExtractionChunkCount(S.Natural.make(2)))
 * )
 * console.log(snapshot.chunkCount) // 2
 * ```
 *
 * @see {@link captureExtractionTelemetry} for the scope that stores this chunk count.
 * @category observability
 * @since 0.0.0
 */
export const recordExtractionChunkCount = (chunkCount: number): Effect.Effect<void> =>
  Effect.serviceOption(ExtractionTelemetryCollector).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.void,
        onSome: (telemetry) => telemetry.recordChunkCount(chunkCount),
      })
    )
  );

/**
 * Runs an extraction effect with an isolated usage collector and returns the
 * value paired with a usage snapshot.
 *
 * **Gotchas**
 *
 * Record helpers invoked outside this wrapper do not share counters and do
 * not throw.
 *
 * **Example** (Capture complete usage for one extraction)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { captureExtractionTelemetry, recordProviderAttempt, recordProviderUsage } from "@effect-ontology/Telemetry/ExtractionTelemetry"
 *
 * const [value, snapshot] = Effect.runSync(
 *   captureExtractionTelemetry(
 *     Effect.gen(function* () {
 *       yield* recordProviderAttempt
 *       yield* recordProviderUsage({ inputTokens: 12, outputTokens: 4 })
 *       return "graph"
 *     })
 *   )
 * )
 * console.log(value) // "graph"
 * console.log(snapshot.usage._tag) // "Complete"
 * ```
 *
 * @see {@link ExtractionTelemetryCollector} for the request-local service this installs.
 * @category observability
 * @since 0.0.0
 */
export const captureExtractionTelemetry = Effect.fn("ExtractionTelemetry.capture")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<readonly [A, ExtractionTelemetry], E, R> {
  const telemetry = yield* makeExtractionTelemetry();
  const value = yield* effect.pipe(Effect.provideService(ExtractionTelemetryCollector, telemetry));
  const snapshot = yield* telemetry.snapshot;
  return [value, snapshot];
});

/**
 * Shared durable-activity policies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Schedule from "effect/Schedule";
/**
 * Jittered exponential retry schedule used by durable ontology activities.
 *
 * **Details**
 *
 * Backoff starts at 1 second, is capped at 3 recurrences, and continues only
 * while the stepped Cause contains interrupts.
 *
 * **Gotchas**
 *
 * Typed failures and defects do not retry. Only interrupt causes keep the
 * schedule alive.
 *
 * **Example** (Retry interrupts, not typed failures)
 *
 * ```ts
 * import { activityRetryPolicy } from "@effect-ontology/Utils/Activity"
 * import * as Cause from "effect/Cause";
 * import * as Effect from "effect/Effect";
 * import * as Exit from "effect/Exit";
 * import * as Schedule from "effect/Schedule";
 * const retriesInterrupt = Effect.runSync(
 *   Effect.gen(function* () {
 *     const step = yield* Schedule.toStep(activityRetryPolicy)
 *     return yield* Effect.exit(step(0, Cause.interrupt()))
 *   })
 * )
 * const retriesFailure = Effect.runSync(
 *   Effect.gen(function* () {
 *     const step = yield* Schedule.toStep(activityRetryPolicy)
 *     return yield* Effect.exit(step(0, Cause.fail("timeout")))
 *   })
 * )
 * console.log(Exit.isSuccess(retriesInterrupt)) // true
 * console.log(Exit.isSuccess(retriesFailure)) // false
 * ```
 *
 * @category schedulers
 * @since 0.0.0
 */
export const activityRetryPolicy = Schedule.max([Schedule.exponential("1 second"), Schedule.recurs(3)]).pipe(
  Schedule.jittered,
  Schedule.setInputType<Cause.Cause<unknown>>(),
  Schedule.while((meta) => Cause.hasInterrupts(meta.input))
);

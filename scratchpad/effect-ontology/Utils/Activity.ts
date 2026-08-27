/**
 * Shared durable-activity policies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Cause, Schedule } from "effect";

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
 * import { Cause, Effect, Exit, Schedule } from "effect"
 *
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

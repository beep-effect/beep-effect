/**
 * Shared durable-activity policies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Cause, Schedule } from "effect";

/**
 * Default interrupt retry schedule used by durable ontology activities.
 *
 * **Example** (Inspect the retry policy)
 *
 * ```ts
 * import { activityRetryPolicy } from "@effect-ontology/Utils/Activity"
 *
 * console.log(activityRetryPolicy)
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

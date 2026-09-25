/**
 * Nearest-rank percentile shared by the CLI's timing reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Order } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import type * as O from "effect/Option";

/**
 * Pick the nearest-rank percentile of a sample.
 *
 * **Details**
 *
 * The sample is sorted ascending and the value at index
 * `clamp(ceil(quantile · n) − 1, 0, n − 1)` is returned unrounded, the
 * estimator the A1 economics script uses. An empty sample has no percentile.
 * `quantile` is a fraction: `0.5` is the median, `0.95` the p95.
 *
 * **Example** (Read the median and p95)
 *
 * ```ts
 * import { nearestRank } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(nearestRank([30, 10, 20, 40], 0.5)) // Some(20)
 * console.log(nearestRank([30, 10, 20, 40], 0.95)) // Some(40)
 * console.log(O.isNone(nearestRank([], 0.5))) // true
 * ```
 *
 * @param values - The sample, in any order.
 * @param quantile - The percentile as a fraction in `(0, 1]`.
 * @returns The nearest-rank value, or none for an empty sample.
 * @category utilities
 * @since 0.0.0
 */
export const nearestRank: {
  (quantile: number): (values: ReadonlyArray<number>) => O.Option<number>;
  (values: ReadonlyArray<number>, quantile: number): O.Option<number>;
} = dual(2, (values: ReadonlyArray<number>, quantile: number): O.Option<number> => {
  const sorted = A.sort(values, Order.Number);
  const count = A.length(sorted);
  return A.get(sorted, Num.clamp(Math.ceil(quantile * count) - 1, { minimum: 0, maximum: count - 1 }));
});

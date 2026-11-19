import * as S from "effect/Schema";

/**
 * How many steps a run records before it continues as a new run (D23): a
 * whole number that is one or more. A run whose step count reaches its bound
 * continues, so a bound of one continues after every step.
 *
 * **Example** (A run that continues after twenty steps)
 * ```ts
 * import { HistoryBound } from "@proto/runs-contract/Run/HistoryBound";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(HistoryBound)(20);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HistoryBound = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: "HistoryBoundCheck",
    title: "History bound",
    description: "How many steps a run records before it continues as a new run: one or more.",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type HistoryBound = typeof HistoryBound.Type;

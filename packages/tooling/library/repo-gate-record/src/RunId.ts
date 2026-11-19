/**
 * Minting time-sortable run ids and choosing which root runs retention
 * removes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Order from "effect/Order";
import * as Random from "effect/Random";
import * as Str from "effect/String";
import type { RunId } from "./GatePaths.ts";

/**
 * How many root runs of one gate the repository root keeps.
 *
 * **Example** (Read the retention count)
 *
 * ```ts
 * import { ROOT_RUNS_KEPT } from "@beep/repo-gate-record/RunId";
 *
 * console.log(ROOT_RUNS_KEPT); // 20
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROOT_RUNS_KEPT = 20;

const compactInstant: (instant: DateTime.Utc) => string = flow(DateTime.formatIso, Str.replace(/[-:.]/gu, ""));

/**
 * Mint a run id that sorts by time: the UTC instant to the millisecond and
 * four random hex digits, as `20261119T100000123Z-0a1b`.
 *
 * **Details**
 *
 * The instant comes from the `Clock` and the suffix from `Random`, so a test
 * pins both. The suffix separates two runs started in the same millisecond.
 *
 * **Example** (Mint a run id)
 *
 * ```ts
 * import { makeRunId } from "@beep/repo-gate-record/RunId";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(makeRunId)); // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRunId: Effect.Effect<RunId> = Effect.gen(function* () {
  const now = yield* DateTime.now;
  const suffix = yield* Random.nextIntBetween(0, 0xffff);
  return `${compactInstant(now)}-${Str.padStart(4, "0")(suffix.toString(16))}`;
}).pipe(Effect.withSpan("RunId.makeRunId"));

/**
 * Sort run ids newest first.
 *
 * **Example** (Sort run ids)
 *
 * ```ts
 * import { newestFirst } from "@beep/repo-gate-record/RunId";
 *
 * console.log(newestFirst(["20261119T100000000Z-0001", "20261120T100000000Z-0001"])[0]);
 * // 20261120T100000000Z-0001
 * ```
 *
 * @param runIds - the run ids to order, as minted by makeRunId
 * @returns the same ids with the latest first
 * @category utilities
 * @since 0.0.0
 */
export const newestFirst = (runIds: ReadonlyArray<RunId>): ReadonlyArray<RunId> =>
  A.sort(runIds, Order.flip(Order.String));

/**
 * The run ids retention removes: every run past the newest
 * {@link ROOT_RUNS_KEPT}.
 *
 * **Example** (Keep twenty of twenty-one runs)
 *
 * ```ts
 * import { expiredRuns } from "@beep/repo-gate-record/RunId";
 * import * as A from "effect/Array";
 *
 * const ids = A.makeBy(21, (index) => `run-${index + 10}`);
 * console.log(expiredRuns(ids)); // ["run-10"]
 * ```
 *
 * @param runIds - the root run ids of one gate, in any order
 * @returns the ids past the newest twenty, oldest last, which retention removes
 * @category utilities
 * @since 0.0.0
 */
export const expiredRuns = (runIds: ReadonlyArray<RunId>): ReadonlyArray<RunId> =>
  A.drop(newestFirst(runIds), ROOT_RUNS_KEPT);

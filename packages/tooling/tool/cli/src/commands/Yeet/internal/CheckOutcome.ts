/**
 * Closed literal domains shared by the watch stream and the settle rule.
 *
 * **Details**
 *
 * `WatchStream.ts` classifies GitHub's raw check vocabulary into
 * {@link YeetCheckOutcome}, and `Settle.ts` folds those outcomes into a settle
 * verdict whose wait reason is {@link YeetSettleReason}. The watch snapshot
 * carries the verdict, so the two modules would otherwise import each other;
 * this leaf holds the vocabulary both speak and imports nothing from either.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoCliId.create("commands/Yeet/internal/CheckOutcome");

/**
 * Closed outcome domain a check occupies from the watch's point of view.
 *
 * **Details**
 *
 * This is the internal vocabulary events speak. The boundary keeps GitHub's
 * raw `bucket`/`state` strings; `classifyYeetCheckOutcome` in `WatchStream.ts`
 * maps them here totally, so downstream code matches on four cases instead of
 * an open-ended string set.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { YeetCheckOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetCheckOutcome.is.fail("fail")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetCheckOutcome = LiteralKit(["pending", "pass", "fail", "skip"]).pipe(
  $I.annoteSchema("YeetCheckOutcome", {
    title: "Yeet Check Outcome",
    description: "Closed classification of one PR check's state within a watch snapshot.",
  })
);

/**
 * Closed outcome domain a check occupies from the watch's point of view.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetCheckOutcome = typeof YeetCheckOutcome.Type;

/**
 * Why a merge loop is still waiting on a head, as the gate line names it.
 *
 * **Details**
 *
 * `registration`: no checks have reported for the head yet (GitHub's
 * post-push registration window). `required-pending`: expected required
 * contexts are missing or still pending. `closeout-pending`: the required
 * census settled and the read-first closeout has not yet bound this head.
 * `settle-timeout`: the census never settled within `--settle-timeout`; the
 * only terminal reason. The settle rule itself lives in `Settle.ts`; the
 * `settle-changed` watch event streams the reason.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { YeetSettleReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetSettleReason.is["settle-timeout"]("settle-timeout")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetSettleReason = LiteralKit([
  "registration",
  "required-pending",
  "closeout-pending",
  "settle-timeout",
]).pipe(
  $I.annoteSchema("YeetSettleReason", {
    title: "Yeet Settle Reason",
    description: "Why a merge loop is still waiting on a pull request head.",
  })
);

/**
 * Why a merge loop is still waiting on a head.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetSettleReason = typeof YeetSettleReason.Type;

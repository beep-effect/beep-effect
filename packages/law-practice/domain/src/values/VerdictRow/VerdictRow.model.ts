/**
 * Verdict-row value objects: one append-only entry in the attorney's verdict
 * log for a review item.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { ReviewItemId } from "../ReviewItem/index.ts";

const $I = $LawPracticeDomainId.create("values/VerdictRow/VerdictRow.model");

/**
 * **Details**
 *
 * `right` and `wrong` are final judgements. `partly` is a judgement that
 * returns the item to the queue. `withdrawn` clears an earlier verdict, for
 * example an accidental click, so the item has no current judgement and is
 * open again. Every value supersedes the item's earlier rows by recency, so
 * the audit trail keeps the withdrawn verdict.
 *
 * **Example** (Guard a verdict)
 *
 * ```ts
 * import { Verdict } from "@beep/law-practice-domain"
 *
 * console.log(Verdict.is.partly("partly")) // true
 * console.log(Verdict.is.withdrawn("withdrawn")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Verdict = LiteralKit(["right", "wrong", "partly", "withdrawn"]).pipe(
  $I.annoteSchema("Verdict", {
    description:
      "The attorney's judgement of a review item: right, wrong, partly right, or withdrawn (no current judgement).",
  })
);

/**
 * @see {@link Verdict} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type Verdict = typeof Verdict.Type;

/**
 * **Details**
 *
 * Every {@link VerdictRow} names its batch. Locking closes one batch, not the
 * whole verdict log, so a later sitting opens a new batch id and keeps
 * appending. The id is non-empty and carries no leading or trailing
 * whitespace; decoding rejects padded ids rather than trimming them.
 *
 * **Example** (Check a review batch id)
 *
 * ```ts
 * import { ReviewBatchId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReviewBatchId)("sitting-2026-10-14")) // true
 * console.log(S.is(ReviewBatchId)(" sitting-2026-10-14 ")) // false
 * console.log(S.is(ReviewBatchId)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewBatchId = S.NonEmptyString.check(S.isTrimmed()).pipe(
  $I.annoteSchema("ReviewBatchId", {
    description: "Identifier of one review batch (a single review sitting or queue run); a lock closes one batch.",
  })
);

/**
 * @see {@link ReviewBatchId} for the batch semantics.
 * @category models
 * @since 0.0.0
 */
export type ReviewBatchId = typeof ReviewBatchId.Type;

/**
 * **Details**
 *
 * Rows are never edited or deleted. Undo appends a superseding row for the
 * same `itemId` in the same `batchId` with `revision` one higher; revisions
 * count per item within one batch and start at 1. An item's current verdict
 * is its row with the greatest `recordedAt` across all batches, ties broken by
 * the row appended last (revisions never compare across items or batches), since
 * rows are read in append order. Every row names its `batchId`: a batch is one
 * review sitting or queue run. A row with `lockedAt` closes that row's
 * `batchId` only; other batches stay open and later sittings append under a
 * new batch id. Locking appends a copy of the batch's latest row with
 * `revision` + 1, the same `recordedAt`, and `lockedAt` set; verdict
 * selection skips lock rows, which only mark the batch closed. Timestamps
 * encode as epoch milliseconds.
 *
 * **Example** (Decode a verdict row)
 *
 * ```ts
 * import { VerdictRow } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const row = Effect.runSync(
 *   S.decodeUnknownEffect(VerdictRow)({
 *     itemId: "claim-finding:1",
 *     batchId: "sitting-2026-10-14",
 *     verdict: "wrong",
 *     note: "The reference shows a latch, not a hinge.",
 *     revision: 1,
 *     recordedAt: 1_760_400_000_000,
 *   })
 * )
 *
 * console.log(row.verdict) // "wrong"
 * console.log(O.isNone(row.lockedAt)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class VerdictRow extends S.Opaque<VerdictRow, { readonly brand: unique symbol }>()(
  S.Struct({
    itemId: ReviewItemId.annotateKey({
      description: "Review item this verdict judges.",
    }),
    batchId: ReviewBatchId.annotateKey({
      description: "Review batch (sitting or queue run) this row belongs to; a lock closes one batch.",
    }),
    verdict: Verdict.annotateKey({
      description: "The attorney's judgement.",
    }),
    note: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Optional note the attorney typed with the verdict.",
      })
    ),
    revision: PosInt.annotateKey({
      description: "One-based revision for this item; a higher revision supersedes lower ones.",
    }),
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "When the verdict was recorded, encoded as epoch milliseconds.",
    }),
    lockedAt: S.DateTimeUtcFromMillis.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "When this row's batch was locked; a locked batch accepts no further rows.",
      })
    ),
  }).pipe(
    $I.annoteSchema("VerdictRow", {
      description: "One append-only entry in the attorney's verdict log for a review item.",
    })
  )
) {}

/**
 * **Example** (Type an encoded verdict row timestamp)
 *
 * ```ts
 * import type { VerdictRow } from "@beep/law-practice-domain"
 *
 * const recordedAt: VerdictRow.Encoded["recordedAt"] = 1_760_400_000_000
 * console.log(recordedAt) // 1760400000000
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace VerdictRow {
  /**
   * Wire-encoded representation of a decoded {@link VerdictRow}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { VerdictRow } from "@beep/law-practice-domain"
   *
   * type Wire = VerdictRow.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof VerdictRow.Encoded;
}

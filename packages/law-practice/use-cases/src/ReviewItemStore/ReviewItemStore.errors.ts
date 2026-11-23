/**
 * Typed failure of the review-item store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ReviewItemId } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("ReviewItemStore/ReviewItemStore.errors");

const ReviewItemStoreOperationBase = LiteralKit(["read", "upsert", "repair"]);

/**
 * Review-item store operation that failed.
 *
 * **Example** (Guard a store operation)
 *
 * ```ts
 * import { ReviewItemStoreOperation } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * console.log(ReviewItemStoreOperation.is.upsert("upsert")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ReviewItemStoreOperation = ReviewItemStoreOperationBase.pipe(
  $I.annoteSchema("ReviewItemStoreOperation", {
    description:
      "Review-item store operation that failed: reading the items, storing some, or storing an explicit repair.",
  }),
  SchemaUtils.withLiteralKitStatics(ReviewItemStoreOperationBase)
);

/**
 * Runtime type for {@link ReviewItemStoreOperation}.
 *
 * @see {@link ReviewItemStoreOperation} for the operation names.
 * @category errors
 * @since 0.0.0
 */
export type ReviewItemStoreOperation = typeof ReviewItemStoreOperation.Type;

/**
 * The review-item store could not read its items or store some.
 *
 * **Details**
 *
 * A store that cannot answer fails with this error rather than returning no
 * items, so an unreadable store never looks like an empty queue. After a
 * failed `upsert` some items may be stored; storing them again is safe.
 * `reason` holds file names, line numbers and counts only, never item text.
 *
 * **Example** (Report a corrupt store)
 *
 * ```ts
 * import { ReviewItemStoreError } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * const error = ReviewItemStoreError.make({ operation: "read", reason: "items.jsonl line 3 does not decode" })
 * console.log(error.operation) // "read"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReviewItemStoreError extends S.TaggedError<ReviewItemStoreError, { readonly brand: unique symbol }>(
  $I`ReviewItemStoreError`
)(
  "ReviewItemStoreError",
  {
    cause: DefectCause.annotateKey({
      description: "Optional underlying store defect.",
    }),
    operation: ReviewItemStoreOperation.annotateKey({
      description: "Store operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Diagnostic made of file names, line numbers and counts only; never item text.",
    }),
  },
  $I.annoteError<ReviewItemStoreError>("ReviewItemStoreError", {
    title: "Review-item store unavailable",
    description: "The review-item store could not read its items or store some.",
  })
) {}

/**
 * A stored item is an unresolved legacy import, so an executable write to it
 * is refused until it is repaired.
 *
 * **Details**
 *
 * The item stays listed as a `LegacyReviewItemImported`. Recording an answer
 * for it, or admitting a verdict on it, waits for an explicit repair through
 * `ReviewItemStore.repair`.
 *
 * **Example** (Report an item awaiting repair)
 *
 * ```ts
 * import { ReviewItemRepairRequiredError } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * const error = ReviewItemRepairRequiredError.make({ itemId: "question:1" })
 * console.log(error.itemId) // "question:1"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReviewItemRepairRequiredError extends S.TaggedError<
  ReviewItemRepairRequiredError,
  { readonly brand: unique symbol }
>($I`ReviewItemRepairRequiredError`)(
  "ReviewItemRepairRequiredError",
  {
    itemId: ReviewItemId.annotateKey({
      description: "Stored item whose legacy quote could not become a selector.",
    }),
  },
  $I.annoteError<ReviewItemRepairRequiredError>("ReviewItemRepairRequiredError", {
    title: "Review item awaiting repair",
    description: "A stored item is an unresolved legacy import, so an executable write to it is refused.",
  })
) {}

/**
 * Typed failure of the review-item store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("ReviewItemStore/ReviewItemStore.errors");

const ReviewItemStoreOperationBase = LiteralKit(["read", "upsert"]);

/**
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
    description: "Review-item store operation that failed: reading the items or storing some.",
  }),
  SchemaUtils.withLiteralKitStatics(ReviewItemStoreOperationBase)
);

/**
 * @see {@link ReviewItemStoreOperation} for the operation names.
 * @category errors
 * @since 0.0.0
 */
export type ReviewItemStoreOperation = typeof ReviewItemStoreOperation.Type;

/**
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

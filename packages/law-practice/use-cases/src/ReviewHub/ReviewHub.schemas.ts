/**
 * Review hub tool envelopes: the object roots MCP needs around the existing
 * review schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ReviewBatchId, ReviewItem, ReviewItemId } from "@beep/law-practice-domain";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";
import { RecordAnswerInput } from "../QuestionQueue/QuestionQueue.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ReviewHub/ReviewHub.schemas");

/**
 * **Example** (Decode an open-items request)
 *
 * ```ts
 * import { OpenItemsRequest } from "@beep/law-practice-use-cases/ReviewHub"
 * import * as S from "effect/Schema"
 *
 * const request = S.decodeUnknownSync(OpenItemsRequest)({ today: "2026-10-14" })
 * console.log(request.today.toISOString()) // "2026-10-14"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenItemsRequest extends S.Opaque<OpenItemsRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    today: LocalDateFromString.annotateKey({
      description: "Day the question digest is drawn for, as YYYY-MM-DD.",
    }),
  }).pipe(
    $I.annoteSchema("OpenItemsRequest", {
      description: "Request for the items waiting for the attorney on one day.",
    })
  )
) {}

/**
 * **Details**
 *
 * Verdict items appear while they lack a final verdict; questions appear
 * while the daily digest selects them.
 *
 * **Example** (List the open-items fields)
 *
 * ```ts
 * import { OpenItems } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(Object.keys(OpenItems.fields)) // ["items"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenItems extends S.Opaque<OpenItems, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(ReviewItem).annotateKey({
      description: "Open verdict items and the question digest, in store order.",
    }),
  }).pipe(
    $I.annoteSchema("OpenItems", {
      description: "The items waiting for the attorney, in the order the store holds them.",
    })
  )
) {}

/**
 * **Example** (Decode a lock request)
 *
 * ```ts
 * import { LockBatchRequest } from "@beep/law-practice-use-cases/ReviewHub"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(LockBatchRequest)({ batchId: "sitting-1" }).batchId) // "sitting-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LockBatchRequest extends S.Opaque<LockBatchRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    batchId: ReviewBatchId.annotateKey({
      description: "Review batch to lock.",
    }),
  }).pipe(
    $I.annoteSchema("LockBatchRequest", {
      description: "Request to lock one review batch.",
    })
  )
) {}

/**
 * **Details**
 *
 * The hub looks the question up by `itemId`; the answer must name the same
 * item.
 *
 * **Example** (Decode an answer request)
 *
 * ```ts
 * import { RecordAnswerRequest } from "@beep/law-practice-use-cases/ReviewHub"
 * import * as S from "effect/Schema"
 *
 * const request = S.decodeUnknownSync(RecordAnswerRequest)({
 *   itemId: "question:1",
 *   answer: { state: "decided", itemId: "question:1", optionId: "keep-date" }
 * })
 * console.log(request.answer.state) // "decided"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecordAnswerRequest extends S.Opaque<RecordAnswerRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    itemId: ReviewItemId.annotateKey({
      description: "Stored question the answer is for.",
    }),
    answer: RecordAnswerInput.annotateKey({
      description: "The attorney's answer, before the queue assigns its revision and timestamp.",
    }),
  }).pipe(
    $I.annoteSchema("RecordAnswerRequest", {
      description: "Request to record the attorney's answer to one stored question.",
    })
  )
) {}

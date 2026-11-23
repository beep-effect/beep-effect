/**
 * The review hub's tool failure: a stable code and a plain message.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ReviewHub/ReviewHub.errors");

const ReviewHubErrorCodeBase = LiteralKit(["not-found", "locked", "unknown-option", "store-unavailable"]);

/**
 * **Details**
 *
 * - `not-found`: the item is not a stored question, or the batch has no
 *   verdicts to lock;
 * - `locked`: the batch is already locked;
 * - `unknown-option`: the answer names an option the question does not offer;
 * - `store-unavailable`: a store could not be read or written; retry later.
 *
 * **Example** (Guard a failure code)
 *
 * ```ts
 * import { ReviewHubErrorCode } from "@beep/law-practice-use-cases/ReviewHub"
 *
 * console.log(ReviewHubErrorCode.is.locked("locked")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ReviewHubErrorCode = ReviewHubErrorCodeBase.pipe(
  $I.annoteSchema("ReviewHubErrorCode", {
    description: "Stable code of a review hub tool failure: not-found, locked, unknown-option or store-unavailable.",
  }),
  SchemaUtils.withLiteralKitStatics(ReviewHubErrorCodeBase)
);

/**
 * @see {@link ReviewHubErrorCode} for the codes.
 * @category errors
 * @since 0.0.0
 */
export type ReviewHubErrorCode = typeof ReviewHubErrorCode.Type;

/**
 * **Details**
 *
 * Every tool returns this value as an MCP tool error (`isError: true`), its
 * JSON encoding the only text content. The message names item, option and
 * batch ids only, never item text or notes.
 *
 * **Example** (Decode a tool failure)
 *
 * ```ts
 * import { ReviewHubToolError } from "@beep/law-practice-use-cases/ReviewHub"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(S.fromJsonString(ReviewHubToolError))(
 *   '{"code":"locked","message":"Review batch sitting-1 is locked."}'
 * )
 * console.log(failure.code) // "locked"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReviewHubToolError extends S.Opaque<ReviewHubToolError, { readonly brand: unique symbol }>()(
  S.Struct({
    code: ReviewHubErrorCode.annotateKey({
      description: "Stable failure code the client branches on.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Plain explanation naming ids only; never item text or notes.",
    }),
  }).pipe(
    $I.annoteSchema("ReviewHubToolError", {
      description: "Failure a review hub tool returns: a stable code and a plain message.",
    })
  )
) {}

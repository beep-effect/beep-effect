/**
 * The Search contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import { Defect, SchemaUtils } from "@beep/schema";
import { HttpStatus2XX, HttpStatus4XX, HttpStatus5XX } from "@beep/schema/HttpStatus";
import * as S from "effect/Schema";
import { HttpApiSchema } from "effect/unstable/httpapi";
import { SearchBody } from "../..//values/index.ts";
import { SearchResponse } from "../../values/SearchResponse/index.ts";

const $I = $GovinfoId.create("domain/contracts/Search/Search.contract");

/**
 * Request body accepted by the GovInfo search endpoint.
 *
 * **Details**
 *
 * GovInfo search is a POST endpoint. `offsetMark` normally starts as `"*"`
 * and the API returns the next cursor in response pagination links.
 *
 * **Example** (Decode search request payload)
 *
 * ```ts
 * import { Payload } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 * import * as S from "effect/Schema"
 *
 * const payload = S.decodeUnknownSync(Payload)({
 *   historical: false,
 *   offsetMark: "*",
 *   pageSize: 10,
 *   query: "collection:(CREC) congress:118",
 *   resultLevel: "default",
 *   sorts: [{ field: "publishdate", sortOrder: "DESC" }]
 * })
 *
 * console.log(payload.query)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class Payload extends SearchBody.extend<Payload>($I`Payload`)(
  {},
  $I.annote("Payload", {
    description: "Request body accepted by the GovInfo search endpoint.",
  })
) {}

/**
 * Successful GovInfo search response body.
 *
 * **Example** (Decode search success body)
 *
 * ```ts
 * import { Success } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 * import * as S from "effect/Schema"
 *
 * const response = S.decodeUnknownSync(Success)({
 *   count: 1,
 *   offsetMark: "next-cursor",
 *   results: [
 *     {
 *       collectionCode: "CREC",
 *       dateIngested: "2024-01-03T00:00:00Z",
 *       dateIssued: "2024-01-03T00:00:00Z",
 *       download: { pdfLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/pdf" },
 *       governmentAuthor: ["Government Publishing Office"],
 *       granuleId: "CREC-2024-01-03-pt1-PgH1",
 *       lastModified: "2024-01-04T12:00:00Z",
 *       packageId: "CREC-2024-01-03",
 *       resultLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
 *       title: "Congressional Record, January 3, 2024"
 *     }
 *   ]
 * })
 *
 * console.log(response.count)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class Success extends SearchResponse.extend<Success>($I`Success`)(
  {},
  $I.annote("Success", {
    description: "Successful GovInfo search response body.",
    status: HttpStatus2XX.From.Enum.Ok,
  })
) {}

/**
 * Bad-request failure returned by the GovInfo search endpoint.
 *
 * **Example** (Decode bad-request failure)
 *
 * ```ts
 * import { FailureBadRequest } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(FailureBadRequest)({
 *   status: 400
 * })
 *
 * console.log(failure._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FailureBadRequest extends S.TaggedError<FailureBadRequest>($I`FailureBadRequest`)(
  "FailureBadRequest",
  {
    cause: S.OptionFromOptionalKey(Defect()).pipe(SchemaUtils.withNoneDefault),
    status: S.tag(HttpStatus4XX.From.Enum.BadRequest),
  },
  $I.annoteError<FailureBadRequest>("FailureBadRequest", {
    description: "Bad-request failure returned when GovInfo rejects the submitted search payload.",
  })
) {}

/**
 * Not-found failure returned by the GovInfo search endpoint.
 *
 * **Example** (Decode not-found failure)
 *
 * ```ts
 * import { FailureNotFound } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(FailureNotFound)({
 *   status: 404
 * })
 *
 * console.log(failure.status)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FailureNotFound extends S.TaggedError<FailureNotFound>($I`FailureNotFound`)(
  "FailureNotFound",
  {
    cause: S.OptionFromOptionalKey(Defect()).pipe(SchemaUtils.withNoneDefault),
    status: S.tag(HttpStatus4XX.From.Enum.NotFound),
  },
  $I.annoteError<FailureNotFound>("FailureNotFound", {
    description: "Not-found failure returned when the GovInfo search route or resource is unavailable.",
  })
) {}

/**
 * Internal-server-error failure returned by the GovInfo search endpoint.
 *
 * **Example** (Decode internal server failure)
 *
 * ```ts
 * import { FailureInternalServerError } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(FailureInternalServerError)({
 *   status: 500
 * })
 *
 * console.log(failure._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FailureInternalServerError extends S.TaggedError<FailureInternalServerError>(
  $I`FailureInternalServerError`
)(
  "FailureInternalServerError",
  {
    cause: S.OptionFromOptionalKey(Defect()).pipe(SchemaUtils.withNoneDefault),
    status: S.tag(HttpStatus5XX.From.Enum.InternalServerError),
  },
  $I.annoteError<FailureInternalServerError>("FailureInternalServerError", {
    description: "Internal-server-error failure returned when GovInfo reports an unexpected server-side error.",
  })
) {}

/**
 * Tagged union of GovInfo search endpoint failures.
 *
 * **Example** (Guard Failure union membership)
 *
 * ```ts
 * import { Failure } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 *
 * console.log(Failure.is({ _tag: "FailureNotFound", status: 404 }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const Failure = S.Union([
  FailureBadRequest.pipe(HttpApiSchema.status(400)),
  FailureNotFound.pipe(HttpApiSchema.status(404)),
  FailureInternalServerError.pipe(HttpApiSchema.status(500)),
]).pipe(
  // fallow-ignore-next-line code-duplication -- preserve the selected guard through Effect's tagged-union rebuild
  $I.annoteSchema("Failure", {
    description: "Tagged union of typed GovInfo search endpoint failures.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("_tag"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Type for {@link Failure}.
 *
 * **Example** (Annotate Failure tag type)
 *
 * ```ts
 * import type { Failure } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 *
 * const tag: Failure["_tag"] = "FailureBadRequest"
 * console.log(tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type Failure = typeof Failure.Type;

/**
 * Companion namespace for {@link Failure}.
 *
 * **Example** (Assign Failure tag literal)
 *
 * ```ts
 * import type { Failure } from "@beep/govinfo/domain/contracts/Search/Search.contract"
 *
 * const tag: Failure["_tag"] = "FailureBadRequest"
 * console.log(tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Failure {
  /**
   * Encoded type for {@link Failure}.
   *
   * **Example** (Annotate encoded Failure tag)
   *
   * ```ts
   * import type { Failure } from "@beep/govinfo/domain/contracts/Search/Search.contract"
   *
   * const tag: Failure.Encoded["_tag"] = "FailureBadRequest"
   * console.log(tag)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  export type Encoded = typeof Failure.Encoded;
}

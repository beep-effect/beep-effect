/**
 * Typed HTTP error classes and convenience constructors for standard status codes.
 *
 * **Details**
 *
 * Each error class extends `S.TaggedError` with a fixed status code, carries
 * `ErrorReporter.severity` and `ErrorReporter.attributes` for structured
 * observability, and is transport-safe via Effect Schema.
 *
 * **Example** (Fail with typed HTTP errors)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { NotFoundError, makeBadRequestError } from "@beep/observability/HttpError"
 *
 * const failNotFound = Effect.fail(
 *   NotFoundError.make({ cause: O.none(), message: "missing", status: 404 })
 * )
 *
 * const failBadReq = Effect.fail(makeBadRequestError("missing field"))
 *
 * console.log(failNotFound)
 * console.log(failBadReq)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObservabilityId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as ErrorReporter from "effect/ErrorReporter";
import { dual } from "effect/Function";
import * as HttpStatus from "effect/http/HttpStatus";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("HttpError");

const clientStatusAttributes = <Status extends number>(status: Status) =>
  ({
    status,
    status_class: "4xx",
  }) as const;

const serverStatusAttributes = <Status extends number>(status: Status) =>
  ({
    status,
    status_class: "5xx",
  }) as const;

type StatusErrorConstructor<ErrorValue> = {
  // Data-first first: a lone `string` binds to `message`, so the data-last
  // overload never absorbs it even though its `cause` accepts `unknown`.
  (message: string, cause?: unknown): ErrorValue;
  (cause?: unknown): (message: string) => ErrorValue;
};

const isStatusErrorDataFirst = (args: IArguments): boolean => args.length >= 2 || P.isString(args[0]);

type StatusErrorInput<Status extends number> = {
  readonly message: string;
  readonly status: Status;
  readonly cause: O.Option<unknown>;
};

const makeStatusConstructor =
  <Status extends number, Error>(ctor: new (value: StatusErrorInput<Status>) => Error, status: Status) =>
  (message: string, cause?: unknown): Error =>
    new ctor({ message, status, cause: O.isOption(cause) ? cause : O.fromUndefinedOr(cause) });

// The retired `@beep/schema` `HttpStatus4XX` / `HttpStatus5XX` kits: the status name on the
// encoded side and its code on the decoded side, over the same names. Each name maps to its
// `effect/http/HttpStatus` code, so an unnamed code in the range still fails to decode, as before.
const statusNameCodec = <const Name extends HttpStatus.Literal>(names: A.NonEmptyReadonlyArray<Name>) =>
  S.Literals(names).transform(A.map(names, HttpStatus.fromLiteral));

const ClientErrorStatus = statusNameCodec([
  "BadRequest",
  "Unauthorized",
  "PaymentRequired",
  "Forbidden",
  "NotFound",
  "MethodNotAllowed",
  "NotAcceptable",
  "ProxyAuthenticationRequired",
  "RequestTimeout",
  "Conflict",
  "Gone",
  "LengthRequired",
  "PreconditionFailed",
  "PayloadTooLarge",
  "UriTooLong",
  "UnsupportedMediaType",
  "RangeNotSatisfiable",
  "ExpectationFailed",
  "ImATeapot",
  "MisdirectedRequest",
  "UnprocessableEntity",
  "Locked",
  "FailedDependency",
  "TooEarly",
  "UpgradeRequired",
  "PreconditionRequired",
  "TooManyRequests",
  "RequestHeaderFieldsTooLarge",
  "UnavailableForLegalReasons",
]).pipe(
  $I.annoteSchema("ClientErrorStatus", {
    description: "HTTP client error status: the status name when encoded, its 4xx code when decoded.",
  })
);

const ServerErrorStatus = statusNameCodec([
  "InternalServerError",
  "NotImplemented",
  "BadGateway",
  "ServiceUnavailable",
  "GatewayTimeout",
  "HttpVersionNotSupported",
  "VariantAlsoNegotiates",
  "InsufficientStorage",
  "LoopDetected",
  "NotExtended",
  "NetworkAuthenticationRequired",
]).pipe(
  $I.annoteSchema("ServerErrorStatus", {
    description: "HTTP server error status: the status name when encoded, its 5xx code when decoded.",
  })
);

const statusFields = <Status extends S.Top>(status: Status) =>
  ({
    message: S.String,
    status,
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ),
  }) as const;

/**
 * Shared tagged error for 4xx HTTP responses with `Warn` severity.
 *
 * **Example** (Create client HTTP error)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { ClientHttpError } from "@beep/observability/HttpError"
 *
 * const err = ClientHttpError.make({
 *   cause: O.none(),
 *   message: "invalid input",
 *   status: 400
 * })
 *
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientHttpError extends S.TaggedError<ClientHttpError, { readonly brand: unique symbol }>(
  $I`ClientHttpError`
)(
  "ClientHttpError",
  {
    message: S.String,
    status: ClientErrorStatus,
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ),
  },
  $I.annoteError<ClientHttpError>("ClientHttpError", {
    description: "Shared tagged error for 4xx HTTP responses.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * Shared tagged error for 5xx HTTP responses with `Error` severity.
 *
 * **Example** (Create server HTTP error)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { ServerHttpError } from "@beep/observability/HttpError"
 *
 * const err = ServerHttpError.make({
 *   cause: O.none(),
 *   message: "server failed",
 *   status: 500
 * })
 *
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ServerHttpError extends S.TaggedError<ServerHttpError, { readonly brand: unique symbol }>(
  $I`ServerHttpError`
)(
  "ServerHttpError",
  {
    message: S.String,
    status: ServerErrorStatus,
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ),
  },
  $I.annoteError<ServerHttpError>("ServerHttpError", {
    description: "Shared tagged error for 5xx HTTP responses.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 400 tagged error.
 *
 * **Example** (Create BadRequestError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { BadRequestError } from "@beep/observability/HttpError"
 *
 * const err = BadRequestError.make({ cause: O.none(), message: "invalid input", status: 400 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BadRequestError extends S.TaggedError<BadRequestError, { readonly brand: unique symbol }>(
  $I`BadRequestError`
)(
  "BadRequestError",
  statusFields(S.tag(HttpStatus.fromLiteral("BadRequest"))),
  $I.annoteError<BadRequestError>("BadRequestError", {
    description: "400 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 401 tagged error.
 *
 * **Example** (Create UnauthorizedError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { UnauthorizedError } from "@beep/observability/HttpError"
 *
 * const err = UnauthorizedError.make({ cause: O.none(), message: "token expired", status: 401 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnauthorizedError extends S.TaggedError<UnauthorizedError, { readonly brand: unique symbol }>(
  $I`UnauthorizedError`
)(
  "UnauthorizedError",
  statusFields(S.tag(HttpStatus.fromLiteral("Unauthorized"))),
  $I.annoteError<UnauthorizedError>("UnauthorizedError", {
    description: "401 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 403 tagged error.
 *
 * **Example** (Create ForbiddenError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { ForbiddenError } from "@beep/observability/HttpError"
 *
 * const err = ForbiddenError.make({ cause: O.none(), message: "access denied", status: 403 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ForbiddenError extends S.TaggedError<ForbiddenError, { readonly brand: unique symbol }>(
  $I`ForbiddenError`
)(
  "ForbiddenError",
  statusFields(S.tag(HttpStatus.fromLiteral("Forbidden"))),
  $I.annoteError<ForbiddenError>("ForbiddenError", {
    description: "403 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 404 tagged error.
 *
 * **Example** (Create NotFoundError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { NotFoundError } from "@beep/observability/HttpError"
 *
 * const err = NotFoundError.make({ cause: O.none(), message: "user not found", status: 404 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NotFoundError extends S.TaggedError<NotFoundError, { readonly brand: unique symbol }>($I`NotFoundError`)(
  "NotFoundError",
  statusFields(S.tag(HttpStatus.fromLiteral("NotFound"))),
  $I.annoteError<NotFoundError>("NotFoundError", {
    description: "404 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Info";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 409 tagged error.
 *
 * **Example** (Create ConflictError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { ConflictError } from "@beep/observability/HttpError"
 *
 * const err = ConflictError.make({ cause: O.none(), message: "duplicate entry", status: 409 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictError extends S.TaggedError<ConflictError, { readonly brand: unique symbol }>($I`ConflictError`)(
  "ConflictError",
  statusFields(S.tag(HttpStatus.fromLiteral("Conflict"))),
  $I.annoteError<ConflictError>("ConflictError", {
    description: "409 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 422 tagged error.
 *
 * **Example** (Create UnprocessableEntityError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { UnprocessableEntityError } from "@beep/observability/HttpError"
 *
 * const err = UnprocessableEntityError.make({ cause: O.none(), message: "validation failed", status: 422 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnprocessableEntityError extends S.TaggedError<
  UnprocessableEntityError,
  { readonly brand: unique symbol }
>($I`UnprocessableEntityError`)(
  "UnprocessableEntityError",
  statusFields(S.tag(HttpStatus.fromLiteral("UnprocessableEntity"))),
  $I.annoteError<UnprocessableEntityError>("UnprocessableEntityError", {
    description: "422 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 429 tagged error.
 *
 * **Example** (Create TooManyRequestsError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { TooManyRequestsError } from "@beep/observability/HttpError"
 *
 * const err = TooManyRequestsError.make({ cause: O.none(), message: "rate limit exceeded", status: 429 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TooManyRequestsError extends S.TaggedError<TooManyRequestsError, { readonly brand: unique symbol }>(
  $I`TooManyRequestsError`
)(
  "TooManyRequestsError",
  statusFields(S.tag(HttpStatus.fromLiteral("TooManyRequests"))),
  $I.annoteError<TooManyRequestsError>("TooManyRequestsError", {
    description: "429 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 500 tagged error.
 *
 * **Example** (Create InternalServerErrorError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { InternalServerErrorError } from "@beep/observability/HttpError"
 *
 * const err = InternalServerErrorError.make({ cause: O.none(), message: "unexpected failure", status: 500 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InternalServerErrorError extends S.TaggedError<
  InternalServerErrorError,
  { readonly brand: unique symbol }
>($I`InternalServerErrorError`)(
  "InternalServerErrorError",
  statusFields(S.tag(HttpStatus.fromLiteral("InternalServerError"))),
  $I.annoteError<InternalServerErrorError>("InternalServerErrorError", {
    description: "500 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 502 tagged error.
 *
 * **Example** (Create BadGatewayError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { BadGatewayError } from "@beep/observability/HttpError"
 *
 * const err = BadGatewayError.make({ cause: O.none(), message: "upstream unavailable", status: 502 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BadGatewayError extends S.TaggedError<BadGatewayError, { readonly brand: unique symbol }>(
  $I`BadGatewayError`
)(
  "BadGatewayError",
  statusFields(S.tag(HttpStatus.fromLiteral("BadGateway"))),
  $I.annoteError<BadGatewayError>("BadGatewayError", {
    description: "502 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 503 tagged error.
 *
 * **Example** (Create ServiceUnavailableError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { ServiceUnavailableError } from "@beep/observability/HttpError"
 *
 * const err = ServiceUnavailableError.make({ cause: O.none(), message: "service down", status: 503 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ServiceUnavailableError extends S.TaggedError<ServiceUnavailableError, { readonly brand: unique symbol }>(
  $I`ServiceUnavailableError`
)(
  "ServiceUnavailableError",
  statusFields(S.tag(HttpStatus.fromLiteral("ServiceUnavailable"))),
  $I.annoteError<ServiceUnavailableError>("ServiceUnavailableError", {
    description: "503 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 504 tagged error.
 *
 * **Example** (Create GatewayTimeoutError)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { GatewayTimeoutError } from "@beep/observability/HttpError"
 *
 * const err = GatewayTimeoutError.make({ cause: O.none(), message: "upstream timed out", status: 504 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewayTimeoutError extends S.TaggedError<GatewayTimeoutError, { readonly brand: unique symbol }>(
  $I`GatewayTimeoutError`
)(
  "GatewayTimeoutError",
  statusFields(S.tag(HttpStatus.fromLiteral("GatewayTimeout"))),
  $I.annoteError<GatewayTimeoutError>("GatewayTimeoutError", {
    description: "504 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * Helper constructor for {@link BadRequestError} (400).
 *
 * **Example** (Make BadRequestError helper)
 *
 * ```ts import.meta.vitest name="Make BadRequestError helper"
 * import { makeBadRequestError } from "@beep/observability/HttpError"
 *
 * const error = makeBadRequestError("missing required field 'email'")
 * error.status // => 400
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeBadRequestError: StatusErrorConstructor<BadRequestError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadRequestError, HttpStatus.fromLiteral("BadRequest"))
);

/**
 * Helper constructor for {@link UnauthorizedError} (401).
 *
 * **Example** (Make UnauthorizedError helper)
 *
 * ```ts import.meta.vitest name="Make UnauthorizedError helper"
 * import { makeUnauthorizedError } from "@beep/observability/HttpError"
 *
 * const error = makeUnauthorizedError("token expired")
 * error.status // => 401
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeUnauthorizedError: StatusErrorConstructor<UnauthorizedError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnauthorizedError, HttpStatus.fromLiteral("Unauthorized"))
);

/**
 * Helper constructor for {@link ForbiddenError} (403).
 *
 * **Example** (Make ForbiddenError helper)
 *
 * ```ts import.meta.vitest name="Make ForbiddenError helper"
 * import { makeForbiddenError } from "@beep/observability/HttpError"
 *
 * const error = makeForbiddenError("insufficient permissions")
 * error.status // => 403
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeForbiddenError: StatusErrorConstructor<ForbiddenError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ForbiddenError, HttpStatus.fromLiteral("Forbidden"))
);

/**
 * Helper constructor for {@link NotFoundError} (404).
 *
 * **Example** (Make NotFoundError helper)
 *
 * ```ts import.meta.vitest name="Make NotFoundError helper"
 * import { makeNotFoundError } from "@beep/observability/HttpError"
 *
 * const error = makeNotFoundError("resource missing")
 * error.status // => 404
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeNotFoundError: StatusErrorConstructor<NotFoundError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(NotFoundError, HttpStatus.fromLiteral("NotFound"))
);

/**
 * Helper constructor for {@link ConflictError} (409).
 *
 * **Example** (Make ConflictError helper)
 *
 * ```ts import.meta.vitest name="Make ConflictError helper"
 * import { makeConflictError } from "@beep/observability/HttpError"
 *
 * const error = makeConflictError("duplicate key")
 * error.status // => 409
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeConflictError: StatusErrorConstructor<ConflictError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ConflictError, HttpStatus.fromLiteral("Conflict"))
);

/**
 * Helper constructor for {@link UnprocessableEntityError} (422).
 *
 * **Example** (Make UnprocessableEntityError helper)
 *
 * ```ts import.meta.vitest name="Make UnprocessableEntityError helper"
 * import { makeUnprocessableEntityError } from "@beep/observability/HttpError"
 *
 * const error = makeUnprocessableEntityError("schema mismatch")
 * error.status // => 422
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeUnprocessableEntityError: StatusErrorConstructor<UnprocessableEntityError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnprocessableEntityError, HttpStatus.fromLiteral("UnprocessableEntity"))
);

/**
 * Helper constructor for {@link TooManyRequestsError} (429).
 *
 * **Example** (Make TooManyRequestsError helper)
 *
 * ```ts import.meta.vitest name="Make TooManyRequestsError helper"
 * import { makeTooManyRequestsError } from "@beep/observability/HttpError"
 *
 * const error = makeTooManyRequestsError("rate limit hit")
 * error.status // => 429
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeTooManyRequestsError: StatusErrorConstructor<TooManyRequestsError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(TooManyRequestsError, HttpStatus.fromLiteral("TooManyRequests"))
);

/**
 * Helper constructor for {@link InternalServerErrorError} (500).
 *
 * **Example** (Make InternalServerError helper)
 *
 * ```ts import.meta.vitest name="Make InternalServerError helper"
 * import { makeInternalServerError } from "@beep/observability/HttpError"
 *
 * const error = makeInternalServerError("unexpected failure")
 * error.status // => 500
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeInternalServerError: StatusErrorConstructor<InternalServerErrorError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(InternalServerErrorError, HttpStatus.fromLiteral("InternalServerError"))
);

/**
 * Helper constructor for {@link BadGatewayError} (502).
 *
 * **Example** (Make BadGatewayError helper)
 *
 * ```ts import.meta.vitest name="Make BadGatewayError helper"
 * import { makeBadGatewayError } from "@beep/observability/HttpError"
 *
 * const error = makeBadGatewayError("upstream unreachable")
 * error.status // => 502
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeBadGatewayError: StatusErrorConstructor<BadGatewayError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadGatewayError, HttpStatus.fromLiteral("BadGateway"))
);

/**
 * Helper constructor for {@link ServiceUnavailableError} (503).
 *
 * **Example** (Make ServiceUnavailableError helper)
 *
 * ```ts import.meta.vitest name="Make ServiceUnavailableError helper"
 * import { makeServiceUnavailableError } from "@beep/observability/HttpError"
 *
 * const error = makeServiceUnavailableError("service down for maintenance")
 * error.status // => 503
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeServiceUnavailableError: StatusErrorConstructor<ServiceUnavailableError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ServiceUnavailableError, HttpStatus.fromLiteral("ServiceUnavailable"))
);

/**
 * Helper constructor for {@link GatewayTimeoutError} (504).
 *
 * **Example** (Make GatewayTimeoutError helper)
 *
 * ```ts import.meta.vitest name="Make GatewayTimeoutError helper"
 * import { makeGatewayTimeoutError } from "@beep/observability/HttpError"
 *
 * const error = makeGatewayTimeoutError("upstream timed out")
 * error.status // => 504
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeGatewayTimeoutError: StatusErrorConstructor<GatewayTimeoutError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(GatewayTimeoutError, HttpStatus.fromLiteral("GatewayTimeout"))
);

/**
 * Typed HTTP error classes and convenience constructors for standard status codes.
 *
 * Each error class extends `TaggedErrorClass` with a fixed status code, carries
 * `ErrorReporter.severity` and `ErrorReporter.attributes` for structured
 * observability, and is transport-safe via Effect Schema.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { NotFoundError, makeBadRequestError } from "@beep/observability"
 *
 * const failNotFound = Effect.fail(
 *   NotFoundError.make({ cause: Option.none(), message: "missing", status: 404 })
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
import { makeStatusCauseError, StatusCauseFields, TaggedErrorClass } from "@beep/schema";
import * as HttpStatus from "@beep/schema/HttpStatus";
import { ErrorReporter } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { StatusCauseInput } from "@beep/schema";

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

const makeStatusConstructor =
  <Input extends StatusCauseInput, Error>(ctor: new (value: Input) => Error, status: number) =>
  (message: string, cause?: unknown): Error =>
    makeStatusCauseError(ctor)({ message, status, cause });

const statusFields = <Status extends S.Top>(status: Status) =>
  ({
    ...StatusCauseFields,
    status,
  }) as const;

/**
 * Shared tagged error for 4xx HTTP responses with `Warn` severity.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { ClientHttpError } from "@beep/observability"
 *
 * const err = ClientHttpError.make({
 *   cause: Option.none(),
 *   message: "invalid input",
 *   status: 400
 * })
 *
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ClientHttpError extends TaggedErrorClass<ClientHttpError>($I`ClientHttpError`)(
  "ClientHttpError",
  {
    message: S.String,
    status: HttpStatus.HttpStatus4XX,
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("ClientHttpError", {
    description: "Shared tagged error for 4xx HTTP responses.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * Shared tagged error for 5xx HTTP responses with `Error` severity.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { ServerHttpError } from "@beep/observability"
 *
 * const err = ServerHttpError.make({
 *   cause: Option.none(),
 *   message: "server failed",
 *   status: 500
 * })
 *
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ServerHttpError extends TaggedErrorClass<ServerHttpError>($I`ServerHttpError`)(
  "ServerHttpError",
  {
    message: S.String,
    status: HttpStatus.HttpStatus5XX,
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("ServerHttpError", {
    description: "Shared tagged error for 5xx HTTP responses.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 400 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { BadRequestError } from "@beep/observability"
 *
 * const err = BadRequestError.make({ cause: Option.none(), message: "invalid input", status: 400 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class BadRequestError extends TaggedErrorClass<BadRequestError>($I`BadRequestError`)(
  "BadRequestError",
  statusFields(HttpStatus.BadRequest),
  $I.annote("BadRequestError", {
    description: "400 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 401 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { UnauthorizedError } from "@beep/observability"
 *
 * const err = UnauthorizedError.make({ cause: Option.none(), message: "token expired", status: 401 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class UnauthorizedError extends TaggedErrorClass<UnauthorizedError>($I`UnauthorizedError`)(
  "UnauthorizedError",
  statusFields(HttpStatus.Unauthorized),
  $I.annote("UnauthorizedError", {
    description: "401 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 403 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { ForbiddenError } from "@beep/observability"
 *
 * const err = ForbiddenError.make({ cause: Option.none(), message: "access denied", status: 403 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ForbiddenError extends TaggedErrorClass<ForbiddenError>($I`ForbiddenError`)(
  "ForbiddenError",
  statusFields(HttpStatus.Forbidden),
  $I.annote("ForbiddenError", {
    description: "403 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 404 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { NotFoundError } from "@beep/observability"
 *
 * const err = NotFoundError.make({ cause: Option.none(), message: "user not found", status: 404 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class NotFoundError extends TaggedErrorClass<NotFoundError>($I`NotFoundError`)(
  "NotFoundError",
  statusFields(HttpStatus.NotFound),
  $I.annote("NotFoundError", {
    description: "404 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Info";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 409 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { ConflictError } from "@beep/observability"
 *
 * const err = ConflictError.make({ cause: Option.none(), message: "duplicate entry", status: 409 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ConflictError extends TaggedErrorClass<ConflictError>($I`ConflictError`)(
  "ConflictError",
  statusFields(HttpStatus.Conflict),
  $I.annote("ConflictError", {
    description: "409 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 422 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { UnprocessableEntityError } from "@beep/observability"
 *
 * const err = UnprocessableEntityError.make({ cause: Option.none(), message: "validation failed", status: 422 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class UnprocessableEntityError extends TaggedErrorClass<UnprocessableEntityError>($I`UnprocessableEntityError`)(
  "UnprocessableEntityError",
  statusFields(HttpStatus.UnprocessableEntity),
  $I.annote("UnprocessableEntityError", {
    description: "422 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 429 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { TooManyRequestsError } from "@beep/observability"
 *
 * const err = TooManyRequestsError.make({ cause: Option.none(), message: "rate limit exceeded", status: 429 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TooManyRequestsError extends TaggedErrorClass<TooManyRequestsError>($I`TooManyRequestsError`)(
  "TooManyRequestsError",
  statusFields(HttpStatus.TooManyRequests),
  $I.annote("TooManyRequestsError", {
    description: "429 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Warn";
  override readonly [ErrorReporter.attributes] = clientStatusAttributes(this.status);
}

/**
 * 500 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { InternalServerErrorError } from "@beep/observability"
 *
 * const err = InternalServerErrorError.make({ cause: Option.none(), message: "unexpected failure", status: 500 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class InternalServerErrorError extends TaggedErrorClass<InternalServerErrorError>($I`InternalServerErrorError`)(
  "InternalServerErrorError",
  statusFields(HttpStatus.InternalServerError),
  $I.annote("InternalServerErrorError", {
    description: "500 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 502 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { BadGatewayError } from "@beep/observability"
 *
 * const err = BadGatewayError.make({ cause: Option.none(), message: "upstream unavailable", status: 502 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class BadGatewayError extends TaggedErrorClass<BadGatewayError>($I`BadGatewayError`)(
  "BadGatewayError",
  statusFields(HttpStatus.BadGateway),
  $I.annote("BadGatewayError", {
    description: "502 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 503 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { ServiceUnavailableError } from "@beep/observability"
 *
 * const err = ServiceUnavailableError.make({ cause: Option.none(), message: "service down", status: 503 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ServiceUnavailableError extends TaggedErrorClass<ServiceUnavailableError>($I`ServiceUnavailableError`)(
  "ServiceUnavailableError",
  statusFields(HttpStatus.ServiceUnavailable),
  $I.annote("ServiceUnavailableError", {
    description: "503 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * 504 tagged error.
 *
 * @example
 * ```typescript
 * import { Effect, Option } from "effect"
 * import { GatewayTimeoutError } from "@beep/observability"
 *
 * const err = GatewayTimeoutError.make({ cause: Option.none(), message: "upstream timed out", status: 504 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class GatewayTimeoutError extends TaggedErrorClass<GatewayTimeoutError>($I`GatewayTimeoutError`)(
  "GatewayTimeoutError",
  statusFields(HttpStatus.GatewayTimeout),
  $I.annote("GatewayTimeoutError", {
    description: "504 tagged error.",
  })
) {
  override readonly [ErrorReporter.severity] = "Error";
  override readonly [ErrorReporter.attributes] = serverStatusAttributes(this.status);
}

/**
 * Helper constructor for {@link BadRequestError} (400).
 *
 * @example
 * ```typescript
 * import { makeBadRequestError } from "@beep/observability"
 *
 * const error = makeBadRequestError("missing required field 'email'")
 * console.log(error.status) // 400
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeBadRequestError: StatusErrorConstructor<BadRequestError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadRequestError, HttpStatus.BadRequest.literal)
);

/**
 * Helper constructor for {@link UnauthorizedError} (401).
 *
 * @example
 * ```typescript
 * import { makeUnauthorizedError } from "@beep/observability"
 *
 * const error = makeUnauthorizedError("token expired")
 * console.log(error.status) // 401
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeUnauthorizedError: StatusErrorConstructor<UnauthorizedError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnauthorizedError, HttpStatus.Unauthorized.literal)
);

/**
 * Helper constructor for {@link ForbiddenError} (403).
 *
 * @example
 * ```typescript
 * import { makeForbiddenError } from "@beep/observability"
 *
 * const error = makeForbiddenError("insufficient permissions")
 * console.log(error.status) // 403
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeForbiddenError: StatusErrorConstructor<ForbiddenError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ForbiddenError, HttpStatus.Forbidden.literal)
);

/**
 * Helper constructor for {@link NotFoundError} (404).
 *
 * @example
 * ```typescript
 * import { makeNotFoundError } from "@beep/observability"
 *
 * const error = makeNotFoundError("resource missing")
 * console.log(error.status) // 404
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeNotFoundError: StatusErrorConstructor<NotFoundError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(NotFoundError, HttpStatus.NotFound.literal)
);

/**
 * Helper constructor for {@link ConflictError} (409).
 *
 * @example
 * ```typescript
 * import { makeConflictError } from "@beep/observability"
 *
 * const error = makeConflictError("duplicate key")
 * console.log(error.status) // 409
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeConflictError: StatusErrorConstructor<ConflictError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ConflictError, HttpStatus.Conflict.literal)
);

/**
 * Helper constructor for {@link UnprocessableEntityError} (422).
 *
 * @example
 * ```typescript
 * import { makeUnprocessableEntityError } from "@beep/observability"
 *
 * const error = makeUnprocessableEntityError("schema mismatch")
 * console.log(error.status) // 422
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeUnprocessableEntityError: StatusErrorConstructor<UnprocessableEntityError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnprocessableEntityError, HttpStatus.UnprocessableEntity.literal)
);

/**
 * Helper constructor for {@link TooManyRequestsError} (429).
 *
 * @example
 * ```typescript
 * import { makeTooManyRequestsError } from "@beep/observability"
 *
 * const error = makeTooManyRequestsError("rate limit hit")
 * console.log(error.status) // 429
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeTooManyRequestsError: StatusErrorConstructor<TooManyRequestsError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(TooManyRequestsError, HttpStatus.TooManyRequests.literal)
);

/**
 * Helper constructor for {@link InternalServerErrorError} (500).
 *
 * @example
 * ```typescript
 * import { makeInternalServerError } from "@beep/observability"
 *
 * const error = makeInternalServerError("unexpected failure")
 * console.log(error.status) // 500
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeInternalServerError: StatusErrorConstructor<InternalServerErrorError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(InternalServerErrorError, HttpStatus.InternalServerError.literal)
);

/**
 * Helper constructor for {@link BadGatewayError} (502).
 *
 * @example
 * ```typescript
 * import { makeBadGatewayError } from "@beep/observability"
 *
 * const error = makeBadGatewayError("upstream unreachable")
 * console.log(error.status) // 502
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeBadGatewayError: StatusErrorConstructor<BadGatewayError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadGatewayError, HttpStatus.BadGateway.literal)
);

/**
 * Helper constructor for {@link ServiceUnavailableError} (503).
 *
 * @example
 * ```typescript
 * import { makeServiceUnavailableError } from "@beep/observability"
 *
 * const error = makeServiceUnavailableError("service down for maintenance")
 * console.log(error.status) // 503
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeServiceUnavailableError: StatusErrorConstructor<ServiceUnavailableError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ServiceUnavailableError, HttpStatus.ServiceUnavailable.literal)
);

/**
 * Helper constructor for {@link GatewayTimeoutError} (504).
 *
 * @example
 * ```typescript
 * import { makeGatewayTimeoutError } from "@beep/observability"
 *
 * const error = makeGatewayTimeoutError("upstream timed out")
 * console.log(error.status) // 504
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export const makeGatewayTimeoutError: StatusErrorConstructor<GatewayTimeoutError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(GatewayTimeoutError, HttpStatus.GatewayTimeout.literal)
);

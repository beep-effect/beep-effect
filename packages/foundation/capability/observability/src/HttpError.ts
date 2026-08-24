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
import { makeStatusCauseError, StatusCauseFields } from "@beep/schema";
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

const ClientHttpErrorFields = {
  message: S.String,
  status: HttpStatus.HttpStatus4XX,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
const sameClientHttpErrorFields = S.toEquivalence(
  S.TaggedStruct("ClientHttpError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: ClientHttpErrorFields.message,
    status: ClientHttpErrorFields.status,
  })
);
const sameClientHttpError = (self: ClientHttpError, that: ClientHttpError): boolean =>
  sameClientHttpErrorFields(self, that);

const ServerHttpErrorFields = {
  message: S.String,
  status: HttpStatus.HttpStatus5XX,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
const sameServerHttpErrorFields = S.toEquivalence(
  S.TaggedStruct("ServerHttpError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: ServerHttpErrorFields.message,
    status: ServerHttpErrorFields.status,
  })
);
const sameServerHttpError = (self: ServerHttpError, that: ServerHttpError): boolean =>
  sameServerHttpErrorFields(self, that);

const BadRequestErrorFields = statusFields(HttpStatus.BadRequest) satisfies S.Struct.Fields;
const sameBadRequestErrorFields = S.toEquivalence(
  S.TaggedStruct("BadRequestError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: BadRequestErrorFields.message,
    status: BadRequestErrorFields.status,
  })
);
const sameBadRequestError = (self: BadRequestError, that: BadRequestError): boolean =>
  sameBadRequestErrorFields(self, that);

const UnauthorizedErrorFields = statusFields(HttpStatus.Unauthorized) satisfies S.Struct.Fields;
const sameUnauthorizedErrorFields = S.toEquivalence(
  S.TaggedStruct("UnauthorizedError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: UnauthorizedErrorFields.message,
    status: UnauthorizedErrorFields.status,
  })
);
const sameUnauthorizedError = (self: UnauthorizedError, that: UnauthorizedError): boolean =>
  sameUnauthorizedErrorFields(self, that);

const ForbiddenErrorFields = statusFields(HttpStatus.Forbidden) satisfies S.Struct.Fields;
const sameForbiddenErrorFields = S.toEquivalence(
  S.TaggedStruct("ForbiddenError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: ForbiddenErrorFields.message,
    status: ForbiddenErrorFields.status,
  })
);
const sameForbiddenError = (self: ForbiddenError, that: ForbiddenError): boolean =>
  sameForbiddenErrorFields(self, that);

const NotFoundErrorFields = statusFields(HttpStatus.NotFound) satisfies S.Struct.Fields;
const sameNotFoundErrorFields = S.toEquivalence(
  S.TaggedStruct("NotFoundError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: NotFoundErrorFields.message,
    status: NotFoundErrorFields.status,
  })
);
const sameNotFoundError = (self: NotFoundError, that: NotFoundError): boolean => sameNotFoundErrorFields(self, that);

const ConflictErrorFields = statusFields(HttpStatus.Conflict) satisfies S.Struct.Fields;
const sameConflictErrorFields = S.toEquivalence(
  S.TaggedStruct("ConflictError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: ConflictErrorFields.message,
    status: ConflictErrorFields.status,
  })
);
const sameConflictError = (self: ConflictError, that: ConflictError): boolean => sameConflictErrorFields(self, that);

const UnprocessableEntityErrorFields = statusFields(HttpStatus.UnprocessableEntity) satisfies S.Struct.Fields;
const sameUnprocessableEntityErrorFields = S.toEquivalence(
  S.TaggedStruct("UnprocessableEntityError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: UnprocessableEntityErrorFields.message,
    status: UnprocessableEntityErrorFields.status,
  })
);
const sameUnprocessableEntityError = (self: UnprocessableEntityError, that: UnprocessableEntityError): boolean =>
  sameUnprocessableEntityErrorFields(self, that);

const TooManyRequestsErrorFields = statusFields(HttpStatus.TooManyRequests) satisfies S.Struct.Fields;
const sameTooManyRequestsErrorFields = S.toEquivalence(
  S.TaggedStruct("TooManyRequestsError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: TooManyRequestsErrorFields.message,
    status: TooManyRequestsErrorFields.status,
  })
);
const sameTooManyRequestsError = (self: TooManyRequestsError, that: TooManyRequestsError): boolean =>
  sameTooManyRequestsErrorFields(self, that);

const InternalServerErrorErrorFields = statusFields(HttpStatus.InternalServerError) satisfies S.Struct.Fields;
const sameInternalServerErrorErrorFields = S.toEquivalence(
  S.TaggedStruct("InternalServerErrorError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: InternalServerErrorErrorFields.message,
    status: InternalServerErrorErrorFields.status,
  })
);
const sameInternalServerErrorError = (self: InternalServerErrorError, that: InternalServerErrorError): boolean =>
  sameInternalServerErrorErrorFields(self, that);

const BadGatewayErrorFields = statusFields(HttpStatus.BadGateway) satisfies S.Struct.Fields;
const sameBadGatewayErrorFields = S.toEquivalence(
  S.TaggedStruct("BadGatewayError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: BadGatewayErrorFields.message,
    status: BadGatewayErrorFields.status,
  })
);
const sameBadGatewayError = (self: BadGatewayError, that: BadGatewayError): boolean =>
  sameBadGatewayErrorFields(self, that);

const ServiceUnavailableErrorFields = statusFields(HttpStatus.ServiceUnavailable) satisfies S.Struct.Fields;
const sameServiceUnavailableErrorFields = S.toEquivalence(
  S.TaggedStruct("ServiceUnavailableError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: ServiceUnavailableErrorFields.message,
    status: ServiceUnavailableErrorFields.status,
  })
);
const sameServiceUnavailableError = (self: ServiceUnavailableError, that: ServiceUnavailableError): boolean =>
  sameServiceUnavailableErrorFields(self, that);

const GatewayTimeoutErrorFields = statusFields(HttpStatus.GatewayTimeout) satisfies S.Struct.Fields;
const sameGatewayTimeoutErrorFields = S.toEquivalence(
  S.TaggedStruct("GatewayTimeoutError", {
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
    message: GatewayTimeoutErrorFields.message,
    status: GatewayTimeoutErrorFields.status,
  })
);
const sameGatewayTimeoutError = (self: GatewayTimeoutError, that: GatewayTimeoutError): boolean =>
  sameGatewayTimeoutErrorFields(self, that);

/**
 * Shared tagged error for 4xx HTTP responses with `Warn` severity.
 *
 * **Example** (Create client HTTP error)
 *
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
 * @category models
 * @since 0.0.0
 */
export class ClientHttpError extends S.TaggedError<ClientHttpError>($I`ClientHttpError`)(
  "ClientHttpError",
  ClientHttpErrorFields,
  $I.annoteClass<
    S.declare<ClientHttpError>,
    readonly [S.TaggedStruct<"ClientHttpError", typeof ClientHttpErrorFields>]
  >("ClientHttpError", {
    description: "Shared tagged error for 4xx HTTP responses.",
    toEquivalence: () => sameClientHttpError,
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
 * @category models
 * @since 0.0.0
 */
export class ServerHttpError extends S.TaggedError<ServerHttpError>($I`ServerHttpError`)(
  "ServerHttpError",
  ServerHttpErrorFields,
  $I.annoteClass<
    S.declare<ServerHttpError>,
    readonly [S.TaggedStruct<"ServerHttpError", typeof ServerHttpErrorFields>]
  >("ServerHttpError", {
    description: "Shared tagged error for 5xx HTTP responses.",
    toEquivalence: () => sameServerHttpError,
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
 * import { Effect, Option } from "effect"
 * import { BadRequestError } from "@beep/observability"
 *
 * const err = BadRequestError.make({ cause: Option.none(), message: "invalid input", status: 400 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BadRequestError extends S.TaggedError<BadRequestError>($I`BadRequestError`)(
  "BadRequestError",
  BadRequestErrorFields,
  $I.annoteClass<
    S.declare<BadRequestError>,
    readonly [S.TaggedStruct<"BadRequestError", typeof BadRequestErrorFields>]
  >("BadRequestError", {
    description: "400 tagged error.",
    toEquivalence: () => sameBadRequestError,
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
 * import { Effect, Option } from "effect"
 * import { UnauthorizedError } from "@beep/observability"
 *
 * const err = UnauthorizedError.make({ cause: Option.none(), message: "token expired", status: 401 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnauthorizedError extends S.TaggedError<UnauthorizedError>($I`UnauthorizedError`)(
  "UnauthorizedError",
  UnauthorizedErrorFields,
  $I.annoteClass<
    S.declare<UnauthorizedError>,
    readonly [S.TaggedStruct<"UnauthorizedError", typeof UnauthorizedErrorFields>]
  >("UnauthorizedError", {
    description: "401 tagged error.",
    toEquivalence: () => sameUnauthorizedError,
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
 * import { Effect, Option } from "effect"
 * import { ForbiddenError } from "@beep/observability"
 *
 * const err = ForbiddenError.make({ cause: Option.none(), message: "access denied", status: 403 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ForbiddenError extends S.TaggedError<ForbiddenError>($I`ForbiddenError`)(
  "ForbiddenError",
  ForbiddenErrorFields,
  $I.annoteClass<S.declare<ForbiddenError>, readonly [S.TaggedStruct<"ForbiddenError", typeof ForbiddenErrorFields>]>(
    "ForbiddenError",
    {
      description: "403 tagged error.",
      toEquivalence: () => sameForbiddenError,
    }
  )
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
 * import { Effect, Option } from "effect"
 * import { NotFoundError } from "@beep/observability"
 *
 * const err = NotFoundError.make({ cause: Option.none(), message: "user not found", status: 404 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NotFoundError extends S.TaggedError<NotFoundError>($I`NotFoundError`)(
  "NotFoundError",
  NotFoundErrorFields,
  $I.annoteClass<S.declare<NotFoundError>, readonly [S.TaggedStruct<"NotFoundError", typeof NotFoundErrorFields>]>(
    "NotFoundError",
    {
      description: "404 tagged error.",
      toEquivalence: () => sameNotFoundError,
    }
  )
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
 * import { Effect, Option } from "effect"
 * import { ConflictError } from "@beep/observability"
 *
 * const err = ConflictError.make({ cause: Option.none(), message: "duplicate entry", status: 409 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictError extends S.TaggedError<ConflictError>($I`ConflictError`)(
  "ConflictError",
  ConflictErrorFields,
  $I.annoteClass<S.declare<ConflictError>, readonly [S.TaggedStruct<"ConflictError", typeof ConflictErrorFields>]>(
    "ConflictError",
    {
      description: "409 tagged error.",
      toEquivalence: () => sameConflictError,
    }
  )
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
 * import { Effect, Option } from "effect"
 * import { UnprocessableEntityError } from "@beep/observability"
 *
 * const err = UnprocessableEntityError.make({ cause: Option.none(), message: "validation failed", status: 422 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnprocessableEntityError extends S.TaggedError<UnprocessableEntityError>($I`UnprocessableEntityError`)(
  "UnprocessableEntityError",
  UnprocessableEntityErrorFields,
  $I.annoteClass<
    S.declare<UnprocessableEntityError>,
    readonly [S.TaggedStruct<"UnprocessableEntityError", typeof UnprocessableEntityErrorFields>]
  >("UnprocessableEntityError", {
    description: "422 tagged error.",
    toEquivalence: () => sameUnprocessableEntityError,
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
 * import { Effect, Option } from "effect"
 * import { TooManyRequestsError } from "@beep/observability"
 *
 * const err = TooManyRequestsError.make({ cause: Option.none(), message: "rate limit exceeded", status: 429 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TooManyRequestsError extends S.TaggedError<TooManyRequestsError>($I`TooManyRequestsError`)(
  "TooManyRequestsError",
  TooManyRequestsErrorFields,
  $I.annoteClass<
    S.declare<TooManyRequestsError>,
    readonly [S.TaggedStruct<"TooManyRequestsError", typeof TooManyRequestsErrorFields>]
  >("TooManyRequestsError", {
    description: "429 tagged error.",
    toEquivalence: () => sameTooManyRequestsError,
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
 * import { Effect, Option } from "effect"
 * import { InternalServerErrorError } from "@beep/observability"
 *
 * const err = InternalServerErrorError.make({ cause: Option.none(), message: "unexpected failure", status: 500 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InternalServerErrorError extends S.TaggedError<InternalServerErrorError>($I`InternalServerErrorError`)(
  "InternalServerErrorError",
  InternalServerErrorErrorFields,
  $I.annoteClass<
    S.declare<InternalServerErrorError>,
    readonly [S.TaggedStruct<"InternalServerErrorError", typeof InternalServerErrorErrorFields>]
  >("InternalServerErrorError", {
    description: "500 tagged error.",
    toEquivalence: () => sameInternalServerErrorError,
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
 * import { Effect, Option } from "effect"
 * import { BadGatewayError } from "@beep/observability"
 *
 * const err = BadGatewayError.make({ cause: Option.none(), message: "upstream unavailable", status: 502 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BadGatewayError extends S.TaggedError<BadGatewayError>($I`BadGatewayError`)(
  "BadGatewayError",
  BadGatewayErrorFields,
  $I.annoteClass<
    S.declare<BadGatewayError>,
    readonly [S.TaggedStruct<"BadGatewayError", typeof BadGatewayErrorFields>]
  >("BadGatewayError", {
    description: "502 tagged error.",
    toEquivalence: () => sameBadGatewayError,
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
 * import { Effect, Option } from "effect"
 * import { ServiceUnavailableError } from "@beep/observability"
 *
 * const err = ServiceUnavailableError.make({ cause: Option.none(), message: "service down", status: 503 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ServiceUnavailableError extends S.TaggedError<ServiceUnavailableError>($I`ServiceUnavailableError`)(
  "ServiceUnavailableError",
  ServiceUnavailableErrorFields,
  $I.annoteClass<
    S.declare<ServiceUnavailableError>,
    readonly [S.TaggedStruct<"ServiceUnavailableError", typeof ServiceUnavailableErrorFields>]
  >("ServiceUnavailableError", {
    description: "503 tagged error.",
    toEquivalence: () => sameServiceUnavailableError,
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
 * import { Effect, Option } from "effect"
 * import { GatewayTimeoutError } from "@beep/observability"
 *
 * const err = GatewayTimeoutError.make({ cause: Option.none(), message: "upstream timed out", status: 504 })
 * console.log(Effect.fail(err))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewayTimeoutError extends S.TaggedError<GatewayTimeoutError>($I`GatewayTimeoutError`)(
  "GatewayTimeoutError",
  GatewayTimeoutErrorFields,
  $I.annoteClass<
    S.declare<GatewayTimeoutError>,
    readonly [S.TaggedStruct<"GatewayTimeoutError", typeof GatewayTimeoutErrorFields>]
  >("GatewayTimeoutError", {
    description: "504 tagged error.",
    toEquivalence: () => sameGatewayTimeoutError,
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
 * ```typescript
 * import { makeBadRequestError } from "@beep/observability"
 *
 * const error = makeBadRequestError("missing required field 'email'")
 * console.log(error.status) // 400
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeBadRequestError: StatusErrorConstructor<BadRequestError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadRequestError, HttpStatus.BadRequest.literal)
);

/**
 * Helper constructor for {@link UnauthorizedError} (401).
 *
 * **Example** (Make UnauthorizedError helper)
 *
 * ```typescript
 * import { makeUnauthorizedError } from "@beep/observability"
 *
 * const error = makeUnauthorizedError("token expired")
 * console.log(error.status) // 401
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeUnauthorizedError: StatusErrorConstructor<UnauthorizedError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnauthorizedError, HttpStatus.Unauthorized.literal)
);

/**
 * Helper constructor for {@link ForbiddenError} (403).
 *
 * **Example** (Make ForbiddenError helper)
 *
 * ```typescript
 * import { makeForbiddenError } from "@beep/observability"
 *
 * const error = makeForbiddenError("insufficient permissions")
 * console.log(error.status) // 403
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeForbiddenError: StatusErrorConstructor<ForbiddenError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ForbiddenError, HttpStatus.Forbidden.literal)
);

/**
 * Helper constructor for {@link NotFoundError} (404).
 *
 * **Example** (Make NotFoundError helper)
 *
 * ```typescript
 * import { makeNotFoundError } from "@beep/observability"
 *
 * const error = makeNotFoundError("resource missing")
 * console.log(error.status) // 404
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeNotFoundError: StatusErrorConstructor<NotFoundError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(NotFoundError, HttpStatus.NotFound.literal)
);

/**
 * Helper constructor for {@link ConflictError} (409).
 *
 * **Example** (Make ConflictError helper)
 *
 * ```typescript
 * import { makeConflictError } from "@beep/observability"
 *
 * const error = makeConflictError("duplicate key")
 * console.log(error.status) // 409
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeConflictError: StatusErrorConstructor<ConflictError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ConflictError, HttpStatus.Conflict.literal)
);

/**
 * Helper constructor for {@link UnprocessableEntityError} (422).
 *
 * **Example** (Make UnprocessableEntityError helper)
 *
 * ```typescript
 * import { makeUnprocessableEntityError } from "@beep/observability"
 *
 * const error = makeUnprocessableEntityError("schema mismatch")
 * console.log(error.status) // 422
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeUnprocessableEntityError: StatusErrorConstructor<UnprocessableEntityError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(UnprocessableEntityError, HttpStatus.UnprocessableEntity.literal)
);

/**
 * Helper constructor for {@link TooManyRequestsError} (429).
 *
 * **Example** (Make TooManyRequestsError helper)
 *
 * ```typescript
 * import { makeTooManyRequestsError } from "@beep/observability"
 *
 * const error = makeTooManyRequestsError("rate limit hit")
 * console.log(error.status) // 429
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeTooManyRequestsError: StatusErrorConstructor<TooManyRequestsError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(TooManyRequestsError, HttpStatus.TooManyRequests.literal)
);

/**
 * Helper constructor for {@link InternalServerErrorError} (500).
 *
 * **Example** (Make InternalServerError helper)
 *
 * ```typescript
 * import { makeInternalServerError } from "@beep/observability"
 *
 * const error = makeInternalServerError("unexpected failure")
 * console.log(error.status) // 500
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeInternalServerError: StatusErrorConstructor<InternalServerErrorError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(InternalServerErrorError, HttpStatus.InternalServerError.literal)
);

/**
 * Helper constructor for {@link BadGatewayError} (502).
 *
 * **Example** (Make BadGatewayError helper)
 *
 * ```typescript
 * import { makeBadGatewayError } from "@beep/observability"
 *
 * const error = makeBadGatewayError("upstream unreachable")
 * console.log(error.status) // 502
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeBadGatewayError: StatusErrorConstructor<BadGatewayError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(BadGatewayError, HttpStatus.BadGateway.literal)
);

/**
 * Helper constructor for {@link ServiceUnavailableError} (503).
 *
 * **Example** (Make ServiceUnavailableError helper)
 *
 * ```typescript
 * import { makeServiceUnavailableError } from "@beep/observability"
 *
 * const error = makeServiceUnavailableError("service down for maintenance")
 * console.log(error.status) // 503
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeServiceUnavailableError: StatusErrorConstructor<ServiceUnavailableError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(ServiceUnavailableError, HttpStatus.ServiceUnavailable.literal)
);

/**
 * Helper constructor for {@link GatewayTimeoutError} (504).
 *
 * **Example** (Make GatewayTimeoutError helper)
 *
 * ```typescript
 * import { makeGatewayTimeoutError } from "@beep/observability"
 *
 * const error = makeGatewayTimeoutError("upstream timed out")
 * console.log(error.status) // 504
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const makeGatewayTimeoutError: StatusErrorConstructor<GatewayTimeoutError> = dual(
  isStatusErrorDataFirst,
  makeStatusConstructor(GatewayTimeoutError, HttpStatus.GatewayTimeout.literal)
);

/**
 * Shared status/cause error payload helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("StatusCauseError");

/**
 * Shared field set for tagged errors that carry a message, HTTP status, and optional defect cause.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { TaggedErrorClass } from "@beep/schema"
 * import { StatusCauseFields } from "@beep/schema/StatusCauseError"
 *
 * class AppError extends TaggedErrorClass<AppError>()("AppError", StatusCauseFields) {}
 *
 * const error = AppError.make({
 *   message: "not found",
 *   status: 404,
 *   cause: O.none()
 * })
 *
 * console.log(error)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StatusCauseFields = {
  message: S.String,
  status: S.Finite,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
} as const;

/**
 * Build the payload object expected by errors using {@link StatusCauseFields}.
 *
 * Normalizes an optional raw cause into an `Option`.
 *
 * @example
 * ```ts
 * import { statusCauseInput } from "@beep/schema/StatusCauseError"
 *
 * const payload = statusCauseInput("not found", { status: 404, cause: undefined })
 * console.log(payload.message) // "not found"
 * console.log(payload.status)  // 404
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class StatusCauseInputOptions extends S.Class<StatusCauseInputOptions>($I`StatusCauseInputOptions`)(
  {
    status: S.Finite,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("StatusCauseInputOptions", {
    description: "Normalized status/cause input options.",
  })
) {}

/**
 * Input payload shape produced by {@link statusCauseInput}.
 *
 * @example
 * ```ts
 * import { statusCauseInput, type StatusCauseInput } from "@beep/schema/StatusCauseError"
 *
 * const payload: StatusCauseInput = statusCauseInput("not found", { status: 404, cause: undefined })
 *
 * console.log(payload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusCauseInput extends S.Class<StatusCauseInput>($I`StatusCauseInput`)(
  {
    message: S.String,
    status: S.Finite,
    cause: S.Option(S.Unknown),
  },
  $I.annote("StatusCauseInput", {
    description: "Normalized status/cause input payload.",
  })
) {}

/**
 * Creates normalized status/cause input payloads.
 *
 * @example
 * ```ts
 * import { statusCauseInput } from "@beep/schema/StatusCauseError"
 *
 * const payload = statusCauseInput("not found", { status: 404, cause: undefined })
 *
 * console.log(payload.status)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const statusCauseInput: {
  (message: string, options: StatusCauseInputOptions): StatusCauseInput;
  (options: StatusCauseInputOptions): (message: string) => StatusCauseInput;
} = dual(2, (message: string, options: StatusCauseInputOptions) =>
  StatusCauseInput.make({
    message,
    status: options.status,
    cause: O.isOption(options.cause) ? options.cause : O.fromUndefinedOr(options.cause),
  })
);

type StatusCauseErrorCtor<Input extends StatusCauseInput, Error> = new (value: Input) => Error;

type StatusCauseContext = {
  readonly message: string;
  readonly status: number;
};
type StatusCauseErrorInput = StatusCauseContext & {
  readonly cause: unknown;
};
type StatusCauseErrorCauseHandler<Error> = (cause: unknown) => Error;
/**
 * The constructed error returned by the data-first {@link makeStatusCauseError}
 * forms.
 *
 * Spelled through a deferred (no-op distributive) conditional rather than a
 * naked `Error` type parameter: a naked parameter resolves eagerly, so the
 * pipeable-signature analysis cannot relate the data-first return to its
 * data-last partner. `Error extends unknown ? Error : never` is `Error` for
 * every instantiation.
 */
type StatusCauseErrorResult<Error> = Error extends unknown ? Error : never;
type StatusCauseErrorBuilder<Error> = {
  (input: StatusCauseContext): StatusCauseErrorCauseHandler<Error>;
  (input: StatusCauseErrorInput): Error;
};

const buildStatusCauseError = <Input extends StatusCauseInput, Error>(
  ctor: StatusCauseErrorCtor<Input, Error>,
  message: string,
  status: number,
  cause?: unknown
): Error => new ctor(statusCauseInput(message, { status, cause }) as Input);

const buildStatusCauseErrorBuilder = <Input extends StatusCauseInput, Error>(
  ctor: StatusCauseErrorCtor<Input, Error>
): StatusCauseErrorBuilder<Error> => {
  const fromCause: {
    (input: StatusCauseContext): StatusCauseErrorCauseHandler<Error>;
    (cause: unknown, input: StatusCauseContext): Error;
  } = dual(
    2,
    (cause: unknown, input: StatusCauseContext): Error =>
      buildStatusCauseError(ctor, input.message, input.status, cause)
  );

  return ((input: StatusCauseContext | StatusCauseErrorInput): StatusCauseErrorCauseHandler<Error> | Error =>
    "cause" in input
      ? buildStatusCauseError(ctor, input.message, input.status, input.cause)
      : fromCause({ message: input.message, status: input.status })) as StatusCauseErrorBuilder<Error>;
};

/**
 * Build a tagged error directly or derive a reusable `(message, status, cause?) => Error` builder.
 *
 * Supports multiple calling conventions via `dual`:
 * - `makeStatusCauseError(Ctor)` returns a builder function.
 * - `makeStatusCauseError(Ctor, message, status)` returns a cause handler.
 * - `makeStatusCauseError(Ctor, message, status, cause)` returns the error directly.
 *
 * @example
 * ```ts
 * import { TaggedErrorClass } from "@beep/schema"
 * import { StatusCauseFields, makeStatusCauseError } from "@beep/schema/StatusCauseError"
 *
 * class AppError extends TaggedErrorClass<AppError>()("AppError", StatusCauseFields) {}
 *
 * const build = makeStatusCauseError(AppError)
 * const err = build({
 *   message: "not found",
 *   status: 404,
 *   cause: new Error("missing")
 * })
 *
 * console.log(err)
 *
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeStatusCauseError: {
  <Input extends StatusCauseInput, Error>(ctor: StatusCauseErrorCtor<Input, Error>): StatusCauseErrorBuilder<Error>;
  <Input extends StatusCauseInput, Error>(
    ctor: StatusCauseErrorCtor<Input, Error>,
    input: StatusCauseContext
  ): StatusCauseErrorCauseHandler<Error>;
  <Input extends StatusCauseInput, Error>(
    ctor: StatusCauseErrorCtor<Input, Error>,
    input: StatusCauseErrorInput
  ): StatusCauseErrorResult<Error>;
  (
    input: StatusCauseContext
  ): <Input extends StatusCauseInput, Error>(
    ctor: StatusCauseErrorCtor<Input, Error>
  ) => StatusCauseErrorCauseHandler<Error>;
  (
    input: StatusCauseErrorInput
  ): <Input extends StatusCauseInput, Error>(ctor: StatusCauseErrorCtor<Input, Error>) => StatusCauseErrorResult<Error>;
} = dual(
  (args) => P.isFunction(args[0]),
  function <Input extends StatusCauseInput, Error>(
    ctor: StatusCauseErrorCtor<Input, Error>,
    input?: StatusCauseContext | StatusCauseErrorInput
  ): StatusCauseErrorBuilder<Error> | StatusCauseErrorCauseHandler<Error> | Error {
    const build = buildStatusCauseErrorBuilder(ctor);

    if (arguments.length === 1 || P.isUndefined(input)) {
      return build;
    }

    return build(input);
  }
);

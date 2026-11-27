/**
 * Typed technical errors for the Runpod driver boundary.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HttpClientError from "effect/http/HttpClientError";
import * as ProblemDetails from "effect/http/ProblemDetails";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { RunpodHttpMethod, RunpodOperationDescriptor, RunpodOperationId } from "./_generated/Runpod.operations.gen.ts";

const $I = $RunpodId.create("Runpod.errors");
const RunpodErrorReasonBase = LiteralKit([
  "config",
  "pagination",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]);
const RunpodDocsErrorReasonBase = LiteralKit(["config", "parse", "response decoding", "response status", "transport"]);

/**
 * **Example** (Checking status code membership)
 *
 * ```ts
 * import { RunpodHttpStatusCode } from "@beep/runpod"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RunpodHttpStatusCode)(200))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunpodHttpStatusCode = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("RunpodHttpStatusCode", {
    description: "Numeric HTTP status code emitted by Runpod driver boundaries.",
  })
);

/**
 * **Example** (Annotating status code type)
 *
 * ```ts
 * import type { RunpodHttpStatusCode } from "@beep/runpod"
 *
 * const status: RunpodHttpStatusCode = 200
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RunpodHttpStatusCode = typeof RunpodHttpStatusCode.Type;

/**
 * **Example** (Inspecting error reason AST)
 *
 * ```ts
 * import { RunpodErrorReason } from "@beep/runpod"
 *
 * console.log(RunpodErrorReason.ast)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const RunpodErrorReason = RunpodErrorReasonBase.pipe(
  $I.annoteSchema("RunpodErrorReason", {
    description: "Redacted technical error reasons emitted by the Runpod REST API driver.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodErrorReasonBase)
);

/**
 * **Example** (Assigning transport error reason)
 *
 * ```ts
 * import type { RunpodErrorReason } from "@beep/runpod"
 *
 * const reason: RunpodErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type RunpodErrorReason = typeof RunpodErrorReason.Type;

/**
 * **Example** (Inspecting docs reason AST)
 *
 * ```ts
 * import { RunpodDocsErrorReason } from "@beep/runpod"
 *
 * console.log(RunpodDocsErrorReason.ast)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const RunpodDocsErrorReason = RunpodDocsErrorReasonBase.pipe(
  $I.annoteSchema("RunpodDocsErrorReason", {
    description: "Redacted technical error reasons emitted by the Runpod documentation driver.",
  }),
  SchemaUtils.withLiteralKitStatics(RunpodDocsErrorReasonBase)
);

/**
 * **Example** (Assigning parse error reason)
 *
 * ```ts
 * import type { RunpodDocsErrorReason } from "@beep/runpod"
 *
 * const reason: RunpodDocsErrorReason = "parse"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type RunpodDocsErrorReason = typeof RunpodDocsErrorReason.Type;

const runpodProblemErrorsDefault = A.empty<string>();
/**
 * **Details**
 *
 * Runpod v2 answers every failure with `application/problem+json`: a
 * required `title`, `status`, and `detail`, plus an `errors` array that
 * lists request-validation failures (for example an unknown body field).
 * Members are optional here because a proxy in front of Runpod can answer
 * with a partial problem.
 *
 * **Example** (Read a validation problem)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RunpodProblem } from "@beep/runpod"
 *
 * const problem = RunpodProblem.make({
 *   detail: O.some("request body failed validation"),
 *   errors: ["$: additional properties 'dataCenterId' not allowed"],
 *   status: O.some(422),
 *   title: O.some("Unprocessable Entity")
 * })
 *
 * console.log(problem.errors[0]) // => "$: additional properties 'dataCenterId' not allowed"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class RunpodProblem extends S.Opaque<RunpodProblem, { readonly brand: unique symbol }>()(
  S.Struct({
    detail: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    errors: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(runpodProblemErrorsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(runpodProblemErrorsDefault))
    ),
    instance: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
    title: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    type: S.String.pipe(S.withConstructorDefault(Effect.succeed(ProblemDetails.blankType))),
  }).pipe(
    $I.annoteSchema("RunpodProblem", {
      description: "RFC 9457 problem details returned by a failed Runpod REST API v2 request.",
    })
  )
) {}

const isRunpodHttpStatusCode = S.is(RunpodHttpStatusCode);
const isProblemValidationErrors = S.is(S.Array(S.String));

/**
 * Decode a Runpod problem body through Effect's lenient RFC 9457 codec.
 *
 * **Details**
 *
 * Standard members with the wrong JSON type are dropped, a missing `type`
 * becomes `about:blank`, and the `errors` extension is kept only when it is
 * an array of strings, so a malformed problem never masks the failed status.
 *
 * **Example** (Decode a v2 problem body)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RunpodProblemFromProblemDetails } from "@beep/runpod"
 *
 * const program = S.decodeUnknownEffect(RunpodProblemFromProblemDetails)({
 *   detail: "The requested Pod does not exist.",
 *   status: 404,
 *   title: "Not Found"
 * })
 *
 * Effect.runPromise(program).then((problem) => console.log(problem.type)) // => "about:blank"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const RunpodProblemFromProblemDetails = ProblemDetails.Schema.pipe(
  S.decodeTo(RunpodProblem, {
    decode: SchemaGetter.transform((problem): typeof RunpodProblem.Encoded => ({
      type: problem.type,
      ...O.getSomesStruct({
        detail: O.fromUndefinedOr(problem.detail),
        errors: O.liftPredicate(problem.errors, isProblemValidationErrors),
        instance: O.fromUndefinedOr(problem.instance),
        status: O.liftPredicate(problem.status, isRunpodHttpStatusCode),
        title: O.fromUndefinedOr(problem.title),
      }),
    })),
    encode: SchemaGetter.transform((problem): ProblemDetails.ProblemDetails => problem),
  }),
  $I.annoteSchema("RunpodProblemFromProblemDetails", {
    description: "Runpod problem details decoded leniently from an RFC 9457 problem body.",
  })
);

/**
 * **Details**
 *
 * A `response status` failure carries the HTTP status and, when Runpod
 * answered with an RFC 9457 body, the decoded `problem`, including any
 * request-validation `errors` that name the rejected field.
 *
 * **Example** (Creating config RunpodError)
 *
 * ```ts
 * import { RunpodError } from "@beep/runpod"
 *
 * const error = RunpodError.config("missing RUNPOD_API_KEY")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class RunpodError extends S.TaggedError<RunpodError, { readonly brand: unique symbol }>($I`RunpodError`)(
  "RunpodError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    method: S.OptionFromOptionalKey(RunpodHttpMethod).pipe(S.withConstructorDefault(Effect.succeedNone)),
    methodName: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    operationId: S.OptionFromOptionalKey(RunpodOperationId).pipe(S.withConstructorDefault(Effect.succeedNone)),
    path: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    problem: S.OptionFromOptionalKey(RunpodProblem).pipe(S.withConstructorDefault(Effect.succeedNone)),
    reason: RunpodErrorReason,
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annoteError<RunpodError>("RunpodError", {
    description: "Redacted technical failure raised by the Runpod REST API driver boundary.",
  })
) {
  static readonly is = S.is(RunpodError);

  /**
   * Create a driver error scoped to a documented Runpod operation.
   *
   * @category constructors
   * @since 0.1.0
   */
  static readonly fromDescriptor: {
    (descriptor: RunpodOperationDescriptor, reason: RunpodErrorReason, options?: RunpodErrorOptionsInput): RunpodError;
    (
      reason: RunpodErrorReason,
      options?: RunpodErrorOptionsInput
    ): (descriptor: RunpodOperationDescriptor) => RunpodError;
  } = dual(
    (args) => args.length >= 2 && RunpodOperationDescriptor.is(args[0]),
    (
      descriptor: RunpodOperationDescriptor,
      reason: RunpodErrorReason,
      options: RunpodErrorOptionsInput = RunpodErrorOptionsInput.make({})
    ) =>
      RunpodError.make({
        method: O.some(descriptor.method),
        methodName: O.some(descriptor.methodName),
        operationId: O.some(descriptor.operationId),
        path: O.some(descriptor.path),
        problem: O.fromUndefinedOr(options.problem),
        reason,
        cause: causeFromUnknown(options.cause),
        status: O.fromUndefinedOr(options.status),
      })
  );

  /**
   * Create a driver error before a specific operation descriptor exists.
   *
   * @category constructors
   * @since 0.1.0
   */
  static readonly config = (cause?: unknown): RunpodError =>
    RunpodError.make({
      cause: causeFromUnknown(cause),
      reason: "config",
    });

  /**
   * Create a driver error for a raw request.
   *
   * @category constructors
   * @since 0.1.0
   */
  static readonly raw = (options: RunpodRawErrorOptions): RunpodError =>
    RunpodError.make({
      method: O.some(options.method),
      path: O.some(options.path),
      reason: options.reason,
      cause: causeFromUnknown(options.cause),
      status: O.fromUndefinedOr(options.status),
    });
}

/**
 * **Example** (Building docs error from reason)
 *
 * ```ts
 * import { RunpodDocsError } from "@beep/runpod"
 *
 * const error = RunpodDocsError.fromReason("parse")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class RunpodDocsError extends S.TaggedError<RunpodDocsError, { readonly brand: unique symbol }>(
  $I`RunpodDocsError`
)(
  "RunpodDocsError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    reason: RunpodDocsErrorReason,
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
    url: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annoteError<RunpodDocsError>("RunpodDocsError", {
    description: "Redacted technical failure raised by the Runpod documentation index boundary.",
  })
) {
  /**
   * Create a Runpod documentation driver error.
   *
   * @category constructors
   * @since 0.1.0
   */
  static readonly fromReason = (
    reason: RunpodDocsErrorReason,
    options: RunpodDocsErrorOptionsInput = RunpodDocsErrorOptionsInput.make({})
  ): RunpodDocsError =>
    RunpodDocsError.make({
      cause: causeFromUnknown(options.cause),
      reason,
      status: O.fromUndefinedOr(options.status),
      url: O.fromUndefinedOr(options.url),
    });
}

/**
 * Options used when constructing Runpod driver errors.
 *
 * **Example** (Making options with cause)
 *
 * ```ts
 * import { RunpodErrorOptions } from "@beep/runpod"
 * import * as O from "effect/Option"
 *
 * const options = RunpodErrorOptions.make({ cause: O.some("timeout") })
 * console.log(O.getOrUndefined(options.cause))
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodErrorOptions extends S.Opaque<RunpodErrorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Sanitized string label of the failure cause, so the options round-trip deterministically; raw thrown causes are normalized to it first.",
      })
    ),
    problem: S.OptionFromOptionalKey(RunpodProblem).pipe(S.withConstructorDefault(Effect.succeedNone)),
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("RunpodErrorOptions", {
      description: "Sanitized options for configuring RunpodError instances.",
    })
  )
) {}

/**
 * **Example** (Record the HTTP status of a failed operation)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { listPodsOperation, RunpodError, RunpodErrorOptionsInput } from "@beep/runpod"
 *
 * const error = RunpodError.fromDescriptor(
 *   listPodsOperation,
 *   "response status",
 *   RunpodErrorOptionsInput.make({ status: 503 })
 * )
 *
 * console.log(O.getOrUndefined(error.status)) // => 503
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunpodErrorOptionsInput extends S.Opaque<RunpodErrorOptionsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    problem: S.optionalKey(RunpodProblem),
    status: S.optionalKey(RunpodHttpStatusCode),
  }).pipe(
    $I.annoteSchema("RunpodErrorOptionsInput", {
      description: "Raw option input accepted by RunpodError constructors before schema-owned normalization.",
    })
  )
) {}

/**
 * Options used when constructing Runpod driver errors for raw requests.
 *
 * **Example** (Making raw request options)
 *
 * ```ts
 * import { RunpodRawErrorOptions } from "@beep/runpod"
 *
 * const options = RunpodRawErrorOptions.make({
 *   method: "GET",
 *   path: "/health",
 *   reason: "transport"
 * })
 * console.log(options.path)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodRawErrorOptions extends S.Opaque<RunpodRawErrorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    method: RunpodHttpMethod,
    path: S.String,
    reason: RunpodErrorReason,
    status: S.optionalKey(RunpodHttpStatusCode),
  }).pipe(
    $I.annoteSchema("RunpodRawErrorOptions", {
      description: "Options for configuring RunpodError instances for raw requests.",
    })
  )
) {}

/**
 * Options used when constructing Runpod documentation driver errors.
 *
 * **Example** (Making docs error options)
 *
 * ```ts
 * import { RunpodDocsErrorOptions } from "@beep/runpod"
 * import * as O from "effect/Option"
 *
 * const options = RunpodDocsErrorOptions.make({
 *   url: O.some("https://docs.runpod.io/llms.txt")
 * })
 * console.log(O.getOrUndefined(options.url))
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodDocsErrorOptions extends S.Opaque<RunpodDocsErrorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Sanitized string label of the failure cause, so the options round-trip deterministically; raw thrown causes are normalized to it first.",
      })
    ),
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
    url: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("RunpodDocsErrorOptions", {
      description: "Sanitized options for configuring RunpodDocsError instances.",
    })
  )
) {}

/**
 * **Example** (Record the URL of a failed docs fetch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RunpodDocsError, RunpodDocsErrorOptionsInput } from "@beep/runpod"
 *
 * const error = RunpodDocsError.fromReason(
 *   "response status",
 *   RunpodDocsErrorOptionsInput.make({ status: 404, url: "https://docs.runpod.io/llms.txt" })
 * )
 *
 * console.log(O.getOrUndefined(error.url)) // => "https://docs.runpod.io/llms.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunpodDocsErrorOptionsInput extends S.Opaque<
  RunpodDocsErrorOptionsInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    status: S.optionalKey(RunpodHttpStatusCode),
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("RunpodDocsErrorOptionsInput", {
      description: "Raw option input accepted by RunpodDocsError constructors before schema-owned normalization.",
    })
  )
) {}

const safelyRead = (key: PropertyKey): ((value: unknown) => O.Option<unknown>) =>
  flow(
    O.liftPredicate(P.isObject),
    O.flatMap((object) =>
      pipe(
        Result.try(() => Reflect.get(object, key)),
        Result.getOrElse(() => undefined),
        O.fromUndefinedOr
      )
    )
  );

const stringProperty = (key: PropertyKey): ((value: unknown) => O.Option<string>) =>
  flow(safelyRead(key), O.filter(P.isString));

const isHttpClientCause: (cause: unknown) => boolean = flow(
  (cause) => Result.try(() => HttpClientError.isHttpClientError(cause)),
  Result.getOrElse(() => false)
);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  pipe(
    O.some(cause),
    O.filter(isHttpClientCause),
    O.flatMap(safelyRead("reason")),
    O.flatMap(stringProperty("_tag")),
    O.map((tag) => `HttpClientError:${tag}`)
  );

const causeFromUnknown = (cause: unknown): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(cause),
    O.flatMap((presentCause) =>
      O.firstSomeOf([
        httpClientCauseLabel(presentCause),
        stringProperty("_tag")(presentCause),
        stringProperty("name")(presentCause),
        pipe(presentCause, O.liftPredicate(P.isString), O.as("String")),
      ])
    )
  );

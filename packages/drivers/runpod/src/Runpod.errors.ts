/**
 * Typed technical errors for the Runpod driver boundary.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { RunpodHttpMethod, RunpodOperationDescriptor, RunpodOperationId } from "./_generated/Runpod.operations.gen.ts";

const $I = $RunpodId.create("Runpod.errors");
const RunpodErrorReasonBase = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]);
const RunpodDocsErrorReasonBase = LiteralKit(["config", "parse", "response decoding", "response status", "transport"]);

/**
 * Numeric HTTP status code emitted by Runpod driver boundaries.
 *
 * **Example** (Checking status code membership)
 *
 * ```ts
 * import { RunpodHttpStatusCode } from "@beep/runpod"
 *
 * console.log(RunpodHttpStatusCode.is(200))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunpodHttpStatusCode = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("RunpodHttpStatusCode", {
    description: "Numeric HTTP status code emitted by Runpod driver boundaries.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link RunpodHttpStatusCode}.
 *
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
 * Technical error reasons emitted by the Runpod REST API driver.
 *
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
  SchemaUtils.withLiteralKitStatics(RunpodErrorReasonBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Type for {@link RunpodErrorReason}.
 *
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
 * Technical error reasons emitted by the Runpod documentation index driver.
 *
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
  SchemaUtils.withLiteralKitStatics(RunpodDocsErrorReasonBase),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Type for {@link RunpodDocsErrorReason}.
 *
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

/**
 * Technical failure raised by the Runpod REST API driver boundary.
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
export class RunpodError extends S.TaggedError<RunpodError>($I`RunpodError`)(
  "RunpodError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(RunpodHttpMethod).pipe(SchemaUtils.withNoneDefault),
    methodName: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    operationId: S.OptionFromOptionalKey(RunpodOperationId).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: RunpodErrorReason,
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
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
    (descriptor: RunpodOperationDescriptor, reason: RunpodErrorReason, options: RunpodErrorOptionsInput = {}) =>
      RunpodError.make({
        method: O.some(descriptor.method),
        methodName: O.some(descriptor.methodName),
        operationId: O.some(descriptor.operationId),
        path: O.some(descriptor.path),
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
 * Technical failure raised by the Runpod documentation index driver boundary.
 *
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
export class RunpodDocsError extends S.TaggedError<RunpodDocsError>($I`RunpodDocsError`)(
  "RunpodDocsError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: RunpodDocsErrorReason,
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
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
    options: RunpodDocsErrorOptionsInput = {}
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
export class RunpodErrorOptions extends S.Class<RunpodErrorOptions>($I`RunpodErrorOptions`)(
  {
    // Sanitized string label so the exported options schema round-trips
    // deterministically. Raw thrown causes are accepted via the private
    // `RunpodErrorOptionsInput` and normalized through `causeFromUnknown`.
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("RunpodErrorOptions", {
    description: "Sanitized options for configuring RunpodError instances.",
  })
) {}

class RunpodErrorOptionsInput extends S.Class<RunpodErrorOptionsInput>($I`RunpodErrorOptionsInput`)(
  {
    cause: S.optionalKey(Defect({ includeStack: true })),
    status: S.optionalKey(RunpodHttpStatusCode),
  },
  $I.annote("RunpodErrorOptionsInput", {
    description: "Raw option input accepted by RunpodError constructors before schema-owned normalization.",
  })
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
export class RunpodRawErrorOptions extends S.Class<RunpodRawErrorOptions>($I`RunpodRawErrorOptions`)(
  {
    cause: S.optionalKey(Defect({ includeStack: true })),
    method: RunpodHttpMethod,
    path: S.String,
    reason: RunpodErrorReason,
    status: S.optionalKey(RunpodHttpStatusCode),
  },
  $I.annote("RunpodRawErrorOptions", {
    description: "Options for configuring RunpodError instances for raw requests.",
  })
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
export class RunpodDocsErrorOptions extends S.Class<RunpodDocsErrorOptions>($I`RunpodDocsErrorOptions`)(
  {
    // Sanitized string label so the exported options schema round-trips
    // deterministically. Raw thrown causes are accepted via the private
    // `RunpodDocsErrorOptionsInput` and normalized through `causeFromUnknown`.
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    status: S.OptionFromOptionalKey(RunpodHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("RunpodDocsErrorOptions", {
    description: "Sanitized options for configuring RunpodDocsError instances.",
  })
) {}

class RunpodDocsErrorOptionsInput extends S.Class<RunpodDocsErrorOptionsInput>($I`RunpodDocsErrorOptionsInput`)(
  {
    cause: S.optionalKey(Defect({ includeStack: true })),
    status: S.optionalKey(RunpodHttpStatusCode),
    url: S.optionalKey(S.String),
  },
  $I.annote("RunpodDocsErrorOptionsInput", {
    description: "Raw option input accepted by RunpodDocsError constructors before schema-owned normalization.",
  })
) {}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- safe reflection keeps unknown docs failures inside the Runpod boundary
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      () => undefined
    )
  );
};

const readString: {
  (value: unknown, key: PropertyKey): O.Option<string>;
  (key: PropertyKey): (value: unknown) => O.Option<string>;
} = dual(2, (value: unknown, key: PropertyKey): O.Option<string> => O.filter(readProperty(value, key), P.isString));

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), () => false);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap(readString("_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);

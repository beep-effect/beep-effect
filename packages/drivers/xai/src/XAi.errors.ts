/**
 * Typed technical errors for the xAI driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XaiId } from "@beep/identity";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { XAiHttpStatusCode } from "./XAi.models.ts";
import { XAiEndpoint, XAiEndpointId, XAiEndpointMethodName, XAiHttpMethod } from "./XAiEndpoints.models.ts";
import type { XAiEndpointDescriptor } from "./XAiEndpoints.models.ts";

const $I = $XaiId.create("XAi.errors");
const XAiErrorReasonBase = LiteralKit([
  "config",
  "multipart encoding",
  "request encoding",
  "response decoding",
  "response status",
  "sse decoding",
  "transport",
  "websocket",
]);

type XAiErrorOptionsInput = {
  readonly cause?: unknown;
  readonly status?: number;
};

/**
 * Technical error reasons emitted by the xAI driver.
 *
 * @example
 * ```ts
 * import type { XAiErrorReason } from "@beep/xai"
 *
 * const reason: XAiErrorReason = "response status"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const XAiErrorReason = XAiErrorReasonBase.pipe(
  $I.annoteSchema("XAiErrorReason", {
    description: "Redacted technical error reasons emitted by the xAI driver.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiErrorReasonBase)
);

/**
 * Type for {@link XAiErrorReason}.
 *
 * @example
 * ```ts
 * import type { XAiErrorReason } from "@beep/xai"
 *
 * const reason: XAiErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type XAiErrorReason = typeof XAiErrorReason.Type;

/**
 * Technical failure raised by the xAI driver boundary.
 *
 * @example
 * ```ts
 * import { XAiError, XAI_ENDPOINTS } from "@beep/xai"
 *
 * const error = XAiError.fromDescriptor(XAI_ENDPOINTS[0], "transport")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XAiError extends TaggedErrorClass<XAiError>($I`XAiError`)(
  "XAiError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    endpoint: S.OptionFromOptionalKey(XAiEndpointId).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(XAiHttpMethod).pipe(SchemaUtils.withNoneDefault),
    methodName: S.OptionFromOptionalKey(XAiEndpointMethodName).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: XAiErrorReason,
    status: S.OptionFromOptionalKey(XAiHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("XAiError", {
    description: "Redacted technical failure raised by the xAI driver boundary.",
  })
) {
  /**
   * Create a driver error scoped to a documented xAI endpoint.
   *
   * @example
   * ```ts
   * import { XAiError, XAI_ENDPOINTS } from "@beep/xai"
   *
   * const error = XAiError.fromDescriptor(XAI_ENDPOINTS[0], "request encoding")
   * console.log(error.endpoint)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromDescriptor: {
    (descriptor: XAiEndpointDescriptor, reason: XAiErrorReason, options?: XAiErrorOptionsInput): XAiError;
    (reason: XAiErrorReason, options?: XAiErrorOptionsInput): (descriptor: XAiEndpointDescriptor) => XAiError;
  } = dual(
    (args) => args.length >= 2 && XAiEndpoint.is(args[0]),
    (descriptor: XAiEndpointDescriptor, reason: XAiErrorReason, options: XAiErrorOptionsInput = {}): XAiError =>
      XAiError.make({
        endpoint: O.some(descriptor.id),
        method: O.some(descriptor.method),
        methodName: O.some(descriptor.methodName),
        path: O.some(descriptor.path),
        reason,
        cause: causeFromUnknown(options.cause),
        status: O.fromUndefinedOr(options.status),
      })
  );

  /**
   * Create a configuration error before a specific endpoint exists.
   *
   * @example
   * ```ts
   * import { XAiError } from "@beep/xai"
   *
   * const error = XAiError.config()
   * console.log(error.reason)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly config = (cause?: unknown): XAiError =>
    XAiError.make({
      cause: causeFromUnknown(cause),
      reason: "config",
    });
}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
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

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  O.filter(readProperty(value, key), P.isString);

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), () => false);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap((reason) => readString(reason, "_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);

/**
 * Options used when constructing xAI driver errors.
 *
 * @example
 * ```ts
 * import { XAiErrorOptions } from "@beep/xai"
 * import * as O from "effect/Option"
 *
 * const options = XAiErrorOptions.make({ status: O.some(500) })
 * console.log(options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XAiErrorOptions extends S.Class<XAiErrorOptions>($I`XAiErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
    status: S.OptionFromOptionalKey(XAiHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("XAiErrorOptions", {
    description: "Options for configuring XAiError instances, including optional redacted cause and status fields.",
  })
) {}

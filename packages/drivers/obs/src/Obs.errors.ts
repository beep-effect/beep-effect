/**
 * Typed errors raised by the obs-websocket driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObsId } from "@beep/identity/packages";
import { Defect, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ObsId.create("Obs.errors");
const ObsDefect = Defect({ includeStack: true });
const isObsDefect = S.is(ObsDefect);

/**
 * Non-negative integer obs-websocket `RequestStatus` code.
 *
 * **Example** (Make request status code)
 *
 * ```ts
 * import { ObsRequestStatusCode } from "@beep/obs"
 *
 * const code = ObsRequestStatusCode.make(600)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ObsRequestStatusCode = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`ObsRequestStatusCodeMinimumCheck`,
    title: "Obs Request Status Code Minimum",
    description: "obs-websocket RequestStatus codes are non-negative integers.",
    message: "Expected a non-negative obs-websocket request status code",
  })
).pipe(
  $I.annoteSchema("ObsRequestStatusCode", {
    description: "Non-negative integer obs-websocket RequestStatus code.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer obs-websocket `RequestStatus` code.
 *
 * **Example** (Type-annotate status code)
 *
 * ```ts
 * import { ObsRequestStatusCode } from "@beep/obs"
 * import type { ObsRequestStatusCode as ObsRequestStatusCodeValue } from "@beep/obs"
 *
 * const code: ObsRequestStatusCodeValue = ObsRequestStatusCode.make(600)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ObsRequestStatusCode = typeof ObsRequestStatusCode.Type;

/**
 * Non-negative integer WebSocket close code.
 *
 * **Example** (Make WebSocket close code)
 *
 * ```ts
 * import { ObsWebSocketCloseCode } from "@beep/obs"
 *
 * const code = ObsWebSocketCloseCode.make(1006)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ObsWebSocketCloseCode = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`ObsWebSocketCloseCodeMinimumCheck`,
    title: "Obs WebSocket Close Code Minimum",
    description: "WebSocket close codes are non-negative integers.",
    message: "Expected a non-negative WebSocket close code",
  })
).pipe(
  $I.annoteSchema("ObsWebSocketCloseCode", {
    description: "Non-negative integer WebSocket close code.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer WebSocket close code.
 *
 * **Example** (Type-annotate close code)
 *
 * ```ts
 * import { ObsWebSocketCloseCode } from "@beep/obs"
 * import type { ObsWebSocketCloseCode as ObsWebSocketCloseCodeValue } from "@beep/obs"
 *
 * const code: ObsWebSocketCloseCodeValue = ObsWebSocketCloseCode.make(1000)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ObsWebSocketCloseCode = typeof ObsWebSocketCloseCode.Type;

type ObsErrorContextInput = {
  readonly cause?: unknown;
  readonly closeCode?: ObsWebSocketCloseCode;
  readonly requestStatusCode?: ObsRequestStatusCode;
  readonly requestStatusComment?: string;
  readonly requestType?: string;
};

const causeFromUnknown = (cause: unknown): O.Option<typeof ObsDefect.Type> =>
  P.hasInspectableObjectShape(cause) && isObsDefect(cause) ? O.some(cause) : O.none();

const existingObsError = (cause: unknown): O.Option<ObsError> => (ObsError.is(cause) ? O.some(cause) : O.none());

/**
 * Technical failure raised by the `@beep/obs` driver boundary.
 *
 * **Details**
 *
 * A single tagged error covers the whole driver; the optional fields
 * discriminate transport failures (`closeCode`), obs-websocket request
 * failures (`requestType`, `requestStatusCode`, `requestStatusComment`),
 * and wrapped platform defects (`cause`).
 *
 * **Example** (Construct ObsError instance)
 *
 * ```ts
 * import { ObsError } from "@beep/obs"
 *
 * const error = ObsError.make({ message: "obs-websocket request failed", operation: "startRecording" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ObsError extends S.TaggedError<ObsError>($I`ObsError`)(
  "ObsError",
  {
    cause: S.OptionFromOptionalKey(ObsDefect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsError.cause", {
        description: "Inspectable originating defect, when available.",
      })
    ),
    closeCode: S.OptionFromOptionalKey(ObsWebSocketCloseCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsError.closeCode", {
        description: "WebSocket close code observed when the obs-websocket connection dropped, when available.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("ObsError.message", {
        description: "Human-readable obs-websocket driver failure summary.",
      })
    ),
    operation: S.String.pipe(
      $I.annoteKey("ObsError.operation", {
        description: "Driver operation that emitted the failure.",
      })
    ),
    requestStatusCode: S.OptionFromOptionalKey(ObsRequestStatusCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsError.requestStatusCode", {
        description: "obs-websocket RequestStatus code returned by a failed request, when available.",
      })
    ),
    requestStatusComment: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsError.requestStatusComment", {
        description: "obs-websocket RequestStatus comment returned by a failed request, when available.",
      })
    ),
    requestType: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsError.requestType", {
        description: "obs-websocket request type involved in the failure, when available.",
      })
    ),
  },
  $I.annoteError<ObsError>("ObsError", {
    description: "Technical obs-websocket driver failure scoped to a driver operation.",
  })
) {
  static readonly is = S.is(ObsError);

  /**
   * Normalize an unknown transport or platform failure into an {@link ObsError}.
   *
   * **Details**
   *
   * Existing {@link ObsError} causes pass through unchanged so error context is
   * never double-wrapped.
   *
   * **Example** (Normalize unknown failure)
   *
   * ```ts
   * import { ObsError } from "@beep/obs"
   *
   * const error = ObsError.fromUnknown("connect", "Failed to reach obs-websocket", { cause: new Error("boom") })
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: string, message: string, options: ObsErrorContextInput): ObsError;
    (message: string, options: ObsErrorContextInput): (operation: string) => ObsError;
  } = dual(
    3,
    (operation: string, message: string, options: ObsErrorContextInput): ObsError =>
      O.getOrElse(existingObsError(options.cause), () =>
        ObsError.make({
          cause: causeFromUnknown(options.cause),
          closeCode: O.fromUndefinedOr(options.closeCode),
          message,
          operation,
          requestStatusCode: O.fromUndefinedOr(options.requestStatusCode),
          requestStatusComment: O.fromUndefinedOr(options.requestStatusComment),
          requestType: O.fromUndefinedOr(options.requestType),
        })
      )
  );
}

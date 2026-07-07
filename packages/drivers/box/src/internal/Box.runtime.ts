import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxError } from "../Box.errors.ts";
import type { BoxMethodName } from "../_generated/Box.models.gen.ts";

/**
 * Decode a Box driver boundary value into a typed request or response model.
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeWith = <A>(
  method: BoxMethodName,
  schema: S.ConstraintDecoder<A>,
  value: unknown,
  reason: "request encoding" | "response decoding"
): Effect.Effect<A, BoxError> =>
  S.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((cause) =>
      BoxError.fromReason(reason, {
        cause,
        method,
      })
    )
  );

/**
 * Build sanitized Box driver diagnostics for debug logging.
 *
 * @category utilities
 * @since 0.0.0
 */
export const diagnosticsFor = (event: string, error: BoxError): Readonly<Record<string, unknown>> => ({
  event,
  method: O.getOrUndefined(error.method),
  provider: "box",
  reason: error.reason,
  sdkVersion: error.sdkVersion,
  status: O.getOrUndefined(error.status),
});

/**
 * Log a sanitized Box driver failure event.
 *
 * @category utilities
 * @since 0.0.0
 */
export const logDriverFailure =
  (event: string) =>
  (error: BoxError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(event, error));

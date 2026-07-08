import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxError } from "../Box.errors.ts";
import type { Exit } from "effect";
import type { BoxMethodName } from "../_generated/Box.models.gen.ts";

/**
 * Decode a Box driver boundary value into a typed request or response model.
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeWith: {
  (
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): <A>(schema: S.ConstraintDecoder<A>) => Effect.Effect<A, BoxError>;
  <A>(
    schema: S.ConstraintDecoder<A>,
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): Effect.Effect<A, BoxError>;
} = dual(
  3,
  <A>(
    schema: S.ConstraintDecoder<A>,
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): Effect.Effect<A, BoxError> =>
    S.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((cause) =>
        BoxError.fromReason(options.reason, {
          cause,
          method: options.method,
        })
      )
    )
);

/**
 * Decode `payload` against `payloadSchema`, then run `use` with an
 * `AbortController` scoped to the call's lifetime, invoking `release` when
 * the call completes. Shared acquire/decode/use skeleton for every SDK call
 * shape (JSON, byte stream) that needs a cancellable in-flight request.
 *
 * @category utilities
 * @since 0.0.0
 */
export const acquireSdkCallController = <Payload, Out>(spec: {
  readonly methodName: BoxMethodName;
  readonly payloadSchema: S.ConstraintDecoder<Payload>;
  readonly payload: unknown;
  readonly use: (decoded: Payload, controller: AbortController) => Effect.Effect<Out, BoxError>;
  readonly release: (controller: AbortController, exit: Exit.Exit<Out, BoxError>) => Effect.Effect<void>;
}): Effect.Effect<Out, BoxError> =>
  Effect.acquireUseRelease(
    Effect.sync(() => new AbortController()),
    (controller) =>
      decodeWith(spec.payloadSchema, spec.payload, {
        method: spec.methodName,
        reason: "request encoding",
      }).pipe(Effect.flatMap((decoded) => spec.use(decoded, controller))),
    spec.release
  );

/**
 * Build sanitized Box driver diagnostics for debug logging.
 *
 * @category utilities
 * @since 0.0.0
 */
export const diagnosticsFor: {
  (error: BoxError, event: string): Readonly<Record<string, unknown>>;
  (event: string): (error: BoxError) => Readonly<Record<string, unknown>>;
} = dual(
  2,
  (error: BoxError, event: string): Readonly<Record<string, unknown>> => ({
    event,
    method: O.getOrUndefined(error.method),
    provider: "box",
    reason: error.reason,
    sdkVersion: error.sdkVersion,
    status: O.getOrUndefined(error.status),
  })
);

/**
 * Log a sanitized Box driver failure event.
 *
 * @category utilities
 * @since 0.0.0
 */
export const logDriverFailure =
  (event: string) =>
  (error: BoxError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(error, event));

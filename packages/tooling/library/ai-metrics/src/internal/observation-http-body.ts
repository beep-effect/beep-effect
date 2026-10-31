/** Bounded streaming HTTP body reader shared by private observation routes. */

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as Duration from "effect/Duration";

/**
 * Payload-free refusal while reading an observation request.
 * **Example** (Describe a refusal)
 * ```ts
 * const reason = "oversize"
 * console.log(reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationHttpBodyError extends S.TaggedError<
  ObservationHttpBodyError,
  { readonly brand: unique symbol }
>()("ObservationHttpBodyError", {
  reason: S.Literals(["oversize", "malformed", "timed-out"]),
}) {}

/**
 * Construct a safe body-read error without retaining input.
 * **Example** (Select a reason)
 * ```ts
 * const reason = "malformed"
 * console.log(reason)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const observationHttpBodyFailure = (reason: ObservationHttpBodyError["reason"]) =>
  ObservationHttpBodyError.make({ reason });

/**
 * Read request bytes within a caller-owned fixed allocation.
 * **Example** (Choose the private launch limit)
 * ```ts
 * const bytes = 8192
 * console.log(bytes)
 * ```
 * **Details** Rejects a chunk before copying beyond the ceiling. Callers provide a finite trusted limit, deadlines and request admission; source errors never retain body content.
 * @category utilities
 * @since 0.0.0
 */
export const readObservationHttpBytes = Effect.fn("AiMetrics.readObservationHttpBytes")(function* <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
  byteLimit: number
) {
  const buffer = new Uint8Array(byteLimit);
  let offset = 0;
  yield* stream.pipe(
    Stream.mapError(() => observationHttpBodyFailure("malformed")),
    Stream.runForEach(
      Effect.fnUntraced(function* (chunk) {
        if (chunk.byteLength > byteLimit - offset) return yield* observationHttpBodyFailure("oversize");
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      })
    )
  );
  return buffer.slice(0, offset);
});

/**
 * Decode strict UTF-8 after a bounded request-body read with its own deadline.
 * **Example** (Choose a body deadline)
 * ```ts
 * const timeoutMillis = 1000
 * console.log(timeoutMillis)
 * ```
 * **Details** The deadline covers streaming only, matching the private routes' existing contract. Decode failures retain neither input bytes nor causes. Admission and schema validation remain with the caller.
 * @category utilities
 * @since 0.0.0
 */
export const readObservationHttpText = Effect.fn("AiMetrics.readObservationHttpText")(function* <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
  byteLimit: number,
  timeout: Duration.Input
) {
  const bytes = yield* readObservationHttpBytes(stream, byteLimit).pipe(
    Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(observationHttpBodyFailure("timed-out")) })
  );
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => observationHttpBodyFailure("malformed"),
  });
});

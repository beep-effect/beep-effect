/**
 * A module containing utilities for working with `effect/Stream`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, flow, Stream } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

/**
 * Splits a text stream into lines, decodes each line as JSON with `schema`,
 * and emits only the successfully decoded values.
 *
 * Invalid JSON lines and schema decode failures are filtered out rather than
 * failing the stream.
 *
 * Supports both call styles:
 * - Data-last: `pipe(stream, streamFilterJson(schema))`
 * - Data-first: `streamFilterJson(stream, schema)`
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 * import * as S from "effect/Schema"
 * import { streamFilterJson } from "@beep/utils/Stream"
 *
 * const program = Stream.make("1\n", "nope\n", "2\n").pipe(
 *   streamFilterJson(S.Finite),
 *   Stream.runCollect
 * )
 *
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @param self - The stream of JSON lines to decode.
 * @param schema - The schema used to decode each JSON line.
 * @returns A stream that emits only successfully decoded values.
 * @category utilities
 * @since 0.0.0
 */
export const streamFilterJson: {
  <const TSchema extends S.Top>(
    schema: TSchema
  ): <E, R>(self: Stream.Stream<string, E, R>) => Stream.Stream<TSchema["Type"], E, R | TSchema["DecodingServices"]>;
  <const TSchema extends S.Top, E, R>(
    self: Stream.Stream<string, E, R>,
    schema: TSchema
  ): Stream.Stream<TSchema["Type"], E, R | TSchema["DecodingServices"]>;
} = dual(
  2,
  <const TSchema extends S.Top, E, R>(
    self: Stream.Stream<string, E, R>,
    schema: TSchema
  ): Stream.Stream<TSchema["Type"], E, R | TSchema["DecodingServices"]> => {
    const fromString = S.fromJsonString(schema);
    const decode = S.decodeEffect(fromString);

    return flow(Stream.splitLines, Stream.filterMapEffect(flow(decode, Effect.result)))(self);
  }
);

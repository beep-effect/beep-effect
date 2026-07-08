/**
 * JSON-string schema codec helpers for the repo CLI.
 *
 * Command groups repeatedly pair `S.decodeUnknownEffect(S.fromJsonString(X))`
 * with `S.encodeUnknownEffect(S.fromJsonString(X))` (13 such pairs in the Corpus
 * schemas alone). {@link JsonStringCodec} collapses that pair into one bundle so
 * a schema's JSON boundary is declared once, and {@link decodeOrFail} adds the
 * one combinator that turns a JSON `SchemaError` into a caller-owned domain
 * error at a boundary.
 *
 * `@beep/schema`'s {@link https://npmjs.com/@beep/schema | SchemaUtils} carries
 * `withCodecStatics` (guard + unknown decoders), but that operates on already
 * parsed unknown values, not JSON text — so it is not an equivalent and this
 * module is the JSON-string owner.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as O from "effect/Option";

/**
 * Effect codecs for a schema's JSON-string boundary.
 *
 * @typeParam Sch - Schema whose decoded type crosses the JSON boundary.
 * @category models
 * @since 0.0.0
 */
export interface JsonStringCodec<Sch extends S.Codec<unknown, unknown>> {
  /**
   * Decode JSON text into the schema type, failing with a `SchemaError` on
   * malformed JSON or a schema mismatch.
   *
   * @since 0.0.0
   */
  readonly decode: (text: string) => Effect.Effect<Sch["Type"], S.SchemaError>;
  /**
   * Decode JSON text into an `Option`, yielding `None` on any failure. Use at
   * soft boundaries where a malformed line is dropped rather than raised.
   *
   * @since 0.0.0
   */
  readonly decodeOption: (text: string) => O.Option<Sch["Type"]>;
  /**
   * Encode the schema type into compact JSON text.
   *
   * @since 0.0.0
   */
  readonly encode: (value: Sch["Type"]) => Effect.Effect<string, S.SchemaError>;
}

/**
 * Build the {@link JsonStringCodec} for a schema, collapsing the
 * decode/encode-through-`fromJsonString` pair into one value.
 *
 * @param schema - Schema whose JSON-string boundary is declared.
 * @returns Decode (`Effect`/`Option`) and encode helpers over JSON text.
 * @example
 * ```ts
 * import { JsonStringCodec } from "@beep/repo-cli/internal/schema/JsonCodec"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Point = S.Struct({ x: S.Finite, y: S.Finite })
 * const codec = JsonStringCodec(Point)
 * const roundTrip = codec.encode({ x: 1, y: 2 }).pipe(Effect.flatMap(codec.decode))
 * console.log(Effect.runSync(roundTrip))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const JsonStringCodec = <Sch extends S.Codec<unknown, unknown>>(schema: Sch): JsonStringCodec<Sch> => {
  const json = S.fromJsonString(schema);
  return {
    decode: S.decodeUnknownEffect(json),
    decodeOption: S.decodeUnknownOption(json),
    encode: S.encodeUnknownEffect(json),
  };
};

/**
 * Decode JSON text through a schema, mapping any `SchemaError` to a caller-owned
 * error at the boundary.
 *
 * Dual: data-first `decodeOrFail(schema, toError)` or data-last
 * `decodeOrFail(toError)(schema)`.
 *
 * @param schema - Schema to decode the JSON text into.
 * @param toError - Maps a JSON/schema decode failure into the domain error.
 * @returns A decoder from JSON text to the schema type in the caller's error channel.
 * @example
 * ```ts
 * import { decodeOrFail } from "@beep/repo-cli/internal/schema/JsonCodec"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Config = S.Struct({ port: S.Finite })
 * const decode = decodeOrFail(Config, (error) => new Error(`bad config: ${error.message}`))
 * console.log(Effect.runSync(decode('{ "port": 8080 }')))
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const decodeOrFail: {
  <Sch extends S.Codec<unknown, unknown>, E>(
    schema: Sch,
    toError: (error: S.SchemaError) => E
  ): (text: string) => Effect.Effect<Sch["Type"], E>;
  <Sch extends S.Codec<unknown, unknown>, E>(
    toError: (error: S.SchemaError) => E
  ): (schema: Sch) => (text: string) => Effect.Effect<Sch["Type"], E>;
} = dual(
  2,
  <Sch extends S.Codec<unknown, unknown>, E>(
    schema: Sch,
    toError: (error: S.SchemaError) => E
  ): ((text: string) => Effect.Effect<Sch["Type"], E>) => {
    const decode = S.decodeUnknownEffect(S.fromJsonString(schema));
    return (text) => decode(text).pipe(Effect.mapError(toError));
  }
);

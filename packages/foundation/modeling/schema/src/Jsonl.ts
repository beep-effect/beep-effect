/**
 * JSONL parsing and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import { Effect, flow, pipe, SchemaGetter, SchemaIssue } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isNonNegative } from "./Number.ts";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Jsonl");
const JsonlValues = S.Array(S.Unknown).pipe(S.toType);
const decodeJsonlValues = S.decodeUnknownEffect(JsonlValues);

class JsonlChunkParseError extends S.Class<JsonlChunkParseError>($I`JsonlChunkParseError`)({
  message: S.String,
}) {}

class JsonlChunkParseResult extends S.Class<JsonlChunkParseResult>($I`JsonlChunkParseResult`)({
  done: S.Boolean,
  error: S.NullOr(JsonlChunkParseError),
  read: S.Int.check(isNonNegative),
  values: S.Unknown,
}) {}

const decodeJsonlChunkParseResult = S.decodeUnknownEffect(JsonlChunkParseResult);
type JsonlParseChunk = (content: string) => unknown;

const encodeUnsupported = (): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue({
      message: "Encoding unknown values to JSONL text is not supported by JsonlTextToUnknown.",
    })
  );

const invalidJsonlInput = (message: string): SchemaIssue.InvalidValue =>
  new SchemaIssue.InvalidValue({
    message,
  });

const getJsonlParseChunk = (): O.Option<JsonlParseChunk> => {
  const bunRuntime = Reflect.get(globalThis, "Bun");
  const jsonl = P.isObject(bunRuntime) ? Reflect.get(bunRuntime, "JSONL") : undefined;
  const parseChunk = P.isObject(jsonl) ? Reflect.get(jsonl, "parseChunk") : undefined;
  if (P.isFunction(parseChunk)) {
    const parseJsonlChunk: JsonlParseChunk = (content) => parseChunk(content);
    return O.some(parseJsonlChunk);
  }
  return O.none();
};

const decodeJsonlUnknown = Effect.fn("Jsonl.decodeJsonlUnknown")(function* (content: string) {
  const parseChunk = yield* Effect.fromOption(getJsonlParseChunk(), () =>
    invalidJsonlInput("Bun.JSONL.parseChunk is unavailable in the current runtime.")
  );
  const parsed = yield* Effect.try({
    try: () => parseChunk(content),
    catch: (cause) =>
      invalidJsonlInput(P.isError(cause) ? `Invalid JSONL input (${cause.message}).` : "Invalid JSONL input."),
  });
  const chunk = yield* decodeJsonlChunkParseResult(parsed).pipe(
    Effect.mapError(() => invalidJsonlInput("Invalid JSONL input (Unexpected parser response shape)."))
  );

  if (chunk.error !== null) {
    return yield* Effect.fail(invalidJsonlInput(`Invalid JSONL input (${chunk.error.message}).`));
  }

  const trailingRemainder = pipe(content, Str.substring(chunk.read), Str.trim);

  if (!chunk.done || !Str.isEmpty(trailingRemainder)) {
    return yield* Effect.fail(
      invalidJsonlInput(`Invalid JSONL input (Incomplete JSONL input after ${chunk.read} characters).`)
    );
  }

  return yield* decodeJsonlValues(chunk.values).pipe(
    Effect.mapError(() => invalidJsonlInput("Invalid JSONL input (Expected JSONL value array output)."))
  );
});

/**
 * Schema transformation that decodes JSONL (JSON Lines) text into an array of
 * parsed values using `Bun.JSONL.parseChunk`.
 *
 * **Example** (Decode JSONL text values)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { JsonlTextToUnknown } from "@beep/schema/Jsonl"
 *
 * const program = S.decodeUnknownEffect(JsonlTextToUnknown)('{"a":1}\n')
 * const values = await Effect.runPromise(program)
 * console.log(values.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const JsonlTextToUnknown = S.String.pipe(
  S.decodeTo(JsonlValues, {
    decode: SchemaGetter.transformOrFail(decodeJsonlUnknown),
    encode: SchemaGetter.transformOrFail(encodeUnsupported),
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
  })),
  $I.annoteSchema("JsonlTextToUnknown", {
    description: "Schema transformation that parses strict JSONL text into unknown values.",
  })
);

/**
 * {@inheritDoc JsonlTextToUnknown}
 * @category models
 * @since 0.0.0
 */
export type JsonlTextToUnknown = typeof JsonlTextToUnknown.Type;

/**
 * Builds a decoder that parses JSONL text and then decodes the resulting value
 * array through a target schema.
 *
 * **Example** (Decode JSONL through schema)
 *
 * ```ts import.meta.vitest name="Decode JSONL through schema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeJsonlTextAs } from "@beep/schema/Jsonl"
 *
 * const Row = S.Struct({ a: S.Finite })
 * const decodeRows = decodeJsonlTextAs(S.Array(Row))
 *
 * const program = decodeRows('{"a":1}\n')
 * const rows = await Effect.runPromise(program)
 * rows[0]?.a // => 1
 * ```
 *
 * @param schema - Target schema to decode the parsed JSONL value array into.
 * @returns Decoder function from JSONL text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeJsonlTextAs = <Schema extends S.Top>(schema: Schema) => {
  const decodeTargetSchema = S.decodeUnknownEffect(schema);
  const decodeTarget = Effect.fnUntraced(function* (input: Parameters<typeof decodeTargetSchema>[0]) {
    return yield* decodeTargetSchema(input);
  });

  return flow(JsonlTextToUnknown.decodeUnknownEffect, Effect.flatMap(decodeTarget));
};

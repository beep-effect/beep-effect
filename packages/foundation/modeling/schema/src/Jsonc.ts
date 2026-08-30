/**
 * JSONC parsing and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, flow, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";
import { isNonNegative } from "./Number.ts";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Jsonc");

/**
 * Typed representation of a single JSONC parse diagnostic produced by `jsonc-parser`.
 *
 * **Example** (Decode parse diagnostic object)
 *
 * ```ts import.meta.vitest name="Decode parse diagnostic object"
 * import { JsoncParseDiagnostic } from "@beep/schema/Jsonc"
 * import * as S from "effect/Schema"
 *
 * const diag = S.decodeUnknownSync(JsoncParseDiagnostic)({ code: 1, offset: 0, length: 1 })
 * diag.code // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncParseDiagnostic extends S.Class<JsoncParseDiagnostic>($I`JsoncParseDiagnostic`)(
  {
    code: S.Int.check(isNonNegative),
    offset: S.Int.check(isNonNegative),
    length: S.Int.check(isNonNegative),
  },
  $I.annote("JsoncParseDiagnostic", {
    description: "Single JSONC parse diagnostic produced by jsonc-parser.",
  })
) {}

const encodeUnsupported = (): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue({
      message: "Encoding unknown values to JSONC text is not supported by JsoncTextToUnknown.",
    })
  );

const decodeJsoncUnknown = Effect.fn("Jsonc.decodeJsoncUnknown")(function* (content: string) {
  const parseErrors = A.empty<jsonc.ParseError>();
  const parsed = jsonc.parse(content, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  return yield* A.match(parseErrors, {
    onEmpty: () => Effect.succeed(parsed),
    onNonEmpty: (errors) =>
      Effect.fail(
        new SchemaIssue.InvalidValue({
          message: pipe(
            errors,
            A.map((error) => `${jsonc.printParseErrorCode(error.error)}@${error.offset}:${error.length}`),
            A.join(", "),
            (details) => `Invalid JSONC input (${details}).`
          ),
        })
      ),
  });
});

/**
 * Schema transformation that decodes a JSONC string (JSON with comments and
 * trailing commas) into an unknown parsed value.
 *
 * **Example** (Decode JSONC text to unknown)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { JsoncTextToUnknown } from "@beep/schema/Jsonc"
 *
 * const program = S.decodeUnknownEffect(JsoncTextToUnknown)('{ "port": 8080 }')
 * const parsed = await Effect.runPromise(program)
 * console.log(parsed)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const JsoncTextToUnknown = S.String.pipe(
  S.decodeTo(
    S.Unknown,
    SchemaTransformation.transformOrFail({
      decode: decodeJsoncUnknown,
      encode: encodeUnsupported,
    })
  ),
  SchemaUtils.withExitCodecStatics,
  $I.annoteSchema("JsoncTextToUnknown", {
    description: "Schema transformation that parses JSONC text into unknown values.",
  })
);

/**
 * {@inheritDoc JsoncTextToUnknown}
 * @category models
 * @since 0.0.0
 */
export type JsoncTextToUnknown = typeof JsoncTextToUnknown.Type;

/**
 * Builds a decoder that parses JSONC text and then decodes the result through a
 * target schema.
 *
 * **Example** (Decode JSONC into schema)
 *
 * ```ts import.meta.vitest name="Decode JSONC into schema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeJsoncTextAs } from "@beep/schema/Jsonc"
 *
 * const Config = S.Struct({ port: S.Finite, host: S.String })
 * const decodeConfig = decodeJsoncTextAs(Config)
 *
 * const program = decodeConfig('{ "port": 8080, "host": "localhost" }')
 * const config = await Effect.runPromise(program)
 * config.port // => 8080
 * ```
 *
 * @param schema - Target schema to decode parsed JSONC document into.
 * @returns Decoder function from JSONC text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeJsoncTextAs = <Schema extends S.Top>(schema: Schema) => {
  const decodeJsoncUnknownText = S.decodeUnknownEffect(JsoncTextToUnknown);
  const decodeTargetSchema = S.decodeUnknownEffect(schema);
  const decodeTarget = Effect.fnUntraced(function* (input: Parameters<typeof decodeTargetSchema>[0]) {
    return yield* decodeTargetSchema(input);
  });

  return flow(decodeJsoncUnknownText, Effect.flatMap(decodeTarget));
};

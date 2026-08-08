/**
 * Optional-key schema helper that decodes absence as `undefined`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { SchemaGetter } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("SchemaUtils/optional");

/**
 * Creates an optional encoded object key whose decoded value may be
 * `undefined`.
 *
 * **Details**
 *
 * Use this for wire objects where absent fields should stay as plain
 * `T | undefined` values in the decoded model. Prefer
 * `S.OptionFromOptionalKey` when the decoded domain should carry an explicit
 * `Option`.
 *
 * **Example** (Optional key decoding to undefined)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { optional } from "@beep/schema/SchemaUtils/optional"
 *
 * const Patch = S.Struct({
 *   file: optional(S.String)
 * })
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Patch)({}))
 * console.log(decoded.file) // undefined
 * ```
 *
 * @typeParam TSchema - Schema used when the optional key is present.
 * @param schema - Schema used to decode and encode present values.
 * @returns A schema for an optional encoded key with `undefined` as decoded absence.
 * @category constructors
 * @since 0.0.0
 */
export const optional = <const TSchema extends S.Top>(schema: TSchema) =>
  S.optionalKey(schema).pipe(
    S.decodeTo(schema.pipe(S.optional, S.toType), {
      decode: SchemaGetter.passthrough({ strict: false }),
      encode: SchemaGetter.transformOptional(O.filter(P.isNotUndefined)),
    }),
    $I.annoteSchema("optional", {
      description: "Optional encoded object key that decodes absence as undefined.",
    })
  );

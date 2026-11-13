/**
 * Building blocks shared by the projections that turn a type descriptor known only at runtime into a codec.
 *
 * **Details**
 *
 * Property types, action parameter types, query data types and agent
 * parameter types each project to a codec of their values. The projections
 * differ in their universes and agree on how a set, a struct and a record of
 * named arguments are built; those three constructions live here. Their static
 * types are loose (`unknown`) because the descriptor they are built from is
 * data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

/**
 * The codec of a set: a JSON array on the wire and a `HashSet` in the domain, so duplicates on the wire collapse.
 *
 * **Example** (Decode a JSON array to a HashSet)
 *
 * ```ts import.meta.vitest name="Decode a JSON array to a HashSet"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 * import { hashSetCodec } from "@beep/scratchpad/osdk/src/internal/ProjectedCodec"
 *
 * const tags = await Effect.runPromise(S.decodeUnknownEffect(hashSetCodec(S.String))(["alpha", "bravo", "alpha"]))
 * const size = HashSet.isHashSet(tags) ? HashSet.size(tags) : 0
 * size // => 2
 * ```
 *
 * @param element - The codec of one member of the set.
 * @returns A codec with the JSON array on the encoded side and the `HashSet` on the type side.
 * @category codecs
 * @since 0.0.0
 */
export const hashSetCodec = (element: S.Codec<unknown, unknown>): S.Codec<unknown, unknown> =>
  S.Array(element).pipe(
    S.decodeTo(
      element.pipe(S.toType, S.HashSet),
      SchemaTransformation.transform({
        decode: (members) => HashSet.fromIterable(members),
        encode: (members) => A.fromIterable(members),
      })
    )
  );

/**
 * The codec of a struct with the given named fields, or of a record with no keys when there are none.
 *
 * **Details**
 *
 * A struct schema with no fields accepts any non-null value, so a field-less
 * struct type projects to "a record with no keys" instead.
 *
 * **Example** (Refuse a key on a field-less struct)
 *
 * ```ts import.meta.vitest name="Refuse a key on a field-less struct"
 * import * as S from "effect/Schema"
 * import { structCodec } from "@beep/scratchpad/osdk/src/internal/ProjectedCodec"
 *
 * const empty = S.is(structCodec([]))
 * const named = S.is(structCodec([["city", S.String]]))
 * const verdicts = [empty({}), empty({ city: "NYC" }), named({ city: "NYC" }), named({})]
 * verdicts // => [true, false, true, false]
 * ```
 *
 * @param fields - The fields as name and codec pairs, in declaration order.
 * @returns A codec of the struct value.
 * @category codecs
 * @since 0.0.0
 */
export const structCodec = (
  fields: ReadonlyArray<readonly [name: string, codec: S.Codec<unknown, unknown>]>
): S.Codec<unknown, unknown> =>
  A.match(fields, {
    onEmpty: () => S.Record(S.String, S.Never),
    onNonEmpty: (declared) => S.Struct(R.fromEntries(declared)),
  });

/**
 * The codec of a record that holds the given fields and refuses every other key, in both directions.
 *
 * **Details**
 *
 * A plain struct drops a key it does not declare. A record of named arguments
 * must not: a misspelt argument is a mistake, and the platform refuses it as
 * well. The struct therefore keeps undeclared keys with a rest signature and a
 * check on the property names then rejects them.
 *
 * **Example** (Reject an undeclared argument instead of dropping it)
 *
 * ```ts import.meta.vitest name="Reject an undeclared argument instead of dropping it"
 * import * as S from "effect/Schema"
 * import { closedRecordCodec } from "@beep/scratchpad/osdk/src/internal/ProjectedCodec"
 *
 * const accepts = S.is(closedRecordCodec({ employeeId: S.Finite }))
 * const verdicts = [accepts({ employeeId: 50030 }), accepts({ employeeId: 50030, salary: 100 }), accepts({})]
 * verdicts // => [true, false, false]
 * ```
 *
 * @param fields - The declared fields, keyed by name.
 * @returns A codec of the record, keyed by field name.
 * @category codecs
 * @since 0.0.0
 */
export const closedRecordCodec = (
  fields: Readonly<Record<string, S.Codec<unknown, unknown>>>
): S.Codec<Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>>> =>
  S.StructWithRest(S.Struct(fields), [S.Record(S.String, S.Unknown)]).check(
    S.isPropertyNames(
      A.match(R.keys(fields), {
        onEmpty: () => S.Never,
        onNonEmpty: (declared) => S.Literals(declared),
      })
    )
  );

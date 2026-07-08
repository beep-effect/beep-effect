/**
 * Schemas and model-field helpers for working with `globalThis.Float64Array`
 * values.
 *
 * Use this module when the domain model should keep native `Float64Array`
 * instances, but JSON create and update payloads still need a plain array-of-
 * numbers representation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { Model } from "effect/unstable/schema";

const $I = $SchemaId.create("Float64Array");

/**
 * Schema that accepts native `Float64Array` instances.
 *
 * This is useful for internal boundaries that already operate on typed arrays
 * and only need runtime schema validation plus reusable schema metadata.
 *
 * @category validation
 * @since 0.0.0
 * @example
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float64Arr } from "@beep/schema/Float64Array";
 *
 * const decodeFloat64Array = S.decodeUnknownSync(Float64Arr);
 * const value = decodeFloat64Array(new Float64Array([1, 2, 3]));
 *
 * console.log(value.length); // 3
 * ```
 */
export const Float64Arr = S.instanceOf<globalThis.Float64ArrayConstructor, globalThis.Float64Array>(
  globalThis.Float64Array
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.array(fc.integer({ max: 1_000, min: -1_000 }), { maxLength: 8 }).map((values) => new Float64Array(values)),
  })
  .pipe(
    $I.annoteSchema("Float64Arr", {
      description: "A schema that validates native Float64Array instances.",
    })
  );

/**
 * Type for {@link Float64Arr}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float64Arr } from "@beep/schema/Float64Array";
 *
 * const value: Float64Arr = S.decodeUnknownSync(Float64Arr)(new Float64Array([1, 2, 3]));
 * console.log(value.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float64Arr = typeof Float64Arr.Type;

/**
 * Bidirectional schema that decodes arrays of numbers into `Float64Array`
 * values.
 *
 * Decoding allocates a new `Float64Array` from the provided numeric array.
 * Encoding converts the typed array back into a standard array of numbers so it
 * can be transported through JSON-friendly boundaries.
 *
 * @category validation
 * @since 0.0.0
 * @example
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float64ArrayFromArray } from "@beep/schema/Float64Array";
 *
 * const decodeFloat64Array = S.decodeUnknownSync(Float64ArrayFromArray);
 * const encodeFloat64Array = S.encodeSync(Float64ArrayFromArray);
 *
 * const value = decodeFloat64Array([0.5, 1.25, 2.75]);
 * const encoded = encodeFloat64Array(value);
 *
 * console.log(value instanceof Float64Array); // true
 * console.log(encoded); // [0.5, 1.25, 2.75]
 * ```
 */
export const Float64ArrayFromArray = S.Finite.pipe(
  S.Array,
  S.decodeTo(
    Float64Arr,
    SchemaTransformation.transform({
      decode: (values) => new globalThis.Float64Array(values),
      encode: A.fromIterable,
    })
  ),
  $I.annoteSchema("Float64ArrayFromArray", {
    description:
      "A bidirectional schema that decodes numeric arrays into Float64Array values and encodes Float64Array values back to arrays.",
  })
);

/**
 * Type for {@link Float64ArrayFromArray}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float64ArrayFromArray } from "@beep/schema/Float64Array";
 *
 * const value: Float64ArrayFromArray = S.decodeUnknownSync(Float64ArrayFromArray)([0.5, 1.25, 2.75]);
 * console.log(value instanceof Float64Array); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float64ArrayFromArray = typeof Float64ArrayFromArray.Type;

/**
 * Namespace members for {@link Float64ArrayFromArray}.
 *
 * @example
 * ```ts
 * import { type Float64ArrayFromArray } from "@beep/schema/Float64Array";
 *
 * const payload: Float64ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
 * console.log(payload.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Float64ArrayFromArray {
  /**
   * Encoded representation accepted by {@link Float64ArrayFromArray}.
   *
   * This stays as a plain array of numbers so JSON payloads can represent
   * typed-array content without a custom wire format.
   *
   * @category models
   * @since 0.0.0
   * @example
   * ```ts
   * import { type Float64ArrayFromArray } from "@beep/schema/Float64Array";
   *
   * const payload: Float64ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
   *
   * console.log(payload.length); // 3
   * ```
   */
  export type Encoded = typeof Float64ArrayFromArray.Encoded;
}

/**
 * Model field helper for storing `Float64Array` values in variant-based model
 * schemas.
 *
 * Database-facing `insert` and `update` variants require native
 * `Float64Array` instances, while `jsonCreate` and `jsonUpdate` accept plain
 * numeric arrays through {@link Float64ArrayFromArray}. This field does not
 * define a `json` variant, allowing read-side JSON serialization to be chosen
 * explicitly by the surrounding model.
 *
 * @example
 * ```ts
 * import { Float64ArrayField } from "@beep/schema/Float64Array";
 * import * as S from "effect/Schema";
 *
 * console.log(S.isSchema(Float64ArrayField.schemas.insert));
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Float64ArrayField = Model.Field({
  insert: Float64Arr,
  update: Float64Arr,
  jsonCreate: Float64ArrayFromArray,
  jsonUpdate: Float64ArrayFromArray,
});

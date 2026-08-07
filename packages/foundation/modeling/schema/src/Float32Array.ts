/**
 * Schemas and model-field helpers for working with `globalThis.Float32Array`
 * values.
 *
 * Use this module when the domain model should keep native `Float32Array`
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

const $I = $SchemaId.create("Float32Array");

/**
 * Schema that accepts native `Float32Array` instances.
 *
 * **Details**
 *
 * This is useful for internal boundaries that already operate on typed arrays
 * and only need runtime schema validation plus reusable schema metadata.
 *
 * **Example** (Decode native Float32Array)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float32Arr } from "@beep/schema/Float32Array";
 *
 * const decodeFloat32Array = S.decodeUnknownSync(Float32Arr);
 * const value = decodeFloat32Array(new Float32Array([1, 2, 3]));
 *
 * console.log(value.length); // 3
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Float32Arr = S.instanceOf<globalThis.Float32ArrayConstructor, globalThis.Float32Array>(
  globalThis.Float32Array
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.array(fc.integer({ max: 1_000, min: -1_000 }), { maxLength: 8 }).map((values) => new Float32Array(values)),
  })
  .pipe(
    $I.annoteSchema("Float32Arr", {
      description: "A schema that validates native Float32Array instances.",
    })
  );

/**
 * Type for {@link Float32Arr}.
 *
 * **Example** (Type decoded Float32Array)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float32Arr } from "@beep/schema/Float32Array";
 *
 * const value: Float32Arr = S.decodeUnknownSync(Float32Arr)(new Float32Array([1, 2, 3]));
 * console.log(value.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float32Arr = typeof Float32Arr.Type;

/**
 * Bidirectional schema that decodes arrays of numbers into `Float32Array`
 * values.
 *
 * **Details**
 *
 * Decoding allocates a new `Float32Array` from the provided numeric array.
 * Encoding converts the typed array back into a standard array of numbers so it
 * can be transported through JSON-friendly boundaries.
 *
 * **Example** (Decode and encode arrays)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float32ArrayFromArray } from "@beep/schema/Float32Array";
 *
 * const decodeFloat32Array = S.decodeUnknownSync(Float32ArrayFromArray);
 * const encodeFloat32Array = S.encodeSync(Float32ArrayFromArray);
 *
 * const value = decodeFloat32Array([0.5, 1.25, 2.75]);
 * const encoded = encodeFloat32Array(value);
 *
 * console.log(value instanceof Float32Array); // true
 * console.log(encoded); // [0.5, 1.25, 2.75]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Float32ArrayFromArray = S.Finite.pipe(
  S.Array,
  S.decodeTo(
    Float32Arr,
    SchemaTransformation.transform({
      decode: (values) => new globalThis.Float32Array(values),
      encode: A.fromIterable,
    })
  ),
  $I.annoteSchema("Float32ArrayFromArray", {
    description:
      "A bidirectional schema that decodes numeric arrays into Float32Array values and encodes Float32Array values back to arrays.",
  })
);

/**
 * Type for {@link Float32ArrayFromArray}.
 *
 * **Example** (Type decoded Float32Array)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float32ArrayFromArray } from "@beep/schema/Float32Array";
 *
 * const value: Float32ArrayFromArray = S.decodeUnknownSync(Float32ArrayFromArray)([0.5, 1.25, 2.75]);
 * console.log(value instanceof Float32Array); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float32ArrayFromArray = typeof Float32ArrayFromArray.Type;

/**
 * Namespace members for {@link Float32ArrayFromArray}.
 *
 * **Example** (Use Encoded payload type)
 *
 * ```ts
 * import { type Float32ArrayFromArray } from "@beep/schema/Float32Array";
 *
 * const payload: Float32ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
 * console.log(payload.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Float32ArrayFromArray {
  /**
   * Encoded representation accepted by {@link Float32ArrayFromArray}.
   *
   * **Details**
   *
   * This stays as a plain array of numbers, so JSON payloads can represent
   * typed-array content without a custom wire format.
   *
   * **Example** (Declare encoded number array)
   *
   * ```ts
   * import { type Float32ArrayFromArray } from "@beep/schema/Float32Array";
   *
   * const payload: Float32ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
   *
   * console.log(payload.length); // 3
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof Float32ArrayFromArray.Encoded;
}

/**
 * Model field helper for storing `Float32Array` values in variant-based model
 * schemas.
 *
 * **Details**
 *
 * Database-facing `insert` and `update` variants require native
 * `Float32Array` instances, while `jsonCreate` and `jsonUpdate` accept plain
 * numeric arrays through {@link Float32ArrayFromArray}. This field does not
 * define a `json` variant, allowing read-side JSON serialization to be chosen
 * explicitly by the surrounding model.
 *
 * **Example** (Access insert field schema)
 *
 * ```ts
 * import { Float32ArrayField } from "@beep/schema/Float32Array";
 * import * as S from "effect/Schema";
 *
 * console.log(S.isSchema(Float32ArrayField.schemas.insert));
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Float32ArrayField = Model.Field({
  insert: Float32Arr,
  update: Float32Arr,
  jsonCreate: Float32ArrayFromArray,
  jsonUpdate: Float32ArrayFromArray,
});

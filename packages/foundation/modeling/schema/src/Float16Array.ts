/**
 * Schemas and model-field helpers for working with `globalThis.Float16Array`
 * values.
 *
 * Use this module when the domain model should keep native `Float16Array`
 * instances, but JSON create and update payloads still need a plain array-of-
 * numbers representation.
 *
 * This module requires a runtime that exposes `globalThis.Float16Array`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { SchemaTransformation } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Model } from "effect/unstable/schema";

const $I = $SchemaId.create("Float16Array");
const float16ArrayConstructor = globalThis.Float16Array;
const unsupportedFloat16ArrayRuntimeMessage =
  "Float16Array is not available in this runtime. Use Node >=24.0.0 or Bun >=1.1.23.";

class UnsupportedFloat16ArrayRuntimeError extends S.TaggedError<UnsupportedFloat16ArrayRuntimeError>(
  $I`UnsupportedFloat16ArrayRuntimeError`
)(
  "UnsupportedFloat16ArrayRuntimeError",
  {
    message: S.String,
  },
  $I.annote("UnsupportedFloat16ArrayRuntimeError", {
    description: "Float16Array helpers were used in a runtime that does not expose globalThis.Float16Array.",
  })
) {}

const unsupportedFloat16ArrayRuntime = (): never => {
  throw UnsupportedFloat16ArrayRuntimeError.make({
    message: unsupportedFloat16ArrayRuntimeMessage,
  });
};

/**
 * Float16Array type guard.
 *
 * **Example** (Type guard usage)
 *
 * ```ts
 * import { isFloat16Array } from "@beep/schema/Float16Array";
 *
 * const value = new Float16Array([1, 2, 3]);
 * console.log(isFloat16Array(value));
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isFloat16Array = (u: unknown): u is Float16Array<ArrayBufferLike> =>
  P.isNotUndefined(float16ArrayConstructor) && u instanceof float16ArrayConstructor;

/**
 * Schema that accepts native `Float16Array` instances.
 *
 * **Details**
 *
 * This is useful for internal boundaries that already operate on typed arrays
 * and only need runtime schema validation plus reusable schema metadata.
 *
 * **Example** (Decode native Float16Array)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float16Arr } from "@beep/schema/Float16Array";
 *
 * const decodeFloat16Array = S.decodeUnknownSync(Float16Arr);
 * const value = decodeFloat16Array(new Float16Array([1, 2, 3]));
 *
 * console.log(value.length); // 3
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Float16Arr = S.declare(isFloat16Array)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .array(fc.integer({ max: 1_000, min: -1_000 }), { maxLength: 8 })
        .map((values) =>
          P.isUndefined(float16ArrayConstructor)
            ? unsupportedFloat16ArrayRuntime()
            : (new float16ArrayConstructor(values) as Float16Array<ArrayBufferLike>)
        ),
  })
  .pipe(
    $I.annoteSchema("Float16Arr", {
      description: "A schema that validates native Float16Array instances.",
    })
  );

/**
 * Type for {@link Float16Arr}.
 *
 * **Example** (Typed decoded value)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float16Arr } from "@beep/schema/Float16Array";
 *
 * const value: Float16Arr = S.decodeUnknownSync(Float16Arr)(new Float16Array([1, 2, 3]));
 * console.log(value.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float16Arr = typeof Float16Arr.Type;

/**
 * Bidirectional schema that decodes arrays of numbers into `Float16Array`
 * values.
 *
 * **Details**
 *
 * Decoding allocates a new `Float16Array` from the provided numeric array.
 * Encoding converts the typed array back into a standard array of numbers so it
 * can be transported through JSON-friendly boundaries.
 *
 * **Example** (Decode and encode arrays)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float16ArrayFromArray } from "@beep/schema/Float16Array";
 *
 * const decodeFloat16Array = S.decodeUnknownSync(Float16ArrayFromArray);
 * const encodeFloat16Array = S.encodeSync(Float16ArrayFromArray);
 *
 * const value = decodeFloat16Array([0.5, 1.25, 2.75]);
 * const encoded = encodeFloat16Array(value);
 *
 * console.log(value instanceof Float16Array); // true
 * console.log(encoded); // [0.5, 1.25, 2.75]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Float16ArrayFromArray = S.Finite.pipe(
  S.Array,
  S.decodeTo(
    Float16Arr,
    SchemaTransformation.transform({
      decode: (values) =>
        P.isUndefined(float16ArrayConstructor)
          ? unsupportedFloat16ArrayRuntime()
          : (new float16ArrayConstructor(values) as Float16Array<ArrayBufferLike>),
      encode: A.fromIterable,
    })
  ),
  $I.annoteSchema("Float16ArrayFromArray", {
    description:
      "A bidirectional schema that decodes numeric arrays into Float16Array values and encodes Float16Array values back to arrays.",
  })
);

/**
 * Type for {@link Float16ArrayFromArray}.
 *
 * **Example** (Typed decoded Float16Array)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { Float16ArrayFromArray } from "@beep/schema/Float16Array";
 *
 * const value: Float16ArrayFromArray = S.decodeUnknownSync(Float16ArrayFromArray)([0.5, 1.25, 2.75]);
 * console.log(value instanceof Float16Array); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Float16ArrayFromArray = typeof Float16ArrayFromArray.Type;

/**
 * Namespace members for {@link Float16ArrayFromArray}.
 *
 * **Example** (Encoded payload type)
 *
 * ```ts
 * import { type Float16ArrayFromArray } from "@beep/schema/Float16Array";
 *
 * const payload: Float16ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
 * console.log(payload.length); // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Float16ArrayFromArray {
  /**
   * Encoded representation accepted by {@link Float16ArrayFromArray}.
   *
   * **Details**
   *
   * This stays as a plain array of numbers so JSON payloads can represent
   * typed-array content without a custom wire format.
   *
   * **Example** (Plain number array payload)
   *
   * ```ts
   * import { type Float16ArrayFromArray } from "@beep/schema/Float16Array";
   *
   * const payload: Float16ArrayFromArray.Encoded = [0.5, 1.25, 2.75];
   *
   * console.log(payload.length); // 3
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof Float16ArrayFromArray.Encoded;
}

/**
 * Model field helper for storing `Float16Array` values in variant-based model
 * schemas.
 *
 * **Details**
 *
 * Database-facing `insert` and `update` variants require native
 * `Float16Array` instances, while `jsonCreate` and `jsonUpdate` accept plain
 * numeric arrays through {@link Float16ArrayFromArray}. This field does not
 * define a `json` variant, allowing read-side JSON serialization to be chosen
 * explicitly by the surrounding model.
 *
 * **Example** (Check insert schema)
 *
 * ```ts
 * import { Float16ArrayField } from "@beep/schema/Float16Array";
 * import * as S from "effect/Schema";
 *
 * console.log(S.isSchema(Float16ArrayField.schemas.insert));
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Float16ArrayField = Model.Field({
  insert: Float16Arr,
  update: Float16Arr,
  jsonCreate: Float16ArrayFromArray,
  jsonUpdate: Float16ArrayFromArray,
});

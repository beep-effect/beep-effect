/**
 * Schema fields that attach the same default value for constructor
 * creation and missing-key decoding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { $SchemaId } from "../internal/SchemaId.ts";

const $I = $SchemaId.create("SchemaUtils/withKeyDefaults");

/**
 * Boolean schema field that defaults constructor input and missing keys to
 * `false`.
 *
 * **Example** (Visible defaults to false)
 *
 * ```ts import.meta.vitest name="Visible defaults to false"
 * import * as S from "effect/Schema"
 * import { BoolKeyDefaultFalse } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Settings = S.Struct({ visible: BoolKeyDefaultFalse })
 *
 * S.decodeUnknownSync(Settings)({}).visible // => false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolKeyDefaultFalse = S.Boolean.pipe(
  S.withConstructorDefault(Effect.succeed(false)),
  S.withDecodingDefaultTypeKey(Effect.succeed(false)),
  $I.annoteSchema("BoolKeyDefaultFalse", {
    description: "Boolean schema field that defaults constructor input and missing keys to false.",
  })
);

/**
 * {@inheritDoc BoolKeyDefaultFalse}
 * @category models
 * @since 0.0.0
 */
export type BoolKeyDefaultFalse = typeof BoolKeyDefaultFalse.Type;

/**
 * Boolean schema field that defaults constructor input and missing keys to
 * `true`.
 *
 * **Example** (Enabled defaults to true)
 *
 * ```ts import.meta.vitest name="Enabled defaults to true"
 * import * as S from "effect/Schema"
 * import { BoolKeyDefaultTrue } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Settings = S.Struct({ enabled: BoolKeyDefaultTrue })
 *
 * S.decodeUnknownSync(Settings)({}).enabled // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolKeyDefaultTrue = S.Boolean.pipe(
  S.withConstructorDefault(Effect.succeed(true)),
  S.withDecodingDefaultTypeKey(Effect.succeed(true)),
  $I.annoteSchema("BoolKeyDefaultTrue", {
    description: "Boolean schema field that defaults constructor input and missing keys to true.",
  })
);

/**
 * {@inheritDoc BoolKeyDefaultTrue}
 * @category models
 * @since 0.0.0
 */
export type BoolKeyDefaultTrue = typeof BoolKeyDefaultTrue.Type;

/**
 * Builds an array field with an empty default for constructor input and missing
 * encoded keys, preserving the element schema's transformations and services.
 *
 * **Gotchas**
 *
 * An explicitly present `undefined` is rejected during decoding. Encoding keeps
 * the array key, including when its value is empty.
 *
 * **Example** (Default a missing list)
 *
 * ```ts
 * import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const Settings = S.Struct({ tags: ArrayKeyDefaultEmpty(S.String) })
 * const settings = Settings.make({})
 * console.log(settings.tags) // []
 * Effect.runPromise(S.decodeUnknownEffect(Settings)({})).then(console.log)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ArrayKeyDefaultEmpty = <Element extends S.Constraint>(element: Element) =>
  S.Array(element).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<Element["Type"]>())),
    S.withDecodingDefaultKey(Effect.succeed(A.empty<Element["Encoded"]>())),
    $I.annoteSchema("ArrayKeyDefaultEmpty", {
      description: "Array field defaulting constructor input and missing encoded keys to an empty array.",
    })
  );

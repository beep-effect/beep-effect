/**
 * Boolean schema fields that attach the same default value for constructor
 * creation and missing-key decoding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("SchemaUtils/withKeyDefaults");

/**
 * Create a boolean schema field with a shared constructor and missing-key
 * default.
 *
 * **Example** (Boolean field defaults to true)
 *
 * ```ts import.meta.vitest name="Boolean field defaults to true"
 * import * as S from "effect/Schema"
 * import { boolKeyWithDefault } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Enabled = boolKeyWithDefault(true)
 * const Settings = S.Struct({ enabled: Enabled })
 *
 * S.decodeUnknownSync(Settings)({}).enabled // => true
 * ```
 *
 * @param defaultValue - Boolean value used when constructing or decoding a
 * missing key.
 * @returns A boolean schema with constructor and decoding defaults applied.
 * @category constructors
 * @since 0.0.0
 */
export const boolKeyWithDefault = (defaultValue: boolean) =>
  S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(defaultValue)),
    S.withDecodingDefaultTypeKey(Effect.succeed(defaultValue))
  );

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
export const BoolKeyDefaultFalse = boolKeyWithDefault(false).pipe(
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
export const BoolKeyDefaultTrue = boolKeyWithDefault(true).pipe(
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

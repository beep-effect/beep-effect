/**
 * Experimental Box classification value-object schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("values/Classification/Classification.model");

/**
 * Experimental value object for Box classification metadata attached to governed content.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { Classification } from "@beep/box/experimental/domain/values/Classification/Classification.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Classification)({});
 * const encoded: Classification.Encoded = S.encodeSync(Classification)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class Classification extends S.Class<Classification>($I`Classification`)(
  {},
  $I.annote("Classification", {
    description: "Experimental value object for Box classification metadata attached to governed content.",
  })
) {}

/**
 * Type-level companion namespace for {@link Classification} encoded payloads.
 *
 * **Example** (Make and encode payload)
 *
 * ```ts
 * import { Classification } from "@beep/box/experimental/domain/values/Classification/Classification.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Classification.make({});
 * const encoded: Classification.Encoded = S.encodeSync(Classification)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Classification {
  /**
   * Encoded payload accepted by the {@link Classification} value-object schema.
   *
   * **Example** (Encode made Classification)
   *
   * ```ts
   * import { Classification } from "@beep/box/experimental/domain/values/Classification/Classification.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Classification.Encoded = S.encodeSync(Classification)(Classification.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Classification.Encoded;
}

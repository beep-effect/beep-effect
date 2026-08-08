/**
 * Experimental Box placeholder entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/PLACEHOLDER/PLACEHOLDER.model");

/**
 * Experimental placeholder entity schema retained until this generator slot is promoted to a named Box resource.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty schema)
 *
 * ```ts
 * import { PLACEHOLDER } from "@beep/box/experimental/domain/entities/PLACEHOLDER/PLACEHOLDER.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(PLACEHOLDER)({});
 * const encoded: PLACEHOLDER.Encoded = S.encodeSync(PLACEHOLDER)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class PLACEHOLDER extends S.Class<PLACEHOLDER>($I`PLACEHOLDER`)(
  {},
  $I.annote("PLACEHOLDER", {
    description:
      "Experimental placeholder entity schema retained until this generator slot is promoted to a named Box resource.",
  })
) {}

/**
 * Type-level companion namespace for {@link PLACEHOLDER} encoded payloads.
 *
 * **Example** (Make and encode PLACEHOLDER)
 *
 * ```ts
 * import { PLACEHOLDER } from "@beep/box/experimental/domain/entities/PLACEHOLDER/PLACEHOLDER.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = PLACEHOLDER.make({});
 * const encoded: PLACEHOLDER.Encoded = S.encodeSync(PLACEHOLDER)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PLACEHOLDER {
  /**
   * Encoded payload accepted by the {@link PLACEHOLDER} entity schema.
   *
   * **Example** (Encode PLACEHOLDER payload)
   *
   * ```ts
   * import { PLACEHOLDER } from "@beep/box/experimental/domain/entities/PLACEHOLDER/PLACEHOLDER.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: PLACEHOLDER.Encoded = S.encodeSync(PLACEHOLDER)(PLACEHOLDER.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PLACEHOLDER.Encoded;
}

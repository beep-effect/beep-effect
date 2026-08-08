/**
 * Experimental Box device pin entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/DevicePinner/DevicePinner.model");

/**
 * Experimental schema anchor for Box device pin records associated with managed users.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty payload)
 *
 * ```ts
 * import { DevicePinner } from "@beep/box/experimental/domain/entities/DevicePinner/DevicePinner";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(DevicePinner)({});
 * const encoded: DevicePinner.Encoded = S.encodeSync(DevicePinner)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class DevicePinner extends S.Class<DevicePinner>($I`DevicePinner`)(
  {},
  $I.annote("DevicePinner", {
    description: "Experimental schema anchor for Box device pin records associated with managed users.",
  })
) {}

/**
 * Type-level companion namespace for {@link DevicePinner} encoded payloads.
 *
 * **Example** (Make and encode instance)
 *
 * ```ts
 * import { DevicePinner } from "@beep/box/experimental/domain/entities/DevicePinner/DevicePinner";
 * import * as S from "effect/Schema";
 *
 * const decoded = DevicePinner.make({});
 * const encoded: DevicePinner.Encoded = S.encodeSync(DevicePinner)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevicePinner {
  /**
   * Encoded payload accepted by the {@link DevicePinner} entity schema.
   *
   * **Example** (Encode to Encoded type)
   *
   * ```ts
   * import { DevicePinner } from "@beep/box/experimental/domain/entities/DevicePinner/DevicePinner";
   * import * as S from "effect/Schema";
   *
   * const encoded: DevicePinner.Encoded = S.encodeSync(DevicePinner)(DevicePinner.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DevicePinner.Encoded;
}

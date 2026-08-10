/**
 * Experimental Box metadata value-object schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("entities/Metadata/Metadata.model");

/**
 * Experimental value object for Box metadata template instance data.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Metadata)
 *
 * ```ts
 * import { Metadata } from "@beep/box/experimental/domain/values/Metadata/Metadata.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Metadata)({});
 * const encoded: Metadata.Encoded = S.encodeSync(Metadata)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class Metadata extends S.Class<Metadata>($I`Metadata`)(
  {},
  $I.annote("Metadata", {
    description: "Experimental value object for Box metadata template instance data.",
  })
) {}

/**
 * Type-level companion namespace for {@link Metadata} encoded payloads.
 *
 * **Example** (Make and encode Metadata)
 *
 * ```ts
 * import { Metadata } from "@beep/box/experimental/domain/values/Metadata/Metadata.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Metadata.make({});
 * const encoded: Metadata.Encoded = S.encodeSync(Metadata)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Metadata {
  /**
   * Encoded payload accepted by the {@link Metadata} value-object schema.
   *
   * **Example** (Encode Metadata to Encoded)
   *
   * ```ts
   * import { Metadata } from "@beep/box/experimental/domain/values/Metadata/Metadata.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Metadata.Encoded = S.encodeSync(Metadata)(Metadata.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Metadata.Encoded;
}

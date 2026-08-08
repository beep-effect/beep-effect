/**
 * Experimental Box collaboration entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Collaboration/Collaboration.model");

/**
 * Experimental schema anchor for Box collaboration records linking principals to shared items.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { Collaboration } from "@beep/box/experimental/domain/entities/Collaboration/Collaboration.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Collaboration)({});
 * const encoded: Collaboration.Encoded = S.encodeSync(Collaboration)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Collaboration extends S.Class<Collaboration>($I`Collaboration`)(
  {},
  $I.annote("Collaboration", {
    description: "Experimental schema anchor for Box collaboration records linking principals to shared items.",
  })
) {}

/**
 * Type-level companion namespace for {@link Collaboration} encoded payloads.
 *
 * **Example** (Make and encode collaboration)
 *
 * ```ts
 * import { Collaboration } from "@beep/box/experimental/domain/entities/Collaboration/Collaboration.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Collaboration.make({});
 * const encoded: Collaboration.Encoded = S.encodeSync(Collaboration)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Collaboration {
  /**
   * Encoded payload accepted by the {@link Collaboration} entity schema.
   *
   * **Example** (Encode collaboration payload)
   *
   * ```ts
   * import { Collaboration } from "@beep/box/experimental/domain/entities/Collaboration/Collaboration.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Collaboration.Encoded = S.encodeSync(Collaboration)(Collaboration.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Collaboration.Encoded;
}

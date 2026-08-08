/**
 * Experimental Box restored trashed web link entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashWebLinkRestored/TrashWebLinkRestored.model");

/**
 * Experimental schema anchor for web link metadata returned when a trashed Box web link is restored.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty payload)
 *
 * ```ts
 * import { TrashWebLinkRestored } from "@beep/box/experimental/domain/entities/TrashWebLinkRestored/TrashWebLinkRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashWebLinkRestored)({});
 * const encoded: TrashWebLinkRestored.Encoded = S.encodeSync(TrashWebLinkRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashWebLinkRestored extends S.Class<TrashWebLinkRestored>($I`TrashWebLinkRestored`)(
  {},
  $I.annote("TrashWebLinkRestored", {
    description: "Experimental schema anchor for web link metadata returned when a trashed Box web link is restored.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashWebLinkRestored} encoded payloads.
 *
 * **Example** (Make and encode empty payload)
 *
 * ```ts
 * import { TrashWebLinkRestored } from "@beep/box/experimental/domain/entities/TrashWebLinkRestored/TrashWebLinkRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashWebLinkRestored.make({});
 * const encoded: TrashWebLinkRestored.Encoded = S.encodeSync(TrashWebLinkRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashWebLinkRestored {
  /**
   * Encoded payload accepted by the {@link TrashWebLinkRestored} entity schema.
   *
   * **Example** (Encode made entity payload)
   *
   * ```ts
   * import { TrashWebLinkRestored } from "@beep/box/experimental/domain/entities/TrashWebLinkRestored/TrashWebLinkRestored.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashWebLinkRestored.Encoded = S.encodeSync(TrashWebLinkRestored)(TrashWebLinkRestored.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashWebLinkRestored.Encoded;
}

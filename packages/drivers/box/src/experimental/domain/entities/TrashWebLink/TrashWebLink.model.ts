/**
 * Experimental Box trashed web link entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashWebLink/TrashWebLink.model");

/**
 * Experimental schema anchor for Box web link metadata while the link is in trash.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty schema)
 *
 * ```ts
 * import { TrashWebLink } from "@beep/box/experimental/domain/entities/TrashWebLink/TrashWebLink.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashWebLink)({});
 * const encoded: TrashWebLink.Encoded = S.encodeSync(TrashWebLink)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashWebLink extends S.Class<TrashWebLink>($I`TrashWebLink`)(
  {},
  $I.annote("TrashWebLink", {
    description: "Experimental schema anchor for Box web link metadata while the link is in trash.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashWebLink} encoded payloads.
 *
 * **Example** (Make and encode empty value)
 *
 * ```ts
 * import { TrashWebLink } from "@beep/box/experimental/domain/entities/TrashWebLink/TrashWebLink.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashWebLink.make({});
 * const encoded: TrashWebLink.Encoded = S.encodeSync(TrashWebLink)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashWebLink {
  /**
   * Encoded payload accepted by the {@link TrashWebLink} entity schema.
   *
   * **Example** (Encode empty made payload)
   *
   * ```ts
   * import { TrashWebLink } from "@beep/box/experimental/domain/entities/TrashWebLink/TrashWebLink.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashWebLink.Encoded = S.encodeSync(TrashWebLink)(TrashWebLink.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashWebLink.Encoded;
}

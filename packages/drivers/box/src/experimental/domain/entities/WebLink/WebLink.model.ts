/**
 * Experimental Box web link entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/WebLink/WebLink.model");

/**
 * Experimental schema anchor for Box web link resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { WebLink } from "@beep/box/experimental/domain/entities/WebLink/WebLink.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(WebLink)({});
 * const encoded: WebLink.Encoded = S.encodeSync(WebLink)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class WebLink extends S.Class<WebLink>($I`WebLink`)(
  {},
  $I.annote("WebLink", {
    description: "Experimental schema anchor for Box web link resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link WebLink} encoded payloads.
 *
 * **Example** (Make and encode payload)
 *
 * ```ts
 * import { WebLink } from "@beep/box/experimental/domain/entities/WebLink/WebLink.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = WebLink.make({});
 * const encoded: WebLink.Encoded = S.encodeSync(WebLink)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WebLink {
  /**
   * Encoded payload accepted by the {@link WebLink} entity schema.
   *
   * **Example** (Encode made WebLink)
   *
   * ```ts
   * import { WebLink } from "@beep/box/experimental/domain/entities/WebLink/WebLink.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: WebLink.Encoded = S.encodeSync(WebLink)(WebLink.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WebLink.Encoded;
}

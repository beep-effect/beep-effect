/**
 * Experimental Box app item entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/AppItem/AppItem.model");

/**
 * Experimental schema anchor for Box app item resources that represent application-owned Box content.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode AppItem)
 *
 * ```ts
 * import { AppItem } from "@beep/box/experimental/domain/entities/AppItem/AppItem.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(AppItem)({});
 * const encoded: AppItem.Encoded = S.encodeSync(AppItem)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class AppItem extends S.Class<AppItem>($I`AppItem`)(
  {},
  $I.annote("AppItem", {
    description: "Experimental schema anchor for Box app item resources that represent application-owned Box content.",
  })
) {}

/**
 * Type-level companion namespace for {@link AppItem} encoded payloads.
 *
 * **Example** (Make and encode AppItem)
 *
 * ```ts
 * import { AppItem } from "@beep/box/experimental/domain/entities/AppItem/AppItem.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = AppItem.make({});
 * const encoded: AppItem.Encoded = S.encodeSync(AppItem)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppItem {
  /**
   * Encoded payload accepted by the {@link AppItem} entity schema.
   *
   * **Example** (Encode AppItem payload)
   *
   * ```ts
   * import { AppItem } from "@beep/box/experimental/domain/entities/AppItem/AppItem.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: AppItem.Encoded = S.encodeSync(AppItem)(AppItem.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AppItem.Encoded;
}

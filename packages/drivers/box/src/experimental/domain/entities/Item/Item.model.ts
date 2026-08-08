/**
 * Experimental Box item entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Item/Item.model");

/**
 * Experimental schema anchor for generic Box item resources shared by files, folders, and web links.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Item)
 *
 * ```ts
 * import { Item } from "@beep/box/experimental/domain/entities/Item/Item.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Item)({});
 * const encoded: Item.Encoded = S.encodeSync(Item)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Item extends S.Class<Item>($I`Item`)(
  {},
  $I.annote("Item", {
    description: "Experimental schema anchor for generic Box item resources shared by files, folders, and web links.",
  })
) {}

/**
 * Type-level companion namespace for {@link Item} encoded payloads.
 *
 * **Example** (Make and encode Item)
 *
 * ```ts
 * import { Item } from "@beep/box/experimental/domain/entities/Item/Item.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Item.make({});
 * const encoded: Item.Encoded = S.encodeSync(Item)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Item {
  /**
   * Encoded payload accepted by the {@link Item} entity schema.
   *
   * **Example** (Encode Item to Encoded)
   *
   * ```ts
   * import { Item } from "@beep/box/experimental/domain/entities/Item/Item.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Item.Encoded = S.encodeSync(Item)(Item.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Item.Encoded;
}

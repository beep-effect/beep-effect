/**
 * Experimental Box folder entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Folder/Folder.model");

/**
 * Experimental schema anchor for Box folder metadata resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Folder)
 *
 * ```ts
 * import { Folder } from "@beep/box/experimental/domain/entities/Folder/Folder.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Folder)({});
 * const encoded: Folder.Encoded = S.encodeSync(Folder)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Folder extends S.Class<Folder>($I`Folder`)(
  {},
  $I.annote("Folder", {
    description: "Experimental schema anchor for Box folder metadata resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link Folder} encoded payloads.
 *
 * **Example** (Make and encode Folder)
 *
 * ```ts
 * import { Folder } from "@beep/box/experimental/domain/entities/Folder/Folder.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Folder.make({});
 * const encoded: Folder.Encoded = S.encodeSync(Folder)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Folder {
  /**
   * Encoded payload accepted by the {@link Folder} entity schema.
   *
   * **Example** (Encode Folder.Encoded payload)
   *
   * ```ts
   * import { Folder } from "@beep/box/experimental/domain/entities/Folder/Folder.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Folder.Encoded = S.encodeSync(Folder)(Folder.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Folder.Encoded;
}

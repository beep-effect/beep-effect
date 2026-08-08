/**
 * Experimental Box trashed folder entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashFolder/TrashFolder.model");

/**
 * Experimental schema anchor for Box folder metadata while the folder is in trash.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { TrashFolder } from "@beep/box/experimental/domain/entities/TrashFolder/TrashFolder.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashFolder)({});
 * const encoded: TrashFolder.Encoded = S.encodeSync(TrashFolder)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashFolder extends S.Class<TrashFolder>($I`TrashFolder`)(
  {},
  $I.annote("TrashFolder", {
    description: "Experimental schema anchor for Box folder metadata while the folder is in trash.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashFolder} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { TrashFolder } from "@beep/box/experimental/domain/entities/TrashFolder/TrashFolder.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashFolder.make({});
 * const encoded: TrashFolder.Encoded = S.encodeSync(TrashFolder)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashFolder {
  /**
   * Encoded payload accepted by the {@link TrashFolder} entity schema.
   *
   * **Example** (Encode to Encoded type)
   *
   * ```ts
   * import { TrashFolder } from "@beep/box/experimental/domain/entities/TrashFolder/TrashFolder.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashFolder.Encoded = S.encodeSync(TrashFolder)(TrashFolder.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashFolder.Encoded;
}

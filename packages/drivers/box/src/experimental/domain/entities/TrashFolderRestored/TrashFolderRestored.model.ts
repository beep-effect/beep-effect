/**
 * Experimental Box restored trashed folder entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashFolderRestored/TrashFolderRestored.model");

/**
 * Experimental schema anchor for folder metadata returned when a trashed Box folder is restored.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty schema)
 *
 * ```ts
 * import { TrashFolderRestored } from "@beep/box/experimental/domain/entities/TrashFolderRestored/TrashFolderRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashFolderRestored)({});
 * const encoded: TrashFolderRestored.Encoded = S.encodeSync(TrashFolderRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashFolderRestored extends S.Class<TrashFolderRestored>($I`TrashFolderRestored`)(
  {},
  $I.annote("TrashFolderRestored", {
    description: "Experimental schema anchor for folder metadata returned when a trashed Box folder is restored.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashFolderRestored} encoded payloads.
 *
 * **Example** (Make and encode empty payload)
 *
 * ```ts
 * import { TrashFolderRestored } from "@beep/box/experimental/domain/entities/TrashFolderRestored/TrashFolderRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashFolderRestored.make({});
 * const encoded: TrashFolderRestored.Encoded = S.encodeSync(TrashFolderRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashFolderRestored {
  /**
   * Encoded payload accepted by the {@link TrashFolderRestored} entity schema.
   *
   * **Example** (Encode made entity payload)
   *
   * ```ts
   * import { TrashFolderRestored } from "@beep/box/experimental/domain/entities/TrashFolderRestored/TrashFolderRestored.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashFolderRestored.Encoded = S.encodeSync(TrashFolderRestored)(TrashFolderRestored.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashFolderRestored.Encoded;
}

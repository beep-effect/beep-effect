/**
 * Experimental Box folder reference entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/FolderReference/FolderReference.model");

/**
 * Experimental schema anchor for lightweight Box folder references embedded in other payloads.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty payload)
 *
 * ```ts
 * import { FolderReference } from "@beep/box/experimental/domain/entities/FolderReference/FolderReference.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(FolderReference)({});
 * const encoded: FolderReference.Encoded = S.encodeSync(FolderReference)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class FolderReference extends S.Class<FolderReference>($I`FolderReference`)(
  {},
  $I.annote("FolderReference", {
    description: "Experimental schema anchor for lightweight Box folder references embedded in other payloads.",
  })
) {}

/**
 * Type-level companion namespace for {@link FolderReference} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { FolderReference } from "@beep/box/experimental/domain/entities/FolderReference/FolderReference.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = FolderReference.make({});
 * const encoded: FolderReference.Encoded = S.encodeSync(FolderReference)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FolderReference {
  /**
   * Encoded payload accepted by the {@link FolderReference} entity schema.
   *
   * **Example** (Encode made empty payload)
   *
   * ```ts
   * import { FolderReference } from "@beep/box/experimental/domain/entities/FolderReference/FolderReference.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: FolderReference.Encoded = S.encodeSync(FolderReference)(FolderReference.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FolderReference.Encoded;
}

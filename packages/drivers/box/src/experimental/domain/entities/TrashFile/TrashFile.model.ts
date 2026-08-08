/**
 * Experimental Box trashed file entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashFile/TrashFile.model");

/**
 * Experimental schema anchor for Box file metadata while the file is in trash.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty TrashFile)
 *
 * ```ts
 * import { TrashFile } from "@beep/box/experimental/domain/entities/TrashFile/TrashFile.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashFile)({});
 * const encoded: TrashFile.Encoded = S.encodeSync(TrashFile)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashFile extends S.Class<TrashFile>($I`TrashFile`)(
  {},
  $I.annote("TrashFile", {
    description: "Experimental schema anchor for Box file metadata while the file is in trash.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashFile} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { TrashFile } from "@beep/box/experimental/domain/entities/TrashFile/TrashFile.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashFile.make({});
 * const encoded: TrashFile.Encoded = S.encodeSync(TrashFile)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashFile {
  /**
   * Encoded payload accepted by the {@link TrashFile} entity schema.
   *
   * **Example** (Encode empty Encoded payload)
   *
   * ```ts
   * import { TrashFile } from "@beep/box/experimental/domain/entities/TrashFile/TrashFile.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashFile.Encoded = S.encodeSync(TrashFile)(TrashFile.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashFile.Encoded;
}

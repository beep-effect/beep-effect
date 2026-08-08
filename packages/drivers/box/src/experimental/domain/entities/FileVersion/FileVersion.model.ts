/**
 * Experimental Box file version entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/FileVersion/FileVersion.model");

/**
 * Experimental schema anchor for historical versions of Box files.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { FileVersion } from "@beep/box/experimental/domain/entities/FileVersion/FileVersion.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(FileVersion)({});
 * const encoded: FileVersion.Encoded = S.encodeSync(FileVersion)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class FileVersion extends S.Class<FileVersion>($I`FileVersion`)(
  {},
  $I.annote("FileVersion", {
    description: "Experimental schema anchor for historical versions of Box files.",
  })
) {}

/**
 * Type-level companion namespace for {@link FileVersion} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { FileVersion } from "@beep/box/experimental/domain/entities/FileVersion/FileVersion.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = FileVersion.make({});
 * const encoded: FileVersion.Encoded = S.encodeSync(FileVersion)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FileVersion {
  /**
   * Encoded payload accepted by the {@link FileVersion} entity schema.
   *
   * **Example** (Encode empty FileVersion)
   *
   * ```ts
   * import { FileVersion } from "@beep/box/experimental/domain/entities/FileVersion/FileVersion.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: FileVersion.Encoded = S.encodeSync(FileVersion)(FileVersion.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FileVersion.Encoded;
}

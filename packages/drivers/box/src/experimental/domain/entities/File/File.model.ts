/**
 * Experimental Box file entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/File/File.model");

/**
 * Experimental schema anchor for Box file metadata resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty File)
 *
 * ```ts
 * import { File } from "@beep/box/experimental/domain/entities/File/File.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(File)({});
 * const encoded: File.Encoded = S.encodeSync(File)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class File extends S.Class<File>($I`File`)(
  {},
  $I.annote("File", {
    description: "Experimental schema anchor for Box file metadata resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link File} encoded payloads.
 *
 * **Example** (Make and encode File payload)
 *
 * ```ts
 * import { File } from "@beep/box/experimental/domain/entities/File/File.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = File.make({});
 * const encoded: File.Encoded = S.encodeSync(File)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace File {
  /**
   * Encoded payload accepted by the {@link File} entity schema.
   *
   * **Example** (Encode File to Encoded type)
   *
   * ```ts
   * import { File } from "@beep/box/experimental/domain/entities/File/File.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: File.Encoded = S.encodeSync(File)(File.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof File.Encoded;
}

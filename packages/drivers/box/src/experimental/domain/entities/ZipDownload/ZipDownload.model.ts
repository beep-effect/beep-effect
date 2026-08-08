/**
 * Experimental Box zip download entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/ZipDownload/ZipDownload.model");

/**
 * Experimental schema anchor for Box zip download resources and status payloads.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty payload)
 *
 * ```ts
 * import { ZipDownload } from "@beep/box/experimental/domain/entities/ZipDownload/ZipDownload.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(ZipDownload)({});
 * const encoded: ZipDownload.Encoded = S.encodeSync(ZipDownload)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ZipDownload extends S.Class<ZipDownload>($I`ZipDownload`)(
  {},
  $I.annote("ZipDownload", {
    description: "Experimental schema anchor for Box zip download resources and status payloads.",
  })
) {}

/**
 * Type-level companion namespace for {@link ZipDownload} encoded payloads.
 *
 * **Example** (Make and encode ZipDownload)
 *
 * ```ts
 * import { ZipDownload } from "@beep/box/experimental/domain/entities/ZipDownload/ZipDownload.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = ZipDownload.make({});
 * const encoded: ZipDownload.Encoded = S.encodeSync(ZipDownload)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ZipDownload {
  /**
   * Encoded payload accepted by the {@link ZipDownload} entity schema.
   *
   * **Example** (Encode empty ZipDownload payload)
   *
   * ```ts
   * import { ZipDownload } from "@beep/box/experimental/domain/entities/ZipDownload/ZipDownload.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: ZipDownload.Encoded = S.encodeSync(ZipDownload)(ZipDownload.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ZipDownload.Encoded;
}

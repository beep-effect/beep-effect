/**
 * Experimental Box upload part value-object schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("values/UploadPart/UploadPart.model");

/**
 * Experimental value object for an uploaded chunk in a Box chunked upload session.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty part)
 *
 * ```ts
 * import { UploadPart } from "@beep/box/experimental/domain/values/UploadPart/UploadPart.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(UploadPart)({});
 * const encoded: UploadPart.Encoded = S.encodeSync(UploadPart)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class UploadPart extends S.Class<UploadPart>($I`UploadPart`)(
  {},
  $I.annote("UploadPart", {
    description: "Experimental value object for an uploaded chunk in a Box chunked upload session.",
  })
) {}

/**
 * Type-level companion namespace for {@link UploadPart} encoded payloads.
 *
 * **Example** (Make and encode UploadPart)
 *
 * ```ts
 * import { UploadPart } from "@beep/box/experimental/domain/values/UploadPart/UploadPart.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = UploadPart.make({});
 * const encoded: UploadPart.Encoded = S.encodeSync(UploadPart)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UploadPart {
  /**
   * Encoded payload accepted by the {@link UploadPart} value-object schema.
   *
   * **Example** (Encode UploadPart payload)
   *
   * ```ts
   * import { UploadPart } from "@beep/box/experimental/domain/values/UploadPart/UploadPart.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: UploadPart.Encoded = S.encodeSync(UploadPart)(UploadPart.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UploadPart.Encoded;
}

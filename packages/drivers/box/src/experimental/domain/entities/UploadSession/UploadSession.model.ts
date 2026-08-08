/**
 * Experimental Box upload session entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/UploadSession/UploadSession.model");

/**
 * Experimental schema anchor for Box chunked upload session resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty UploadSession)
 *
 * ```ts
 * import { UploadSession } from "@beep/box/experimental/domain/entities/UploadSession/UploadSession.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(UploadSession)({});
 * const encoded: UploadSession.Encoded = S.encodeSync(UploadSession)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class UploadSession extends S.Class<UploadSession>($I`UploadSession`)(
  {},
  $I.annote("UploadSession", {
    description: "Experimental schema anchor for Box chunked upload session resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link UploadSession} encoded payloads.
 *
 * **Example** (Make and encode empty session)
 *
 * ```ts
 * import { UploadSession } from "@beep/box/experimental/domain/entities/UploadSession/UploadSession.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = UploadSession.make({});
 * const encoded: UploadSession.Encoded = S.encodeSync(UploadSession)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UploadSession {
  /**
   * Encoded payload accepted by the {@link UploadSession} entity schema.
   *
   * **Example** (Encode empty session payload)
   *
   * ```ts
   * import { UploadSession } from "@beep/box/experimental/domain/entities/UploadSession/UploadSession.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: UploadSession.Encoded = S.encodeSync(UploadSession)(UploadSession.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UploadSession.Encoded;
}

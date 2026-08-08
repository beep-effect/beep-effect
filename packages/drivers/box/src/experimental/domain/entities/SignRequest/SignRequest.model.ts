/**
 * Experimental Box Sign request entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/SignRequest/SignRequest.model");

/**
 * Experimental schema anchor for Box Sign request resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { SignRequest } from "@beep/box/experimental/domain/entities/SignRequest/SignRequest.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(SignRequest)({});
 * const encoded: SignRequest.Encoded = S.encodeSync(SignRequest)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SignRequest extends S.Class<SignRequest>($I`SignRequest`)(
  {},
  $I.annote("SignRequest", {
    description: "Experimental schema anchor for Box Sign request resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link SignRequest} encoded payloads.
 *
 * **Example** (Make and encode payload)
 *
 * ```ts
 * import { SignRequest } from "@beep/box/experimental/domain/entities/SignRequest/SignRequest.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = SignRequest.make({});
 * const encoded: SignRequest.Encoded = S.encodeSync(SignRequest)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SignRequest {
  /**
   * Encoded payload accepted by the {@link SignRequest} entity schema.
   *
   * **Example** (Encode made SignRequest)
   *
   * ```ts
   * import { SignRequest } from "@beep/box/experimental/domain/entities/SignRequest/SignRequest.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: SignRequest.Encoded = S.encodeSync(SignRequest)(SignRequest.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SignRequest.Encoded;
}

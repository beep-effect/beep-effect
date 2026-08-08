/**
 * Experimental Box Sign template entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/SignTemplate/SignTemplate.model");

/**
 * Experimental schema anchor for reusable Box Sign template resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty schema)
 *
 * ```ts
 * import { SignTemplate } from "@beep/box/experimental/domain/entities/SignTemplate/SignTemplate.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(SignTemplate)({});
 * const encoded: SignTemplate.Encoded = S.encodeSync(SignTemplate)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SignTemplate extends S.Class<SignTemplate>($I`SignTemplate`)(
  {},
  $I.annote("SignTemplate", {
    description: "Experimental schema anchor for reusable Box Sign template resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link SignTemplate} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { SignTemplate } from "@beep/box/experimental/domain/entities/SignTemplate/SignTemplate.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = SignTemplate.make({});
 * const encoded: SignTemplate.Encoded = S.encodeSync(SignTemplate)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SignTemplate {
  /**
   * Encoded payload accepted by the {@link SignTemplate} entity schema.
   *
   * **Example** (Encode made SignTemplate)
   *
   * ```ts
   * import { SignTemplate } from "@beep/box/experimental/domain/entities/SignTemplate/SignTemplate.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: SignTemplate.Encoded = S.encodeSync(SignTemplate)(SignTemplate.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SignTemplate.Encoded;
}

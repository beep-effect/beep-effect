/**
 * Experimental Box email alias entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/EmailAlias/EmailAlias.model");

/**
 * Experimental schema anchor for alternate email addresses on Box user accounts.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and re-encode empty)
 *
 * ```ts
 * import { EmailAlias } from "@beep/box/experimental/domain/entities/EmailAlias/EmailAlias.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(EmailAlias)({});
 * const encoded: EmailAlias.Encoded = S.encodeSync(EmailAlias)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class EmailAlias extends S.Class<EmailAlias>($I`EmailAlias`)(
  {},
  $I.annote("EmailAlias", {
    description: "Experimental schema anchor for alternate email addresses on Box user accounts.",
  })
) {}

/**
 * Type-level companion namespace for {@link EmailAlias} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { EmailAlias } from "@beep/box/experimental/domain/entities/EmailAlias/EmailAlias.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = EmailAlias.make({});
 * const encoded: EmailAlias.Encoded = S.encodeSync(EmailAlias)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmailAlias {
  /**
   * Encoded payload accepted by the {@link EmailAlias} entity schema.
   *
   * **Example** (Encode typed Encoded payload)
   *
   * ```ts
   * import { EmailAlias } from "@beep/box/experimental/domain/entities/EmailAlias/EmailAlias.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: EmailAlias.Encoded = S.encodeSync(EmailAlias)(EmailAlias.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EmailAlias.Encoded;
}

/**
 * Experimental Box invite entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Invite/Invite.model");

/**
 * Experimental schema anchor for Box invite records representing pending access.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty invite)
 *
 * ```ts
 * import { Invite } from "@beep/box/experimental/domain/entities/Invite/Invite.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Invite)({});
 * const encoded: Invite.Encoded = S.encodeSync(Invite)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Invite extends S.Class<Invite>($I`Invite`)(
  {},
  $I.annote("Invite", {
    description: "Experimental schema anchor for Box invite records representing pending access.",
  })
) {}

/**
 * Type-level companion namespace for {@link Invite} encoded payloads.
 *
 * **Example** (Make and encode invite)
 *
 * ```ts
 * import { Invite } from "@beep/box/experimental/domain/entities/Invite/Invite.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Invite.make({});
 * const encoded: Invite.Encoded = S.encodeSync(Invite)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Invite {
  /**
   * Encoded payload accepted by the {@link Invite} entity schema.
   *
   * **Example** (Encode invite payload)
   *
   * ```ts
   * import { Invite } from "@beep/box/experimental/domain/entities/Invite/Invite.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Invite.Encoded = S.encodeSync(Invite)(Invite.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Invite.Encoded;
}

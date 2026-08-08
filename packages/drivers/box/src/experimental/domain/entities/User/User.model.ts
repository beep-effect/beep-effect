/**
 * Experimental Box user entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/User/User.model");

/**
 * Experimental schema anchor for Box user resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty User)
 *
 * ```ts
 * import { User } from "@beep/box/experimental/domain/entities/User/User.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(User)({});
 * const encoded: User.Encoded = S.encodeSync(User)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class User extends S.Class<User>($I`User`)(
  {},
  $I.annote("User", {
    description: "Experimental schema anchor for Box user resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link User} encoded payloads.
 *
 * **Example** (Make and encode User)
 *
 * ```ts
 * import { User } from "@beep/box/experimental/domain/entities/User/User.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = User.make({});
 * const encoded: User.Encoded = S.encodeSync(User)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace User {
  /**
   * Encoded payload accepted by the {@link User} entity schema.
   *
   * **Example** (Encode User to Encoded)
   *
   * ```ts
   * import { User } from "@beep/box/experimental/domain/entities/User/User.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: User.Encoded = S.encodeSync(User)(User.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof User.Encoded;
}

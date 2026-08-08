/**
 * Experimental Box group membership entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/GroupMembership/GroupMembership.model");

/**
 * Experimental schema anchor for Box group membership records.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { GroupMembership } from "@beep/box/experimental/domain/entities/GroupMembership/GroupMembership.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(GroupMembership)({});
 * const encoded: GroupMembership.Encoded = S.encodeSync(GroupMembership)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class GroupMembership extends S.Class<GroupMembership>($I`GroupMembership`)(
  {},
  $I.annote("GroupMembership", {
    description: "Experimental schema anchor for Box group membership records.",
  })
) {}

/**
 * Type-level companion namespace for {@link GroupMembership} encoded payloads.
 *
 * **Example** (Make and encode membership)
 *
 * ```ts
 * import { GroupMembership } from "@beep/box/experimental/domain/entities/GroupMembership/GroupMembership.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = GroupMembership.make({});
 * const encoded: GroupMembership.Encoded = S.encodeSync(GroupMembership)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GroupMembership {
  /**
   * Encoded payload accepted by the {@link GroupMembership} entity schema.
   *
   * **Example** (Encode empty membership)
   *
   * ```ts
   * import { GroupMembership } from "@beep/box/experimental/domain/entities/GroupMembership/GroupMembership.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: GroupMembership.Encoded = S.encodeSync(GroupMembership)(GroupMembership.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GroupMembership.Encoded;
}

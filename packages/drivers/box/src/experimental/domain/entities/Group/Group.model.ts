/**
 * Experimental Box group entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Group/Group.model");

/**
 * Experimental schema anchor for Box group resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Group)
 *
 * ```ts
 * import { Group } from "@beep/box/experimental/domain/entities/Group/Group.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Group)({});
 * const encoded: Group.Encoded = S.encodeSync(Group)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Group extends S.Class<Group>($I`Group`)(
  {},
  $I.annote("Group", {
    description: "Experimental schema anchor for Box group resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link Group} encoded payloads.
 *
 * **Example** (Make and encode Group)
 *
 * ```ts
 * import { Group } from "@beep/box/experimental/domain/entities/Group/Group.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Group.make({});
 * const encoded: Group.Encoded = S.encodeSync(Group)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Group {
  /**
   * Encoded payload accepted by the {@link Group} entity schema.
   *
   * **Example** (Encode empty Group payload)
   *
   * ```ts
   * import { Group } from "@beep/box/experimental/domain/entities/Group/Group.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Group.Encoded = S.encodeSync(Group)(Group.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Group.Encoded;
}

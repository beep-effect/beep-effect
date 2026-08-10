/**
 * Experimental Box retention policy assignment entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/RetentionPolicyAssignment/RetentionPolicyAssignment.model");

/**
 * Experimental schema anchor for Box retention policy assignment records.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty assignment)
 *
 * ```ts
 * import { RetentionPolicyAssignment } from "@beep/box/experimental/domain/entities/RetentionPolicyAssignment/RetentionPolicyAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(RetentionPolicyAssignment)({});
 * const encoded: RetentionPolicyAssignment.Encoded = S.encodeSync(RetentionPolicyAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class RetentionPolicyAssignment extends S.Class<RetentionPolicyAssignment>($I`RetentionPolicyAssignment`)(
  {},
  $I.annote("RetentionPolicyAssignment", {
    description: "Experimental schema anchor for Box retention policy assignment records.",
  })
) {}

/**
 * Type-level companion namespace for {@link RetentionPolicyAssignment} encoded payloads.
 *
 * **Example** (Make and encode assignment payload)
 *
 * ```ts
 * import { RetentionPolicyAssignment } from "@beep/box/experimental/domain/entities/RetentionPolicyAssignment/RetentionPolicyAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = RetentionPolicyAssignment.make({});
 * const encoded: RetentionPolicyAssignment.Encoded = S.encodeSync(RetentionPolicyAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RetentionPolicyAssignment {
  /**
   * Encoded payload accepted by the {@link RetentionPolicyAssignment} entity schema.
   *
   * **Example** (Encode made assignment payload)
   *
   * ```ts
   * import { RetentionPolicyAssignment } from "@beep/box/experimental/domain/entities/RetentionPolicyAssignment/RetentionPolicyAssignment.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: RetentionPolicyAssignment.Encoded = S.encodeSync(RetentionPolicyAssignment)(RetentionPolicyAssignment.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RetentionPolicyAssignment.Encoded;
}

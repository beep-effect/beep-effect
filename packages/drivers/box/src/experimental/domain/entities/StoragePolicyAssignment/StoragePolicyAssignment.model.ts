/**
 * Experimental Box storage policy assignment entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/StoragePolicyAssignment/StoragePolicyAssignment.model");

/**
 * Experimental schema anchor for Box storage policy assignment records.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { StoragePolicyAssignment } from "@beep/box/experimental/domain/entities/StoragePolicyAssignment/StoragePolicyAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(StoragePolicyAssignment)({});
 * const encoded: StoragePolicyAssignment.Encoded = S.encodeSync(StoragePolicyAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class StoragePolicyAssignment extends S.Class<StoragePolicyAssignment>($I`StoragePolicyAssignment`)(
  {},
  $I.annote("StoragePolicyAssignment", {
    description: "Experimental schema anchor for Box storage policy assignment records.",
  })
) {}

/**
 * Type-level companion namespace for {@link StoragePolicyAssignment} encoded payloads.
 *
 * **Example** (Make and encode payload)
 *
 * ```ts
 * import { StoragePolicyAssignment } from "@beep/box/experimental/domain/entities/StoragePolicyAssignment/StoragePolicyAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = StoragePolicyAssignment.make({});
 * const encoded: StoragePolicyAssignment.Encoded = S.encodeSync(StoragePolicyAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StoragePolicyAssignment {
  /**
   * Encoded payload accepted by the {@link StoragePolicyAssignment} entity schema.
   *
   * **Example** (Encode made assignment)
   *
   * ```ts
   * import { StoragePolicyAssignment } from "@beep/box/experimental/domain/entities/StoragePolicyAssignment/StoragePolicyAssignment.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: StoragePolicyAssignment.Encoded = S.encodeSync(StoragePolicyAssignment)(StoragePolicyAssignment.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StoragePolicyAssignment.Encoded;
}

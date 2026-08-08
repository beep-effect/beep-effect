/**
 * Experimental Box storage policy entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/StoragePolicy/StoragePolicy.model");

/**
 * Experimental schema anchor for Box storage policy resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty policy)
 *
 * ```ts
 * import { StoragePolicy } from "@beep/box/experimental/domain/entities/StoragePolicy/StoragePolicy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(StoragePolicy)({});
 * const encoded: StoragePolicy.Encoded = S.encodeSync(StoragePolicy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class StoragePolicy extends S.Class<StoragePolicy>($I`StoragePolicy`)(
  {},
  $I.annote("StoragePolicy", {
    description: "Experimental schema anchor for Box storage policy resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link StoragePolicy} encoded payloads.
 *
 * **Example** (Make and encode empty policy)
 *
 * ```ts
 * import { StoragePolicy } from "@beep/box/experimental/domain/entities/StoragePolicy/StoragePolicy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = StoragePolicy.make({});
 * const encoded: StoragePolicy.Encoded = S.encodeSync(StoragePolicy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StoragePolicy {
  /**
   * Encoded payload accepted by the {@link StoragePolicy} entity schema.
   *
   * **Example** (Encode empty StoragePolicy payload)
   *
   * ```ts
   * import { StoragePolicy } from "@beep/box/experimental/domain/entities/StoragePolicy/StoragePolicy.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: StoragePolicy.Encoded = S.encodeSync(StoragePolicy)(StoragePolicy.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StoragePolicy.Encoded;
}

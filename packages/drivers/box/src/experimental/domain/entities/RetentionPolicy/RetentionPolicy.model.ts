/**
 * Experimental Box retention policy entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/RetentionPolicy/RetentionPolicy.model");

/**
 * Experimental schema anchor for Box retention policy resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty policy)
 *
 * ```ts
 * import { RetentionPolicy } from "@beep/box/experimental/domain/entities/RetentionPolicy/RetentionPolicy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(RetentionPolicy)({});
 * const encoded: RetentionPolicy.Encoded = S.encodeSync(RetentionPolicy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class RetentionPolicy extends S.Class<RetentionPolicy>($I`RetentionPolicy`)(
  {},
  $I.annote("RetentionPolicy", {
    description: "Experimental schema anchor for Box retention policy resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link RetentionPolicy} encoded payloads.
 *
 * **Example** (Make and encode empty policy)
 *
 * ```ts
 * import { RetentionPolicy } from "@beep/box/experimental/domain/entities/RetentionPolicy/RetentionPolicy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = RetentionPolicy.make({});
 * const encoded: RetentionPolicy.Encoded = S.encodeSync(RetentionPolicy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RetentionPolicy {
  /**
   * Encoded payload accepted by the {@link RetentionPolicy} entity schema.
   *
   * **Example** (Encode empty retention policy)
   *
   * ```ts
   * import { RetentionPolicy } from "@beep/box/experimental/domain/entities/RetentionPolicy/RetentionPolicy.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: RetentionPolicy.Encoded = S.encodeSync(RetentionPolicy)(RetentionPolicy.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RetentionPolicy.Encoded;
}

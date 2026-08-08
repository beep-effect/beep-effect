/**
 * Experimental Box outcome entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Outcome/Outcome.model");

/**
 * Experimental schema anchor for outcome resources returned by Box workflow-style operations.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Outcome)
 *
 * ```ts
 * import { Outcome } from "@beep/box/experimental/domain/entities/Outcome/Outcome.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Outcome)({});
 * const encoded: Outcome.Encoded = S.encodeSync(Outcome)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Outcome extends S.Class<Outcome>($I`Outcome`)(
  {},
  $I.annote("Outcome", {
    description: "Experimental schema anchor for outcome resources returned by Box workflow-style operations.",
  })
) {}

/**
 * Type-level companion namespace for {@link Outcome} encoded payloads.
 *
 * **Example** (Make and encode Outcome)
 *
 * ```ts
 * import { Outcome } from "@beep/box/experimental/domain/entities/Outcome/Outcome.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Outcome.make({});
 * const encoded: Outcome.Encoded = S.encodeSync(Outcome)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Outcome {
  /**
   * Encoded payload accepted by the {@link Outcome} entity schema.
   *
   * **Example** (Encode Outcome to Encoded)
   *
   * ```ts
   * import { Outcome } from "@beep/box/experimental/domain/entities/Outcome/Outcome.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Outcome.Encoded = S.encodeSync(Outcome)(Outcome.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Outcome.Encoded;
}

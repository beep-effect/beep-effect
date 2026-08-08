/**
 * Experimental Box webhook entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Webhook/Webhook.model");

/**
 * Experimental schema anchor for Box webhook subscription resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty webhook payload)
 *
 * ```ts
 * import { Webhook } from "@beep/box/experimental/domain/entities/Webhook/Webhook.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Webhook)({});
 * const encoded: Webhook.Encoded = S.encodeSync(Webhook)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Webhook extends S.Class<Webhook>($I`Webhook`)(
  {},
  $I.annote("Webhook", {
    description: "Experimental schema anchor for Box webhook subscription resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link Webhook} encoded payloads.
 *
 * **Example** (Make and encode webhook)
 *
 * ```ts
 * import { Webhook } from "@beep/box/experimental/domain/entities/Webhook/Webhook.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Webhook.make({});
 * const encoded: Webhook.Encoded = S.encodeSync(Webhook)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Webhook {
  /**
   * Encoded payload accepted by the {@link Webhook} entity schema.
   *
   * **Example** (Encode made webhook instance)
   *
   * ```ts
   * import { Webhook } from "@beep/box/experimental/domain/entities/Webhook/Webhook.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Webhook.Encoded = S.encodeSync(Webhook)(Webhook.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Webhook.Encoded;
}

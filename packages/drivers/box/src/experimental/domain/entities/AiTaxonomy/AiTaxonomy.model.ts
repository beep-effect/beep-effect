/**
 * Experimental Box AI taxonomy entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/AiTaxonomy/AiTaxonomy.model");

/**
 * Experimental schema anchor for Box AI taxonomy resources returned by AI classification workflows.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { AiTaxonomy } from "@beep/box/experimental/domain/entities/AiTaxonomy/AiTaxonomy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(AiTaxonomy)({});
 * const encoded: AiTaxonomy.Encoded = S.encodeSync(AiTaxonomy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class AiTaxonomy extends S.Class<AiTaxonomy>($I`AiTaxonomy`)(
  {},
  $I.annote("AiTaxonomy", {
    description: "Experimental schema anchor for Box AI taxonomy resources returned by AI classification workflows.",
  })
) {}

/**
 * Type-level companion namespace for {@link AiTaxonomy} encoded payloads.
 *
 * **Example** (Make and encode taxonomy)
 *
 * ```ts
 * import { AiTaxonomy } from "@beep/box/experimental/domain/entities/AiTaxonomy/AiTaxonomy.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = AiTaxonomy.make({});
 * const encoded: AiTaxonomy.Encoded = S.encodeSync(AiTaxonomy)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AiTaxonomy {
  /**
   * Encoded payload accepted by the {@link AiTaxonomy} entity schema.
   *
   * **Example** (Encode made taxonomy payload)
   *
   * ```ts
   * import { AiTaxonomy } from "@beep/box/experimental/domain/entities/AiTaxonomy/AiTaxonomy.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: AiTaxonomy.Encoded = S.encodeSync(AiTaxonomy)(AiTaxonomy.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AiTaxonomy.Encoded;
}

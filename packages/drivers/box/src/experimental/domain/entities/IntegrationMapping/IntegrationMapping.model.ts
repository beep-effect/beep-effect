/**
 * Experimental Box integration mapping entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/IntegrationMapping/IntegrationMapping.model");

/**
 * Experimental schema anchor for Box integration mapping records that connect Box resources to external systems.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty mapping)
 *
 * ```ts
 * import { IntegrationMapping } from "@beep/box/experimental/domain/entities/IntegrationMapping/IntegrationMapping.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(IntegrationMapping)({});
 * const encoded: IntegrationMapping.Encoded = S.encodeSync(IntegrationMapping)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class IntegrationMapping extends S.Class<IntegrationMapping>($I`IntegrationMapping`)(
  {},
  $I.annote("IntegrationMapping", {
    description:
      "Experimental schema anchor for Box integration mapping records that connect Box resources to external systems.",
  })
) {}

/**
 * Type-level companion namespace for {@link IntegrationMapping} encoded payloads.
 *
 * **Example** (Make and encode empty mapping)
 *
 * ```ts
 * import { IntegrationMapping } from "@beep/box/experimental/domain/entities/IntegrationMapping/IntegrationMapping.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = IntegrationMapping.make({});
 * const encoded: IntegrationMapping.Encoded = S.encodeSync(IntegrationMapping)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntegrationMapping {
  /**
   * Encoded payload accepted by the {@link IntegrationMapping} entity schema.
   *
   * **Example** (Encode empty IntegrationMapping payload)
   *
   * ```ts
   * import { IntegrationMapping } from "@beep/box/experimental/domain/entities/IntegrationMapping/IntegrationMapping.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: IntegrationMapping.Encoded = S.encodeSync(IntegrationMapping)(IntegrationMapping.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof IntegrationMapping.Encoded;
}

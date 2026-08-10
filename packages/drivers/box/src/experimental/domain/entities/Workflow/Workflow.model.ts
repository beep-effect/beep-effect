/**
 * Experimental Box workflow entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Workflow/Workflow.model");

/**
 * Experimental schema anchor for Box workflow resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Workflow)
 *
 * ```ts
 * import { Workflow } from "@beep/box/experimental/domain/entities/Workflow/Workflow.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Workflow)({});
 * const encoded: Workflow.Encoded = S.encodeSync(Workflow)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Workflow extends S.Class<Workflow>($I`Workflow`)(
  {},
  $I.annote("Workflow", {
    description: "Experimental schema anchor for Box workflow resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link Workflow} encoded payloads.
 *
 * **Example** (Make and encode Workflow payload)
 *
 * ```ts
 * import { Workflow } from "@beep/box/experimental/domain/entities/Workflow/Workflow.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Workflow.make({});
 * const encoded: Workflow.Encoded = S.encodeSync(Workflow)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Workflow {
  /**
   * Encoded payload accepted by the {@link Workflow} entity schema.
   *
   * **Example** (Encode Workflow to Encoded type)
   *
   * ```ts
   * import { Workflow } from "@beep/box/experimental/domain/entities/Workflow/Workflow.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Workflow.Encoded = S.encodeSync(Workflow)(Workflow.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Workflow.Encoded;
}

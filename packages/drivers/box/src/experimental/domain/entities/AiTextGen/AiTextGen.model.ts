/**
 * Experimental Box AI text generation entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/AiTextGen/AiTextGen.model");

/**
 * Experimental schema anchor for Box AI text generation response resources.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { AiTextGen } from "@beep/box/experimental/domain/entities/AiTextGen/AiTextGen.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(AiTextGen)({});
 * const encoded: AiTextGen.Encoded = S.encodeSync(AiTextGen)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class AiTextGen extends S.Class<AiTextGen>($I`AiTextGen`)(
  {},
  $I.annote("AiTextGen", {
    description: "Experimental schema anchor for Box AI text generation response resources.",
  })
) {}

/**
 * Type-level companion namespace for {@link AiTextGen} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { AiTextGen } from "@beep/box/experimental/domain/entities/AiTextGen/AiTextGen.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = AiTextGen.make({});
 * const encoded: AiTextGen.Encoded = S.encodeSync(AiTextGen)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AiTextGen {
  /**
   * Encoded payload accepted by the {@link AiTextGen} entity schema.
   *
   * **Example** (Encode made empty payload)
   *
   * ```ts
   * import { AiTextGen } from "@beep/box/experimental/domain/entities/AiTextGen/AiTextGen.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: AiTextGen.Encoded = S.encodeSync(AiTextGen)(AiTextGen.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AiTextGen.Encoded;
}

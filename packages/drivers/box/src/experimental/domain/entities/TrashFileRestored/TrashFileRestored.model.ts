/**
 * Experimental Box restored trashed file entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TrashFileRestored/TrashFileRestored.model");

/**
 * Experimental schema anchor for file metadata returned when a trashed Box file is restored.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty)
 *
 * ```ts
 * import { TrashFileRestored } from "@beep/box/experimental/domain/entities/TrashFileRestored/TrashFileRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TrashFileRestored)({});
 * const encoded: TrashFileRestored.Encoded = S.encodeSync(TrashFileRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrashFileRestored extends S.Class<TrashFileRestored>($I`TrashFileRestored`)(
  {},
  $I.annote("TrashFileRestored", {
    description: "Experimental schema anchor for file metadata returned when a trashed Box file is restored.",
  })
) {}

/**
 * Type-level companion namespace for {@link TrashFileRestored} encoded payloads.
 *
 * **Example** (Make and encode payload)
 *
 * ```ts
 * import { TrashFileRestored } from "@beep/box/experimental/domain/entities/TrashFileRestored/TrashFileRestored.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TrashFileRestored.make({});
 * const encoded: TrashFileRestored.Encoded = S.encodeSync(TrashFileRestored)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrashFileRestored {
  /**
   * Encoded payload accepted by the {@link TrashFileRestored} entity schema.
   *
   * **Example** (Encode made empty value)
   *
   * ```ts
   * import { TrashFileRestored } from "@beep/box/experimental/domain/entities/TrashFileRestored/TrashFileRestored.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TrashFileRestored.Encoded = S.encodeSync(TrashFileRestored)(TrashFileRestored.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrashFileRestored.Encoded;
}

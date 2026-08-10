/**
 * Experimental Box event entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Event/Event.model");

/**
 * Experimental schema anchor for entries emitted by Box event streams.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode Event)
 *
 * ```ts
 * import { Event } from "@beep/box/experimental/domain/entities/Event/Event.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Event)({});
 * const encoded: Event.Encoded = S.encodeSync(Event)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Event extends S.Class<Event>($I`Event`)(
  {},
  $I.annote("Event", {
    description: "Experimental schema anchor for entries emitted by Box event streams.",
  })
) {}

/**
 * Type-level companion namespace for {@link Event} encoded payloads.
 *
 * **Example** (Make and encode Event)
 *
 * ```ts
 * import { Event } from "@beep/box/experimental/domain/entities/Event/Event.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Event.make({});
 * const encoded: Event.Encoded = S.encodeSync(Event)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Event {
  /**
   * Encoded payload accepted by the {@link Event} entity schema.
   *
   * **Example** (Encode Event payload)
   *
   * ```ts
   * import { Event } from "@beep/box/experimental/domain/entities/Event/Event.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Event.Encoded = S.encodeSync(Event)(Event.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Event.Encoded;
}

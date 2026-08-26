/**
 * DOM schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DomEvent");

/**
 * Type guard for Event.
 *
 * **Example** (Guard Event instance)
 *
 * ```ts import.meta.vitest name="Guard Event instance"
 * import { isEvent } from "@beep/schema/DomEvent"
 *
 * console.log(isEvent(new Event("submit")))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isEvent = (u: unknown): u is Event => u instanceof Event;

/**
 * A DOM event.
 *
 * **Example** (Decode Event with schema)
 *
 * ```ts import.meta.vitest name="Decode Event with schema"
 * import { DOMEvent } from "@beep/schema/DomEvent"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(DOMEvent)(new Event("submit"))
 * console.log(event.type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DOMEvent = S.declare(isEvent).pipe(
  $I.annoteSchema("DOMEvent", {
    description: "A DOM event",
  })
);

/**
 * Type for {@link DOMEvent}.
 *
 * **Example** (Typed DOMEvent decode)
 *
 * ```ts import.meta.vitest name="Typed DOMEvent decode"
 * import * as S from "effect/Schema"
 * import { DOMEvent } from "@beep/schema/DomEvent"
 *
 * const event: DOMEvent = S.decodeUnknownSync(DOMEvent)(new Event("submit"))
 * console.log(event.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DOMEvent = typeof DOMEvent.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMEvent as DomEvent, DOMEvent as Schema };

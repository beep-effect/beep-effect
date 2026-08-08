/**
 * DOM schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DomMouseEvent");

/**
 * Type guard for MouseEvent.
 *
 * **Example** (Guard MouseEvent instance)
 *
 * ```ts
 * import { isMouseEvent } from "@beep/schema/DomMouseEvent"
 *
 * console.log(isMouseEvent(new MouseEvent("click")))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isMouseEvent = (u: unknown): u is MouseEvent => u instanceof MouseEvent;

/**
 * A DOM mouse event.
 *
 * **Example** (Decode MouseEvent with schema)
 *
 * ```ts
 * import { DOMMouseEvent } from "@beep/schema/DomMouseEvent"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(DOMMouseEvent)(new MouseEvent("click"))
 * console.log(event.type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DOMMouseEvent = S.declare(isMouseEvent).pipe(
  $I.annoteSchema("DOMMouseEvent", {
    description: "A DOM mouse event",
  })
);

/**
 * Type for {@link DOMMouseEvent}.
 *
 * **Example** (Typed DOMMouseEvent decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DOMMouseEvent } from "@beep/schema/DomMouseEvent"
 *
 * const event: DOMMouseEvent = S.decodeUnknownSync(DOMMouseEvent)(new MouseEvent("click"))
 * console.log(event.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DOMMouseEvent = typeof DOMMouseEvent.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMMouseEvent as DomMouseEvent, DOMMouseEvent as Schema };

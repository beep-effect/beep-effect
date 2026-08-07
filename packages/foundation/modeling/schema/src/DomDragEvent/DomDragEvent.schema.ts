/**
 * DOM schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DomDragEvent");

/**
 * Type guard for DragEvent.
 *
 * **Example** (Guard a DragEvent)
 *
 * ```ts
 * import { isDragEvent } from "@beep/schema/DomDragEvent"
 *
 * console.log(isDragEvent(new DragEvent("dragstart")))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isDragEvent = (u: unknown): u is DragEvent => u instanceof DragEvent;

/**
 * A DragEvent.
 *
 * **Example** (Decode a DragEvent)
 *
 * ```ts
 * import { DOMDragEvent } from "@beep/schema/DomDragEvent"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(DOMDragEvent)(new DragEvent("dragstart"))
 * console.log(event.type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DOMDragEvent = S.declare(isDragEvent).pipe(
  $I.annoteSchema("DOMDragEvent", {
    description: "A DragEvent",
  })
);

/**
 * Type for {@link DOMDragEvent}.
 *
 * **Example** (Annotate decoded DragEvent)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DOMDragEvent } from "@beep/schema/DomDragEvent"
 *
 * const event: DOMDragEvent = S.decodeUnknownSync(DOMDragEvent)(new DragEvent("dragstart"))
 * console.log(event.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DOMDragEvent = typeof DOMDragEvent.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMDragEvent as DomDragEvent, DOMDragEvent as Schema };

/**
 * Pure structural checks for recorded act frames.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet } from "effect";
import * as A from "effect/Array";
import { ActFrameSlot } from "./ActFrame.values.ts";
import type { ActFrameElementLabel } from "../../values/ActFrameElementRef/index.ts";

/**
 * Tests whether every frame element carries a distinct label.
 *
 * **Example** (Reject a repeated label)
 *
 * ```ts
 * import { hasDistinctLabels } from "@beep/law-practice-domain/entities/ActFrame"
 *
 * console.log(hasDistinctLabels([{ label: "actor" }, { label: "actor" }])) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const hasDistinctLabels = (elements: ReadonlyArray<{ readonly label: ActFrameElementLabel }>): boolean =>
  HashSet.size(HashSet.fromIterable(A.map(elements, (element) => element.label))) === elements.length;

/**
 * Tests whether a frame declares the actor slot required by its grammar.
 *
 * **Example** (Recognize an actor slot)
 *
 * ```ts
 * import { ActFrameSlot, hasActorSlot } from "@beep/law-practice-domain/entities/ActFrame"
 *
 * console.log(typeof hasActorSlot === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const hasActorSlot = (slots: ReadonlyArray<ActFrameSlot>): boolean => A.some(slots, ActFrameSlot.guards.actor);

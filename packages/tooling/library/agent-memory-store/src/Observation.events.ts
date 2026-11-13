/**
 * Observation log events: who read, wrote, restated or updated a node.
 *
 * **Details**
 *
 * Ruling 3: prevalence is an observation log that never ranks or gates.
 * Counts are read only as distinct-lineage counts by consolidation, never by
 * retrieval rank or the admissibility gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Event from "effect/eventlog/Event";
import * as EventGroup from "effect/eventlog/EventGroup";
import * as S from "effect/Schema";
import { isWellFormedText, NodeId } from "./NodeIdentity.models.ts";

const $I = $AgentMemoryStoreId.create("Observation.events");

/**
 * What an observer did with a node.
 *
 * **Example** (Check an observation kind)
 *
 * ```ts
 * import { ObservationKind } from "@beep/agent-memory-store"
 *
 * console.log(ObservationKind.is.restate("restate"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObservationKind = LiteralKit(["read", "write", "restate", "update"]).pipe(
  $I.annoteSchema("ObservationKind", {
    description: "What an observer did with a node.",
  })
);

/**
 * Runtime type for {@link ObservationKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ObservationKind = typeof ObservationKind.Type;

/**
 * Session or agent lineage that made an observation.
 *
 * **Example** (Brand a lineage id)
 *
 * ```ts
 * import { LineageId } from "@beep/agent-memory-store"
 *
 * console.log(LineageId.make("session-42"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LineageId = S.NonEmptyString.check(isWellFormedText).pipe(
  S.brand("LineageId"),
  $I.annoteSchema("LineageId", {
    description: "Session or agent lineage that made an observation.",
  })
);

/**
 * Runtime type for {@link LineageId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LineageId = typeof LineageId.Type;

/**
 * One observation of a node by a lineage.
 *
 * **Details**
 *
 * Consumers read observations only as distinct-lineage counts during
 * consolidation; retrieval rank and the admissibility gate never read them.
 *
 * **Example** (Record a read)
 *
 * ```ts
 * import { LineageId, NodeId, ObservationEvent } from "@beep/agent-memory-store"
 * import * as DateTime from "effect/DateTime"
 *
 * const observation = ObservationEvent.make({
 *   kind: "read",
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   lineage: LineageId.make("session-42"),
 *   at: DateTime.makeUnsafe(0),
 * })
 * console.log(observation.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class ObservationEvent extends S.Opaque<ObservationEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: ObservationKind.annotateKey({ description: "What the observer did." }),
    nodeId: NodeId.annotateKey({ description: "Observed node." }),
    lineage: LineageId.annotateKey({ description: "Lineage that observed the node." }),
    at: S.DateTimeUtcFromString.annotateKey({ description: "When the observation happened." }),
  }).pipe(
    $I.annoteSchema("ObservationEvent", {
      description: "One observation of a node by a lineage.",
    })
  )
) {}

/**
 * Event definition that records one observation, keyed on the `NodeId` string.
 *
 * **Example** (Read the observation event tag)
 *
 * ```ts
 * import { ObservedEvent } from "@beep/agent-memory-store"
 *
 * console.log(ObservedEvent.tag) // "Observed"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ObservedEvent = Event.make({
  tag: "Observed",
  primaryKey: (payload: ObservationEvent) => payload.nodeId,
  payload: ObservationEvent,
});

/**
 * Event group of the observation log, separate from the memory log group.
 *
 * **Example** (Read the observation event group)
 *
 * ```ts
 * import { ObservationEvents } from "@beep/agent-memory-store"
 *
 * console.log(ObservationEvents.events)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ObservationEvents = EventGroup.empty.add(ObservedEvent);

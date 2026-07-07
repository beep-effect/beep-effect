/**
 * WorkItem value objects.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ArchitectureLabDomainId.create("aggregates/WorkItem/WorkItem.values");

/**
 * Branded string identifier for a WorkItem aggregate.
 *
 * @example
 * ```ts
 * import { WorkItemId, type WorkItemId as WorkItemIdValue } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const id: WorkItemIdValue = S.decodeUnknownSync(WorkItemId)("work-item-1")
 *
 * if (id !== "work-item-1") {
 *   throw new Error("expected decoded WorkItem id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkItemId = S.NonEmptyString.pipe(
  S.brand("ArchitectureLabWorkItemId"),
  $I.annoteSchema("WorkItemId", {
    identifier: "WorkItemId",
    title: "WorkItem ID",
    description: "Non-empty stable identifier for the canonical architecture lab WorkItem aggregate.",
  })
);

/**
 * Runtime type for {@link WorkItemId}.
 *
 * @example
 * ```ts
 * import { WorkItemId, type WorkItemId as WorkItemIdValue } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const id: WorkItemIdValue = S.decodeUnknownSync(WorkItemId)("work-item-1")
 * const ids: ReadonlyArray<WorkItemIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected WorkItem id evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkItemId = S.Schema.Type<typeof WorkItemId>;

/**
 * Human-readable title carried by a WorkItem aggregate.
 *
 * @example
 * ```ts
 * import { WorkItemTitle, type WorkItemTitle as WorkItemTitleValue } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const title: WorkItemTitleValue = S.decodeUnknownSync(WorkItemTitle)("Document topology")
 *
 * if (title.length === 0) {
 *   throw new Error("expected title text")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkItemTitle = S.NonEmptyString.pipe(
  $I.annoteSchema("WorkItemTitle", {
    identifier: "WorkItemTitle",
    title: "WorkItem title",
    description: "Non-empty human-readable WorkItem title.",
  })
);

/**
 * Runtime type for {@link WorkItemTitle}.
 *
 * @example
 * ```ts
 * import { WorkItemTitle, type WorkItemTitle as WorkItemTitleValue } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const title: WorkItemTitleValue = S.decodeUnknownSync(WorkItemTitle)("Document topology")
 * const label = `WorkItem: ${title}`
 *
 * if (!label.includes(title)) {
 *   throw new Error("expected title to participate as text")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkItemTitle = S.Schema.Type<typeof WorkItemTitle>;

/**
 * Closed lifecycle vocabulary for WorkItem state transitions.
 *
 * @example
 * ```ts
 * import { WorkItemStatus, type WorkItemStatus as WorkItemStatusValue } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 *
 * const status: WorkItemStatusValue = WorkItemStatus.Enum.assigned
 * const isAssigned = status === "assigned"
 *
 * console.log(isAssigned)
 *
 * if (status !== "assigned") {
 *   throw new Error("expected assigned lifecycle state")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkItemStatus = LiteralKit(["open", "assigned", "completed", "archived"]).pipe(
  $I.annoteSchema("WorkItemStatus", {
    title: "WorkItem status",
    description: "Canonical lifecycle status for the architecture lab WorkItem aggregate.",
  })
);

/**
 * Runtime type for {@link WorkItemStatus}.
 *
 * @example
 * ```ts
 * import type { WorkItemStatus } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 *
 * const terminal: WorkItemStatus = "archived"
 * const isTerminal = terminal === "archived"
 *
 * console.log(isTerminal)
 *
 * if (terminal !== "archived") {
 *   throw new Error("expected terminal WorkItem status")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkItemStatus = typeof WorkItemStatus.Type;

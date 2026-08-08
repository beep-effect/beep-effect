/**
 * Public UI view-model package for the architecture lab proof surface.
 *
 * **Details**
 *
 * This package does not render components directly. It projects canonical
 * architecture-lab domain aggregates into client-renderable read models for
 * proof apps and downstream UI packages.
 *
 * @packageDocumentation
 * @category read-models
 * @since 0.0.0
 */

/**
 * Version marker for the architecture lab UI view-model package.
 *
 * **Example** (Assert expected VERSION value)
 *
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-ui"
 *
 * const expectedVersion: typeof VERSION = "0.0.0"
 * const isExpectedVersion = VERSION === expectedVersion
 *
 * console.log(isExpectedVersion) // true
 *
 * if (!isExpectedVersion) {
 *   throw new Error("unexpected architecture lab UI version")
 * }
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * WorkItem UI namespace for client-renderable WorkItem summaries.
 *
 * **Example** (Map WorkItem to summary)
 *
 * ```ts
 * import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public"
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItem } from "@beep/architecture-lab-ui"
 * import * as S from "effect/Schema"
 *
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *     title: "Document topology"
 *   })
 * )
 * const summary = WorkItem.toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig)
 *
 * if (summary.statusLabel !== "OPEN") {
 *   throw new Error("expected WorkItem namespace to expose UI summary mapping")
 * }
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export * as WorkItem from "./aggregates/WorkItem/index.ts";

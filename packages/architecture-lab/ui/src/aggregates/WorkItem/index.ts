/**
 * WorkItem UI read-model exports.
 *
 * **Example** (WorkItem summary view model)
 *
 * ```ts
 * import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public"
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { toWorkItemSummaryViewModel } from "@beep/architecture-lab-ui/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *     title: "Document topology"
 *   })
 * )
 * const summary = toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig)
 *
 * if (!summary.visibleActions.includes("assign")) {
 *   throw new Error("expected open WorkItem to expose assignment")
 * }
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export * from "./WorkItem.view-model.ts";

/**
 * WorkItem UI read models for architecture-lab proof screens.
 *
 * **Details**
 *
 * The declarations in this module are intentionally presentation-shaped:
 * domain identifiers and statuses are preserved, while display labels and
 * visible action keys are derived for browser-safe consumers.
 *
 * @packageDocumentation
 * @category read-models
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { $ArchitectureLabUiId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { WorkItemPublicConfig } from "@beep/architecture-lab-config/public";

const $I = $ArchitectureLabUiId.create("aggregates/WorkItem/WorkItem.view-model");
const WorkItemVisibleActionBase = LiteralKit(["assign", "complete", "reopen", "archive"]);

/**
 * Closed action vocabulary the WorkItem UI may expose for a summary row.
 *
 * **Example** (Parse archive action)
 *
 * ```ts
 * import { WorkItemVisibleAction } from "@beep/architecture-lab-ui/aggregates/WorkItem"
 *
 * const action = WorkItemVisibleAction.fromUnknown("archive")
 *
 * if (action !== WorkItemVisibleAction.Enum.archive) {
 *   throw new Error("expected archive to be a visible WorkItem action")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkItemVisibleAction = WorkItemVisibleActionBase.pipe(
  $I.annoteSchema("WorkItemVisibleAction", {
    title: "WorkItem visible action",
    description: "Action key exposed by the architecture lab WorkItem UI view model.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  })),
  SchemaUtils.withLiteralKitStatics(WorkItemVisibleActionBase)
);

/**
 * Runtime type for {@link WorkItemVisibleAction}.
 *
 * **Example** (Type assign action values)
 *
 * ```ts
 * import {
 *   WorkItemVisibleAction,
 *   type WorkItemVisibleAction as WorkItemVisibleActionValue
 * } from "@beep/architecture-lab-ui/aggregates/WorkItem"
 *
 * const action: WorkItemVisibleActionValue = WorkItemVisibleAction.Enum.assign
 * const visibleActions: ReadonlyArray<WorkItemVisibleActionValue> = [action]
 * const visibleActionList = visibleActions.join(",")
 *
 * console.log(visibleActionList) // "assign"
 *
 * if (visibleActions[0] !== "assign") {
 *   throw new Error("expected typed visible action evidence")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkItemVisibleAction = typeof WorkItemVisibleAction.Type;

const WorkItemStatusLabel = S.NonEmptyString.check(S.isUppercased()).pipe(
  $I.annoteSchema("WorkItemStatusLabel", {
    title: "WorkItem status label",
    description: "Uppercase display label derived from the canonical WorkItem status.",
  })
);

const VisibleActionList = S.Array(WorkItemVisibleAction)
  .check(S.isMaxLength(3), S.isUnique())
  .pipe(
    $I.annoteSchema("VisibleActionList", {
      title: "Visible action list",
      description: "Unique WorkItem action keys exposed for a summary row.",
    })
  );

/**
 * Client-renderable summary for a canonical WorkItem aggregate.
 *
 * **Example** (Make display-ready summary)
 *
 * ```ts
 * import {
 *   WorkItemSummaryViewModel,
 *   WorkItemVisibleAction
 * } from "@beep/architecture-lab-ui/aggregates/WorkItem"
 * import {
 *   WorkItemId,
 *   WorkItemTitle
 * } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summary = WorkItemSummaryViewModel.make({
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology"),
 *   status: "assigned",
 *   statusLabel: "ASSIGNED",
 *   assigneeLabel: O.some("Assigned to 1"),
 *   visibleActions: [WorkItemVisibleAction.Enum.complete]
 * })
 *
 * if (summary.statusLabel !== "ASSIGNED") {
 *   throw new Error("expected display-ready WorkItem status")
 * }
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class WorkItemSummaryViewModel extends S.Class<WorkItemSummaryViewModel>($I`WorkItemSummaryViewModel`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "Stable identifier of the summarized WorkItem aggregate.",
    }),
    title: DomainWorkItem.WorkItemTitle.annotateKey({
      description: "Human-readable title shown for the WorkItem summary row.",
    }),
    status: DomainWorkItem.WorkItemStatus.annotateKey({
      description: "Canonical lifecycle status that drives summary presentation.",
    }),
    statusLabel: WorkItemStatusLabel.annotateKey({
      description: "Uppercase display label derived from the canonical status.",
    }),
    assigneeLabel: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional display label for the assigned Worker.",
    }),
    visibleActions: VisibleActionList.annotateKey({
      description: "Unique browser-safe action keys currently visible for the WorkItem.",
    }),
  },
  $I.annote("WorkItemSummaryViewModel", {
    title: "WorkItem summary view model",
    description: "Client-renderable summary for the canonical architecture lab WorkItem aggregate.",
  })
) {}

const makeStatusLabel: (status: DomainWorkItem.WorkItemStatus) => string = Str.toUpperCase;

const activeVisibleActions: ReadonlyArray<WorkItemVisibleAction> = [
  WorkItemVisibleAction.Enum.assign,
  WorkItemVisibleAction.Enum.complete,
  WorkItemVisibleAction.Enum.archive,
];
const completedVisibleActions: ReadonlyArray<WorkItemVisibleAction> = [
  WorkItemVisibleAction.Enum.reopen,
  WorkItemVisibleAction.Enum.archive,
];
const noVisibleActions: ReadonlyArray<WorkItemVisibleAction> = A.empty();

const makeVisibleActions = (
  workItem: DomainWorkItem.WorkItem,
  config: WorkItemPublicConfig
): ReadonlyArray<WorkItemVisibleAction> => {
  const baseActions: ReadonlyArray<WorkItemVisibleAction> = DomainWorkItem.WorkItemStatus.$match(workItem.status, {
    open: () => activeVisibleActions,
    assigned: () => activeVisibleActions,
    completed: () => completedVisibleActions,
    archived: () => noVisibleActions,
  });
  return pipe(
    baseActions,
    A.filter((action) => action !== WorkItemVisibleAction.Enum.assign || config.assignmentEnabled),
    A.filter((action) => action !== WorkItemVisibleAction.Enum.reopen || config.reopenCompletedEnabled)
  );
};

/**
 * Project a domain WorkItem into its UI summary read model.
 *
 * **Details**
 *
 * Supports both data-first and config-first forms. The projection uppercases
 * the status label, formats an assignee label when present, and filters
 * visible actions through the browser-safe public WorkItem config.
 *
 * **Example** (Project open WorkItem summary)
 *
 * ```ts
 * import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public"
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { toWorkItemSummaryViewModel } from "@beep/architecture-lab-ui/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const toSummary = toWorkItemSummaryViewModel(defaultWorkItemPublicConfig)
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *     title: "Document topology"
 *   })
 * )
 * const summary = toSummary(workItem)
 *
 * if (summary.statusLabel !== "OPEN" || !summary.visibleActions.includes("complete")) {
 *   throw new Error("expected open WorkItem summary actions")
 * }
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toWorkItemSummaryViewModel: {
  (config: WorkItemPublicConfig): (workItem: DomainWorkItem.WorkItem) => WorkItemSummaryViewModel;
  (workItem: DomainWorkItem.WorkItem, config: WorkItemPublicConfig): WorkItemSummaryViewModel;
} = dual(
  2,
  (workItem: DomainWorkItem.WorkItem, config: WorkItemPublicConfig): WorkItemSummaryViewModel =>
    WorkItemSummaryViewModel.make({
      id: workItem.id,
      title: workItem.title,
      status: workItem.status,
      statusLabel: makeStatusLabel(workItem.status),
      assigneeLabel: pipe(
        workItem.assignee,
        O.map((assignee) => `Assigned to ${assignee}`)
      ),
      visibleActions: makeVisibleActions(workItem, config),
    })
);

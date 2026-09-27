import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import {
  toWorkItemSummaryViewModel,
  WorkItemSummaryViewModel,
  WorkItemVisibleAction,
} from "@beep/architecture-lab-ui/aggregates/WorkItem";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, Equal } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeWorkItemSummaryViewModel = S.decodeEffect(WorkItemSummaryViewModel);
const decodeWorkItemVisibleAction = S.decodeEffect(WorkItemVisibleAction);
const encodeWorkItemSummaryViewModel = S.encodeEffect(WorkItemSummaryViewModel);
const encodeWorkItemVisibleAction = S.encodeEffect(WorkItemVisibleAction);
const isWorkItemSummaryViewModel = S.is(WorkItemSummaryViewModel);

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);
const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const WorkItemVisibleActionArbitrary = Arbitrary.schema(WorkItemVisibleAction);
const WorkItemSummaryViewModelArbitrary = Arbitrary.schema(WorkItemSummaryViewModel);
const WorkItemArbitrary = Arbitrary.schema(DomainWorkItem.WorkItem);

describe("WorkItem UI view model", () => {
  it.effect(
    "derives status labels from the canonical status value",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const workItem = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Document topology",
        })
      );

      expect(toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig).statusLabel).toBe("OPEN");
    })
  );

  it.effect(
    "exposes archive as terminal",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const workItem = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Document topology",
        })
      );
      const archived = DomainWorkItem.WorkItem.make({
        ...workItem,
        status: "archived",
      });

      expect(toWorkItemSummaryViewModel(archived, defaultWorkItemPublicConfig).visibleActions).toEqual([]);
    })
  );

  it.effect(
    "keeps encoded summary wire shape byte-identical",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const assignee = yield* decodeWorkerId(1);
      const workItem = yield* DomainWorkItem.assign(
        DomainWorkItem.create(
          DomainWorkItem.CreateWorkItemInput.make({
            id,
            title: "Document topology",
          })
        ),
        assignee
      );

      expect(
        yield* encodeWorkItemSummaryViewModel(toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig))
      ).toEqual({
        id: "work-item-1",
        title: "Document topology",
        status: "assigned",
        statusLabel: "ASSIGNED",
        assigneeLabel: "Assigned to 1",
        visibleActions: ["assign", "complete", "archive"],
      });
    })
  );

  it.effect(
    "defaults absent assignee labels without changing encoded absence",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const summary = WorkItemSummaryViewModel.make({
        id,
        title: "Document topology",
        status: DomainWorkItem.WorkItemStatus.Enum.open,
        statusLabel: "OPEN",
        visibleActions: [WorkItemVisibleAction.Enum.assign],
      });

      assertNone(summary.assigneeLabel);
      expect(yield* encodeWorkItemSummaryViewModel(summary)).toEqual({
        id: "work-item-1",
        title: "Document topology",
        status: "open",
        statusLabel: "OPEN",
        visibleActions: ["assign"],
      });
    })
  );

  it.effect.prop(
    "round-trips schema-derived visible actions",
    [WorkItemVisibleActionArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeWorkItemVisibleAction(value);
        const decoded = yield* decodeWorkItemVisibleAction(encoded);
        expect(Equal.equals(decoded, value)).toBe(true);
      }),
    { arbitrary: fcRuns(20) }
  );
  it.effect.prop(
    "round-trips schema-derived summaries",
    [WorkItemSummaryViewModelArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeWorkItemSummaryViewModel(value);
        const decoded = yield* decodeWorkItemSummaryViewModel(encoded);
        expect(Equal.equals(decoded, value)).toBe(true);
      }),
    { arbitrary: fcRuns(20) }
  );
  it.effect.prop(
    "emits schema-accepted summaries for generated WorkItems",
    [WorkItemArbitrary],
    ([workItem]) =>
      Effect.sync(() => {
        expect(isWorkItemSummaryViewModel(toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig))).toBe(
          true
        );
      }),
    { arbitrary: fcRuns(20) }
  );
});

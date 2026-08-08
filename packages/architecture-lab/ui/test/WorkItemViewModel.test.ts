import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import {
  toWorkItemSummaryViewModel,
  WorkItemSummaryViewModel,
  WorkItemVisibleAction,
} from "@beep/architecture-lab-ui/aggregates/WorkItem";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);
const decodeWorkerId = S.decodeUnknownEffect(DomainWorker.WorkerId);
const WorkItemVisibleActionArbitrary = S.toArbitrary(WorkItemVisibleAction);
const WorkItemSummaryViewModelArbitrary = S.toArbitrary(WorkItemSummaryViewModel);
const WorkItemArbitrary = S.toArbitrary(DomainWorkItem.WorkItem);

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
        yield* S.encodeEffect(WorkItemSummaryViewModel)(
          toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig)
        )
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

      expect(O.isNone(summary.assigneeLabel)).toBe(true);
      expect(yield* S.encodeEffect(WorkItemSummaryViewModel)(summary)).toEqual({
        id: "work-item-1",
        title: "Document topology",
        status: "open",
        statusLabel: "OPEN",
        visibleActions: ["assign"],
      });
    })
  );

  it("round-trips touched schemas with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(WorkItemVisibleActionArbitrary, (value) => {
        expect(
          Equal.equals(S.decodeSync(WorkItemVisibleAction)(S.encodeSync(WorkItemVisibleAction)(value)), value)
        ).toBe(true);
      }),
      fcRuns(20)
    );

    fc.assert(
      fc.property(WorkItemSummaryViewModelArbitrary, (value) => {
        expect(
          Equal.equals(S.decodeSync(WorkItemSummaryViewModel)(S.encodeSync(WorkItemSummaryViewModel)(value)), value)
        ).toBe(true);
      }),
      fcRuns(20)
    );
  });

  it("emits schema-accepted summaries for generated WorkItems", () => {
    const isSummary = S.is(WorkItemSummaryViewModel);

    fc.assert(
      fc.property(WorkItemArbitrary, (workItem) => {
        expect(isSummary(toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig))).toBe(true);
      }),
      fcRuns(20)
    );
  });
});

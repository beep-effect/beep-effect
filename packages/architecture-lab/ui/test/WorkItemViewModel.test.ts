import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import {
  toWorkItemSummaryViewModel,
  WorkItemSummaryViewModel,
  WorkItemVisibleAction,
} from "@beep/architecture-lab-ui/aggregates/WorkItem";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
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

      expect(O.isNone(summary.assigneeLabel)).toBe(true);
      expect(yield* encodeWorkItemSummaryViewModel(summary)).toEqual({
        id: "work-item-1",
        title: "Document topology",
        status: "open",
        statusLabel: "OPEN",
        visibleActions: ["assign"],
      });
    })
  );

  it.effect("round-trips touched schemas with schema-derived arbitraries", () =>
    Effect.gen(function* () {
      const actions = yield* Arbitrary.checkEffect(
        Arbitrary.all([WorkItemVisibleActionArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeWorkItemVisibleAction(value);
            const decoded = yield* decodeWorkItemVisibleAction(encoded);
            expect(Equal.equals(decoded, value)).toBe(true);

            return true;
          }),
        fcRuns(20)
      );
      expect(actions._tag).toBe("Passed");

      const summaries = yield* Arbitrary.checkEffect(
        Arbitrary.all([WorkItemSummaryViewModelArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeWorkItemSummaryViewModel(value);
            const decoded = yield* decodeWorkItemSummaryViewModel(encoded);
            expect(Equal.equals(decoded, value)).toBe(true);

            return true;
          }),
        fcRuns(20)
      );
      expect(summaries._tag).toBe("Passed");
    })
  );

  it("emits schema-accepted summaries for generated WorkItems", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([WorkItemArbitrary]),
          ([workItem]) => {
            expect(isWorkItemSummaryViewModel(toWorkItemSummaryViewModel(workItem, defaultWorkItemPublicConfig))).toBe(
              true
            );

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });
});

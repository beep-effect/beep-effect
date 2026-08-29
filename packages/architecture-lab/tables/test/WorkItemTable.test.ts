import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as WorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { fromWorkItemRow, toWorkItemInsert, workItemTable } from "@beep/architecture-lab-tables/aggregates/WorkItem";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns, getTableName } from "drizzle-orm";
import { DateTime, Effect, Option as O } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);
const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const WorkItemArbitrary = S.toArbitrary(DomainWorkItem.WorkItem)(fc);
const WorkItemEquivalence = S.toEquivalence(DomainWorkItem.WorkItem);
const fixedTimestamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));

describe("WorkItem table", () => {
  it.effect(
    "projects the WorkItem aggregate into the architecture lab table",
    Effect.fnUntraced(function* () {
      const workerId = yield* decodeWorkerId(1);
      const id = yield* decodeWorkItemId("work-item-1");
      const workItem = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Document topology",
          priority: O.some(WorkPriority.WorkPriority.Enum.high),
        })
      );

      const row = toWorkItemInsert(DomainWorkItem.WorkItem.make({ ...workItem, assignee: O.some(workerId) }));
      const columns = getColumns(workItemTable);

      expect(getTableName(workItemTable)).toBe("architecture_lab_work_item");
      expect(columns.assigneeId.name).toBe("assignee_id");
      expect(toWorkItemInsert(workItem)).toEqual({
        id,
        title: "Document topology",
        status: "open",
        assigneeId: null,
        priority: WorkPriority.WorkPriority.Enum.high,
      });
      expect(row).toEqual({
        id,
        title: "Document topology",
        status: "open",
        assigneeId: workerId,
        priority: WorkPriority.WorkPriority.Enum.high,
      });
      expect(row.assigneeId).toBe(workerId);
      expect(row.priority).toBe("high");
      expect(
        O.getOrThrow(
          fromWorkItemRow({
            ...row,
            assigneeId: workerId,
            priority: WorkPriority.WorkPriority.Enum.high,
            createdAt: fixedTimestamp,
            updatedAt: fixedTimestamp,
          }).assignee
        )
      ).toBe(workerId);
    })
  );

  it("round-trips schema-derived WorkItems through the row converters", () =>
    fc.assert(
      fc.property(WorkItemArbitrary, (workItem) => {
        const insert = toWorkItemInsert(workItem);
        const decoded = fromWorkItemRow({
          ...insert,
          assigneeId: insert.assigneeId ?? null,
          priority: insert.priority ?? null,
          createdAt: fixedTimestamp,
          updatedAt: fixedTimestamp,
        });

        expect(WorkItemEquivalence(decoded, workItem)).toBe(true);
      }),
      fcRuns(50)
    ));
});

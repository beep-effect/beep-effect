import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { WorkItem } from "@beep/architecture-lab-use-cases/public";
import * as WorkItemServer from "@beep/architecture-lab-use-cases/server";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);

const makeRepository = (workItemId: DomainWorkItem.WorkItemId): WorkItemServer.WorkItem.WorkItemRepositoryShape => {
  const initial = DomainWorkItem.create(
    DomainWorkItem.CreateWorkItemInput.make({
      id: workItemId,
      title: "Document topology",
    })
  );
  let current = initial;
  return {
    create: (workItem) => Effect.succeed(workItem),
    save: (workItem) =>
      workItem.id === current.id
        ? Effect.sync(() => {
            current = workItem;
            return workItem;
          })
        : Effect.fail(
            WorkItemServer.WorkItem.WorkItemRepositoryNotFound.make({
              workItemId: workItem.id,
            })
          ),
    get: (id) =>
      id === current.id
        ? Effect.succeed(current)
        : Effect.fail(
            WorkItemServer.WorkItem.WorkItemRepositoryNotFound.make({
              workItemId: id,
            })
          ),
    list: Effect.sync(() => [current]),
  };
};

describe("WorkItem use-cases", () => {
  it.effect(
    "creates and lists work items through the repository port",
    Effect.fnUntraced(function* () {
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const useCases = WorkItemServer.WorkItem.makeWorkItemUseCases(makeRepository(workItemId));

      const created = yield* useCases.create(
        WorkItem.CreateWorkItemCommand.make({ id: workItemId, title: "Document topology" })
      );
      const listed = yield* useCases.list(WorkItem.ListWorkItemsQuery.make({}));

      expect(created.id).toBe(workItemId);
      expect(listed).toHaveLength(1);
    })
  );

  it.effect(
    "redacts repository unavailable details at the public action boundary",
    Effect.fnUntraced(function* () {
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const useCases = WorkItemServer.WorkItem.makeWorkItemUseCases({
        create: () =>
          Effect.fail(
            WorkItemServer.WorkItem.WorkItemRepositoryUnavailable.make({
              reason: "insert WorkItem failed against architecture_lab_work_item",
            })
          ),
        get: () =>
          Effect.fail(
            WorkItemServer.WorkItem.WorkItemRepositoryUnavailable.make({
              reason: "select WorkItem failed against architecture_lab_work_item",
            })
          ),
        list: Effect.fail(
          WorkItemServer.WorkItem.WorkItemRepositoryUnavailable.make({
            reason: "list WorkItem failed against architecture_lab_work_item",
          })
        ),
        save: () =>
          Effect.fail(
            WorkItemServer.WorkItem.WorkItemRepositoryUnavailable.make({
              reason: "update WorkItem failed against architecture_lab_work_item",
            })
          ),
      });

      const error = yield* useCases
        .create(
          WorkItem.CreateWorkItemCommand.make({
            id: workItemId,
            title: "Document topology",
          })
        )
        .pipe(Effect.flip);

      expect(error._tag).toBe("WorkItemActionFailed");
      if (error._tag !== "WorkItemActionFailed") {
        return;
      }
      expect(error.reason).toBe(WorkItem.WORK_ITEM_ACTION_UNAVAILABLE_REASON);
    })
  );

  it.effect(
    "translates repository not-found failures to public failures",
    Effect.fnUntraced(function* () {
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const missingWorkItemId = yield* decodeWorkItemId("missing");
      const useCases = WorkItemServer.WorkItem.makeWorkItemUseCases(makeRepository(workItemId));
      const error = yield* useCases
        .get(
          WorkItem.GetWorkItemQuery.make({
            id: missingWorkItemId,
          })
        )
        .pipe(Effect.flip);

      expect(error._tag).toBe("WorkItemNotFound");
    })
  );

  it.effect(
    "keeps archive terminal at the use-case boundary",
    Effect.fnUntraced(function* () {
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const useCases = WorkItemServer.WorkItem.makeWorkItemUseCases(makeRepository(workItemId));
      yield* useCases.archive(WorkItem.ArchiveWorkItemCommand.make({ id: workItemId }));

      const error = yield* useCases.reopen(WorkItem.ReopenWorkItemCommand.make({ id: workItemId })).pipe(Effect.flip);
      expect(error._tag).toBe("WorkItemActionRejected");
    })
  );
});

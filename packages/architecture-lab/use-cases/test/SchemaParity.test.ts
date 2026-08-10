import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { Worker, WorkItem } from "@beep/architecture-lab-use-cases/public";
import * as UseCaseServer from "@beep/architecture-lab-use-cases/server";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const workItemId = Result.getOrThrow(S.decodeResult(DomainWorkItem.WorkItemId)("work-item-1"));
const workerId = Result.getOrThrow(S.decodeResult(DomainWorker.WorkerId)(1));
const organizationId = Result.getOrThrow(S.decodeResult(DomainWorker.WorkerOrganizationId)(10));

const schemaParityCases: ReadonlyArray<readonly [string, S.Codec<unknown>]> = [
  ["CreateWorkItemCommand", WorkItem.CreateWorkItemCommand],
  ["AssignWorkItemCommand", WorkItem.AssignWorkItemCommand],
  ["CompleteWorkItemCommand", WorkItem.CompleteWorkItemCommand],
  ["ReopenWorkItemCommand", WorkItem.ReopenWorkItemCommand],
  ["ArchiveWorkItemCommand", WorkItem.ArchiveWorkItemCommand],
  ["GetWorkItemQuery", WorkItem.GetWorkItemQuery],
  ["ListWorkItemsQuery", WorkItem.ListWorkItemsQuery],
  ["WorkItemActionError", WorkItem.WorkItemActionError],
  ["WorkItemRepositoryError", UseCaseServer.WorkItem.WorkItemRepositoryError],
  ["CreateWorkerCommand", Worker.CreateWorkerCommand],
  ["GetWorkerQuery", Worker.GetWorkerQuery],
  ["ListWorkersQuery", Worker.ListWorkersQuery],
  ["WorkerActionError", Worker.WorkerActionError],
  ["WorkerRepositoryError", UseCaseServer.Worker.WorkerRepositoryError],
];

describe("@beep/architecture-lab-use-cases schema parity", () => {
  it("round-trips touched schemas with schema-derived arbitraries", () => {
    for (const [, schema] of schemaParityCases) {
      const encode = S.encodeResult(schema);
      const decode = S.decodeUnknownResult(schema);
      const equivalent = S.toEquivalence(schema);

      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => {
          const encoded = Result.getOrThrow(encode(value));
          const decoded = Result.getOrThrow(decode(encoded));

          expect(equivalent(decoded, value)).toBe(true);
        }),
        fcRuns(10)
      );
    }
  });

  it("preserves command and query encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        S.encodeResult(WorkItem.CreateWorkItemCommand)(
          WorkItem.CreateWorkItemCommand.make({
            id: workItemId,
            title: "Document topology",
          })
        )
      )
    ).toStrictEqual({
      id: "work-item-1",
      title: "Document topology",
    });

    expect(
      Result.getOrThrow(
        S.encodeResult(WorkItem.CreateWorkItemCommand)(
          WorkItem.CreateWorkItemCommand.make({
            id: workItemId,
            title: "Document topology",
            priority: O.some("high"),
          })
        )
      )
    ).toStrictEqual({
      id: "work-item-1",
      priority: "high",
      title: "Document topology",
    });

    expect(
      Result.getOrThrow(S.encodeResult(WorkItem.ListWorkItemsQuery)(WorkItem.ListWorkItemsQuery.make({})))
    ).toStrictEqual({});

    expect(
      Result.getOrThrow(
        S.encodeResult(Worker.CreateWorkerCommand)(
          Worker.CreateWorkerCommand.make({
            id: workerId,
            organizationId,
            displayName: "Ada Lovelace",
          })
        )
      )
    ).toStrictEqual({
      displayName: "Ada Lovelace",
      id: 1,
      organizationId: 10,
    });

    expect(Result.getOrThrow(S.encodeResult(Worker.ListWorkersQuery)(Worker.ListWorkersQuery.make({})))).toStrictEqual(
      {}
    );
  });

  it("preserves public and repository error encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        S.encodeResult(UseCaseServer.WorkItem.WorkItemRepositoryError)(
          UseCaseServer.WorkItem.WorkItemRepositoryConflict.make({
            workItemId,
            reason: "duplicate id",
          })
        )
      )
    ).toStrictEqual({
      _tag: "WorkItemRepositoryConflict",
      reason: "duplicate id",
      workItemId: "work-item-1",
    });

    expect(
      Result.getOrThrow(
        S.encodeResult(WorkItem.WorkItemActionError)(
          WorkItem.WorkItemActionRejected.make({
            workItemId,
            reason: "WorkItemAlreadyArchived",
          })
        )
      )
    ).toStrictEqual({
      _tag: "WorkItemActionRejected",
      reason: "WorkItemAlreadyArchived",
      workItemId: "work-item-1",
    });

    expect(
      Result.getOrThrow(
        S.encodeResult(UseCaseServer.Worker.WorkerRepositoryError)(
          UseCaseServer.Worker.WorkerRepositoryUnavailable.make({
            reason: "maintenance",
          })
        )
      )
    ).toStrictEqual({
      _tag: "WorkerRepositoryUnavailable",
      reason: "maintenance",
    });

    expect(
      Result.getOrThrow(
        S.encodeResult(Worker.WorkerActionError)(
          Worker.WorkerConflict.make({
            workerId,
            reason: "Worker already exists",
          })
        )
      )
    ).toStrictEqual({
      _tag: "WorkerConflict",
      reason: "Worker already exists",
      workerId: 1,
    });
  });
});

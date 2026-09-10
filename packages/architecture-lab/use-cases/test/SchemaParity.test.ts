import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { Worker, WorkItem } from "@beep/architecture-lab-use-cases/public";
import * as UseCaseServer from "@beep/architecture-lab-use-cases/server";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const encodeUseCaseServerWorkItemWorkItemRepositoryErrorResult = S.encodeResult(
  UseCaseServer.WorkItem.WorkItemRepositoryError
);
const encodeUseCaseServerWorkerWorkerRepositoryErrorResult = S.encodeResult(UseCaseServer.Worker.WorkerRepositoryError);
const encodeWorkItemCreateWorkItemCommandResult = S.encodeResult(WorkItem.CreateWorkItemCommand);
const encodeWorkItemListWorkItemsQueryResult = S.encodeResult(WorkItem.ListWorkItemsQuery);
const encodeWorkItemWorkItemActionErrorResult = S.encodeResult(WorkItem.WorkItemActionError);
const encodeWorkerCreateWorkerCommandResult = S.encodeResult(Worker.CreateWorkerCommand);
const encodeWorkerListWorkersQueryResult = S.encodeResult(Worker.ListWorkersQuery);
const encodeWorkerWorkerActionErrorResult = S.encodeResult(Worker.WorkerActionError);

const workItemId = Result.getOrThrow(S.decodeResult(DomainWorkItem.WorkItemId)("work-item-1"));
const workerId = Result.getOrThrow(S.decodeResult(ArchitectureLabIdentity.WorkerId)(1));
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

      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([Arbitrary.schema(schema)]),
            ([value]) => {
              const encoded = Result.getOrThrow(encode(value));
              const decoded = Result.getOrThrow(decode(encoded));

              expect(equivalent(decoded, value)).toBe(true);

              return true;
            },
            fcRuns(10)
          )
        )._tag
      ).toBe("Passed");
    }
  });

  it("preserves command and query encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        encodeWorkItemCreateWorkItemCommandResult(
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
        encodeWorkItemCreateWorkItemCommandResult(
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
      Result.getOrThrow(encodeWorkItemListWorkItemsQueryResult(WorkItem.ListWorkItemsQuery.make({})))
    ).toStrictEqual({});

    expect(
      Result.getOrThrow(
        encodeWorkerCreateWorkerCommandResult(
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

    expect(Result.getOrThrow(encodeWorkerListWorkersQueryResult(Worker.ListWorkersQuery.make({})))).toStrictEqual({});
  });

  it("preserves public and repository error encoded wire shapes", () => {
    expect(
      Result.getOrThrow(
        encodeUseCaseServerWorkItemWorkItemRepositoryErrorResult(
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
        encodeWorkItemWorkItemActionErrorResult(
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
        encodeUseCaseServerWorkerWorkerRepositoryErrorResult(
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
        encodeWorkerWorkerActionErrorResult(
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

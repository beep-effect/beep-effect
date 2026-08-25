import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import {
  WorkItemActionFailed,
  WorkItemActionRejected,
  WorkItemConflict,
  WorkItemNotFound,
} from "@beep/architecture-lab-use-cases/aggregates/WorkItem";
import {
  WorkItemRepositoryConflict,
  WorkItemRepositoryNotFound,
  WorkItemRepositoryUnavailable,
} from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server";
import { WorkerActionFailed, WorkerConflict, WorkerNotFound } from "@beep/architecture-lab-use-cases/entities/Worker";
import {
  WorkerRepositoryConflict,
  WorkerRepositoryNotFound,
  WorkerRepositoryUnavailable,
} from "@beep/architecture-lab-use-cases/entities/Worker/server";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  a: Schema["Type"],
  b: Schema["Type"],
  c: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(a, b)).toBe(true);
  expect(same(a, c)).toBe(false);
};

const workItemId = DomainWorkItem.WorkItemId.make("work-item-1");
const otherWorkItemId = DomainWorkItem.WorkItemId.make("work-item-2");
const workerId = ArchitectureLabIdentity.WorkerId.make(1);
const otherWorkerId = ArchitectureLabIdentity.WorkerId.make(2);

describe("architecture-lab-use-cases tagged-error declared equivalence", () => {
  it("compares every public WorkItem error by its declared fields", () => {
    expectDeclaredEquivalence(
      WorkItemNotFound,
      WorkItemNotFound.make({ workItemId }),
      WorkItemNotFound.make({ workItemId }),
      WorkItemNotFound.make({ workItemId: otherWorkItemId })
    );
    expectDeclaredEquivalence(
      WorkItemConflict,
      WorkItemConflict.make({ workItemId, reason: "already exists" }),
      WorkItemConflict.make({ workItemId, reason: "already exists" }),
      WorkItemConflict.make({ workItemId, reason: "stale version" })
    );
    expectDeclaredEquivalence(
      WorkItemActionRejected,
      WorkItemActionRejected.make({ workItemId, reason: "already archived" }),
      WorkItemActionRejected.make({ workItemId, reason: "already archived" }),
      WorkItemActionRejected.make({ workItemId, reason: "assignee required" })
    );
    expectDeclaredEquivalence(
      WorkItemActionFailed,
      WorkItemActionFailed.make({ reason: "service unavailable" }),
      WorkItemActionFailed.make({ reason: "service unavailable" }),
      WorkItemActionFailed.make({ reason: "request timed out" })
    );
  });

  it("compares every WorkItem repository error by its declared fields", () => {
    expectDeclaredEquivalence(
      WorkItemRepositoryNotFound,
      WorkItemRepositoryNotFound.make({ workItemId }),
      WorkItemRepositoryNotFound.make({ workItemId }),
      WorkItemRepositoryNotFound.make({ workItemId: otherWorkItemId })
    );
    expectDeclaredEquivalence(
      WorkItemRepositoryConflict,
      WorkItemRepositoryConflict.make({ workItemId, reason: "duplicate id" }),
      WorkItemRepositoryConflict.make({ workItemId, reason: "duplicate id" }),
      WorkItemRepositoryConflict.make({ workItemId, reason: "stale version" })
    );
    expectDeclaredEquivalence(
      WorkItemRepositoryUnavailable,
      WorkItemRepositoryUnavailable.make({ reason: "database unavailable" }),
      WorkItemRepositoryUnavailable.make({ reason: "database unavailable" }),
      WorkItemRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
  });

  it("compares every public Worker error by its declared fields", () => {
    expectDeclaredEquivalence(
      WorkerNotFound,
      WorkerNotFound.make({ workerId }),
      WorkerNotFound.make({ workerId }),
      WorkerNotFound.make({ workerId: otherWorkerId })
    );
    expectDeclaredEquivalence(
      WorkerConflict,
      WorkerConflict.make({ workerId, reason: "already exists" }),
      WorkerConflict.make({ workerId, reason: "already exists" }),
      WorkerConflict.make({ workerId, reason: "stale version" })
    );
    expectDeclaredEquivalence(
      WorkerActionFailed,
      WorkerActionFailed.make({ reason: "service unavailable" }),
      WorkerActionFailed.make({ reason: "service unavailable" }),
      WorkerActionFailed.make({ reason: "request timed out" })
    );
  });

  it("compares every Worker repository error by its declared fields", () => {
    expectDeclaredEquivalence(
      WorkerRepositoryNotFound,
      WorkerRepositoryNotFound.make({ workerId }),
      WorkerRepositoryNotFound.make({ workerId }),
      WorkerRepositoryNotFound.make({ workerId: otherWorkerId })
    );
    expectDeclaredEquivalence(
      WorkerRepositoryConflict,
      WorkerRepositoryConflict.make({ workerId, reason: "duplicate id" }),
      WorkerRepositoryConflict.make({ workerId, reason: "duplicate id" }),
      WorkerRepositoryConflict.make({ workerId, reason: "stale version" })
    );
    expectDeclaredEquivalence(
      WorkerRepositoryUnavailable,
      WorkerRepositoryUnavailable.make({ reason: "database unavailable" }),
      WorkerRepositoryUnavailable.make({ reason: "database unavailable" }),
      WorkerRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
  });
});

import {
  WorkItemAlreadyArchived,
  WorkItemAssigneeRequired,
  WorkItemId,
  WorkItemInvalidTransition,
} from "@beep/architecture-lab-domain/aggregates/WorkItem";
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

const workItemId = WorkItemId.make("work-item-1");
const otherWorkItemId = WorkItemId.make("work-item-2");

describe("architecture-lab-domain tagged-error declared equivalence", () => {
  it("compares every WorkItem domain error by its declared fields", () => {
    expectDeclaredEquivalence(
      WorkItemAlreadyArchived,
      WorkItemAlreadyArchived.make({ workItemId }),
      WorkItemAlreadyArchived.make({ workItemId }),
      WorkItemAlreadyArchived.make({ workItemId: otherWorkItemId })
    );
    expectDeclaredEquivalence(
      WorkItemInvalidTransition,
      WorkItemInvalidTransition.make({ workItemId, from: "open", to: "assigned" }),
      WorkItemInvalidTransition.make({ workItemId, from: "open", to: "assigned" }),
      WorkItemInvalidTransition.make({ workItemId, from: "assigned", to: "completed" })
    );
    expectDeclaredEquivalence(
      WorkItemAssigneeRequired,
      WorkItemAssigneeRequired.make({ workItemId }),
      WorkItemAssigneeRequired.make({ workItemId }),
      WorkItemAssigneeRequired.make({ workItemId: otherWorkItemId })
    );
  });
});

import * as WorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as Worker from "@beep/architecture-lab-domain/entities/Worker";
import * as WorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWorkItemId = S.decodeUnknownEffect(WorkItem.WorkItemId);
const decodeWorkerId = S.decodeUnknownEffect(Worker.WorkerId);
const encodeCreateWorkItemInput = S.encodeUnknownSync(WorkItem.CreateWorkItemInput);
const encodeWorkItem = S.encodeUnknownSync(WorkItem.WorkItem);

const assertSchemaEncodedRoundTrips = <Schema extends S.Codec<unknown, unknown>>(
  schema: Schema,
  numRuns = 10
): void => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeUnknownSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(decode(encode(value)), value)),
    { numRuns }
  );
};

const makeWorkItem = (id: WorkItem.WorkItemId) =>
  WorkItem.create(
    WorkItem.CreateWorkItemInput.make({
      id,
      title: "Document topology",
      priority: O.some(WorkPriority.WorkPriority.Enum.high),
    })
  );

describe("WorkItem aggregate", () => {
  it("round-trips schema-derived arbitrary values", () => {
    assertSchemaEncodedRoundTrips(WorkPriority.WorkPriority);
    assertSchemaEncodedRoundTrips(Worker.WorkerStatus);
    assertSchemaEncodedRoundTrips(Worker.CreateWorkerInput);
    assertSchemaEncodedRoundTrips(Worker.Worker);
    assertSchemaEncodedRoundTrips(WorkItem.WorkItemId);
    assertSchemaEncodedRoundTrips(WorkItem.WorkItemTitle);
    assertSchemaEncodedRoundTrips(WorkItem.WorkItemStatus);
    assertSchemaEncodedRoundTrips(WorkItem.CreateWorkItemInput);
    assertSchemaEncodedRoundTrips(WorkItem.WorkItem);
    assertSchemaEncodedRoundTrips(WorkItem.WorkItemDomainError);
  });

  it.effect(
    "keeps encoded WorkItem wire shape stable after constructor defaults",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const input = WorkItem.CreateWorkItemInput.make({
        id,
        title: "Document topology",
      });

      expect(encodeCreateWorkItemInput(input)).toEqual({
        id: "work-item-1",
        title: "Document topology",
      });

      expect(encodeWorkItem(WorkItem.create(input))).toEqual({
        id: "work-item-1",
        priority: "normal",
        status: "open",
        title: "Document topology",
      });

      expect(
        encodeWorkItem(
          WorkItem.WorkItem.make({
            id,
            priority: O.some(WorkPriority.WorkPriority.Enum.high),
            status: "assigned",
            title: "Document topology",
          })
        )
      ).toEqual({
        id: "work-item-1",
        priority: "high",
        status: "assigned",
        title: "Document topology",
      });
    })
  );

  it.effect(
    "moves through assignment, completion, reopen, and archive",
    Effect.fnUntraced(function* () {
      const workerId = yield* decodeWorkerId(1);
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const assigned = yield* WorkItem.assign(makeWorkItem(workItemId), workerId);
      expect(assigned.status).toBe("assigned");
      expect(O.getOrThrow(assigned.assignee)).toBe(workerId);
      expect(O.getOrThrow(assigned.priority)).toBe("high");

      const completed = yield* WorkItem.complete(assigned);
      expect(completed.status).toBe("completed");

      const reopened = yield* WorkItem.reopen(completed);
      expect(reopened.status).toBe("open");

      const archived = yield* WorkItem.archive(reopened);
      expect(archived.status).toBe("archived");
    })
  );

  it.effect(
    "rejects reopening an archived WorkItem",
    Effect.fnUntraced(function* () {
      const workItemId = yield* decodeWorkItemId("work-item-1");
      const archived = yield* WorkItem.archive(makeWorkItem(workItemId));
      const exit = yield* WorkItem.reopen(archived).pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    })
  );
});

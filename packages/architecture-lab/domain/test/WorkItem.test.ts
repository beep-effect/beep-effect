import * as WorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as Worker from "@beep/architecture-lab-domain/entities/Worker";
import * as WorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeWorkItemId = S.decodeUnknownEffect(WorkItem.WorkItemId);
const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const encodeCreateWorkItemInput = S.encodeUnknownEffect(WorkItem.CreateWorkItemInput);
const encodeWorkItem = S.encodeUnknownEffect(WorkItem.WorkItem);

const assertSchemaEncodedRoundTrips = Effect.fn("assertSchemaEncodedRoundTrips")(function* <
  Schema extends S.Codec<unknown, unknown>,
>(schema: Schema, runs = 10) {
  const equivalent = S.toEquivalence(schema);
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeUnknownEffect(schema)(value);
        const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
        return equivalent(decoded, value);
      }),
    { runs }
  );
  expect(result._tag).toBe("Passed");
});

const makeWorkItem = (id: WorkItem.WorkItemId) =>
  WorkItem.create(
    WorkItem.CreateWorkItemInput.make({
      id,
      title: "Document topology",
      priority: O.some(WorkPriority.WorkPriority.Enum.high),
    })
  );

describe("WorkItem aggregate", () => {
  it.effect("round-trips schema-derived arbitrary values", () =>
    Effect.gen(function* () {
      yield* assertSchemaEncodedRoundTrips(WorkPriority.WorkPriority);
      yield* assertSchemaEncodedRoundTrips(Worker.WorkerStatus);
      yield* assertSchemaEncodedRoundTrips(Worker.CreateWorkerInput);
      yield* assertSchemaEncodedRoundTrips(Worker.Worker);
      yield* assertSchemaEncodedRoundTrips(WorkItem.WorkItemId);
      yield* assertSchemaEncodedRoundTrips(WorkItem.WorkItemTitle);
      yield* assertSchemaEncodedRoundTrips(WorkItem.WorkItemStatus);
      yield* assertSchemaEncodedRoundTrips(WorkItem.CreateWorkItemInput);
      yield* assertSchemaEncodedRoundTrips(WorkItem.WorkItem);
      yield* assertSchemaEncodedRoundTrips(WorkItem.WorkItemDomainError);
    })
  );

  it.effect(
    "keeps encoded WorkItem wire shape stable after constructor defaults",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const input = WorkItem.CreateWorkItemInput.make({
        id,
        title: "Document topology",
      });

      expect(yield* encodeCreateWorkItemInput(input)).toEqual({
        id: "work-item-1",
        title: "Document topology",
      });

      expect(yield* encodeWorkItem(WorkItem.create(input))).toEqual({
        id: "work-item-1",
        priority: "normal",
        status: "open",
        title: "Document topology",
      });

      expect(
        yield* encodeWorkItem(
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

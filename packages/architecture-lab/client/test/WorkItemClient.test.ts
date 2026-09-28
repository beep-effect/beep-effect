import { VERSION } from "@beep/architecture-lab-client";
import { makeWorkItemClient } from "@beep/architecture-lab-client/aggregates/WorkItem";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);

describe("WorkItem client", () => {
  it("exposes the client facade version", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it.effect(
    "delegates through a client-safe transport",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const created = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Document topology",
        })
      );
      const observedGet = yield* Ref.make(O.none<WorkItemUseCases.GetWorkItemQuery>());
      const client = makeWorkItemClient({
        create: () => Effect.die("Unexpected transport operation: create"),
        assign: () => Effect.die("Unexpected transport operation: assign"),
        complete: () => Effect.die("Unexpected transport operation: complete"),
        reopen: () => Effect.die("Unexpected transport operation: reopen"),
        archive: () => Effect.die("Unexpected transport operation: archive"),
        get: Effect.fn("ArchitectureWorkItemClientTest.get")(function* (query: WorkItemUseCases.GetWorkItemQuery) {
          yield* Ref.set(observedGet, O.some(query));
          return created;
        }),
        list: () => Effect.die("Unexpected transport operation: list"),
      });

      const workItem = yield* client.get(WorkItemUseCases.GetWorkItemQuery.make({ id: created.id }));
      assertNone(workItem.assignee);
      assertSome(yield* Ref.get(observedGet), WorkItemUseCases.GetWorkItemQuery.make({ id: created.id }));
      expect(workItem).toEqual(created);
    })
  );
});

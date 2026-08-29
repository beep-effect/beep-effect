import { VERSION } from "@beep/architecture-lab-client";
import { makeWorkItemClient } from "@beep/architecture-lab-client/aggregates/WorkItem";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Option as O } from "effect";
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
      const client = makeWorkItemClient({
        create: () => Effect.succeed(created),
        assign: () => Effect.succeed(created),
        complete: () => Effect.succeed(created),
        reopen: () => Effect.succeed(created),
        archive: () => Effect.succeed(created),
        get: () => Effect.succeed(created),
        list: () => Effect.succeed([created]),
      });

      const workItem = yield* client.get(WorkItemUseCases.GetWorkItemQuery.make({ id: created.id }));
      expect(workItem.assignee).toStrictEqual(O.none());
    })
  );
});

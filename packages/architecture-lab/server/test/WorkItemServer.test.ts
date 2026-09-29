import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { VERSION } from "@beep/architecture-lab-server";
import {
  makeWorkItemHttpHandlers,
  toWorkItemHttpError,
  WorkItemHttpResponse,
  WorkItemHttpStatus,
  WorkItemServer,
} from "@beep/architecture-lab-server/aggregates/WorkItem";
import { ArchitectureLabServerLive } from "@beep/architecture-lab-server/layer";
import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test";
import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, Equal, Layer, Option as O } from "effect";
import * as S from "effect/Schema";

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);
const decodeWorkItemActionFailed = S.decodeUnknownEffect(WorkItemUseCases.WorkItemActionFailed);
const decodeWorkItemHttpResponse = S.decodeUnknownEffect(WorkItemHttpResponse);
const encodeWorkItemHttpResponse = S.encodeEffect(WorkItemHttpResponse);
const encodeWorkItemHttpStatus = S.encodeEffect(WorkItemHttpStatus);

describe("WorkItem server", () => {
  it.effect(
    "keeps HTTP schema encoded shapes byte-identical",
    Effect.fnUntraced(function* () {
      const encodedStatus = yield* encodeWorkItemHttpStatus(201);
      const response = WorkItemHttpResponse.make({
        status: 201,
        body: { id: "work-item-1" },
      });
      const encodedResponse = yield* encodeWorkItemHttpResponse(response);
      const decodedResponse = yield* decodeWorkItemHttpResponse(encodedResponse);

      expect(encodedStatus).toBe(201);
      expect(encodedResponse).toEqual({
        status: 201,
        body: { id: "work-item-1" },
      });
      expect(Equal.equals(decodedResponse, response)).toBe(true);
    })
  );

  it("round-trips schema-derived HTTP values", () => {
    assertSchemaArbitraryDecodesToSelf(WorkItemHttpStatus, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(WorkItemHttpResponse, { runs: 25 });
  });

  it.effect(
    "redacts unavailable details from HTTP failure bodies",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const unavailable = WorkItemUseCases.WorkItemActionFailed.make({
        reason: "select WorkItem failed against architecture_lab_work_item",
      });
      const failUnavailable = () => Effect.fail(unavailable);
      const handlers = makeWorkItemHttpHandlers({
        archive: failUnavailable,
        assign: failUnavailable,
        complete: failUnavailable,
        create: failUnavailable,
        get: failUnavailable,
        list: failUnavailable,
        reopen: failUnavailable,
      });

      const response = yield* handlers.get(WorkItemUseCases.GetWorkItemQuery.make({ id }));
      const body = yield* decodeWorkItemActionFailed(response.body);

      expect(response.status).toBe(503);
      expect(body._tag).toBe("WorkItemActionFailed");
      expect(body.reason).toBe(WorkItemUseCases.WORK_ITEM_ACTION_UNAVAILABLE_REASON);
      expect(body.reason).not.toContain("architecture_lab_work_item");
    })
  );

  it.layer(ArchitectureLabServerTest)("isolated repository stores", (it) => {
    it.effect(
      "provides a configured WorkItem use-case facade",
      Effect.fnUntraced(function* () {
        const server = yield* WorkItemServer;
        const id = yield* decodeWorkItemId("work-item-1");
        const workItem = yield* server.create(
          WorkItemUseCases.CreateWorkItemCommand.make({
            id,
            title: "Document topology",
          })
        );

        expect(workItem.status).toBe("open");
        assertNone(workItem.assignee);
      })
    );
  });

  it.layer(ArchitectureLabServerTest, { timeout: "10 seconds" })(
    "WorkItem lifecycle against a fresh repository store",
    (it) => {
      it.effect(
        "completes, lists, and reports a missing id and a duplicate create",
        Effect.fnUntraced(function* () {
          const server = yield* WorkItemServer;
          const id = yield* decodeWorkItemId("work-item-1");
          const missingId = yield* decodeWorkItemId("work-item-missing");
          const created = yield* server.create(
            WorkItemUseCases.CreateWorkItemCommand.make({
              id,
              title: "Document topology",
            })
          );
          const completed = yield* server.complete(WorkItemUseCases.CompleteWorkItemCommand.make({ id }));
          const listed = yield* server.list(WorkItemUseCases.ListWorkItemsQuery.make({}));
          const missing = yield* server
            .get(WorkItemUseCases.GetWorkItemQuery.make({ id: missingId }))
            .pipe(Effect.flip);
          const conflict = yield* server
            .create(
              WorkItemUseCases.CreateWorkItemCommand.make({
                id,
                title: "Document topology again",
              })
            )
            .pipe(Effect.flip);

          expect(created.status).toBe("open");
          expect(completed.status).toBe("completed");
          expect(listed).toHaveLength(1);
          expect(missing._tag).toBe("WorkItemNotFound");
          expect(conflict._tag).toBe("WorkItemConflict");
        })
      );
    }
  );

  it("exports the package version and the live server layer", () => {
    expect(VERSION).toBe("0.0.0");
    expect(Layer.isLayer(ArchitectureLabServerLive)).toBe(true);
  });

  it.effect(
    "maps the remaining WorkItem action errors and a created response",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const rejected = WorkItemUseCases.WorkItemActionRejected.make({
        workItemId: id,
        reason: "WorkItemAlreadyArchived",
      });
      const conflict = WorkItemUseCases.WorkItemConflict.make({
        workItemId: id,
        reason: "WorkItem already exists",
      });
      const missing = WorkItemUseCases.WorkItemNotFound.make({ workItemId: id });
      const workItem = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Created through HTTP",
          priority: O.none(),
        })
      );
      const handlers = makeWorkItemHttpHandlers({
        archive: () => Effect.fail(rejected),
        assign: () => Effect.fail(conflict),
        complete: () => Effect.fail(missing),
        create: () => Effect.succeed(workItem),
        get: () => Effect.succeed(workItem),
        list: () => Effect.succeed([workItem]),
        reopen: () => Effect.fail(rejected),
      });
      const created = yield* handlers.create(
        WorkItemUseCases.CreateWorkItemCommand.make({ id, title: "Created through HTTP" })
      );

      expect(toWorkItemHttpError(rejected).status).toBe(422);
      expect(toWorkItemHttpError(conflict).status).toBe(409);
      expect(toWorkItemHttpError(missing).status).toBe(404);
      expect(created.status).toBe(201);
    })
  );
});

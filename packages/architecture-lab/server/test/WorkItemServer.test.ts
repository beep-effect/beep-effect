import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import {
  makeWorkItemHttpHandlers,
  WorkItemHttpResponse,
  WorkItemHttpStatus,
  WorkItemServer,
} from "@beep/architecture-lab-server/aggregates/WorkItem";
import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test";
import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Layer, Option as O } from "effect";
import * as S from "effect/Schema";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
    assertSchemaArbitraryDecodesToSelf(WorkItemHttpStatus, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(WorkItemHttpResponse, { numRuns: 25 });
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
      expect(O.isNone(workItem.assignee)).toBe(true);
    }, provideScopedLayer(ArchitectureLabServerTest))
  );
});

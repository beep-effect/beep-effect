import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  MigrateConversationItemsResponse,
  PromoteStagedTaskResponse,
  RestoreLegacyConversationItemsResponse,
  StagedTask,
  StagedTaskListResponse,
} from "../../beep/StagedTask.ts";

const present = {
  id: "staged-1",
  description: "Send the notes",
  completed: false,
  createdAt: "2020-01-02T03:04:05.000Z",
  updatedAt: "2020-01-02T04:04:05.000Z",
  dueAt: "2020-01-03T00:00:00.000Z",
  source: "screenshot",
  priority: "urgent",
  metadata: "opaque",
  category: "work",
  relevanceScore: 1001,
};

describe("StagedTask", () => {
  it("decodes present values, including an unconstrained relevance score", () => {
    const task = Effect.runSync(S.decodeUnknownEffect(StagedTask)(present));
    expect(task.priority).toEqual(O.some("urgent"));
    expect(task.relevanceScore).toEqual(O.some(1001));
    expect(task.metadata).toEqual(O.some("opaque"));
  });

  it("decodes null and missing optional fields as None", () => {
    const required = {
      id: "staged-1",
      description: "Send the notes",
      completed: true,
      createdAt: "2020-01-02T03:04:05.000Z",
      updatedAt: "2020-01-02T03:04:05.000Z",
    };
    const missing = Effect.runSync(S.decodeUnknownEffect(StagedTask)(required));
    const nulled = Effect.runSync(S.decodeUnknownEffect(StagedTask)({
      ...required,
      dueAt: null,
      source: null,
      priority: null,
      metadata: null,
      category: null,
      relevanceScore: null,
    }));
    for (const task of [missing, nulled]) {
      expect(O.isNone(task.dueAt)).toBe(true);
      expect(O.isNone(task.priority)).toBe(true);
      expect(O.isNone(task.relevanceScore)).toBe(true);
    }
  });

  it("decodes promotion and constructs the retired migration defaults", () => {
    const skipped = Effect.runSync(S.decodeUnknownEffect(PromoteStagedTaskResponse)({
      promoted: false,
      reason: null,
      promotedTask: null,
    }));
    const promoted = Effect.runSync(S.decodeUnknownEffect(PromoteStagedTaskResponse)({
      promoted: true,
      reason: "done",
      promotedTask: { id: "action-1", extra: true },
    }));
    expect(O.isNone(skipped.promotedTask)).toBe(true);
    expect(O.isSome(promoted.promotedTask) && promoted.promotedTask.value.id).toBe("action-1");
    const migrated = MigrateConversationItemsResponse.make({});
    expect(migrated.status).toBe("ok");
    expect(migrated.migrated).toBe(0);
    expect(migrated.deleted).toBe(0);
    expect(migrated.hasMore).toBe(false);
    expect(O.isNone(migrated.nextCursor)).toBe(true);
    const restored = RestoreLegacyConversationItemsResponse.make({});
    expect(restored.restored).toBe(0);
    expect(restored.hasMore).toBe(false);
    const page = Effect.runSync(S.decodeUnknownEffect(RestoreLegacyConversationItemsResponse)({
      status: "ok",
      restored: 1,
      skippedExisting: 2,
      hasMore: true,
      nextCursor: "cursor-1",
    }));
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toEqual(O.some("cursor-1"));
    const list = Effect.runSync(S.decodeUnknownEffect(StagedTaskListResponse)({ items: [], hasMore: false }));
    expect(list.items).toHaveLength(0);
  });

  it("builds an arbitrary for each staged-task model", () => {
    for (const model of [
      StagedTask,
      StagedTaskListResponse,
      PromoteStagedTaskResponse,
      MigrateConversationItemsResponse,
      RestoreLegacyConversationItemsResponse,
    ]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});

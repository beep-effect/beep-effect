import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ConversationCreateResponse,
  ConversationItem,
  ConversationItemGeolocation,
  ConversationItemStructured,
  ConversationItemTranscriptSegment,
  ConversationTimestampRange,
  ConversationsResponse,
  ExternalIntegrationCreateMemory,
  ExternalIntegrationMemory,
  ExternalIntegrationMemorySource,
  IntegrationActionItem,
  IntegrationEvent,
  IntegrationMemoryItem,
  IntegrationNotificationResponse,
  MemoriesResponse,
  ScreenPipeCreateConversation,
  SearchConversationsResponse,
  TaskItem,
  TasksResponse,
  encodeIntegrationMemoryItem,
  eventAsDictCleanedDates,
  serializeDateTime,
} from "../../beep/Integrations.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const memoryItemWire = {
  id: "mem-1",
  uid: "user-1",
  content: "Lives in Seattle",
  category: "core",
  tags: ["home"],
  arguments: {},
  subjectAttribution: "user",
  objectEntityIds: [],
  qualifiers: {},
  uncertaintyReasons: [],
  createdAt: "2026-09-22T10:00:00Z",
  updatedAt: "2026-09-22T10:00:00Z",
  manuallyAdded: false,
  reviewed: false,
  evidence: [],
  curationWeight: 0,
  headline: null,
  conversationId: "conv-1",
};

const conversationItemWire = {
  id: "conv-1",
  createdAt: "2026-09-22T10:00:00Z",
  source: "omi",
};

describe("Integrations", () => {
  it("derives arbitraries for every exported schema", () => {
    for (const schema of [
      ExternalIntegrationMemorySource,
      ConversationTimestampRange,
      ScreenPipeCreateConversation,
      ExternalIntegrationMemory,
      ExternalIntegrationCreateMemory,
      IntegrationNotificationResponse,
      ConversationCreateResponse,
      IntegrationMemoryItem,
      MemoriesResponse,
      IntegrationActionItem,
      IntegrationEvent,
      ConversationItemStructured,
      ConversationItemGeolocation,
      ConversationItemTranscriptSegment,
      ConversationItem,
      ConversationsResponse,
      SearchConversationsResponse,
      TaskItem,
      TasksResponse,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("decodes the screen-pipe request and the memory source literal", () => {
    const decoded = decode(ScreenPipeCreateConversation, {
      requestId: "req-1",
      source: "screenpipe",
      text: "hello",
      timestampRange: { start: 1, end: 2 },
    });
    assert.strictEqual(decoded.timestampRange.end, 2);
    assert.strictEqual(
      decodeFails(ScreenPipeCreateConversation, { requestId: "r", source: "s", text: "t", timestampRange: { start: 1.5, end: 2 } }),
      true,
    );
    assert.strictEqual(decode(ExternalIntegrationMemorySource, "social_post"), "social_post");
    assert.strictEqual(decodeFails(ExternalIntegrationMemorySource, "post"), true);
  });

  it("decodes external memories with missing and null Option fields", () => {
    const present = decode(ExternalIntegrationMemory, {
      content: "fact",
      tags: ["a"],
      sourceId: "s-1",
      sourceUrl: "https://example.test",
      artifactRef: { kind: "email" },
    });
    assert.deepStrictEqual(O.getOrNull(present.tags), ["a"]);
    assert.deepStrictEqual(O.getOrNull(present.artifactRef), { kind: "email" });
    const missing = decode(ExternalIntegrationMemory, { content: "fact" });
    const nulled = decode(ExternalIntegrationMemory, {
      content: "fact",
      tags: null,
      sourceId: null,
      sourceUrl: null,
      artifactRef: null,
    });
    for (const row of [missing, nulled]) {
      assert.strictEqual(O.isNone(row.tags), true);
      assert.strictEqual(O.isNone(row.sourceId), true);
      assert.strictEqual(O.isNone(row.sourceUrl), true);
      assert.strictEqual(O.isNone(row.artifactRef), true);
    }
    const encoded = Effect.runSync(S.encodeEffect(ExternalIntegrationMemory)(missing));
    assert.deepStrictEqual(encoded, { content: "fact", tags: null, sourceId: null, sourceUrl: null, artifactRef: null });
  });

  it("defaults textSource to other on make and requires it on decode", () => {
    const made = ExternalIntegrationCreateMemory.make({ text: O.some("raw") });
    assert.strictEqual(made.textSource, "other");
    assert.strictEqual(O.isNone(made.memories), true);
    const decoded = decode(ExternalIntegrationCreateMemory, {
      textSource: "email",
      memories: [],
      appId: null,
    });
    assert.strictEqual(decoded.textSource, "email");
    assert.strictEqual(O.map(decoded.memories, (items) => items.length).pipe(O.getOrNull), 0);
    assert.strictEqual(O.isNone(decoded.appId), true);
    assert.strictEqual(decodeFails(ExternalIntegrationCreateMemory, { textSource: "sms" }), true);
  });

  it("decodes simple responses", () => {
    assert.strictEqual(decode(IntegrationNotificationResponse, { status: "ok" }).status, "ok");
    assert.strictEqual(decode(ConversationCreateResponse, { status: "ok", conversationId: "c" }).conversationId, "c");
    assert.strictEqual(decodeFails(ConversationCreateResponse, { status: "ok" }), true);
    const tasks = decode(TasksResponse, {
      tasks: [{ id: "t", description: "d", completed: true, dueAt: "2026-09-22T10:00:00Z", createdAt: null }],
    });
    const first = tasks.tasks[0];
    assert.notStrictEqual(first, undefined);
    if (first !== undefined) {
      assert.strictEqual(first.completed, true);
      assert.strictEqual(O.isSome(first.dueAt), true);
      assert.strictEqual(O.isNone(first.createdAt), true);
      assert.strictEqual(O.isNone(first.conversationId), true);
    }
  });

  it("encodes an integration memory item without null keys", () => {
    const item = decode(IntegrationMemoryItem, memoryItemWire);
    assert.strictEqual(item.category, "system");
    assert.strictEqual(O.isNone(item.headline), true);
    assert.strictEqual(O.getOrNull(item.visibility), "public");
    const encoded = Effect.runSync(encodeIntegrationMemoryItem(item));
    assert.strictEqual(encoded.content, "Lives in Seattle");
    assert.strictEqual(encoded.conversationId, "conv-1");
    assert.strictEqual("headline" in encoded, false);
    assert.strictEqual("predicate" in encoded, false);
    assert.strictEqual("validAt" in encoded, false);
    const response = decode(MemoriesResponse, { memories: [memoryItemWire] });
    assert.strictEqual(response.memories.length, 1);
  });

  it("serializes datetimes like the Python helper", () => {
    assert.strictEqual(serializeDateTime("2026-09-22T10:00:00Z"), "2026-09-22T10:00:00Z");
    assert.strictEqual(serializeDateTime("2026-09-22T10:00:00+00:00"), "2026-09-22T10:00:00Z");
    assert.strictEqual(serializeDateTime("2026-09-22T10:00:00-05:00"), "2026-09-22T10:00:00-05:00");
    assert.strictEqual(serializeDateTime("2026-09-22T10:00:00"), "2026-09-22T10:00:00Z");
    assert.strictEqual(serializeDateTime(DateTime.makeUnsafe("2026-09-22T10:00:00Z")), "2026-09-22T10:00:00.000Z");
  });

  it("cleans event dates and applies event defaults", () => {
    const made = IntegrationEvent.make({ title: "Standup", start: DateTime.makeUnsafe("2026-09-22T10:00:00Z") });
    assert.strictEqual(made.description, "");
    assert.strictEqual(made.duration, 30);
    assert.strictEqual(made.created, false);
    const cleaned = Effect.runSync(eventAsDictCleanedDates(made));
    assert.deepStrictEqual(cleaned, {
      title: "Standup",
      description: "",
      start: "2026-09-22T10:00:00.000Z",
      duration: 30,
      created: false,
    });
    const decoded = decode(IntegrationEvent, {
      title: "Standup",
      description: "d",
      start: "2026-09-22T10:00:00Z",
      duration: 45,
      created: true,
    });
    assert.strictEqual(decoded.duration, 45);
    assert.strictEqual(decodeFails(IntegrationEvent, { title: "Standup", start: "not a date", duration: 1, description: "", created: false }), true);
  });

  it("applies structured defaults and action item Option fields", () => {
    const structured = ConversationItemStructured.make({ title: "t", overview: "o" });
    assert.strictEqual(structured.emoji, "🧠");
    assert.strictEqual(structured.category, "other");
    assert.deepStrictEqual(structured.actionItems, []);
    assert.deepStrictEqual(structured.events, []);
    const action = decode(IntegrationActionItem, {
      description: "ship",
      completed: true,
      exported: false,
      exportDate: "2026-09-22T10:00:00Z",
      exportPlatform: null,
    });
    assert.strictEqual(O.isSome(action.exportDate), true);
    assert.strictEqual(O.isNone(action.exportPlatform), true);
    const madeAction = IntegrationActionItem.make({ description: "ship" });
    assert.strictEqual(madeAction.completed, false);
    assert.strictEqual(madeAction.exported, false);
    assert.strictEqual(O.isNone(madeAction.exportDate), true);
  });

  it("decodes conversation items with a defaulted discarded flag", () => {
    const missing = decode(ConversationItem, conversationItemWire);
    assert.strictEqual(O.getOrNull(missing.discarded), false);
    assert.strictEqual(O.isNone(missing.structured), true);
    assert.strictEqual(O.isNone(missing.transcriptSegments), true);
    assert.strictEqual(O.isNone(missing.geolocation), true);
    assert.strictEqual(O.isNone(missing.startedAt), true);
    const nulled = decode(ConversationItem, {
      ...conversationItemWire,
      discarded: null,
      structured: null,
      transcriptSegments: null,
      geolocation: null,
      externalData: null,
      status: null,
    });
    assert.strictEqual(O.isNone(nulled.discarded), true);
    const present = decode(ConversationItem, {
      ...conversationItemWire,
      discarded: true,
      startedAt: "2026-09-22T10:00:00Z",
      structured: { title: "t", overview: "o", emoji: "x", category: "work", actionItems: [], events: [] },
      transcriptSegments: [],
      externalData: { k: "v" },
      status: "done",
    });
    assert.strictEqual(O.getOrNull(present.discarded), true);
    assert.strictEqual(O.map(present.structured, (s) => s.category).pipe(O.getOrNull), "work");
    assert.strictEqual(O.map(present.transcriptSegments, (s) => s.length).pipe(O.getOrNull), 0);
    assert.strictEqual(O.map(present.externalData, (d) => d.k).pipe(O.getOrNull), "v");
    const encoded = Effect.runSync(S.encodeEffect(ConversationItem)(nulled));
    assert.strictEqual(encoded.discarded, null);
    assert.strictEqual(encoded.structured, null);
    assert.strictEqual(encoded.startedAt, null);
    const segment = ConversationItemTranscriptSegment.make({ text: "hi" });
    assert.strictEqual(segment.isUser, false);
    assert.strictEqual(segment.start, 0);
    assert.strictEqual(O.isNone(segment.speaker), true);
  });

  it("decodes nested models with Option fields from the wire", () => {
    const nested = decode(ConversationItem, {
      ...conversationItemWire,
      transcriptSegments: [{ text: "hi", isUser: true, start: 0, end: 1 }],
      geolocation: { latitude: 1.5, longitude: 2.5 },
    });
    assert.strictEqual(O.map(nested.geolocation, (g) => g.longitude).pipe(O.getOrNull), 2.5);
    assert.strictEqual(O.map(nested.transcriptSegments, (s) => s.length).pipe(O.getOrNull), 1);
    const created = decode(ExternalIntegrationCreateMemory, { textSource: "email", memories: [{ content: "fact" }] });
    assert.strictEqual(O.map(created.memories, (items) => items.length).pipe(O.getOrNull), 1);
  });

  it("decodes conversation list responses", () => {
    const list = decode(ConversationsResponse, { conversations: [conversationItemWire] });
    assert.strictEqual(list.conversations.length, 1);
    const paged = decode(SearchConversationsResponse, {
      conversations: [],
      totalPages: 1,
      currentPage: 1,
      perPage: 20,
    });
    assert.strictEqual(paged.perPage, 20);
    assert.strictEqual(decodeFails(SearchConversationsResponse, { conversations: [], totalPages: 1, currentPage: 1 }), true);
  });
});

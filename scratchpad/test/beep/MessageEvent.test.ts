import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ConversationEvent,
  ConversationSessionEvent,
  FREEMIUM_ACTION_NONE,
  FREEMIUM_ACTION_SETUP_ON_DEVICE_STT,
  FixedMessageEvent,
  FreemiumThresholdReachedEvent,
  LastConversationEvent,
  MemoryBackwardSycnedEvent,
  MessageEvent,
  MessageServiceStatusEvent,
  NewConversationCreated,
  NewProcessingConversationCreated,
  PhotoDescribedEvent,
  PhotoProcessingEvent,
  PingEvent,
  ProactiveMessageEvent,
  ProcessingConversationStatusChanged,
  SegmentsDeletedEvent,
  SpeakerLabelSuggestionEvent,
  TranslationEvent,
  conversationEventToJson,
  conversationSessionEventToJson,
  fixedMessageEventToJson,
  freemiumThresholdReachedEventToJson,
  lastConversationEventToJson,
  memoryBackwardSycnedEventToJson,
  messageEventToJson,
  messageServiceStatusEventToJson,
  newConversationCreatedToJson,
  newProcessingConversationCreatedToJson,
  photoDescribedEventToJson,
  photoProcessingEventToJson,
  pingEventToJson,
  proactiveMessageEventToJson,
  processingConversationStatusChangedToJson,
  segmentsDeletedEventToJson,
  speakerLabelSuggestionEventToJson,
  translationEventToJson,
} from "../../beep/MessageEvent.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const encode = <A, I>(schema: S.Codec<A, I, never, never>, value: A): I => Effect.runSync(S.encodeEffect(schema)(value));

const memory = { id: "conversation-1", title: "Lunch" };

describe("MessageEvent constants", () => {
  it("keeps the freemium action strings", () => {
    assert.strictEqual(FREEMIUM_ACTION_SETUP_ON_DEVICE_STT, "setup_on_device_stt");
    assert.strictEqual(FREEMIUM_ACTION_NONE, "none");
  });
});

describe("open-type events", () => {
  it("requires a non-empty caller-supplied event type", () => {
    assert.strictEqual(decode(MessageEvent, { eventType: "custom" }).eventType, "custom");
    assert.strictEqual(decodeFails(MessageEvent, { eventType: "" }), true);
    assert.strictEqual(decodeFails(MessageEvent, {}), true);
  });

  it("renames eventType to type on the wire", () => {
    const json = Effect.runSync(messageEventToJson(MessageEvent.make({ eventType: "custom" })));
    assert.deepStrictEqual(json, { type: "custom" });
  });

  it("decodes a conversation event with the lifecycle envelope present", () => {
    const event = decode(ConversationEvent, {
      eventType: "memory_created",
      memory,
      messages: [{ id: "m-1" }],
      recordingSessionId: "rec-1",
      conversationId: "conversation-1",
      lifecycleVersion: 2,
      lifecyclePhase: "completed",
      lifecycleSequence: 7,
    });
    assert.deepStrictEqual(O.getOrNull(event.messages), [{ id: "m-1" }]);
    assert.strictEqual(O.getOrNull(event.recordingSessionId), "rec-1");
    assert.strictEqual(O.getOrNull(event.lifecycleVersion), 2);
    assert.strictEqual(O.getOrNull(event.lifecycleSequence), 7);
  });

  it("treats a missing message list as empty and a null one as absent", () => {
    const missing = decode(ConversationEvent, { eventType: "memory_processing_started", memory });
    assert.deepStrictEqual(O.getOrNull(missing.messages), []);
    assert.strictEqual(O.isNone(missing.recordingSessionId), true);
    assert.strictEqual(O.isNone(missing.lifecycleVersion), true);
    const nulled = decode(ConversationEvent, {
      eventType: "memory_processing_started",
      memory,
      messages: null,
      recordingSessionId: null,
      lifecycleVersion: null,
    });
    assert.strictEqual(O.isNone(nulled.messages), true);
    assert.strictEqual(O.isNone(nulled.recordingSessionId), true);
    const encoded = encode(ConversationEvent, nulled);
    assert.strictEqual(encoded.messages, null);
    assert.strictEqual(encoded.recordingSessionId, null);
    const json = Effect.runSync(conversationEventToJson(nulled));
    assert.strictEqual(json.type, "memory_processing_started");
    assert.strictEqual(json.messages, null);
    assert.strictEqual("eventType" in json, false);
  });

  it("ports the created and processing conversation events", () => {
    const created = decode(NewConversationCreated, { eventType: "new_conversation", memory });
    assert.deepStrictEqual(O.getOrNull(created.messageIds), []);
    assert.deepStrictEqual(O.getOrNull(created.messages), []);
    assert.strictEqual(O.isNone(created.memoryId), true);
    const createdJson = Effect.runSync(newConversationCreatedToJson(created));
    assert.strictEqual(createdJson.type, "new_conversation");
    assert.strictEqual(createdJson.memoryId, null);

    const processing = decode(NewProcessingConversationCreated, {
      eventType: "new_processing_memory_created",
      processingMemoryId: "proc-1",
      memoryId: null,
    });
    assert.strictEqual(O.getOrNull(processing.processingMemoryId), "proc-1");
    assert.strictEqual(O.isNone(processing.memoryId), true);
    assert.strictEqual(
      Effect.runSync(newProcessingConversationCreatedToJson(processing)).type,
      "new_processing_memory_created",
    );

    const status = decode(ProcessingConversationStatusChanged, {
      eventType: "processing_memory_status_changed",
      processingMemoryStatus: "done",
    });
    assert.strictEqual(O.getOrNull(status.processingMemoryStatus), "done");
    assert.strictEqual(O.isNone(status.processingMemoryId), true);
    const statusJson = Effect.runSync(processingConversationStatusChangedToJson(status));
    assert.strictEqual(statusJson.type, "processing_memory_status_changed");
    assert.strictEqual(statusJson.processingMemoryId, null);
  });

  it("keeps the MemoryBackwardSycnedEvent typo", () => {
    const event = decode(MemoryBackwardSycnedEvent, { eventType: "memory_backward_synced", name: "sync" });
    assert.strictEqual(O.getOrNull(event.name), "sync");
    assert.strictEqual(O.isNone(decode(MemoryBackwardSycnedEvent, { eventType: "x" }).name), true);
    assert.deepStrictEqual(Effect.runSync(memoryBackwardSycnedEventToJson(event)), {
      type: "memory_backward_synced",
      name: "sync",
    });
  });
});

describe("fixed-type events", () => {
  it("service status drops nulls from JSON", () => {
    const ready = decode(MessageServiceStatusEvent, { eventType: "service_status", status: "ready" });
    assert.strictEqual(O.isNone(ready.outcome), true);
    assert.deepStrictEqual(Effect.runSync(messageServiceStatusEventToJson(ready)), {
      type: "service_status",
      status: "ready",
    });
    const failed = decode(MessageServiceStatusEvent, {
      eventType: "service_status",
      status: "failed",
      statusText: null,
      outcome: "terminal_failure",
      provider: "deepgram",
      retryable: false,
      reason: "quota",
    });
    assert.strictEqual(O.getOrNull(failed.retryable), false);
    assert.deepStrictEqual(Effect.runSync(messageServiceStatusEventToJson(failed)), {
      type: "service_status",
      status: "failed",
      outcome: "terminal_failure",
      provider: "deepgram",
      retryable: false,
      reason: "quota",
    });
    assert.strictEqual(decodeFails(MessageServiceStatusEvent, { eventType: "other", status: "ready" }), true);
  });

  it("conversation session defaults status to in_progress", () => {
    const made = ConversationSessionEvent.make({ conversationId: "conversation-1" });
    assert.strictEqual(made.eventType, "conversation_session");
    assert.strictEqual(made.status, "in_progress");
    assert.strictEqual(O.isNone(made.lifecyclePhase), true);
    const decoded = decode(ConversationSessionEvent, {
      eventType: "conversation_session",
      conversationId: "conversation-1",
      status: "completed",
      lifecycleSequence: null,
    });
    assert.strictEqual(decoded.status, "completed");
    const json = Effect.runSync(conversationSessionEventToJson(decoded));
    assert.strictEqual(json.type, "conversation_session");
    assert.strictEqual(json.lifecycleSequence, null);
  });

  it("ping and last memory", () => {
    assert.deepStrictEqual(Effect.runSync(pingEventToJson(PingEvent.make({}))), { type: "ping" });
    const last = decode(LastConversationEvent, { eventType: "last_memory", memoryId: "conversation-9" });
    assert.deepStrictEqual(Effect.runSync(lastConversationEventToJson(last)), {
      type: "last_memory",
      memoryId: "conversation-9",
    });
  });

  it("translation defaults segments to an empty list", () => {
    assert.deepStrictEqual(TranslationEvent.make({}).segments, []);
    const event = decode(TranslationEvent, { eventType: "translating", segments: [{ text: "hola" }] });
    assert.deepStrictEqual(Effect.runSync(translationEventToJson(event)), {
      type: "translating",
      segments: [{ text: "hola" }],
    });
  });

  it("photo events", () => {
    const processing = decode(PhotoProcessingEvent, { eventType: "photo_processing", tempId: "t-1", photoId: "p-1" });
    assert.deepStrictEqual(Effect.runSync(photoProcessingEventToJson(processing)), {
      type: "photo_processing",
      tempId: "t-1",
      photoId: "p-1",
    });
    const described = decode(PhotoDescribedEvent, {
      eventType: "photo_described",
      photoId: "p-1",
      description: "A desk",
      discarded: false,
    });
    assert.strictEqual(Effect.runSync(photoDescribedEventToJson(described)).discarded, false);
    assert.strictEqual(decodeFails(PhotoDescribedEvent, { eventType: "photo_described", photoId: "p-1" }), true);
  });

  it("speaker label, freemium threshold, and segments deleted", () => {
    const speaker = decode(SpeakerLabelSuggestionEvent, {
      eventType: "speaker_label_suggestion",
      speakerId: 2,
      personId: "person-1",
      personName: "Ada",
      segmentId: "seg-1",
    });
    assert.strictEqual(Effect.runSync(speakerLabelSuggestionEventToJson(speaker)).speakerId, 2);
    const freemium = decode(FreemiumThresholdReachedEvent, {
      eventType: "freemium_threshold_reached",
      remainingSeconds: 30,
      action: FREEMIUM_ACTION_SETUP_ON_DEVICE_STT,
    });
    assert.deepStrictEqual(Effect.runSync(freemiumThresholdReachedEventToJson(freemium)), {
      type: "freemium_threshold_reached",
      remainingSeconds: 30,
      action: "setup_on_device_stt",
    });
    const deleted = decode(SegmentsDeletedEvent, { eventType: "segments_deleted", segmentIds: ["a", "b"] });
    assert.deepStrictEqual(Effect.runSync(segmentsDeletedEventToJson(deleted)).segmentIds, ["a", "b"]);
  });

  it("proactive message drops a null conversation id from JSON", () => {
    const event = decode(ProactiveMessageEvent, {
      eventType: "proactive_message",
      appId: "app-1",
      title: "Hi",
      message: "Body",
    });
    assert.strictEqual(O.isNone(event.conversationId), true);
    assert.deepStrictEqual(Effect.runSync(proactiveMessageEventToJson(event)), {
      type: "proactive_message",
      appId: "app-1",
      title: "Hi",
      message: "Body",
    });
    const linked = decode(ProactiveMessageEvent, {
      eventType: "proactive_message",
      appId: "app-1",
      title: "Hi",
      message: "Body",
      conversationId: "conversation-1",
    });
    assert.strictEqual(Effect.runSync(proactiveMessageEventToJson(linked)).conversationId, "conversation-1");
  });
});

describe("FixedMessageEvent", () => {
  const members: ReadonlyArray<{ readonly input: Record<string, unknown>; readonly tag: string }> = [
    { input: { eventType: "service_status", status: "ready" }, tag: "service_status" },
    { input: { eventType: "conversation_session", conversationId: "c-1", status: "in_progress" }, tag: "conversation_session" },
    { input: { eventType: "ping" }, tag: "ping" },
    { input: { eventType: "last_memory", memoryId: "c-1" }, tag: "last_memory" },
    { input: { eventType: "translating", segments: [] }, tag: "translating" },
    { input: { eventType: "photo_processing", tempId: "t", photoId: "p" }, tag: "photo_processing" },
    { input: { eventType: "photo_described", photoId: "p", description: "d", discarded: true }, tag: "photo_described" },
    {
      input: { eventType: "speaker_label_suggestion", speakerId: 1, personId: "p", personName: "n", segmentId: "s" },
      tag: "speaker_label_suggestion",
    },
    {
      input: { eventType: "freemium_threshold_reached", remainingSeconds: 1, action: "none" },
      tag: "freemium_threshold_reached",
    },
    { input: { eventType: "segments_deleted", segmentIds: [] }, tag: "segments_deleted" },
    { input: { eventType: "proactive_message", appId: "a", title: "t", message: "m" }, tag: "proactive_message" },
  ];

  it("decodes every member and routes each through toJson", () => {
    for (const member of members) {
      const decoded = decode(FixedMessageEvent, member.input);
      assert.strictEqual(decoded.eventType, member.tag);
      const json = Effect.runSync(fixedMessageEventToJson(decoded));
      assert.strictEqual(json.type, member.tag);
      assert.strictEqual("eventType" in json, false);
    }
  });

  it("rejects an unknown event type", () => {
    assert.strictEqual(decodeFails(FixedMessageEvent, { eventType: "memory_created" }), true);
  });

  it("only service status and proactive message drop nulls", () => {
    const session = decode(FixedMessageEvent, { eventType: "conversation_session", conversationId: "c-1", status: "done" });
    assert.strictEqual(Effect.runSync(fixedMessageEventToJson(session)).recordingSessionId, null);
    const status = decode(FixedMessageEvent, { eventType: "service_status", status: "ready" });
    assert.strictEqual("reason" in Effect.runSync(fixedMessageEventToJson(status)), false);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      MessageEvent,
      ConversationEvent,
      NewConversationCreated,
      NewProcessingConversationCreated,
      ProcessingConversationStatusChanged,
      MemoryBackwardSycnedEvent,
      MessageServiceStatusEvent,
      ConversationSessionEvent,
      PingEvent,
      LastConversationEvent,
      TranslationEvent,
      PhotoProcessingEvent,
      PhotoDescribedEvent,
      SpeakerLabelSuggestionEvent,
      FreemiumThresholdReachedEvent,
      SegmentsDeletedEvent,
      ProactiveMessageEvent,
      FixedMessageEvent,
    ]) {
      assert.isDefined(Arbitrary.schema(schema));
    }
  });
});

import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  AppResult,
  Conversation,
  ConversationSyncOperation,
  CreateConversation,
  ExternalIntegrationCreateConversation,
  PluginResult,
  asDictCleanedDates,
  externalGetPersonIds,
  externalGetTranscript,
  getPersonIds,
  getPhotosDescription,
  getTranscript,
  initializeConversation,
  projectSharedConversation,
} from "../../beep/Conversation.ts";
import { Structured } from "../../beep/Structured.ts";
import { TranscriptSegment } from "../../beep/TranscriptSegment.ts";

const encodeConversation = S.encodeEffect(Conversation);
const encodeAppResult = S.encodeEffect(AppResult);
const encodePluginResult = S.encodeEffect(PluginResult);
const encodeTranscriptSegment = S.encodeEffect(TranscriptSegment);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const wire = {
  id: "c1",
  createdAt: "2020-01-02T03:04:05.000Z",
  structured: Structured.make({ title: "Standup" }),
};

const base = {
  ...wire,
  createdAt: DateTime.makeUnsafe(wire.createdAt),
};

describe("Conversation", () => {
  it("decodes missing and null options and rewrites mirrors", () => {
    const missing = Conversation.make(base);
    expect(O.isNone(missing.language)).toBe(true);
    expect(O.isNone(missing.geolocation)).toBe(true);
    expect(missing.transcriptSegments).toEqual([]);
    const encoded = Effect.runSync(encodeConversation(missing));
    const nulled = decode(Conversation, { ...encoded, language: null, geolocation: null, processingState: null });
    expect(O.isNone(nulled.language)).toBe(true);
    expect(O.isNone(nulled.geolocation)).toBe(true);
    expect(O.isNone(nulled.processingState)).toBe(true);
    const initialized = Effect.runSync(
      initializeConversation({
        ...encoded,
        processingConversationId: "mem-1",
        appsResults: [Effect.runSync(encodeAppResult(AppResult.make({ appId: O.some("app"), content: "done" })))],
        pluginsResults: [Effect.runSync(encodePluginResult(PluginResult.make({ pluginId: O.none(), content: "stale" })))],
        transcriptSegments: [
          Effect.runSync(
            encodeTranscriptSegment(
              TranscriptSegment.make({ id: "", text: "Hi", isUser: true, speakerId: 0, start: 0, end: 1 }),
            ),
          ),
        ],
      }),
    );
    expect(O.getOrElse(initialized.processingMemoryId, () => "")).toBe("mem-1");
    expect(initialized.pluginsResults[0]?.content).toBe("done");
    expect(initialized.transcriptSegments[0]?.id.length).toBeGreaterThan(0);
  });

  it("formats transcripts, projects a share, and decodes sync arms", () => {
    const conversation = Conversation.make({
      ...base,
      transcriptSegments: [
        TranscriptSegment.make({ id: "s", text: " Hello ", isUser: true, speakerId: 0, start: 0, end: 1 }),
        TranscriptSegment.make({ id: "s2", text: "Ada", isUser: false, speakerId: 1, personId: O.some("p1"), start: 2, end: 3 }),
      ],
    });
    expect(getTranscript(conversation, false)).toContain("User: Hello");
    expect(pipe(conversation, getTranscript())).toEqual(getTranscript(conversation));
    expect(pipe(conversation, getTranscript(false))).toEqual(getTranscript(conversation, false));
    expect(pipe(conversation, getTranscript(true, [], "Ben"))).toEqual(getTranscript(conversation, true, [], "Ben"));
    expect(getPersonIds(conversation)).toContain("p1");
    expect(getPhotosDescription(conversation, false)).toBe("None");
    expect(pipe(conversation, getPhotosDescription())).toEqual(getPhotosDescription(conversation));
    expect(pipe(conversation, getPhotosDescription(true))).toEqual(getPhotosDescription(conversation, true));
    expect(projectSharedConversation(conversation, []).structured.title).toBe("Standup");
    expect(asDictCleanedDates(conversation).id).toBe("c1");
    expect(decode(ConversationSyncOperation, { type: "setTitle", title: "Next" }).type).toBe("setTitle");
    expect(decode(ConversationSyncOperation, { type: "setStarred", starred: true }).type).toBe("setStarred");
    const external = ExternalIntegrationCreateConversation.make({ text: " Hello ", textSource: "message" });
    expect(externalGetTranscript(external, true)).toBe("Hello");
    expect(pipe(external, externalGetTranscript())).toEqual(externalGetTranscript(external));
    expect(pipe(external, externalGetTranscript(true))).toEqual(externalGetTranscript(external, true));
    expect(externalGetPersonIds(external)).toEqual([]);
    expect(CreateConversation.make({
      text: "Hi",
      startedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
      finishedAt: DateTime.makeUnsafe("2020-01-02T03:05:05.000Z"),
    }).textSource).toBe("audio_transcript");
    expect(Arbitrary.schema(Conversation)).toBeTruthy();
    expect(Arbitrary.schema(ConversationSyncOperation)).toBeTruthy();
  });
});

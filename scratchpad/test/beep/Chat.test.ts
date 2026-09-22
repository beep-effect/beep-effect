import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";
import {
  ChatEvidenceReference,
  ChatSession,
  FileChat,
  Message,
  addFileIds,
  chatFileIsDocument,
  chatFileNormalizedMime,
  decodeMessage,
  deserializeManySafe,
  evidenceEnvelopeIssue,
  evidenceReferenceIssue,
  fileChatIsDocumentMessage,
  fileChatIsImage,
  fileChatPayload,
  messagesAsString,
  messagesAsXml,
  readEvidenceId,
  readEvidenceKind,
  readEvidenceState,
  retrieveNewFile,
  settleEvidenceEnvelope,
  ChatEvidenceEnvelope,
} from "../../beep/Chat.ts";

const human = Message.make({
  id: "m1",
  text: "Hello",
  createdAt: "2020-01-02T03:04:05.000Z",
  sender: "human",
  type: "text",
});

describe("Chat", () => {
  it("classifies documents and repairs messages", () => {
    expect(chatFileNormalizedMime("None")).toBe("");
    expect(chatFileNormalizedMime(null)).toBe("");
    expect(chatFileIsDocument("notes.pdf", null)).toBe(true);
    expect(chatFileIsDocument("photo.png", "image/png")).toBe(false);
    expect(chatFileIsDocument("noext", "application/pdf")).toBe(true);
    const pdf = FileChat.make({
      id: "f1",
      name: "notes.pdf",
      mimeType: "application/pdf",
      openaiFileId: "file-1",
      createdAt: "2020-01-02T03:04:05.000Z",
    });
    expect(fileChatIsDocumentMessage(pdf)).toBe(true);
    expect(fileChatIsImage(pdf)).toBe(false);
    expect("thumb_name" in fileChatPayload(pdf)).toBe(false);
    const decoded = Effect.runSync(
      decodeMessage({
        id: "m1",
        text: "Hello",
        created_at: "2020-01-02T03:04:05.000Z",
        sender: "ai",
        type: "text",
        plugin_id: "app-1",
        metadata: '{"content_blocks":[{"type":"text"}]}',
      }),
    );
    expect(O.getOrElse(decoded.appId, () => "")).toBe("app-1");
    expect(decoded.contentBlocks.length).toBe(1);
    expect(deserializeManySafe([{ id: "bad" }, { id: "m1", text: "Hello", createdAt: "2020-01-02T03:04:05.000Z", sender: "human", type: "text" }]).length).toBe(1);
  });

  it("formats messages and evidence branches", () => {
    expect(messagesAsString([human], true)).toContain("User: Hello");
    expect(messagesAsXml([human], false, true)).toContain("<sender>User</sender>");
    const ai = Message.make({ ...human, id: "m2", sender: "ai", appId: O.some("app-1") });
    expect(messagesAsString([ai], false, true, false, () => O.some("Plugin"))).toContain("Plugin:");
    expect(messagesAsString([ai], false, true, true)).toContain("AI:");
    expect(O.isNone(readEvidenceId("  "))).toBe(true);
    expect(O.getOrElse(readEvidenceId(" ev "), () => "")).toBe("ev");
    expect(readEvidenceKind("future")).toBe("unknown");
    expect(readEvidenceKind(" Screen ")).toBe("screen");
    expect(readEvidenceState("nope")).toBe("unknown");
    expect(readEvidenceState(" Available ")).toBe("available");
    const screen = ChatEvidenceReference.make({ id: "ev", kind: "screen", state: "available" });
    expect(O.isSome(evidenceReferenceIssue(screen))).toBe(true);
    const summary = ChatEvidenceReference.make({
      id: "ev",
      kind: "conversation_summary",
      state: "available",
      conversationId: O.some("c1"),
    });
    expect(O.isNone(evidenceReferenceIssue(summary))).toBe(true);
    const duplicate = ChatEvidenceEnvelope.make({ references: [screen, screen] });
    expect(O.isSome(evidenceEnvelopeIssue(duplicate))).toBe(true);
    const rewritten = settleEvidenceEnvelope(ChatEvidenceEnvelope.make({ schemaVersion: 2, references: [summary] }));
    expect(rewritten.references[0]?.kind).toBe("unknown");
    const session = addFileIds(ChatSession.make({ id: "s1", createdAt: "2020-01-02T03:04:05.000Z" }), ["f1", "f1"]);
    expect(session.fileIds).toEqual(["f1"]);
    expect(retrieveNewFile(session, ["f1", "f2"])).toEqual(["f2"]);
    expect(Arbitrary.schema(Message)).toBeTruthy();
    expect(Arbitrary.schema(ChatSession)).toBeTruthy();
    expect(Arbitrary.schema(FileChat)).toBeTruthy();
  });
});

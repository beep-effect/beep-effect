import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  ChatSessionResponse,
  DeleteMessagesResponse,
  GenerateTitleResponse,
  InitialMessageResponse,
  SaveMessageResponse,
  decodeChatSessionResponse,
} from "../../beep/ChatSession.ts";

const decodeSaveMessageResponse = S.decodeUnknownEffect(SaveMessageResponse);

describe("ChatSession", () => {
  it("repairs a legacy session and decodes null preview", () => {
    const decoded = Effect.runSync(
      decodeChatSessionResponse({
        id: "s1",
        created_at: "2020-01-02T03:04:05.000Z",
        plugin_id: "app-1",
        message_ids: ["m1", "m2"],
        preview: null,
      }),
    );
    expect(decoded.title).toBe("New Chat");
    expect(decoded.messageCount).toBe(2);
    expect(decoded.starred).toBe(false);
    expect(O.getOrElse(decoded.appId, () => "")).toBe("app-1");
    expect(O.getOrElse(decoded.pluginId, () => "")).toBe("app-1");
    expect(O.isNone(decoded.preview)).toBe(true);
    const missingPreview = Effect.runSync(
      decodeChatSessionResponse({ id: "s2", created_at: "2020-01-02T03:04:05.000Z", title: "Named" }),
    );
    expect(O.isNone(missingPreview.preview)).toBe(true);
    expect(missingPreview.messageCount).toBe(0);
  });

  it("decodes the ack models", () => {
    const savedInput: unknown = {
      id: "m1",
      createdAt: "2020-01-02T03:04:05.000Z",
      sessionId: null,
      created: false,
      updated: false,
      journalRevision: null,
    };
    const saved = Effect.runSync(decodeSaveMessageResponse(savedInput));
    expect(saved.created).toBe(false);
    expect(O.isNone(saved.sessionId)).toBe(true);
    expect(O.isNone(saved.journalRevision)).toBe(true);
    expect(DeleteMessagesResponse.make({ status: "ok", deletedCount: 2 }).deletedCount).toBe(2);
    expect(InitialMessageResponse.make({ message: "Hello", messageId: "m1" }).message).toBe("Hello");
    expect(GenerateTitleResponse.make({ title: "Standup" }).title).toBe("Standup");
    for (const schema of [ChatSessionResponse, SaveMessageResponse, DeleteMessagesResponse, InitialMessageResponse, GenerateTitleResponse]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});

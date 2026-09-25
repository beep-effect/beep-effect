import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { MAX_CONTENT_BLOCKS_BYTES, NotificationMessage, getMessageAsDict } from "../../beep/NotificationMessage.ts";

const encodeNotificationMessage = S.encodeEffect(NotificationMessage);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const base = {
  id: "n1",
  createdAt: "2020-01-02T03:04:05.000Z",
  sender: "ai",
  fromIntegration: "daily_summary",
  type: "day_summary",
  notificationType: "plugin",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("NotificationMessage", () => {
  it("decodes present values including content blocks", () => {
    const message = decode(NotificationMessage, {
      ...base,
      pluginId: "p1",
      text: "hello",
      navigateTo: "/chat/1",
      contentBlocks: [{ type: "text", text: "hi" }],
    });
    assert.strictEqual(O.getOrNull(message.pluginId), "p1");
    assert.strictEqual(O.getOrNull(message.text), "hello");
    assert.strictEqual(O.getOrNull(message.navigateTo), "/chat/1");
    assert.deepStrictEqual(O.getOrNull(message.contentBlocks), [{ type: "text", text: "hi" }]);
    assert.strictEqual(decodeFails(NotificationMessage, { ...base, contentBlocks: ["not an object"] }), true);
    assert.strictEqual(decodeFails(NotificationMessage, { ...base, fromIntegration: 1 }), true);
  });

  it("decodes null and missing Option fields and keeps the Python text default", () => {
    const nulls = decode(NotificationMessage, { ...base, pluginId: null, text: null, navigateTo: null, contentBlocks: null });
    assert.strictEqual(O.isNone(nulls.pluginId), true);
    assert.strictEqual(O.isNone(nulls.text), true);
    assert.strictEqual(O.isNone(nulls.navigateTo), true);
    assert.strictEqual(O.isNone(nulls.contentBlocks), true);
    const missing = decode(NotificationMessage, base);
    assert.strictEqual(O.isNone(missing.pluginId), true);
    assert.strictEqual(O.getOrNull(missing.text), "");
    assert.strictEqual(O.isNone(missing.navigateTo), true);
    assert.strictEqual(O.isNone(missing.contentBlocks), true);
    const encoded = Effect.runSync(encodeNotificationMessage(nulls));
    assert.strictEqual(encoded.pluginId, null);
    assert.strictEqual(encoded.text, null);
    assert.strictEqual(encoded.navigateTo, null);
    assert.strictEqual(encoded.contentBlocks, null);
    const encodedMissing = Effect.runSync(encodeNotificationMessage(missing));
    assert.strictEqual(encodedMissing.text, "");
  });

  it("constructs with a random UUID id, an ISO createdAt, and sender ai", () => {
    const made = NotificationMessage.make({ fromIntegration: "x", type: "t", notificationType: "n" });
    assert.match(made.id, uuidPattern);
    assert.strictEqual(made.sender, "ai");
    assert.strictEqual(O.getOrNull(made.text), "");
    assert.strictEqual(Number.isNaN(Date.parse(made.createdAt)), false);
    const other = NotificationMessage.make({ fromIntegration: "x", type: "t", notificationType: "n" });
    assert.notStrictEqual(made.id, other.id);
  });

  it("getMessageAsDict omits absent plugin_id, navigate_to, and content_blocks", () => {
    const dict = Effect.runSync(getMessageAsDict(decode(NotificationMessage, base)));
    assert.deepStrictEqual(dict, {
      id: "n1",
      created_at: "2020-01-02T03:04:05.000Z",
      sender: "ai",
      from_integration: "daily_summary",
      type: "day_summary",
      notification_type: "plugin",
      text: "",
    });
    const nullText = Effect.runSync(getMessageAsDict(decode(NotificationMessage, { ...base, text: null, contentBlocks: [] })));
    assert.strictEqual(nullText.text, null);
    assert.strictEqual("content_blocks" in nullText, false);
  });

  it("getMessageAsDict keeps present fields and JSON-encodes content blocks", () => {
    const dict = Effect.runSync(
      getMessageAsDict(
        decode(NotificationMessage, {
          ...base,
          pluginId: "p1",
          navigateTo: "/chat/1",
          text: "hello",
          contentBlocks: [{ type: "text", text: "hi" }],
        }),
      ),
    );
    assert.strictEqual(dict.plugin_id, "p1");
    assert.strictEqual(dict.navigate_to, "/chat/1");
    assert.strictEqual(dict.text, "hello");
    assert.strictEqual(dict.content_blocks, '[{"type":"text","text":"hi"}]');
  });

  it("getMessageAsDict drops an oversized card and keeps the message", () => {
    const big = "x".repeat(MAX_CONTENT_BLOCKS_BYTES);
    const dict = Effect.runSync(
      getMessageAsDict(decode(NotificationMessage, { ...base, contentBlocks: [{ type: "text", text: big }] })),
    );
    assert.strictEqual("content_blocks" in dict, false);
    assert.strictEqual(dict.id, "n1");
    const fits = "y".repeat(MAX_CONTENT_BLOCKS_BYTES - 40);
    const kept = Effect.runSync(
      getMessageAsDict(decode(NotificationMessage, { ...base, contentBlocks: [{ type: "text", text: fits }] })),
    );
    assert.strictEqual(typeof kept.content_blocks, "string");
  });

  it("derives an arbitrary", () => {
    assert.notStrictEqual(NotificationMessage.pipe(Arbitrary.schema), undefined);
  });
});

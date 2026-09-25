import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Advice } from "../../beep/Advice.ts";

const decodeAdvice = S.decodeUnknownEffect(Advice);

const instant = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");

describe("Advice", () => {
  it("builds an arbitrary value", () => {
    assert.notStrictEqual(Advice.pipe(Arbitrary.schema), undefined);
  });

  it("defaults confidence and treats missing notes as none", () => {
    const advice = Advice.make({
      id: "advice-1",
      content: "Take a break",
      category: "focus",
      createdAt: instant,
      updatedAt: instant,
    });
    assert.strictEqual(advice.confidence, 0.5);
    assert.strictEqual(advice.isRead, false);
    assert.strictEqual(O.isNone(advice.reasoning), true);
  });

  it("decodes a present note and a null note", () => {
    const base = {
      id: "advice-1",
      content: "Take a break",
      category: "focus",
      reasoning: "You have been at it for hours",
      confidence: 0.5,
      createdAt: "2020-01-02T03:04:05.000Z",
      updatedAt: "2020-01-02T03:04:05.000Z",
      isRead: false,
      isDismissed: false,
    };
    const present: unknown = base;
    const decoded = Effect.runSync(decodeAdvice(present));
    assert.strictEqual(O.getOrNull(decoded.reasoning), "You have been at it for hours");
    const cleared: unknown = { ...base, reasoning: null, sourceApp: null };
    const none = Effect.runSync(decodeAdvice(cleared));
    assert.strictEqual(O.isNone(none.reasoning), true);
    assert.strictEqual(O.isNone(none.sourceApp), true);
  });
});

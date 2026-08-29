import { describe, expect, test } from "bun:test";
import { chromeLinuxArial16 } from "@beep/pretext";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BubbleAuthor, bubbleBox, BubbleConstraints, ChatMessage } from "./Bubble.ts";

const metrics = Effect.runSync(chromeLinuxArial16).metrics;

describe("schema-first bubble shrinkwrap", () => {
  test("a short message shrinkwraps below maxWidth from exact fixture arithmetic", () => {
    const padding = 8;
    const constraints = BubbleConstraints.make({ maxWidth: 200, padding });
    const box = O.getOrThrow(
      bubbleBox(metrics, ChatMessage.make({ id: "short", author: "user", text: "The dragon" }), constraints)
    );
    const contentWidth = metrics.words.The + metrics.spaceWidth + metrics.words.dragon;

    expect(box.width).toBe(contentWidth + 2 * padding);
    expect(box.width).toBeLessThan(constraints.maxWidth + 2 * padding);
    expect(box.height).toBe(metrics.lineHeight + 2 * padding);
  });

  test("a long message clamps width and grows height with line count", () => {
    const padding = 8;
    const constraints = BubbleConstraints.make({ maxWidth: 40, padding });
    const box = O.getOrThrow(
      bubbleBox(
        metrics,
        ChatMessage.make({ id: "long", author: "agent", text: "The dragon slithers across the page" }),
        constraints
      )
    );

    expect(box.width).toBe(constraints.maxWidth + 2 * padding);
    expect(box.height).toBeGreaterThan(metrics.lineHeight + 2 * padding);
  });

  test("padding defaults to zero", () => {
    const constraints = BubbleConstraints.make({ maxWidth: 200 });
    const box = O.getOrThrow(
      bubbleBox(metrics, ChatMessage.make({ id: "default", author: "user", text: "The" }), constraints)
    );

    expect(constraints.padding).toBe(0);
    expect(box.width).toBe(metrics.words.The);
    expect(box.height).toBe(metrics.lineHeight);
  });

  test("unmeasured text produces no bubble box", () => {
    expect(
      bubbleBox(
        metrics,
        ChatMessage.make({ id: "unknown", author: "agent", text: "unmeasured" }),
        BubbleConstraints.make({ maxWidth: 200 })
      )
    ).toEqual(O.none());
  });

  test("author literals round-trip through the schema", () => {
    const author = Effect.runSync(S.decodeEffect(BubbleAuthor)("agent"));

    expect(Effect.runSync(S.encodeEffect(BubbleAuthor)(author))).toBe("agent");
  });
});

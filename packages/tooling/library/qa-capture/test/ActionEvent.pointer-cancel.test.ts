import { decodeActionEventJson, encodeActionEventJson, PointerCancelEvent } from "@beep/qa-capture";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";

describe("@beep/qa-capture pointer-cancel events", () => {
  it.effect(
    "decodes a witness pointer-cancel NDJSON line through the ActionEvent union",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeActionEventJson(
        '{"kind":"pointer-cancel","pointerId":1,"selectorPath":"[data-qa=\\"dock-sash\\"]","seq":8,"tEpochMs":1753838000800,"x":160,"y":240}'
      );
      expect(decoded.kind).toBe("pointer-cancel");
      expect(decoded.seq).toBe(8);
    })
  );

  it.effect(
    "round-trips a pointer-cancel event through encode and decode",
    Effect.fnUntraced(function* () {
      const event = PointerCancelEvent.make({
        kind: "pointer-cancel",
        pointerId: 1,
        selectorPath: '[data-qa="dock-sash"]',
        seq: 8,
        tEpochMs: 1753838000800,
        x: 160,
        y: 240,
      });
      expect(O.isNone(event.rect)).toBe(true);
      const encoded = yield* encodeActionEventJson(event);
      const decoded = yield* decodeActionEventJson(encoded);
      expect(Equal.equals(decoded, event)).toBe(true);
    })
  );
});

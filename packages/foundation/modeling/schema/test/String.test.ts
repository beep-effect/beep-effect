import { StrFromUnknown } from "@beep/schema/String";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decode = S.decodeUnknownEffect(StrFromUnknown);
const encode = S.encodeEffect(StrFromUnknown);

describe("StrFromUnknown", () => {
  it.effect(
    "preserves strings",
    Effect.fnUntraced(function* () {
      expect(yield* decode("hello")).toBe("hello");
    })
  );

  it.effect(
    "stringifies JSON-compatible values as compact JSON text",
    Effect.fnUntraced(function* () {
      expect(yield* decode({ ok: true })).toBe('{"ok":true}');
      expect(yield* decode(["a", 1])).toBe('["a",1]');
      expect(yield* decode(null)).toBe("null");
    })
  );

  it.effect(
    "decodes errors to their message",
    Effect.fnUntraced(function* () {
      expect(yield* decode(new Error("boom"))).toBe("boom");
    })
  );

  it.effect(
    "falls back to JavaScript string coercion for non-JSON values",
    Effect.fnUntraced(function* () {
      expect(yield* decode(undefined)).toBe("undefined");
      expect(yield* decode(Symbol("beep"))).toBe("Symbol(beep)");
      expect(yield* decode(BigInt(1))).toBe("1");
    })
  );

  it.effect(
    "keeps encoding as a string passthrough",
    Effect.fnUntraced(function* () {
      expect(yield* encode("hello")).toBe("hello");
    })
  );
});

import { EffectSchema, isEffect } from "@beep/schema/EffectSchema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

describe("EffectSchema", () => {
  it("accepts Effect runtime values", () => {
    const value = Effect.succeed(1);

    expect(isEffect(value)).toBe(true);
    expect(S.is(EffectSchema())(value)).toBe(true);
  });

  it("accepts composed effects", () => {
    const value = Effect.gen(function* () {
      const count = yield* Effect.succeed(1);
      return count + 1;
    });

    expect(isEffect(value)).toBe(true);
    expect(S.is(EffectSchema())(value)).toBe(true);
  });

  it.effect(
    "rejects non-effect values",
    Effect.fnUntraced(function* () {
      expect(isEffect(globalThis.Promise.resolve(1))).toBe(false);
      expect(isEffect("nope")).toBe(false);
      const result = yield* Effect.exit(S.decodeUnknownEffect(EffectSchema())("nope"));
      expect(result._tag).toBe("Failure");
    })
  );
});

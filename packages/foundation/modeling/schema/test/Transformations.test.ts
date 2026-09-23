import { destructiveTransform } from "@beep/schema/Transformations";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("destructiveTransform", () => {
  it.effect(
    "decodes by applying the lossy transform",
    Effect.fnUntraced(function* () {
      const schema = destructiveTransform(S.String, (value) => value.length);

      expect(yield* S.decodeEffect(schema)("beep")).toBe(4);
    })
  );

  it.effect(
    "preserves source decode failures",
    Effect.fnUntraced(function* () {
      const schema = destructiveTransform(S.String, (value) => value.length);

      const failure1 = yield* Effect.result(S.decodeEffect(schema)(1));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected string");
      }
    })
  );

  it.effect(
    "maps thrown transform errors into parse issues",
    Effect.fnUntraced(function* () {
      const schema = destructiveTransform(S.String, () => {
        throw new Error("boom");
      });

      const failure2 = yield* Effect.result(S.decodeEffect(schema)("beep"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Error applying transformation");
      }
    })
  );

  it.effect(
    "passes transformed values through on encode",
    Effect.fnUntraced(function* () {
      const schema = destructiveTransform(S.String, (value) => value.length);

      expect(yield* S.encodeEffect(schema)(4)).toBe(4);
    })
  );

  it.effect(
    "works for transformed struct fields during encode",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({
        size: destructiveTransform(S.String, (value) => value.length),
      });

      const decoded = yield* S.decodeEffect(schema)({ size: "beep" });
      const encoded = yield* S.encodeEffect(schema)({ size: 4 });

      expect(decoded).toEqual({ size: 4 });
      expect(encoded).toEqual({ size: 4 });
    })
  );
});

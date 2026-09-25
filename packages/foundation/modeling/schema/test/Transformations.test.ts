import { destructiveTransform } from "@beep/schema/Transformations";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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

      const failure1 = yield* Effect.exit(S.decodeEffect(schema)(1));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain("Expected string");
      }
    })
  );

  it.effect(
    "maps thrown transform errors into parse issues",
    Effect.fnUntraced(function* () {
      const schema = destructiveTransform(S.String, () => {
        throw new Error("boom");
      });

      const failure2 = yield* Effect.exit(S.decodeEffect(schema)("beep"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Error applying transformation"
        );
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

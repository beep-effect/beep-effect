import { normalizePath, PosixPath } from "@beep/schema/PosixPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodePosixPathEffect = S.decodeEffect(PosixPath);

describe("PosixPath", () => {
  it("normalizes native separators during decode", () => {
    expect(normalizePath("packages\\foundation\\modeling\\schema")).toBe("packages/foundation/modeling/schema");
  });

  it.effect(
    "accepts already normalized paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodePosixPathEffect("packages/foundation/modeling/schema")).toBe(
        "packages/foundation/modeling/schema"
      );
    })
  );

  it.effect(
    "rejects paths that still contain backslashes",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodePosixPathEffect("packages\\common\\schema"));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected a string matching");
      }
    })
  );
});

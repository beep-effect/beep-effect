import { normalizePath, PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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
      const failure1 = yield* Effect.exit(decodePosixPathEffect("packages\\common\\schema"));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected a string matching"
        );
      }
    })
  );
});

import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SpawnOnceResult } from "../../../effected/github-actions/internal/spawn.ts";

it.effect("spawn result schema preserves plain output and finite caller-policy exit codes", () =>
  Effect.gen(function* () {
    for (const code of [0, 1, -1, 1.5]) {
      const result = { output: "", code } satisfies SpawnOnceResult;
      assert.deepStrictEqual(yield* S.decodeEffect(SpawnOnceResult)(result), result);
      assert.deepStrictEqual(yield* S.encodeEffect(SpawnOnceResult)(result), result);
    }
    for (const code of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "0", undefined]) {
      assert.isFalse(S.is(SpawnOnceResult)({ output: "text", code }));
    }
    assert.isFalse(S.is(SpawnOnceResult)({ output: "text" }));
    assert.isFalse(S.is(SpawnOnceResult)({ code: 0 }));
  }),
);

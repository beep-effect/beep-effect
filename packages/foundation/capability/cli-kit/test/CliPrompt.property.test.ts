import { CliPromptTarget } from "@beep/cli-kit/CliPrompt";
import { answerWithoutPerson } from "@beep/cli-kit/internal/fallbackAnswer";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CliPromptFallbackOptions } from "@beep/cli-kit/CliPrompt";

const assertMissingTarget = (
  target: CliPromptTarget,
  error: { readonly _tag: string; readonly option?: string; readonly argument?: string }
): void => {
  if ("flag" in target) {
    assert.strictEqual(error._tag, "MissingOption");
    if (error._tag === "MissingOption") assert.strictEqual(error.option, target.flag);
  } else {
    assert.strictEqual(error._tag, "MissingArgument");
    if (error._tag === "MissingArgument") assert.strictEqual(error.argument, target.argument);
  }
};

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CliPromptTarget round-trips both plain missing-parameter targets",
  [Arbitrary.schema(CliPromptTarget)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CliPromptTarget)(value);
      const decoded = yield* S.decodeEffect(CliPromptTarget)(encoded);
      assert.deepStrictEqual(decoded, value);
      const value1 = yield* S.encodeEffect(CliPromptTarget)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "schema-derived targets keep missing-parameter payloads with absent or undefined fallback answers",
  [Arbitrary.schema(CliPromptTarget)],
  ([target]) =>
    Effect.gen(function* () {
      const options: CliPromptFallbackOptions<string | undefined> = { ...target, otherwise: undefined };
      for (const value of [target, options]) {
        const error = yield* Effect.flip(answerWithoutPerson(value));
        assertMissingTarget(target, error);
      }
    }),
  runs
);

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CodeScanningSetup } from "../../effected/github/CodeScanning.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CodeScanningSetup decodes every encoded value without losing data",
  [Arbitrary.schema(CodeScanningSetup)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CodeScanningSetup)(value);
      const decoded = yield* S.decodeEffect(CodeScanningSetup)(encoded);
      assert.isTrue(S.toEquivalence(CodeScanningSetup)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(CodeScanningSetup)(decoded), encoded);
    }),
  runs
);

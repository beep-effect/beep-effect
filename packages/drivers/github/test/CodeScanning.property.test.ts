import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CodeScanningSetup } from "@beep/github/CodeScanning";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CodeScanningSetup decodes every encoded value without losing data",
  [Arbitrary.schema(CodeScanningSetup)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CodeScanningSetup)(value);
      const decoded = yield* S.decodeEffect(CodeScanningSetup)(encoded);
      assert.isTrue(S.toEquivalence(CodeScanningSetup)(decoded, value));
      const value1 = yield* S.encodeEffect(CodeScanningSetup)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

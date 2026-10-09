import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ToolInstallerError } from "../../effected/github-actions/ToolInstaller.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "ToolInstallerError decoding an encoded error never fails and preserves its fields and derived behavior",
  [Arbitrary.schema(ToolInstallerError)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ToolInstallerError)(value);
      const decoded = yield* S.decodeEffect(ToolInstallerError)(encoded);
      assert.strictEqual(S.toEquivalence(ToolInstallerError)(decoded, value), true);
      assert.deepStrictEqual(yield* S.encodeEffect(ToolInstallerError)(decoded), encoded);
      assert.strictEqual(decoded.message, value.message);
      assert.strictEqual(decoded.retryable, value.retryable);
    }),
  runs,
);

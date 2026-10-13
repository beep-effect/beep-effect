import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DeploymentEnvironmentInfo } from "../../effected/github/DeploymentEnvironment.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "DeploymentEnvironmentInfo decodes every encoded value without losing data",
  [Arbitrary.schema(DeploymentEnvironmentInfo)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(DeploymentEnvironmentInfo)(value);
      const decoded = yield* S.decodeEffect(DeploymentEnvironmentInfo)(encoded);
      assert.isTrue(S.toEquivalence(DeploymentEnvironmentInfo)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(DeploymentEnvironmentInfo)(decoded), encoded);
    }),
  runs
);

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ProjectDirInput } from "../../effected/engine/LaunchContext.ts";

const runs = { arbitrary: fcRuns(100) };

describe("LaunchContext property floor", () => {
  it.effect.prop(
    "ProjectDirInput encoding decodes successfully to an equivalent value",
    [Arbitrary.schema(ProjectDirInput)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ProjectDirInput)(value);
      const decoded = yield* S.decodeEffect(ProjectDirInput)(encoded);
      assert.strictEqual(S.toEquivalence(ProjectDirInput)(decoded, value), true);
    }),
    runs,
  );
});

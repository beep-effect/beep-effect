import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CurrentRuntimeEnv, RuntimeEnv } from "../../../effected/env/RuntimeEnv.ts";
import { autoFormat, underGithubActions } from "../../../effected/cli/internal/autoFormat.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("audience format selection is stable and only GitHub CI selects workflow logs", [Arbitrary.schema(S.Literals(["human", "agent", "ci"])), Arbitrary.schema(S.Literals(["github", "generic", "none"]))], ([audience, ci]) => Effect.gen(function* () {
  const runtime = RuntimeEnv.fromRecord(ci === "github" ? { GITHUB_ACTIONS: "true" } : ci === "generic" ? { CI: "true" } : {});
  const result = yield* autoFormat(audience).pipe(Effect.provideService(CurrentRuntimeEnv, runtime));
  assert.strictEqual(result, audience === "human" ? "ansi" : audience === "agent" ? "plain" : ci === "github" ? "githubLog" : "plain");
  assert.strictEqual(yield* autoFormat(audience).pipe(Effect.provideService(CurrentRuntimeEnv, runtime)), result);
  assert.strictEqual(yield* underGithubActions.pipe(Effect.provideService(CurrentRuntimeEnv, runtime)), ci === "github");
}), runs);

import { autoFormat, underGithubActions } from "@beep/cli-kit/internal/autoFormat";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CurrentRuntimeEnv, RuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runtimeRecord = (ci: "github" | "generic" | "none") =>
  ci === "github" ? { GITHUB_ACTIONS: "true" } : ci === "generic" ? { CI: "true" } : {};
const expectedFormat = (audience: "human" | "agent" | "ci", ci: "github" | "generic" | "none") =>
  audience === "human" ? "ansi" : audience === "agent" ? "plain" : ci === "github" ? "githubLog" : "plain";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "audience format selection is stable and only GitHub CI selects workflow logs",
  [Arbitrary.schema(S.Literals(["human", "agent", "ci"])), Arbitrary.schema(S.Literals(["github", "generic", "none"]))],
  ([audience, ci]) =>
    Effect.gen(function* () {
      const runtime = RuntimeEnv.fromRecord(runtimeRecord(ci));
      const result = yield* autoFormat(audience).pipe(Effect.provideService(CurrentRuntimeEnv, runtime));
      assert.strictEqual(result, expectedFormat(audience, ci));
      const pipe1 = yield* autoFormat(audience).pipe(Effect.provideService(CurrentRuntimeEnv, runtime));
      assert.strictEqual(pipe1, result);
      const pipe2 = yield* underGithubActions.pipe(Effect.provideService(CurrentRuntimeEnv, runtime));
      assert.strictEqual(pipe2, ci === "github");
    }),
  runs
);

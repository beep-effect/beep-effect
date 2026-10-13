import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AppliedSettings, repositoryPatch, transformSecurityAndAnalysis } from "../../effected/github/GitHubRepository.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("AppliedSettings encode/decode preserves both key lists", [Arbitrary.schema(AppliedSettings)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(AppliedSettings)(value);
  const decoded = yield* S.decodeEffect(AppliedSettings)(encoded);
  assert.isTrue(S.toEquivalence(AppliedSettings)(decoded, value));
}), runs);
it.effect.prop("repository patch normalization is idempotent and preserves configured values", [Arbitrary.schema(S.Struct({ has_wiki: S.Boolean, description: S.String }))], ([value]) => Effect.sync(() => {
  const patch = repositoryPatch({ ...value, has_issues: undefined });
  assert.deepStrictEqual(patch, value);
  assert.deepStrictEqual(repositoryPatch(patch), patch);
}), runs);
it.effect.prop("security status normalization is idempotent and faithful to both accepted shapes", [Arbitrary.schema(S.Literals(["enabled", "disabled"]))], ([status]) => Effect.sync(() => {
  const expected = { secret_scanning: { status } };
  const normalized = transformSecurityAndAnalysis({ secret_scanning: status });
  assert.deepStrictEqual(normalized, expected);
  assert.deepStrictEqual(transformSecurityAndAnalysis(normalized), expected);
  assert.deepStrictEqual(transformSecurityAndAnalysis(expected), normalized);
}), runs);

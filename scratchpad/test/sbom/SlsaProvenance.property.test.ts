import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SlsaBuildDefinition, SlsaRunDetails, GitHubWorkflowProvenance, SlsaProvenance } from "../../effected/sbom/SlsaProvenance.ts";
import * as A from "effect/Array";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs,
  );
};

describe("SlsaProvenance property floor", () => {
  roundTrips("SlsaBuildDefinition", SlsaBuildDefinition);
  roundTrips("SlsaRunDetails", SlsaRunDetails);
  roundTrips("GitHubWorkflowProvenance", GitHubWorkflowProvenance);
  roundTrips("SlsaProvenance", SlsaProvenance);
});

it.effect.prop("workflow extraction preserves the first occurrence and the first-at path boundary", [Arbitrary.schema(GitHubWorkflowProvenance)], ([input]) => Effect.sync(() => {
  const provenance = SlsaProvenance.forGitHubWorkflow(input);
  const expected = A.join(A.take(Str.split("@")(Str.replace(`${input.repository}/`, "")(input.workflowRef)), 1), "");
  assert.strictEqual(provenance.buildDefinition.externalParameters.workflow.path, expected);
  assert.strictEqual(provenance.buildDefinition.externalParameters.workflow.repository, `${input.serverUrl}/${input.repository}`);
  assert.deepStrictEqual(provenance.buildDefinition.resolvedDependencies, [{ uri: `git+${input.serverUrl}/${input.repository}@${input.ref}`, digest: { gitCommit: input.sha } }]);
}), runs);

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { configDependenciesOf, inlinePeerDependencyRules } from "@beep/repo-workspaces/internal/workspaceYaml";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const codec = S.fromJsonString(S.Json);

it.effect.prop(
  "workspace document projections are idempotent and parse/stringify/parse preserves their normalized rules",
  [Arbitrary.schema(S.Json)],
  ([raw]) =>
    Effect.gen(function* () {
      const dependencies = configDependenciesOf({ configDependencies: raw });
      const rules = inlinePeerDependencyRules({ peerDependencyRules: raw });
      const normalized = {
        configDependencies: dependencies,
        peerDependencyRules: {
          allowedVersions: rules.allowedVersions,
          ignoreMissing: rules.ignoreMissing,
          allowAny: rules.allowAny,
        },
      };
      assert.deepStrictEqual(configDependenciesOf(normalized), dependencies);
      assert.deepStrictEqual(inlinePeerDependencyRules(normalized), rules);
      const argument = S.decodeEffect(codec);
      const value = yield* S.encodeEffect(codec)(normalized);
      const decoded = yield* argument(value);
      assert.deepStrictEqual(configDependenciesOf(decoded), dependencies);
      assert.deepStrictEqual(inlinePeerDependencyRules(decoded), rules);
    }),
  runs
);

const Document = S.Struct({
  configDependencies: S.Record(S.String, S.String),
  peerDependencyRules: S.Struct({
    allowedVersions: S.Record(S.String, S.String),
    ignoreMissing: S.Array(S.String),
    allowAny: S.Array(S.String),
  }),
});
it.effect.prop(
  "valid document fields survive both projections and a serialized document round trip",
  [Arbitrary.schema(Document)],
  ([document]) =>
    Effect.gen(function* () {
      const argument1 = S.decodeEffect(codec);
      const value1 = yield* S.encodeEffect(codec)(document);
      const decoded = yield* argument1(value1);
      assert.deepStrictEqual(configDependenciesOf(decoded), document.configDependencies);
      assert.deepStrictEqual(inlinePeerDependencyRules(decoded), document.peerDependencyRules);
    }),
  runs
);

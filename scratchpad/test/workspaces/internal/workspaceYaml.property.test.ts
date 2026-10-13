import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { configDependenciesOf, inlinePeerDependencyRules } from "../../../effected/workspaces/internal/workspaceYaml.ts";
const runs = { arbitrary: fcRuns(100) };
const codec = S.fromJsonString(S.Json);

it.effect.prop("workspace document projections are idempotent and parse/stringify/parse preserves their normalized rules", [Arbitrary.schema(S.Json)], ([raw]) => Effect.gen(function* () {
  const dependencies = configDependenciesOf({ configDependencies: raw });
  const rules = inlinePeerDependencyRules({ peerDependencyRules: raw });
  const normalized = { configDependencies: dependencies, peerDependencyRules: rules };
  assert.deepStrictEqual(configDependenciesOf(normalized), dependencies);
  assert.deepStrictEqual(inlinePeerDependencyRules(normalized), rules);
  const decoded = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(normalized));
  assert.deepStrictEqual(configDependenciesOf(decoded), dependencies);
  assert.deepStrictEqual(inlinePeerDependencyRules(decoded), rules);
}), runs);

const Document = S.Struct({ configDependencies: S.Record(S.String, S.String), peerDependencyRules: S.Struct({ allowedVersions: S.Record(S.String, S.String), ignoreMissing: S.Array(S.String), allowAny: S.Array(S.String) }) });
it.effect.prop("valid document fields survive both projections and a serialized document round trip", [Arbitrary.schema(Document)], ([document]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(document));
  assert.deepStrictEqual(configDependenciesOf(decoded), document.configDependencies);
  assert.deepStrictEqual(inlinePeerDependencyRules(decoded), document.peerDependencyRules);
}), runs);

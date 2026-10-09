import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { registrySettingsOf, scratchWorkspaceYaml } from "../../../effected/workspaces/internal/configDependencyFetch.ts";
import { Yaml } from "../../../effected/yaml/index.ts";

const runs = { arbitrary: fcRuns(100) };
const settings = S.Struct({ registry: S.String, registries: S.Record(S.String, S.String) });
it.effect.prop("registry extraction is idempotent and scratch YAML preserves every registry scalar", [Arbitrary.schema(settings), Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([config, name, version]) => Effect.gen(function* () {
  const normalized = registrySettingsOf(config);
  assert.deepStrictEqual(registrySettingsOf(normalized), normalized);
  const formatted = scratchWorkspaceYaml(name, version, normalized);
  const parsed = yield* Yaml.parse(formatted);
  assert.deepStrictEqual(parsed, { configDependencies: { [name]: version }, registry: normalized.registry, ...(Object.keys(normalized.registries).length === 0 ? {} : { registries: normalized.registries }) });
  assert.deepStrictEqual(registrySettingsOf(parsed), normalized);
  assert.strictEqual(scratchWorkspaceYaml(name, version, registrySettingsOf(parsed)), formatted);
  assert.deepStrictEqual(yield* Yaml.parse(scratchWorkspaceYaml(name, version, registrySettingsOf(parsed))), parsed);
}), runs);

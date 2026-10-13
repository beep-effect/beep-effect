import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { configDependenciesOf, inlinePeerDependencyRules } from "../../../effected/workspaces/internal/workspaceYaml.ts";

it.effect("malformed documents and rule axes degrade independently", () => Effect.sync(() => {
  const empty = { allowedVersions: {}, ignoreMissing: [], allowAny: [] };
  for (const document of [null, 1, {}, { configDependencies: 1, peerDependencyRules: 1 }]) {
    assert.deepStrictEqual(configDependenciesOf(document), {});
    assert.deepStrictEqual(inlinePeerDependencyRules(document), empty);
  }
  assert.deepStrictEqual(configDependenciesOf({ configDependencies: { valid: "1.2.3", bad: 7 } }), { valid: "1.2.3" });
  assert.deepStrictEqual(inlinePeerDependencyRules({ peerDependencyRules: { allowedVersions: { react: "^19", bad: 7 }, ignoreMissing: ["a"], allowAny: ["b"] } }), { allowedVersions: { react: "^19" }, ignoreMissing: ["a"], allowAny: ["b"] });
  assert.deepStrictEqual(inlinePeerDependencyRules({ peerDependencyRules: { allowedVersions: 7, ignoreMissing: 7, allowAny: null } }), empty);
}));

it.effect("string-valued prototype keys remain own data in both maps", () => Effect.sync(() => {
  const values = { ["__proto__"]: "^1" };
  assert.deepStrictEqual(configDependenciesOf({ configDependencies: values }), values);
  assert.deepStrictEqual(inlinePeerDependencyRules({ peerDependencyRules: { allowedVersions: values } }).allowedVersions, values);
}));

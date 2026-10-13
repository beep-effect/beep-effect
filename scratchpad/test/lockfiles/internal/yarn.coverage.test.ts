import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { parseYarn } from "../../../effected/lockfiles/internal/yarn.ts";
import { Yaml } from "../../../effected/yaml/index.ts";

describe("Yarn descriptor and identity boundaries", () => {
  it.effect("skips malformed names and empty identities without losing valid defaulted rows", () => Effect.gen(function* () {
    const content = yield* Yaml.stringify({
      "": {},
      ", valid@npm:1": { resolution: "valid@npm:1" },
      "malformed": { linkType: "soft" },
      "empty@npm:1": { resolution: "" },
      "defaulted@npm:1": {},
    });
    const fields = yield* parseYarn(content);
    assert.deepStrictEqual(A.map(fields.packages, (pkg) => [pkg.name, pkg.version, pkg.instanceId]), [
      ["defaulted", "0.0.0", "defaulted@npm:1"],
    ]);
    assert.deepStrictEqual(fields.workspaceDependencies, []);
    assert.strictEqual(fields.lockfileVersion, "unknown");
  }));

  it.effect("records unresolved edges in sorted order and ignores empty dependency names", () => Effect.gen(function* () {
    const content = yield* Yaml.stringify({
      "root@npm:1": {
        dependencies: { "": "npm:1", z: "npm:1", a: "npm:1", found: "npm:1" },
        optionalDependencies: { z: "npm:1", optional: "npm:2" },
      },
      "found@npm:1": { resolution: "found@npm:1" },
      "optional@npm:2": {},
    });
    const fields = yield* parseYarn(content);
    assert.strictEqual(fields.packages.length, 3);
    assert.deepStrictEqual(A.map(A.filter(fields.packages, (pkg) => pkg.name === "root"), (pkg) => ({
      resolved: pkg.resolved, unresolvedEdges: pkg.unresolvedEdges,
    })), [{ resolved: { found: "found@npm:1", optional: "optional@npm:2" }, unresolvedEdges: ["a", "z"] }]);
  }));

  it.effect("omits workspace paths when all descriptors are wildcard, empty, or non-workspace", () => Effect.gen(function* () {
    const fields = yield* parseYarn(yield* Yaml.stringify({
      "root@workspace:*, root@workspace:, root@npm:1": { linkType: "soft" },
      "npmsoft@npm:1": { linkType: "soft" },
    }));
    assert.deepStrictEqual(A.map(fields.packages, (pkg) => [pkg.name, pkg.isWorkspace, pkg.relativePath]), [
      ["root", true, undefined], ["npmsoft", true, undefined],
    ]);
    assert.deepStrictEqual(fields.workspaceDependencies, []);
  }));
});

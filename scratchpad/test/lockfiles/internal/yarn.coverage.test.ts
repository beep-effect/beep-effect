import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import { parseYarn } from "../../../effected/lockfiles/internal/yarn.ts";
import { Yaml } from "../../../effected/yaml/index.ts";

describe("Yarn descriptor and identity boundaries", () => {
  it.effect("records a compound descriptor targeting a skipped row as unresolved", () => Effect.gen(function* () {
    const lockfile = yield* Lockfile.parse(yield* Yaml.stringify({
      __metadata: { version: 8 },
      "consumer@npm:1": { version: "1", dependencies: { ghost: "npm:1" } },
      ", ghost@npm:1": { version: "1", resolution: "ghost@npm:1" },
    }), { format: "yarn" });
    assert.deepStrictEqual(A.map(lockfile.packages, (pkg) => ({
      name: pkg.name, resolved: pkg.resolved, unresolvedEdges: pkg.unresolvedEdges,
    })), [{ name: "consumer", resolved: {}, unresolvedEdges: ["ghost"] }]);
    assertNone(lockfile.packageByInstanceId("ghost@npm:1"));
    for (const pkg of lockfile.packages) {
      for (const instanceId of R.values(pkg.resolved)) lockfile.packageByInstanceId(instanceId).pipe(O.isSome, assertTrue);
    }
  }));

  it.effect("records an unsupported-protocol descriptor targeting a skipped row as unresolved", () => Effect.gen(function* () {
    const lockfile = yield* Lockfile.parse(yield* Yaml.stringify({
      __metadata: { version: 8 },
      "ghost@not-a-protocol": {},
      "real@npm:1.0.0": { dependencies: { ghost: "not-a-protocol" } },
    }), { format: "yarn" });
    assert.deepStrictEqual(A.map(lockfile.packages, (pkg) => ({
      name: pkg.name, resolved: pkg.resolved, unresolvedEdges: pkg.unresolvedEdges,
    })), [{ name: "real", resolved: {}, unresolvedEdges: ["ghost"] }]);
    assertNone(lockfile.packageByInstanceId("ghost@not-a-protocol"));
    for (const pkg of lockfile.packages) {
      for (const instanceId of R.values(pkg.resolved)) lockfile.packageByInstanceId(instanceId).pipe(O.isSome, assertTrue);
    }
  }));

  it.effect("preserves skipped-row aliases to emitted locators and descriptor overwrite precedence", () => Effect.gen(function* () {
    const lockfile = yield* Lockfile.parse(yield* Yaml.stringify({
      __metadata: { version: 8 },
      "consumer@npm:1": { dependencies: { ghost: "npm:1" } },
      "ghost@npm:1": { resolution: "ghost@npm:previous" },
      "real@npm:1": { resolution: "real@npm:1" },
      ", ghost@npm:1": { resolution: "real@npm:1" },
    }), { format: "yarn" });
    assert.strictEqual(lockfile.packages.length, 3);
    assert.deepStrictEqual(A.map(lockfile.packagesNamed("consumer"), (pkg) => ({
      resolved: pkg.resolved, unresolvedEdges: pkg.unresolvedEdges,
    })), [{ resolved: { ghost: "real@npm:1" }, unresolvedEdges: [] }]);
    for (const pkg of lockfile.packages) {
      for (const instanceId of R.values(pkg.resolved)) lockfile.packageByInstanceId(instanceId).pipe(O.isSome, assertTrue);
    }
  }));

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

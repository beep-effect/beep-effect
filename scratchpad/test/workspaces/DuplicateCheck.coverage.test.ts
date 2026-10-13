import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Lockfile, LockfileImporter, ResolvedPackage } from "../../effected/lockfiles/index.ts";
import { DuplicateCheck } from "../../effected/workspaces/DuplicateCheck.ts";

const workspace = (version: string, relativePath: string, resolved: Record<string, string> = {}) => ResolvedPackage.make({
  name: "same", version, instanceId: `same@${version}`, isWorkspace: true, relativePath, resolved,
});

describe("DuplicateCheck coverage", () => {
  it.effect("reports reached workspace roots even when they have no incoming dependents", () => Effect.sync(() => {
    const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", workspaceDependencies: [],
      packages: [workspace("1.0.0", "one", { missing: "absent@1" }), workspace("2.0.0", "two")],
      importers: [LockfileImporter.make({ path: "one", dependencies: [] }), LockfileImporter.make({ path: "two", dependencies: [] })],
    });
    const report = DuplicateCheck.run(lockfile);
    assert.isFalse(report.isClean);
    assert.deepStrictEqual(report.unresolvedImporters, []);
    assert.deepStrictEqual(report.duplicates.map((row) => ({ name: row.name, versions: row.versions.map((version) => ({
      version: version.version, instances: version.instances.map((instance) => ({ instanceId: instance.instanceId, dependents: instance.dependents })),
    })) })), [{ name: "same", versions: [
      { version: "1.0.0", instances: [{ instanceId: "same@1.0.0", dependents: [] }] },
      { version: "2.0.0", instances: [{ instanceId: "same@2.0.0", dependents: [] }] },
    ] }]);
  }));
});

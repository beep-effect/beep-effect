import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Lockfile } from "../../effected/lockfiles/Lockfile.ts";
import { PeerCheck } from "../../effected/workspaces/PeerCheck.ts";
import { WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";

const linkedPackage = (relativePath: string, peerDependencies: Readonly<Record<string, string>>, meta: unknown = {}) =>
  WorkspacePackage.make({ name: "linked", version: "1.0.0", path: `/repo/${relativePath}`,
    packageJsonPath: `/repo/${relativePath}/package.json`, relativePath, workspaceRoot: "/repo",
    peerDependencies, manifestRecord: { peerDependenciesMeta: meta }, publishConfig: { directory: "." } });
const dependency = (name: string, version: string) => ({ name, version, specifier: "*", depType: "dependencies" });
const row = (instanceId: string, name: string, version: string) => ({ instanceId, name, version, isWorkspace: false });
const workspace = (relativePath: string) => ({ instanceId: `workspace:${relativePath}`, name: relativePath,
  version: "0.0.0", isWorkspace: true, relativePath });
const decode = (packages: ReadonlyArray<unknown>, importers: ReadonlyArray<unknown>) =>
  S.decodeUnknownEffect(Lockfile)({ format: "pnpm", lockfileVersion: "9", workspaceDependencies: [], packages, importers });
const rules = { allowedVersions: {}, ignoreMissing: [], allowAny: [] };

describe("PeerCheck coverage of linked contexts", () => {
  it.effect("rescues an importer whose only versioned dependency is a covered link", () => Effect.gen(function* () {
    const lock = yield* decode([workspace("a")], [{ path: ".", dependencies: [dependency("linked", "link:a")] }]);
    const report = PeerCheck.run(lock, { peerDependencyRules: rules, workspacePackages: [linkedPackage("a", { react: "^18" })] });
    assert.deepStrictEqual(report.unresolvedImporters, []);
    assert.deepStrictEqual(report.unverified, []);
    assert.strictEqual(report.required[0]?.dependency, "react");
    assert.strictEqual(report.required[0]?.found, null);
  }));
  it.effect("retains an unresolved importer when a link seed cannot rescue another versioned dependency", () => Effect.gen(function* () {
    const lock = yield* decode([workspace("a")], [{ path: ".", dependencies: [dependency("linked", "link:a"), dependency("missing", "9.0.0")] }]);
    const report = PeerCheck.run(lock, { peerDependencyRules: rules, workspacePackages: [linkedPackage("a", {})] });
    assert.deepStrictEqual(report.unresolvedImporters, ["."]);
    assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
  }));
  it.effect("a supplied target with no workspace row remains unverified even when other roots are walkable", () => Effect.gen(function* () {
    const lock = yield* decode([row("other@1.0.0", "other", "1.0.0")], [{ path: ".", dependencies: [dependency("linked", "link:a"), dependency("other", "1.0.0")] }]);
    const report = PeerCheck.run(lock, { peerDependencyRules: rules, workspacePackages: [linkedPackage("a", {})] });
    assert.deepStrictEqual(report.unverified, ["unresolvedEdge"]);
    assert.deepStrictEqual(report.unresolvedImporters, []);
  }));
  it.effect("normalizes links to the root and retains the first duplicate manifest", () => Effect.gen(function* () {
    const lock = yield* decode([workspace("."), { ...workspace("consumer"), resolved: { linked: "workspace:." } }], [
      { path: "consumer", dependencies: [dependency("linked", "link:.././")] },
    ]);
    const report = PeerCheck.run(lock, { peerDependencyRules: rules, workspacePackages: [linkedPackage(".", { react: "18" }), linkedPackage(".", { ignored: "1" })] });
    assert.deepStrictEqual(report.unsatisfied.map((peer) => peer.dependency), ["react"]);
  }));
  it.effect("missing and workspace providers respect optional joined peers and malformed metadata", () => Effect.gen(function* () {
    const lock = yield* decode([workspace("a"), workspace("provider")], [{ path: ".", dependencies: [dependency("linked", "link:a"), dependency("react", "link:provider")] }]);
    for (const meta of [{ optional: { optional: true }, required: {}, scalar: 1, callable: () => true, falseFlag: { optional: false } }, []]) {
      const report = PeerCheck.run(lock, { peerDependencyRules: rules,
        workspacePackages: [linkedPackage("a", { react: "100", optional: "1", required: "1", scalar: "1", callable: "1", falseFlag: "1" }, meta), linkedPackage("provider", {})] });
      assert.isFalse(report.unsatisfied.some((peer) => peer.dependency === "react"));
      assert.isTrue(report.unsatisfied.some((peer) => peer.dependency === "required"));
      if (Array.isArray(meta)) assert.isTrue(report.unsatisfied.some((peer) => peer.dependency === "optional"));
      else assert.isFalse(report.unsatisfied.some((peer) => peer.dependency === "optional"));
    }
  }));
  it.effect("ignores nameless declarations and missing context edges while retaining real missing peers", () => Effect.gen(function* () {
    const lock = yield* decode([{ ...workspace("consumer"), resolved: { linked: "workspace:a", absent: "no-such-id" } }, workspace("a")], [
      { path: "consumer", dependencies: [dependency("linked", "link:../a")] },
    ]);
    const report = PeerCheck.run(lock, { peerDependencyRules: rules, workspacePackages: [linkedPackage("a", { "": "1", react: "18" })] });
    assert.deepStrictEqual(report.unsatisfied.map((peer) => peer.dependency), ["react"]);
  }));
  it.effect("duplicate importer rows emit each violation once and invalid permitted ranges suppress nothing", () => Effect.gen(function* () {
    const importer = { path: ".", dependencies: [dependency("parent", "1.0.0")] };
    const lock = yield* decode([{ ...row("parent@1.0.0", "parent", "1.0.0"), peerDependencies: { react: "18" }, resolved: { react: "react@17.0.0" } }, row("react@17.0.0", "react", "17.0.0")], [importer, importer]);
    const report = PeerCheck.run(lock, { peerDependencyRules: { ...rules, allowedVersions: { react: "not a range" } } });
    assert.strictEqual(report.unsatisfied.length, 1);
    assert.strictEqual(report.unsatisfied[0]?.found, "17.0.0");
  }));
});

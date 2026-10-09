import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { Lockfile, LockfileFramingError, LockfileParseError, materializeFailure } from "../../effected/lockfiles/Lockfile.ts";
import { ResolvedPackage } from "../../effected/lockfiles/ResolvedPackage.ts";
import { LockfileImporter } from "../../effected/lockfiles/LockfileImporter.ts";
import { WorkspaceDependency } from "../../effected/lockfiles/WorkspaceDependency.ts";
import { PnpmExtension } from "../../effected/lockfiles/PnpmExtension.ts";

it.effect("public failure messages explain each parsing and framing outcome", () => Effect.sync(() => {
  assert.strictEqual(LockfileParseError.make({ format: "npm", stage: "syntax", cause: "bad" }).message,
    "Failed to parse npm lockfile: the content is not well-formed");
  assert.strictEqual(LockfileParseError.make({ format: "bun", stage: "validation", cause: "bad" }).message,
    "Failed to parse bun lockfile: the content does not have the expected bun shape");
  assert.strictEqual(LockfileFramingError.make({ format: "pnpm", reason: "noImporters", documents: 1 }).message,
    "Failed to parse pnpm lockfile: the lockfile document declares no importers, so it describes no workspace");
  assert.strictEqual(LockfileFramingError.make({ format: "pnpm", reason: "unexpectedDocuments", documents: 3 }).message,
    "Failed to parse pnpm lockfile: expected at most two YAML documents (an env preamble and the lockfile) but the content carries 3");
  assert.strictEqual(LockfileFramingError.make({ format: "yarn", reason: "unexpectedDocuments", documents: 2 }).message,
    "Failed to parse yarn lockfile: expected a single YAML document but the content carries 2");
  assert.strictEqual(LockfileFramingError.make({ format: "pnpm", reason: "noLockfileDocument", documents: 0 }).message,
    "Failed to parse pnpm lockfile: the content carries no lockfile document (0 YAML document(s) found)");
  const cause = { detail: "invalid" };
  assert.strictEqual(materializeFailure({ stage: "validation", cause })("npm")._tag, "LockfileParseError");
  assert.strictEqual(materializeFailure("pnpm", { stage: "framing", reason: "noImporters", documents: 1 })._tag, "LockfileFramingError");
}));

it.effect("name rewrites preserve metadata and handle absent, empty, identical and changed endpoints", () => Effect.sync(() => {
  const workspace = ResolvedPackage.make({ name: "core", version: "0.0.0", instanceId: "core", isWorkspace: true, relativePath: "core",
    dependencies: { util: "workspace:*" }, peerDependencies: { react: "^18" }, peerDependenciesMeta: { react: { optional: true } },
    resolved: { util: "util" }, unresolvedEdges: ["missing"] });
  const noPath = ResolvedPackage.make({ name: "no-path", version: "0", instanceId: "no-path", isWorkspace: true });
  const external = ResolvedPackage.make({ name: "external", version: "1", instanceId: "external", isWorkspace: false });
  const edge = WorkspaceDependency.make({ from: "core", to: "util", depType: "dependencies", constraint: "workspace:*" });
  const importer = LockfileImporter.make({ path: "core", dependencies: [] });
  const extension = PnpmExtension.make({ overrides: { react: "18" } });
  const model = Lockfile.make({ format: "pnpm", lockfileVersion: "9", packages: [workspace, noPath, external], workspaceDependencies: [edge], importers: [importer], extension });
  for (const names of [new Map<string, string>(), new Map([["core", ""], ["util", ""]]), new Map([["core", "core"], ["util", "util"]])]) {
    const same = model.withImporterNames(names);
    assert.strictEqual(same.packages[0], workspace);
    assert.strictEqual(same.workspaceDependencies[0], edge);
  }
  for (const names of [new Map([["core", "@app/core"]]), new Map([["util", "@app/util"]]), new Map([["core", "@app/core"], ["util", "@app/util"]])]) {
    const rewritten = model.withImporterNames(names);
    assert.deepStrictEqual(rewritten.workspaceDependencies, [WorkspaceDependency.make({ ...edge, from: names.get("core") ?? "core", to: names.get("util") ?? "util" })]);
    assert.deepStrictEqual(rewritten.packages[0], ResolvedPackage.make({ ...workspace, name: names.get("core") ?? "core" }));
    assert.strictEqual(rewritten.packages[1], noPath);
    assert.strictEqual(rewritten.packages[2], external);
    assert.deepStrictEqual(rewritten.importers, model.importers);
    assert.strictEqual(rewritten.extension, extension);
  }
}));

it.effect("lazy indexes retain duplicate names, use the first duplicate instance and answer repeat misses", () => Effect.sync(() => {
  const first = ResolvedPackage.make({ name: "shared", version: "1", instanceId: "same", isWorkspace: false });
  const second = ResolvedPackage.make({ name: "shared", version: "2", instanceId: "same", isWorkspace: true });
  const importer = LockfileImporter.make({ path: ".", dependencies: [] });
  const model = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [first, second], workspaceDependencies: [], importers: [importer] });
  assert.deepStrictEqual(model.packagesNamed("shared"), [first, second]);
  assert.deepStrictEqual(model.packagesNamed("shared"), [first, second]);
  assert.deepStrictEqual(model.packagesNamed("missing"), []);
  assertSome(model.packageByInstanceId("same"), first);
  assertNone(model.packageByInstanceId("missing"));
  assertSome(model.importer("."), importer);
  assertNone(model.importer("missing"));
  assert.deepStrictEqual(model.workspacePackages, [second]);
}));

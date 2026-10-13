import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import { ResolvedPackage } from "../../../effected/lockfiles/ResolvedPackage.ts";
import { ImporterRoots, indexInstances, rootInstances } from "../../../effected/workspaces/internal/roots.ts";

it.effect("indexes workspace rows only when they carry an importer path", () => Effect.sync(() => {
  const absent = ResolvedPackage.make({ name: "absent", version: "1", instanceId: "absent@1", isWorkspace: true });
  const member = ResolvedPackage.make({ name: "member", version: "1", instanceId: "member@1", isWorkspace: true, relativePath: "packages/member" });
  const external = ResolvedPackage.make({ name: "external", version: "1", instanceId: "external@1", isWorkspace: false, relativePath: "external" });
  const index = indexInstances(Lockfile.make({ format: "pnpm", lockfileVersion: "9", packages: [absent, member, external], workspaceDependencies: [] }));
  assert.strictEqual(MutableHashMap.size(index.byId), 3);
  assert.deepStrictEqual(Array.from(index.workspaceByPath), [["packages/member", member]]);
}));

it.effect("an importer with only specifiers and no resolved version is unanswerable", () => Effect.gen(function* () {
  const lockfile = yield* S.decodeEffect(Lockfile)({
    format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [],
    importers: [{ path: ".", dependencies: [{ name: "dependency", specifier: "^1", depType: "dependencies" }] }],
  });
  assert.isUndefined(rootInstances(lockfile, ".", indexInstances(lockfile)));
  assert.isUndefined(rootInstances(lockfile, "missing", indexInstances(lockfile)));
}));

it.effect("schema-owns plain roots while preserving instance identity, tolerant joins and dependency order", () => Effect.gen(function* () {
  const lockfile = yield* S.decodeEffect(Lockfile)({
    format: "pnpm", lockfileVersion: "9", workspaceDependencies: [],
    packages: [
      { name: "member", version: "1", instanceId: "member@1", isWorkspace: true, relativePath: "packages/member" },
      { name: "first", version: "1", instanceId: "first@1", isWorkspace: false },
      { name: "second", version: "2", instanceId: "second@2", isWorkspace: false },
    ],
    importers: [{ path: ".", dependencies: [
      { name: "second", specifier: "2", version: "2", depType: "dependencies" },
      { name: "missing", specifier: "1", version: "1", depType: "dependencies" },
      { name: "first", specifier: "1", depType: "dependencies" },
      { name: "first", specifier: "1", version: "1", depType: "dependencies" },
      { name: "second", specifier: "2", version: "2", depType: "dependencies" },
    ] }, { path: "empty", dependencies: [] }],
  });
  const index = indexInstances(lockfile);
  const own = rootInstances(lockfile, "packages/member", index);
  const dependencies = rootInstances(".", index)(lockfile);
  const [member, first, second] = lockfile.packages;
  if (member === undefined || first === undefined || second === undefined) return assert.fail("expected three fixture instances");
  assert.deepStrictEqual(own, { _tag: "own", instance: member });
  assert.deepStrictEqual(dependencies, { _tag: "dependencies", instances: [second, first, second] });
  if (own === undefined || own._tag !== "own" || dependencies === undefined || dependencies._tag !== "dependencies") {
    return assert.fail("expected both importer root variants");
  }
  assert.strictEqual(own.instance, member);
  assert.strictEqual(dependencies.instances[0], second);
  assert.isTrue(S.is(ImporterRoots)(own));
  assert.isTrue(S.is(ImporterRoots)(dependencies));
  for (const roots of [own, dependencies]) {
    const encoded = yield* S.encodeEffect(ImporterRoots)(roots);
    const decoded = yield* S.decodeEffect(ImporterRoots)(encoded);
    assert.deepStrictEqual(decoded, roots);
  }
  assert.deepStrictEqual(rootInstances(lockfile, "empty", index), { _tag: "dependencies", instances: [] });
  assert.isUndefined(rootInstances(lockfile, "missing", index));
}));

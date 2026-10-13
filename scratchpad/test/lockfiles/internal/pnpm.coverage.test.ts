import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { parsePnpm } from "../../../effected/lockfiles/internal/pnpm.ts";

it.effect("unnameable links and empty dependency names stay omitted and publish paths cannot escape the workspace", () => Effect.gen(function* () {
  const text = yield* Yaml.stringify({ lockfileVersion: 9, importers: {
    ".": { publishDirectory: ".", dependencies: { "": { specifier: "*", version: "1" }, escape: { specifier: "workspace:*", version: "link:../../outside" }, root: { specifier: "*", version: "link:." } } },
    lib: { publishDirectory: "../../outside", dependencies: { "": { specifier: "*", version: "1" }, root: { specifier: "*", version: "link:.." } } },
  }, packages: { "a@1": {} }, snapshots: { "a@1": { dependencies: { "": "1", escape: "link:../../outside", root: "link:." } } } });
  const fields = yield* parsePnpm(text, false);
  assert.deepStrictEqual(fields.packages.map((pkg) => [pkg.instanceId, pkg.resolved, pkg.unresolvedEdges]), [["lib", {}, ["root"]], ["a@1", {}, ["escape", "root"]]]);
  assert.deepStrictEqual(fields.importers[0]?.dependencies.map((dep) => dep.name), ["escape", "root"]);
}));


it.effect("pnpm resolution excludes the root publish target and skipped keys but retains modeled snapshots and workspace owners", () => Effect.gen(function* () {
  const text = yield* Yaml.stringify({ lockfileVersion: 9,
    importers: {
      ".": { publishDirectory: "dist" },
      "packages/app": { dependencies: {
        root: { specifier: "workspace:*", version: "link:../../dist" },
        malformedSnapshot: { specifier: "*", version: "broken" },
        malformedPackage: { specifier: "*", version: "bad" },
        covered: { specifier: "*", version: "covered@1" },
        alias: { specifier: "npm:covered@1", version: "covered@1(peer@2)" },
        lib: { specifier: "*", version: "link:../lib/dist" },
        ancestor: { specifier: "workspace:*", version: "link:../lib/generated/output" },
      } },
      "packages/lib": { publishDirectory: "dist" },
    },
    packages: { broken: {}, bad: {}, "covered@1": {}, "orphan@1": { dependencies: { missing: "broken" } }, "consumer@1": {} },
    snapshots: { broken: {}, "covered@1(peer@2)": {}, "consumer@1": { dependencies: { root: "link:dist", malformedSnapshot: "broken", malformedPackage: "bad", covered: "1", alias: "covered@1(peer@2)", lib: "link:packages/lib/dist", orphan: "1" } } },
  });
  const fields = yield* parsePnpm(text, false);
  const lockfile = Lockfile.make({ format: "pnpm", ...fields });
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("packages/app"), (pkg) => [pkg.resolved, pkg.unresolvedEdges]), O.some([{ alias: "covered@1(peer@2)", lib: "packages/lib", ancestor: "packages/lib" }, ["covered", "malformedPackage", "malformedSnapshot", "root"]]));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("consumer@1"), (pkg) => [pkg.resolved, pkg.unresolvedEdges]), O.some([{ alias: "covered@1(peer@2)", lib: "packages/lib", orphan: "orphan@1" }, ["covered", "malformedPackage", "malformedSnapshot", "root"]]));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("orphan@1"), (pkg) => pkg.unresolvedEdges), O.some(["missing"]));
  for (const absent of [".", "broken", "bad", "covered@1"]) assert.strictEqual(O.isNone(lockfile.packageByInstanceId(absent)), true);
  for (const pkg of fields.packages) {
    for (const target of R.values(pkg.resolved)) assert.strictEqual(O.isSome(lockfile.packageByInstanceId(target)), true, `${pkg.instanceId} -> ${target}`);
  }
}));

import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import * as S from "effect/Schema";
import { parseNpm } from "../../../effected/lockfiles/internal/npm.ts";

const JsonDocument = S.fromJsonString(S.Unknown);

it.effect("link stubs preserve fallbacks, omit missing manifests and skip nameless or versionless rows", () => Effect.gen(function* () {
  const text = yield* S.encodeEffect(JsonDocument)({ lockfileVersion: 3, packages: {
    "node_modules/": { link: true, name: "" },
    "node_modules/fallback": { link: true },
    "node_modules/named": { link: true, name: "explicit", resolved: "absent" },
    "node_modules/empty": { link: true, resolved: "" },
    "node_modules/versionless": {},
    "node_modules/normal": { version: "1", dependencies: { "": "*" } },
  } });
  const fields = yield* parseNpm(text);
  assert.deepStrictEqual(fields.packages.map((pkg) => [pkg.name, pkg.version, pkg.resolved]), [["fallback", "0.0.0", {}], ["explicit", "0.0.0", {}], ["empty", "0.0.0", {}], ["normal", "1", {}]]);
  assert.deepStrictEqual(fields.importers.map((entry) => [entry.path, entry.dependencies]), [["absent", []]]);
}));


it.effect("an absent constructor workspace target uses its fallback name in both passes", () => Effect.gen(function* () {
  const fields = yield* parseNpm('{"lockfileVersion":3,"packages":{"node_modules/foo":{"link":true,"resolved":"constructor"},"node_modules/app":{"link":true,"resolved":"packages/app"},"packages/app":{"name":"app","dependencies":{"foo":"workspace:*"}}}}');
  assert.deepStrictEqual(A.map(fields.packages, (pkg) => [pkg.name, pkg.version]), [["foo", "0.0.0"], ["app", "0.0.0"]]);
  assert.deepStrictEqual(A.map(fields.workspaceDependencies, (edge) => [edge.from, edge.to]), [["app", "foo"]]);
  assert.deepStrictEqual(A.map(fields.importers, (entry) => [entry.path, A.map(entry.dependencies, (dep) => dep.name)]), [["constructor", []], ["packages/app", ["foo"]]]);
}));

it.effect("an own constructor workspace target retains manifest metadata in both passes", () => Effect.gen(function* () {
  const fields = yield* parseNpm('{"lockfileVersion":3,"packages":{"constructor":{"name":"actual","version":"2","dependencies":{"app":"workspace:*"},"peerDependencies":{"peer":"^1"}},"node_modules/foo":{"link":true,"name":"stub","resolved":"constructor"},"node_modules/app":{"link":true,"resolved":"packages/app"},"packages/app":{"name":"app","dependencies":{"actual":"workspace:*"}}}}');
  assert.deepStrictEqual(A.map(fields.packages, (pkg) => [pkg.name, pkg.version, pkg.peerDependencies]), [["actual", "2", { peer: "^1" }], ["app", "0.0.0", {}]]);
  assert.deepStrictEqual(A.map(fields.workspaceDependencies, (edge) => [edge.from, edge.to]), [["actual", "app"], ["app", "actual"]]);
  assert.deepStrictEqual(A.map(fields.importers, (entry) => [entry.path, A.map(entry.dependencies, (dep) => dep.name)]), [["constructor", ["app", "peer"]], ["packages/app", ["actual"]]]);
}));

it.effect("npm resolution skips unmodeled positions and every emitted target has a package row", () => Effect.gen(function* () {
  const text = yield* S.encodeEffect(JsonDocument)({ lockfileVersion: 3, packages: {
    "node_modules/consumer": { version: "1", dependencies: { dep: "*", missing: "*", nameless: "*", app: "*" } },
    "node_modules/consumer/node_modules/dep": {},
    "node_modules/missing": {},
    "node_modules/nameless": { link: true, name: "" },
    "node_modules/shadow": { version: "1", dependencies: { dep: "*" } },
    "node_modules/shadow/node_modules/dep": { version: "2" },
    "node_modules/app": { link: true, resolved: "packages/app" },
    "packages/app": { name: "app", dependencies: { dep: "*", missing: "*" } },
    "packages/app/node_modules/dep": {},
    "node_modules/dep": { version: "1" },
  } });
  const fields = yield* parseNpm(text);
  const lockfile = Lockfile.make({ format: "npm", ...fields });
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("node_modules/consumer"), (pkg) => pkg.resolved), O.some({ dep: "node_modules/dep", app: "node_modules/app" }));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("node_modules/shadow"), (pkg) => pkg.resolved), O.some({ dep: "node_modules/shadow/node_modules/dep" }));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("node_modules/app"), (pkg) => pkg.resolved), O.some({ dep: "node_modules/dep" }));
  for (const pkg of fields.packages) {
    for (const target of R.values(pkg.resolved)) assert.strictEqual(O.isSome(lockfile.packageByInstanceId(target)), true, `${pkg.instanceId} -> ${target}`);
  }
}));

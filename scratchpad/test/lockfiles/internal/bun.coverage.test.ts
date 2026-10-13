import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import * as S from "effect/Schema";
import { parseBun } from "../../../effected/lockfiles/internal/bun.ts";

const JsonDocument = S.fromJsonString(S.Unknown);

it.effect("skips empty identities and malformed metadata while retaining workspace defaults", () => Effect.gen(function* () {
  const text = yield* S.encodeEffect(JsonDocument)({
    lockfileVersion: 1,
    workspaces: { lib: { name: "", dependencies: { "": "*" } } },
    packages: { "": ["empty@1"], lib: ["lib@1"], a: ["a@1", "", 42], b: ["b@1", "", {}, 42], c: ["c@1"] },
  });
  const fields = yield* parseBun(text);
  assert.deepStrictEqual(fields.packages.map((pkg) => [pkg.name, pkg.version, pkg.resolved]), [["lib", "0.0.0", {}], ["a", "1", {}], ["b", "1", {}], ["c", "1", {}]]);
  assert.deepStrictEqual(fields.importers.map((entry) => entry.dependencies), [[]]);
}));


it.effect("bun resolution skips malformed and duplicate workspace tuples while preserving positions and workspace ids", () => Effect.gen(function* () {
  const text = yield* S.encodeEffect(JsonDocument)({
    lockfileVersion: 1,
    workspaces: { "packages/lib": { name: "lib", dependencies: { dep: "*" } }, "packages/fallback": { name: "fallback" } },
    packages: {
      consumer: ["consumer@1", "", { dependencies: { dep: "*", missing: "*", lib: "*" } }],
      "consumer/dep": [42], "consumer/missing": ["malformed"], "consumer/lib": ["lib@2"],
      missing: [], lib: [42], "lib/dep": [],
      parent: [false], "parent/consumer": ["consumer@1", "", { dependencies: { dep: "*" } }], "parent/dep": ["dep@3"],
      shadow: ["shadow@1", "", { dependencies: { dep: "*" } }], "shadow/dep": ["dep@2"],
      dep: ["dep@1"],
    },
  });
  const fields = yield* parseBun(text);
  const lockfile = Lockfile.make({ format: "bun", ...fields });
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("consumer"), (pkg) => pkg.resolved), O.some({ dep: "dep", lib: "lib" }));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("lib"), (pkg) => [pkg.isWorkspace, pkg.resolved]), O.some([true, { dep: "dep" }]));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("packages/fallback"), (pkg) => pkg.isWorkspace), O.some(true));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("parent/consumer"), (pkg) => pkg.resolved), O.some({ dep: "parent/dep" }));
  assert.deepStrictEqual(O.map(lockfile.packageByInstanceId("shadow"), (pkg) => pkg.resolved), O.some({ dep: "shadow/dep" }));
  for (const pkg of fields.packages) {
    for (const target of R.values(pkg.resolved)) assert.strictEqual(O.isSome(lockfile.packageByInstanceId(target)), true, `${pkg.instanceId} -> ${target}`);
  }
}));

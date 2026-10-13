import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Lockfile } from "../../../effected/lockfiles/Lockfile.ts";
import { importerVersionsOf, unanimousVersionOf } from "../../../effected/workspaces/internal/importerVersions.ts";

const runs = { arbitrary: fcRuns(100) };
const Version = S.Int.check(S.isBetween({ minimum: 0, maximum: 10000 }));

it.effect.prop("importer normalization is idempotent and preserves a concrete version through peer-context serialization", [Arbitrary.schema(Version), Arbitrary.schema(Version)], ([major, peer]) => Effect.gen(function* () {
  const version = `${major}.2.3`;
  const encoded = {
    format: "pnpm", lockfileVersion: "9", packages: [], workspaceDependencies: [],
    importers: [{ path: ".", dependencies: [{ name: "dependency", specifier: "*", version: `${version}(peer@${peer}.0.0)`, depType: "dependencies" }] }],
  };
  const lockfile = yield* S.decodeUnknownEffect(Lockfile)(encoded);
  const normalized = importerVersionsOf(lockfile);
  assert.deepStrictEqual(normalized, { ".": { dependency: version } });
  const reparsed = yield* S.decodeEffect(Lockfile)(yield* S.encodeEffect(Lockfile)(lockfile));
  assert.deepStrictEqual(importerVersionsOf(reparsed), normalized);
  const canonical = yield* S.decodeUnknownEffect(Lockfile)({ ...encoded, importers: [{ path: ".", dependencies: [{ name: "dependency", specifier: "*", version, depType: "dependencies" }] }] });
  assert.deepStrictEqual(importerVersionsOf(canonical), normalized);
  assert.strictEqual(unanimousVersionOf({ ...normalized, other: { dependency: version } }, "dependency"), version);
  assert.isUndefined(unanimousVersionOf({ ...normalized, other: { dependency: `${major}.2.4` } }, "dependency"));
}), runs);

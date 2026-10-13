import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseYarn } from "../../../effected/lockfiles/internal/yarn.ts";
import { LockfileFields } from "../../../effected/lockfiles/internal/shared.ts";
import { Yaml } from "../../../effected/yaml/index.ts";

const runs = { arbitrary: fcRuns(100) };
const sample = Arbitrary.schema(S.Struct({
  name: S.Literals(["library", "@scope/library", "__proto__"]),
  version: S.String,
  // YAML resolves integers outside the safe range to bigint, which Yarn's
  // string-or-number metadata schema does not accept. Keep numeric samples
  // within the YAML number domain; arbitrary string metadata stays unbounded.
  metadata: S.Union([S.String, S.Finite.check(S.isBetween({
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
  }))]),
  checksum: S.Literals(["10c0/deadbeef", "sha512-YWJj", "sha256.deadbeef"]),
  peerRange: S.String,
  optionalPeer: S.Boolean,
}));

// Reconstruct a Yarn document from the normalized result for the generated
// registry graph. Descriptor and locator are identical in this domain; peers
// remain declarations, and dependency edges supply their recorded descriptors.
const stringifyFields = (fields: LockfileFields) => Yaml.stringify({
  __metadata: { version: fields.lockfileVersion },
  ...R.fromEntries(A.map(fields.packages, (pkg) => [pkg.instanceId, {
    version: pkg.version,
    resolution: pkg.instanceId,
    ...O.getSomesStruct({ checksum: O.fromUndefinedOr(pkg.integrity) }),
    peerDependencies: pkg.peerDependencies,
    peerDependenciesMeta: pkg.peerDependenciesMeta,
    dependencies: R.map(pkg.resolved, (locator, name) => Str.slice(name.length + 1)(locator)),
  }] as const)),
});

describe("Yarn parser property floor", () => {
  it.effect("rejects unsafe integer metadata as a typed validation failure but preserves its string spelling", () => Effect.gen(function* () {
    const failure = yield* Effect.flip(parseYarn("__metadata:\n  version: 9007199254740992\n"));
    assert.strictEqual(failure.stage, "validation");
    const parsed = yield* parseYarn(yield* Yaml.stringify({
      __metadata: { version: "9007199254740992" },
    }));
    assert.strictEqual(parsed.lockfileVersion, "9007199254740992");
    assertTrue(S.toEquivalence(LockfileFields)(yield* parseYarn(yield* stringifyFields(parsed)), parsed));
  }));

  it.effect.prop("malformed scalar entries fail through validation rather than becoming rows or defects", [Arbitrary.schema(S.Union([
    S.String, S.Int, S.Boolean,
  ]))], ([value]) => Effect.gen(function* () {
    const content = yield* Yaml.stringify({ "classic@npm:1": value });
    const failure = yield* Effect.flip(parseYarn(content));
    assert.strictEqual(failure.stage, "validation");
  }), runs);

  it.effect.prop("normalized parse/stringify fidelity preserves locators, checksums, edges and peer declarations", [sample], ([value]) => Effect.gen(function* () {
    const locator = `${value.name}@npm:1.0.0`;
    const content = yield* Yaml.stringify({
      __metadata: { version: value.metadata },
      "consumer@npm:1": { version: "1", dependencies: R.fromEntries([[value.name, "npm:1.0.0"]]) },
      [locator]: {
        version: value.version, resolution: locator, checksum: value.checksum,
        peerDependencies: { react: value.peerRange },
        peerDependenciesMeta: { react: { optional: value.optionalPeer } },
      },
    });
    const parsed = yield* parseYarn(content);
    assert.strictEqual(parsed.lockfileVersion, String(value.metadata));
    const text = yield* stringifyFields(parsed);
    const reparsed = yield* parseYarn(text);
    assertTrue(S.toEquivalence(LockfileFields)(reparsed, parsed));
    assert.strictEqual(yield* stringifyFields(reparsed), text);
    assert.deepStrictEqual(A.map(parsed.packages, (pkg) => pkg.resolved), [R.fromEntries([[value.name, locator]]), {}]);
    assert.deepStrictEqual(A.map(A.filter(parsed.packages, (pkg) => pkg.name === value.name), (pkg) => [
      pkg.version, pkg.instanceId, pkg.integrity, pkg.peerDependencies, pkg.peerDependenciesMeta,
    ]), [[value.version, locator, value.checksum, { react: value.peerRange }, { react: { optional: value.optionalPeer } }]]);
  }), runs);

  it.effect.prop("YAML rendering is idempotent and reparsing preserves workspace paths and every dependency section", [Arbitrary.schema(S.Struct({
    path: S.Literals(["packages/lib", "lib", "."]),
    constraint: S.Literals(["workspace:*", "workspace:^", "workspace:~"]),
    section: S.Literals(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]),
  }))], ([value]) => Effect.gen(function* () {
    const content = yield* Yaml.stringify({
      __metadata: { version: 8 },
      "root@workspace:.": { linkType: "soft", [value.section]: { lib: value.constraint } },
      [`lib@workspace:*, lib@workspace:${value.path}`]: { linkType: "soft" },
    });
    const parsed = yield* parseYarn(content);
    const canonical = yield* Yaml.stringify(yield* Yaml.parse(content));
    assert.strictEqual(yield* Yaml.stringify(yield* Yaml.parse(canonical)), canonical);
    assertTrue(S.toEquivalence(LockfileFields)(yield* parseYarn(canonical), parsed));
    assert.deepStrictEqual(A.map(parsed.workspaceDependencies, (edge) => [edge.from, edge.to, edge.depType, edge.constraint]), [
      ["root", "lib", value.section, value.constraint],
    ]);
    assert.deepStrictEqual(A.map(A.filter(parsed.packages, (pkg) => pkg.name === "lib"), (pkg) => pkg.relativePath), [value.path]);
    assert.deepStrictEqual(parsed.importers, []);
  }), runs);
});

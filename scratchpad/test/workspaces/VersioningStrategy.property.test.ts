import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { VersioningStrategyType, ClassifyOptions, VersioningDetectOptions, PackageRelease, VersioningStrategy } from "../../effected/workspaces/VersioningStrategy.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: encoded values decode successfully to the original value`, [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("VersioningStrategy schema laws", () => {
  roundTrips("VersioningStrategyType", VersioningStrategyType);
  roundTrips("ClassifyOptions", ClassifyOptions);
  roundTrips("VersioningDetectOptions", VersioningDetectOptions);
  roundTrips("PackageRelease", PackageRelease);
  roundTrips("VersioningStrategy", VersioningStrategy);
});

it.effect("detection options reuse the exact optional fixed-groups field without defaults", () => Effect.gen(function* () {
  assert.strictEqual(VersioningDetectOptions.fields.fixedGroups, ClassifyOptions.fields.fixedGroups);
  assert.deepStrictEqual(yield* S.decodeEffect(VersioningDetectOptions)({}), {});
  assert.deepStrictEqual(
    yield* S.decodeEffect(VersioningDetectOptions)({ fixedGroups: [["", "missing-package"], []] }),
    { fixedGroups: [["", "missing-package"], []] },
  );
  assert.isFalse(S.is(VersioningDetectOptions)({ fixedGroups: undefined }));
}));

it.effect.prop("classification is idempotent on its normalized package set",
  [Arbitrary.schema(ClassifyOptions)], ([options]) => Effect.sync(() => {
    const strategy = VersioningStrategy.classify(options);
    assert.deepStrictEqual(VersioningStrategy.classify({ packages: strategy.publishablePackages, fixedGroups: strategy.fixedGroups }), strategy);
  }), runs);

const ReleaseBatch = S.Array(S.Struct({ name: S.NonEmptyString, version: S.Literals(["0.0.0", "1.2.3", "4.5.6-rc.1+build.7"]) }));
it.effect.prop("batch formatting preserves release order, package names and versions under independent versioning",
  [Arbitrary.schema(ReleaseBatch)], ([releases]) => Effect.sync(() => {
    const strategy = VersioningStrategy.classify({ packages: ["one", "two"] });
    const tags = strategy.tagsFor(releases);
    assert.deepStrictEqual(tags.map((tag) => ({ name: tag.packageName, version: tag.version })), [...releases]);
    const rendered = tags.map((tag) => ({ name: tag.packageName ?? "", version: tag.version }));
    assert.deepStrictEqual(strategy.tagsFor(rendered), tags);
  }), runs);
it.effect.prop("shared batch formatting preserves the first version and is stable through its canonical single release",
  [Arbitrary.schema(ReleaseBatch)], ([releases]) => Effect.sync(() => {
    const strategy = VersioningStrategy.classify({ packages: ["one"] });
    const tags = strategy.tagsFor(releases);
    assert.strictEqual(tags.length, releases.length === 0 ? 0 : 1);
    assert.strictEqual(tags[0]?.version, releases[0]?.version);
    assert.deepStrictEqual(strategy.tagsFor(tags.map((tag) => ({ name: "one", version: tag.version }))), tags);
  }), runs);

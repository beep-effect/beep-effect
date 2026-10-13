import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TagStyle, TagFormatOptions, TrackingTagOptions, TrackingTag, ReleaseTag, TagClassification, classifyTag } from "../../effected/workspaces/ReleaseTag.ts";

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

describe("ReleaseTag schema laws", () => {
  roundTrips("TagStyle", TagStyle);
  roundTrips("TagFormatOptions", TagFormatOptions);
  roundTrips("TrackingTagOptions", TrackingTagOptions);
  roundTrips("TrackingTag", TrackingTag);
  roundTrips("ReleaseTag", ReleaseTag);
  roundTrips("TagClassification", TagClassification);
});

it.effect("tag option schemas preserve omitted keys without resolving defaults", () => Effect.gen(function* () {
  assert.deepStrictEqual(yield* S.decodeEffect(TagFormatOptions)({}), {});
  assert.deepStrictEqual(yield* S.decodeEffect(TrackingTagOptions)({}), {});
  assert.isTrue(S.is(TagFormatOptions)({ versionPrefix: "" }));
  assert.isTrue(S.is(TrackingTagOptions)({ packageName: "", precision: "both", includePrerelease: false }));
  assert.isFalse(S.is(TagFormatOptions)({ versionPrefix: undefined }));
  assert.isFalse(S.is(TrackingTagOptions)({ packageName: undefined }));
  assert.isFalse(S.is(TrackingTagOptions)({ precision: undefined }));
  assert.isFalse(S.is(TrackingTagOptions)({ includePrerelease: undefined }));
}));

const VersionParts = S.Struct({
  major: S.Literals(["0", "1", "12", "999"]),
  minor: S.Literals(["0", "2", "34", "999"]),
  patch: S.Literals(["0", "3", "56", "999"]),
  suffix: S.Literals(["", "-rc.1", "+build.123", "-beta.2+sha.abc"]),
  prefix: S.Literals(["", "v"]),
  name: S.Literals(["pkg", "@scope/pkg", "@other/tool"]),
});
it.effect.prop("release formatting is stable after parsing and preserves names and full SemVer text",
  [Arbitrary.schema(VersionParts)], ([parts]) => Effect.sync(() => {
    const version = `${parts.major}.${parts.minor}.${parts.patch}${parts.suffix}`;
    for (const tag of [ReleaseTag.single(version, { versionPrefix: parts.prefix }), ReleaseTag.scoped(parts.name, version, { versionPrefix: parts.prefix })]) {
      const parsed = classifyTag(tag.value);
      assert.strictEqual(parsed.kind, "release");
      if (parsed.kind === "release") {
        assert.strictEqual(parsed.tag.version, version);
        assert.strictEqual(parsed.tag.packageName, tag.packageName);
        const formatted = parsed.tag.packageName === undefined
          ? ReleaseTag.single(parsed.tag.version, { versionPrefix: parts.prefix })
          : ReleaseTag.scoped(parsed.tag.packageName, parsed.tag.version, { versionPrefix: parts.prefix });
        assert.deepStrictEqual(classifyTag(formatted.value), parsed);
        assert.strictEqual(formatted.value, tag.value);
      }
    }
  }), runs);
it.effect.prop("tracking alias formatting is idempotent and classification preserves precision",
  [Arbitrary.schema(VersionParts)], ([parts]) => Effect.sync(() => {
    const version = `${parts.major}.${parts.minor}.${parts.patch}${parts.suffix}`;
    for (const tag of TrackingTag.forVersion(version, { packageName: parts.name, includePrerelease: true })) {
      const parsed = classifyTag(tag.value);
      assert.strictEqual(parsed.kind, "tracking");
      if (parsed.kind === "tracking") {
        assert.deepStrictEqual(parsed.tag, tag);
        const aliases = TrackingTag.forVersion(`${parsed.tag.major}.${parsed.tag.minor ?? 0}.0`, {
          packageName: parts.name, precision: parsed.tag.precision === "major" ? "major" : "both",
        });
        assert.isTrue(aliases.some((alias) => alias.value === tag.value));
        assert.deepStrictEqual(classifyTag(parsed.tag.value), parsed);
      }
    }
  }), runs);
it.effect.prop("classifying arbitrary tags is stable through the recognized tag string",
  [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
    const parsed = classifyTag(text);
    if (parsed.kind === "unrecognized") assert.deepStrictEqual(classifyTag(text), parsed);
    else assert.deepStrictEqual(classifyTag(parsed.tag.value), parsed);
  }), runs);

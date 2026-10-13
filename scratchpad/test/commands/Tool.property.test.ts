import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ToolSource, MismatchPolicy, VersionFlag, VersionJson, VersionNone, VersionProbe, Tool } from "../../effected/commands/Tool.ts";

const runs = { arbitrary: fcRuns(100) };
const EncodedTool = S.toEncoded(Tool);
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("Tool schema property floor", () => {
  roundTrips("ToolSource", ToolSource);
  roundTrips("MismatchPolicy", MismatchPolicy);
  roundTrips("VersionFlag", VersionFlag);
  roundTrips("VersionJson", VersionJson);
  roundTrips("VersionNone", VersionNone);
  roundTrips("VersionProbe", VersionProbe);
  roundTrips("Tool", Tool);
});

describe("Tool constructor defaults", () => {
  it("make and named apply the same defaults with a fresh version probe per call", () => {
    const made = Tool.make({ name: "biome" });
    const named = Tool.named("biome");
    assert.strictEqual(made.name, "biome");
    assert.strictEqual(made.source, "any");
    assert.strictEqual(made.onMismatch, "preferLocal");
    assert.isTrue(S.toEquivalence(VersionProbe)(made.version, VersionFlag.make({ flag: "--version" })));
    assert.isTrue(S.toEquivalence(Tool)(made, named));
    assert.notStrictEqual(made.version, named.version);
    assert.notStrictEqual(made.version, Tool.make({ name: "biome" }).version);
    assert.notStrictEqual(named.version, Tool.named("biome").version);
  });

  it.effect.prop("make and named preserve every explicit override", [Arbitrary.schema(Tool)], ([value]) =>
    Effect.sync(() => {
      const made = Tool.make({ name: value.name, version: value.version, source: value.source, onMismatch: value.onMismatch });
      const named = Tool.named(value.name, { version: value.version, source: value.source, onMismatch: value.onMismatch });
      assert.isTrue(S.toEquivalence(Tool)(made, value));
      assert.isTrue(S.toEquivalence(Tool)(named, value));
      assert.strictEqual(made.version, value.version);
      assert.strictEqual(named.version, value.version);
    }), runs);

  it("named treats empty and explicit-undefined overrides as omitted", () => {
    const expected = Tool.make({ name: "biome" });
    const equivalent = S.toEquivalence(Tool);
    assert.isTrue(equivalent(Tool.named("biome", {}), expected));
    assert.isTrue(equivalent(Tool.named("biome", undefined), expected));
    assert.isTrue(equivalent(Tool.named("biome", { version: undefined, source: undefined, onMismatch: undefined }), expected));
  });

  it.effect.prop("partial named overrides retain defaults for explicit-undefined fields", [Arbitrary.schema(Tool)], ([value]) =>
    Effect.sync(() => {
      const equivalent = S.toEquivalence(Tool);
      assert.isTrue(equivalent(
        Tool.named(value.name, { version: value.version, source: undefined, onMismatch: undefined }),
        Tool.make({ name: value.name, version: value.version }),
      ));
      assert.isTrue(equivalent(
        Tool.named(value.name, { version: undefined, source: value.source, onMismatch: undefined }),
        Tool.make({ name: value.name, source: value.source }),
      ));
      assert.isTrue(equivalent(
        Tool.named(value.name, { version: undefined, source: undefined, onMismatch: value.onMismatch }),
        Tool.make({ name: value.name, onMismatch: value.onMismatch }),
      ));
    }), runs);

  it.effect("constructor defaults keep every decoded and encoded field required", () =>
    Effect.gen(function* () {
      const tool = Tool.make({ name: "biome" });
      const encoded = yield* S.encodeEffect(Tool)(tool);
      assert.isTrue(S.is(Tool)(tool));
      assert.isTrue(S.is(EncodedTool)(encoded));
      assert.strictEqual(encoded.source, "any");
      assert.strictEqual(encoded.onMismatch, "preferLocal");
      assert.deepStrictEqual(encoded.version, { _tag: "VersionFlag", flag: "--version" });
      for (const incomplete of [
        { name: encoded.name, source: encoded.source, onMismatch: encoded.onMismatch },
        { name: encoded.name, version: encoded.version, onMismatch: encoded.onMismatch },
        { name: encoded.name, version: encoded.version, source: encoded.source },
        { name: encoded.name, version: undefined, source: encoded.source, onMismatch: encoded.onMismatch },
        { name: encoded.name, version: encoded.version, source: undefined, onMismatch: encoded.onMismatch },
        { name: encoded.name, version: encoded.version, source: encoded.source, onMismatch: undefined },
      ]) {
        assert.isFalse(S.is(EncodedTool)(incomplete));
        const error = yield* Effect.flip(S.decodeUnknownEffect(Tool)(incomplete));
        assert.strictEqual(error._tag, "SchemaError");
      }
    }));
});

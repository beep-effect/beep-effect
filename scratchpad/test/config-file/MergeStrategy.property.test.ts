import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

const runs = { arbitrary: fcRuns(100) };
const Scalar = S.Union([S.String, S.Boolean, S.Int, S.Null]);
const Sample = S.Struct({ local: Scalar, middle: Scalar, base: Scalar, fallback: S.Json });
class Settings extends S.Class<Settings>("MergeStrategy.property/Settings")({ port: S.Int, host: S.String }) {
  #secret = "ready";
  get secret(): string { return this.#secret; }
  get address(): string { return `${this.host}:${this.port}`; }
}

describe("MergeStrategy priority properties", () => {
  it.effect.prop("firstMatch returns the highest-priority value by identity", [Arbitrary.schema(Sample)], ([sample]) =>
    Effect.gen(function* () {
      const higher = { value: sample.local };
      const lower = { value: sample.base };
      const actual = yield* MergeStrategy.firstMatch<typeof higher>().resolve([
        { path: "/local", resolver: "local", value: higher },
        { path: "/base", resolver: "base", value: lower },
      ]);
      assert.strictEqual(actual, higher);
    }), runs);

  it.effect.prop("layeredMerge obeys priority across three sources, fills missing fields and replaces arrays atomically", [Arbitrary.schema(Sample)], ([sample]) =>
    Effect.gen(function* () {
      const higher = { shared: sample.local, section: { local: sample.local }, values: [sample.local] };
      const middle = { shared: sample.middle, section: { middle: sample.middle }, values: [sample.middle, sample.base] };
      const lower = { shared: sample.base, section: { base: sample.base }, fallback: sample.fallback };
      const actual = yield* MergeStrategy.layeredMerge<Record<string, unknown>>().resolve([
        { path: "/local", resolver: "local", value: higher },
        { path: "/middle", resolver: "middle", value: middle },
        { path: "/base", resolver: "base", value: lower },
      ]);
      assert.deepStrictEqual(actual, {
        shared: sample.local,
        section: { local: sample.local, middle: sample.middle, base: sample.base },
        values: [sample.local],
        fallback: sample.fallback,
      });
      assert.strictEqual(actual.values, higher.values);
      assert.deepStrictEqual(higher, { shared: sample.local, section: { local: sample.local }, values: [sample.local] });
      assert.deepStrictEqual(lower, { shared: sample.base, section: { base: sample.base }, fallback: sample.fallback });
    }), runs);

  it.effect.prop("same-schema documents retain their class prototype and getters", [Arbitrary.schema(Settings), Arbitrary.schema(Settings)], ([higher, lower]) =>
    Effect.gen(function* () {
      const actual = yield* MergeStrategy.layeredMerge<Settings>().resolve([
        { path: "/local", resolver: "local", value: higher },
        { path: "/base", resolver: "base", value: lower },
      ]);
      assert.instanceOf(actual, Settings);
      assert.strictEqual(actual, higher);
      assert.strictEqual(actual.secret, "ready");
      assert.strictEqual(actual.port, higher.port);
      assert.strictEqual(actual.host, higher.host);
      assert.strictEqual(actual.address, higher.address);
    }), runs);
});

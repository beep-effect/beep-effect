import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { canMerge, deepMerge, isPlainObject } from "../../../effected/config-file/internal/deepMerge.ts";

const runs = { arbitrary: fcRuns(100) };
const Fields = S.Struct({ constructor: S.String, prototype: S.String, payload: S.Json });
class Settings extends S.Class<Settings>("deepMerge.property/Settings")({ port: S.Int, host: S.String }) {
  #secret = "ready";
  get secret(): string { return this.#secret; }
  get address(): string { return `${this.host}:${this.port}`; }
}
// Recursively merged records filter __proto__; arbitrary JSON stays atomic in arrays.
const Document = S.Struct({
  section: S.Struct({
    constructor: S.String,
    prototype: S.String,
    payload: S.Struct({ text: S.String, values: S.Array(S.Json) }),
  }),
  items: S.Array(S.Json),
});

describe("deepMerge structural properties", () => {
  it.effect.prop("decoded classes stay atomic by identity with their private-field brands intact", [Arbitrary.schema(S.Struct({ port: S.Int, host: S.String })), Arbitrary.schema(S.Struct({ port: S.Int, host: S.String }))], ([higherFields, lowerFields]) =>
    Effect.gen(function* () {
      const higher = yield* S.decodeEffect(Settings)(higherFields);
      const lower = yield* S.decodeEffect(Settings)(lowerFields);
      assert.isFalse(isPlainObject(higher));
      assert.isFalse(canMerge(higher, lower));
      assert.isFalse(canMerge(lower)(higher));
      assert.isFalse(canMerge(higher, higherFields));
      assert.isFalse(canMerge(higherFields, higher));
      const actual = deepMerge(higher, lower);
      assert.strictEqual(actual, higher);
      assert.instanceOf(actual, Settings);
      assert.strictEqual(actual.secret, "ready");
      assert.strictEqual(actual.address, higher.address);
      assert.strictEqual(deepMerge(lower)(higher), higher);
      assert.strictEqual(deepMerge(higher, lowerFields), higher);
      assert.strictEqual(deepMerge(higherFields, lower), higherFields);
      const nested = deepMerge({ section: higher }, { section: lower });
      assert.strictEqual(nested.section, higher);
      assert.strictEqual(nested.section.secret, "ready");
      assert.deepStrictEqual({ port: higher.port, host: higher.host }, higherFields);
      assert.deepStrictEqual({ port: lower.port, host: lower.host }, lowerFields);
      assert.strictEqual(lower.secret, "ready");
    }), runs);

  it.effect.prop("own enumerable symbols from both inputs preserve schema validity, nested merging and target priority", [Arbitrary.schema(Fields), Arbitrary.schema(Fields)], ([higherFields, lowerFields]) =>
    Effect.gen(function* () {
      const required = Symbol("required");
      const higherOnly = Symbol("higher only");
      const lowerOnly = Symbol("lower only");
      const nested = Symbol("nested");
      const protoLabel = Symbol("__proto__");
      const Symbols = S.Struct({
        [required]: S.String,
        [higherOnly]: S.optionalKey(S.String),
        [lowerOnly]: S.optionalKey(S.String),
        [protoLabel]: S.String,
        constructor: S.String,
        prototype: S.String,
        section: S.Struct({ [nested]: S.Struct({
          priority: S.String, local: S.optionalKey(S.String), fallback: S.optionalKey(S.String),
        }) }),
      });
      const higherFieldsWithSymbols = {
        [required]: higherFields.constructor, [higherOnly]: higherFields.prototype, [protoLabel]: "safe",
        constructor: higherFields.constructor, prototype: higherFields.prototype,
        section: { [nested]: { priority: higherFields.constructor, local: higherFields.prototype } },
      };
      const lowerFieldsWithSymbols = {
        [required]: lowerFields.constructor, [lowerOnly]: lowerFields.prototype, [protoLabel]: "lower",
        constructor: lowerFields.constructor, prototype: lowerFields.prototype,
        section: { [nested]: { priority: lowerFields.constructor, fallback: lowerFields.prototype } },
      };
      const target = yield* S.decodeEffect(Symbols)(higherFieldsWithSymbols);
      const source = yield* S.decodeEffect(Symbols)(lowerFieldsWithSymbols);
      const actual = deepMerge(source)(target);
      assert.isTrue(S.is(Symbols)(actual));
      assert.deepStrictEqual(actual, {
        [required]: higherFields.constructor, [higherOnly]: higherFields.prototype,
        [lowerOnly]: lowerFields.prototype, [protoLabel]: "safe",
        constructor: higherFields.constructor, prototype: higherFields.prototype,
        section: { [nested]: {
          priority: higherFields.constructor, local: higherFields.prototype, fallback: lowerFields.prototype,
        } },
      });
      assert.deepStrictEqual(deepMerge(target, source), actual);
      assert.deepStrictEqual(target, higherFieldsWithSymbols);
      assert.deepStrictEqual(source, lowerFieldsWithSymbols);
      assert.deepStrictEqual(Object.getOwnPropertyDescriptor(actual, required), {
        value: higherFields.constructor, writable: true, enumerable: true, configurable: true,
      });
    }), runs);

  it.effect("direct merging excludes non-enumerable keys on both inputs without reading them", () =>
    Effect.gen(function* () {
      const hidden = Symbol("hidden");
      const target: Record<PropertyKey, unknown> = { priority: "higher" };
      const source: Record<PropertyKey, unknown> = { priority: "lower", fallback: "base" };
      for (const record of [target, source]) {
        for (const key of ["hidden", hidden]) {
          Object.defineProperty(record, key, {
            get() { return assert.fail("must not read a non-enumerable getter"); },
          });
        }
      }
      const actual = deepMerge(target, source);
      assert.deepStrictEqual(actual, { priority: "higher", fallback: "base" });
      assert.isFalse(R.has(actual, "hidden"));
      assert.isFalse(R.has(actual, hidden));
      assert.isTrue(R.has(target, hidden));
      assert.isTrue(R.has(source, hidden));
    }));

  it.effect("only compatible plain-record prototypes merge, at the root and in nested sections", () =>
    Effect.gen(function* () {
      const higher = { __proto__: null, local: "higher" };
      const lower = { __proto__: null, fallback: "base" };
      const plain = { fallback: "plain" };
      assert.isTrue(isPlainObject(higher));
      assert.isTrue(canMerge(higher, lower));
      assert.isFalse(canMerge(higher, plain));
      assert.isFalse(canMerge(plain, higher));
      const actual = deepMerge(higher, lower);
      assert.strictEqual(Object.getPrototypeOf(actual), null);
      assert.strictEqual(actual.local, "higher");
      assert.deepStrictEqual(Object.getOwnPropertyDescriptor(actual, "fallback"), {
        value: "base", writable: true, enumerable: true, configurable: true,
      });
      assert.strictEqual(deepMerge(higher, plain), higher);
      assert.strictEqual(deepMerge(plain, higher), plain);
      assert.strictEqual(deepMerge({ section: higher }, { section: plain }).section, higher);
      assert.strictEqual(deepMerge({ section: plain }, { section: higher }).section, plain);
      assert.isFalse(Object.hasOwn(higher, "fallback"));
      assert.isFalse(Object.hasOwn(lower, "local"));
    }));

  it.effect("self-merge filters a nested own __proto__ key while preserving ordinary fields and input", () =>
    Effect.gen(function* () {
      const payload: Record<string, unknown> = { ["__proto__"]: [], retained: "safe" };
      const value = { section: { constructor: "", prototype: "", payload }, items: [] };
      const once = deepMerge(value, value);
      assert.deepStrictEqual(once, {
        section: { constructor: "", prototype: "", payload: { retained: "safe" } },
        items: [],
      });
      assert.strictEqual(Object.getPrototypeOf(once.section.payload), Object.prototype);
      assert.isFalse(R.has(once.section.payload, "__proto__"));
      assert.isTrue(R.has(payload, "__proto__"));
      assert.deepStrictEqual(payload["__proto__"], []);
      assert.deepStrictEqual(deepMerge(once, value), once);
      assert.strictEqual(once.items, value.items);
    }));

  it.effect.prop("self-merge is idempotent and preserves own constructor/prototype fields", [Arbitrary.schema(Document)], ([value]) =>
    Effect.gen(function* () {
      assert.isTrue(isPlainObject(value));
      assert.isTrue(canMerge(value, value));
      const once = deepMerge(value, value);
      assert.deepStrictEqual(once, value);
      assert.deepStrictEqual(deepMerge(once, value), once);
      assert.strictEqual(once.items, value.items);
    }), runs);

  it.effect.prop("nested own fields keep target priority while absent fields are filled, without mutating either input", [Arbitrary.schema(Fields), Arbitrary.schema(Fields)], ([higher, lower]) =>
    Effect.gen(function* () {
      const target: Record<string, unknown> = { section: { constructor: higher.constructor, payload: [higher.payload] } };
      const source = { section: { constructor: lower.constructor, prototype: lower.prototype, payload: [lower.payload] }, fallback: lower.payload };
      const actual = deepMerge(source)(target);
      assert.deepStrictEqual(actual, {
        section: { constructor: higher.constructor, prototype: lower.prototype, payload: [higher.payload] },
        fallback: lower.payload,
      });
      assert.deepStrictEqual(target, { section: { constructor: higher.constructor, payload: [higher.payload] } });
      assert.deepStrictEqual(source, { section: { constructor: lower.constructor, prototype: lower.prototype, payload: [lower.payload] }, fallback: lower.payload });
    }), runs);
});

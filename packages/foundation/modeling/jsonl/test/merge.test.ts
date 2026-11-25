// Adapted from effected/packages/jsonl/__test__/merge.test.ts (MIT).

import { $JsonlId } from "@beep/identity/packages";
import { canMerge, isRecordLike, shallowMerge } from "@beep/jsonl/internal/merge";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $JsonlId.create("test/merge");

const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeRecord = S.decodeResult(JsonRecord);
const hostileParsedRecord = (json: string): Record<string, unknown> => Result.getOrThrow(decodeRecord(json));

describe("shallowMerge, tested at its own level: appendPatch re-encodes the merged object, so an end-to-end test never sees a hijacked prototype", () => {
  it("merges patch over base, patch winning", () => {
    const merged = shallowMerge({ round: 1, phase: "a" }, { round: 2 });
    assert.deepStrictEqual({ ...merged }, { round: 2, phase: "a" });
  });

  it("is SHALLOW — a nested object replaces rather than merging", () => {
    const merged = shallowMerge({ nested: { keep: 1, drop: 2 } }, { nested: { keep: 9 } });
    assert.deepStrictEqual(merged.nested, { keep: 9 }, "the nested object is replaced wholesale");
  });

  it("does not hijack the result's prototype via __proto__ in the PATCH", () => {
    const patch = hostileParsedRecord('{"round":5,"__proto__":{"polluted":true}}');
    assert.include(Object.getOwnPropertyNames(patch), "__proto__", "the parsed fixture has an own __proto__ key");

    const merged = shallowMerge({ round: 1, phase: "p" }, patch);

    assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype, "prototype intact");
    assert.isUndefined(Reflect.get(merged, "polluted"));
    assert.isUndefined(Reflect.get(Object.prototype, "polluted"));
    assert.notInclude(R.keys(merged), "__proto__");
  });

  it("does not hijack the result's prototype via __proto__ in the BASE, decoded journal data an external writer controls", () => {
    const base = hostileParsedRecord('{"round":1,"phase":"p","__proto__":{"polluted":true}}');
    const merged = shallowMerge(base, { round: 2 });

    assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype, "prototype intact");
    assert.isUndefined(Reflect.get(merged, "polluted"));
    assert.isUndefined(Reflect.get(Object.prototype, "polluted"));
  });

  it("drops constructor and prototype keys from both sides", () => {
    const merged = shallowMerge(
      hostileParsedRecord('{"constructor":"base"}'),
      hostileParsedRecord('{"prototype":"patch","ok":1}')
    );
    assert.notInclude(R.keys(merged), "constructor");
    assert.notInclude(R.keys(merged), "prototype");
    assert.strictEqual(merged.ok, 1, "ordinary keys still merge");
    assert.strictEqual(P.isFunction({}.constructor), true, "the real constructor is untouched");
  });

  it("copies as own DATA properties, never through a setter", () => {
    const prototypeWithThrowingSetter = {};
    Object.defineProperty(prototypeWithThrowingSetter, "trapped", {
      set() {
        throw new Error("setter invoked — [[Set]] semantics leaked in");
      },
      get() {
        return "from-prototype";
      },
      configurable: true,
    });
    const base: Record<string, unknown> = Object.create(prototypeWithThrowingSetter);
    assert.doesNotThrow(
      () => shallowMerge(base, { trapped: "value" }),
      "a defineProperty copy never invokes the prototype's setter; an [[Set]] copy would"
    );
    const merged = shallowMerge(base, { trapped: "value" });
    assert.isTrue(R.has(merged, "trapped"), "an own data property, not a setter call");
    assert.strictEqual(merged.trapped, "value");
  });

  it("preserves the base's prototype for non-plain bases", () => {
    class Payload extends S.Class<Payload, { readonly brand: unique symbol }>($I`Payload`)({ round: S.Finite }) {}
    const base = Payload.make({ round: 1 });
    assert.isTrue(isRecordLike(base));
    if (!isRecordLike(base)) return assert.fail("class payload must be record-like");
    const merged = shallowMerge(base, { round: 2 });
    assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype, "the transient patch is a plain record");
    const marker = `~effect/Schema/Class/${Payload.identifier}`;
    assert.deepStrictEqual(
      R.filter(merged, (_, key) => key !== marker),
      { round: 2 },
      "the patched fields survive the representation change"
    );
    assert.isTrue(R.has(merged, marker), "class provenance is transient own metadata");
    assert.strictEqual(merged[marker], marker);
    const hostilePatch = shallowMerge(base, { round: 3, [marker]: "forged", "~effect/Schema/Class/Other": "forged" });
    assert.strictEqual(hostilePatch[marker], marker, "patch fields cannot replace base provenance");
    assert.isFalse(R.has(hostilePatch, "~effect/Schema/Class/Other"));
    const decoded = Result.getOrThrow(S.decodeUnknownResult(Payload)(merged));
    assert.instanceOf(decoded, Payload, "schema decoding creates the returned class instance");
    assert.strictEqual(decoded.round, 2);
  });
});

describe("canMerge", () => {
  class Payload {
    readonly a: number;
    readonly b: number | undefined;
    constructor(a: number, b?: number) {
      this.a = a;
      this.b = b;
    }
  }

  it("merges a plain base with a plain patch", () => {
    assert.isTrue(canMerge({ a: 1 }, { b: 2 }));
  });

  it("MERGES a class-instance base with a plain partial patch, the dominant payload idiom a same-prototype test would replace", () => {
    assert.isTrue(canMerge(new Payload(1, 2), { a: 9 }));
  });

  it("does NOT merge across two different classes", () => {
    class Other {
      readonly a: number;
      constructor(a: number) {
        this.a = a;
      }
    }
    assert.isFalse(canMerge(new Payload(1), new Other(2)));
  });

  it("does not merge scalars, arrays, null, void or Dates", () => {
    for (const base of [5, "text", null, undefined, [1, 2], DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)]) {
      assert.isFalse(canMerge(base, { a: 1 }));
    }
    assert.isFalse(canMerge({ a: 1 }, [1, 2]));
  });
});

describe("isRecordLike", () => {
  it("accepts class instances", () => {
    class Thing {}
    assert.isTrue(isRecordLike(new Thing()));
  });

  it("rejects arrays and Dates, which a bare typeof check would admit", () => {
    assert.isFalse(isRecordLike([]));
    assert.isFalse(isRecordLike(DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)));
  });

  it("reads Symbol.toStringTag as the object's tag only when it is a string", () => {
    assert.isTrue(isRecordLike({ [Symbol.toStringTag]: 1 }), "a non-string tag leaves a plain object");
    assert.isTrue(isRecordLike({ [Symbol.toStringTag]: "Object" }), "the Object tag is a plain object");
    assert.isFalse(isRecordLike({ [Symbol.toStringTag]: "Custom" }), "any other tag is a built-in-like container");
  });
});

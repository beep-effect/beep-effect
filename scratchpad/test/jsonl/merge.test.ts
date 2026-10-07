// Adapted from effected/packages/jsonl/__test__/merge.test.ts (MIT).

import { canMerge, isRecordLike, shallowMerge } from "@beep/scratchpad/effected/jsonl/internal/merge";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

/**
 * `shallowMerge` is tested directly, at its own level, and that is the point.
 *
 * An end-to-end `appendPatch` test cannot see this: the merged object is
 * transient — it is immediately encoded by the payload schema and re-decoded,
 * so a hijacked prototype is discarded before any envelope assertion runs. A
 * mutation swapping this function for `Object.assign({}, base, patch)` passed
 * the whole end-to-end suite while genuinely reintroducing the pollution. The
 * invariant lives here, so the test lives here.
 */

/** A patch carrying an OWN `__proto__` key, as `JSON.parse` produces. */
const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeRecord = S.decodeResult(JsonRecord);
const hostile = (json: string): Record<string, unknown> => Result.getOrThrow(decodeRecord(json));

describe("shallowMerge", () => {
  it("merges patch over base, patch winning", () => {
    const merged = shallowMerge({ round: 1, phase: "a" }, { round: 2 });
    assert.deepStrictEqual({ ...merged }, { round: 2, phase: "a" });
  });

  it("is SHALLOW — a nested object replaces rather than merging", () => {
    const merged = shallowMerge({ nested: { keep: 1, drop: 2 } }, { nested: { keep: 9 } });
    assert.deepStrictEqual(merged.nested, { keep: 9 }, "the nested object is replaced wholesale");
  });

  it("does not hijack the result's prototype via __proto__ in the PATCH", () => {
    const patch = hostile('{"round":5,"__proto__":{"polluted":true}}');
    assert.include(Object.getOwnPropertyNames(patch), "__proto__", "the fixture is genuinely hostile");

    const merged = shallowMerge({ round: 1, phase: "p" }, patch);

    assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype, "prototype intact");
    assert.isUndefined(Reflect.get(merged, "polluted"));
    assert.isUndefined(Reflect.get(Object.prototype, "polluted"));
    assert.notInclude(R.keys(merged), "__proto__");
  });

  it("does not hijack the result's prototype via __proto__ in the BASE", () => {
    // The base is decoded journal data — an external writer controls it just
    // as directly as the patch, so filtering only one side is not enough.
    const base = hostile('{"round":1,"phase":"p","__proto__":{"polluted":true}}');
    const merged = shallowMerge(base, { round: 2 });

    assert.strictEqual(Object.getPrototypeOf(merged), Object.prototype, "prototype intact");
    assert.isUndefined(Reflect.get(merged, "polluted"));
    assert.isUndefined(Reflect.get(Object.prototype, "polluted"));
  });

  it("drops constructor and prototype keys from both sides", () => {
    const merged = shallowMerge(hostile('{"constructor":"base"}'), hostile('{"prototype":"patch","ok":1}'));
    assert.notInclude(R.keys(merged), "constructor");
    assert.notInclude(R.keys(merged), "prototype");
    assert.strictEqual(merged.ok, 1, "ordinary keys still merge");
    assert.strictEqual(P.isFunction({}.constructor), true, "the real constructor is untouched");
  });

  it("copies as own DATA properties, never through a setter", () => {
    // A base whose prototype defines a throwing setter: an [[Set]] copy would
    // invoke it, a defineProperty copy cannot.
    const proto = {};
    Object.defineProperty(proto, "trapped", {
      set() {
        throw new Error("setter invoked — [[Set]] semantics leaked in");
      },
      get() {
        return "from-prototype";
      },
      configurable: true,
    });
    const base: Record<string, unknown> = Object.create(proto);
    assert.doesNotThrow(() => shallowMerge(base, { trapped: "value" }));
    const merged = shallowMerge(base, { trapped: "value" });
    assert.isTrue(Object.hasOwn(merged, "trapped"), "an own data property, not a setter call");
    assert.strictEqual(merged.trapped, "value");
  });

  it("preserves the base's prototype for non-plain bases", () => {
    class Payload {
      readonly round: number;
      constructor(round: number) {
        this.round = round;
      }
    }
    const base = new Payload(1);
    assert.isTrue(isRecordLike(base));
    if (!isRecordLike(base)) return assert.fail("class payload must be record-like");
    const merged = shallowMerge(base, { round: 2 });
    assert.strictEqual(Object.getPrototypeOf(merged), Payload.prototype, "a decoded class survives the merge");
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

  it("MERGES a class-instance base with a plain partial patch", () => {
    // The kit's dominant payload idiom. A symmetric same-prototype test would
    // reject this — the patch is a caller-written literal, not a peer document
    // — and fall back to replacement, silently dropping the base's fields.
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
});

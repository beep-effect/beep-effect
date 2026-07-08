import { isMutableHashSet, MutableHashSet, MutableHashSetFromSelf } from "@beep/schema/MutableHashSet";
import { withKeyDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as MutableHashSet_ from "effect/MutableHashSet";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("MutableHashSetFromSelf", () => {
  it("preserves schema metadata and validates existing mutable hash sets", () => {
    const schema = MutableHashSetFromSelf(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)(MutableHashSet_.make("1", "2", "1"));

    expect(schema.value).toBe(S.FiniteFromString);
    expect(schema.annotate({}).value).toBe(S.FiniteFromString);
    expect(isMutableHashSet(decoded)).toBe(true);
    expect(A.fromIterable(decoded)).toEqual([1, 2]);
  });

  it("rejects non-mutable-hash-set inputs", () => {
    const schema = MutableHashSetFromSelf(S.FiniteFromString);

    expect(() => S.decodeUnknownSync(schema)(null)).toThrow(
      "Expected @beep/schema/MutableHashSet/MutableHashSetFromSelf, got null"
    );
  });

  it("reports member decode failures at the values path", () => {
    const schema = MutableHashSetFromSelf(S.FiniteFromString);

    expect(() => S.decodeUnknownSync(schema)(MutableHashSet_.make("1", null))).toThrow(`Expected string, got null
  at ["values"][1]`);
  });

  it("derives formatter and equivalence instances", () => {
    const formatter = S.toFormatter(MutableHashSetFromSelf(S.String));
    const equivalence = S.toEquivalence(MutableHashSetFromSelf(S.String));

    expect(formatter(MutableHashSet_.make("b", "a"))).toBe(`MutableHashSet(2) { "a", "b" }`);
    expect(equivalence(MutableHashSet_.make("a", "b"), MutableHashSet_.make("b", "a"))).toBe(true);
    expect(equivalence(MutableHashSet_.make("a"), MutableHashSet_.make("b"))).toBe(false);
  });

  it("round-trips arbitrary sets derived from the source schema under the derived equivalence", () => {
    const schema = MutableHashSetFromSelf(S.String);
    const arbitrary = S.toArbitrary(schema);
    const equivalence = S.toEquivalence(schema);
    const decode = S.decodeSync(schema);
    const encode = S.encodeSync(schema);

    fc.assert(
      fc.property(arbitrary, (set) => {
        const encoded = encode(set);
        const decoded = decode(encoded);
        expect(equivalence(decoded, set)).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});

describe("MutableHashSet", () => {
  it("decodes arrays into mutable hash sets and removes duplicates", () => {
    const schema = MutableHashSet(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)(["1", "2", "1"]);

    expect(schema.value).toBe(S.FiniteFromString);
    expect(schema.annotate({}).value).toBe(S.FiniteFromString);
    expect(isMutableHashSet(decoded)).toBe(true);
    expect(A.fromIterable(decoded)).toEqual([1, 2]);
  });

  it("encodes mutable hash sets back to arrays", () => {
    const schema = MutableHashSet(S.FiniteFromString);

    expect(S.encodeSync(schema)(MutableHashSet_.make(1, 2, 3))).toEqual(["1", "2", "3"]);
  });

  it("expects the encoded array form at the boundary", () => {
    const schema = MutableHashSet(S.FiniteFromString);

    expect(() => S.decodeUnknownSync(schema)(MutableHashSet_.make("1", null))).toThrow(
      `Expected array, got MutableHashSet(["1",null])`
    );
  });

  it("supports decoded mutable hash set defaults for missing struct keys", () => {
    const schema = S.Struct({
      values: MutableHashSet(S.String).pipe(withKeyDefaults(MutableHashSet_.empty<string>())),
    });

    const constructed = schema.make({});
    const decoded = S.decodeUnknownSync(schema)({});

    expect(isMutableHashSet(constructed.values)).toBe(true);
    expect(isMutableHashSet(decoded.values)).toBe(true);
    expect(A.fromIterable(constructed.values)).toEqual([]);
    expect(A.fromIterable(decoded.values)).toEqual([]);
  });
});

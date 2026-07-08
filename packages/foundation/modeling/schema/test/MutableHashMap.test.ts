import { isMutableHashMap, MutableHashMap, MutableHashMapFromSelf } from "@beep/schema/MutableHashMap";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as MutableHashMap_ from "effect/MutableHashMap";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("MutableHashMapFromSelf", () => {
  it("preserves schema metadata and validates existing mutable hash maps", () => {
    const schema = MutableHashMapFromSelf({
      key: S.String,
      value: S.FiniteFromString,
    });
    const decoded = S.decodeUnknownSync(schema)(MutableHashMap_.make(["a", "1"], ["b", "2"]));

    expect(schema.key).toBe(S.String);
    expect(schema.value).toBe(S.FiniteFromString);
    expect(schema.annotate({}).key).toBe(S.String);
    expect(schema.annotate({}).value).toBe(S.FiniteFromString);
    expect(isMutableHashMap(decoded)).toBe(true);
    expect(A.fromIterable(decoded)).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("rejects non-mutable-hash-map inputs", () => {
    const schema = MutableHashMapFromSelf({
      key: S.String,
      value: S.FiniteFromString,
    });

    expect(() => S.decodeUnknownSync(schema)(null)).toThrow(
      "Expected @beep/schema/MutableHashMap/MutableHashMapFromSelf, got null"
    );
  });

  it("reports entry decode failures at the entries path", () => {
    const schema = MutableHashMapFromSelf({
      key: S.String,
      value: S.FiniteFromString,
    });

    expect(() => S.decodeUnknownSync(schema)(MutableHashMap_.make(["a", null]))).toThrow(`Expected string, got null
  at ["entries"][0][1]`);
  });

  it("derives formatter and equivalence instances", () => {
    const formatter = S.toFormatter(
      MutableHashMapFromSelf({
        key: S.String,
        value: S.Finite,
      })
    );
    const equivalence = S.toEquivalence(
      MutableHashMapFromSelf({
        key: S.String,
        value: S.Finite,
      })
    );

    expect(formatter(MutableHashMap_.make(["b", 2], ["a", 1]))).toBe(`MutableHashMap(2) { "a" => 1, "b" => 2 }`);
    expect(equivalence(MutableHashMap_.make(["a", 1], ["b", 2]), MutableHashMap_.make(["b", 2], ["a", 1]))).toBe(true);
    expect(equivalence(MutableHashMap_.make(["a", 1]), MutableHashMap_.make(["a", 2]))).toBe(false);
  });
});

describe("MutableHashMap", () => {
  it("decodes entry arrays into mutable hash maps", () => {
    const schema = MutableHashMap({
      key: S.String,
      value: S.FiniteFromString,
    });
    const decoded = S.decodeUnknownSync(schema)([
      ["a", "1"],
      ["b", "2"],
    ]);

    expect(schema.key).toBe(S.String);
    expect(schema.value).toBe(S.FiniteFromString);
    expect(schema.annotate({}).key).toBe(S.String);
    expect(schema.annotate({}).value).toBe(S.FiniteFromString);
    expect(isMutableHashMap(decoded)).toBe(true);
    expect(A.fromIterable(decoded)).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("encodes mutable hash maps back to entry arrays", () => {
    const schema = MutableHashMap({
      key: S.String,
      value: S.FiniteFromString,
    });

    expect(S.encodeSync(schema)(MutableHashMap_.make(["a", 1], ["b", 2]))).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("expects the encoded entry-array form at the boundary", () => {
    const schema = MutableHashMap({
      key: S.String,
      value: S.FiniteFromString,
    });

    expect(() => S.decodeUnknownSync(schema)(MutableHashMap_.make(["a", null]))).toThrow(
      `Expected array, got MutableHashMap([["a",null]])`
    );
  });

  it("round-trips arbitrary mutable hash maps derived from the source schema", () => {
    const schema = MutableHashMap({
      key: S.String,
      value: S.FiniteFromString,
    });
    const arbitrary = S.toArbitrary(schema);
    const decode = S.decodeSync(schema);
    const encode = S.encodeSync(schema);
    const equivalence = S.toEquivalence(schema);

    fc.assert(
      fc.property(arbitrary, (value) => {
        const encoded = encode(value);
        const decoded = decode(encoded);
        expect(equivalence(decoded, value)).toBe(true);
      }),
      fcRuns(50)
    );
  });
});

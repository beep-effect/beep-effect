import { fcRuns } from "@beep/fc-runs";
import { HashSet } from "@beep/schema/HashSet";
import { withKeyDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as HashSet_ from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("HashSet", () => {
  it("decodes arrays into hash sets and removes duplicates", () => {
    const schema = HashSet(S.FiniteFromString);
    const decoded = S.decodeUnknownSync(schema)(["1", "2", "1"]);

    expect(schema.value).toBe(S.FiniteFromString);
    expect(schema.annotate({}).value).toBe(S.FiniteFromString);
    expect(HashSet_.isHashSet(decoded)).toBe(true);
    expect(A.sort(A.fromIterable(decoded), Order.Number)).toEqual([1, 2]);
  });

  it("encodes hash sets back to arrays", () => {
    const schema = HashSet(S.FiniteFromString);
    const encoded = S.encodeSync(schema)(HashSet_.make(1, 2, 3));

    expect(Array.isArray(encoded)).toBe(true);
    expect(A.sort(encoded, Order.String)).toEqual(["1", "2", "3"]);
  });

  it("expects the encoded array form at the boundary", () => {
    const schema = HashSet(S.FiniteFromString);

    // This is the whole reason the module exists: `effect/Schema`'s own
    // `HashSet` accepts a live set here and encodes back to one, which no jsonb
    // column can hold and no driver row can return.
    expect(() => S.decodeUnknownSync(schema)(HashSet_.make("1", "2"))).toThrow("Expected array");
  });

  it("reports member decode failures at the failing index", () => {
    const schema = HashSet(S.FiniteFromString);

    expect(() => S.decodeUnknownSync(schema)(["1", null])).toThrow(`Expected string
  at [1]`);
  });

  it("supports decoded hash set defaults for missing struct keys", () => {
    const schema = S.Struct({
      values: HashSet(S.String).pipe(withKeyDefaults(HashSet_.empty<string>())),
    });

    const constructed = schema.make({});
    const decoded = S.decodeUnknownSync(schema)({});

    expect(HashSet_.isHashSet(constructed.values)).toBe(true);
    expect(HashSet_.isHashSet(decoded.values)).toBe(true);
    expect(HashSet_.size(decoded.values)).toBe(0);
  });

  it("round-trips arbitrary sets through the array form under the derived equivalence", () => {
    const schema = HashSet(S.String);
    const arbitrary = S.toArbitrary(schema);
    const equivalence = S.toEquivalence(schema);
    const decode = S.decodeSync(schema);
    const encode = S.encodeSync(schema);

    fc.assert(
      fc.property(arbitrary, (set) => {
        const encoded = encode(set);
        expect(Array.isArray(encoded)).toBe(true);
        expect(equivalence(decode(encoded), set)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("survives the JSON trip a jsonb column puts a set through", () => {
    const schema = S.Struct({ territorial: HashSet(S.String) });
    const value = schema.make({ territorial: HashSet_.make("US-CA", "US-NV") });

    // Encoded, serialized, parsed, decoded — the exact path a persisted set
    // takes, and the one that fails in both directions under `S.HashSet`.
    const stored: unknown = JSON.parse(JSON.stringify(S.encodeSync(schema)(value)));
    const returned = S.decodeUnknownSync(schema)(stored);

    expect(HashSet_.isHashSet(returned.territorial)).toBe(true);
    expect(HashSet_.has(returned.territorial, "US-CA")).toBe(true);
    expect(HashSet_.has(returned.territorial, "US-NV")).toBe(true);
  });
});

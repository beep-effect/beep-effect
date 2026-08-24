import { IdentityInterpolationError, IdentitySegmentCountError } from "@beep/identity";
import { expand } from "@beep/identity/Curie";
import { describe, expect, it } from "@effect/vitest";
import { identity } from "effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

describe("identity tagged-error declared equivalence", () => {
  it("compares empty-field identity errors by their declared tags", () => {
    const sameInterpolation = S.toEquivalence(IdentityInterpolationError);
    const sameSegmentCount = S.toEquivalence(IdentitySegmentCountError);
    const interpolationA = IdentityInterpolationError.make({});
    const interpolationB = IdentityInterpolationError.make({});
    const segmentA = IdentitySegmentCountError.make({});
    const segmentB = IdentitySegmentCountError.make({});

    expect(sameInterpolation(interpolationA, interpolationB)).toBe(true);
    expect(Reflect.apply(sameInterpolation, undefined, [interpolationA, segmentA])).toBe(false);
    expect(sameSegmentCount(segmentA, segmentB)).toBe(true);
    expect(Reflect.apply(sameSegmentCount, undefined, [segmentA, interpolationA])).toBe(false);
  });

  it("compares the private CURIE invariant error by its declared value", () => {
    const a = capture(() => Reflect.apply(expand, undefined, ["missing:value"]));
    const b = capture(() => Reflect.apply(expand, undefined, ["missing:value"]));
    const c = capture(() => Reflect.apply(expand, undefined, ["other:value"]));

    expect(P.isObject(a)).toBe(true);
    const schema = P.isObject(a) ? Reflect.get(a, "constructor") : a;
    expect(S.isSchema(schema)).toBe(true);

    if (S.isSchema(schema)) {
      const sameInvariant = S.toEquivalence(schema);

      expect(sameInvariant(a, b)).toBe(true);
      expect(sameInvariant(a, c)).toBe(false);
    }
  });
});

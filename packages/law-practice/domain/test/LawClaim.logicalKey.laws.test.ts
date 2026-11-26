import { DistinctionProposition, logicalKey } from "@beep/law-practice-domain/values/LawClaim";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { proposition } from "./support/LawClaimFixtures.ts";

const equivalent = S.toEquivalence(DistinctionProposition);

const unprefixedKey = (value: DistinctionProposition): string =>
  A.join(
    [
      value.authority,
      value.applicationNumber,
      `${value.claimNumber}`,
      value.ground,
      value.referenceDocument,
      value.detail.kind,
      value.detail.limitation,
    ],
    ""
  );

describe("LawClaim logical key", () => {
  it.prop(
    "L4-5 distinction proposition equivalence agrees exactly with logical key equality",
    [DistinctionProposition, DistinctionProposition, S.Boolean],
    ([leftFields, otherFields, same]) => {
      const left = DistinctionProposition.make(leftFields);
      const right = DistinctionProposition.make(same ? leftFields : otherFields);
      expect(equivalent(left, right)).toBe(logicalKey(left) === logicalKey(right));
      if (same) expect(logicalKey(left)).toBe(logicalKey(right));
    },
    { arbitrary: fcRuns() }
  );

  it("L4-5 an unprefixed key collides where the length-prefixed key does not", () => {
    const shifted = DistinctionProposition.make({
      ...proposition,
      applicationNumber: `${proposition.applicationNumber}1`,
      claimNumber: 2,
    });
    const original = DistinctionProposition.make({ ...proposition, claimNumber: 12 });
    expect(unprefixedKey(shifted)).toBe(unprefixedKey(original));
    expect(equivalent(shifted, original)).toBe(false);
    expect(logicalKey(shifted)).not.toBe(logicalKey(original));
  });
});

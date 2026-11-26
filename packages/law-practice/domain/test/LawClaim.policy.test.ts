import {
  AlignmentAssessment,
  LawAssessmentProfiles,
  OfficeActionAssessmentArrows,
  OfficeActionDistinctionGate,
  ReferenceAssessment,
  SupportAssessment,
} from "@beep/law-practice-domain/values/LawClaim";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import type { OfficeActionAssessments } from "@beep/law-practice-domain/values/LawClaim";

const unassessed = { _tag: "Unassessed", reason: "not-assessed" } as const;

const assessed = <V extends string>(value: V) => ({ _tag: "Assessed", value }) as const;

const record = (
  support: SupportAssessment,
  alignment: AlignmentAssessment,
  reference: ReferenceAssessment
): OfficeActionAssessments => ({
  support: assessed(support),
  alignment: assessed(alignment),
  reference: assessed(reference),
});

const passing = record("verified", "exact", "identified");

describe("office-action distinction gate", () => {
  it("passes every assessed record with verified support, an identified reference and any alignment", () => {
    for (const alignment of ["exact", "lesser", "fuzzy"] as const) {
      expect(OfficeActionDistinctionGate.passes(record("verified", alignment, "identified"))).toBe(true);
    }
  });

  it("refuses unverified support, an unidentified reference and unaligned support", () => {
    expect(OfficeActionDistinctionGate.passes(record("unverified", "exact", "identified"))).toBe(false);
    expect(OfficeActionDistinctionGate.passes(record("verified", "exact", "unidentified"))).toBe(false);
    expect(OfficeActionDistinctionGate.passes(record("verified", "unaligned", "identified"))).toBe(false);
  });

  it("L4-6 never passes a record with an unassessed coordinate", () => {
    expect(OfficeActionDistinctionGate.passes({ ...passing, support: unassessed })).toBe(false);
    expect(OfficeActionDistinctionGate.passes({ ...passing, alignment: unassessed })).toBe(false);
    expect(OfficeActionDistinctionGate.passes({ ...passing, reference: unassessed })).toBe(false);
  });

  it("requires all three coordinates and ranks each value domain", () => {
    expect(HashSet.size(OfficeActionDistinctionGate.requiredCoordinates)).toBe(3);
    expect(A.sort(AlignmentAssessment.literals, OfficeActionDistinctionGate.order.alignment)).toEqual([
      "unaligned",
      "fuzzy",
      "lesser",
      "exact",
    ]);
    expect(A.sort(SupportAssessment.literals, OfficeActionDistinctionGate.order.support)).toEqual([
      "unverified",
      "verified",
    ]);
    expect(A.sort(ReferenceAssessment.literals, OfficeActionDistinctionGate.order.reference)).toEqual([
      "unidentified",
      "identified",
    ]);
  });

  it("keys the office-action profile by its authority type", () => {
    expect(LawAssessmentProfiles["office-action"].gate).toBe(OfficeActionDistinctionGate);
    expect(LawAssessmentProfiles["office-action"].arrows).toBe(OfficeActionAssessmentArrows);
  });

  it.effect("updates the last coordinate of a passing record and refuses while one stays unassessed", () =>
    Effect.gen(function* () {
      const gate = OfficeActionDistinctionGate;
      const { updateAssessment } = OfficeActionAssessmentArrows;
      const partial = { ...passing, reference: unassessed };
      const refused = yield* updateAssessment({
        record: { ...partial, alignment: unassessed },
        coordinate: "support",
        input: "verified",
        gate,
      });
      const updated = yield* updateAssessment({ record: partial, coordinate: "reference", input: "identified", gate });
      const invalid = yield* updateAssessment({ record: partial, coordinate: "reference", input: "maybe", gate });
      expect(refused._tag).toBe("Refused");
      expect(updated._tag).toBe("Updated");
      expect(invalid._tag).toBe("Invalid");
    })
  );
});

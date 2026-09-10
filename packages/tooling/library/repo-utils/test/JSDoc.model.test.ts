import {
  CategorySignal,
  ScoredCategoryCandidate,
  TSCategoryDefinition,
} from "@beep/repo-utils/JSDoc/models/TSCategory.model";
import { TagName, TagValue } from "@beep/repo-utils/JSDoc/models/tag-values";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeCategorySignalSync = S.decodeSync(CategorySignal);
const decodeScoredCategoryCandidateSync = S.decodeSync(ScoredCategoryCandidate);
const decodeTSCategoryDefinitionSync = S.decodeSync(TSCategoryDefinition);
const decodeTagNameSync = S.decodeSync(TagName);
const decodeTagValueSync = S.decodeSync(TagValue);
const encodeCategorySignalSync = S.encodeSync(CategorySignal);
const encodeScoredCategoryCandidateSync = S.encodeSync(ScoredCategoryCandidate);
const encodeTSCategoryDefinitionSync = S.encodeSync(TSCategoryDefinition);
const encodeTagNameSync = S.encodeSync(TagName);
const encodeTagValueSync = S.encodeSync(TagValue);

const TagNameArbitrary = Arbitrary.schema(TagName);
const TagValueArbitrary = Arbitrary.schema(TagValue);
const TSCategoryDefinitionArbitrary = Arbitrary.schema(TSCategoryDefinition);
const CategorySignalArbitrary = Arbitrary.schema(CategorySignal);
const ScoredCategoryCandidateArbitrary = Arbitrary.schema(ScoredCategoryCandidate);

describe("JSDoc schema models", () => {
  it("round-trips schema-derived tag names through the encoded wire shape", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([TagNameArbitrary]),
          ([value]) => {
            const encoded = encodeTagNameSync(value);
            const decoded = decodeTagNameSync(encoded);

            expect(decoded).toEqual(value);

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips schema-derived tag values through the encoded wire shape", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([TagValueArbitrary]),
          ([value]) => {
            const encoded = encodeTagValueSync(value);
            const decoded = decodeTagValueSync(encoded);

            expect(decoded).toEqual(value);

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips schema-derived category definitions and preserves priority bounds", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([TSCategoryDefinitionArbitrary]),
          ([value]) => {
            const encoded = encodeTSCategoryDefinitionSync(value);
            const decoded = decodeTSCategoryDefinitionSync(encoded);

            expect(decoded).toEqual(value);
            expect(value.documentationPriority).toBeGreaterThanOrEqual(1);
            expect(value.documentationPriority).toBeLessThanOrEqual(99);

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips schema-derived category signal and candidate values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([CategorySignalArbitrary]),
          ([value]) => {
            const encoded = encodeCategorySignalSync(value);
            const decoded = decodeCategorySignalSync(encoded);

            expect(decoded).toEqual(value);

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([ScoredCategoryCandidateArbitrary]),
          ([value]) => {
            const encoded = encodeScoredCategoryCandidateSync(value);
            const decoded = decodeScoredCategoryCandidateSync(encoded);

            expect(decoded).toEqual(value);

            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });
});

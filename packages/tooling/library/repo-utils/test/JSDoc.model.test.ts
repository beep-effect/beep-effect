import {
  CategorySignal,
  ScoredCategoryCandidate,
  TSCategoryDefinition,
} from "@beep/repo-utils/JSDoc/models/TSCategory.model";
import { TagName, TagValue } from "@beep/repo-utils/JSDoc/models/tag-values";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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

const TagNameArbitrary = S.toArbitrary(TagName)(fc);
const TagValueArbitrary = S.toArbitrary(TagValue)(fc);
const TSCategoryDefinitionArbitrary = S.toArbitrary(TSCategoryDefinition)(fc);
const CategorySignalArbitrary = S.toArbitrary(CategorySignal)(fc);
const ScoredCategoryCandidateArbitrary = S.toArbitrary(ScoredCategoryCandidate)(fc);

describe("JSDoc schema models", () => {
  it("round-trips schema-derived tag names through the encoded wire shape", () => {
    fc.assert(
      fc.property(TagNameArbitrary, (value) => {
        const encoded = encodeTagNameSync(value);
        const decoded = decodeTagNameSync(encoded);

        expect(decoded).toEqual(value);
      }),
      fcRuns(20)
    );
  });

  it("round-trips schema-derived tag values through the encoded wire shape", () => {
    fc.assert(
      fc.property(TagValueArbitrary, (value) => {
        const encoded = encodeTagValueSync(value);
        const decoded = decodeTagValueSync(encoded);

        expect(decoded).toEqual(value);
      }),
      fcRuns(20)
    );
  });

  it("round-trips schema-derived category definitions and preserves priority bounds", () => {
    fc.assert(
      fc.property(TSCategoryDefinitionArbitrary, (value) => {
        const encoded = encodeTSCategoryDefinitionSync(value);
        const decoded = decodeTSCategoryDefinitionSync(encoded);

        expect(decoded).toEqual(value);
        expect(value.documentationPriority).toBeGreaterThanOrEqual(1);
        expect(value.documentationPriority).toBeLessThanOrEqual(99);
      }),
      fcRuns(20)
    );
  });

  it("round-trips schema-derived category signal and candidate values", () => {
    fc.assert(
      fc.property(CategorySignalArbitrary, (value) => {
        const encoded = encodeCategorySignalSync(value);
        const decoded = decodeCategorySignalSync(encoded);

        expect(decoded).toEqual(value);
      }),
      fcRuns(20)
    );
    fc.assert(
      fc.property(ScoredCategoryCandidateArbitrary, (value) => {
        const encoded = encodeScoredCategoryCandidateSync(value);
        const decoded = decodeScoredCategoryCandidateSync(encoded);

        expect(decoded).toEqual(value);
      }),
      fcRuns(20)
    );
  });
});

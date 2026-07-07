import {
  CategorySignal,
  ScoredCategoryCandidate,
  TSCategoryDefinition,
} from "@beep/repo-utils/JSDoc/models/TSCategory.model";
import { TagName, TagValue } from "@beep/repo-utils/JSDoc/models/tag-values";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const TagNameArbitrary = S.toArbitrary(TagName);
const TagValueArbitrary = S.toArbitrary(TagValue);
const TSCategoryDefinitionArbitrary = S.toArbitrary(TSCategoryDefinition);
const CategorySignalArbitrary = S.toArbitrary(CategorySignal);
const ScoredCategoryCandidateArbitrary = S.toArbitrary(ScoredCategoryCandidate);

describe("JSDoc schema models", () => {
  it("round-trips schema-derived tag names through the encoded wire shape", () => {
    fc.assert(
      fc.property(TagNameArbitrary, (value) => {
        const encoded = S.encodeSync(TagName)(value);
        const decoded = S.decodeUnknownSync(TagName)(encoded);

        expect(decoded).toEqual(value);
      }),
      { numRuns: 20 }
    );
  });

  it("round-trips schema-derived tag values through the encoded wire shape", () => {
    fc.assert(
      fc.property(TagValueArbitrary, (value) => {
        const encoded = S.encodeSync(TagValue)(value);
        const decoded = S.decodeUnknownSync(TagValue)(encoded);

        expect(decoded).toEqual(value);
      }),
      { numRuns: 20 }
    );
  });

  it("round-trips schema-derived category definitions and preserves priority bounds", () => {
    fc.assert(
      fc.property(TSCategoryDefinitionArbitrary, (value) => {
        const encoded = S.encodeSync(TSCategoryDefinition)(value);
        const decoded = S.decodeUnknownSync(TSCategoryDefinition)(encoded);

        expect(decoded).toEqual(value);
        expect(value.documentationPriority).toBeGreaterThanOrEqual(1);
        expect(value.documentationPriority).toBeLessThanOrEqual(99);
      }),
      { numRuns: 20 }
    );
  });

  it("round-trips schema-derived category signal and candidate values", () => {
    fc.assert(
      fc.property(CategorySignalArbitrary, (value) => {
        const encoded = S.encodeSync(CategorySignal)(value);
        const decoded = S.decodeUnknownSync(CategorySignal)(encoded);

        expect(decoded).toEqual(value);
      }),
      { numRuns: 20 }
    );
    fc.assert(
      fc.property(ScoredCategoryCandidateArbitrary, (value) => {
        const encoded = S.encodeSync(ScoredCategoryCandidate)(value);
        const decoded = S.decodeUnknownSync(ScoredCategoryCandidate)(encoded);

        expect(decoded).toEqual(value);
      }),
      { numRuns: 20 }
    );
  });
});

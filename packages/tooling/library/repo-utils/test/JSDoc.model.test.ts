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

const decodeCategorySignal = S.decodeEffect(CategorySignal);
const decodeScoredCategoryCandidate = S.decodeEffect(ScoredCategoryCandidate);
const decodeTSCategoryDefinition = S.decodeEffect(TSCategoryDefinition);
const decodeTagName = S.decodeEffect(TagName);
const decodeTagValue = S.decodeEffect(TagValue);
const encodeCategorySignal = S.encodeEffect(CategorySignal);
const encodeScoredCategoryCandidate = S.encodeEffect(ScoredCategoryCandidate);
const encodeTSCategoryDefinition = S.encodeEffect(TSCategoryDefinition);
const encodeTagName = S.encodeEffect(TagName);
const encodeTagValue = S.encodeEffect(TagValue);

const TagNameArbitrary = Arbitrary.schema(TagName);
const TagValueArbitrary = Arbitrary.schema(TagValue);
const TSCategoryDefinitionArbitrary = Arbitrary.schema(TSCategoryDefinition);
const CategorySignalArbitrary = Arbitrary.schema(CategorySignal);
const ScoredCategoryCandidateArbitrary = Arbitrary.schema(ScoredCategoryCandidate);

describe("JSDoc schema models", () => {
  it.effect(
    "round-trips schema-derived tag names through the encoded wire shape",
    Effect.fnUntraced(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.all([TagNameArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeTagName(value);
            const decoded = yield* decodeTagName(encoded);

            expect(decoded).toEqual(value);

            return true;
          }),
        fcRuns(20)
      );

      expect(result._tag).toBe("Passed");
    })
  );

  it.effect(
    "round-trips schema-derived tag values through the encoded wire shape",
    Effect.fnUntraced(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.all([TagValueArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeTagValue(value);
            const decoded = yield* decodeTagValue(encoded);

            expect(decoded).toEqual(value);

            return true;
          }),
        fcRuns(20)
      );

      expect(result._tag).toBe("Passed");
    })
  );

  it.effect(
    "round-trips schema-derived category definitions and preserves priority bounds",
    Effect.fnUntraced(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.all([TSCategoryDefinitionArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeTSCategoryDefinition(value);
            const decoded = yield* decodeTSCategoryDefinition(encoded);

            expect(decoded).toEqual(value);
            expect(value.documentationPriority).toBeGreaterThanOrEqual(1);
            expect(value.documentationPriority).toBeLessThanOrEqual(99);

            return true;
          }),
        fcRuns(20)
      );

      expect(result._tag).toBe("Passed");
    })
  );

  it.effect(
    "round-trips schema-derived category signal and candidate values",
    Effect.fnUntraced(function* () {
      const signalResult = yield* Arbitrary.checkEffect(
        Arbitrary.all([CategorySignalArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeCategorySignal(value);
            const decoded = yield* decodeCategorySignal(encoded);

            expect(decoded).toEqual(value);

            return true;
          }),
        fcRuns(20)
      );
      const candidateResult = yield* Arbitrary.checkEffect(
        Arbitrary.all([ScoredCategoryCandidateArbitrary]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeScoredCategoryCandidate(value);
            const decoded = yield* decodeScoredCategoryCandidate(encoded);

            expect(decoded).toEqual(value);

            return true;
          }),
        fcRuns(20)
      );

      expect(signalResult._tag).toBe("Passed");
      expect(candidateResult._tag).toBe("Passed");
    })
  );
});

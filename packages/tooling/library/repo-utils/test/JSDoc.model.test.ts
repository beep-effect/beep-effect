import {
  CategorySignal,
  ScoredCategoryCandidate,
  TSCategoryDefinition,
} from "@beep/repo-utils/JSDoc/models/TSCategory.model";
import { TagName, TagValue } from "@beep/repo-utils/JSDoc/models/tag-values";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
  it.effect.prop(
    "round-trips schema-derived tag names through the encoded wire shape",
    [TagNameArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeTagName(value);
        const decoded = yield* decodeTagName(encoded);

        expect(decoded).toEqual(value);

        return true;
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived tag values through the encoded wire shape",
    [TagValueArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeTagValue(value);
        const decoded = yield* decodeTagValue(encoded);

        expect(decoded).toEqual(value);

        return true;
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived category definitions and preserves priority bounds",
    [TSCategoryDefinitionArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeTSCategoryDefinition(value);
        const decoded = yield* decodeTSCategoryDefinition(encoded);

        expect(decoded).toEqual(value);
        expect(value.documentationPriority).toBeGreaterThanOrEqual(1);
        expect(value.documentationPriority).toBeLessThanOrEqual(99);

        return true;
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived category signal and candidate values: CategorySignal",
    [CategorySignalArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeCategorySignal(value);
        const decoded = yield* decodeCategorySignal(encoded);

        expect(decoded).toEqual(value);

        return true;
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived category signal and candidate values: ScoredCategoryCandidate",
    [ScoredCategoryCandidateArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeScoredCategoryCandidate(value);
        const decoded = yield* decodeScoredCategoryCandidate(encoded);

        expect(decoded).toEqual(value);

        return true;
      }),
    { arbitrary: fcRuns(20) }
  );
});

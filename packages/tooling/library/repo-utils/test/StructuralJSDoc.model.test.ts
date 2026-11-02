import { JSDocTag, matchStructuralJSDoc, StructuralJSDoc } from "@beep/repo-utils/JSDoc/JSDoc";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// The structural tag family as JSDoc names it; the union must cover exactly
// these, and the matcher must dispatch every one of them.
const STRUCTURAL_TAGS = [
  "param",
  "returns",
  "throws",
  "template",
  "typeParam",
  "type",
  "typedef",
  "callback",
  "augments",
  "implements",
  "class",
  "enum",
  "async",
  "generator",
  "yields",
];

const isStructural = S.is(StructuralJSDoc);
const structuralTags = R.keys(StructuralJSDoc.cases);
const isJSDocTag = S.is(JSDocTag);
const StructuralArbitrary = Arbitrary.schema(StructuralJSDoc);

describe("StructuralJSDoc", () => {
  it("covers exactly the structural tag family", () => {
    const sortTags = A.sort(Order.String);
    expect(sortTags(structuralTags)).toEqual(sortTags(STRUCTURAL_TAGS));
  });

  // One property per member, so every matcher branch is exercised regardless
  // of how the whole-union arbitrary below happens to distribute its samples.
  for (const tag of structuralTags) {
    it.effect.prop(
      `dispatches schema-derived "${tag}" values through the exhaustive matcher`,
      [Arbitrary.schema(StructuralJSDoc.cases[tag])],
      ([value]) =>
        Effect.gen(function* () {
          expect(value._tag).toBe(tag);
          expect(matchStructuralJSDoc(value)).toBeUndefined();

          return true;
        }),
      { arbitrary: fcRuns(3) }
    );
  }

  it.effect.prop(
    "keeps schema-derived structural tags in both the structural and the full JSDocTag union, and matches them",
    [StructuralArbitrary],
    ([value]) =>
      Effect.gen(function* () {
        expect(isStructural(value)).toBe(true);
        expect(isJSDocTag(value)).toBe(true);
        expect(matchStructuralJSDoc(value)).toBeUndefined();

        return true;
      }),
    { arbitrary: fcRuns(30) }
  );
});

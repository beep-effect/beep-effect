import { AnnotationId } from "@beep/annotation/AnnotationId";
import { contains } from "@beep/annotation/Containment";
import { DocumentKinds, OaKinds } from "@beep/annotation/Kinds";
import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";
import { containmentCase, documentCase } from "./support/generators.ts";
import type { TextDocument } from "@beep/annotation/Kinds";

const runs = { arbitrary: fcRuns(200) };

const within = contains(DocumentKinds);

const expectTransitive = (
  document: TextDocument,
  outer: AnnotationId,
  inner: AnnotationId,
  ids: ReadonlyArray<AnnotationId>
): void => {
  for (const innermost of ids) {
    if (within(document, inner, innermost)) expect(within(document, outer, innermost)).toBe(true);
  }
};

const expectPair = (
  document: TextDocument,
  outer: AnnotationId,
  inner: AnnotationId,
  ids: ReadonlyArray<AnnotationId>
): void => {
  const holds = within(document, outer, inner);
  expect(within(outer, inner)(document)).toBe(holds);
  if (holds) {
    expect(within(document, inner, outer)).toBe(false);
    expectTransitive(document, outer, inner, ids);
  }
};

const expectStrictOrder = (document: TextDocument): void => {
  const ids = document.annotations.pipe(HashMap.keys, A.fromIterable);
  for (const outer of ids) {
    expect(within(document, outer, outer)).toBe(false);
    for (const inner of ids) expectPair(document, outer, inner, ids);
  }
};

describe("@beep/annotation containment", () => {
  it.prop(
    "L2-5 containment is a strict order with a level tie-break on equal spans",
    [documentCase],
    ([{ document }]) => expectStrictOrder(document),
    runs
  );

  it.prop(
    "L2-5 a one-sentence paragraph contains its sentence and a word over a sentence's range does not",
    [containmentCase],
    ([{ document, roles }]) => {
      expectStrictOrder(document);
      const holds = (outer: AnnotationId, inner: AnnotationId) => within(document, outer, inner);
      const strictInclusion = "strict inclusion with a non-decreasing level contains";
      expect(holds(roles.section, roles.sentence), strictInclusion).toBe(true);
      expect(holds(roles.title, roles.word), strictInclusion).toBe(true);
      const equalSpans = "on equal spans the lower level contains and an equal level does not";
      expect(holds(roles.paragraph, roles.sentence), equalSpans).toBe(true);
      expect(holds(roles.sentence, roles.word), equalSpans).toBe(true);
      expect(holds(roles.section, roles.title), equalSpans).toBe(true);
      expect([holds(roles.title, roles.figure), holds(roles.figure, roles.title)], equalSpans).toEqual([false, false]);
      expect(holds(roles.sentence, roles.paragraph), equalSpans).toBe(false);
      expect(
        [holds(roles.wordOverWhole, roles.sentence), holds(roles.sentence, roles.wordOverWhole)],
        "a word whose range includes a sentence does not contain it, and the sentence does not cover the word"
      ).toEqual([false, false]);
      for (const other of [roles.section, roles.paragraph, roles.sentence, roles.word]) {
        for (const outsider of [roles.mention, roles.twoTargets]) {
          expect(
            [holds(other, outsider), holds(outsider, other)],
            "a Mention and a two-target annotation take no part"
          ).toEqual([false, false]);
        }
      }
    },
    runs
  );

  it.prop(
    "L2-5 an absent id or a kind outside the registry takes no part",
    [containmentCase],
    ([{ document, roles }]) => {
      const absent = AnnotationId.make(`sha256:${Str.repeat(64)("0")}`);
      expect([within(document, absent, roles.sentence), within(document, roles.section, absent)]).toEqual([
        false,
        false,
      ]);
      expect(
        contains(OaKinds)(document, roles.section, roles.sentence),
        "the OA kinds hold no Section, so a Section has no level there"
      ).toBe(false);
      expect(contains(OaKinds)(document, roles.paragraph, roles.sentence)).toBe(true);
    },
    runs
  );
});

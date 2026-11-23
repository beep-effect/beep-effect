import { Document, Heading, HeadingLevel, P, Text } from "@beep/md/Md.model";
import { foldMdSections, MdNodeId, MdSection, MdSectionFold, mdNodeId } from "@beep/md/MdSections";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { MdSourceBlock } from "@beep/md/MdSections";

const heading = (level: HeadingLevel, value: string) => Heading.make({ level, children: [Text.make({ value })] });

const fixture = Document.make({
  children: [
    heading(1, "Overview"),
    P.make({ children: [Text.make({ value: "Generic technical notes" })] }),
    heading(3, "Detail"),
    P.make({ children: [Text.make({ value: "Measured observations" })] }),
    heading(2, "Methods"),
    heading(3, "Procedure"),
  ],
});

const flatten = (entries: ReadonlyArray<MdSection | MdSourceBlock>): ReadonlyArray<MdSourceBlock> =>
  A.flatMap(entries, (entry) => (S.is(MdSection)(entry) ? [entry.heading, ...flatten(entry.children)] : [entry]));

describe("@beep/md/MdSections", () => {
  it.effect("folds the malformed fixture into DoCO sections and round-trips the fold", () =>
    Effect.gen(function* () {
      const folded = foldMdSections(fixture);
      expect(S.toEquivalence(MdSectionFold)(folded, foldMdSections(fixture))).toBe(true);
      const nodes = flatten(folded.children);
      expect(A.map(nodes, (source) => source.node)).toEqual(fixture.children);
      expect(A.map(nodes, (source) => source.id)).toEqual(A.map(fixture.children, (_, index) => mdNodeId(index)));
      expect(folded.diagnostics).toMatchObject([
        { _tag: "heading-level-jump", id: "md-v1/b/2", previous: 1, actual: 3 },
      ]);
      expect(A.filter(folded.children, S.is(MdSection))[0]?.type).toBe("http://purl.org/spar/doco/Section");
      const encodedTree = yield* S.encodeEffect(MdSectionFold)(folded);
      const decodedTree = yield* S.decodeEffect(MdSectionFold)(encodedTree);
      expect(S.toEquivalence(MdSectionFold)(folded, decodedTree)).toBe(true);
    })
  );

  it.effect.prop(
    "preserves source order and deterministic ids for arbitrary heading levels",
    [HeadingLevel.pipe(S.Array, Arbitrary.schema)],
    ([levels]) =>
      Effect.sync(() => {
        const document = Document.make({ children: A.map(levels, (level) => heading(level, "Generic heading")) });
        const one = foldMdSections(document);
        const two = foldMdSections(document);
        expect(S.toEquivalence(MdSectionFold)(one, two)).toBe(true);
        expect(A.map(flatten(one.children), (source) => source.node)).toEqual(document.children);
        expect(A.map(flatten(one.children), (source) => source.id)).toEqual(
          A.map(levels, (_, index) => mdNodeId(index))
        );
      })
  );

  it("rejects source paths outside the md-v1 block grammar", () => {
    expect(S.is(MdNodeId)("md-v1/b/2")).toBe(true);
    expect(S.is(MdNodeId)("md-v1/b/-1")).toBe(false);
    expect(S.is(MdNodeId)("md-v1/b/1.5")).toBe(false);
    expect(S.is(MdNodeId)("arbitrary-fragment")).toBe(false);
  });

  it("preserves root preamble and handles an initial jump and repeated titles", () => {
    const preamble = P.make({ children: [] });
    const doc = Document.make({ children: [preamble, heading(3, "Same"), heading(3, "Same")] });
    const result = foldMdSections(doc);
    expect(A.map(flatten(result.children), (source) => source.node)).toEqual(doc.children);
    expect(result.diagnostics).toMatchObject([{ previous: 0, actual: 3 }]);
    expect(A.map(flatten(result.children), (source) => source.id)).toEqual(["md-v1/b/0", "md-v1/b/1", "md-v1/b/2"]);
  });
});

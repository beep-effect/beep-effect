import { Document, Heading, HeadingLevel, P, Text } from "@beep/md/Md.model";
import {
  DOCUMENT_ANNOTATION_CONTEXT,
  DocumentAnnotation,
  DocumentAnnotationBody,
} from "@beep/rdf/Adapters/DocumentAnnotation";
import { foldMdSections, MdNodeId, MdSection, MdSectionFold, mdNodeId } from "@beep/rdf/Adapters/MdSections";
import { CITO_CITES_AS_EVIDENCE } from "@beep/rdf/Vocab/Cito";
import { DEO_INTRODUCTION } from "@beep/rdf/Vocab/Deo";
import { DOCO_TITLE } from "@beep/rdf/Vocab/Doco";
import { FABIO_REPORT } from "@beep/rdf/Vocab/Fabio";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { MdSourceBlock } from "@beep/rdf/Adapters/MdSections";

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

const annotationWire = (id: string) => ({
  "@context": DOCUMENT_ANNOTATION_CONTEXT,
  id: "https://example.org/annotation/1",
  type: "Annotation",
  target: {
    type: "SpecificResource",
    source: "https://example.org/revision/1",
    selector: { type: "FragmentSelector", value: id },
  },
  body: {
    type: [DOCO_TITLE.value, FABIO_REPORT.value],
    discourseType: DEO_INTRODUCTION.value,
    pattern: "block",
    citation: {
      type: "rdf:Statement",
      subject: "https://example.org/revision/1",
      predicate: CITO_CITES_AS_EVIDENCE.value,
      object: "https://example.org/source",
    },
    wasAttributedTo: "https://example.org/agent/1",
    wasGeneratedBy: "https://example.org/activity/1",
  },
});

describe("SPAR document annotation vertical slice", () => {
  it.effect("folds the malformed fixture and round-trips its node-target annotation", () =>
    Effect.gen(function* () {
      const folded = foldMdSections(fixture);
      expect(S.toEquivalence(MdSectionFold)(folded, foldMdSections(fixture))).toBe(true);
      const nodes = flatten(folded.children);
      expect(A.map(nodes, (source) => source.node)).toEqual(fixture.children);
      expect(A.map(nodes, (source) => source.id)).toEqual(A.map(fixture.children, (_, index) => mdNodeId(index)));
      expect(folded.diagnostics).toMatchObject([
        { _tag: "heading-level-jump", id: "md-v1/b/2", previous: 1, actual: 3 },
      ]);
      const annotation = yield* S.decodeUnknownEffect(DocumentAnnotation)(annotationWire(mdNodeId(2)));
      const encoded = yield* S.encodeEffect(DocumentAnnotation)(annotation);
      expect(encoded.type).toBe("Annotation");
      expect(encoded.target.selector.value).toBe(nodes[2]?.id);
      expect(encoded.target.type).toBe("SpecificResource");
      expect(encoded["@context"]?.[0]).toBe("http://www.w3.org/ns/anno.jsonld");
      expect(encoded.body.citation?.predicate).toBe("http://purl.org/spar/cito/citesAsEvidence");
      const decoded = yield* S.decodeEffect(DocumentAnnotation)(encoded);
      expect(S.toEquivalence(DocumentAnnotation)(annotation, decoded)).toBe(true);
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

  it.effect("allows two instance refinements of the same multi-pattern Title", () =>
    Effect.gen(function* () {
      for (const pattern of ["field", "block"]) {
        const body = yield* S.decodeUnknownEffect(DocumentAnnotationBody)({
          type: [DOCO_TITLE.value, FABIO_REPORT.value],
          pattern,
        });
        const encoded = yield* S.encodeEffect(DocumentAnnotationBody)(body);
        expect(encoded.pattern).toBe(pattern);
      }
    })
  );

  it.effect("rejects invalid source paths and uncurated citation predicates", () =>
    Effect.gen(function* () {
      expect(S.is(MdNodeId)("md-v1/b/-1")).toBe(false);
      expect(S.is(MdNodeId)("md-v1/b/1.5")).toBe(false);
      expect(S.is(MdNodeId)("arbitrary-fragment")).toBe(false);
      const wire = annotationWire("arbitrary-fragment");
      const badCitation = annotationWire(mdNodeId(0));
      const rejectedCitation = yield* S.decodeUnknownEffect(DocumentAnnotation)({
        ...badCitation,
        body: {
          ...badCitation.body,
          citation: { ...badCitation.body.citation, predicate: "http://purl.org/spar/cito/unknown" },
        },
      }).pipe(Effect.exit);
      expect(rejectedCitation._tag).toBe("Failure");
      const bad = yield* S.decodeUnknownEffect(DocumentAnnotation)(wire).pipe(Effect.exit);
      expect(bad._tag).toBe("Failure");
    })
  );

  it("preserves root preamble and handles an initial jump and repeated titles", () => {
    const preamble = P.make({ children: [] });
    const doc = Document.make({ children: [preamble, heading(3, "Same"), heading(3, "Same")] });
    const result = foldMdSections(doc);
    expect(A.map(flatten(result.children), (source) => source.node)).toEqual(doc.children);
    expect(result.diagnostics).toMatchObject([{ previous: 0, actual: 3 }]);
    expect(A.map(flatten(result.children), (source) => source.id)).toEqual(["md-v1/b/0", "md-v1/b/1", "md-v1/b/2"]);
  });
});

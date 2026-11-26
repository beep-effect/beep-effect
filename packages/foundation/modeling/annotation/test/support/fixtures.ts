import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument";
import {
  Chunk,
  CorefCandidate,
  DocumentKinds,
  Figure,
  Mention,
  Paragraph,
  RelationCandidate,
  Section,
  Sentence,
  TextDocument,
  Title,
  Word,
} from "@beep/annotation/Kinds";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { anchoredOn, textDigestOf } from "@beep/text/Arbitrary";
import { SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "@beep/text/SourceTextIdentity";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { activityIdOf, annotationIdOf, occurrenceOf, sha256 } from "./generators.ts";
import type * as A from "effect/Array";
import type { AnyAnnotation } from "./generators.ts";

/** The codec of the text document over every declared kind. */
export const codec = makeDocumentCodec({ schema: TextDocument, kinds: DocumentKinds });

/** The fixture text: two sentences, the second after an astral character. */
export const fixtureText = "The examiner rejected claim 1. See 😀 Figure 2.";

/** The fixture capture. */
export const fixtureSource = SourceTextIdentity.make({
  scopeRef: "matter:example",
  sourceRef: "source:office-action",
  locator: SourceTextLocator.make("documents/office-action.txt"),
  sourceDigest: textDigestOf(sha256)("office-action bytes"),
  textDigest: textDigestOf(sha256)(fixtureText),
  extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
  normalizationVersion: "raw/1",
});

const rowOf = (quote: string) => {
  const start = Str.indexOf(quote)(fixtureText).pipe(O.getOrThrow);
  return anchoredOn(fixtureSource, fixtureText, { start, end: start + Str.length(quote) });
};

/** The anchors rows: the whole text, each sentence, two words and the figure reference. */
export const fixtureRows = {
  whole: anchoredOn(fixtureSource, fixtureText, { start: 0, end: Str.length(fixtureText) }),
  first: rowOf("The examiner rejected claim 1."),
  second: rowOf("See 😀 Figure 2."),
  examiner: rowOf("examiner"),
  claim: rowOf("claim 1"),
  figure: rowOf("Figure 2"),
};

const target = (row: keyof typeof fixtureRows) => HashSet.make(occurrenceOf(fixtureRows[row]));

const K = DocumentKinds;

const examiner = K.Mention.case.make({
  targets: target("examiner"),
  body: Mention.make({ class: TermIri.make(iri("semantica:person")) }),
});

const claim = K.Mention.case.make({
  targets: target("claim"),
  body: Mention.make({ class: TermIri.make(iri("office-action:claim")) }),
});

/** The Mention of the examiner and the Mention of the claim. */
export const fixtureMentions = { examiner, claim };

/** One annotation of every declared kind. */
export const fixtureAnnotations: A.NonEmptyReadonlyArray<AnyAnnotation> = [
  K.Section.case.make({ targets: target("whole"), body: Section.make({ depth: 1 }) }),
  K.Paragraph.case.make({ targets: target("whole"), body: Paragraph.make({}) }),
  K.Title.case.make({ targets: target("first"), body: Title.make({}) }),
  K.Sentence.case.make({ targets: target("first"), body: Sentence.make({}) }),
  K.Sentence.case.make({ targets: target("second"), body: Sentence.make({}) }),
  K.Word.case.make({ targets: target("examiner"), body: Word.make({}) }),
  K.Figure.case.make({ targets: target("figure"), body: Figure.make({ label: O.some("Figure 2") }) }),
  K.Chunk.case.make({ targets: target("whole"), body: Chunk.make({ ordinal: 0 }) }),
  examiner,
  claim,
  K.RelationCandidate.case.make({
    targets: target("first"),
    body: RelationCandidate.make({
      subject: annotationIdOf(examiner),
      predicate: TermIri.make(iri("semantica:selected")),
      object: annotationIdOf(claim),
    }),
  }),
  K.CorefCandidate.case.make({
    targets: HashSet.union(examiner.targets, claim.targets),
    body: CorefCandidate.make({ members: HashSet.make(annotationIdOf(examiner), annotationIdOf(claim)) }),
  }),
];

/** The fixture activity and its stated time. */
export const fixtureGeneration = {
  activity: activityIdOf("fixture"),
  at: O.some(DateTime.makeUnsafe(1_763_510_400_000)),
};

/**
 * The parts `assemble` takes for the fixture document over one fixed capture: every declared kind, a relation and a
 * coreference cluster over two Mentions, an astral character before the last word, and one generation per
 * annotation by one activity at one stated time. The committed canonical JSON of the assembled document is
 * `test/fixtures/canonical-document-v1.jcs`.
 */
export const fixtureParts = {
  text: fixtureSource,
  generation: fixtureGeneration,
  anchors: R.values(fixtureRows),
  annotations: fixtureAnnotations,
};

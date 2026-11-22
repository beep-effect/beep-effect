/**
 * The annotation kinds the knowledge stack declares, their registries and the
 * three documents over them.
 *
 * **Details**
 *
 * Extraction kinds (`Mention`, `Chunk`, `RelationCandidate`,
 * `CorefCandidate`) are what an extractor reads; they take no part in
 * containment. Structure kinds (`Section`, `Title`, `Figure`, `Paragraph`)
 * and segmentation kinds (`Sentence`, `Word`) carry a containment level: a
 * lower level contains a higher one. Every kind IRI is a registry term of the
 * `annotation` namespace. {@link ExtractionDocument} and {@link TextDocument}
 * are the caller-owned documents over the extraction kinds and over every
 * kind; {@link OaDocument} holds the five kinds the OA profile carries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { WellFormedText } from "@beep/schema/WellFormedText";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { makeAnnotationDocument } from "./AnnotationDocument.ts";
import { AnnotationId } from "./AnnotationId.ts";
import { defineKind } from "./Kind.ts";

const $I = $AnnotationId.create("Kinds");

const noReferences: (body: unknown) => ReadonlyArray<AnnotationId> = A.empty;

/**
 * Body of a `Mention`: a span read as an instance of a registry class.
 *
 * **Example** (Decode a mention body)
 *
 * ```ts import.meta.vitest name="Decode a mention body"
 * import { Mention } from "@beep/annotation/Kinds"
 * import * as S from "effect/Schema"
 *
 * const claim = "https://beep-effect.com/ns/office-action/claim"
 * S.decodeUnknownSync(Mention)({ class: claim }).class === claim // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Mention extends S.Opaque<Mention, { readonly brand: unique symbol }>()(
  S.Struct({ class: TermIri.annotateKey({ description: "The registry class the mention is read as." }) }).pipe(
    $I.annoteSchema("Mention", { description: "Body of a Mention annotation." })
  )
) {}

/**
 * Body of a `Chunk`: one evidence unit of a chunking pass, ordered within the
 * pass.
 *
 * **Example** (Make a chunk body)
 *
 * ```ts import.meta.vitest name="Make a chunk body"
 * import { Chunk } from "@beep/annotation/Kinds"
 *
 * Chunk.make({ ordinal: 2 }).ordinal // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Chunk extends S.Opaque<Chunk, { readonly brand: unique symbol }>()(
  S.Struct({ ordinal: S.Natural.annotateKey({ description: "The position of the chunk in its pass." }) }).pipe(
    $I.annoteSchema("Chunk", { description: "Body of a Chunk annotation." })
  )
) {}

/**
 * Body of a `RelationCandidate`: a relation an extractor read between two
 * mentions. A candidate, never a claim.
 *
 * **Example** (Read the predicate)
 *
 * ```ts
 * import { RelationCandidate } from "@beep/annotation/Kinds"
 *
 * const predicateOf = (relation: RelationCandidate) => relation.predicate
 * console.log(typeof predicateOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationCandidate extends S.Opaque<RelationCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: AnnotationId.annotateKey({ description: "The Mention annotation in subject position." }),
    predicate: TermIri.annotateKey({ description: "The registry predicate the extractor read." }),
    object: AnnotationId.annotateKey({ description: "The Mention annotation in object position." }),
  }).pipe($I.annoteSchema("RelationCandidate", { description: "Body of a RelationCandidate annotation." }))
) {}

const CorefMembers = CanonicalHashSet(AnnotationId)
  .check(
    S.makeFilter(
      (members: HashSet.HashSet<AnnotationId>) => HashSet.size(members) >= 2,
      $I.annote("CorefMembersAtLeastTwo", {
        title: "Coreference Members",
        description: "A coreference candidate has at least two members.",
        message: "Expected at least two coreference members.",
      })
    )
  )
  .annotateKey({ description: "The Mention annotations proposed as coreferent, encoded ascending." });

/**
 * Body of a `CorefCandidate`: a coreference cluster an extractor proposed over
 * at least two mentions.
 *
 * **Example** (Refuse a one-member cluster)
 *
 * ```ts import.meta.vitest name="Refuse a one-member cluster"
 * import { CorefCandidate } from "@beep/annotation/Kinds"
 * import * as S from "effect/Schema"
 *
 * const one = "sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"
 * S.decodeUnknownOption(CorefCandidate)({ members: [one] })._tag // => "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorefCandidate extends S.Opaque<CorefCandidate, { readonly brand: unique symbol }>()(
  S.Struct({ members: CorefMembers }).pipe(
    $I.annoteSchema("CorefCandidate", { description: "Body of a CorefCandidate annotation." })
  )
) {}

/**
 * Body of a `Section`: a section of document structure with its heading depth,
 * 1 to 6.
 *
 * **Example** (Refuse a seventh depth)
 *
 * ```ts import.meta.vitest name="Refuse a seventh depth"
 * import { Section } from "@beep/annotation/Kinds"
 * import * as S from "effect/Schema"
 *
 * S.is(Section)({ depth: 6 }) // => true
 * S.is(Section)({ depth: 7 }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Section extends S.Opaque<Section, { readonly brand: unique symbol }>()(
  S.Struct({
    depth: S.Int.check(S.isBetween({ minimum: 1, maximum: 6 })).annotateKey({ description: "The heading depth." }),
  }).pipe($I.annoteSchema("Section", { description: "Body of a Section annotation." }))
) {}

/**
 * Body of a `Paragraph`: no fields.
 *
 * **Example** (Make a paragraph body)
 *
 * ```ts import.meta.vitest name="Make a paragraph body"
 * import { Paragraph } from "@beep/annotation/Kinds"
 *
 * Object.keys(Paragraph.make({})).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Paragraph extends S.Opaque<Paragraph, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Paragraph", { description: "Body of a Paragraph annotation." }))
) {}

/**
 * Body of a `Title`: no fields.
 *
 * **Example** (Make a title body)
 *
 * ```ts import.meta.vitest name="Make a title body"
 * import { Title } from "@beep/annotation/Kinds"
 *
 * Object.keys(Title.make({})).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Title extends S.Opaque<Title, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Title", { description: "Body of a Title annotation." }))
) {}

/**
 * Body of a `Figure`, with its printed label when it has one.
 *
 * **Example** (Encode a figure without a label)
 *
 * ```ts import.meta.vitest name="Encode a figure without a label"
 * import { Figure } from "@beep/annotation/Kinds"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * Object.keys(S.encodeSync(Figure)(Figure.make({ label: O.none() }))).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Figure extends S.Opaque<Figure, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.OptionFromOptionalKey(WellFormedText).annotateKey({ description: "The printed figure label." }),
  }).pipe($I.annoteSchema("Figure", { description: "Body of a Figure annotation." }))
) {}

/**
 * Body of a `Sentence`: no fields.
 *
 * **Example** (Make a sentence body)
 *
 * ```ts import.meta.vitest name="Make a sentence body"
 * import { Sentence } from "@beep/annotation/Kinds"
 *
 * Object.keys(Sentence.make({})).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Sentence extends S.Opaque<Sentence, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Sentence", { description: "Body of a Sentence annotation." }))
) {}

/**
 * Body of a `Word`: no fields.
 *
 * **Example** (Make a word body)
 *
 * ```ts import.meta.vitest name="Make a word body"
 * import { Word } from "@beep/annotation/Kinds"
 *
 * Object.keys(Word.make({})).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Word extends S.Opaque<Word, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Word", { description: "Body of a Word annotation." }))
) {}

const MentionKind = defineKind({
  name: "Mention",
  iri: TermIri.make(iri("annotation:Mention")),
  body: Mention,
  references: [],
  referencedIds: noReferences,
});

const TitleKind = defineKind({
  name: "Title",
  iri: TermIri.make(iri("annotation:Title")),
  body: Title,
  references: [],
  referencedIds: noReferences,
  level: 1,
});

const ParagraphKind = defineKind({
  name: "Paragraph",
  iri: TermIri.make(iri("annotation:Paragraph")),
  body: Paragraph,
  references: [],
  referencedIds: noReferences,
  level: 1,
});

const SentenceKind = defineKind({
  name: "Sentence",
  iri: TermIri.make(iri("annotation:Sentence")),
  body: Sentence,
  references: [],
  referencedIds: noReferences,
  level: 2,
});

const WordKind = defineKind({
  name: "Word",
  iri: TermIri.make(iri("annotation:Word")),
  body: Word,
  references: [],
  referencedIds: noReferences,
  level: 3,
});

/**
 * The extraction kinds: `Mention`, `Chunk`, `RelationCandidate` and
 * `CorefCandidate`. A relation references its two Mentions and a coreference
 * cluster its members.
 *
 * **Example** (Read the references of a relation)
 *
 * ```ts import.meta.vitest name="Read the references of a relation"
 * import { ExtractionKinds } from "@beep/annotation/Kinds"
 *
 * ExtractionKinds.RelationCandidate.references // => ["Mention"]
 * ExtractionKinds.Mention.iri // => "https://beep-effect.com/ns/annotation/Mention"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExtractionKinds = {
  Mention: MentionKind,
  Chunk: defineKind({
    name: "Chunk",
    iri: TermIri.make(iri("annotation:Chunk")),
    body: Chunk,
    references: [],
    referencedIds: noReferences,
  }),
  RelationCandidate: defineKind({
    name: "RelationCandidate",
    iri: TermIri.make(iri("annotation:RelationCandidate")),
    body: RelationCandidate,
    references: ["Mention"],
    referencedIds: (body) => [body.subject, body.object],
  }),
  CorefCandidate: defineKind({
    name: "CorefCandidate",
    iri: TermIri.make(iri("annotation:CorefCandidate")),
    body: CorefCandidate,
    references: ["Mention"],
    referencedIds: (body) => body.members,
  }),
};

/**
 * The structure kinds (`Section` at level 0; `Title`, `Figure` and
 * `Paragraph` at level 1) and the segmentation kinds (`Sentence` at 2, `Word`
 * at 3). A lower level contains a higher one.
 *
 * **Example** (Read the levels)
 *
 * ```ts import.meta.vitest name="Read the structure levels"
 * import { StructureKinds } from "@beep/annotation/Kinds"
 * import * as O from "effect/Option"
 *
 * O.getOrThrow(StructureKinds.Section.level) // => 0
 * O.getOrThrow(StructureKinds.Word.level) // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructureKinds = {
  Section: defineKind({
    name: "Section",
    iri: TermIri.make(iri("annotation:Section")),
    body: Section,
    references: [],
    referencedIds: noReferences,
    level: 0,
  }),
  Title: TitleKind,
  Figure: defineKind({
    name: "Figure",
    iri: TermIri.make(iri("annotation:Figure")),
    body: Figure,
    references: [],
    referencedIds: noReferences,
    level: 1,
  }),
  Paragraph: ParagraphKind,
  Sentence: SentenceKind,
  Word: WordKind,
};

/**
 * Every declared kind: the structure, segmentation and extraction kinds.
 *
 * **Example** (Count the kinds)
 *
 * ```ts import.meta.vitest name="Count the document kinds"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 *
 * Object.keys(DocumentKinds).length // => 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentKinds = { ...StructureKinds, ...ExtractionKinds };

/**
 * The five kinds the OA profile carries: `Mention`, `Title`, `Paragraph`,
 * `Sentence` and `Word`. None references another kind.
 *
 * **Example** (List the OA kinds)
 *
 * ```ts import.meta.vitest name="List the OA kinds"
 * import { OaKinds } from "@beep/annotation/Kinds"
 *
 * Object.keys(OaKinds).join(",") // => "Mention,Title,Paragraph,Sentence,Word"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OaKinds = {
  Mention: MentionKind,
  Title: TitleKind,
  Paragraph: ParagraphKind,
  Sentence: SentenceKind,
  Word: WordKind,
};

const ExtractionDocumentParts = makeAnnotationDocument(ExtractionKinds);

/**
 * The annotation document over the extraction kinds, the one the langextract
 * handoff emits.
 *
 * **Details**
 *
 * Every extraction kind is a document kind, so an extraction document widens
 * to a {@link TextDocument} by decoding its type side through it.
 *
 * **Example** (Read the annotation count)
 *
 * ```ts
 * import type { ExtractionDocument } from "@beep/annotation/Kinds"
 * import * as HashMap from "effect/HashMap"
 *
 * const count = (document: ExtractionDocument) => HashMap.size(document.annotations)
 * console.log(typeof count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionDocument extends S.Opaque<ExtractionDocument, { readonly brand: unique symbol }>()(
  S.Struct(ExtractionDocumentParts.fields)
    .check(ExtractionDocumentParts.checks)
    .pipe($I.annoteSchema("ExtractionDocument", { description: "An annotation document over the extraction kinds." }))
) {}

const TextDocumentParts = makeAnnotationDocument(DocumentKinds);

/**
 * The annotation document over every declared kind.
 *
 * **Example** (Read the capture)
 *
 * ```ts
 * import type { TextDocument } from "@beep/annotation/Kinds"
 *
 * const capture = (document: TextDocument) => document.text.textDigest
 * console.log(typeof capture)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextDocument extends S.Opaque<TextDocument, { readonly brand: unique symbol }>()(
  S.Struct(TextDocumentParts.fields)
    .check(TextDocumentParts.checks)
    .pipe($I.annoteSchema("TextDocument", { description: "An annotation document over every declared kind." }))
) {}

const OaDocumentParts = makeAnnotationDocument(OaKinds);

/**
 * The annotation document over the five OA kinds, the one the OA encoder
 * takes.
 *
 * **Example** (Read the anchor count)
 *
 * ```ts
 * import type { OaDocument } from "@beep/annotation/Kinds"
 * import * as HashMap from "effect/HashMap"
 *
 * const anchors = (document: OaDocument) => HashMap.size(document.anchors)
 * console.log(typeof anchors)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OaDocument extends S.Opaque<OaDocument, { readonly brand: unique symbol }>()(
  S.Struct(OaDocumentParts.fields)
    .check(OaDocumentParts.checks)
    .pipe($I.annoteSchema("OaDocument", { description: "An annotation document over the five OA kinds." }))
) {}

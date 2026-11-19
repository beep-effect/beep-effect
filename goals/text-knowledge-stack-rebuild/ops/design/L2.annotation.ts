/**
 * L2 annotation: one standoff annotation model over one text capture, with
 * content separated from run-specific attribution.
 *
 * Target home: `@beep/annotation` (foundation/modeling, created in P3; decision
 * 2026-11-19-p0-rq1-annotation-home-confirmed). Shapes follow decision
 * 2026-11-19-p0-items4-6-9-annotation-document-shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { constFalse, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  ActivityId,
  CanonicalHashSet,
  ContentHash,
  DomainTag,
  Instant,
  mintContentHash,
  sortedMembers,
  WellFormedText,
} from "./L0.digest.ts";
import { TermIri } from "./L0.identity.ts";
import { Anchored, mintOccurrenceId, OccurrenceId } from "./L1.text.ts";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type * as Digest from "effect/crypto/Digest";
import type { Position } from "./L1.text.ts";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L2.annotation");
const sameCapture = S.toEquivalence(SourceTextIdentity);

/** Content id of an annotation: the hash of `annotation/v1`, its sorted targets, its kind IRI and its encoded body. */
export const AnnotationId = ContentHash.pipe(
  S.brand("AnnotationId"),
  $I.annoteSchema("AnnotationId", { description: "Content hash of one annotation; attribution is outside it." })
);

/** Decoded type of {@link AnnotationId}. */
export type AnnotationId = typeof AnnotationId.Type;

/** The run-specific entity a generation produces, a prov:specializationOf the content; its own brand (item 6). */
export const RunEntityId = ContentHash.pipe(
  S.brand("RunEntityId"),
  $I.annoteSchema("RunEntityId", { description: "Hash of (generation/v1, AnnotationId, ActivityId)." })
);

/** Decoded type of {@link RunEntityId}. */
export type RunEntityId = typeof RunEntityId.Type;

/** One generation of one annotation content by one activity; unique per (content, activity) pair. */
export class Generation extends S.Opaque<Generation, { readonly brand: unique symbol }>()(
  S.Struct({
    run: RunEntityId,
    content: AnnotationId,
    activity: ActivityId,
    at: Instant.annotateKey({ description: "Generation time, canonical per (content, activity)." }),
  }).pipe($I.annoteSchema("Generation", { description: "A prov:Generation of a run-specific annotation entity." }))
) {}

/** Target sets: decoded as a `HashSet`, encoded as the sorted member array. */
const Targets = CanonicalHashSet(OccurrenceId)
  .check(
    S.makeFilter(
      (targets: HashSet.HashSet<OccurrenceId>) => !HashSet.isEmpty(targets),
      $I.annote("TargetsNonEmpty", {
        title: "Targets Non-Empty",
        description: "A standoff annotation targets at least one occurrence.",
        message: "Expected at least one target.",
      })
    )
  )
  .annotateKey({
    description: "Occurrences the annotation targets; deduplicated and sorted on every preimage.",
  });

/** A body schema: service-free, so its JSON encoding is a pure function of the value. */
export type KindBody = S.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

/**
 * One annotation kind: its registry term, its body schema, the kinds its body
 * may reference, the annotation ids a body references (decision 2026-11-19-p0-items4-6-9-annotation-document-shape), an optional
 * structural level for the containment tie-break, and its content case.
 */
export interface AnnotationKind<Name extends string, Body extends KindBody, Refs extends string> {
  readonly body: Body;
  readonly case: S.TaggedStruct<Name, { readonly targets: typeof Targets; readonly body: Body }>;
  readonly iri: TermIri;
  readonly level: O.Option<number>;
  readonly name: Name;
  readonly referencedIds: (body: Body["Type"]) => Iterable<AnnotationId>;
  readonly references: ReadonlyArray<Refs>;
}

/** Any annotation kind, the element type of a {@link KindRegistry}. */
export type AnyAnnotationKind = {
  readonly name: string;
  readonly iri: TermIri;
  readonly body: KindBody;
  readonly references: ReadonlyArray<string>;
  readonly level: O.Option<number>;
  referencedIds(body: unknown): Iterable<AnnotationId>;
  readonly case: S.Top;
};

/** A caller-supplied kind registry keyed by kind name. */
export type KindRegistry = { readonly [name: string]: AnyAnnotationKind };

/** Registry well-formedness: each entry's name is its key and every reference names a registered kind. */
export type ClosedKindRegistry<Kinds extends KindRegistry> = {
  readonly [K in keyof Kinds]: { readonly name: K; readonly references: ReadonlyArray<keyof Kinds> };
};

/** Declare one annotation kind; the content case's `_tag` is the kind name and the hash uses the kind IRI. */
export const defineKind = <const Name extends string, Body extends KindBody, const Refs extends string = never>(spec: {
  readonly name: Name;
  readonly iri: TermIri;
  readonly body: Body;
  readonly references: ReadonlyArray<Refs>;
  readonly referencedIds: (body: Body["Type"]) => Iterable<AnnotationId>;
  readonly level?: number;
}): AnnotationKind<Name, Body, Refs> => ({
  name: spec.name,
  iri: spec.iri,
  body: spec.body,
  references: spec.references,
  referencedIds: spec.referencedIds,
  level: O.fromUndefinedOr(spec.level),
  case: S.TaggedStruct(spec.name, { targets: Targets, body: spec.body }),
});

/** The annotation content union a registry produces. */
export type AnnotationOf<Kinds extends KindRegistry> = Kinds[keyof Kinds & string]["case"]["Type"];

/** The structural view every document built by {@link makeAnnotationDocument} satisfies. */
export const AnnotationDocumentView = S.Struct({
  text: SourceTextIdentity,
  anchors: S.HashMap(OccurrenceId, Anchored),
  annotations: S.HashMap(AnnotationId, S.Struct({ _tag: S.String, targets: Targets, body: S.Unknown })),
  attribution: S.HashMap(AnnotationId, S.HashSet(Generation)),
}).pipe($I.annoteSchema("AnnotationDocumentView", { description: "Kind-independent view of an annotation document." }));

/** Decoded type of {@link AnnotationDocumentView}. */
export type AnnotationDocumentView = typeof AnnotationDocumentView.Type;

const everyTargetResolves = (doc: AnnotationDocumentView): boolean =>
  HashMap.every(doc.annotations, (annotation) =>
    HashSet.every(annotation.targets, (target) => HashMap.has(doc.anchors, target))
  );

const everyAnnotationAttributed = (doc: AnnotationDocumentView): boolean =>
  HashMap.every(doc.annotations, (_, id) =>
    O.exists(HashMap.get(doc.attribution, id), (generations) => !HashSet.isEmpty(generations))
  );

const everyAnchorOnCapture = (doc: AnnotationDocumentView): boolean =>
  HashMap.every(doc.anchors, (anchored) => sameCapture(Anchored.source(anchored), doc.text));

const attributionWellKeyed = (doc: AnnotationDocumentView): boolean =>
  HashMap.every(
    doc.attribution,
    (generations, id) =>
      HashMap.has(doc.annotations, id) &&
      HashSet.every(generations, (generation) => Eq.equals(generation.content, id)) &&
      HashSet.size(HashSet.map(generations, (generation) => generation.activity)) === HashSet.size(generations)
  );

/**
 * The pure document checks decision items 4, 6 and 9 assign to the schema:
 * resolution, non-empty attribution and capture equality, plus attribution
 * keying (each generation names its key, one generation per activity).
 * Key-equals-hash checks need the digest service and run in {@link verifyDocument}.
 */
export const AnnotationDocumentChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      everyTargetResolves,
      $I.annote("EveryTargetResolves", {
        title: "Every Target Resolves",
        description: "Every annotation target has a row in the anchors table.",
        message: "Expected every annotation target to resolve in anchors.",
      })
    ),
    S.makeFilter(
      everyAnnotationAttributed,
      $I.annote("EveryAnnotationAttributed", {
        title: "Every Annotation Attributed",
        description: "Every annotation has a non-empty Generation set.",
        message: "Expected non-empty attribution for every annotation.",
      })
    ),
    S.makeFilter(
      everyAnchorOnCapture,
      $I.annote("EveryAnchorOnCapture", {
        title: "Every Anchor On Capture",
        description: "Every anchors row carries a receipt whose source equals the document's text capture.",
        message: "Expected every anchor receipt to name the document's capture.",
      })
    ),
    S.makeFilter(
      attributionWellKeyed,
      $I.annote("AttributionWellKeyed", {
        title: "Attribution Well Keyed",
        description: "Attribution keys are annotations, generations name their key, one generation per activity.",
        message: "Expected attribution keyed by annotation with one generation per (content, activity).",
      })
    ),
  ],
  $I.annote("AnnotationDocumentChecks", { description: "Pure annotation document invariants." })
);

/** Decision 2026-11-19-p0-items4-6-9-annotation-document-shape: every annotation id a body references resolves to an annotation of a kind its kind may reference. */
export const referencesResolve =
  (kinds: KindRegistry) =>
  (doc: AnnotationDocumentView): boolean =>
    HashMap.every(doc.annotations, (annotation) =>
      O.match(R.get(kinds, annotation._tag), {
        onNone: constFalse,
        onSome: (kind) =>
          A.every(A.fromIterable(kind.referencedIds(annotation.body)), (id) =>
            O.exists(HashMap.get(doc.annotations, id), (referenced) => A.contains(kind.references, referenced._tag))
          ),
      })
    );

const referencesResolveCheck = (kinds: KindRegistry) =>
  S.makeFilter(
    referencesResolve(kinds),
    $I.annote("ReferencesResolve", {
      title: "References Resolve",
      description: "Every referenced annotation id resolves to an annotation of an allowed kind in the document.",
      message: "Expected every body reference to resolve to an annotation of an allowed kind.",
    })
  );

// The content cases of a registry, one tagged struct per kind.
const annotationCases = <Kinds extends KindRegistry>(
  kinds: Kinds
): ReadonlyArray<Kinds[keyof Kinds & string]["case"]> => A.map(R.values(kinds), (kind) => kind.case);

/**
 * Schema ingredients for a caller-owned annotation document, the pattern
 * `makeClaimCore` follows: the caller wraps `fields` in its own annotated
 * `S.Opaque` and applies `checks`.
 */
export const makeAnnotationDocument = <const Kinds extends KindRegistry & ClosedKindRegistry<Kinds>>(kinds: Kinds) => {
  const Annotation = S.Union(annotationCases(kinds));
  return {
    Annotation,
    fields: {
      text: SourceTextIdentity,
      anchors: S.HashMap(OccurrenceId, Anchored),
      annotations: S.HashMap(AnnotationId, Annotation),
      attribution: S.HashMap(AnnotationId, S.HashSet(Generation)),
    },
    checks: S.makeFilterGroup(
      [AnnotationDocumentChecks, referencesResolveCheck(kinds)],
      $I.annote("AnnotationDocumentAllChecks", { description: "Kind-independent checks plus reference resolution." })
    ),
  };
};

/** A mention: a span read as an instance of a registry class. */
export class Mention extends S.Opaque<Mention, { readonly brand: unique symbol }>()(
  S.Struct({ class: TermIri.annotateKey({ description: "Registry class the mention is read as." }) }).pipe(
    $I.annoteSchema("Mention", { description: "Body of a Mention annotation." })
  )
) {}

/** A chunk: one evidence unit of a chunking pass, ordered within the pass. */
export class Chunk extends S.Opaque<Chunk, { readonly brand: unique symbol }>()(
  S.Struct({ ordinal: S.Natural.annotateKey({ description: "Position of the chunk in its pass." }) }).pipe(
    $I.annoteSchema("Chunk", { description: "Body of a Chunk annotation." })
  )
) {}

/** A relation the extractor read between two mentions; a candidate, never a claim. */
export class RelationCandidate extends S.Opaque<RelationCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: AnnotationId.annotateKey({ description: "Mention annotation in subject position." }),
    predicate: TermIri.annotateKey({ description: "Registry predicate the extractor read." }),
    object: AnnotationId.annotateKey({ description: "Mention annotation in object position." }),
  }).pipe($I.annoteSchema("RelationCandidate", { description: "Body of a RelationCandidate annotation." }))
) {}

/** A coreference cluster the extractor proposed over at least two mentions. */
export class CorefCandidate extends S.Opaque<CorefCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    members: CanonicalHashSet(AnnotationId)
      .check(
        S.makeFilter(
          (members: HashSet.HashSet<AnnotationId>) => HashSet.size(members) >= 2,
          $I.annote("CorefMembersCheck", {
            title: "Coreference Members",
            description: "A coreference candidate has at least two members.",
            message: "Expected at least two coreference members.",
          })
        )
      )
      .annotateKey({ description: "Mention annotations proposed as coreferent." }),
  }).pipe($I.annoteSchema("CorefCandidate", { description: "Body of a CorefCandidate annotation." }))
) {}

/** The extraction kinds the langextract handoff emits. */
export const ExtractionKinds = {
  Mention: defineKind({
    name: "Mention",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Mention"),
    body: Mention,
    references: [],
    referencedIds: () => A.empty(),
  }),
  Chunk: defineKind({
    name: "Chunk",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Chunk"),
    body: Chunk,
    references: [],
    referencedIds: () => A.empty(),
  }),
  RelationCandidate: defineKind({
    name: "RelationCandidate",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/RelationCandidate"),
    body: RelationCandidate,
    references: ["Mention"],
    referencedIds: (body) => [body.subject, body.object],
  }),
  CorefCandidate: defineKind({
    name: "CorefCandidate",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/CorefCandidate"),
    body: CorefCandidate,
    references: ["Mention"],
    referencedIds: (body) => body.members,
  }),
};

/** A section of document structure, with its heading depth. */
export class Section extends S.Opaque<Section, { readonly brand: unique symbol }>()(
  S.Struct({
    depth: S.Int.check(S.isBetween({ minimum: 1, maximum: 6 })).annotateKey({ description: "Heading depth." }),
  }).pipe($I.annoteSchema("Section", { description: "Body of a Section annotation." }))
) {}

/** A paragraph of document structure. */
export class Paragraph extends S.Opaque<Paragraph, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Paragraph", { description: "Body of a Paragraph annotation." }))
) {}

/** A title of a section or document. */
export class Title extends S.Opaque<Title, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Title", { description: "Body of a Title annotation." }))
) {}

/** A figure, with its printed label when it has one. */
export class Figure extends S.Opaque<Figure, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.OptionFromOptionalKey(WellFormedText).annotateKey({ description: "Printed figure label." }),
  }).pipe($I.annoteSchema("Figure", { description: "Body of a Figure annotation." }))
) {}

/** A sentence of the segmentation layer. */
export class Sentence extends S.Opaque<Sentence, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Sentence", { description: "Body of a Sentence annotation." }))
) {}

/** A word of the segmentation layer. */
export class Word extends S.Opaque<Word, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Word", { description: "Body of a Word annotation." }))
) {}

/**
 * The generic structure (DoCO-bound) and segmentation (NIF-exported) kinds,
 * the only kinds with a containment level (decision 2026-11-19-p0-structure-kinds-carry-containment-levels): lower levels
 * contain higher ones on equal spans, so a one-sentence paragraph contains its
 * sentence.
 */
export const StructureKinds = {
  Section: defineKind({
    name: "Section",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Section"),
    body: Section,
    references: [],
    referencedIds: () => A.empty(),
    level: 0,
  }),
  Title: defineKind({
    name: "Title",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Title"),
    body: Title,
    references: [],
    referencedIds: () => A.empty(),
    level: 1,
  }),
  Figure: defineKind({
    name: "Figure",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Figure"),
    body: Figure,
    references: [],
    referencedIds: () => A.empty(),
    level: 1,
  }),
  Paragraph: defineKind({
    name: "Paragraph",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Paragraph"),
    body: Paragraph,
    references: [],
    referencedIds: () => A.empty(),
    level: 1,
  }),
  Sentence: defineKind({
    name: "Sentence",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Sentence"),
    body: Sentence,
    references: [],
    referencedIds: () => A.empty(),
    level: 2,
  }),
  Word: defineKind({
    name: "Word",
    iri: TermIri.make("https://beep-effect.com/ns/annotation/Word"),
    body: Word,
    references: [],
    referencedIds: () => A.empty(),
    level: 3,
  }),
};

/** Structure, segmentation and extraction kinds together. */
export const DocumentKinds = { ...StructureKinds, ...ExtractionKinds };

const TextDocumentParts = makeAnnotationDocument(DocumentKinds);

/** Example caller-owned document over the structure, segmentation and extraction kinds. */
export class TextDocument extends S.Opaque<TextDocument, { readonly brand: unique symbol }>()(
  S.Struct(TextDocumentParts.fields)
    .check(TextDocumentParts.checks)
    .pipe($I.annoteSchema("TextDocument", { description: "Annotation document over the document kinds." }))
) {}

/** Refusal of a restriction whose kind set is not closed under body references. */
export class RestrictionNotClosed extends S.TaggedError<RestrictionNotClosed, { readonly brand: unique symbol }>(
  $I`RestrictionNotClosed`
)(
  "RestrictionNotClosed",
  { missing: S.HashSet(S.NonEmptyString) },
  $I.annoteError<RestrictionNotClosed>("RestrictionNotClosed", {
    description: "The kinds a restriction must add to be closed under body references.",
  })
) {}

/** Refusal of a merge that would give one (content, activity) pair two generation times. */
export class GenerationTimeConflict extends S.TaggedError<GenerationTimeConflict, { readonly brand: unique symbol }>(
  $I`GenerationTimeConflict`
)(
  "GenerationTimeConflict",
  { annotation: AnnotationId, activity: ActivityId, left: Instant, right: Instant },
  $I.annoteError<GenerationTimeConflict>("GenerationTimeConflict", {
    description: "Two generation records for one (content, activity) pair disagree on time.",
  })
) {}

/** Refusal of a merge over two documents on different text captures. */
export class CaptureMismatch extends S.TaggedError<CaptureMismatch, { readonly brand: unique symbol }>(
  $I`CaptureMismatch`
)(
  "CaptureMismatch",
  { left: SourceTextIdentity, right: SourceTextIdentity },
  $I.annoteError<CaptureMismatch>("CaptureMismatch", {
    description: "Two annotation documents name different text captures.",
  })
) {}

/** Domain tag of the annotation content preimage. */
export const AnnotationDomainTag = DomainTag.make("annotation/v1");

/** Domain tag of the run-entity preimage. */
export const GenerationDomainTag = DomainTag.make("generation/v1");

/** Content to mint an annotation id from: targets as an array (deduplicated and sorted here), kind and body. */
export class AnnotationContent extends S.Opaque<AnnotationContent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: TermIri.annotateKey({ description: "Registry IRI of the annotation kind." }),
    targets: S.NonEmptyArray(OccurrenceId).annotateKey({ description: "Targets in any order, duplicates allowed." }),
    body: S.Unknown.annotateKey({ description: "Body already encoded by the kind's JSON codec." }),
  }).pipe($I.annoteSchema("AnnotationContent", { description: "Input of the annotation content hash." }))
) {}

/** The annotation preimage after the domain tag: sorted unique targets, kind IRI, encoded body (L2-2). */
export const annotationPreimage = (content: AnnotationContent): ReadonlyArray<unknown> => [
  sortedMembers(content.targets),
  content.kind,
  content.body,
];

/** Encode a body through its kind's JSON codec, the form the annotation preimage hashes. */
export const encodeBody = (kind: AnyAnnotationKind) => S.encodeUnknownResult(S.toCodecJson(kind.body));

/** Mint an annotation content id: array in, deduplicate, sort, hash. */
export const mintAnnotationId = Effect.fn("Annotation.mint")(function* (
  content: AnnotationContent
): Effect.fn.Return<AnnotationId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(AnnotationDomainTag, annotationPreimage(content));
  return AnnotationId.make(hash);
});

/** Mint the run-specific entity id of one (content, activity) pair. */
export const mintRunEntityId = Effect.fn("Generation.mintRun")(function* (
  content: AnnotationId,
  activity: ActivityId
): Effect.fn.Return<RunEntityId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(GenerationDomainTag, [content, activity]);
  return RunEntityId.make(hash);
});

/** The kinds a kind set must contain to be closed under body references. */
export const closure =
  (kinds: KindRegistry) =>
  (names: HashSet.HashSet<string>): HashSet.HashSet<string> => {
    const step = HashSet.union(
      names,
      HashSet.fromIterable(
        A.flatMap(A.fromIterable(names), (name) =>
          O.match(R.get(kinds, name), { onNone: A.empty<string>, onSome: (kind) => kind.references })
        )
      )
    );
    return HashSet.size(step) === HashSet.size(names) ? names : closure(kinds)(step);
  };

/**
 * Restrict a document to a closed kind set; refuses with the missing kinds
 * rather than dropping dependents or widening. Anchors and attribution are
 * restricted to what the kept annotations use (L2-4).
 */
export const restrict =
  (kinds: KindRegistry) =>
  (keep: HashSet.HashSet<string>) =>
  <D extends AnnotationDocumentView>(doc: D): Result.Result<D, RestrictionNotClosed> => {
    const missing = HashSet.difference(closure(kinds)(keep), keep);
    if (!HashSet.isEmpty(missing)) {
      return Result.fail(RestrictionNotClosed.make({ missing }));
    }
    const annotations = HashMap.filter(doc.annotations, (annotation) => HashSet.has(keep, annotation._tag));
    const used = HashMap.reduce(annotations, HashSet.empty<OccurrenceId>(), (acc, annotation) =>
      HashSet.union(acc, annotation.targets)
    );
    return Result.succeed({
      ...doc,
      anchors: HashMap.filter(doc.anchors, (_, id) => HashSet.has(used, id)),
      annotations,
      attribution: HashMap.filter(doc.attribution, (_, id) => HashMap.has(annotations, id)),
    });
  };

const conflictIn = (generations: HashSet.HashSet<Generation>): O.Option<GenerationTimeConflict> => {
  const all = A.fromIterable(generations);
  return A.findFirst(all, (left) =>
    pipe(
      A.findFirst(all, (right) => Eq.equals(left.activity, right.activity) && !Eq.equals(left.at, right.at)),
      O.map((right) =>
        GenerationTimeConflict.make({
          annotation: left.content,
          activity: left.activity,
          left: left.at,
          right: right.at,
        })
      )
    )
  );
};

/**
 * Merge two documents over one capture: union of anchors and content maps
 * (content-keyed, so idempotent) and union of attribution sets (L2-1).
 */
export const merge: {
  <D extends AnnotationDocumentView>(that: D): (self: D) => Result.Result<D, CaptureMismatch | GenerationTimeConflict>;
  <D extends AnnotationDocumentView>(self: D, that: D): Result.Result<D, CaptureMismatch | GenerationTimeConflict>;
} = dual(
  2,
  <D extends AnnotationDocumentView>(self: D, that: D): Result.Result<D, CaptureMismatch | GenerationTimeConflict> => {
    if (!sameCapture(self.text, that.text)) {
      return Result.fail(CaptureMismatch.make({ left: self.text, right: that.text }));
    }
    const attribution = that.attribution.pipe(
      HashMap.reduce(self.attribution, (acc, generations, id) =>
        HashMap.set(
          acc,
          id,
          O.match(HashMap.get(acc, id), {
            onNone: () => generations,
            onSome: (existing) => HashSet.union(existing, generations),
          })
        )
      )
    );
    return O.match(attribution.pipe(HashMap.values, A.findFirst(conflictIn)), {
      onSome: Result.fail,
      onNone: () =>
        Result.succeed({
          ...self,
          anchors: HashMap.union(self.anchors, that.anchors),
          annotations: HashMap.union(self.annotations, that.annotations),
          attribution,
        }),
    });
  }
);

const locate = (kinds: KindRegistry, doc: AnnotationDocumentView, id: AnnotationId) =>
  O.flatMap(HashMap.get(doc.annotations, id), (annotation) =>
    HashSet.size(annotation.targets) === 1
      ? annotation.targets.pipe(
          A.fromIterable,
          A.head,
          O.flatMap((target) => HashMap.get(doc.anchors, target)),
          O.map((anchored) => ({
            range: Anchored.range(anchored),
            level: O.flatMap(R.get(kinds, annotation._tag), (kind) => kind.level),
          }))
        )
      : O.none()
  );

type Located = { readonly range: Position; readonly level: O.Option<number> };

const strictlyContains = (outer: Located, inner: Located): boolean => {
  const covers = outer.range.start <= inner.range.start && inner.range.end <= outer.range.end;
  const sameSpan = outer.range.start === inner.range.start && outer.range.end === inner.range.end;
  return O.getOrElse(
    O.zipWith(outer.level, inner.level, (outerLevel, innerLevel) => covers && (!sameSpan || outerLevel < innerLevel)),
    constFalse
  );
};

/**
 * Containment: strict range inclusion, and on equal spans the kind with the
 * lower structural level contains the higher one. Only kinds with a level
 * (structure and segmentation) take part; extraction kinds without a level and
 * multi-target annotations take part in no containment (L2-5).
 */
export const contains = (
  kinds: KindRegistry
): {
  (outer: AnnotationId, inner: AnnotationId): (doc: AnnotationDocumentView) => boolean;
  (doc: AnnotationDocumentView, outer: AnnotationId, inner: AnnotationId): boolean;
} =>
  dual(3, (doc: AnnotationDocumentView, outer: AnnotationId, inner: AnnotationId): boolean =>
    O.getOrElse(O.zipWith(locate(kinds, doc, outer), locate(kinds, doc, inner), strictlyContains), constFalse)
  );

/** Which table a key-equals-hash check failed in. */
export const DocumentTable = LiteralKit(["anchors", "annotations", "attribution"]).pipe(
  $I.annoteSchema("DocumentTable", { description: "A keyed table of an annotation document." })
);

/** Decoded type of {@link DocumentTable}. */
export type DocumentTable = typeof DocumentTable.Type;

/** A stored key that is not the hash of its value. */
export class DocumentKeyMismatch extends S.TaggedError<DocumentKeyMismatch, { readonly brand: unique symbol }>(
  $I`DocumentKeyMismatch`
)(
  "DocumentKeyMismatch",
  { table: DocumentTable, key: ContentHash },
  $I.annoteError<DocumentKeyMismatch>("DocumentKeyMismatch", {
    description: "A document key that does not equal the content hash of its value.",
  })
) {}

const nonEmptyTargets = (targets: HashSet.HashSet<OccurrenceId>): O.Option<A.NonEmptyReadonlyArray<OccurrenceId>> => {
  const values = A.fromIterable(targets);
  return A.isReadonlyArrayNonEmpty(values) ? O.some(values) : O.none();
};

const requireKey = (table: DocumentTable, key: ContentHash) => (minted: ContentHash) =>
  Eq.equals(minted, key) ? Effect.void : Effect.fail(DocumentKeyMismatch.make({ table, key }));

/**
 * The effectful verification every decode path calls: each anchors key is the
 * occurrence hash of its row, each annotation key the content hash of its
 * value, each generation's run the hash of its pair.
 */
export const verifyDocument = (kinds: KindRegistry) =>
  Effect.fn("AnnotationDocument.verify")(function* (
    doc: AnnotationDocumentView
  ): Effect.fn.Return<void, DocumentKeyMismatch | JsoncCanonicalizeError | S.SchemaError, Digest.Digest> {
    yield* Effect.forEach(
      HashMap.toEntries(doc.anchors),
      ([key, anchored]) => Effect.flatMap(mintOccurrenceId(anchored), requireKey("anchors", key)),
      { concurrency: 1, discard: true }
    );
    yield* Effect.forEach(
      HashMap.toEntries(doc.annotations),
      Effect.fnUntraced(function* ([key, annotation]) {
        const kind = yield* Effect.fromOption(R.get(kinds, annotation._tag)).pipe(
          Effect.mapError(() => DocumentKeyMismatch.make({ table: "annotations", key }))
        );
        const body = yield* Effect.fromResult(encodeBody(kind)(annotation.body));
        const targets = yield* annotation.targets.pipe(
          nonEmptyTargets,
          Effect.fromOption,
          Effect.mapError(() => DocumentKeyMismatch.make({ table: "annotations", key }))
        );
        const minted = yield* mintAnnotationId(AnnotationContent.make({ kind: kind.iri, targets, body }));
        return yield* requireKey("annotations", key)(minted);
      }),
      { concurrency: 1, discard: true }
    );
    yield* Effect.forEach(
      A.flatMap(HashMap.toValues(doc.attribution), A.fromIterable),
      (generation) =>
        Effect.flatMap(
          mintRunEntityId(generation.content, generation.activity),
          requireKey("attribution", generation.run)
        ),
      { concurrency: 1, discard: true }
    );
  });

/**
 * The checked decode entrypoint for one document schema: decode JSON through
 * the schema (resolution, attribution, capture equality, body references),
 * then run {@link verifyDocument} before returning (decision 2026-11-19-p0-items4-6-9-annotation-document-shape).
 *
 * **Details**
 *
 * This is the only decode path for wire and storage input. The bare schema
 * stays exported for composition and generators; it accepts a document whose
 * annotation key was replaced, which this entrypoint refuses with a
 * `DocumentKeyMismatch`. The OA decoder is built on it.
 */
export const makeCheckedDecode = <
  Document extends S.Top & { readonly Type: AnnotationDocumentView; readonly DecodingServices: never },
>(config: {
  readonly schema: Document;
  readonly kinds: KindRegistry;
}) => {
  const decode = S.decodeUnknownEffect(S.toCodecJson(config.schema));
  const verify = verifyDocument(config.kinds);
  return Effect.fn("AnnotationDocument.decodeChecked")(function* (input: unknown) {
    const document = yield* decode(input);
    yield* verify(document);
    return document;
  });
};

/** The checked decode entrypoint of {@link TextDocument}. */
export const decodeTextDocument = makeCheckedDecode({ schema: TextDocument, kinds: DocumentKinds });

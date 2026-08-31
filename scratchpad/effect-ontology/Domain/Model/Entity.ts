/**
 * Extracted knowledge-graph entities, relation values, and provenance spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { TextAnchorFields, TextAnchorWidthCheck } from "@beep/provenance/TextAnchor";
import { IRI } from "@beep/rdf";
import type { ProvRecord } from "@beep/rdf/Prov";
import { ObjectRef, Activity as ProvActivity, ProvBundle, Entity as ProvEntity } from "@beep/rdf/Prov";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Hash, pipe, SchemaGetter, Tuple } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { FastCheck } from "effect/testing";
import { ChunkId, DocumentId, GcsUri } from "../Identity.ts";
import { Attributes, EntityId } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/Entity");
const noConfidence: () => O.Option<Confidence> = O.none;

const EvidenceSpanShape = S.Struct({
  ...TextAnchorFields,
  confidence: S.OptionFromOptionalKey(Confidence).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "System confidence in the evidence span when measured.",
    })
  ),
}).pipe(
  $I.annoteSchema("EvidenceSpanShape", {
    description: "Reusable canonical text-anchor fields with optional extraction confidence.",
  })
);

class EvidenceSpanModel extends S.Class<EvidenceSpanModel>($I`EvidenceSpanModel`)(
  EvidenceSpanShape.fields,
  $I.annote("EvidenceSpanModel", {
    description: "Canonical text anchor with optional experiment extraction confidence.",
  })
) {}

const makeEvidenceSpanArbitrary = (fc: typeof FastCheck) =>
  fc
    .tuple(
      fc.nat(100_000),
      fc.string({ minLength: 1, maxLength: 128 }),
      fc.option(S.toArbitrary(Confidence)(fc), { nil: undefined })
    )
    .map(([startChar, quote, confidence]) =>
      EvidenceSpanModel.make({
        quote,
        startChar: NonNegativeInt.make(startChar),
        endChar: NonNegativeInt.make(startChar + quote.length),
        ...(P.isUndefined(confidence) ? {} : { confidence: O.some(confidence) }),
      })
    );

const CanonicalEvidenceSpan = EvidenceSpanModel.check(TextAnchorWidthCheck).annotate({
  toArbitrary: () => makeEvidenceSpanArbitrary,
});

const LegacyEvidenceSpan = S.Struct({
  text: TextAnchorFields.quote,
  startChar: TextAnchorFields.startChar,
  endChar: TextAnchorFields.endChar,
  confidence: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
});
type LegacyEvidenceSpanValue = typeof LegacyEvidenceSpan.Type;
type CanonicalEvidenceSpanEncoded = typeof CanonicalEvidenceSpan.Encoded;

/**
 * Character-level provenance for text supporting an extracted fact.
 *
 * **Details**
 *
 * * Offsets use W3C Web Annotation text-position semantics: `startChar` is
 * inclusive and `endChar` is exclusive.
 *
 * **Example** (Use EvidenceSpan)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EvidenceSpan } from "@effect-ontology/Model/Entity"
 *
 * const span = S.decodeUnknownOption(EvidenceSpan)({
 *   text: "Cristiano Ronaldo",
 *   startChar: 42,
 *   endChar: 59
 * })
 * console.log(O.map(span, (value) => value.endChar)) // Some(59)
 * ```
 *
 * @invariant `0 <= startChar <= endChar`.
 * @see {@link https://www.w3.org/TR/annotation-model/#text-position-selector | Text Position Selector} for related behavior and composition guidance.
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceSpan = LegacyEvidenceSpan.pipe(
  S.decodeTo(CanonicalEvidenceSpan, {
    decode: SchemaGetter.transform(
      (span: LegacyEvidenceSpanValue): CanonicalEvidenceSpanEncoded => ({
        quote: span.text,
        startChar: span.startChar,
        endChar: span.endChar,
        ...(O.isSome(span.confidence) ? { confidence: span.confidence.value } : {}),
      })
    ),
    encode: SchemaGetter.transform(
      (span: CanonicalEvidenceSpanEncoded): LegacyEvidenceSpanValue => ({
        text: span.quote,
        startChar: NonNegativeInt.make(span.startChar),
        endChar: NonNegativeInt.make(span.endChar),
        confidence: O.map(O.fromUndefinedOr(span.confidence), Confidence.make),
      })
    ),
  })
)
  .annotate({
    toArbitrary: () => makeEvidenceSpanArbitrary,
  })
  .pipe(
    $I.annoteSchema("EvidenceSpan", {
      description:
        "Legacy text-field ingress codec decoding to a canonical TextAnchor-backed span with optional confidence.",
    })
  );

/**
 * Runtime value decoded by {@link EvidenceSpan}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceSpan = typeof EvidenceSpan.Type;

const GroundingStatus = LiteralKit(["NotEvaluated", "Supported", "Rejected"]);

class GroundingNotEvaluated extends S.Class<GroundingNotEvaluated>($I`GroundingNotEvaluated`)(
  { status: S.tag(GroundingStatus.Enum.NotEvaluated) },
  $I.annote("GroundingNotEvaluated", {
    description: "Grounding decision was intentionally not evaluated.",
  })
) {}

class GroundingSupported extends S.Class<GroundingSupported>($I`GroundingSupported`)(
  {
    status: S.tag(GroundingStatus.Enum.Supported),
    confidence: Confidence.annotateKey({
      description: "Verifier confidence that the source supports the extracted fact.",
    }),
  },
  $I.annote("GroundingSupported", {
    description: "Source context supports the extracted fact at the recorded confidence.",
  })
) {}

class GroundingRejected extends S.Class<GroundingRejected>($I`GroundingRejected`)(
  {
    status: S.tag(GroundingStatus.Enum.Rejected),
    confidence: Confidence.annotateKey({
      description: "Verifier confidence in rejecting the extracted fact.",
    }),
  },
  $I.annote("GroundingRejected", {
    description: "Source context does not support the extracted fact at the recorded confidence.",
  })
) {}

/**
 * Grounding outcome attached to an extracted entity or relation.
 *
 * **Example** (Construct a supported decision)
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { GroundingDecision } from "@effect-ontology/Model/Entity"
 *
 * const decision = GroundingDecision.cases.Supported.make({ confidence: Confidence.make(0.9) })
 * console.log(decision.status) // "Supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroundingDecision = GroundingStatus.mapMembers(
  Tuple.evolve([() => GroundingNotEvaluated, () => GroundingSupported, () => GroundingRejected])
).pipe(
  $I.annoteSchema("GroundingDecision", {
    description: "Auditable grounding lifecycle for an extracted entity or relation.",
    toArbitrary: () => (fc) =>
      fc.oneof(
        S.toArbitrary(GroundingNotEvaluated)(fc),
        S.toArbitrary(GroundingSupported)(fc),
        S.toArbitrary(GroundingRejected)(fc)
      ),
  }),
  S.toTaggedUnion("status")
);

/**
 * Runtime value decoded by {@link GroundingDecision}.
 *
 * **Example** (Inspect a not-evaluated decision)
 * ```ts
 * import { GroundingDecision } from "@effect-ontology/Model/Entity"
 *
 * const decision = GroundingDecision.cases.NotEvaluated.make({})
 * console.log(decision.status) // "NotEvaluated"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GroundingDecision = typeof GroundingDecision.Type;

const NotEvaluatedGrounding = GroundingDecision.cases.NotEvaluated.make({});

/**
 * Source-grounded observation of one extracted entity occurrence.
 *
 * **Example** (Decode an entity observation)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityObservation } from "@effect-ontology/Model/Entity"
 *
 * const observation = S.decodeUnknownOption(EntityObservation)({
 *   id: "urn:example:observation:entity:ada",
 *   provenance: "urn:example:provenance:entity:ada",
 *   activity: "urn:example:activity:extract",
 *   source: "urn:example:source:document",
 *   evidence: [{ text: "Ada", startChar: 0, endChar: 3 }]
 * })
 * console.log(O.map(observation, (value) => value.evidence[0].quote)) // Some("Ada")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityObservation extends S.Class<EntityObservation>($I`EntityObservation`)(
  {
    id: ObjectRef.annotateKey({ description: "Deterministic identifier of this entity observation." }),
    provenance: ObjectRef.annotateKey({ description: "PROV entity record describing the observed artifact." }),
    activity: ObjectRef.annotateKey({ description: "PROV activity that produced the observation." }),
    source: ObjectRef.annotateKey({ description: "PROV entity used as grounding source context." }),
    evidence: S.NonEmptyArray(EvidenceSpan).annotateKey({
      description: "One or more source-text spans used to identify and ground the entity.",
    }),
    grounding: GroundingDecision.pipe(
      SchemaUtils.withKeyDefaults(NotEvaluatedGrounding),
      S.annotateKey({ description: "Grounding outcome for this occurrence." })
    ),
  },
  $I.annote("EntityObservation", {
    description: "One provenance-linked, evidence-anchored observation of an extracted entity.",
  })
) {}

/**
 * Source-grounded observation of one extracted relation occurrence.
 *
 * **Example** (Decode a relation observation)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RelationObservation } from "@effect-ontology/Model/Entity"
 *
 * const observation = S.decodeUnknownOption(RelationObservation)({
 *   id: "urn:example:observation:relation:knows",
 *   provenance: "urn:example:provenance:relation:knows",
 *   activity: "urn:example:activity:extract",
 *   source: "urn:example:source:document",
 *   evidence: [{ text: "Ada knew Charles", startChar: 0, endChar: 16 }]
 * })
 * console.log(O.map(observation, (value) => value.evidence.length)) // Some(1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationObservation extends S.Class<RelationObservation>($I`RelationObservation`)(
  {
    id: ObjectRef.annotateKey({ description: "Deterministic identifier of this relation observation." }),
    provenance: ObjectRef.annotateKey({ description: "PROV entity record describing the observed relation." }),
    activity: ObjectRef.annotateKey({ description: "PROV activity that produced the observation." }),
    source: ObjectRef.annotateKey({ description: "PROV entity used as grounding source context." }),
    evidence: S.NonEmptyArray(EvidenceSpan).annotateKey({
      description: "One or more source-text spans used to ground the relation.",
    }),
    grounding: GroundingDecision.pipe(
      SchemaUtils.withKeyDefaults(NotEvaluatedGrounding),
      S.annotateKey({ description: "Grounding outcome for this occurrence." })
    ),
  },
  $I.annote("RelationObservation", {
    description: "One provenance-linked, evidence-anchored observation of an extracted relation.",
  })
) {}

/**
 * Constructs the canonical empty provenance bundle used by new graphs.
 *
 * @internal
 */
const emptyProvenance = (): ProvBundle => ProvBundle.make({ records: [] });

/**
 * Builds graph-level PROV records for one extraction activity and its artifacts.
 *
 * **Example** (Create an empty artifact bundle)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ObjectRef } from "@beep/rdf/Prov"
 * import { makeExtractionProvenanceBundle } from "@effect-ontology/Model/Entity"
 *
 * const activity = S.decodeUnknownOption(ObjectRef)("urn:example:activity")
 * const source = S.decodeUnknownOption(ObjectRef)("urn:example:source")
 * const bundle = O.map(O.all({ activity, source }), ({ activity, source }) =>
 *   makeExtractionProvenanceBundle(activity, source, []))
 * console.log(O.map(bundle, (value) => value.records.length)) // Some(2)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeExtractionProvenanceBundle: {
  (activity: ObjectRef, source: ObjectRef, artifacts: ReadonlyArray<ObjectRef>): ProvBundle;
  (source: ObjectRef, artifacts: ReadonlyArray<ObjectRef>): (activity: ObjectRef) => ProvBundle;
} = dual(
  3,
  (activity: ObjectRef, source: ObjectRef, artifacts: ReadonlyArray<ObjectRef>): ProvBundle =>
    ProvBundle.make({
      records: [
        ProvActivity.make({ id: O.some(activity), used: O.some([source]) }),
        ProvEntity.make({ id: O.some(source) }),
        ...A.map(
          artifacts,
          (artifact): ProvRecord =>
            ProvEntity.make({
              id: O.some(artifact),
              wasGeneratedBy: O.some([activity]),
              hadPrimarySource: O.some([source]),
            })
        ),
      ],
    })
);

/**
 * Entity extracted from text and classified by an ontology.
 *
 * **Details**
 *
 * * Provenance absence is represented with `Option`, collections receive
 * schema-level defaults, and ontology types are non-empty. The class remains
 * immutable; enrichment creates a new value through `Entity.make`.
 *
 * **Example** (Use Entity)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Entity } from "@effect-ontology/Model/Entity"
 *
 * const entity = S.decodeUnknownOption(Entity)({
 *   id: "cristiano_ronaldo",
 *   mention: "Cristiano Ronaldo",
 *   types: ["https://schema.org/Person"]
 * })
 *
 * console.log(O.map(entity, (value) => value.types.length)) // 1
 * ```
 *
 * @invariant Every entity has a non-empty mention and at least one ontology type.
 * @category entities
 * @since 0.0.0
 */
export class Entity extends S.Class<Entity>($I`Entity`)(
  {
    id: EntityId.annotateKey({
      description: "Stable snake-case identifier assigned during extraction.",
    }),
    mention: S.NonEmptyString.annotateKey({
      description: "Original non-empty source mention.",
    }),
    types: S.NonEmptyArray(IRI).annotateKey({
      description: "One or more ontology classes instantiated by the entity.",
    }),
    attributes: Attributes.pipe(
      SchemaUtils.withKeyDefaults({}),
      S.annotateKey({
        description: "Ontology property values asserted for the entity.",
      })
    ),
    chunkIndex: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Zero-based source chunk index when available." })
    ),
    chunkId: S.OptionFromOptionalKey(ChunkId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Stable source chunk identifier when available." })
    ),
    documentId: S.OptionFromOptionalKey(DocumentId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Content-derived source document identifier when available." })
    ),
    sourceUri: S.OptionFromOptionalKey(GcsUri).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Canonical source-object URI when available." })
    ),
    extractedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "UTC system instant at which extraction occurred." })
    ),
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "UTC domain instant described by the source when available." })
    ),
    mentions: S.Array(EvidenceSpan).pipe(
      SchemaUtils.withEmptyArrayDefaults<EvidenceSpan>(),
      S.annotateKey({ description: "All source spans supporting this entity." })
    ),
    grounding: GroundingDecision.pipe(
      SchemaUtils.withKeyDefaults(NotEvaluatedGrounding),
      S.annotateKey({ description: "Current aggregate grounding decision for the entity." })
    ),
    observations: S.Array(EntityObservation).pipe(
      SchemaUtils.withEmptyArrayDefaults<EntityObservation>(),
      S.annotateKey({ description: "All evidence-anchored observations retained for this entity." })
    ),
  },
  $I.annote("Entity", {
    description: "Immutable ontology-typed entity with normalized provenance and grounding data.",
  })
) {
  /** Schema-derived entity guard. */
  static readonly is = S.is(Entity);

  /** Non-throwing decoder for untrusted extraction output. */
  static readonly decodeOption = S.decodeUnknownOption(Entity);

  /**
   * Confidence carried by the canonical grounding decision when evaluated.
   *
   * **Example** (Read evaluated grounding confidence)
   * ```ts
   * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
   * import { IRI } from "@beep/rdf"
   * import * as O from "effect/Option"
   * import { Entity, GroundingDecision } from "@effect-ontology/Model/Entity"
   * import { EntityId } from "@effect-ontology/Model/shared"
   *
   * const entity = Entity.make({
   *   id: EntityId.make("ada_lovelace"),
   *   mention: "Ada Lovelace",
   *   types: [IRI.make("https://schema.org/Person")],
   *   grounding: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(0.9) })
   * })
   * console.log(O.getOrNull(entity.groundingConfidence)) // 0.9
   * ```
   *
   * @returns `None` when grounding was not evaluated; otherwise the decision confidence.
   */
  get groundingConfidence(): O.Option<Confidence> {
    return GroundingDecision.match(this.grounding, {
      NotEvaluated: noConfidence,
      Supported: ({ confidence }) => O.some(confidence),
      Rejected: ({ confidence }) => O.some(confidence),
    });
  }
}

/**
 * Canonical nested value carried by the object position of a relation.
 *
 * **Details**
 *
 * * The upstream model guessed whether a string was an entity reference by
 * matching its spelling. This tagged union makes entity references and literal
 * text distinct before business logic sees them.
 *
 * **Example** (Use RelationObject)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RelationObject } from "@effect-ontology/Model/Entity"
 *
 * const object = S.decodeUnknownOption(RelationObject)({
 *   _tag: "EntityReference",
 *   value: "al_nassr_fc"
 * })
 * console.log(O.map(object, (value) => value._tag)) // Some("EntityReference")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RelationObject = S.TaggedUnion({
  EntityReference: { value: EntityId },
  Text: { value: S.String },
  Number: { value: S.Finite },
  Boolean: { value: S.Boolean },
}).pipe(
  $I.annoteSchema("RelationObject", {
    description: "Explicit entity-reference or literal value used in a knowledge-graph relation.",
    toArbitrary: () =>
      S.toArbitrary(
        S.TaggedUnion({
          EntityReference: { value: EntityId },
          Text: { value: S.String },
          Number: { value: S.Finite },
          Boolean: { value: S.Boolean },
        })
      ),
  })
);

/**
 * Runtime value decoded by {@link RelationObject}.
 *
 * **Example** (Use RelationObject)
 * ```ts
 * import type { RelationObject } from "@effect-ontology/Model/Entity"
 *
 * const literal: RelationObject = { _tag: "Boolean", value: true }
 * console.log(literal.value) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RelationObject = typeof RelationObject.Type;

/**
 * Ontology relation between an extracted subject and a typed object value.
 *
 * **Example** (Use Relation)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Relation } from "@effect-ontology/Model/Entity"
 *
 * const relation = S.decodeUnknownOption(Relation)({
 *   subjectId: "cristiano_ronaldo",
 *   predicate: "https://schema.org/memberOf",
 *   object: { _tag: "EntityReference", value: "al_nassr_fc" }
 * })
 *
 * console.log(O.map(relation, (value) => value.isEntityReference)) // Some(true)
 * ```
 *
 * @invariant Entity references are explicitly tagged and cannot be confused
 * with text literals.
 * @category models
 * @since 0.0.0
 */
export class Relation extends S.Class<Relation>($I`Relation`)(
  {
    subjectId: EntityId.annotateKey({
      description: "Entity identifier in the subject position.",
    }),
    predicate: IRI.annotateKey({
      description: "Ontology property IRI in the predicate position.",
    }),
    object: RelationObject.annotateKey({
      description: "Explicit entity reference or literal object value.",
    }),
    evidence: S.OptionFromOptionalKey(EvidenceSpan).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Source span supporting the relation when available." })
    ),
    grounding: GroundingDecision.pipe(
      SchemaUtils.withKeyDefaults(NotEvaluatedGrounding),
      S.annotateKey({ description: "Current aggregate grounding decision for the relation." })
    ),
    observations: S.Array(RelationObservation).pipe(
      SchemaUtils.withEmptyArrayDefaults<RelationObservation>(),
      S.annotateKey({ description: "All evidence-anchored observations retained for this relation." })
    ),
  },
  $I.annote("Relation", {
    description: "Immutable ontology relation with an explicitly classified object value.",
  })
) {
  /**
   * Whether the object is an explicit entity reference.
   *
   * **Example** (Use Entity)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { Relation } from "@effect-ontology/Model/Entity"
   *
   * const relation = S.decodeUnknownOption(Relation)({
   *   subjectId: "alice",
   *   predicate: "https://schema.org/knows",
   *   object: { _tag: "EntityReference", value: "bob" }
   * })
   * console.log(O.map(relation, (value) => value.isEntityReference)) // Some(true)
   * ```
   *
   * @returns `true` only for the `EntityReference` object variant.
   */
  get isEntityReference(): boolean {
    return RelationObject.guards.EntityReference(this.object);
  }

  /**
   * Structural equality over the RDF-like subject-predicate-object signature.
   *
   * **Example** (Use return)
   *
   * ```ts
   * import { Equal } from "effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { Relation } from "@effect-ontology/Model/Entity"
   *
   * const relation = S.decodeUnknownOption(Relation)({
   *   subjectId: "alice",
   *   predicate: "https://schema.org/knows",
   *   object: { _tag: "EntityReference", value: "bob" }
   * })
   * console.log(O.map(relation, (value) => Equal.equals(value, value))) // Some(true)
   * ```
   *
   * @param that - Relation to compare with this value.
   * @returns `true` when subject, predicate, and object are structurally equal.
   */
  [Eq.symbol](that: Relation): boolean {
    return (
      Eq.equals(this.subjectId, that.subjectId) &&
      Eq.equals(this.predicate, that.predicate) &&
      Eq.equals(this.object, that.object)
    );
  }

  /**
   * Structural hash over the RDF-like subject-predicate-object signature.
   *
   * **Example** (Inspect an empty graph)
   *
   * ```ts
   * import { Hash } from "effect"
   * import { N } from "@beep/utils"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { Relation } from "@effect-ontology/Model/Entity"
   *
   * const relation = S.decodeUnknownOption(Relation)({
   *   subjectId: "alice",
   *   predicate: "https://schema.org/knows",
   *   object: { _tag: "EntityReference", value: "bob" }
   * })
   * console.log(O.map(relation, (value) => N.isInteger(Hash.hash(value)))) // Some(true)
   * ```
   *
   * @returns A deterministic hash consistent with relation equality.
   */
  [Hash.symbol](): number {
    return pipe(
      Hash.hash(this.subjectId),
      Hash.combine(Hash.hash(this.predicate)),
      Hash.combine(Hash.hash(this.object))
    );
  }
}

/**
 * Complete entity-and-relation extraction result.
 *
 * **Example** (Use KnowledgeGraph)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { Entity, KnowledgeGraph } from "@effect-ontology/Model/Entity"
 *
 * const entity = S.decodeUnknownOption(Entity)({
 *   id: "alice",
 *   mention: "Alice",
 *   types: ["https://schema.org/Person"]
 * })
 * const graph = O.map(entity, (value) => KnowledgeGraph.make({ entities: [value] }))
 * const aliceId = S.decodeUnknownOption(EntityId)("alice")
 *
 * console.log(O.isSome(O.flatMap(O.all({ graph, aliceId }), ({ graph, aliceId }) => graph.getEntity(aliceId)))) // true
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class KnowledgeGraph extends S.Class<KnowledgeGraph>($I`KnowledgeGraph`)(
  {
    entities: S.Array(Entity).pipe(
      SchemaUtils.withEmptyArrayDefaults<Entity>(),
      S.annotateKey({ description: "All extracted entities." })
    ),
    relations: S.Array(Relation).pipe(
      SchemaUtils.withEmptyArrayDefaults<Relation>(),
      S.annotateKey({ description: "All extracted ontology relations." })
    ),
    sourceText: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Original source text when retained for provenance." })
    ),
    provenance: ProvBundle.pipe(
      SchemaUtils.withKeyDefaults(emptyProvenance()),
      S.annotateKey({ description: "Canonical PROV records retained for graph-level audit." })
    ),
    entityObservations: S.Array(EntityObservation).pipe(
      SchemaUtils.withEmptyArrayDefaults<EntityObservation>(),
      S.annotateKey({ description: "Entity observations retained even when policy excludes their facts." })
    ),
    relationObservations: S.Array(RelationObservation).pipe(
      SchemaUtils.withEmptyArrayDefaults<RelationObservation>(),
      S.annotateKey({ description: "Relation observations retained even when policy excludes their facts." })
    ),
  },
  $I.annote("KnowledgeGraph", {
    description: "Immutable extraction aggregate containing ontology-typed entities and relations.",
  })
) {
  /**
   * Finds an entity by stable identifier.
   *
   * **Example** (Use getEntity)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EntityId } from "@effect-ontology/Model/shared"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   *
   * const graph = KnowledgeGraph.make({})
   * const id = S.decodeUnknownOption(EntityId)("alice")
   * console.log(O.exists(id, (value) => O.isNone(graph.getEntity(value)))) // true
   * ```
   *
   * @param id - Stable entity identifier to locate.
   * @returns The matching entity, or `Option.none()` when it is absent.
   */
  getEntity(id: EntityId): O.Option<Entity> {
    return A.findFirst(this.entities, (entity) => EntityId.equivalence(entity.id, id));
  }

  /**
   * Returns all relations whose subject is the requested entity.
   *
   * **Example** (Use getRelationsFrom)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EntityId } from "@effect-ontology/Model/shared"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   *
   * const graph = KnowledgeGraph.make({})
   * const id = S.decodeUnknownOption(EntityId)("alice")
   * console.log(O.map(id, (value) => graph.getRelationsFrom(value))) // Some([])
   * ```
   *
   * @param subjectId - Stable identifier of the relation subject.
   * @returns Relations whose subject equals `subjectId`, preserving graph order.
   */
  getRelationsFrom(subjectId: EntityId): ReadonlyArray<Relation> {
    return A.filter(this.relations, (relation) => EntityId.equivalence(relation.subjectId, subjectId));
  }

  /**
   * Returns relations whose object explicitly references one entity.
   *
   * **Example** (Use getRelationsTo)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EntityId } from "@effect-ontology/Model/shared"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   *
   * const graph = KnowledgeGraph.make({})
   * const id = S.decodeUnknownOption(EntityId)("alice")
   * console.log(O.map(id, (value) => graph.getRelationsTo(value))) // Some([])
   * ```
   *
   * @param entityId - Stable identifier of the referenced entity.
   * @returns Entity-reference relations targeting `entityId`, preserving graph order.
   */
  getRelationsTo(entityId: EntityId): ReadonlyArray<Relation> {
    return A.filter(
      this.relations,
      (relation) =>
        RelationObject.guards.EntityReference(relation.object) && EntityId.equivalence(relation.object.value, entityId)
    );
  }
}

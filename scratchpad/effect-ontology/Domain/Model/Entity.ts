/**
 * Extracted knowledge-graph entities, relation values, and provenance spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Equal, Hash, pipe } from "effect";
import * as A from "effect/Array";
import type * as O from "effect/Option";
import * as S from "effect/Schema";
import type { FastCheck } from "effect/testing";
import { ChunkId, DocumentId, GcsUri } from "../Identity.ts";
import { Attributes, Confidence, EntityId, IRI } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/Entity");

const EvidenceSpanFields = {
  text: S.NonEmptyString.annotateKey({
    description: "Exact text quoted from the source.",
  }),
  startChar: NonNegativeInt.annotateKey({
    description: "Zero-based inclusive character offset.",
  }),
  endChar: NonNegativeInt.annotateKey({
    description: "Zero-based exclusive character offset.",
  }),
  confidence: S.OptionFromOptionalKey(Confidence).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "System confidence in the evidence span when measured.",
    })
  ),
} as const;

class EvidenceSpanFieldsModel extends S.Class<EvidenceSpanFieldsModel>($I`EvidenceSpanFieldsModel`)(
  EvidenceSpanFields,
  $I.annote("EvidenceSpanFieldsModel", {
    description: "Internal field model for a character-level provenance span.",
  })
) {}

const makeEvidenceSpanArbitrary = (fc: typeof FastCheck) =>
  fc
    .record({
      text: fc.string({ minLength: 1, maxLength: 128 }),
      startChar: fc.integer({ min: 0, max: 100_000 }),
      width: fc.integer({ min: 0, max: 10_000 }),
    })
    .map(({ text, startChar, width }) =>
      EvidenceSpanFieldsModel.make({
        text,
        startChar: NonNegativeInt.make(startChar),
        endChar: NonNegativeInt.make(startChar + width),
      })
    );

const EvidenceSpanDefinition = EvidenceSpanFieldsModel.check(
  S.makeFilter(
    (span: EvidenceSpanFieldsModel) =>
      span.endChar >= span.startChar
        ? undefined
        : {
            path: ["endChar"],
            issue: "endChar must be greater than or equal to startChar.",
          },
    {
      identifier: $I`EvidenceSpanOffsetOrderCheck`,
      title: "Evidence Span Offset Order",
      description: "A character span whose exclusive end offset does not precede its start offset.",
      message: "Evidence span end offset must be greater than or equal to its start offset.",
      arbitrary: {
        candidate: {
          make: makeEvidenceSpanArbitrary,
        },
      },
    }
  )
);

/**
 * Character-level provenance for text supporting an extracted fact.
 *
 * @remarks
 * Offsets use W3C Web Annotation text-position semantics: `startChar` is
 * inclusive and `endChar` is exclusive.
 *
 * @example
 * ```ts
 * import { EvidenceSpan } from "@effect-ontology/Model/Entity.ts"
 *
 * const span = EvidenceSpan.fromUnknown({
 *   text: "Cristiano Ronaldo",
 *   startChar: 42,
 *   endChar: 59
 * })
 * console.log(span.endChar) // 59
 * ```
 *
 * @invariant `0 <= startChar <= endChar`.
 * @see {@link https://www.w3.org/TR/annotation-model/#text-position-selector | Text Position Selector}
 * @category value-objects
 * @since 0.0.0
 */
export const EvidenceSpan = EvidenceSpanDefinition.annotate({
  toArbitrary: () => makeEvidenceSpanArbitrary,
}).pipe(
  $I.annoteSchema("EvidenceSpan", {
    description: "Ordered character-level provenance span with optional system confidence.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link EvidenceSpan}.
 *
 * @example
 * ```ts
 * import type { EvidenceSpan } from "@effect-ontology/Model/Entity.ts"
 *
 * const length = (span: EvidenceSpan): number => span.endChar - span.startChar
 * console.log(typeof length) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceSpan = typeof EvidenceSpan.Type;

const EntityFields = {
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
  groundingConfidence: S.OptionFromOptionalKey(Confidence).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "System-measured source-grounding confidence." })
  ),
} as const;

/**
 * Entity extracted from text and classified by an ontology.
 *
 * @remarks
 * Provenance absence is represented with `Option`, collections receive
 * schema-level defaults, and ontology types are non-empty. The class remains
 * immutable; enrichment creates a new value through `Entity.make`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Entity } from "@effect-ontology/Model/Entity.ts"
 *
 * const entity = S.decodeUnknownSync(Entity)({
 *   id: "cristiano_ronaldo",
 *   mention: "Cristiano Ronaldo",
 *   types: ["https://schema.org/Person"]
 * })
 *
 * console.log(entity.types.length) // 1
 * ```
 *
 * @invariant Every entity has a non-empty mention and at least one ontology type.
 * @category entities
 * @since 0.0.0
 */
export class Entity extends S.Class<Entity>($I`Entity`)(
  EntityFields,
  $I.annote("Entity", {
    description: "Immutable ontology-typed entity with normalized provenance and grounding data.",
  })
) {
  /** Schema-derived entity guard. */
  static readonly is = S.is(Entity);

  /** Non-throwing decoder for untrusted extraction output. */
  static readonly decodeOption = S.decodeUnknownOption(Entity);
}

/**
 * Canonical nested value carried by the object position of a relation.
 *
 * @remarks
 * The upstream model guessed whether a string was an entity reference by
 * matching its spelling. This tagged union makes entity references and literal
 * text distinct before business logic sees them.
 *
 * @example
 * ```ts
 * import { EntityId } from "@effect-ontology/Model/shared.ts"
 * import { RelationObject } from "@effect-ontology/Model/Entity.ts"
 *
 * const object = RelationObject.cases.EntityReference.make({
 *   value: EntityId.fromUnknown("al_nassr_fc")
 * })
 * console.log(object._tag) // "EntityReference"
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
 * @example
 * ```ts
 * import type { RelationObject } from "@effect-ontology/Model/Entity.ts"
 *
 * const literal: RelationObject = { _tag: "Boolean", value: true }
 * console.log(literal.value) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RelationObject = typeof RelationObject.Type;

const RelationFields = {
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
} as const;

/**
 * Ontology relation between an extracted subject and a typed object value.
 *
 * @example
 * ```ts
 * import { EntityId, IRI } from "@effect-ontology/Model/shared.ts"
 * import { Relation, RelationObject } from "@effect-ontology/Model/Entity.ts"
 *
 * const relation = Relation.make({
 *   subjectId: EntityId.fromUnknown("cristiano_ronaldo"),
 *   predicate: IRI.fromUnknown("https://schema.org/memberOf"),
 *   object: RelationObject.cases.EntityReference.make({
 *     value: EntityId.fromUnknown("al_nassr_fc")
 *   })
 * })
 *
 * console.log(relation.isEntityReference) // true
 * ```
 *
 * @invariant Entity references are explicitly tagged and cannot be confused
 * with text literals.
 * @category models
 * @since 0.0.0
 */
export class Relation extends S.Class<Relation>($I`Relation`)(
  RelationFields,
  $I.annote("Relation", {
    description: "Immutable ontology relation with an explicitly classified object value.",
  })
) {
  /**
   * Whether the object is an explicit entity reference.
   *
   * @example
   * ```ts
   * import { EntityId, IRI } from "@effect-ontology/Model/shared.ts"
   * import { Relation, RelationObject } from "@effect-ontology/Model/Entity.ts"
   *
   * const relation = Relation.make({
   *   subjectId: EntityId.fromUnknown("alice"),
   *   predicate: IRI.fromUnknown("https://schema.org/knows"),
   *   object: RelationObject.cases.EntityReference.make({
   *     value: EntityId.fromUnknown("bob")
   *   })
   * })
   * console.log(relation.isEntityReference) // true
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
   * @param that - Relation to compare with this value.
   * @returns `true` when subject, predicate, and object are structurally equal.
   *
   * @example
   * ```ts
   * import { Equal } from "effect"
   * import { EntityId, IRI } from "@effect-ontology/Model/shared.ts"
   * import { Relation, RelationObject } from "@effect-ontology/Model/Entity.ts"
   *
   * const relation = Relation.make({
   *   subjectId: EntityId.fromUnknown("alice"),
   *   predicate: IRI.fromUnknown("https://schema.org/knows"),
   *   object: RelationObject.cases.EntityReference.make({
   *     value: EntityId.fromUnknown("bob")
   *   })
   * })
   * console.log(Equal.equals(relation, relation)) // true
   * ```
   */
  [Equal.symbol](that: Relation): boolean {
    return (
      Equal.equals(this.subjectId, that.subjectId) &&
      Equal.equals(this.predicate, that.predicate) &&
      Equal.equals(this.object, that.object)
    );
  }

  /**
   * Structural hash over the RDF-like subject-predicate-object signature.
   *
   * @returns A deterministic hash consistent with relation equality.
   *
   * @example
   * ```ts
   * import { Hash } from "effect"
   * import { EntityId, IRI } from "@effect-ontology/Model/shared.ts"
   * import { Relation, RelationObject } from "@effect-ontology/Model/Entity.ts"
   *
   * const relation = Relation.make({
   *   subjectId: EntityId.fromUnknown("alice"),
   *   predicate: IRI.fromUnknown("https://schema.org/knows"),
   *   object: RelationObject.cases.EntityReference.make({
   *     value: EntityId.fromUnknown("bob")
   *   })
   * })
   * console.log(Number.isInteger(Hash.hash(relation))) // true
   * ```
   */
  [Hash.symbol](): number {
    return pipe(
      Hash.hash(this.subjectId),
      Hash.combine(Hash.hash(this.predicate)),
      Hash.combine(Hash.hash(this.object))
    );
  }
}

const KnowledgeGraphFields = {
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
} as const;

/**
 * Complete entity-and-relation extraction result.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityId } from "@effect-ontology/Model/shared.ts"
 * import { Entity, KnowledgeGraph } from "@effect-ontology/Model/Entity.ts"
 *
 * const entity = S.decodeUnknownSync(Entity)({
 *   id: "alice",
 *   mention: "Alice",
 *   types: ["https://schema.org/Person"]
 * })
 * const graph = KnowledgeGraph.make({ entities: [entity] })
 *
 * console.log(O.isSome(graph.getEntity(EntityId.fromUnknown("alice")))) // true
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class KnowledgeGraph extends S.Class<KnowledgeGraph>($I`KnowledgeGraph`)(
  KnowledgeGraphFields,
  $I.annote("KnowledgeGraph", {
    description: "Immutable extraction aggregate containing ontology-typed entities and relations.",
  })
) {
  /**
   * Finds an entity by stable identifier.
   *
   * @param id - Stable entity identifier to locate.
   * @returns The matching entity, or `Option.none()` when it is absent.
   *
   * @example
   * ```ts
   * import * as O from "effect/Option"
   * import { EntityId } from "@effect-ontology/Model/shared.ts"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity.ts"
   *
   * const graph = KnowledgeGraph.make({})
   * console.log(O.isNone(graph.getEntity(EntityId.fromUnknown("alice")))) // true
   * ```
   */
  getEntity(id: EntityId): O.Option<Entity> {
    return A.findFirst(this.entities, (entity) => EntityId.equivalence(entity.id, id));
  }

  /**
   * Returns all relations whose subject is the requested entity.
   *
   * @param subjectId - Stable identifier of the relation subject.
   * @returns Relations whose subject equals `subjectId`, preserving graph order.
   *
   * @example
   * ```ts
   * import { EntityId } from "@effect-ontology/Model/shared.ts"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity.ts"
   *
   * const graph = KnowledgeGraph.make({})
   * console.log(graph.getRelationsFrom(EntityId.fromUnknown("alice"))) // []
   * ```
   */
  getRelationsFrom(subjectId: EntityId): ReadonlyArray<Relation> {
    return A.filter(this.relations, (relation) => EntityId.equivalence(relation.subjectId, subjectId));
  }

  /**
   * Returns relations whose object explicitly references one entity.
   *
   * @param entityId - Stable identifier of the referenced entity.
   * @returns Entity-reference relations targeting `entityId`, preserving graph order.
   *
   * @example
   * ```ts
   * import { EntityId } from "@effect-ontology/Model/shared.ts"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity.ts"
   *
   * const graph = KnowledgeGraph.make({})
   * console.log(graph.getRelationsTo(EntityId.fromUnknown("alice"))) // []
   * ```
   */
  getRelationsTo(entityId: EntityId): ReadonlyArray<Relation> {
    return A.filter(
      this.relations,
      (relation) =>
        RelationObject.guards.EntityReference(relation.object) && EntityId.equivalence(relation.object.value, entityId)
    );
  }
}

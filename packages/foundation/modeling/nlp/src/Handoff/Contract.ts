/**
 * Handoff/Contract - the product-neutral generic graph IR handoff contract.
 *
 * The versioned, documented schema that `@beep/nlp` emits for downstream
 * consumers (e.g. the `ip-law-knowledge-graph` initiative) to decode. It is a
 * generic text-annotation IR — {@link TextChunk}s carved from a document, the
 * {@link Mention}s/{@link Entity}s/{@link Relation}s extracted from them, each
 * carrying a character {@link Span} and PROV-O-aligned {@link Provenance} — with
 * NO product vocabulary. The generic `Entity.type`/`Relation.type`
 * discriminants are what a downstream mapping turns into concrete
 * knowledge-graph node/edge types.
 *
 * Schema-first per repo law: every type is an `S.Class` with an `$NlpId`
 * identifier + annotation; identifiers are branded (`S.brand`) for construction
 * safety but encode to plain strings for serialization-clean cross-references.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { dual } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $NlpId.create("Handoff/Contract");

/**
 * Stable identifier for a {@link TextChunk}.
 *
 * **Example** (Make ChunkId value)
 *
 * ```ts
 * import { ChunkId } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(ChunkId.make("chunk-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ChunkId = S.String.pipe(
  S.brand("ChunkId"),
  $I.annoteSchema("ChunkId", { description: "Stable identifier for a text chunk in the handoff IR." })
);

/**
 * Runtime type of {@link ChunkId}.
 *
 * **Example** (Type a ChunkId)
 *
 * ```ts
 * import { ChunkId } from "@beep/nlp/Handoff/Contract"
 *
 * const id: ChunkId = ChunkId.make("chunk-1")
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ChunkId = typeof ChunkId.Type;

/**
 * Stable identifier for a {@link Mention}.
 *
 * **Example** (Make MentionId value)
 *
 * ```ts
 * import { MentionId } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(MentionId.make("mention-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MentionId = S.String.pipe(
  S.brand("MentionId"),
  $I.annoteSchema("MentionId", { description: "Stable identifier for a surface mention in the handoff IR." })
);

/**
 * Runtime type of {@link MentionId}.
 *
 * **Example** (Type a MentionId)
 *
 * ```ts
 * import { MentionId } from "@beep/nlp/Handoff/Contract"
 *
 * const id: MentionId = MentionId.make("mention-1")
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MentionId = typeof MentionId.Type;

/**
 * Stable identifier for an {@link Entity}.
 *
 * **Example** (Make EntityId value)
 *
 * ```ts
 * import { EntityId } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(EntityId.make("entity-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EntityId = S.String.pipe(
  S.brand("EntityId"),
  $I.annoteSchema("EntityId", { description: "Stable identifier for an entity in the handoff IR." })
);

/**
 * Runtime type of {@link EntityId}.
 *
 * **Example** (Type an EntityId)
 *
 * ```ts
 * import { EntityId } from "@beep/nlp/Handoff/Contract"
 *
 * const id: EntityId = EntityId.make("entity-1")
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type EntityId = typeof EntityId.Type;

/**
 * Stable identifier for a {@link Relation}.
 *
 * **Example** (Make RelationId value)
 *
 * ```ts
 * import { RelationId } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(RelationId.make("relation-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RelationId = S.String.pipe(
  S.brand("RelationId"),
  $I.annoteSchema("RelationId", { description: "Stable identifier for a relation in the handoff IR." })
);

/**
 * Runtime type of {@link RelationId}.
 *
 * **Example** (Type a RelationId)
 *
 * ```ts
 * import { RelationId } from "@beep/nlp/Handoff/Contract"
 *
 * const id: RelationId = RelationId.make("relation-1")
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RelationId = typeof RelationId.Type;

/**
 * Closed vocabulary of {@link TextChunk} granularities.
 *
 * **Example** (Check sentence kind)
 *
 * ```ts import.meta.vitest name="Check sentence kind"
 * import { ChunkKind } from "@beep/nlp/Handoff/Contract"
 *
 * ChunkKind.is.sentence("sentence") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChunkKind = LiteralKit(["document", "paragraph", "sentence", "token"]).annotate(
  $I.annote("ChunkKind", { description: "Granularity of a text chunk (document/paragraph/sentence/token)." })
);

/**
 * Runtime TypeScript union decoded by {@link ChunkKind}.
 *
 * **Example** (Assign ChunkKind union)
 *
 * ```ts
 * import type { ChunkKind } from "@beep/nlp/Handoff/Contract"
 *
 * const kind: ChunkKind = "sentence"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChunkKind = typeof ChunkKind.Type;

class SpanFields extends S.Class<SpanFields>($I`SpanFields`)(
  {
    end: NonNegativeInt,
    start: NonNegativeInt,
  },
  $I.annote("SpanFields", {
    description: "Internal half-open character span fields with branded non-negative offsets.",
  })
) {}

/**
 * A half-open character span `[start, end)` into the source text.
 *
 * **Example** (Make half-open span)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { Span } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(Span.make({ start: NonNegativeInt.make(0), end: NonNegativeInt.make(5) }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Span = SpanFields.check(
  S.makeFilter((span: { readonly end: number; readonly start: number }) =>
    span.start <= span.end
      ? undefined
      : {
          path: ["end"],
          issue: "Span end must be greater than or equal to start",
        }
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.tuple(fc.nat(10_000), fc.nat(10_000)).map(([start, length]) =>
        SpanFields.make({
          end: NonNegativeInt.make(start + length),
          start: NonNegativeInt.make(start),
        })
      ),
  })
  .pipe(
    $I.annoteSchema("Span", {
      description:
        "A half-open span [start, end) into the source text, measured in zero-based UTF-16 code units (the unit `String.length` and `slice` use).",
    })
  );

/**
 * Runtime type of {@link Span}.
 *
 * **Example** (Compute span length)
 *
 * ```ts import.meta.vitest name="Compute span length"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Span } from "@beep/nlp/Handoff/Contract"
 *
 * const span: Span = Span.make({ start: NonNegativeInt.make(0), end: NonNegativeInt.make(5) })
 * span.end - span.start // => 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Span = typeof Span.Type;

/**
 * Encoded companion types for the {@link Span} runtime schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Span {
  /**
   * Wire representation accepted and emitted by {@link Span}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Span.Encoded;
}

/**
 * PROV-O-aligned provenance for a piece of derived annotation: where it came
 * from (`source`), what produced it (`generatedBy` ~ `prov:wasGeneratedBy`),
 * when (`timestamp` ~ `prov:generatedAtTime`, epoch ms), and an optional
 * producer confidence in `[0, 1]`.
 *
 * **Example** (Make provenance record)
 *
 * ```ts
 * import { Provenance } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(Provenance.make({ source: "doc-1", generatedBy: "wink-nlp", timestamp: 0 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Provenance extends S.Class<Provenance>($I`Provenance`)(
  {
    confidence: S.optionalKey(UnitInterval),
    generatedBy: S.String,
    source: S.String,
    timestamp: S.Finite,
  },
  $I.annote("Provenance", {
    description:
      "PROV-O-aligned provenance: source document, generating operation/backend (prov:wasGeneratedBy), generation time as epoch ms (prov:generatedAtTime), and optional confidence in [0,1].",
  })
) {}

/**
 * A contiguous chunk of source text at a given granularity, with its span and
 * provenance. The atomic unit of the handoff IR.
 *
 * **Example** (Make sentence TextChunk)
 *
 * ```ts import.meta.vitest name="Make sentence TextChunk"
 * import { NonNegativeInt } from "@beep/schema"
 * import { ChunkId, Provenance, Span, TextChunk } from "@beep/nlp/Handoff/Contract"
 *
 * const chunk = TextChunk.make({
 *   id: ChunkId.make("chunk-1"),
 *   kind: "sentence",
 *   provenance: Provenance.make({ generatedBy: "wink-nlp", source: "doc-1", timestamp: 0 }),
 *   span: Span.make({ end: NonNegativeInt.make(11), start: NonNegativeInt.make(0) }),
 *   text: "Hello world"
 * })
 * chunk.kind // => "sentence"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextChunk extends S.Class<TextChunk>($I`TextChunk`)(
  {
    id: ChunkId,
    kind: ChunkKind,
    provenance: Provenance,
    span: Span,
    text: S.String,
  },
  $I.annote("TextChunk", {
    description: "A contiguous chunk of source text at a given granularity, with character span and provenance.",
  })
) {}

/**
 * A surface mention occurrence: where a span of text within a chunk refers to
 * something nameable.
 *
 * **Example** (Make surface mention)
 *
 * ```ts import.meta.vitest name="Make surface mention"
 * import { NonNegativeInt } from "@beep/schema"
 * import { ChunkId, Mention, MentionId, Provenance, Span } from "@beep/nlp/Handoff/Contract"
 *
 * const mention = Mention.make({
 *   chunkId: ChunkId.make("chunk-1"),
 *   id: MentionId.make("mention-1"),
 *   provenance: Provenance.make({ generatedBy: "wink-nlp", source: "doc-1", timestamp: 0 }),
 *   span: Span.make({ end: NonNegativeInt.make(5), start: NonNegativeInt.make(0) }),
 *   text: "Acme"
 * })
 * mention.chunkId // => "chunk-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Mention extends S.Class<Mention>($I`Mention`)(
  {
    chunkId: ChunkId,
    id: MentionId,
    provenance: Provenance,
    span: Span,
    text: S.String,
  },
  $I.annote("Mention", {
    description: "A surface mention occurrence: a text span within a chunk that refers to a nameable thing.",
  })
) {}

/**
 * An entity: a canonical thing referred to by one or more {@link Mention}s. Its
 * `type` is a GENERIC discriminant a downstream mapping turns into a concrete
 * knowledge-graph node type.
 *
 * **Example** (Make ORG entity)
 *
 * ```ts import.meta.vitest name="Make ORG entity"
 * import { Entity, EntityId, MentionId, Provenance } from "@beep/nlp/Handoff/Contract"
 *
 * const entity = Entity.make({
 *   canonicalName: "Acme Corporation",
 *   id: EntityId.make("entity-1"),
 *   mentions: [MentionId.make("mention-1")],
 *   provenance: Provenance.make({ generatedBy: "wink-nlp", source: "doc-1", timestamp: 0 }),
 *   type: "ORG"
 * })
 * entity.type // => "ORG"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Entity extends S.Class<Entity>($I`Entity`)(
  {
    canonicalName: S.String,
    confidence: S.optionalKey(UnitInterval),
    id: EntityId,
    mentions: S.Array(MentionId),
    provenance: Provenance,
    type: S.String,
  },
  $I.annote("Entity", {
    description:
      "A canonical entity referred to by mentions; its generic `type` maps downstream to a concrete KG node type.",
  })
) {}

/**
 * A directed relation between two {@link Entity}s. Its `type` is a GENERIC
 * predicate a downstream mapping turns into a concrete knowledge-graph edge type.
 *
 * **Example** (Make ACQUIRED relation)
 *
 * ```ts import.meta.vitest name="Make ACQUIRED relation"
 * import { EntityId, Provenance, Relation, RelationId } from "@beep/nlp/Handoff/Contract"
 *
 * const relation = Relation.make({
 *   id: RelationId.make("relation-1"),
 *   object: EntityId.make("entity-2"),
 *   provenance: Provenance.make({ generatedBy: "rule-extractor", source: "doc-1", timestamp: 0 }),
 *   subject: EntityId.make("entity-1"),
 *   type: "ACQUIRED"
 * })
 * relation.subject // => "entity-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Relation extends S.Class<Relation>($I`Relation`)(
  {
    confidence: S.optionalKey(UnitInterval),
    evidence: S.Array(Span).pipe(S.optionalKey),
    id: RelationId,
    object: EntityId,
    provenance: Provenance,
    subject: EntityId,
    type: S.String,
  },
  $I.annote("Relation", {
    description:
      "A directed relation from subject to object entity; its generic `type` maps downstream to a concrete KG edge type.",
  })
) {}

/**
 * The top-level handoff envelope: a fully annotated document — its chunks,
 * mentions, entities, and relations — emitted by `@beep/nlp` for downstream
 * consumption. The `version` pins the contract revision.
 *
 * **Details**
 *
 * `mentions` carries every {@link Mention} an {@link Entity} refers to by id, so
 * the per-occurrence character `span` survives the handoff instead of being
 * dropped at the boundary. `nlp-ir/1.1` added the field; `nlp-ir/1.0`
 * envelopes carried entities whose `mentions` ids resolved to nothing.
 *
 * **Example** (Make empty document)
 *
 * ```ts import.meta.vitest name="Make empty document"
 * import { AnnotatedDocument, Provenance } from "@beep/nlp/Handoff/Contract"
 *
 * const provenance = Provenance.make({ generatedBy: "wink-nlp", source: "doc-1", timestamp: 0 })
 * const document = AnnotatedDocument.make({
 *   chunks: [],
 *   entities: [],
 *   mentions: [],
 *   provenance,
 *   relations: [],
 *   version: "nlp-ir/1.1"
 * })
 * document.version // => "nlp-ir/1.1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotatedDocument extends S.Class<AnnotatedDocument>($I`AnnotatedDocument`)(
  {
    chunks: S.Array(TextChunk),
    entities: S.Array(Entity),
    mentions: S.Array(Mention),
    provenance: Provenance,
    relations: S.Array(Relation),
    version: S.Literal("nlp-ir/1.1"),
  },
  $I.annote("AnnotatedDocument", {
    description:
      "The top-level handoff envelope: a fully annotated document (chunks + mentions + entities + relations).",
  })
) {}

/**
 * Build a {@link Provenance} from an explicit timestamp.
 *
 * **Example** (Build timed provenance)
 *
 * ```ts
 * import { makeProvenance } from "@beep/nlp/Handoff/Contract"
 *
 * console.log(makeProvenance("doc-1", "wink-nlp", 0))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeProvenance: {
  (source: string, generatedBy: string, timestamp: number, confidence?: number): Provenance;
  (generatedBy: string, timestamp: number, confidence?: number): (source: string) => Provenance;
} = dual(
  (args) => args.length >= 4 || (args.length === 3 && !P.isNumber(args[1])),
  (source: string, generatedBy: string, timestamp: number, confidence?: number): Provenance =>
    confidence === undefined
      ? Provenance.make({ generatedBy, source, timestamp })
      : Provenance.make({ confidence: UnitInterval.make(confidence), generatedBy, source, timestamp })
);

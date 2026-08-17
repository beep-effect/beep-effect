/**
 * Two-tier entity-resolution node, edge, and policy models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Attributes, EntityId } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/EntityResolution");

/**
 * Evidence strategy used to resolve a mention to a canonical entity.
 *
 * @example
 * ```ts
 * import { ResolutionMethod } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * console.log(ResolutionMethod.is.containment("containment")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResolutionMethod = LiteralKit(["exact", "similarity", "containment", "neighbor"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("exact", "similarity", "containment", "neighbor"),
  })
  .annotate(
    $I.annote("ResolutionMethod", {
      description: "Closed set of evidence strategies used by entity resolution.",
    })
  );

/**
 * Runtime value accepted by {@link ResolutionMethod}.
 *
 * @example
 * ```ts
 * import type { ResolutionMethod } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const method: ResolutionMethod = "neighbor"
 * console.log(method) // "neighbor"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResolutionMethod = typeof ResolutionMethod.Type;

const MentionRecordFields = {
  id: EntityId.annotateKey({
    description: "Identifier assigned by the original extraction event.",
  }),
  mention: S.NonEmptyString.annotateKey({
    description: "Exact non-empty source mention.",
  }),
  types: S.NonEmptyArray(IRI).annotateKey({
    description: "Ontology classes assigned by extraction.",
  }),
  attributes: Attributes.pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "Property values preserved from extraction." })
  ),
  chunkIndex: NonNegativeInt.annotateKey({
    description: "Zero-based source chunk index.",
  }),
  confidence: S.OptionFromOptionalKey(Confidence).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Extraction confidence when measured." })
  ),
} as const;

/**
 * Immutable evidence node preserving one original extraction event.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MentionRecord } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const mention = S.decodeUnknownSync(MentionRecord)({
 *   id: "arsenal_chunk0",
 *   mention: "Arsenal",
 *   types: ["https://schema.org/SportsTeam"],
 *   chunkIndex: 0
 * })
 *
 * console.log(mention._tag) // "MentionRecord"
 * ```
 *
 * @invariant Mention records are immutable evidence and are never rewritten
 * into canonical entities.
 * @category entities
 * @since 0.0.0
 */
export class MentionRecord extends S.TaggedClass<MentionRecord>($I`MentionRecord`)(
  "MentionRecord",
  MentionRecordFields,
  $I.annote("MentionRecord", {
    description: "Immutable extraction-evidence node with chunk provenance.",
  })
) {
  /** Schema-derived mention-record guard. */
  static readonly is = S.is(MentionRecord);
}

const ResolvedEntityFields = {
  canonicalId: EntityId.annotateKey({
    description: "Stable canonical identifier assigned to the resolved cluster.",
  }),
  mention: S.NonEmptyString.annotateKey({
    description: "Preferred mention selected for the resolved cluster.",
  }),
  types: S.NonEmptyArray(IRI).annotateKey({
    description: "Merged ontology class IRIs.",
  }),
  attributes: Attributes.pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "Merged property values for the resolved cluster." })
  ),
  externalIds: S.Record(S.String, S.NonEmptyString).pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "External knowledge-base identifiers by namespace." })
  ),
} as const;

/**
 * Canonical entity produced by clustering immutable mention records.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResolvedEntity } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const entity = S.decodeUnknownSync(ResolvedEntity)({
 *   canonicalId: "arsenal_fc",
 *   mention: "Arsenal Football Club",
 *   types: ["https://schema.org/SportsTeam"]
 * })
 *
 * console.log(entity._tag) // "ResolvedEntity"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ResolvedEntity extends S.TaggedClass<ResolvedEntity>($I`ResolvedEntity`)(
  "ResolvedEntity",
  ResolvedEntityFields,
  $I.annote("ResolvedEntity", {
    description: "Canonical entity aggregating one or more immutable mention records.",
  })
) {
  /** Schema-derived resolved-entity guard. */
  static readonly is = S.is(ResolvedEntity);
}

const ERNodeDefinition = S.Union([MentionRecord, ResolvedEntity]).pipe(S.toTaggedUnion("_tag"));

/**
 * Discriminated node union for an entity-resolution graph.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ERNode } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const node = S.decodeUnknownSync(ERNode)({
 *   _tag: "MentionRecord",
 *   id: "alice_chunk0",
 *   mention: "Alice",
 *   types: ["https://schema.org/Person"],
 *   chunkIndex: 0
 * })
 * console.log(ERNode.guards.MentionRecord(node)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ERNode = ERNodeDefinition.pipe(
  $I.annoteSchema("ERNode", {
    description: "Mention-record or canonical-entity node in the two-tier resolution graph.",
    toArbitrary: () => S.toArbitrary(ERNodeDefinition),
  })
);

/**
 * Runtime value decoded by {@link ERNode}.
 *
 * @example
 * ```ts
 * import type { ERNode } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const tag = (node: ERNode): ERNode["_tag"] => node._tag
 * console.log(typeof tag) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ERNode = typeof ERNode.Type;

const ResolutionEdgeFields = {
  confidence: Confidence.annotateKey({
    description: "Similarity or resolution confidence that justified the edge.",
  }),
  method: ResolutionMethod.annotateKey({
    description: "Evidence strategy that justified the edge.",
  }),
} as const;

/**
 * Directed edge from an immutable mention record to its canonical entity.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResolutionEdge } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const edge = S.decodeUnknownSync(ResolutionEdge)({
 *   confidence: 0.95,
 *   method: "similarity"
 * })
 * console.log(edge._tag) // "ResolutionEdge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolutionEdge extends S.TaggedClass<ResolutionEdge>($I`ResolutionEdge`)(
  "ResolutionEdge",
  ResolutionEdgeFields,
  $I.annote("ResolutionEdge", {
    description: "Resolution evidence connecting one mention record to a canonical entity.",
  })
) {}

const RelationEdgeFields = {
  predicate: IRI.annotateKey({
    description: "Ontology property IRI relating two canonical entities.",
  }),
  grounded: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether source grounding verified this relation." })
  ),
  confidence: S.OptionFromOptionalKey(Confidence).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Grounding confidence when verification was performed." })
  ),
} as const;

/**
 * Ontology relation edge between two canonical entities.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RelationEdge } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const edge = S.decodeUnknownSync(RelationEdge)({
 *   predicate: "https://schema.org/memberOf"
 * })
 * console.log(edge.grounded) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationEdge extends S.TaggedClass<RelationEdge>($I`RelationEdge`)(
  "RelationEdge",
  RelationEdgeFields,
  $I.annote("RelationEdge", {
    description: "Ontology relation between two canonical resolved entities.",
  })
) {}

const EREdgeDefinition = S.Union([ResolutionEdge, RelationEdge]).pipe(S.toTaggedUnion("_tag"));

/**
 * Discriminated edge union for an entity-resolution graph.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EREdge } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const edge = S.decodeUnknownSync(EREdge)({
 *   _tag: "RelationEdge",
 *   predicate: "https://schema.org/memberOf"
 * })
 * console.log(EREdge.guards.RelationEdge(edge)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EREdge = EREdgeDefinition.pipe(
  $I.annoteSchema("EREdge", {
    description: "Resolution or ontology-relation edge in the two-tier entity-resolution graph.",
    toArbitrary: () => S.toArbitrary(EREdgeDefinition),
  })
);

/**
 * Runtime value decoded by {@link EREdge}.
 *
 * @example
 * ```ts
 * import type { EREdge } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const tag = (edge: EREdge): EREdge["_tag"] => edge._tag
 * console.log(typeof tag) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EREdge = typeof EREdge.Type;

const EntityResolutionConfigFields = {
  similarityThreshold: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.7)),
    S.annotateKey({ description: "Minimum overall score accepted for clustering." })
  ),
  mentionWeight: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.5)),
    S.annotateKey({ description: "Contribution of mention-string similarity." })
  ),
  typeWeight: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.3)),
    S.annotateKey({ description: "Contribution of ontology-type overlap." })
  ),
  neighborWeight: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.2)),
    S.annotateKey({ description: "Contribution of graph-neighbor similarity." })
  ),
  embeddingWeight: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0)),
    S.annotateKey({ description: "Contribution of vector similarity; zero disables it." })
  ),
  requireTypeOverlap: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether candidates must share an ontology type." })
  ),
  typeOverlapRatio: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.5)),
    S.annotateKey({ description: "Minimum type-overlap ratio when overlap is required." })
  ),
} as const;

/**
 * Tunable policy for deterministic entity clustering.
 *
 * @remarks
 * All obvious defaults belong to the schema. `default` is a schema-owned
 * constructor, replacing the upstream free-standing default instance.
 *
 * @example
 * ```ts
 * import { EntityResolutionConfig } from "@effect-ontology/Model/EntityResolution.ts"
 *
 * const config = EntityResolutionConfig.default()
 * console.log(config.similarityThreshold) // 0.7
 * console.log(config.requireTypeOverlap) // true
 * ```
 *
 * @invariant Thresholds, weights, and ratios lie in the closed interval `[0, 1]`.
 * @category configuration
 * @since 0.0.0
 */
export class EntityResolutionConfig extends S.Class<EntityResolutionConfig>($I`EntityResolutionConfig`)(
  EntityResolutionConfigFields,
  $I.annote("EntityResolutionConfig", {
    description: "Schema-defaulted policy controlling entity clustering and similarity evidence.",
  })
) {
  /**
   * Constructs the canonical default entity-resolution policy.
   *
   * @example
   * ```ts
   * import { EntityResolutionConfig } from "@effect-ontology/Model/EntityResolution.ts"
   *
   * const config = EntityResolutionConfig.default()
   * console.log(config.requireTypeOverlap) // true
   * ```
   *
   * @returns A complete immutable configuration populated by schema defaults.
   */
  static default(): EntityResolutionConfig {
    return EntityResolutionConfig.make({});
  }
}

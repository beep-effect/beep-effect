/**
 * Graph node & edge schemas for the NLP text graph.
 *
 * Schema-first domain types for the text-graph IR: structural nodes
 * ({@link TextNode}/{@link TextEdge}), the {@link NLPAnalysis} summary, and the
 * linguistic-annotation node classes ({@link POSNode}, {@link EntityNode},
 * {@link LemmaNode}, {@link DependencyNode}, {@link RelationNode}). These are the
 * basis for the product-neutral handoff contract emitted to downstream consumers.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * `Schema.Class("Name")` becomes `S.Class($I\`Name\`)(fields, $I.annote(...))\`,
 * multi-arm `Schema.Literal(...)` becomes `S.Literals(...)`, `Schema.optional`
 * becomes `S.optionalKey`, and `Schema.Record({key,value})` becomes the positional
 * `S.Record(key, value)`. `timestamp` remains a plain field supplied by the graph
 * producer (which reads `Clock`).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $NlpId.create("Graph/Schema");

/**
 * Structural text-node kind vocabulary.
 *
 * **Example** (Validate sentence node kind)
 *
 * ```ts
 * import { TextNodeType } from "@beep/nlp/Graph/Schema"
 *
 * console.log(TextNodeType.is.sentence("sentence")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextNodeType = LiteralKit(["sentence", "token", "paragraph", "document"]).annotate(
  $I.annote("TextNodeType", {
    description: "Structural text-graph node kind (document/paragraph/sentence/token).",
  })
);

/**
 * Runtime TypeScript union decoded by {@link TextNodeType}.
 *
 * **Example** (Assign TextNodeType union)
 *
 * ```ts
 * import type { TextNodeType } from "@beep/nlp/Graph/Schema"
 *
 * const kind: TextNodeType = "sentence"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextNodeType = typeof TextNodeType.Type;

/**
 * Edge-relation vocabulary (structural + linguistic-annotation relations).
 *
 * **Example** (Validate contains edge relation)
 *
 * ```ts
 * import { TextEdgeRelation } from "@beep/nlp/Graph/Schema"
 *
 * console.log(TextEdgeRelation.is.contains("contains")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextEdgeRelation = LiteralKit([
  // Structural relations
  "contains",
  "follows",
  "derived-from",
  "parent-of",
  // Linguistic annotation relations
  "tagged-as",
  "lemma-of",
  "head-of",
  "dependent-of",
  "entity-mention",
  "relates-to",
]).annotate(
  $I.annote("TextEdgeRelation", {
    description: "Text-graph edge relation (structural lineage + linguistic-annotation links).",
  })
);

/**
 * Runtime TypeScript union decoded by {@link TextEdgeRelation}.
 *
 * **Example** (Assign TextEdgeRelation union)
 *
 * ```ts
 * import type { TextEdgeRelation } from "@beep/nlp/Graph/Schema"
 *
 * const relation: TextEdgeRelation = "contains"
 * console.log(relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextEdgeRelation = typeof TextEdgeRelation.Type;

const textNodeFields = <T extends TextNodeType>(literal: S.Literal<T>) => ({
  text: S.String,
  type: S.tag(literal.literal),
  operation: S.optionalKey(S.String),
  timestamp: S.Finite,
  metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
});

/**
 * Text node stored in the graph: a piece of text with processing metadata.
 *
 * **Example** (Decode TextNode schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = S.decodeUnknownSync(TextNode)({
 *   text: "Hello world.",
 *   type: "sentence",
 *   timestamp: 0
 * })
 * console.log(node.type) // "sentence"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextNode = TextNodeType.mapMembers(
  Tuple.evolve([
    (literal: S.Literal<"sentence">) =>
      literal.pipe(
        textNodeFields,
        S.Struct,
        $I.annoteSchema("SentenceTextNode", {
          description: "Sentence text-graph node with processing metadata and a creation timestamp.",
        })
      ),
    (literal: S.Literal<"token">) =>
      literal.pipe(
        textNodeFields,
        S.Struct,
        $I.annoteSchema("TokenTextNode", {
          description: "Token text-graph node with processing metadata and a creation timestamp.",
        })
      ),
    (literal: S.Literal<"paragraph">) =>
      literal.pipe(
        textNodeFields,
        S.Struct,
        $I.annoteSchema("ParagraphTextNode", {
          description: "Paragraph text-graph node with processing metadata and a creation timestamp.",
        })
      ),
    (literal: S.Literal<"document">) =>
      literal.pipe(
        textNodeFields,
        S.Struct,
        $I.annoteSchema("DocumentTextNode", {
          description: "Document text-graph node with processing metadata and a creation timestamp.",
        })
      ),
  ])
).pipe(
  $I.annoteSchema("TextNode", {
    description: "Type-discriminated text-graph node with processing metadata and a creation timestamp.",
  }),
  S.toTaggedUnion("type")
);

/**
 * Runtime type for text-graph nodes.
 *
 * **Example** (Read TextNode type field)
 *
 * ```ts
 * import type { TextNode } from "@beep/nlp/Graph/Schema"
 *
 * const typeName = (node: TextNode) => node.type
 * console.log(typeName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextNode = typeof TextNode.Type;

const textEdgeFields = <T extends TextEdgeRelation>(literal: S.Literal<T>) => ({
  relation: S.tag(literal.literal),
  label: S.optionalKey(S.String),
  weight: S.optionalKey(S.Finite),
});

const textEdgeMember =
  <T extends TextEdgeRelation>(name: string, description: string) =>
  (literal: S.Literal<T>) =>
    literal.pipe(textEdgeFields, S.Struct, $I.annoteSchema(name, { description }));

/**
 * Edge between text nodes, labeled with a structural or linguistic relation.
 *
 * **Example** (Decode TextEdge schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextEdge } from "@beep/nlp/Graph/Schema"
 *
 * const edge = S.decodeUnknownSync(TextEdge)({ relation: "contains", weight: 1 })
 * console.log(edge.relation) // "contains"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextEdge = TextEdgeRelation.mapMembers(
  Tuple.evolve([
    textEdgeMember("ContainsTextEdge", "Structural text-graph edge indicating containment."),
    textEdgeMember("FollowsTextEdge", "Structural text-graph edge indicating sequence order."),
    textEdgeMember("DerivedFromTextEdge", "Structural text-graph edge indicating derivation lineage."),
    textEdgeMember("ParentOfTextEdge", "Structural text-graph edge indicating parentage."),
    textEdgeMember("TaggedAsTextEdge", "Linguistic text-graph edge linking a token to a part-of-speech tag."),
    textEdgeMember("LemmaOfTextEdge", "Linguistic text-graph edge linking a lemma to its token."),
    textEdgeMember("HeadOfTextEdge", "Linguistic text-graph edge indicating a dependency head."),
    textEdgeMember("DependentOfTextEdge", "Linguistic text-graph edge indicating a dependency dependent."),
    textEdgeMember("EntityMentionTextEdge", "Linguistic text-graph edge linking an entity mention to source text."),
    textEdgeMember("RelatesToTextEdge", "Linguistic text-graph edge linking related extracted entities."),
  ])
).pipe(
  $I.annoteSchema("TextEdge", {
    description: "Text-graph edge labeled with a structural or linguistic-annotation relation.",
  }),
  S.toTaggedUnion("relation")
);

/**
 * Runtime type for text-graph edges.
 *
 * **Example** (Read TextEdge relation field)
 *
 * ```ts
 * import type { TextEdge } from "@beep/nlp/Graph/Schema"
 *
 * const relation = (edge: TextEdge) => edge.relation
 * console.log(relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextEdge = typeof TextEdge.Type;

/**
 * Summary result of analyzing a piece of text.
 *
 * **Example** (Build NLPAnalysis summary)
 *
 * ```ts
 * import { NLPAnalysis } from "@beep/nlp/Graph/Schema"
 *
 * const analysis = NLPAnalysis.make({
 *   sentences: ["Hello world."],
 *   text: "Hello world.",
 *   tokens: ["Hello", "world"],
 *   wordCount: 2
 * })
 * console.log(analysis.wordCount) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NLPAnalysis extends S.Class<NLPAnalysis>($I`NLPAnalysis`)(
  {
    text: S.String,
    sentences: S.Array(S.String),
    tokens: S.Array(S.String),
    wordCount: S.Finite,
    stats: S.optionalKey(S.Record(S.String, S.Finite)),
  },
  $I.annote("NLPAnalysis", {
    description: "Summary analysis of a text: detected sentences, tokens, word count, and optional stats.",
  })
) {}

/**
 * Part-of-speech annotation for a token (a functor `Token -> POS`).
 *
 * **Example** (Build POS annotation node)
 *
 * ```ts
 * import { POSNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = POSNode.make({ position: 1, tag: "NOUN", text: "brief", timestamp: 0 })
 * console.log(node.tag) // "NOUN"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class POSNode extends S.Class<POSNode>($I`POSNode`)(
  {
    text: S.String,
    tag: S.String,
    description: S.optionalKey(S.String),
    position: S.Finite,
    timestamp: S.Finite,
    metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("POSNode", {
    description: "Part-of-speech annotation node (Penn Treebank tag) for a token at a sentence position.",
  })
) {}

/**
 * Character span (start/end offsets) within a piece of text.
 *
 * **Example** (Build character span)
 *
 * ```ts
 * import { Span } from "@beep/nlp/Graph/Schema"
 *
 * const span = Span.make({ start: 0, end: 9 })
 * console.log(span.end - span.start) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Span extends S.Class<Span>($I`Span`)(
  { start: S.Finite, end: S.Finite },
  $I.annote("Span", {
    description: "Character span (start/end offsets) within a piece of text.",
  })
) {}

/**
 * Named entity extracted from text (a functor `Text -> Entity`).
 *
 * **Example** (Build named entity node)
 *
 * ```ts
 * import { EntityNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = EntityNode.make({
 *   entityType: "ORG",
 *   span: { end: 9, start: 0 },
 *   text: "Acme Inc.",
 *   timestamp: 0
 * })
 * console.log(node.entityType) // "ORG"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityNode extends S.Class<EntityNode>($I`EntityNode`)(
  {
    text: S.String,
    entityType: S.String,
    confidence: S.optionalKey(S.Finite),
    span: Span,
    normalizedForm: S.optionalKey(S.String),
    timestamp: S.Finite,
    metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("EntityNode", {
    description: "Named-entity node with type label, character span, optional confidence, and normalized form.",
  })
) {}

/**
 * Lemmatized (canonical) form of a token (a forgetful functor `Token -> Lemma`).
 *
 * **Example** (Build lemma annotation node)
 *
 * ```ts
 * import { LemmaNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = LemmaNode.make({ lemma: "run", position: 3, token: "running", timestamp: 0 })
 * console.log(node.lemma) // "run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LemmaNode extends S.Class<LemmaNode>($I`LemmaNode`)(
  {
    token: S.String,
    lemma: S.String,
    pos: S.optionalKey(S.String),
    position: S.Finite,
    timestamp: S.Finite,
    metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("LemmaNode", {
    description: "Lemma node: the canonical/dictionary form of a token (idempotent under lemmatization).",
  })
) {}

/**
 * Token reference (text + sentence position) used by dependency-arc endpoints.
 *
 * **Example** (Build dependency token ref)
 *
 * ```ts
 * import { DependencyToken } from "@beep/nlp/Graph/Schema"
 *
 * const token = DependencyToken.make({ text: "arrived", position: 2 })
 * console.log(token.position) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyToken extends S.Class<DependencyToken>($I`DependencyToken`)(
  { text: S.String, position: S.Finite },
  $I.annote("DependencyToken", {
    description: "Token reference (text + sentence position) used by dependency-arc endpoints.",
  })
) {}

/**
 * Syntactic dependency relation between two tokens.
 *
 * **Example** (Build dependency arc node)
 *
 * ```ts
 * import { DependencyNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = DependencyNode.make({
 *   dependent: { position: 1, text: "brief" },
 *   distance: 1,
 *   head: { position: 2, text: "arrived" },
 *   relation: "nsubj",
 *   timestamp: 0
 * })
 * console.log(node.relation) // "nsubj"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DependencyNode extends S.Class<DependencyNode>($I`DependencyNode`)(
  {
    relation: S.String,
    head: DependencyToken,
    dependent: DependencyToken,
    distance: S.Finite,
    timestamp: S.Finite,
    metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("DependencyNode", {
    description: "Syntactic dependency arc (Universal Dependencies relation) between a head and dependent token.",
  })
) {}

/**
 * Entity participant (text, type, and character span) referenced by a semantic relation.
 *
 * **Example** (Build relation participant)
 *
 * ```ts
 * import { RelationParticipant } from "@beep/nlp/Graph/Schema"
 *
 * const participant = RelationParticipant.make({
 *   text: "Acme",
 *   entityType: "ORG",
 *   span: { start: 0, end: 4 }
 * })
 * console.log(participant.entityType) // "ORG"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationParticipant extends S.Class<RelationParticipant>($I`RelationParticipant`)(
  { text: S.String, entityType: S.String, span: Span },
  $I.annote("RelationParticipant", {
    description: "Entity participant (text, type, and character span) referenced by a semantic relation.",
  })
) {}

/**
 * Semantic relation between two entities.
 *
 * **Example** (Build semantic relation node)
 *
 * ```ts
 * import { RelationNode } from "@beep/nlp/Graph/Schema"
 *
 * const node = RelationNode.make({
 *   object: { entityType: "ORG", span: { end: 15, start: 10 }, text: "Globex" },
 *   relationType: "acquired",
 *   subject: { entityType: "ORG", span: { end: 4, start: 0 }, text: "Acme" },
 *   timestamp: 0
 * })
 * console.log(node.relationType) // "acquired"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationNode extends S.Class<RelationNode>($I`RelationNode`)(
  {
    relationType: S.String,
    subject: RelationParticipant,
    object: RelationParticipant,
    trigger: S.optionalKey(S.String),
    confidence: S.optionalKey(S.Finite),
    timestamp: S.Finite,
    metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("RelationNode", {
    description: "Semantic relation node connecting a subject entity to an object entity via a typed predicate.",
  })
) {}

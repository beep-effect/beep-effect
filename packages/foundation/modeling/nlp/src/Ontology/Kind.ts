/**
 * Ontology/Kind - Type-level ontology for text-processing categories.
 *
 * Makes the categorical structure explicit:
 * - {@link TextKind}: the objects in the category of discourse
 * - {@link TypedText}: payloads tagged with their ontological kind
 * - Smart constructors: safe ways to create typed text
 * - Kind relations: the partial-order ("contains") structure
 *
 * The kinds form a poset under containment
 * (`Document > Paragraph > Sentence > Token > Character`) with orthogonal
 * annotation kinds (POS, Lemma, Entity, Relation, Dependency, Chunk, Embedding).
 * Free operations increase granularity (move down the poset); forgetful
 * operations decrease it (move up).
 *
 * Effect v4 `@beep/nlp` implementation.
 * `Schema.Union(Schema.Literal(...))` is replaced by `@beep/schema`'s
 * `LiteralKit` per repo convention.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $NlpId.create("Ontology/Kind");

// =============================================================================
// Core Kind System
// =============================================================================

/**
 * Textual strata in the NLP category (the object layer).
 *
 * Forms a poset under containment plus orthogonal annotation kinds.
 *
 * @example
 * ```ts
 * import { TextKind } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(TextKind.is.Document("Document")) // true
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const TextKind = LiteralKit([
  // Structural hierarchy (poset under containment)
  "Document",
  "Paragraph",
  "Sentence",
  "Token",
  "Character",
  // Linguistic annotations (orthogonal to the structural hierarchy)
  "POS",
  "Lemma",
  "Entity",
  "Relation",
  "Dependency",
  "Chunk",
  "Embedding",
]).annotate(
  $I.annote("TextKind", {
    description: "Ontological strata of text in the NLP category (structural hierarchy + annotation kinds).",
  })
);

/**
 * Runtime type for {@link TextKind}.
 *
 * @example
 * ```ts
 * import type { TextKind } from "@beep/nlp/Ontology/Kind"
 *
 * const kind: TextKind = "Sentence"
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TextKind = typeof TextKind.Type;

/**
 * Runtime schema for validating values at the ontology kind boundary.
 *
 * @example
 * ```ts
 * import { TextKindSchema } from "@beep/nlp/Ontology/Kind"
 *
 * const kind = TextKindSchema.make("Sentence")
 * console.log(kind) // "Sentence"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextKindSchema: S.Schema<TextKind> = TextKind.pipe(
  $I.annoteSchema("TextKindSchema", {
    description: "Runtime schema alias for NLP text ontology kinds.",
  })
);

// =============================================================================
// Typed Text Payload
// =============================================================================

/**
 * Build a schema for text payloads constrained to one ontology kind schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypedTextSchema } from "@beep/nlp/Ontology/Kind"
 *
 * const schema = TypedTextSchema(S.Literal("Token"))
 * const token = schema.make({ kind: "Token", content: "Effect" })
 * console.log(token.kind) // "Token"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TypedTextSchema = <K extends TextKind>(kind: S.Schema<K>) => {
  class TypedTextSchemaClass extends S.Class<TypedTextSchemaClass>($I`TypedTextSchema`)(
    {
      kind,
      content: S.String,
      metadata: S.optionalKey(S.Record(S.String, S.Unknown)),
    },
    $I.annote("TypedTextSchema", {
      description: "Generic schema for text content tagged with a supplied ontology kind.",
    })
  ) {}

  return TypedTextSchemaClass;
};

/**
 * Text content tagged with its ontological kind.
 *
 * Pairs raw content with its position in the categorical hierarchy, enabling
 * type-level enforcement of valid operations. Derived from {@link TypedTextSchema}
 * (bounded to the finite {@link TextKind} literal domain) rather than hand-declared,
 * so the schema factory is the single source of truth for the shape.
 *
 * @typeParam K - The ontological kind (position in the category).
 * @example
 * ```ts
 * import type { TypedText } from "@beep/nlp/Ontology/Kind"
 *
 * const doc: TypedText<"Document"> = { kind: "Document", content: "hello" }
 * console.log(doc.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TypedText<K extends TextKind> = S.Schema.Type<ReturnType<typeof TypedTextSchema<K>>>;

// =============================================================================
// Smart Constructors
// =============================================================================

type TypedTextConstructor<K extends TextKind> = {
  (metadata?: Record<string, unknown>): (content: string) => TypedText<K>;
  (content: string, metadata?: Record<string, unknown>): TypedText<K>;
};

const makeTyped = <K extends TextKind>(kind: K): TypedTextConstructor<K> =>
  dual(
    (args) => P.isString(args[0]),
    (content: string, metadata?: Record<string, unknown>): TypedText<K> => {
      const schema = TypedTextSchema(S.Literal(kind));

      return metadata !== undefined ? schema.make({ kind, content, metadata }) : schema.make({ kind, content });
    }
  );

/**
 * Create document-level typed text at the top of the structural hierarchy.
 *
 * @example
 * ```ts
 * import { Document } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Document("This is a document.").kind) // "Document"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Document: TypedTextConstructor<"Document"> = makeTyped("Document");

/**
 * Create paragraph-level typed text for a logical block in a document.
 *
 * @example
 * ```ts
 * import { Paragraph } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Paragraph("A paragraph.").kind) // "Paragraph"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Paragraph: TypedTextConstructor<"Paragraph"> = makeTyped("Paragraph");

/**
 * Create sentence-level typed text for a complete utterance or statement.
 *
 * @example
 * ```ts
 * import { Sentence } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Sentence("A sentence.").kind) // "Sentence"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Sentence: TypedTextConstructor<"Sentence"> = makeTyped("Sentence");

/**
 * Create token-level typed text for one word, symbol, or punctuation mark.
 *
 * @example
 * ```ts
 * import { Token } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Token("word").kind) // "Token"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Token: TypedTextConstructor<"Token"> = makeTyped("Token");

/**
 * Create character-level typed text for the atomic textual stratum.
 *
 * @example
 * ```ts
 * import { Character } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Character("a").kind) // "Character"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Character: TypedTextConstructor<"Character"> = makeTyped("Character");

/**
 * Create entity-level typed text for a semantic mention extracted from prose.
 *
 * @example
 * ```ts
 * import { Entity } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Entity("Apple Inc.", { type: "ORG" }).kind) // "Entity"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Entity: TypedTextConstructor<"Entity"> = makeTyped("Entity");

/**
 * Create relation-level typed text for a semantic edge between entities.
 *
 * @example
 * ```ts
 * import { Relation } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Relation("founded", { type: "FOUNDER_OF" }).kind) // "Relation"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Relation: TypedTextConstructor<"Relation"> = makeTyped("Relation");

/**
 * Create embedding-level typed text for vector-space metadata about content.
 *
 * @example
 * ```ts
 * import { Embedding } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Embedding("apple", { model: "word2vec" }).kind) // "Embedding"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Embedding: TypedTextConstructor<"Embedding"> = makeTyped("Embedding");

/**
 * Create dependency-level typed text for syntactic dependency arcs.
 *
 * @example
 * ```ts
 * import { Dependency } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Dependency("nsubj", { head: "runs" }).kind) // "Dependency"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Dependency: TypedTextConstructor<"Dependency"> = makeTyped("Dependency");

/**
 * Create chunk-level typed text for shallow-parsing constituents.
 *
 * @example
 * ```ts
 * import { Chunk } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Chunk("the dog").kind) // "Chunk"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Chunk: TypedTextConstructor<"Chunk"> = makeTyped("Chunk");

/**
 * Create POS-level typed text for part-of-speech annotations.
 *
 * @example
 * ```ts
 * import { POS } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(POS("dog", { tag: "NN" }).kind) // "POS"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const POS: TypedTextConstructor<"POS"> = makeTyped("POS");

/**
 * Create lemma-level typed text for canonical token forms.
 *
 * @example
 * ```ts
 * import { Lemma } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(Lemma("run", { original: "running" }).kind) // "Lemma"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Lemma: TypedTextConstructor<"Lemma"> = makeTyped("Lemma");

// =============================================================================
// Kind Relations (Partial Order Structure)
// =============================================================================

/**
 * Structural containment hierarchy for valid parent-child kind relationships.
 *
 * @remarks
 * The static `containment` record is the authoritative runtime poset used by
 * {@link canContain} and {@link getValidChildren}. Structural kinds form the
 * main hierarchy, while annotation kinds are attached at appropriate strata.
 *
 * @example
 * ```ts
 * import { KindContainment } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(KindContainment.containment.Sentence.includes("Token")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KindContainment extends S.Class<KindContainment>($I`KindContainment`)(
  {
    Character: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Chunk: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults(TextKind.pickOptions(["Token"]))),
    Dependency: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Document: TextKind.pipe(
      S.Array,
      S.optionalKey,
      SchemaUtils.withKeyDefaults(TextKind.pickOptions(["Paragraph", "Sentence"]))
    ),
    Embedding: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Entity: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Lemma: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Paragraph: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults(TextKind.pickOptions(["Sentence"]))),
    POS: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Relation: TextKind.pipe(S.Array, S.optionalKey, SchemaUtils.withKeyDefaults([])),
    Sentence: TextKind.pipe(
      S.Array,
      S.optionalKey,
      SchemaUtils.withKeyDefaults(TextKind.pickOptions(["Token", "Chunk", "Dependency", "Entity", "Relation"]))
    ),
    Token: TextKind.pipe(
      S.Array,
      S.optionalKey,
      SchemaUtils.withKeyDefaults(TextKind.pickOptions(["Character", "POS", "Lemma"]))
    ),
  },
  $I.annote("KindContainment", {
    description: "Represents the containment relationships between different kinds of text elements in the ontology.",
  })
) {
  private static readonly defaults = KindContainment.make({});

  static readonly containment: Readonly<Record<TextKind, ReadonlyArray<TextKind>>> = {
    Character: KindContainment.defaults.Character ?? [],
    Chunk: KindContainment.defaults.Chunk ?? [],
    Dependency: KindContainment.defaults.Dependency ?? [],
    Document: KindContainment.defaults.Document ?? [],
    Embedding: KindContainment.defaults.Embedding ?? [],
    Entity: KindContainment.defaults.Entity ?? [],
    Lemma: KindContainment.defaults.Lemma ?? [],
    POS: KindContainment.defaults.POS ?? [],
    Paragraph: KindContainment.defaults.Paragraph ?? [],
    Relation: KindContainment.defaults.Relation ?? [],
    Sentence: KindContainment.defaults.Sentence ?? [],
    Token: KindContainment.defaults.Token ?? [],
  };
}

/**
 * Check whether `parent` can contain `child` per the containment poset.
 *
 * @example
 * ```ts
 * import { canContain } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(canContain("Document", "Sentence")) // true
 * console.log(canContain("Token", "Document")) // false
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const canContain: {
  (parent: TextKind, child: TextKind): boolean;
  (child: TextKind): (parent: TextKind) => boolean;
} = dual(2, (parent: TextKind, child: TextKind): boolean => KindContainment.containment[parent].includes(child));

/**
 * Get all valid child kinds for a given parent kind.
 *
 * @example
 * ```ts
 * import { getValidChildren } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(getValidChildren("Token")) // ["Character", "POS", "Lemma"]
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const getValidChildren = (kind: TextKind): ReadonlyArray<TextKind> => KindContainment.containment[kind];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract raw content from typed text.
 *
 * @example
 * ```ts
 * import { Document, content } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(content(Document("hello"))) // "hello"
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const content = <K extends TextKind>(text: TypedText<K>): string => text.content;

/**
 * Get the kind of a typed text.
 *
 * @example
 * ```ts
 * import { Token, kindOf } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(kindOf(Token("word"))) // "Token"
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const kindOf = <K extends TextKind>(text: TypedText<K>): K => text.kind;

/**
 * Map over the content of typed text, preserving its kind.
 *
 * @example
 * ```ts
 * import { Token, mapContent } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(mapContent(Token("dog"), (s) => s.toUpperCase()).content) // "DOG"
 * ```
 *
 * @since 0.0.0
 * @category mapping
 */
export const mapContent: {
  <K extends TextKind>(text: TypedText<K>, f: (content: string) => string): TypedText<K>;
  <K extends TextKind>(f: (content: string) => string): (text: TypedText<K>) => TypedText<K>;
} = dual(
  2,
  <K extends TextKind>(text: TypedText<K>, f: (content: string) => string): TypedText<K> => ({
    ...text,
    content: f(text.content),
  })
);

/**
 * Merge additional metadata into typed text.
 *
 * @example
 * ```ts
 * import { Entity, withMetadata } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(withMetadata(Entity("Acme"), { type: "ORG" }).metadata) // { type: "ORG" }
 * ```
 *
 * @since 0.0.0
 * @category mapping
 */
export const withMetadata: {
  <K extends TextKind>(text: TypedText<K>, metadata: Record<string, unknown>): TypedText<K>;
  (metadata: Record<string, unknown>): <K extends TextKind>(text: TypedText<K>) => TypedText<K>;
} = dual(
  2,
  <K extends TextKind>(text: TypedText<K>, metadata: Record<string, unknown>): TypedText<K> => ({
    ...text,
    metadata: { ...text.metadata, ...metadata },
  })
);

/**
 * Type guard: whether a value is a {@link TypedText} of a specific kind.
 *
 * @example
 * ```ts
 * import { Token, isKind } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(isKind("Token")(Token("word"))) // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isKind =
  <K extends TextKind>(kind: K) =>
  (value: TypedText<TextKind>): value is TypedText<K> =>
    value.kind === kind;

/**
 * Re-tag typed text to a new kind (use only when the transition is valid).
 *
 * @example
 * ```ts
 * import { Token, recast } from "@beep/nlp/Ontology/Kind"
 *
 * console.log(recast(Token("word"), "Lemma").kind) // "Lemma"
 * ```
 *
 * @since 0.0.0
 * @category mapping
 */
export const recast: {
  <K extends TextKind>(text: TypedText<TextKind>, newKind: K): TypedText<K>;
  <K extends TextKind>(newKind: K): (text: TypedText<TextKind>) => TypedText<K>;
} = dual(
  2,
  <K extends TextKind>(text: TypedText<TextKind>, newKind: K): TypedText<K> => ({
    ...text,
    kind: newKind,
  })
);

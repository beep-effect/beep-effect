/**
 * Schema-backed RDF value types used by the ontology services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId, SafePnLocal } from "@beep/identity";
import { AbsoluteIRI as CanonicalAbsoluteIRI, IRI as CanonicalIRI } from "@beep/rdf/Iri";
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Rdf/Types");

/**
 * Validated RDF internationalized resource identifier.
 *
 * **Example** (Create an IRI)
 *
 * ```ts
 * import { IRI } from "@effect-ontology/Rdf/Types.ts"
 *
 * const person = IRI.fromUnknown("https://schema.org/Person")
 * console.log(person) // "https://schema.org/Person"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IRI = CanonicalIRI.pipe(
  $I.annoteSchema("IRI", {
    description: "Canonical RFC 3987 IRI represented as a branded string.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    decodeResult: S.decodeResult(schema),
  }))
);

/**
 * Decoded branded identifier produced by the {@link IRI} runtime schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type IRI = typeof IRI.Type;

/**
 * RDF named-node identifier represented as a validated branded IRI string.
 *
 * **Example** (Decode a named node)
 *
 * ```ts
 * import { NamedNode } from "@effect-ontology/Rdf/Types.ts"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownSync(NamedNode)("https://schema.org/Person")
 * console.log(node) // "https://schema.org/Person"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NamedNode = IRI.pipe(
  $I.annoteSchema("NamedNode", {
    description: "RDF named-node identifier represented as a validated branded IRI string.",
  })
);

/**
 * Decoded named-node identifier produced by the {@link NamedNode} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NamedNode = typeof NamedNode.Type;

/**
 * Backward-compatible runtime schema name for {@link IRI}.
 *
 * **Example** (Decode through the compatibility name)
 *
 * ```ts
 * import { IriSchema } from "@effect-ontology/Rdf/Types.ts"
 *
 * console.log(IriSchema.fromUnknown("https://schema.org/Thing"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IriSchema = IRI;

/**
 * Absolute IRI without a fragment component.
 *
 * **Example** (Create an ontology IRI)
 *
 * ```ts
 * import { AbsoluteIRI } from "@effect-ontology/Rdf/Types.ts"
 *
 * const ontology = AbsoluteIRI.fromUnknown("https://example.org/ontology")
 * console.log(ontology) // "https://example.org/ontology"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AbsoluteIRI = CanonicalAbsoluteIRI.pipe(
  $I.annoteSchema("AbsoluteIRI", {
    description: "Canonical absolute IRI without a fragment component.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded absolute identifier produced by the {@link AbsoluteIRI} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AbsoluteIRI = typeof AbsoluteIRI.Type;

/**
 * Turtle-safe local component of an RDF name.
 *
 * **Example** (Create a local name)
 *
 * ```ts
 * import { LocalName } from "@effect-ontology/Rdf/Types.ts"
 *
 * const label = LocalName.fromUnknown("prefLabel")
 * console.log(label) // "prefLabel"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LocalName = SafePnLocal.pipe(
  S.brand("LocalName"),
  $I.annoteSchema("LocalName", {
    description: "Turtle-safe PN_LOCAL value used as the local component of an IRI.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({ decodeSync: S.decodeSync(schema) }))
);

/**
 * Decoded Turtle-safe name produced by the {@link LocalName} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LocalName = typeof LocalName.Type;

const blankNodeDefinition = S.TemplateLiteral(["_:", S.NonEmptyString]).pipe(S.brand("BlankNode"));

/**
 * RDF blank-node identifier, including the `_:` prefix.
 *
 * **Example** (Create a blank node)
 *
 * ```ts
 * import { BlankNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node = BlankNode.make("_:b0")
 * console.log(node) // "_:b0"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BlankNode = blankNodeDefinition.pipe(
  $I.annoteSchema("BlankNode", {
    description: "RDF blank-node identifier beginning with the `_:` prefix.",
    toArbitrary: () => S.toArbitrary(blankNodeDefinition),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded blank-node identifier produced by the {@link BlankNode} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BlankNode = typeof BlankNode.Type;

const LiteralFields = {
  /** Lexical form of the RDF literal. */
  value: S.String.pipe(
    $I.annoteKey("Literal.value", {
      description: "Lexical form of the RDF literal.",
    })
  ),
  /** Optional BCP 47 language tag for a language-qualified string. */
  language: S.String.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    $I.annoteKey("Literal.language", {
      description: "Optional BCP 47 language tag for a language-qualified string.",
    })
  ),
  /** Optional datatype IRI; absence denotes the RDF string default. */
  datatype: IRI.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    $I.annoteKey("Literal.datatype", {
      description: "Optional datatype IRI; absence denotes the RDF string default.",
    })
  ),
} as const;

/**
 * RDF literal with an optional language or datatype qualifier.
 *
 * **Example** (Create a typed literal)
 *
 * ```ts
 * import { IRI, Literal } from "@effect-ontology/Rdf/Types.ts"
 * import * as O from "effect/Option"
 *
 * const count = Literal.make({
 *   value: "42",
 *   datatype: O.some(IRI.make("http://www.w3.org/2001/XMLSchema#integer"))
 * })
 * console.log(count.toJSON().value) // "42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Literal extends S.Class<Literal>($I`Literal`)(
  LiteralFields,
  $I.annote("Literal", {
    description: "RDF literal with a lexical value and optional language or datatype qualifier.",
  })
) {
  static readonly is = S.is(this);

  /**
   * Converts this literal to its stable tagged JSON representation.
   *
   * **Example** (Serialize a language-tagged literal)
   *
   * ```ts
   * import { Literal } from "@effect-ontology/Rdf/Types.ts"
   * import * as O from "effect/Option"
   *
   * const label = Literal.make({ value: "bonjour", language: O.some("fr") })
   * console.log(label.toJSON().language) // "fr"
   * ```
   *
   * @returns A tagged plain object with absent qualifiers encoded as `undefined`.
   * @since 0.0.0
   */
  toJSON() {
    return {
      _tag: "Literal" as const,
      value: this.value,
      language: O.getOrUndefined(this.language),
      datatype: O.getOrUndefined(this.datatype),
    };
  }
}

const rdfTermDefinition = S.Union([IRI, BlankNode, Literal]);

/**
 * RDF term accepted in an object position.
 *
 * **Example** (Decode a literal RDF term)
 *
 * ```ts
 * import { Literal, RdfTerm } from "@effect-ontology/Rdf/Types.ts"
 * import * as S from "effect/Schema"
 *
 * const term = S.decodeUnknownSync(RdfTerm)({ value: "Ada" })
 * console.log(S.is(Literal)(term)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RdfTerm = rdfTermDefinition.pipe(
  $I.annoteSchema("RdfTerm", {
    description: "IRI, blank node, or literal accepted in an RDF object position.",
    toArbitrary: () => S.toArbitrary(rdfTermDefinition),
  })
);

/**
 * Decoded IRI, blank node, or literal produced by the {@link RdfTerm} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RdfTerm = typeof RdfTerm.Type;

/**
 * RDF term accepted in object position.
 *
 * **Example** (Decode an object-position blank node)
 *
 * ```ts
 * import { ObjectTerm } from "@effect-ontology/Rdf/Types.ts"
 * import * as S from "effect/Schema"
 *
 * const term = S.decodeUnknownSync(ObjectTerm)("_:result")
 * console.log(term) // "_:result"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObjectTerm = RdfTerm.pipe(
  $I.annoteSchema("ObjectTerm", {
    description: "Named-node, blank-node, or literal RDF term accepted in object position.",
    toArbitrary: () => S.toArbitrary(RdfTerm),
  })
);

/**
 * Decoded object-position RDF term produced by the {@link ObjectTerm} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ObjectTerm = typeof ObjectTerm.Type;

const TripleFields = {
  /** IRI or blank node naming the statement subject. */
  subject: S.Union([IRI, BlankNode]).pipe(
    $I.annoteKey("Triple.subject", {
      description: "IRI or blank node naming the statement subject.",
    })
  ),
  /** IRI naming the statement predicate. */
  predicate: IRI.pipe(
    $I.annoteKey("Triple.predicate", {
      description: "IRI naming the statement predicate.",
    })
  ),
  /** IRI, blank node, or literal in the statement object position. */
  object: RdfTerm.pipe(
    $I.annoteKey("Triple.object", {
      description: "IRI, blank node, or literal in the statement object position.",
    })
  ),
} as const;

/**
 * Graph-independent RDF statement.
 *
 * **Example** (Decode and serialize a triple)
 *
 * ```ts
 * import { Triple } from "@effect-ontology/Rdf/Types.ts"
 * import * as S from "effect/Schema"
 *
 * const triple = S.decodeUnknownSync(Triple)({
 *   subject: "https://example.org/ada",
 *   predicate: "https://schema.org/name",
 *   object: { value: "Ada" }
 * })
 * console.log(triple.toJSON()._tag) // "Triple"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Triple extends S.Class<Triple>($I`Triple`)(
  TripleFields,
  $I.annote("Triple", {
    description: "Graph-independent RDF statement containing subject, predicate, and object terms.",
  })
) {
  /**
   * Converts this triple to its stable tagged JSON representation.
   *
   * **Example** (Read the serialized predicate)
   *
   * ```ts
   * import { Triple } from "@effect-ontology/Rdf/Types.ts"
   * import * as S from "effect/Schema"
   *
   * const triple = S.decodeUnknownSync(Triple)({
   *   subject: "https://example.org/ada",
   *   predicate: "https://schema.org/name",
   *   object: { value: "Ada" }
   * })
   * console.log(triple.toJSON().predicate) // "https://schema.org/name"
   * ```
   *
   * @returns A tagged plain object whose literal object is recursively serialized.
   * @since 0.0.0
   */
  toJSON() {
    return {
      _tag: "Triple" as const,
      subject: this.subject,
      predicate: this.predicate,
      object: S.is(Literal)(this.object) ? this.object.toJSON() : this.object,
    };
  }
}

const QuadFields = {
  ...TripleFields,
  /** Optional named-graph IRI; absence denotes the default graph. */
  graph: IRI.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    $I.annoteKey("Quad.graph", {
      description: "Optional named-graph IRI; absence denotes the default graph.",
    })
  ),
} as const;

/**
 * RDF statement with optional named-graph scope.
 *
 * **Example** (Decode a named-graph quad)
 *
 * ```ts
 * import { Quad } from "@effect-ontology/Rdf/Types.ts"
 * import * as S from "effect/Schema"
 *
 * const quad = S.decodeUnknownSync(Quad)({
 *   subject: "https://example.org/ada",
 *   predicate: "https://schema.org/name",
 *   object: { value: "Ada" },
 *   graph: "https://example.org/people"
 * })
 * console.log(quad.toJSON()._tag) // "Quad"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Quad extends S.Class<Quad>($I`Quad`)(
  QuadFields,
  $I.annote("Quad", {
    description: "RDF statement with optional named-graph scope.",
  })
) {
  /**
   * Discards graph scope and returns the corresponding triple.
   *
   * **Example** (Project a quad to a triple)
   *
   * ```ts
   * import { Quad } from "@effect-ontology/Rdf/Types.ts"
   * import * as S from "effect/Schema"
   *
   * const quad = S.decodeUnknownSync(Quad)({
   *   subject: "https://example.org/ada",
   *   predicate: "https://schema.org/name",
   *   object: { value: "Ada" }
   * })
   * console.log(quad.toTriple().toJSON()._tag) // "Triple"
   * ```
   *
   * @returns A graph-independent triple containing the same RDF terms.
   * @since 0.0.0
   */
  toTriple(): Triple {
    return Triple.make({
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    });
  }

  /**
   * Converts this quad to its stable tagged JSON representation.
   *
   * **Example** (Read the serialized graph)
   *
   * ```ts
   * import { Quad } from "@effect-ontology/Rdf/Types.ts"
   * import * as S from "effect/Schema"
   *
   * const quad = S.decodeUnknownSync(Quad)({
   *   subject: "https://example.org/ada",
   *   predicate: "https://schema.org/name",
   *   object: { value: "Ada" },
   *   graph: "https://example.org/people"
   * })
   * console.log(quad.toJSON().graph) // "https://example.org/people"
   * ```
   *
   * @returns A tagged plain object whose optional graph is encoded as `undefined` when absent.
   * @since 0.0.0
   */
  toJSON() {
    return {
      _tag: "Quad" as const,
      subject: this.subject,
      predicate: this.predicate,
      object: S.is(Literal)(this.object) ? this.object.toJSON() : this.object,
      graph: O.getOrUndefined(this.graph),
    };
  }
}

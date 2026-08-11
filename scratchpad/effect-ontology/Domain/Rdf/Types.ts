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
 * const person = IRI.fromUnknown("https://schema.org/Person")
 * ```
 *
 * @category Schemas
 * @since 0.0.0
 */
export const IRI = CanonicalIRI.pipe(
  $I.annoteSchema("IRI", {
    description: "Canonical RFC 3987 IRI represented as a branded string.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime value accepted by {@link IRI}. @since 0.0.0 */
export type IRI = typeof IRI.Type;

/**
 * RDF named-node identifier represented as a validated branded IRI string.
 *
 * @category Schemas
 * @since 0.0.0
 */
export const NamedNode = IRI.pipe(
  $I.annoteSchema("NamedNode", {
    description: "RDF named-node identifier represented as a validated branded IRI string.",
  })
);

/** Decoded RDF named-node identifier. @since 0.0.0 */
export type NamedNode = typeof NamedNode.Type;

/** Backward-compatible schema name for {@link IRI}. @since 0.0.0 */
export const IriSchema = IRI;

/**
 * Absolute IRI without a fragment component.
 *
 * **Example** (Create an ontology IRI)
 *
 * ```ts
 * const ontology = AbsoluteIRI.fromUnknown("https://example.org/ontology")
 * ```
 *
 * @category Schemas
 * @since 0.0.0
 */
export const AbsoluteIRI = CanonicalAbsoluteIRI.pipe(
  $I.annoteSchema("AbsoluteIRI", {
    description: "Canonical absolute IRI without a fragment component.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime value accepted by {@link AbsoluteIRI}. @since 0.0.0 */
export type AbsoluteIRI = typeof AbsoluteIRI.Type;

/**
 * Turtle-safe local component of an RDF name.
 *
 * **Example** (Create a local name)
 *
 * ```ts
 * const label = LocalName.fromUnknown("prefLabel")
 * ```
 *
 * @category Schemas
 * @since 0.0.0
 */
export const LocalName = SafePnLocal.pipe(
  S.brand("LocalName"),
  $I.annoteSchema("LocalName", {
    description: "Turtle-safe PN_LOCAL value used as the local component of an IRI.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime value accepted by {@link LocalName}. @since 0.0.0 */
export type LocalName = typeof LocalName.Type;

/**
 * RDF blank-node identifier, including the `_:` prefix.
 *
 * **Example** (Create a blank node)
 *
 * ```ts
 * const node = BlankNode.make("_:b0")
 * ```
 *
 * @category Schemas
 * @since 0.0.0
 */
export const BlankNode = S.TemplateLiteral(["_:", S.NonEmptyString]).pipe(
  S.brand("BlankNode"),
  $I.annoteSchema("BlankNode", {
    description: "RDF blank-node identifier beginning with the `_:` prefix.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime value accepted by {@link BlankNode}. @since 0.0.0 */
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
 * const count = Literal.make({
 *   value: "42",
 *   datatype: O.some(IRI.make("http://www.w3.org/2001/XMLSchema#integer"))
 * })
 * ```
 *
 * @category Models
 * @since 0.0.0
 */
export class Literal extends S.Class<Literal>($I`Literal`)(
  LiteralFields,
  $I.annote("Literal", {
    description: "RDF literal with a lexical value and optional language or datatype qualifier.",
  })
) {
  /** Convert the literal to its stable JSON representation. @since 0.0.0 */
  toJSON() {
    return {
      _tag: "Literal" as const,
      value: this.value,
      language: O.getOrUndefined(this.language),
      datatype: O.getOrUndefined(this.datatype),
    };
  }
}

/**
 * RDF term accepted in an object position.
 *
 * @category Schemas
 * @since 0.0.0
 */
export const RdfTerm = S.Union([IRI, BlankNode, Literal]).pipe(
  $I.annoteSchema("RdfTerm", {
    description: "IRI, blank node, or literal accepted in an RDF object position.",
  })
);

/** Runtime value accepted by {@link RdfTerm}. @since 0.0.0 */
export type RdfTerm = typeof RdfTerm.Type;

/**
 * RDF term accepted in object position.
 *
 * @category Schemas
 * @since 0.0.0
 */
export const ObjectTerm = RdfTerm.pipe(
  $I.annoteSchema("ObjectTerm", {
    description: "Named-node, blank-node, or literal RDF term accepted in object position.",
  })
);

/** Decoded RDF object-position term. @since 0.0.0 */
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
 * @category Models
 * @since 0.0.0
 */
export class Triple extends S.Class<Triple>($I`Triple`)(
  TripleFields,
  $I.annote("Triple", {
    description: "Graph-independent RDF statement containing subject, predicate, and object terms.",
  })
) {
  /** Convert the triple to its stable JSON representation. @since 0.0.0 */
  toJSON() {
    return {
      _tag: "Triple" as const,
      subject: this.subject,
      predicate: this.predicate,
      object: this.object instanceof Literal ? this.object.toJSON() : this.object,
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
 * @category Models
 * @since 0.0.0
 */
export class Quad extends S.Class<Quad>($I`Quad`)(
  QuadFields,
  $I.annote("Quad", {
    description: "RDF statement with optional named-graph scope.",
  })
) {
  /** Discard graph scope and return the corresponding triple. @since 0.0.0 */
  toTriple(): Triple {
    return Triple.make({
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    });
  }

  /** Convert the quad to its stable JSON representation. @since 0.0.0 */
  toJSON() {
    return {
      _tag: "Quad" as const,
      subject: this.subject,
      predicate: this.predicate,
      object: this.object instanceof Literal ? this.object.toJSON() : this.object,
      graph: O.getOrUndefined(this.graph),
    };
  }
}

export * from "./Constants.ts";

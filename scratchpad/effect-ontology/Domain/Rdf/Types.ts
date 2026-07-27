/**
 * RDF value types for the effect-ontology experiment.
 *
 * @remarks
 * The module deliberately reuses `@beep/rdf` as the sole RDF and IRI truth.
 * Terms therefore use the RDF/JS tagged representation rather than the
 * upstream module's ambiguous branded strings. The only local RDF model is a
 * graph-free {@link Triple}, which projects losslessly to a canonical quad in
 * the default graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SafePnLocal } from "@beep/identity";
import { $ScratchpadId } from "@beep/identity/packages";
import { AbsoluteIRI as CanonicalAbsoluteIRI, IRI as CanonicalIRI } from "@beep/rdf/Iri";
import {
  BlankNode as CanonicalBlankNode,
  Dataset as CanonicalDataset,
  DefaultGraph as CanonicalDefaultGraph,
  GraphTerm as CanonicalGraphTerm,
  Literal as CanonicalLiteral,
  NamedNode as CanonicalNamedNode,
  NamespaceBinding as CanonicalNamespaceBinding,
  ObjectTerm as CanonicalObjectTerm,
  PrefixLabel as CanonicalPrefixLabel,
  PrefixMap as CanonicalPrefixMap,
  Quad as CanonicalQuad,
  Subject as CanonicalSubject,
  Term as CanonicalTerm,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
} from "@beep/rdf/Rdf";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Domain/Rdf/Types");

const IriFromSelf = S.declare((input: unknown): input is CanonicalIRI => CanonicalIRI.is(input)).annotate({
  toArbitrary: () => (fc) => fc.uuid().map((id) => CanonicalIRI.fromUnknown(`https://example.test/resource/${id}`)),
});

/**
 * Canonical RFC 3987 IRI used throughout the port.
 *
 * @remarks
 * Decoding remains delegated to `@beep/rdf`. The declaration layer makes the
 * already-validated branded value transparent to `Schema.toArbitrary`, so
 * property tests do not silently rely on an opaque refinement filter.
 *
 * @example
 * ```ts
 * import { IRI } from "@effect-ontology/Rdf/Types.ts"
 *
 * const iri = IRI.fromUnknown("https://example.org/alice")
 * console.log(IRI.is(iri)) // true
 * ```
 *
 * @invariant Satisfies the repository's canonical RFC 3987 IRI grammar.
 * @category identifiers
 * @since 0.0.0
 */
export const IRI = CanonicalIRI.pipe(
  S.decodeTo(IriFromSelf),
  $I.annoteSchema("IRI", {
    description: "Canonical RFC 3987 IRI with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link IRI}.
 *
 * @example
 * ```ts
 * import { IRI, type IRI as IriValue } from "@effect-ontology/Rdf/Types.ts"
 *
 * const iri: IriValue = IRI.fromUnknown("https://example.org/id")
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IRI = typeof IRI.Type;

const AbsoluteIriFromSelf = S.declare((input: unknown): input is CanonicalAbsoluteIRI =>
  CanonicalAbsoluteIRI.is(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc.uuid().map((id) => CanonicalAbsoluteIRI.fromUnknown(`https://example.test/resource/${id}`)),
});

/**
 * Canonical absolute RFC 3987 IRI without a fragment.
 *
 * @remarks
 * This codec preserves canonical decoding while exposing a constructive,
 * warning-free generator for nested schemas.
 *
 * @example
 * ```ts
 * import { AbsoluteIRI } from "@effect-ontology/Rdf/Types.ts"
 *
 * const iri = AbsoluteIRI.fromUnknown("https://example.org/ontology")
 * console.log(AbsoluteIRI.is(iri)) // true
 * ```
 *
 * @invariant Is absolute and contains no fragment component.
 * @category identifiers
 * @since 0.0.0
 */
export const AbsoluteIRI = CanonicalAbsoluteIRI.pipe(
  S.decodeTo(AbsoluteIriFromSelf),
  $I.annoteSchema("AbsoluteIRI", {
    description: "Canonical fragment-free absolute IRI with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link AbsoluteIRI}.
 *
 * @example
 * ```ts
 * import { AbsoluteIRI, type AbsoluteIRI as AbsoluteIriValue } from "@effect-ontology/Rdf/Types.ts"
 *
 * const iri: AbsoluteIriValue =
 *   AbsoluteIRI.fromUnknown("https://example.org/ontology")
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AbsoluteIRI = typeof AbsoluteIRI.Type;

const LocalNameEncoded = SafePnLocal.pipe(S.brand("LocalName"));
const LocalNameFromSelf = S.declare((input: unknown): input is typeof LocalNameEncoded.Type =>
  S.is(LocalNameEncoded)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc.constantFrom("Person", "prefLabel", "has_member").map(S.decodeUnknownSync(LocalNameEncoded)),
});

/**
 * Turtle-safe local component of an RDF name.
 *
 * @remarks
 * This schema strengthens the upstream unvalidated string by reusing the
 * repository's canonical PN_LOCAL grammar and adding a domain-specific brand.
 *
 * @example
 * ```ts
 * import { LocalName } from "@effect-ontology/Rdf/Types.ts"
 *
 * const local = LocalName.fromUnknown("prefLabel")
 * console.log(LocalName.is(local)) // true
 * ```
 *
 * @invariant Can be emitted as an unescaped Turtle PN_LOCAL value.
 * @category value-objects
 * @since 0.0.0
 */
export const LocalName = LocalNameEncoded.pipe(
  S.decodeTo(LocalNameFromSelf),
  $I.annoteSchema("LocalName", {
    description: "Turtle-safe local name validated by the canonical PN_LOCAL grammar.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link LocalName}. {@inheritDoc LocalName}
 *
 * @example
 * ```ts
 * import { LocalName, type LocalName as LocalNameValue } from "@effect-ontology/Rdf/Types.ts"
 *
 * const local: LocalNameValue = LocalName.fromUnknown("Person")
 * console.log(local)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LocalName = typeof LocalName.Type;

const NamedNodeFromSelf = S.declare((input: unknown): input is CanonicalNamedNode =>
  S.is(CanonicalNamedNode)(input)
).annotate({
  toArbitrary: () => (fc) => fc.uuid().map((id) => makeNamedNode(`https://example.test/resource/${id}`)),
});

/**
 * Canonical RDF/JS named node.
 *
 * @remarks
 * Values remain instances of the repository's canonical `NamedNode` class.
 * The declaration codec only supplies constructive arbitrary metadata.
 *
 * @example
 * ```ts
 * import { makeNamedNode, NamedNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node = makeNamedNode("https://example.org/alice")
 * console.log(NamedNode.is(node)) // true
 * ```
 *
 * @invariant `termType` is `NamedNode` and `value` is a canonical IRI.
 * @category rdf-terms
 * @since 0.0.0
 */
export const NamedNode = CanonicalNamedNode.pipe(
  S.decodeTo(NamedNodeFromSelf),
  $I.annoteSchema("NamedNode", {
    description: "Canonical RDF/JS named node with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link NamedNode}.
 *
 * @example
 * ```ts
 * import { makeNamedNode, type NamedNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node: NamedNode = makeNamedNode("https://example.org/alice")
 * console.log(node.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NamedNode = typeof NamedNode.Type;

const BlankNodeFromSelf = S.declare((input: unknown): input is CanonicalBlankNode =>
  S.is(CanonicalBlankNode)(input)
).annotate({
  toArbitrary: () => (fc) => fc.uuid().map((id) => makeBlankNode(`b${Str.replace(/-/g, "")(id)}`)),
});

/**
 * Canonical RDF/JS blank node.
 *
 * @example
 * ```ts
 * import { BlankNode, makeBlankNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node = makeBlankNode("b0")
 * console.log(BlankNode.is(node)) // true
 * ```
 *
 * @invariant Carries a non-empty, trimmed blank-node label.
 * @category rdf-terms
 * @since 0.0.0
 */
export const BlankNode = CanonicalBlankNode.pipe(
  S.decodeTo(BlankNodeFromSelf),
  $I.annoteSchema("BlankNode", {
    description: "Canonical RDF/JS blank node with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link BlankNode}.
 *
 * @example
 * ```ts
 * import { makeBlankNode, type BlankNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node: BlankNode = makeBlankNode("b0")
 * console.log(node.value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BlankNode = typeof BlankNode.Type;

const LiteralFromSelf = S.declare((input: unknown): input is CanonicalLiteral =>
  S.is(CanonicalLiteral)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(fc.string(), fc.uuid())
      .map(([value, datatypeId]) => makeLiteral(value, `https://example.test/datatype/${datatypeId}`)),
});

/**
 * Canonical RDF/JS literal.
 *
 * @example
 * ```ts
 * import { Literal, makeLiteral } from "@effect-ontology/Rdf/Types.ts"
 *
 * const literal = makeLiteral(
 *   "Alice",
 *   "http://www.w3.org/2001/XMLSchema#string"
 * )
 * console.log(Literal.is(literal)) // true
 * ```
 *
 * @invariant Carries a lexical form, datatype named node, and normalized
 * optional language tag.
 * @category rdf-terms
 * @since 0.0.0
 */
export const Literal = CanonicalLiteral.pipe(
  S.decodeTo(LiteralFromSelf),
  $I.annoteSchema("Literal", {
    description: "Canonical RDF/JS literal with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link Literal}.
 *
 * @example
 * ```ts
 * import { makeLiteral, type Literal } from "@effect-ontology/Rdf/Types.ts"
 *
 * const literal: Literal = makeLiteral(
 *   "42",
 *   "http://www.w3.org/2001/XMLSchema#integer"
 * )
 * console.log(literal.value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Literal = typeof Literal.Type;

const DefaultGraphFromSelf = S.declare((input: unknown): input is CanonicalDefaultGraph =>
  S.is(CanonicalDefaultGraph)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc.constant(
      CanonicalDefaultGraph.make({
        termType: "DefaultGraph",
        value: "",
      })
    ),
});

/**
 * Canonical RDF/JS default-graph term.
 *
 * @example
 * ```ts
 * import { DefaultGraph } from "@effect-ontology/Rdf/Types.ts"
 *
 * const graph = DefaultGraph.fromUnknown({
 *   termType: "DefaultGraph",
 *   value: ""
 * })
 * console.log(graph.termType) // "DefaultGraph"
 * ```
 *
 * @invariant Carries the fixed `DefaultGraph` discriminator and empty value.
 * @category rdf-terms
 * @since 0.0.0
 */
export const DefaultGraph = CanonicalDefaultGraph.pipe(
  S.decodeTo(DefaultGraphFromSelf),
  $I.annoteSchema("DefaultGraph", {
    description: "Canonical RDF/JS default graph with a transparent property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link DefaultGraph}.
 *
 * @example
 * ```ts
 * import { DefaultGraph, type DefaultGraph as DefaultGraphValue } from "@effect-ontology/Rdf/Types.ts"
 *
 * const graph: DefaultGraphValue = DefaultGraph.fromUnknown({
 *   termType: "DefaultGraph",
 *   value: ""
 * })
 * console.log(graph.value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DefaultGraph = typeof DefaultGraph.Type;

const TermFromSelf = S.declare((input: unknown): input is CanonicalTerm => CanonicalTerm.is(input)).annotate({
  toArbitrary: () => (fc) =>
    fc.oneof(S.toArbitrary(NamedNode), S.toArbitrary(BlankNode), S.toArbitrary(Literal), S.toArbitrary(DefaultGraph)),
});

/**
 * Canonical discriminated RDF/JS term family.
 *
 * @example
 * ```ts
 * import { makeNamedNode, Term } from "@effect-ontology/Rdf/Types.ts"
 *
 * const term = makeNamedNode("https://example.org/alice")
 * console.log(Term.match(term, {
 *   NamedNode: ({ value }) => value,
 *   BlankNode: ({ value }) => value,
 *   Literal: ({ value }) => value,
 *   DefaultGraph: () => "default"
 * }))
 * ```
 *
 * @invariant Every member is discriminated by `termType`.
 * @category tagged-unions
 * @since 0.0.0
 */
export const Term = CanonicalTerm.pipe(
  S.decodeTo(TermFromSelf),
  $I.annoteSchema("Term", {
    description: "Canonical discriminated RDF/JS term family.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    cases: CanonicalTerm.cases,
    discriminants: CanonicalTerm.discriminants,
    guards: CanonicalTerm.guards,
    isAnyOf: CanonicalTerm.isAnyOf,
    match: CanonicalTerm.match,
  }))
);

/**
 * Runtime value decoded by {@link Term}.
 *
 * @example
 * ```ts
 * import { makeBlankNode, type Term } from "@effect-ontology/Rdf/Types.ts"
 *
 * const term: Term = makeBlankNode("b0")
 * console.log(term.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Term = typeof Term.Type;

const SubjectFromSelf = S.declare((input: unknown): input is CanonicalSubject => CanonicalSubject.is(input)).annotate({
  toArbitrary: () => (fc) => fc.oneof(S.toArbitrary(NamedNode), S.toArbitrary(BlankNode)),
});

/**
 * RDF term permitted in subject position.
 *
 * @example
 * ```ts
 * import { makeNamedNode, Subject } from "@effect-ontology/Rdf/Types.ts"
 *
 * console.log(Subject.is(makeNamedNode("https://example.org/alice"))) // true
 * ```
 *
 * @invariant Is either a named node or a blank node.
 * @category tagged-unions
 * @since 0.0.0
 */
export const Subject = CanonicalSubject.pipe(
  S.decodeTo(SubjectFromSelf),
  $I.annoteSchema("Subject", {
    description: "Named-node or blank-node RDF subject.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    cases: CanonicalSubject.cases,
    discriminants: CanonicalSubject.discriminants,
    guards: CanonicalSubject.guards,
    isAnyOf: CanonicalSubject.isAnyOf,
    match: CanonicalSubject.match,
  }))
);

/**
 * Runtime value decoded by {@link Subject}.
 *
 * @example
 * ```ts
 * import { makeBlankNode, type Subject } from "@effect-ontology/Rdf/Types.ts"
 *
 * const subject: Subject = makeBlankNode("subject0")
 * console.log(subject.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Subject = typeof Subject.Type;

const ObjectTermFromSelf = S.declare((input: unknown): input is CanonicalObjectTerm =>
  CanonicalObjectTerm.is(input)
).annotate({
  toArbitrary: () => (fc) => fc.oneof(S.toArbitrary(NamedNode), S.toArbitrary(BlankNode), S.toArbitrary(Literal)),
});

/**
 * RDF term permitted in object position.
 *
 * @example
 * ```ts
 * import { makeLiteral, ObjectTerm } from "@effect-ontology/Rdf/Types.ts"
 *
 * const object = makeLiteral(
 *   "Alice",
 *   "http://www.w3.org/2001/XMLSchema#string"
 * )
 * console.log(ObjectTerm.is(object)) // true
 * ```
 *
 * @invariant Is a named node, blank node, or literal.
 * @category tagged-unions
 * @since 0.0.0
 */
export const ObjectTerm = CanonicalObjectTerm.pipe(
  S.decodeTo(ObjectTermFromSelf),
  $I.annoteSchema("ObjectTerm", {
    description: "Named-node, blank-node, or literal RDF object.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    cases: CanonicalObjectTerm.cases,
    discriminants: CanonicalObjectTerm.discriminants,
    guards: CanonicalObjectTerm.guards,
    isAnyOf: CanonicalObjectTerm.isAnyOf,
    match: CanonicalObjectTerm.match,
  }))
);

/**
 * Runtime value decoded by {@link ObjectTerm}.
 *
 * @example
 * ```ts
 * import { makeNamedNode, type ObjectTerm } from "@effect-ontology/Rdf/Types.ts"
 *
 * const object: ObjectTerm = makeNamedNode("https://example.org/value")
 * console.log(object.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ObjectTerm = typeof ObjectTerm.Type;

const GraphTermFromSelf = S.declare((input: unknown): input is CanonicalGraphTerm =>
  CanonicalGraphTerm.is(input)
).annotate({
  toArbitrary: () => (fc) => fc.oneof(S.toArbitrary(NamedNode), S.toArbitrary(BlankNode), S.toArbitrary(DefaultGraph)),
});

/**
 * RDF term permitted in graph position.
 *
 * @example
 * ```ts
 * import { DefaultGraph, GraphTerm } from "@effect-ontology/Rdf/Types.ts"
 *
 * const graph = DefaultGraph.fromUnknown({
 *   termType: "DefaultGraph",
 *   value: ""
 * })
 * console.log(GraphTerm.is(graph)) // true
 * ```
 *
 * @invariant Is a named node, blank node, or default graph.
 * @category tagged-unions
 * @since 0.0.0
 */
export const GraphTerm = CanonicalGraphTerm.pipe(
  S.decodeTo(GraphTermFromSelf),
  $I.annoteSchema("GraphTerm", {
    description: "Named-node, blank-node, or default-graph RDF graph term.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    cases: CanonicalGraphTerm.cases,
    discriminants: CanonicalGraphTerm.discriminants,
    guards: CanonicalGraphTerm.guards,
    isAnyOf: CanonicalGraphTerm.isAnyOf,
    match: CanonicalGraphTerm.match,
  }))
);

/**
 * Runtime value decoded by {@link GraphTerm}.
 *
 * @example
 * ```ts
 * import { makeBlankNode, type GraphTerm } from "@effect-ontology/Rdf/Types.ts"
 *
 * const graph: GraphTerm = makeBlankNode("graph0")
 * console.log(graph.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraphTerm = typeof GraphTerm.Type;

const QuadFromSelf = S.declare((input: unknown): input is CanonicalQuad => S.is(CanonicalQuad)(input)).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(S.toArbitrary(Subject), S.toArbitrary(NamedNode), S.toArbitrary(ObjectTerm), S.toArbitrary(GraphTerm))
      .map(([subject, predicate, object, graph]) => CanonicalQuad.make({ subject, predicate, object, graph })),
});

/**
 * Canonical RDF/JS quad.
 *
 * @example
 * ```ts
 * import { makeLiteral, makeNamedNode, makeQuad, Quad } from "@effect-ontology/Rdf/Types.ts"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * console.log(Quad.is(quad)) // true
 * ```
 *
 * @invariant Subject, predicate, object, and graph obey RDF/JS position rules.
 * @category models
 * @since 0.0.0
 */
export const Quad = CanonicalQuad.pipe(
  S.decodeTo(QuadFromSelf),
  $I.annoteSchema("Quad", {
    description: "Canonical RDF/JS quad with a constructive property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link Quad}.
 *
 * @example
 * ```ts
 * import { makeLiteral, makeNamedNode, makeQuad, type Quad } from "@effect-ontology/Rdf/Types.ts"
 *
 * const quad: Quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * console.log(quad.graph.termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Quad = typeof Quad.Type;

const DatasetFromSelf = S.declare((input: unknown): input is CanonicalDataset =>
  S.is(CanonicalDataset)(input)
).annotate({
  toArbitrary: () => (fc) => fc.array(S.toArbitrary(Quad), { maxLength: 8 }).map(makeDataset),
});

/**
 * Canonical collection of RDF/JS quads.
 *
 * @example
 * ```ts
 * import { Dataset, makeDataset } from "@effect-ontology/Rdf/Types.ts"
 *
 * const dataset = makeDataset([])
 * console.log(Dataset.is(dataset)) // true
 * ```
 *
 * @invariant Every element is a valid canonical RDF quad.
 * @category models
 * @since 0.0.0
 */
export const Dataset = CanonicalDataset.pipe(
  S.decodeTo(DatasetFromSelf),
  $I.annoteSchema("Dataset", {
    description: "Canonical RDF dataset with a constructive property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link Dataset}.
 *
 * @example
 * ```ts
 * import { makeDataset, type Dataset } from "@effect-ontology/Rdf/Types.ts"
 *
 * const dataset: Dataset = makeDataset([])
 * console.log(dataset.quads.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Dataset = typeof Dataset.Type;

const NamespaceBindingFromSelf = S.declare((input: unknown): input is CanonicalNamespaceBinding =>
  S.is(CanonicalNamespaceBinding)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc.uuid().map((id) =>
      CanonicalNamespaceBinding.make({
        prefix: CanonicalPrefixLabel.fromUnknown("ex"),
        namespace: CanonicalIRI.fromUnknown(`https://example.test/namespace/${id}/`),
      })
    ),
});

/**
 * Canonical RDF prefix-to-namespace binding.
 *
 * @example
 * ```ts
 * import { NamespaceBinding } from "@effect-ontology/Rdf/Types.ts"
 *
 * const binding = NamespaceBinding.fromUnknown({
 *   prefix: "schema",
 *   namespace: "https://schema.org/"
 * })
 * console.log(binding.prefix)
 * ```
 *
 * @invariant Prefix syntax and namespace IRI are validated canonically.
 * @category models
 * @since 0.0.0
 */
export const NamespaceBinding = CanonicalNamespaceBinding.pipe(
  S.decodeTo(NamespaceBindingFromSelf),
  $I.annoteSchema("NamespaceBinding", {
    description: "Canonical RDF namespace binding with a constructive property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link NamespaceBinding}.
 *
 * @example
 * ```ts
 * import { NamespaceBinding, type NamespaceBinding as Binding } from "@effect-ontology/Rdf/Types.ts"
 *
 * const binding: Binding = NamespaceBinding.fromUnknown({
 *   prefix: "schema",
 *   namespace: "https://schema.org/"
 * })
 * console.log(binding.namespace)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NamespaceBinding = typeof NamespaceBinding.Type;

const PrefixMapFromSelf = S.declare((input: unknown): input is CanonicalPrefixMap =>
  CanonicalPrefixMap.is(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc.constantFrom(
      CanonicalPrefixMap.fromUnknown({}),
      CanonicalPrefixMap.fromUnknown({
        schema: "https://schema.org/",
      }),
      CanonicalPrefixMap.fromUnknown({
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      })
    ),
});

/**
 * Canonical map from RDF prefix labels to namespace IRIs.
 *
 * @example
 * ```ts
 * import { PrefixMap } from "@effect-ontology/Rdf/Types.ts"
 *
 * const prefixes = PrefixMap.fromUnknown({ schema: "https://schema.org/" })
 * console.log(Object.values(prefixes)[0])
 * ```
 *
 * @invariant Every key is a valid prefix label and every value is an IRI.
 * @category collections
 * @since 0.0.0
 */
export const PrefixMap = CanonicalPrefixMap.pipe(
  S.decodeTo(PrefixMapFromSelf),
  $I.annoteSchema("PrefixMap", {
    description: "Canonical RDF prefix map with an explicit property-testing generator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link PrefixMap}.
 *
 * @example
 * ```ts
 * import { PrefixMap, type PrefixMap as Prefixes } from "@effect-ontology/Rdf/Types.ts"
 *
 * const prefixes: Prefixes =
 *   PrefixMap.fromUnknown({ schema: "https://schema.org/" })
 * console.log(Object.keys(prefixes))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PrefixMap = typeof PrefixMap.Type;

const TripleFields = {
  subject: Subject.annotateKey({
    description: "Named or blank RDF subject.",
  }),
  predicate: NamedNode.annotateKey({
    description: "Named-node RDF predicate.",
  }),
  object: ObjectTerm.annotateKey({
    description: "Named, blank, or literal RDF object.",
  }),
};

class TripleModel extends S.Class<TripleModel>($I`Triple`)(
  TripleFields,
  $I.annote("Triple", {
    description: "Graph-free RDF statement backed by canonical RDF/JS term schemas.",
  })
) {}

/**
 * RDF statement without a named-graph component.
 *
 * @remarks
 * RDF/JS represents statements as quads. This schema preserves the upstream
 * graph-free contract while {@link Triple.toQuad} adds a canonical default
 * graph and {@link Triple.fromQuad} discards a quad's graph explicitly.
 *
 * @example
 * ```ts
 * import { makeLiteral, makeNamedNode, Triple } from "@effect-ontology/Rdf/Types.ts"
 *
 * const triple = Triple.make({
 *   subject: makeNamedNode("https://example.org/alice"),
 *   predicate: makeNamedNode("https://schema.org/name"),
 *   object: makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * })
 * console.log(Triple.toQuad(triple).graph.termType) // "DefaultGraph"
 * ```
 *
 * @invariant Subject, predicate, and object obey the canonical RDF/JS term
 * constraints.
 * @category models
 * @since 0.0.0
 */
export const Triple = TripleModel.annotate({
  toArbitrary: () => () => S.toArbitrary(S.Struct(TripleFields)).map((fields) => TripleModel.make(fields)),
}).pipe(
  $I.annoteSchema("Triple", {
    description: "Graph-free RDF statement backed by canonical RDF/JS term schemas.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    toQuad: (triple: TripleModel): Quad => makeQuad(triple.subject, triple.predicate, triple.object),
    fromQuad: (quad: Quad): TripleModel =>
      TripleModel.make({
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
      }),
  }))
);

/**
 * Runtime value decoded by {@link Triple}. {@inheritDoc Triple}
 *
 * @example
 * ```ts
 * import { makeNamedNode, type Triple } from "@effect-ontology/Rdf/Types.ts"
 *
 * const node = makeNamedNode("https://example.org/value")
 * const triple: Triple = { subject: node, predicate: node, object: node }
 * console.log(triple.object.termType) // "NamedNode"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Triple = typeof Triple.Type;

/**
 * Canonical RDF term runtime type.
 *
 * @example
 * ```ts
 * import { makeNamedNode, type RdfTerm } from "@effect-ontology/Rdf/Types.ts"
 *
 * const term: RdfTerm = makeNamedNode("https://example.org/alice")
 * console.log(term.termType) // "NamedNode"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RdfTerm = Term;

export {
  /**
   * Compatibility export for the upstream blank-node schema name.
   *
   * @remarks
   * The encoded value is now an RDF/JS object with `termType: "BlankNode"` and a
   * label without the upstream `_:` prefix.
   *
   * @example
   * ```ts
   * import { BlankNodeSchema, makeBlankNode } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(BlankNodeSchema.is(makeBlankNode("b0"))) // true
   * ```
   *
   * @deprecated Use the canonical {@link BlankNode} RDF/JS class.
   * @category interop
   * @since 0.0.0
   */
  BlankNode as BlankNodeSchema,
  /**
   * Compatibility export for the upstream IRI schema name.
   *
   * @example
   * ```ts
   * import { IriSchema } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(IriSchema.is("https://example.org/alice")) // true
   * ```
   *
   * @deprecated Use the canonical {@link IRI} schema.
   * @category interop
   * @since 0.0.0
   */
  IRI as IriSchema,
  /**
   * Compatibility export for the upstream local-name schema name.
   *
   * @example
   * ```ts
   * import { LocalNameSchema } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(LocalNameSchema.is("prefLabel")) // true
   * ```
   *
   * @deprecated Use {@link LocalName}; new schema values omit the `Schema` suffix.
   * @category interop
   * @since 0.0.0
   */
  LocalName as LocalNameSchema,
  /**
   * Constructs a canonical RDF/JS blank node from its label.
   *
   * @example
   * ```ts
   * import { makeBlankNode } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(makeBlankNode("b0").termType) // "BlankNode"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  makeBlankNode,
  /**
   * Constructs a canonical immutable RDF dataset from quads.
   *
   * @example
   * ```ts
   * import { makeDataset } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(makeDataset([]).quads.length) // 0
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  makeDataset,
  /**
   * Constructs a canonical RDF/JS literal from lexical and datatype values.
   *
   * @example
   * ```ts
   * import { makeLiteral } from "@effect-ontology/Rdf/Types.ts"
   *
   * const value = makeLiteral("42", "http://www.w3.org/2001/XMLSchema#integer")
   * console.log(value.termType) // "Literal"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  makeLiteral,
  /**
   * Constructs a canonical RDF/JS named node from an IRI.
   *
   * @example
   * ```ts
   * import { makeNamedNode } from "@effect-ontology/Rdf/Types.ts"
   *
   * const node = makeNamedNode("https://example.org/alice")
   * console.log(node.termType) // "NamedNode"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  makeNamedNode,
  /**
   * Constructs a canonical RDF/JS quad in the default graph.
   *
   * @example
   * ```ts
   * import { makeLiteral, makeNamedNode, makeQuad } from "@effect-ontology/Rdf/Types.ts"
   *
   * const quad = makeQuad(
   *   makeNamedNode("https://example.org/alice"),
   *   makeNamedNode("https://schema.org/name"),
   *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
   * )
   * console.log(quad.predicate.termType) // "NamedNode"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  makeQuad,
  /**
   * Compatibility export for the upstream RDF-term schema name.
   *
   * @remarks
   * The encoded value now uses canonical RDF/JS discriminators instead of
   * ambiguous string brands and `instanceof` checks.
   *
   * @example
   * ```ts
   * import { makeNamedNode, RdfTermSchema } from "@effect-ontology/Rdf/Types.ts"
   *
   * console.log(RdfTermSchema.is(makeNamedNode("https://example.org/alice"))) // true
   * ```
   *
   * @deprecated Use the canonical {@link Term} tagged union.
   * @category interop
   * @since 0.0.0
   */
  Term as RdfTermSchema,
};

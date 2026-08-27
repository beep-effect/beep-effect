/**
 * Service: RDF Services
 *
 * **Details**
 *
 * RDF abstraction layer using N3.js as the backend.
 * Provides backend-agnostic RDF operations for parsing, querying, and serialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import {
  N3ParseTurtleRequest,
  N3SerializeTurtleRequest,
  N3TurtleCodec,
  N3TurtleCodecLive
} from "@beep/n3";
import type { BlankNode as BlankNodeType, Quad } from "@beep/rdf";
import {
  GraphTerm,
  IRI,
  NamedNode,
  ObjectTerm,
  Subject,
  makeBlankNode,
  makeLiteral,
  makeNamedNode as makeCanonicalNamedNode,
  makeNamedNode,
  makeQuad,
} from "@beep/rdf";
import * as CanonicalRdf from "@beep/rdf/Rdf";
import {DCTERMS_NAMESPACE} from "@beep/rdf/Vocab/Dcterms";
import {OWL_NAMESPACE} from "@beep/rdf/Vocab/Owl";
import {
  PROV_ACTIVITY,
  PROV_NAMESPACE,
  PROV_WAS_GENERATED_BY
} from "@beep/rdf/Vocab/Prov";
import {RDF_NAMESPACE, RDF_TYPE} from "@beep/rdf/Vocab/Rdf";
import {
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_INTEGER,
  XSD_NAMESPACE
} from "@beep/rdf/Vocab/Xsd";
import type {Scope} from "effect";
import {
  Chunk,
  Context,
  Duration,
  Effect,
  Layer,
  Match,
  MutableHashSet
} from "effect";
import * as A from "effect/Array";
import {dual} from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as N3 from "n3";
import {
  ParsingFailed,
  RdfError,
  SerializationFailed
} from "../Domain/Error/Rdf.ts";
import type {Entity, Relation} from "../Domain/Model/Entity.ts";
import {RelationObject} from "../Domain/Model/Entity.ts";
import {CLAIMS, CORE, EXTR} from "../Domain/Rdf/Constants.ts";
import {buildIri} from "../Utils/Rdf.ts";
import {ConfigService, ConfigServiceDefault} from "./Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Rdf");
const OWL_SAME_AS = makeCanonicalNamedNode(`${OWL_NAMESPACE}sameAs`);
const PROV_GENERATED_AT_TIME = makeCanonicalNamedNode(`${PROV_NAMESPACE}generatedAtTime`);
const DCTERMS_SOURCE = makeCanonicalNamedNode(`${DCTERMS_NAMESPACE}source`);
const XSD_DATE_TIME = makeCanonicalNamedNode(`${XSD_NAMESPACE}dateTime`);
const XSD_DECIMAL = makeCanonicalNamedNode(`${XSD_NAMESPACE}decimal`);
const RDF_STATEMENT = makeCanonicalNamedNode(`${RDF_NAMESPACE}Statement`);
const RDF_SUBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeCanonicalNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}object`);

interface RdfConstructionPrefixes {
  readonly rdf: string;
  readonly rdfs: string;
  readonly xsd: string;
  readonly schema?: string;
}

const n3NamedNode = (value: string): N3.NamedNode => N3.DataFactory.namedNode(IRI.fromUnknown(value));
const isIriObjectString = P.some([Str.startsWith("https://"), Str.startsWith("https://"), Str.startsWith("urn:")]);

const valueToN3Literal = (value: string | number | boolean, prefixes: RdfConstructionPrefixes): N3.Literal => {
  if (P.isString(value)) return N3.DataFactory.literal(value);
  const datatype = P.isBoolean(value)
    ? `${prefixes.xsd}boolean`
    : Number.isInteger(value)
      ? `${prefixes.xsd}integer`
      : `${prefixes.xsd}decimal`;
  return N3.DataFactory.literal(`${value}`, n3NamedNode(datatype));
};

const entityToN3Quads = (
  entity: Entity,
  baseNamespace: string,
  prefixes: RdfConstructionPrefixes
): ReadonlyArray<N3.Quad> => {
  const subject = n3NamedNode(buildIri(baseNamespace, entity.id));
  const typeQuads = A.map(entity.types, (typeIri) =>
    N3.DataFactory.quad(subject, n3NamedNode(`${prefixes.rdf}type`), n3NamedNode(typeIri))
  );
  const labelQuad = N3.DataFactory.quad(
    subject,
    n3NamedNode(`${prefixes.rdfs}label`),
    N3.DataFactory.literal(entity.mention)
  );
  const attributeQuads = A.map(R.toEntries(entity.attributes), ([predicate, value]) => {
    const predicateIri = IRI.is(predicate) ? predicate : `${prefixes.schema ?? baseNamespace}${predicate}`;
    return N3.DataFactory.quad(subject, n3NamedNode(predicateIri), valueToN3Literal(value, prefixes));
  });
  return A.append(A.appendAll(typeQuads, attributeQuads), labelQuad);
};

const relationObjectToN3Term = (
  object: RelationObject,
  baseNamespace: string,
  prefixes: RdfConstructionPrefixes
): N3.Quad_Object =>
  RelationObject.match(object, {
    EntityReference: ({ value }): N3.Quad_Object => n3NamedNode(buildIri(baseNamespace, value)),
    Text: ({ value }): N3.Quad_Object => valueToN3Literal(value, prefixes),
    Number: ({ value }): N3.Quad_Object => valueToN3Literal(value, prefixes),
    Boolean: ({ value }): N3.Quad_Object => valueToN3Literal(value, prefixes),
  });

const relationToN3Quad = (relation: Relation, baseNamespace: string, prefixes: RdfConstructionPrefixes): N3.Quad =>
  N3.DataFactory.quad(
    n3NamedNode(buildIri(baseNamespace, relation.subjectId)),
    n3NamedNode(relation.predicate),
    relationObjectToN3Term(relation.object, baseNamespace, prefixes)
  );

/**
 * N3Store type (from n3 library) - internal use only
 */
type N3Store = N3.Store;

/**
 * Mutable N3 workflow store retained inside the experiment.
 *
 * @internal This is not an RDF domain contract and is deliberately absent
 * from the experiment entrypoint. Canonical external boundaries use
 * `@beep/rdf` Dataset; this wrapper exists only for mutation-heavy legacy
 * reasoning workflows until those workflows are ported to immutable datasets.
 *
 * @since 0.0.0
 */
class RdfStoreHandle {
  readonly #backend: N3Store;

  constructor(backend: N3Store) {
    this.#backend = backend;
  }

  static readonly is = (value: unknown): value is RdfStoreHandle => value instanceof RdfStoreHandle;
  static readonly backend = (store: RdfStoreHandle): N3Store => store.#backend;
}

/**
 * Opaque mutable RDF workflow-store handle.
 *
 * **Details**
 *
 * The handle intentionally remains nominal and type-level because it wraps a
 * live N3 store with private mutable state; canonical external RDF data uses
 * the schema-backed `@beep/rdf` dataset model.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RdfStore = RdfStoreHandle;

/**
 *  Guard for opaque workflow-store handles created by this module.
 *
 * **Example** (Guard an empty store)
 *
 * ```ts
 * import { emptyRdfStore, isRdfStore } from "@effect-ontology/Service/Rdf"
 *
 * console.log(isRdfStore(emptyRdfStore())) // true
 * console.log(isRdfStore({})) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isRdfStore = RdfStoreHandle.is;

const makeRdfStore = (store: N3Store): RdfStore => new RdfStoreHandle(store);

/**
 *  Create an empty mutable workflow store without exposing the backend.
 *
 * **Example** (Create an empty store)
 *
 * ```ts
 * import { emptyRdfStore, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const store = emptyRdfStore()
 * console.log(rdfStoreSize(store)) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyRdfStore = (): RdfStore => makeRdfStore(new N3.Store());

/**
 *  Create a mutable workflow store from a canonical RDF dataset.
 *
 * **Example** (Wrap an empty dataset)
 *
 * ```ts
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { rdfStoreFromDataset, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const store = rdfStoreFromDataset(makeDataset([]))
 * console.log(rdfStoreSize(store)) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rdfStoreFromDataset = (dataset: CanonicalRdf.Dataset): RdfStore =>
  makeRdfStore(new N3.Store(A.map(dataset.quads, canonicalQuadToN3)));

const backend = RdfStoreHandle.backend;

/**
 *  Return the current number of canonical quads in a workflow store.
 *
 * **Example** (Count quads in an empty store)
 *
 * ```ts
 * import { emptyRdfStore, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * console.log(rdfStoreSize(emptyRdfStore())) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const rdfStoreSize = (store: RdfStore): number => backend(store).size;

/**
 *  Return canonical quads matching a workflow-store pattern.
 *
 * **Example** (Query an empty store)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { emptyRdfStore, rdfStoreQuads } from "@effect-ontology/Service/Rdf"
 *
 * const quads = Effect.runSync(rdfStoreQuads(emptyRdfStore(), {}).pipe(Effect.orDie))
 * console.log(quads.length) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const rdfStoreQuads: {
  (pattern: QuadPattern): (store: RdfStore) => Effect.Effect<ReadonlyArray<Quad>, RdfError>;
  (store: RdfStore, pattern: QuadPattern): Effect.Effect<ReadonlyArray<Quad>, RdfError>;
} = dual(2, (store: RdfStore, pattern: QuadPattern): Effect.Effect<ReadonlyArray<Quad>, RdfError> => {
  const n3Store = backend(store);
  return Effect.forEach(
    n3Store.getQuads(
      domainTermToN3Term(pattern.subject ?? null),
      domainTermToN3Term(pattern.predicate ?? null),
      domainTermToN3Term(pattern.object ?? null),
      domainTermToN3Term(pattern.graph ?? null)
    ),
    n3QuadToDomainQuad
  );
});

/**
 *  Return every canonical quad in a workflow store.
 *
 * **Example** (Read every quad)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { emptyRdfStore, rdfStoreAllQuads } from "@effect-ontology/Service/Rdf"
 *
 * const quads = Effect.runSync(rdfStoreAllQuads(emptyRdfStore()).pipe(Effect.orDie))
 * console.log(quads.length) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const rdfStoreAllQuads = (store: RdfStore): Effect.Effect<ReadonlyArray<Quad>, RdfError> =>
  rdfStoreQuads(store, {});

/**
 *  Add one canonical quad to a mutable workflow store.
 *
 * **Example** (Add a name triple)
 *
 * ```ts
 * import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { emptyRdfStore, rdfStoreAddQuad, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const store = emptyRdfStore()
 * rdfStoreAddQuad(
 *   store,
 *   makeQuad(
 *     makeNamedNode("https://example.org/Ada"),
 *     makeNamedNode("https://schema.org/name"),
 *     makeLiteral("Ada", "http://www.w3.org/2001/XMLSchema#string")
 *   )
 * )
 * console.log(rdfStoreSize(store)) // 1
 * ```
 *
 * @category setters
 * @since 0.0.0
 */
export const rdfStoreAddQuad: {
  (quad: Quad): (store: RdfStore) => void;
  (store: RdfStore, quad: Quad): void;
} = dual(2, (store: RdfStore, quad: Quad): void => {
  backend(store).addQuad(canonicalQuadToN3(quad));
});

/**
 *  Remove canonical quads from a mutable workflow store.
 *
 * **Example** (Remove a previously added quad)
 *
 * ```ts
 * import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import { emptyRdfStore, rdfStoreAddQuad, rdfStoreRemoveQuads, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const store = emptyRdfStore()
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/Ada"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Ada", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * rdfStoreAddQuad(store, quad)
 * rdfStoreRemoveQuads(store, [quad])
 * console.log(rdfStoreSize(store)) // 0
 * ```
 *
 * @category setters
 * @since 0.0.0
 */
export const rdfStoreRemoveQuads: {
  (quads: Iterable<Quad>): (store: RdfStore) => void;
  (store: RdfStore, quads: Iterable<Quad>): void;
} = dual(2, (store: RdfStore, quads: Iterable<Quad>): void => {
  backend(store).removeQuads(A.map(A.fromIterable(quads), canonicalQuadToN3));
});

/**
 *  Clone a workflow store without exposing its mutable backend.
 *
 * **Example** (Clone an empty store)
 *
 * ```ts
 * import { cloneRdfStore, emptyRdfStore, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * console.log(rdfStoreSize(cloneRdfStore(emptyRdfStore()))) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const cloneRdfStore = (store: RdfStore): RdfStore => makeRdfStore(new N3.Store(backend(store)));

/**
 *  Apply N3 rules while keeping the mutable driver backend private.
 *
 * **Example** (Apply an empty rule set)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { emptyRdfStore, rdfStoreApplyRules, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const store = emptyRdfStore()
 * Effect.runSync(rdfStoreApplyRules(store, []).pipe(Effect.orDie))
 * console.log(rdfStoreSize(store)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rdfStoreApplyRules: {
  (rules: ReadonlyArray<string>): (store: RdfStore) => Effect.Effect<void, RdfError>;
  (store: RdfStore, rules: ReadonlyArray<string>): Effect.Effect<void, RdfError>;
} = dual(
  2,
  Effect.fn("RdfStore.applyRules")(function* (store: RdfStore, rules: ReadonlyArray<string>) {
    yield* Effect.try({
      try: () => {
        const parser = new N3.Parser({ format: "N3" });
        const ruleStore = new N3.Store();
        for (const rule of rules) ruleStore.addQuads(parser.parse(rule));
        new N3.Reasoner(backend(store)).reason(ruleStore);
      },
      catch: (cause) =>
        RdfError.make({
          message: `Failed to apply RDF reasoning rules: ${cause}`,
          cause: O.some(cause),
        }),
    });
  })
);

/**
 * Query pattern for mutable RDF workflow stores.
 *
 * **Details**
 *
 * null values act as wildcards (match anything).
 *
 *
 * **Example** (Match any name triple)
 *
 * ```ts
 * import { QuadPattern } from "@effect-ontology/Service/Rdf"
 * import * as S from "effect/Schema"
 *
 * const pattern = S.decodeUnknownSync(QuadPattern)({ predicate: "https://schema.org/name" })
 * console.log(pattern.predicate)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QuadPattern = S.Struct({
  subject: S.optionalKey(S.Union([IRI, Subject, S.Null])).annotateKey({
    description: "Optional subject constraint; null and omission are wildcards.",
  }),
  predicate: S.optionalKey(S.Union([IRI, NamedNode, S.Null])).annotateKey({
    description: "Optional predicate constraint; null and omission are wildcards.",
  }),
  object: S.optionalKey(S.Union([IRI, ObjectTerm, S.Null])).annotateKey({
    description: "Optional object constraint; null and omission are wildcards.",
  }),
  graph: S.optionalKey(S.Union([IRI, GraphTerm, S.Null])).annotateKey({
    description: "Optional graph constraint; null and omission are wildcards.",
  }),
}).pipe(
  $I.annoteSchema("QuadPattern", {
    description: "Optional RDF term constraints used to query the mutable workflow store.",
  })
);

/**
 * Runtime query pattern decoded by {@link QuadPattern}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type QuadPattern = typeof QuadPattern.Type;

/**
 * Internal: Convert N3 Term to the canonical RDF object-term union
 */
const unsupportedN3Term = (position: "subject" | "object", termType: string): RdfError =>
  RdfError.make({
    message: `Unsupported N3 ${position} term type: ${termType}`,
    cause: O.none(),
  });

const n3TermToDomainTerm = Match.type<N3.Quad_Object>().pipe(
  Match.when({ termType: "NamedNode" }, (term) => Effect.succeed(makeNamedNode(term.value))),
  Match.when({ termType: "BlankNode" }, (term) => Effect.succeed(makeBlankNode(term.value))),
  Match.when({ termType: "Literal" }, (term) =>
    Effect.succeed(
      makeLiteral(term.value, term.datatype.value, P.isTruthy(term.language) ? { language: term.language } : {})
    )
  ),
  Match.when({ termType: "Variable" }, (term) => Effect.fail(unsupportedN3Term("object", term.termType))),
  Match.exhaustive
);

/**
 * Internal: Convert N3 Quad to domain Quad
 */
const n3SubjectToDomainSubject = Match.type<N3.Quad_Subject>().pipe(
  Match.when({ termType: "NamedNode" }, (term) => Effect.succeed(makeNamedNode(term.value))),
  Match.when({ termType: "BlankNode" }, (term) => Effect.succeed(makeBlankNode(term.value))),
  Match.when({ termType: "Variable" }, (term) => Effect.fail(unsupportedN3Term("subject", term.termType))),
  Match.exhaustive
);

const n3QuadToDomainQuad = Effect.fn("Rdf.n3QuadToDomainQuad")(function* (n3Quad: N3.Quad) {
  const subject = yield* n3SubjectToDomainSubject(n3Quad.subject);
  const predicate = makeNamedNode(n3Quad.predicate.value);
  const object = yield* n3TermToDomainTerm(n3Quad.object);

  return n3Quad.graph.termType === "NamedNode"
    ? makeQuad(subject, predicate, { object, graph: makeNamedNode(n3Quad.graph.value) })
    : makeQuad(subject, predicate, object);
});

const canonicalSubjectToN3 = (term: CanonicalRdf.Subject): N3.Quad_Subject =>
  CanonicalRdf.Subject.match(term, {
    NamedNode: (value) => N3.DataFactory.namedNode(value.value),
    BlankNode: (value) => N3.DataFactory.blankNode(value.value),
  });

const canonicalObjectToN3 = (term: CanonicalRdf.ObjectTerm): N3.Quad_Object =>
  CanonicalRdf.ObjectTerm.match(term, {
    NamedNode: (value) => N3.DataFactory.namedNode(value.value),
    BlankNode: (value) => N3.DataFactory.blankNode(value.value),
    Literal: (value) =>
      O.match(value.language, {
        onNone: () => N3.DataFactory.literal(value.value, N3.DataFactory.namedNode(value.datatype.value)),
        onSome: (language) => N3.DataFactory.literal(value.value, language),
      }),
  });

const canonicalQuadToN3 = (quad: CanonicalRdf.Quad): N3.Quad =>
  N3.DataFactory.quad(
    canonicalSubjectToN3(quad.subject),
    N3.DataFactory.namedNode(quad.predicate.value),
    canonicalObjectToN3(quad.object),
    quad.graph.termType === "DefaultGraph"
      ? N3.DataFactory.defaultGraph()
      : quad.graph.termType === "NamedNode"
        ? N3.DataFactory.namedNode(quad.graph.value)
        : N3.DataFactory.blankNode(quad.graph.value)
  );

/**
 *  Convert the experiment's mutable store to the canonical RDF dataset contract.
 *
 * **Example** (Export an empty store)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { emptyRdfStore, rdfStoreToDataset } from "@effect-ontology/Service/Rdf"
 *
 * const dataset = Effect.runSync(rdfStoreToDataset(emptyRdfStore()).pipe(Effect.orDie))
 * console.log(dataset.quads.length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const rdfStoreToDataset = Effect.fn("Rdf.rdfStoreToDataset")(function* (
  store: RdfStore
): Effect.fn.Return<CanonicalRdf.Dataset, RdfError> {
  const quads = yield* Effect.forEach(backend(store).getQuads(null, null, null, null), n3QuadToDomainQuad);
  return CanonicalRdf.makeDataset(quads);
});

/**
 * Internal: Convert domain term to N3 Term for querying
 */
const domainTermToN3Term = (
  term: IRI | BlankNodeType | NamedNode | GraphTerm | ObjectTerm | null | undefined
): N3.Term | null => {
  if (term === null || term === undefined) {
    return null;
  }
  if (P.isString(term)) {
    return N3.DataFactory.namedNode(term);
  }
  if (term.termType === "Literal") {
    return O.isSome(term.language)
      ? N3.DataFactory.literal(term.value, term.language.value)
      : N3.DataFactory.literal(term.value, N3.DataFactory.namedNode(term.datatype.value));
  }
  if (term.termType === "BlankNode") {
    return N3.DataFactory.blankNode(term.value);
  }
  if (term.termType === "DefaultGraph") {
    return N3.DataFactory.defaultGraph();
  }
  return N3.DataFactory.namedNode(term.value);
};

/**
 * RdfBuilder service interface
 *
 * Explicitly typed to avoid inference issues with transitive @rdfjs/types dependency.
 *
 * @since 0.0.0
 */
/**
 * Options for adding triples to a store with optional named graph
 *
 * **Example** (Target a named graph)
 *
 * ```ts
 * import { AddTriplesOptions } from "@effect-ontology/Service/Rdf"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(AddTriplesOptions)({
 *   graphUri: "https://example.org/graphs/extraction",
 *   targetNamespace: "https://example.org/core/"
 * })
 * console.log(options.targetNamespace)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AddTriplesOptions = S.Struct({
  graphUri: S.optionalKey(S.String).annotateKey({
    description: "Named graph URI receiving the triples; omission selects the default graph.",
  }),
  targetNamespace: S.optionalKey(S.String).annotateKey({
    description: "Namespace override used when minting entity and relation IRIs.",
  }),
}).pipe(
  $I.annoteSchema("AddTriplesOptions", {
    description: "Optional graph and namespace routing for RDF entity and relation insertion.",
  })
);

/**
 * Runtime insertion options decoded by {@link AddTriplesOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AddTriplesOptions = typeof AddTriplesOptions.Type;

/**
 * Extraction metadata for provenance tracking
 *
 * **Details**
 *
 * Captures information about the extraction run for audit purposes.
 *
 *
 * **Example** (Record extraction provenance)
 *
 * ```ts
 * import { ExtractionMetadata } from "@effect-ontology/Service/Rdf"
 * import * as S from "effect/Schema"
 *
 * const metadata = S.decodeUnknownSync(ExtractionMetadata)({
 *   graphUri: "https://example.org/graphs/prov",
 *   timestamp: "2026-01-01T00:00:00.000Z",
 *   sourceUri: "gs://beep-input/ada.txt",
 *   model: "claude-haiku-4-5",
 *   ontologyVersion: "core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 * })
 * console.log(metadata.model)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionMetadata = S.Struct({
  graphUri: S.String.annotateKey({ description: "Graph URI receiving the provenance triples." }),
  activityUri: S.optionalKey(S.String).annotateKey({
    description: "Optional PROV activity URI representing the extraction run.",
  }),
  timestamp: S.String.annotateKey({ description: "ISO 8601 timestamp recorded for the extraction." }),
  sourceUri: S.String.annotateKey({ description: "URI of the source document." }),
  model: S.String.annotateKey({ description: "Language model identifier used for extraction." }),
  ontologyVersion: S.String.annotateKey({ description: "Ontology version identifier used by the extraction." }),
}).pipe(
  $I.annoteSchema("ExtractionMetadata", {
    description: "Provenance coordinates recorded for one ontology extraction run.",
  })
);

/**
 * Runtime provenance metadata decoded by {@link ExtractionMetadata}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionMetadata = typeof ExtractionMetadata.Type;

const ConfidenceTriple = S.Struct({
  subject: S.String,
  predicate: S.String,
  object: S.Union([S.String, S.Finite, S.Boolean]),
}).pipe(
  $I.annoteSchema("ConfidenceTriple", {
    description: "Unencoded RDF triple components accepted by confidence reification.",
  })
);
type ConfidenceTriple = typeof ConfidenceTriple.Type;

const MentionInput = S.Struct({
  text: S.String,
  startChar: S.Finite,
  endChar: S.Finite,
  confidence: S.optionalKey(Confidence),
}).pipe(
  $I.annoteSchema("MentionInput", {
    description: "Source-aligned text mention used to generate provenance triples.",
  })
);
type MentionInput = typeof MentionInput.Type;

const MentionOptions = S.Struct({
  mentionUri: S.optionalKey(S.String),
  sourceUri: S.optionalKey(S.String),
  graphUri: S.optionalKey(S.String),
}).pipe(
  $I.annoteSchema("MentionOptions", {
    description: "Optional mention, source, and graph URIs used by mention generation.",
  })
);
type MentionOptions = typeof MentionOptions.Type;

/**
 * Behavioral contract implemented by the mutable RDF builder service.
 *
 * **Details**
 *
 * Every member is an executable store operation over the opaque
 * {@link RdfStore}; request payloads are modeled by the schemas above.
 *
 * @category services
 * @since 0.0.0
 */
export interface RdfBuilderShape {
  readonly makeStore: Effect.Effect<RdfStore, never, Scope.Scope>;
  readonly createStore: Effect.Effect<RdfStore, never, never>;
  readonly parseTurtle: (turtle: string) => Effect.Effect<RdfStore, ParsingFailed, never>;
  /**
   * Parse TriG string to RDF store
   *
   * Parses RDF TriG syntax (with named graphs) into an RdfStore.
   *
   * @param trig - TriG RDF string
   * @returns Effect yielding RdfStore or ParsingFailed
   *
   * @since 0.0.0
   */
  readonly parseTriG: (trig: string) => Effect.Effect<RdfStore, ParsingFailed, never>;
  readonly queryStore: (store: RdfStore, pattern: QuadPattern) => Effect.Effect<Chunk.Chunk<Quad>, RdfError, never>;
  readonly createIri: (iri: string) => Effect.Effect<IRI, RdfError>;
  readonly addEntities: (
    store: RdfStore,
    entities: Iterable<Entity>,
    options?: AddTriplesOptions
  ) => Effect.Effect<void, RdfError, never>;
  readonly addRelations: (
    store: RdfStore,
    relations: Iterable<Relation>,
    options?: AddTriplesOptions
  ) => Effect.Effect<void, RdfError, never>;
  readonly addSameAsLinks: (
    store: RdfStore,
    canonicalMap: Record<string, string>
  ) => Effect.Effect<void, RdfError, never>;
  readonly addExtractionMetadata: (
    store: RdfStore,
    metadata: ExtractionMetadata
  ) => Effect.Effect<void, RdfError, never>;
  /**
   * Add a triple with a standard RDF reification confidence annotation.
   *
   * Creates the original triple and a reified `rdf:Statement` carrying the
   * confidence score.
   *
   * @param store - Target RDF store
   * @param triple - Triple components (subject IRI, predicate IRI, object IRI or literal)
   * @param confidence - Confidence score between 0 and 1
   * @param graphUri - Optional named graph URI
   *
   * @since 0.0.0
   */
  readonly addTripleWithConfidence: (
    store: RdfStore,
    triple: ConfidenceTriple,
    confidence: Confidence,
    graphUri?: string
  ) => Effect.Effect<void, RdfError, never>;
  /**
   * Generate core:Mention RDF triples from entity evidence spans
   *
   * @since 0.0.0
   */
  readonly generateMentionTriples: (
    store: RdfStore,
    entityUri: string,
    mention: MentionInput,
    options?: MentionOptions
  ) => Effect.Effect<string, RdfError, never>;
  readonly toTurtle: (store: RdfStore) => Effect.Effect<string, SerializationFailed, never>;
  /**
   * Serialize store to TriG format with named graphs
   *
   * TriG format supports named graphs, outputting quads as:
   * ```trig
   * @prefix ex: <https://example.org/> .
   *
   * ex:graph1 {
   *   ex:s ex:p ex:o .
   * }
   *
   * ex:graph2 {
   *   ex:a ex:b ex:c .
   * }
   * ```
   *
   * @param store - RdfStore to serialize
   * @returns TriG string
   *
   * @since 0.0.0
   */
  readonly toTriG: (store: RdfStore) => Effect.Effect<string, SerializationFailed, never>;
  /**
   * Get all named graphs in the store
   *
   * Returns a list of all graph IRIs that have quads.
   * Does not include the default graph.
   *
   * @param store - RdfStore to query
   * @returns Array of graph IRIs
   *
   * @since 0.0.0
   */
  readonly getGraphs: (store: RdfStore) => Effect.Effect<Array<IRI>, RdfError, never>;
  /**
   * Get all quads from a specific named graph
   *
   * @param store - RdfStore to query
   * @param graphIri - Named graph IRI
   * @returns Chunk of Quad objects from the graph
   *
   * @since 0.0.0
   */
  readonly getQuadsFromGraph: (store: RdfStore, graphIri: IRI) => Effect.Effect<Chunk.Chunk<Quad>, RdfError, never>;
  /**
   * Copy quads between graphs
   *
   * Copies all quads from source graph to target graph.
   * Useful for promoting claims from article graphs to the main KB graph.
   *
   * @param store - RdfStore to operate on
   * @param sourceGraph - Source graph IRI
   * @param targetGraph - Target graph IRI
   * @returns Number of quads copied
   *
   * @since 0.0.0
   */
  readonly copyGraphQuads: (
    store: RdfStore,
    sourceGraph: IRI,
    targetGraph: IRI
  ) => Effect.Effect<number, RdfError, never>;
  /**
   * Delete a named graph and all its quads
   *
   * Removes all quads in the specified graph.
   * Useful for retracting article claims.
   *
   * @param store - RdfStore to operate on
   * @param graphIri - Graph IRI to delete
   * @returns Number of quads deleted
   *
   * @since 0.0.0
   */
  readonly deleteGraph: (store: RdfStore, graphIri: IRI) => Effect.Effect<number, RdfError, never>;
  /**
   * Merge source store into target store (union semantics)
   *
   * Adds all quads from source to target. Duplicate quads are ignored
   * (RDF set semantics). This is the core operation for incremental
   * knowledge base building.
   *
   * @param target - Store to merge into (modified in place)
   * @param source - Store to merge from (unchanged)
   * @returns Number of new quads added
   *
   * @since 0.0.0
   */
  readonly mergeStores: (target: RdfStore, source: RdfStore) => Effect.Effect<number, RdfError, never>;
  /**
   * Clone an RDF store
   *
   * Creates a new store with copies of all quads from the source.
   * Useful when you need to modify a store without affecting the original.
   *
   * @param source - Store to clone
   * @returns New RdfStore with same quads
   *
   * @since 0.0.0
   */
  readonly cloneStore: (source: RdfStore) => Effect.Effect<RdfStore, RdfError, never>;
}

/**
 * RdfBuilder - RDF graph construction service
 *
 * **Details**
 *
 * Manages N3.Store lifecycle with automatic cleanup.
 * Provides capability-oriented API for RDF operations.
 *
 * **Capabilities**:
 * - `makeStore`: Create scoped N3.Store with cleanup
 * - `addEntities`: Convert Entity domain objects to RDF
 * - `addRelations`: Convert Relation domain objects to RDF
 * - `toTurtle`: Serialize to Turtle with prefixes
 *
 * **Example** (Parse Turtle into a store)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { RdfBuilder, rdfStoreSize } from "@effect-ontology/Service/Rdf"
 *
 * const program = Effect.gen(function* () {
 *   const rdf = yield* RdfBuilder
 *   const store = yield* rdf.parseTurtle('<https://example.org/ada> <https://schema.org/name> "Ada" .')
 *   return rdfStoreSize(store)
 * }).pipe(Effect.provide(RdfBuilder.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RdfBuilder extends Context.Service<RdfBuilder>()($I`RdfBuilder`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const turtleCodec = yield* N3TurtleCodec;

    const baseNs = config.rdf.baseNamespace;
    const prefixes = config.rdf.prefixes;

    return {
      /**
       * Create scoped RDF store with automatic cleanup
       *
       * Store is managed within Effect.Scope and cleaned up automatically.
       *
       * @returns Scoped RdfStore instance
       */
      makeStore: Effect.acquireRelease(
        Effect.sync(() => {
          const n3Store = new N3.Store();
          return makeRdfStore(n3Store);
        }),
        (store) =>
          Effect.sync(() => {
            // Actually clear the store to release memory
            const n3Store = backend(store);
            const quads = n3Store.getQuads(null, null, null, null);
            n3Store.removeQuads(quads);
          }).pipe(
            Effect.tap(() =>
              Effect.logDebug("RDF store cleared", {
                finalQuadCount: rdfStoreSize(store),
              })
            )
          )
      ),

      /**
       * Create a new RDF store (non-scoped)
       *
       * For use cases where store lifecycle is managed externally.
       *
       * @returns RdfStore instance
       */
      createStore: Effect.sync(() => {
        const n3Store = new N3.Store();
        return makeRdfStore(n3Store);
      }),

      /**
       * Parse Turtle string to RDF store
       *
       * Parses RDF Turtle syntax into an abstract RdfStore.
       * All N3-specific parsing logic is encapsulated here.
       *
       * @param turtle - Turtle RDF string
       * @returns Effect yielding RdfStore or ParsingFailed
       */
      parseTurtle: (turtle: string) =>
        turtleCodec.parse(N3ParseTurtleRequest.make({ source: turtle })).pipe(
          Effect.map(({ dataset }) => {
            const n3Store = new N3.Store();
            n3Store.addQuads(A.map(dataset.quads, canonicalQuadToN3));
            return makeRdfStore(n3Store);
          }),
          Effect.mapError((error) =>
            ParsingFailed.make({
              message: `Failed to parse Turtle: ${error.message}`,
              cause: O.some(error),
              format: O.some("Turtle"),
            })
          )
        ),

      /**
       * Parse TriG string to RDF store
       *
       * Parses RDF TriG syntax (with named graphs) into an RdfStore.
       *
       * @param trig - TriG RDF string
       * @returns Effect yielding RdfStore or ParsingFailed
       */
      parseTriG: (trig: string) =>
        Effect.try({
          try: () => {
            const parser = new N3.Parser({ format: "application/trig" });
            const quads = parser.parse(trig);
            const n3Store = new N3.Store();
            n3Store.addQuads(quads);
            return makeRdfStore(n3Store);
          },
          catch: (error) =>
            ParsingFailed.make({
              message: `Failed to parse TriG: ${error}`,
              cause: O.some(error),
              format: O.some("TriG"),
            }),
        }),

      /**
       * Query RDF store with pattern
       *
       * Queries the store using a pattern where null values act as wildcards.
       * Returns domain Quad objects, not N3 types.
       *
       * @param store - RdfStore to query
       * @param pattern - Query pattern
       * @returns Effect yielding Chunk of Quad objects
       */
      queryStore: (store: RdfStore, pattern: QuadPattern) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);

            // Convert domain terms to N3 terms for querying
            const n3Subject = domainTermToN3Term(pattern.subject ?? null);
            const n3Predicate = domainTermToN3Term(pattern.predicate ?? null);
            const n3Object = domainTermToN3Term(pattern.object ?? null);
            const n3Graph = domainTermToN3Term(pattern.graph ?? null);

            // Query N3 store


            return n3Store.getQuads(n3Subject, n3Predicate, n3Object, n3Graph);
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to query store: ${error}`,
              cause: O.some(error),
            }),
        }).pipe(
          Effect.flatMap((quads) => Effect.forEach(quads, n3QuadToDomainQuad)),
          Effect.map(Chunk.fromIterable)
        ),

      /**
       * Create IRI from string
       *
       * Validates and creates a domain IRI type.
       *
       * @param iri - IRI string
       * @returns IRI domain type
       */
      createIri: (iri: string) =>
        IRI.decodeEffect(iri).pipe(
          Effect.mapError((cause) =>
            RdfError.make({
              message: "Invalid IRI.",
              cause: O.some(cause),
            })
          )
        ),

      /**
       * Add entities to store
       *
       * Converts Entity domain objects to N3 quads using pure utils.
       * Optionally adds triples to a named graph for provenance tracking.
       *
       * @param store - RdfStore to add to
       * @param entities - Entities to convert to RDF
       * @param options - Optional settings including graphUri for named graph
       * @returns Effect completing when entities are added
       */
      addEntities: (store: RdfStore, entities: Iterable<Entity>, options?: AddTriplesOptions) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : undefined;
            // Use targetNamespace from options if provided, otherwise fall back to config
            // Convert Namespace identifier to full IRI if targetNamespace is provided
            const namespace = P.isNotUndefined(options?.targetNamespace)
              ? (() => {
                  // Extract protocol://domain/ from baseNs
                  const match = baseNs.match(/^https?:\/\/[^/]+\//);
                  const baseDomain = P.isNotNull(match) ? match[0] : "https://example.org/";
                  return `${baseDomain}${options.targetNamespace}/`;
                })()
              : baseNs;

            for (const entity of entities) {
              // Use pure util function for transformation
              const quads = entityToN3Quads(entity, namespace, prefixes);
              for (const quad of quads) {
                // Add to named graph if specified, otherwise default graph
                if (P.isNotUndefined(graphNode)) {
                  n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, graphNode));
                } else {
                  n3Store.addQuad(quad);
                }
              }
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add entities to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add relations to store
       *
       * Converts Relation domain objects to N3 quads using pure utils.
       * Optionally adds triples to a named graph for provenance tracking.
       *
       * @param store - RdfStore to add to
       * @param relations - Relations to convert to RDF
       * @param options - Optional settings including graphUri for named graph
       * @returns Effect completing when relations are added
       */
      addRelations: (store: RdfStore, relations: Iterable<Relation>, options?: AddTriplesOptions) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : undefined;
            // Use targetNamespace from options if provided, otherwise fall back to config
            // Convert Namespace identifier to full IRI if targetNamespace is provided
            const namespace = P.isNotUndefined(options?.targetNamespace)
              ? (() => {
                  // Extract protocol://domain/ from baseNs
                  const match = baseNs.match(/^https?:\/\/[^/]+\//);
                  const baseDomain = P.isNotNull(match) ? match[0] : "https://example.org/";
                  return `${baseDomain}${options.targetNamespace}/`;
                })()
              : baseNs;

            for (const rel of relations) {
              // Use pure util function for transformation
              const quad = relationToN3Quad(rel, namespace, prefixes);
              // Add to named graph if specified, otherwise default graph
              if (P.isNotUndefined(graphNode)) {
                n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, graphNode));
              } else {
                n3Store.addQuad(quad);
              }
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add relations to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add owl:sameAs links for entity resolution
       *
       * Generates owl:sameAs triples linking mention IRIs to canonical entity IRIs.
       * Skips self-referential links (where mentionId === canonicalId).
       *
       * @param store - RdfStore to add to
       * @param canonicalMap - Map of mentionId -> canonicalId
       * @returns Effect completing when links are added
       *
       * @since 0.0.0
       */
      addSameAsLinks: (store: RdfStore, canonicalMap: Record<string, string>) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const sameAsPredicate = N3.DataFactory.namedNode(OWL_SAME_AS.value);

            for (const [mentionId, canonicalId] of R.toEntries(canonicalMap)) {
              // Skip self-referential links
              if (mentionId === canonicalId) continue;

              // Build full IRIs for the entities
              const mentionIri = Str.startsWith("http")(mentionId) ? mentionId : `${baseNs}${mentionId}`;
              const canonicalIri = Str.startsWith("http")(canonicalId) ? canonicalId : `${baseNs}${canonicalId}`;

              const subject = N3.DataFactory.namedNode(mentionIri);
              const object = N3.DataFactory.namedNode(canonicalIri);

              n3Store.addQuad(N3.DataFactory.quad(subject, sameAsPredicate, object));
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add owl:sameAs links to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add extraction run metadata triples for provenance tracking
       *
       * Generates PROV-O and Dublin Core metadata triples describing the
       * extraction activity. Triples are added to the specified named graph.
       *
       * Generated triples:
       * - prov:wasGeneratedBy → extraction activity
       * - prov:generatedAtTime → timestamp
       * - dcterms:source → document URI
       * - :usedModel → LLM model name
       * - :ontologyVersion → ontology IRI + hash
       *
       * @param store - RdfStore to add metadata to
       * @param metadata - Extraction metadata
       * @returns Effect completing when metadata is added
       *
       * @since 0.0.0
       */
      addExtractionMetadata: (store: RdfStore, metadata: ExtractionMetadata) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = N3.DataFactory.namedNode(metadata.graphUri);
            const graphSubject = N3.DataFactory.namedNode(metadata.graphUri);

            // Activity URI defaults to graph URI with /activity suffix
            const activityUri = metadata.activityUri ?? `${metadata.graphUri}/activity`;
            const activityNode = N3.DataFactory.namedNode(activityUri);

            // Custom predicates in the extraction namespace
            const usedModelPredicate = N3.DataFactory.namedNode(`${baseNs}usedModel`);
            const ontologyVersionPredicate = N3.DataFactory.namedNode(`${baseNs}ontologyVersion`);

            // prov:wasGeneratedBy
            n3Store.addQuad(
              N3.DataFactory.quad(
                graphSubject,
                N3.DataFactory.namedNode(PROV_WAS_GENERATED_BY.value),
                activityNode,
                graphNode
              )
            );

            // prov:generatedAtTime
            n3Store.addQuad(
              N3.DataFactory.quad(
                graphSubject,
                N3.DataFactory.namedNode(PROV_GENERATED_AT_TIME.value),
                N3.DataFactory.literal(metadata.timestamp, N3.DataFactory.namedNode(XSD_DATE_TIME.value)),
                graphNode
              )
            );

            // dcterms:source
            n3Store.addQuad(
              N3.DataFactory.quad(
                graphSubject,
                N3.DataFactory.namedNode(DCTERMS_SOURCE.value),
                N3.DataFactory.namedNode(metadata.sourceUri),
                graphNode
              )
            );

            // :usedModel (custom predicate)
            n3Store.addQuad(
              N3.DataFactory.quad(activityNode, usedModelPredicate, N3.DataFactory.literal(metadata.model), graphNode)
            );

            // :ontologyVersion (custom predicate)
            n3Store.addQuad(
              N3.DataFactory.quad(
                activityNode,
                ontologyVersionPredicate,
                N3.DataFactory.literal(metadata.ontologyVersion),
                graphNode
              )
            );

            // Mark activity as prov:Activity type
            n3Store.addQuad(
              N3.DataFactory.quad(
                activityNode,
                N3.DataFactory.namedNode(RDF_TYPE.value),
                N3.DataFactory.namedNode(PROV_ACTIVITY.value),
                graphNode
              )
            );
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add extraction metadata to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add a triple with a canonical RDF reification confidence annotation
       *
       * Uses standard RDF reification so the result remains representable by
       * the canonical `@beep/rdf` Dataset and serializable by `@beep/n3`.
       */
      addTripleWithConfidence: (
        store: RdfStore,
        triple: ConfidenceTriple,
        confidence: Confidence,
        graphUri?: string
      ) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = P.isNotUndefined(graphUri) ? n3NamedNode(graphUri) : N3.DataFactory.defaultGraph();

            // Create subject and predicate nodes
            const subjectNode = n3NamedNode(triple.subject);
            const predicateNode = n3NamedNode(triple.predicate);

            // Create object node (IRI or literal)
            const objectNode = P.isString(triple.object)
              ? isIriObjectString(triple.object)
                ? n3NamedNode(triple.object)
                : N3.DataFactory.literal(triple.object)
              : P.isNumber(triple.object)
                ? N3.DataFactory.literal(triple.object.toString(), N3.DataFactory.namedNode(XSD_DOUBLE.value))
                : N3.DataFactory.literal(triple.object.toString(), N3.DataFactory.namedNode(XSD_BOOLEAN.value));

            // Create the original quad (triple)
            const originalQuad = N3.DataFactory.quad(subjectNode, predicateNode, objectNode, graphNode);

            // Add the original quad to the store
            n3Store.addQuad(originalQuad);

            const statementNode = N3.DataFactory.blankNode();
            n3Store.addQuads([
              N3.DataFactory.quad(
                statementNode,
                N3.DataFactory.namedNode(RDF_TYPE.value),
                n3NamedNode(RDF_STATEMENT.value),
                graphNode
              ),
              N3.DataFactory.quad(statementNode, n3NamedNode(RDF_SUBJECT.value), subjectNode, graphNode),
              N3.DataFactory.quad(statementNode, n3NamedNode(RDF_PREDICATE.value), predicateNode, graphNode),
              N3.DataFactory.quad(statementNode, n3NamedNode(RDF_OBJECT.value), objectNode, graphNode),
              N3.DataFactory.quad(
                statementNode,
                N3.DataFactory.namedNode(EXTR.confidence.value),
                N3.DataFactory.literal(confidence.toString(), N3.DataFactory.namedNode(XSD_DOUBLE.value)),
                graphNode
              ),
            ]);
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add triple with confidence: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Generate core:Mention RDF triples from entity evidence spans
       *
       * Creates proper Mention nodes linked to entities via core:hasEvidentialMention.
       * Each Mention node includes:
       * - rdf:type core:Mention
       * - claims:evidenceText (the quoted text)
       * - claims:startOffset, claims:endOffset (character positions)
       * - claims:confidence (extraction confidence)
       * - core:mentions (link back to entity)
       *
       * @param store - Target RDF store
       * @param entityUri - URI of the entity this mention references
       * @param mention - EvidenceSpan data (text, startChar, endChar, confidence)
       * @param options - Optional mention URI and source document URI
       * @returns Effect completing when triples are added
       *
       * **Example** (Use generateMentionTriples)
       * ```ts
       * yield* rdf.generateMentionTriples(store, entityUri, {
       *   text: "Mayor Bruce Harrell",
       *   startChar: 42,
       *   endChar: 60,
       *   confidence: 0.95
       * }, { sourceUri: "gs://bucket/doc.txt" })
       * ```
       *
       * @since 0.0.0
       */
      generateMentionTriples: (
        store: RdfStore,
        entityUri: string,
        mention: MentionInput,
        options?: MentionOptions
      ) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : N3.DataFactory.defaultGraph();

            // Generate mention URI if not provided
            // Format: entity_uri/mention/{startChar}-{endChar}
            const mentionUri = options?.mentionUri ?? `${entityUri}/mention/${mention.startChar}-${mention.endChar}`;
            const mentionNode = N3.DataFactory.namedNode(mentionUri);
            const entityNode = N3.DataFactory.namedNode(entityUri);

            // rdf:type core:Mention
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(RDF_TYPE.value),
                N3.DataFactory.namedNode(CORE.Mention.value),
                graphNode
              )
            );

            // claims:evidenceText
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.evidenceText.value),
                N3.DataFactory.literal(mention.text),
                graphNode
              )
            );

            // claims:startOffset
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.startOffset.value),
                N3.DataFactory.literal(mention.startChar.toString(), N3.DataFactory.namedNode(XSD_INTEGER.value)),
                graphNode
              )
            );

            // claims:endOffset
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.endOffset.value),
                N3.DataFactory.literal(mention.endChar.toString(), N3.DataFactory.namedNode(XSD_INTEGER.value)),
                graphNode
              )
            );

            // claims:confidence (if provided)
            if (mention.confidence !== undefined) {
              n3Store.addQuad(
                N3.DataFactory.quad(
                  mentionNode,
                  N3.DataFactory.namedNode(CLAIMS.confidence.value),
                  N3.DataFactory.literal(mention.confidence.toString(), N3.DataFactory.namedNode(XSD_DECIMAL.value)),
                  graphNode
                )
              );
            }

            // core:mentions (mention → entity)
            n3Store.addQuad(
              N3.DataFactory.quad(mentionNode, N3.DataFactory.namedNode(CORE.mentions.value), entityNode, graphNode)
            );

            // core:hasEvidentialMention (entity → mention)
            n3Store.addQuad(
              N3.DataFactory.quad(
                entityNode,
                N3.DataFactory.namedNode(CORE.hasEvidentialMention.value),
                mentionNode,
                graphNode
              )
            );

            // claims:statedIn (source document reference)
            if (P.isNotUndefined(options?.sourceUri)) {
              n3Store.addQuad(
                N3.DataFactory.quad(
                  mentionNode,
                  N3.DataFactory.namedNode(CLAIMS.statedIn.value),
                  N3.DataFactory.namedNode(options.sourceUri),
                  graphNode
                )
              );
            }

            return mentionUri;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to generate mention triples: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Serialize store to Turtle with prefixes
       *
       * Uses prefixes from ConfigService for clean output.
       * Delegates canonical Dataset serialization to `@beep/n3`.
       *
       * @param store - RdfStore to serialize
       * @returns Turtle string
       */
      toTurtle: (store: RdfStore) =>
        rdfStoreToDataset(store).pipe(
          Effect.mapError((error) =>
            SerializationFailed.make({
              message: `Failed to convert RDF store to canonical Dataset: ${error.message}`,
              cause: O.some(error),
              format: O.some("Turtle"),
            })
          ),
          Effect.flatMap((dataset) =>
            turtleCodec
              .serialize(
                N3SerializeTurtleRequest.make({
                  dataset,
                  prefixes: config.rdf.prefixes,
                })
              )
              .pipe(
                Effect.map(({ source }) => source),
                Effect.mapError((error) =>
                  SerializationFailed.make({
                    message: `Turtle serialization failed: ${error.message}`,
                    cause: O.some(error),
                    format: O.some("Turtle"),
                  })
                )
              )
          ),
          Effect.timeoutOrElse({
            duration: Duration.seconds(30),
            orElse: () =>
              Effect.fail(
                SerializationFailed.make({
                  message: "Turtle serialization timed out after 30 seconds",
                  format: O.some("Turtle"),
                })
              ),
          })
        ),

      /**
       * Serialize store to TriG format with named graphs
       *
       * Uses prefixes from ConfigService for clean output.
       * Async operation via N3.Writer with TriG format.
       *
       * @param store - RdfStore to serialize
       * @returns TriG string
       */
      toTriG: (store: RdfStore) =>
        Effect.callback<string, SerializationFailed>((resume) => {
          const n3Store = backend(store);
          const writer = new N3.Writer({
            format: "application/trig",
            prefixes: config.rdf.prefixes,
          });

          // Add all quads from store (including graph information)
          n3Store.forEach((q) => {
            writer.addQuad(q);
          });

          writer.end((error, result) => {
            if (P.isTruthy(error)) {
              resume(
                Effect.fail(
                  SerializationFailed.make({
                    message: `TriG serialization failed: ${error}`,
                    cause: O.some(error),
                    format: O.some("TriG"),
                  })
                )
              );
            } else {
              resume(Effect.succeed(result));
            }
          });
        }).pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(30),
            orElse: () =>
              Effect.fail(
                SerializationFailed.make({
                  message: "TriG serialization timed out after 30 seconds",
                  format: O.some("TriG"),
                })
              ),
          })
        ),

      /**
       * Get all named graphs in the store
       *
       * Returns unique graph IRIs from all quads.
       */
      getGraphs: (store: RdfStore) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphs = MutableHashSet.empty<string>();

            // Iterate all quads and collect unique graph IRIs
            n3Store.forEach((quad) => {
              if (quad.graph.termType === "NamedNode") {
                MutableHashSet.add(graphs, quad.graph.value);
              }
            });

            return A.map(A.fromIterable(graphs), (graph) => IRI.make(graph));
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to get graphs: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Get all quads from a specific named graph
       */
      getQuadsFromGraph: (store: RdfStore, graphIri: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = N3.DataFactory.namedNode(graphIri);

            return n3Store.getQuads(null, null, null, graphNode);
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to get quads from graph ${graphIri}: ${error}`,
              cause: O.some(error),
            }),
        }).pipe(
          Effect.flatMap((quads) => Effect.forEach(quads, n3QuadToDomainQuad)),
          Effect.map(Chunk.fromIterable)
        ),

      /**
       * Copy quads between graphs
       */
      copyGraphQuads: (store: RdfStore, sourceGraph: IRI, targetGraph: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const sourceNode = N3.DataFactory.namedNode(sourceGraph);
            const targetNode = N3.DataFactory.namedNode(targetGraph);

            // Get all quads from source graph
            const sourceQuads = n3Store.getQuads(null, null, null, sourceNode);

            // Add each quad to target graph
            for (const quad of sourceQuads) {
              n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, targetNode));
            }

            return sourceQuads.length;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to copy quads from ${sourceGraph} to ${targetGraph}: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Delete a named graph and all its quads
       */
      deleteGraph: (store: RdfStore, graphIri: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = backend(store);
            const graphNode = N3.DataFactory.namedNode(graphIri);

            // Get all quads in the graph
            const quadsToDelete = n3Store.getQuads(null, null, null, graphNode);
            const count = quadsToDelete.length;

            // Remove all quads
            n3Store.removeQuads(quadsToDelete);

            return count;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to delete graph ${graphIri}: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Merge source store into target store (union semantics)
       *
       * Uses RDF set semantics - duplicate quads are ignored.
       * Returns count of new quads added (not total quads).
       */
      mergeStores: (target: RdfStore, source: RdfStore) =>
        Effect.try({
          try: () => {
            const targetStore = backend(target);
            const sourceStore = backend(source);

            // Get initial count
            const initialCount = targetStore.size;

            // Get all quads from source
            const sourceQuads = sourceStore.getQuads(null, null, null, null);

            // Add all quads to target (N3.Store handles deduplication)
            targetStore.addQuads(sourceQuads);

            // Return number of new quads added
            return targetStore.size - initialCount;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to merge stores: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Clone an RDF store
       *
       * Creates a new store with copies of all quads from the source.
       */
      cloneStore: (source: RdfStore) =>
        Effect.try({
          try: () => {
            const newStore = new N3.Store();
            const sourceQuads = backend(source).getQuads(null, null, null, null);
            newStore.addQuads(sourceQuads);
            return makeRdfStore(newStore);
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to clone store: ${error}`,
              cause: O.some(error),
            }),
        }),
    } satisfies RdfBuilderShape;
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([ConfigServiceDefault, N3TurtleCodecLive])
  );
}

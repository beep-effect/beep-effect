/**
 * Versioned ontology-embedding artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils, Sha256HexFromBytes } from "@beep/schema";
import { Effect, flow, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { FastCheck } from "effect/testing";
import { ContentHash, GcsUri } from "../Identity.ts";
import { IRI } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/OntologyEmbeddings");
const utf8Encoder = new TextEncoder();

const EmbeddingVector = S.NonEmptyArray(S.Finite)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(
          fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
          fc.array(fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }), {
            maxLength: 31,
          })
        )
        .map(([head, tail]) => [head, ...tail]),
  })
  .pipe(
    $I.annoteSchema("EmbeddingVector", {
      description: "Non-empty finite numeric vector produced by an embedding model.",
    })
  );

const ElementEmbeddingFields = {
  iri: IRI.annotateKey({
    description: "IRI of the embedded ontology class or property.",
  }),
  text: S.NonEmptyString.annotateKey({
    description: "Normalized semantic text supplied to the embedding model.",
  }),
  embedding: EmbeddingVector.annotateKey({
    description: "Finite vector returned by the embedding model.",
  }),
} as const;

/**
 * Embedding and source text for one ontology class or property.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ElementEmbedding } from "@effect-ontology/Model/OntologyEmbeddings.ts"
 *
 * const text = ElementEmbedding.buildText(
 *   "SportsTeam",
 *   O.some("An organization that competes in sport."),
 *   ["club", "team"]
 * )
 *
 * console.log(text) // "SportsTeam. An organization that competes in sport.. Also known as: club, team"
 * ```
 *
 * @invariant `embedding` is non-empty and contains only finite numbers.
 * @category models
 * @since 0.0.0
 */
export class ElementEmbedding extends S.Class<ElementEmbedding>($I`ElementEmbedding`)(
  ElementEmbeddingFields,
  $I.annote("ElementEmbedding", {
    description: "Semantic text and finite embedding vector for one ontology element.",
  })
) {
  /** Schema-derived guard for ontology-element embeddings. */
  static readonly is = S.is(ElementEmbedding);

  /**
   * Builds stable semantic text from a label, optional description, and aliases.
   *
   * @param label Primary human-readable ontology label.
   * @param description Already-normalized optional definition or comment.
   * @param altLabels Alternative labels in preferred display order.
   * @returns Period-delimited semantic text suitable for embedding.
   *
   * @example
   * ```ts
   * import * as O from "effect/Option"
   * import { ElementEmbedding } from "@effect-ontology/Model/OntologyEmbeddings.ts"
   *
   * const text = ElementEmbedding.buildText(
   *   "Person",
   *   O.some("A human being."),
   *   ["Human"]
   * )
   * console.log(text) // "Person. A human being.. Also known as: Human"
   * ```
   */
  static buildText(label: string, description: O.Option<string>, altLabels: ReadonlyArray<string>): string {
    const aliasSentence = pipe(
      altLabels,
      A.match({
        onEmpty: O.none<string>,
        onNonEmpty: flow(A.join(", "), (aliases) => O.some(`Also known as: ${aliases}`)),
      })
    );

    return pipe(A.of(label), A.appendAll(O.toArray(description)), A.appendAll(O.toArray(aliasSentence)), A.join(". "));
  }
}

const OntologyEmbeddingsFields = {
  ontologyUri: GcsUri.annotateKey({
    description: "Canonical GCS URI of the ontology represented by this artifact.",
  }),
  version: ContentHash.annotateKey({
    description: "Full content digest of the ontology bytes.",
  }),
  model: S.NonEmptyString.annotateKey({
    description: "Embedding-model identifier used to compute every vector.",
  }),
  dimension: NonNegativeInt.check(
    S.isGreaterThan(0, {
      identifier: $I`EmbeddingDimensionPositiveCheck`,
      title: "Positive Embedding Dimension",
      description: "An embedding dimension must be a positive integer.",
      message: "Embedding dimension must be greater than zero.",
    })
  ).annotateKey({
    description: "Expected vector length for every embedded element.",
  }),
  createdAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which the artifact was computed.",
  }),
  classes: S.Array(ElementEmbedding).pipe(
    SchemaUtils.withEmptyArrayDefaults<ElementEmbedding>(),
    S.annotateKey({ description: "Embeddings for ontology class definitions." })
  ),
  properties: S.Array(ElementEmbedding).pipe(
    SchemaUtils.withEmptyArrayDefaults<ElementEmbedding>(),
    S.annotateKey({ description: "Embeddings for ontology property definitions." })
  ),
} as const;

class OntologyEmbeddingsFieldsModel extends S.Class<OntologyEmbeddingsFieldsModel>($I`OntologyEmbeddingsFieldsModel`)(
  OntologyEmbeddingsFields,
  $I.annote("OntologyEmbeddingsFieldsModel", {
    description: "Internal field model for a versioned ontology-embedding artifact.",
  })
) {}

const hasConsistentEmbeddingDimension = (artifact: OntologyEmbeddingsFieldsModel): boolean =>
  A.every(A.appendAll(artifact.classes, artifact.properties), (element) =>
    Num.Equivalence(A.length(element.embedding), artifact.dimension)
  );

const makeOntologyEmbeddingsArbitrary = (fc: typeof FastCheck) => {
  const resize = (element: ElementEmbedding): ElementEmbedding =>
    ElementEmbedding.make({
      iri: element.iri,
      text: element.text,
      embedding: [0],
    });

  return fc
    .record({
      ontologyUri: S.toArbitrary(GcsUri),
      version: S.toArbitrary(ContentHash),
      model: fc.constantFrom("nomic-embed-text-v1.5", "text-embedding-3-small"),
      createdAt: S.toArbitrary(S.DateTimeUtcFromString),
      classes: fc.array(S.toArbitrary(ElementEmbedding), { maxLength: 16 }),
      properties: fc.array(S.toArbitrary(ElementEmbedding), { maxLength: 16 }),
    })
    .map(({ ontologyUri, version, model, createdAt, classes, properties }) =>
      OntologyEmbeddingsFieldsModel.make({
        ontologyUri,
        version,
        model,
        dimension: NonNegativeInt.make(1),
        createdAt,
        classes: A.map(classes, resize),
        properties: A.map(properties, resize),
      })
    );
};

const OntologyEmbeddingsDefinition = OntologyEmbeddingsFieldsModel.check(
  S.makeFilter(hasConsistentEmbeddingDimension, {
    identifier: $I`ConsistentEmbeddingDimensionCheck`,
    title: "Consistent Embedding Dimension",
    description: "Every class and property vector has the artifact's declared dimension.",
    message: "Every embedding vector must match the declared embedding dimension.",
    arbitrary: {
      candidate: {
        make: makeOntologyEmbeddingsArbitrary,
      },
    },
  })
);

const computeOntologyVersion = Effect.fn("OntologyEmbeddings.computeVersion")(function* (ontologyContent: string) {
  return yield* S.decodeUnknownEffect(Sha256HexFromBytes)(utf8Encoder.encode(ontologyContent));
});

const embeddingsPathFromOntology = (ontologyUri: GcsUri): GcsUri =>
  GcsUri.fromUnknown(
    Bool.match(Str.endsWith(".ttl")(ontologyUri), {
      onFalse: () => `${ontologyUri}-embeddings.json`,
      onTrue: () => Str.replace(/\.ttl$/, "-embeddings.json")(ontologyUri),
    })
  );

/**
 * Versioned embedding artifact for one ontology.
 *
 * @remarks
 * The schema enforces one vector dimension across all class and property
 * embeddings. `computeVersion` produces a full SHA-256 digest through the
 * repository crypto service instead of the upstream module's truncated
 * synchronous hash.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { GcsUri } from "@effect-ontology/Identity.ts"
 * import { OntologyEmbeddings } from "@effect-ontology/Model/OntologyEmbeddings.ts"
 *
 * console.log(
 *   OntologyEmbeddings.storagePathFor(
 *     GcsUri.fromUnknown("gs://beep-ontology/ontologies/football/ontology.ttl")
 *   )
 * ) // "gs://beep-ontology/ontologies/football/ontology-embeddings.json"
 * console.log(Effect.isEffect(OntologyEmbeddings.computeVersion("@prefix ex: <https://example.com/> .")))
 * ```
 *
 * @invariant Every vector length equals `dimension`; version identity is a
 * complete SHA-256 digest.
 * @category models
 * @since 0.0.0
 */
export const OntologyEmbeddings = OntologyEmbeddingsDefinition.annotate({
  toArbitrary: () => makeOntologyEmbeddingsArbitrary,
}).pipe(
  $I.annoteSchema("OntologyEmbeddings", {
    description: "Versioned ontology embedding artifact with uniform finite vector dimensions.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    computeVersion: computeOntologyVersion,
    storagePathFor: embeddingsPathFromOntology,
  }))
);

/**
 * Runtime value decoded by {@link OntologyEmbeddings}.
 *
 * @example
 * ```ts
 * import type { OntologyEmbeddings } from "@effect-ontology/Model/OntologyEmbeddings.ts"
 *
 * const dimension = (artifact: OntologyEmbeddings): number => artifact.dimension
 * console.log(typeof dimension) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyEmbeddings = typeof OntologyEmbeddings.Type;

const OntologyEmbeddingsJsonDefinition = OntologyEmbeddings.pipe(S.fromJsonString);

/**
 * JSON-text codec for {@link OntologyEmbeddings}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyEmbeddingsJson } from "@effect-ontology/Model/OntologyEmbeddings.ts"
 *
 * console.log(S.isSchema(OntologyEmbeddingsJson)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OntologyEmbeddingsJson = OntologyEmbeddingsJsonDefinition.pipe(
  $I.annoteSchema("OntologyEmbeddingsJson", {
    description: "JSON string codec for versioned ontology-embedding artifacts.",
    toArbitrary: () => () => S.toArbitrary(OntologyEmbeddingsJsonDefinition),
  })
);

/**
 * Runtime value decoded by {@link OntologyEmbeddingsJson}.
 *
 * @example
 * ```ts
 * import type { OntologyEmbeddingsJson } from "@effect-ontology/Model/OntologyEmbeddings.ts"
 *
 * const inspect = (value: OntologyEmbeddingsJson): number => value.dimension
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyEmbeddingsJson = typeof OntologyEmbeddingsJson.Type;

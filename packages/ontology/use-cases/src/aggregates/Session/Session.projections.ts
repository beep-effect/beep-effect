/**
 * Ontology session read-model projections for explorer and editor clients.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { deriveSessionGraphPartitions, GraphPartition } from "@beep/ontology-domain/aggregates/Session";
import { makeNamedNode, ObjectTerm, Subject } from "@beep/rdf/Rdf";
import { OWL_CLASS, OWL_DATATYPE_PROPERTY, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_CLASS, RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, O, Str } from "@beep/utils";
import { Effect, MutableHashMap, MutableHashSet, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { inferredSessionGraphPartitions } from "./Session.reasoner.ts";
import type { Session, SessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session";
import type { Quad } from "@beep/rdf/Rdf";
import type { OntologyInferenceResult } from "./Session.reasoner.ts";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.projections");

/**
 * Explorer/editor ontology view mode.
 *
 * **Example** (Resource visibility by view mode)
 *
 * ```ts
 * import { resourceVisibleInViewMode, OntologyResourceSummary } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const visible = resourceVisibleInViewMode(
 *   OntologyResourceSummary.make({
 *     iri: "https://example.test/Pizza",
 *     label: "Pizza",
 *     kind: "class",
 *     classification: "tbox",
 *     types: [],
 *     parentIris: [],
 *     sourcePartitions: ["asserted"]
 *   }),
 *   "tbox"
 * )
 *
 * console.log(visible)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyViewMode = LiteralKit(["all", "tbox", "abox"]).pipe(
  $I.annoteSchema("OntologyViewMode", {
    description: "Ontology explorer view mode shared by tree and search projections.",
  })
);

/**
 * Type for {@link OntologyViewMode}.
 *
 * **Example** (Assign abox view mode)
 *
 * ```ts
 * import { OntologyViewMode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const mode: OntologyViewMode = "abox"
 *
 * console.log(mode)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyViewMode = typeof OntologyViewMode.Type;

/**
 * Shared ABox/TBox resource classification.
 *
 * **Example** (Classify individual resource)
 *
 * ```ts
 * import { classifyOntologyResource } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const classification = classifyOntologyResource("individual")
 *
 * console.log(classification)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyResourceClassification = LiteralKit(["tbox", "abox"]).pipe(
  $I.annoteSchema("OntologyResourceClassification", {
    description: "Shared ontology resource classification for explorer filtering and search.",
  })
);

/**
 * Type for {@link OntologyResourceClassification}.
 *
 * **Example** (Assign tbox classification)
 *
 * ```ts
 * import { OntologyResourceClassification } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const classification: OntologyResourceClassification = "tbox"
 *
 * console.log(classification)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyResourceClassification = typeof OntologyResourceClassification.Type;

/**
 * Ontology resource kind used by inspector and hierarchy projections.
 *
 * **Example** (Classify class resource kind)
 *
 * ```ts
 * import { classifyOntologyResource } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const classification = classifyOntologyResource("class")
 *
 * console.log(classification)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyResourceKind = LiteralKit([
  "class",
  "objectProperty",
  "dataProperty",
  "annotationProperty",
  "individual",
  "unknown",
]).pipe(
  $I.annoteSchema("OntologyResourceKind", {
    description: "Ontology resource kind derived from RDF/OWL typing and hierarchy predicates.",
  })
);

/**
 * Type for {@link OntologyResourceKind}.
 *
 * **Example** (Assign objectProperty kind)
 *
 * ```ts
 * import { OntologyResourceKind } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const kind: OntologyResourceKind = "objectProperty"
 *
 * console.log(kind)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyResourceKind = typeof OntologyResourceKind.Type;

/**
 * Ontology workbench metrics computed from the authoring graph.
 *
 * **Example** (Construct ontology metrics)
 *
 * ```ts
 * import { OntologyMetrics } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const metrics = OntologyMetrics.make({
 *   quadCount: 1,
 *   resourceCount: 1,
 *   classCount: 1,
 *   propertyCount: 0,
 *   individualCount: 0,
 *   tboxCount: 1,
 *   aboxCount: 0
 * })
 *
 * console.log(metrics.classCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyMetrics extends S.Class<OntologyMetrics>($I`OntologyMetrics`)(
  {
    quadCount: S.Int,
    resourceCount: S.Int,
    classCount: S.Int,
    propertyCount: S.Int,
    individualCount: S.Int,
    tboxCount: S.Int,
    aboxCount: S.Int,
    disjointnessViolationCount: S.Int.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
  },
  $I.annote("OntologyMetrics", {
    description: "Ontology workbench metrics computed from the authoring graph.",
  })
) {}

/**
 * Resource summary shared by hierarchy explorer, inspector, and search.
 *
 * **Example** (Construct resource summary)
 *
 * ```ts
 * import { OntologyResourceSummary } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const resource = OntologyResourceSummary.make({
 *   iri: "https://example.test/Pizza",
 *   label: "Pizza",
 *   kind: "class",
 *   classification: "tbox",
 *   types: ["http://www.w3.org/2002/07/owl#Class"],
 *   parentIris: [],
 *   sourcePartitions: ["asserted"]
 * })
 *
 * console.log(resource.label)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyResourceSummary extends S.Class<OntologyResourceSummary>($I`OntologyResourceSummary`)(
  {
    iri: S.String,
    label: S.String,
    kind: OntologyResourceKind,
    classification: OntologyResourceClassification,
    types: S.Array(S.String),
    parentIris: S.Array(S.String),
    sourcePartitions: S.Array(GraphPartition),
  },
  $I.annote("OntologyResourceSummary", {
    description: "Ontology resource summary shared by hierarchy explorer, inspector, and search.",
  })
) {}

/**
 * Flat hierarchy row used to build MUI Tree View items.
 *
 * **Example** (Construct hierarchy entry)
 *
 * ```ts
 * import { OntologyHierarchyEntry } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const entry = OntologyHierarchyEntry.make({
 *   iri: "https://example.test/Pizza",
 *   label: "Pizza",
 *   childIris: ["https://example.test/NamedPizza"]
 * })
 *
 * console.log(entry.childIris.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyHierarchyEntry extends S.Class<OntologyHierarchyEntry>($I`OntologyHierarchyEntry`)(
  {
    iri: S.String,
    label: S.String,
    childIris: S.Array(S.String),
  },
  $I.annote("OntologyHierarchyEntry", {
    description: "Flat hierarchy row used to build ontology tree-view items.",
  })
) {}

/**
 * Predicate relationship row used by graph and search projections.
 *
 * **Example** (Construct relationship summary)
 *
 * ```ts
 * import { OntologyRelationshipSummary } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const relationship = OntologyRelationshipSummary.make({
 *   sourceIri: "https://example.test/Margherita",
 *   predicateIri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
 *   objectIri: "https://example.test/Pizza",
 *   label: "type",
 *   sourcePartitions: ["asserted"]
 * })
 *
 * console.log(relationship.label)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyRelationshipSummary extends S.Class<OntologyRelationshipSummary>($I`OntologyRelationshipSummary`)(
  {
    sourceIri: S.String,
    predicateIri: S.String,
    objectIri: S.String,
    label: S.String,
    sourcePartitions: S.Array(GraphPartition),
  },
  $I.annote("OntologyRelationshipSummary", {
    description: "Predicate relationship row used by the ontology graph viewport.",
  })
) {}

const emptyRelationshipSummaries = (): ReadonlyArray<OntologyRelationshipSummary> => [];

const RelationshipSummariesWithEmptyDefault = S.Array(OntologyRelationshipSummary).pipe(
  S.withConstructorDefault(Effect.succeed(emptyRelationshipSummaries())),
  S.withDecodingDefaultKey(Effect.succeed(emptyRelationshipSummaries()))
);

/**
 * Complete ontology read model for explorer/editor surfaces.
 *
 * **Example** (Construct empty ontology snapshot)
 *
 * ```ts
 * import { OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const snapshot = OntologySnapshot.make({
 *   sessionId: "session-1",
 *   resources: [],
 *   hierarchy: [],
 *   metrics: OntologyMetrics.make({
 *     quadCount: 0,
 *     resourceCount: 0,
 *     classCount: 0,
 *     propertyCount: 0,
 *     individualCount: 0,
 *     tboxCount: 0,
 *     aboxCount: 0
 *   })
 * })
 *
 * console.log(snapshot.resources.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologySnapshot extends S.Class<OntologySnapshot>($I`OntologySnapshot`)(
  {
    sessionId: S.String,
    resources: S.Array(OntologyResourceSummary),
    hierarchy: S.Array(OntologyHierarchyEntry),
    relationships: RelationshipSummariesWithEmptyDefault,
    metrics: OntologyMetrics,
  },
  $I.annote("OntologySnapshot", {
    description: "Complete ontology read model for explorer and editor surfaces.",
  })
) {}

const RDFS_SUB_CLASS_OF = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
const RDFS_SUB_PROPERTY_OF = makeNamedNode(`${RDFS_NAMESPACE}subPropertyOf`);
const RDFS_DOMAIN = makeNamedNode(`${RDFS_NAMESPACE}domain`);
const RDFS_RANGE = makeNamedNode(`${RDFS_NAMESPACE}range`);
const RDF_PROPERTY = makeNamedNode(`${RDF_NAMESPACE}Property`);
const OWL_ANNOTATION_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}AnnotationProperty`);
const OWL_NAMED_INDIVIDUAL = makeNamedNode(`${OWL_NAMESPACE}NamedIndividual`);
const OWL_EQUIVALENT_CLASS = makeNamedNode(`${OWL_NAMESPACE}equivalentClass`);
const OWL_EQUIVALENT_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}equivalentProperty`);
const OWL_DISJOINT_WITH = makeNamedNode(`${OWL_NAMESPACE}disjointWith`);
const OWL_CLASS_IRI: string = OWL_CLASS.value;
const RDFS_CLASS_IRI: string = RDFS_CLASS.value;
const OWL_OBJECT_PROPERTY_IRI: string = OWL_OBJECT_PROPERTY.value;
const OWL_DATATYPE_PROPERTY_IRI: string = OWL_DATATYPE_PROPERTY.value;
const RDF_PROPERTY_IRI: string = RDF_PROPERTY.value;
const OWL_ANNOTATION_PROPERTY_IRI: string = OWL_ANNOTATION_PROPERTY.value;
const OWL_NAMED_INDIVIDUAL_IRI: string = OWL_NAMED_INDIVIDUAL.value;

const ASSERTED_VIEW_PARTITIONS: ReadonlyArray<GraphPartition> = ["asserted", "ontologies"];
const INFERRED_VIEW_PARTITIONS: ReadonlyArray<GraphPartition> = ["asserted", "ontologies", "inferred"];

const sameIri = (left: string, right: string): boolean => left === right;

const emptyGraphPartitions: () => ReadonlyArray<GraphPartition> = A.empty;

const emptyStrings: () => ReadonlyArray<string> = A.empty;

const noneString: () => O.Option<string> = O.none;

const iriSetValues = (values: Iterable<string>): ReadonlyArray<string> =>
  pipe(A.fromIterable(values), A.dedupe, A.sort(Order.String));

const appendUnique = <Value>(values: ReadonlyArray<Value>, value: Value): ReadonlyArray<Value> =>
  pipe(values, A.contains(value)) ? values : pipe(values, A.append(value));

const upsertSet = (
  map: MutableHashMap.MutableHashMap<string, ReadonlyArray<string>>,
  key: string,
  value: string
): void => {
  MutableHashMap.set(map, key, appendUnique(pipe(MutableHashMap.get(map, key), O.getOrElse(emptyStrings)), value));
};

const upsertPartition = (
  map: MutableHashMap.MutableHashMap<string, ReadonlyArray<GraphPartition>>,
  key: string,
  value: GraphPartition
): void => {
  MutableHashMap.set(
    map,
    key,
    appendUnique(pipe(MutableHashMap.get(map, key), O.getOrElse(emptyGraphPartitions)), value)
  );
};

const zipOptions = <Left, Right>(left: O.Option<Left>, right: O.Option<Right>): O.Option<readonly [Left, Right]> =>
  pipe(
    left,
    O.flatMap((leftValue) =>
      pipe(
        right,
        O.map((rightValue) => [leftValue, rightValue] as const)
      )
    )
  );

const isNamedNodeObject = (term: ObjectTerm): boolean => term.termType === "NamedNode";

const subjectIri = (term: Subject): O.Option<string> =>
  Subject.match(term, {
    NamedNode: (node) => O.some(node.value),
    BlankNode: noneString,
  });

const objectIri = (term: ObjectTerm): O.Option<string> =>
  ObjectTerm.match(term, {
    NamedNode: (node) => O.some(node.value),
    BlankNode: noneString,
    Literal: noneString,
  });

const literalValue = (term: ObjectTerm): O.Option<string> =>
  ObjectTerm.match(term, {
    NamedNode: noneString,
    BlankNode: noneString,
    Literal: (literal) => O.some(literal.value),
  });

const lastIriSegment = (iri: string): string =>
  pipe(
    iri,
    Str.split("#"),
    A.last,
    O.getOrElse(() => iri),
    Str.split("/"),
    A.last,
    O.getOrElse(() => iri)
  );

const labelFor = (labels: MutableHashMap.MutableHashMap<string, string>, iri: string): string =>
  pipe(
    MutableHashMap.get(labels, iri),
    O.getOrElse(() => lastIriSegment(iri))
  );

const relationshipKey = (relationship: OntologyRelationshipSummary): string =>
  `${relationship.sourceIri}\n${relationship.predicateIri}\n${relationship.objectIri}`;

const isVocabularyIri = (iri: string): boolean =>
  Str.startsWith(iri, RDF_NAMESPACE) || Str.startsWith(iri, RDFS_NAMESPACE) || Str.startsWith(iri, OWL_NAMESPACE);

const ontologyTypeIris: ReadonlyArray<string> = [
  OWL_CLASS_IRI,
  RDFS_CLASS_IRI,
  OWL_OBJECT_PROPERTY_IRI,
  OWL_DATATYPE_PROPERTY_IRI,
  RDF_PROPERTY_IRI,
];

const isOntologyTypeIri = (iri: string): boolean => pipe(ontologyTypeIris, A.contains(iri));

const propertyTypeIris: ReadonlyArray<string> = [
  OWL_OBJECT_PROPERTY_IRI,
  OWL_DATATYPE_PROPERTY_IRI,
  OWL_ANNOTATION_PROPERTY_IRI,
  RDF_PROPERTY_IRI,
];

const isPropertyTypeIri = (iri: string): boolean => pipe(propertyTypeIris, A.contains(iri));

const tboxPredicateIris: ReadonlyArray<string> = [
  RDFS_SUB_CLASS_OF.value,
  RDFS_SUB_PROPERTY_OF.value,
  RDFS_DOMAIN.value,
  RDFS_RANGE.value,
  OWL_EQUIVALENT_CLASS.value,
  OWL_EQUIVALENT_PROPERTY.value,
  OWL_DISJOINT_WITH.value,
];

const isTBoxPredicateIri = (iri: string): boolean => pipe(tboxPredicateIris, A.contains(iri));

const resourceKindFor = (
  iri: string,
  types: ReadonlyArray<string>,
  classIris: ReadonlyArray<string>,
  propertyIris: ReadonlyArray<string>,
  individualIris: ReadonlyArray<string>
): OntologyResourceKind => {
  if (
    pipe(types, A.contains(OWL_CLASS_IRI)) ||
    pipe(types, A.contains(RDFS_CLASS_IRI)) ||
    pipe(classIris, A.contains(iri))
  ) {
    return "class";
  }
  if (pipe(types, A.contains(OWL_OBJECT_PROPERTY_IRI))) {
    return "objectProperty";
  }
  if (pipe(types, A.contains(OWL_DATATYPE_PROPERTY_IRI))) {
    return "dataProperty";
  }
  if (pipe(types, A.contains(OWL_ANNOTATION_PROPERTY_IRI))) {
    return "annotationProperty";
  }
  if (pipe(types, A.some(isPropertyTypeIri)) || pipe(propertyIris, A.contains(iri))) {
    return "objectProperty";
  }
  if (pipe(types, A.contains(OWL_NAMED_INDIVIDUAL_IRI)) || pipe(individualIris, A.contains(iri))) {
    return "individual";
  }
  return "unknown";
};

/**
 * Shared ABox/TBox classification rule.
 *
 * **Example** (Classify dataProperty resource)
 *
 * ```ts
 * import { classifyOntologyResource } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const classification = classifyOntologyResource("dataProperty")
 *
 * console.log(classification)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const classifyOntologyResource = (kind: OntologyResourceKind): OntologyResourceClassification =>
  OntologyResourceKind.$match(kind, {
    class: () => "tbox",
    objectProperty: () => "tbox",
    dataProperty: () => "tbox",
    annotationProperty: () => "tbox",
    individual: () => "abox",
    unknown: () => "abox",
  }) as OntologyResourceClassification;

const metricsFor = (
  quads: ReadonlyArray<Quad>,
  resources: ReadonlyArray<OntologyResourceSummary>,
  disjointnessViolationCount = 0
): OntologyMetrics =>
  OntologyMetrics.make({
    quadCount: quads.length,
    resourceCount: resources.length,
    classCount: pipe(
      resources,
      A.filter((resource) => resource.kind === "class")
    ).length,
    propertyCount: pipe(
      resources,
      A.filter((resource) => pipe(["objectProperty", "dataProperty", "annotationProperty"], A.contains(resource.kind)))
    ).length,
    individualCount: pipe(
      resources,
      A.filter((resource) => resource.kind === "individual")
    ).length,
    tboxCount: pipe(
      resources,
      A.filter((resource) => resource.classification === "tbox")
    ).length,
    aboxCount: pipe(
      resources,
      A.filter((resource) => resource.classification === "abox")
    ).length,
    disjointnessViolationCount,
  });

type BuildOntologySnapshotOptions = {
  readonly disjointnessViolationCount: number;
  readonly includedPartitions: ReadonlyArray<GraphPartition>;
};

const defaultSnapshotOptions = (): BuildOntologySnapshotOptions => ({
  disjointnessViolationCount: 0,
  includedPartitions: ASSERTED_VIEW_PARTITIONS,
});

const buildOntologySnapshotFromPartitions = (
  session: Session,
  partitions: SessionGraphPartitions,
  options: BuildOntologySnapshotOptions
): OntologySnapshot => {
  const resources = MutableHashSet.empty<string>();
  const labels = MutableHashMap.empty<string, string>();
  const types = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const parents = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const children = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const resourcePartitions = MutableHashMap.empty<string, ReadonlyArray<GraphPartition>>();
  let relationships: ReadonlyArray<OntologyRelationshipSummary> = [];
  const classIris = MutableHashSet.empty<string>();
  const propertyIris = MutableHashSet.empty<string>();
  const individualIris = MutableHashSet.empty<string>();

  const quads = pipe(
    options.includedPartitions,
    A.flatMap((partition) =>
      pipe(
        partitions,
        (current) => current[partition].quads,
        A.map((quad) => ({ partition, quad }))
      )
    )
  );

  for (const { partition, quad } of quads) {
    pipe(
      subjectIri(quad.subject),
      O.match({
        onNone: () => undefined,
        onSome: (iri) => {
          MutableHashSet.add(resources, iri);
          upsertPartition(resourcePartitions, iri, partition);
        },
      })
    );

    if (quad.predicate.value === RDFS_LABEL.value) {
      pipe(
        subjectIri(quad.subject),
        (iri) => zipOptions(iri, literalValue(quad.object)),
        O.match({
          onNone: () => undefined,
          onSome: ([iri, label]) => MutableHashMap.set(labels, iri, label),
        })
      );
    }

    if (quad.predicate.value === RDF_TYPE.value) {
      pipe(
        subjectIri(quad.subject),
        (iri) => zipOptions(iri, objectIri(quad.object)),
        O.match({
          onNone: () => undefined,
          onSome: ([iri, typeIri]) => {
            upsertSet(types, iri, typeIri);
            if (isOntologyTypeIri(typeIri)) {
              MutableHashSet.add(classIris, iri);
            }
            if (isPropertyTypeIri(typeIri)) {
              MutableHashSet.add(propertyIris, iri);
            }
            if (!isVocabularyIri(typeIri) || sameIri(typeIri, OWL_NAMED_INDIVIDUAL_IRI)) {
              MutableHashSet.add(individualIris, iri);
            }
          },
        })
      );
    }

    if (quad.predicate.value === RDFS_SUB_CLASS_OF.value || quad.predicate.value === RDFS_SUB_PROPERTY_OF.value) {
      pipe(
        subjectIri(quad.subject),
        (iri) => zipOptions(iri, objectIri(quad.object)),
        O.match({
          onNone: () => undefined,
          onSome: ([childIri, parentIri]) => {
            MutableHashSet.add(resources, parentIri);
            upsertSet(parents, childIri, parentIri);
            upsertSet(children, parentIri, childIri);
            MutableHashSet.add(classIris, childIri);
            MutableHashSet.add(classIris, parentIri);
          },
        })
      );
    }

    if (isTBoxPredicateIri(quad.predicate.value)) {
      pipe(
        subjectIri(quad.subject),
        O.match({
          onNone: () => undefined,
          onSome: (iri) => {
            MutableHashSet.add(classIris, iri);
            MutableHashSet.add(resources, iri);
          },
        })
      );
      pipe(
        objectIri(quad.object),
        O.filter((iri) => !isVocabularyIri(iri)),
        O.match({
          onNone: () => undefined,
          onSome: (iri) => {
            MutableHashSet.add(resources, iri);
            MutableHashSet.add(classIris, iri);
          },
        })
      );
    }

    if (quad.predicate.value === RDFS_DOMAIN.value || quad.predicate.value === RDFS_RANGE.value) {
      pipe(
        subjectIri(quad.subject),
        O.match({
          onNone: () => undefined,
          onSome: (iri) => MutableHashSet.add(propertyIris, iri),
        })
      );
    }

    if (isNamedNodeObject(quad.object) && !isVocabularyIri(quad.object.value)) {
      MutableHashSet.add(resources, quad.object.value);
      upsertPartition(resourcePartitions, quad.object.value, partition);
      pipe(
        subjectIri(quad.subject),
        O.filter((iri) => !isVocabularyIri(iri)),
        O.match({
          onNone: () => undefined,
          onSome: (sourceIri) => {
            relationships = pipe(
              relationships,
              A.append(
                OntologyRelationshipSummary.make({
                  sourceIri,
                  predicateIri: quad.predicate.value,
                  objectIri: quad.object.value,
                  label: labelFor(labels, quad.predicate.value),
                  sourcePartitions: [partition],
                })
              )
            );
          },
        })
      );
    }
  }

  const resourceSummaries = pipe(
    resources,
    iriSetValues,
    A.map((iri) => {
      const resourceTypes = iriSetValues(pipe(MutableHashMap.get(types, iri), O.getOrElse(emptyStrings)));
      const kind = resourceKindFor(
        iri,
        resourceTypes,
        iriSetValues(classIris),
        iriSetValues(propertyIris),
        iriSetValues(individualIris)
      );
      return OntologyResourceSummary.make({
        iri,
        label: labelFor(labels, iri),
        kind,
        classification: classifyOntologyResource(kind),
        types: resourceTypes,
        parentIris: iriSetValues(pipe(MutableHashMap.get(parents, iri), O.getOrElse(emptyStrings))),
        sourcePartitions: pipe(
          MutableHashMap.get(resourcePartitions, iri),
          O.getOrElse(emptyGraphPartitions),
          A.sort(Order.String)
        ) as ReadonlyArray<GraphPartition>,
      });
    }),
    A.sortWith((resource) => resource.label, Order.String)
  );

  const hierarchy = pipe(
    resourceSummaries,
    A.map((resource) =>
      OntologyHierarchyEntry.make({
        iri: resource.iri,
        label: resource.label,
        childIris: iriSetValues(pipe(MutableHashMap.get(children, resource.iri), O.getOrElse(emptyStrings))),
      })
    ),
    A.sortWith((entry) => entry.label, Order.String)
  );

  return OntologySnapshot.make({
    sessionId: session.id,
    resources: resourceSummaries,
    hierarchy,
    relationships: pipe(
      relationships,
      A.dedupeWith((left, right) => relationshipKey(left) === relationshipKey(right)),
      A.sortWith((relationship) => relationship.label, Order.String)
    ),
    metrics: metricsFor(
      pipe(
        quads,
        A.map(({ quad }) => quad)
      ),
      resourceSummaries,
      options.disjointnessViolationCount
    ),
  });
};

/**
 * Build an ontology snapshot from the current authoring graph.
 *
 * **Example** (Build snapshot from session)
 *
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { buildOntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const snapshot = buildOntologySnapshot(session)
 *
 * console.log(snapshot.metrics.quadCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const buildOntologySnapshot = (session: Session): OntologySnapshot =>
  buildOntologySnapshotFromPartitions(session, deriveSessionGraphPartitions(session), defaultSnapshotOptions());

/**
 * Build an ontology snapshot that includes derived inferred graph quads.
 *
 * **Example** (Build snapshot with inference)
 *
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { buildOntologySnapshotWithInference, OntologyInferenceResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const inference = OntologyInferenceResult.make({
 *   processedChangeCount: 0,
 *   driftCap: NonNegativeInt.make(64),
 *   drifted: false,
 *   fullRecompute: true,
 *   changedSignatures: [],
 *   modules: [],
 *   disjointnessViolations: [],
 *   inferredDataset: makeDataset([])
 * })
 *
 * console.log(buildOntologySnapshotWithInference(session, inference).metrics.disjointnessViolationCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const buildOntologySnapshotWithInference: {
  (inference: OntologyInferenceResult): (session: Session) => OntologySnapshot;
  (session: Session, inference: OntologyInferenceResult): OntologySnapshot;
} = dual(
  2,
  (session: Session, inference: OntologyInferenceResult): OntologySnapshot =>
    buildOntologySnapshotFromPartitions(session, inferredSessionGraphPartitions(session, inference), {
      disjointnessViolationCount: inference.disjointnessViolations.length,
      includedPartitions: INFERRED_VIEW_PARTITIONS,
    })
);

/**
 * Shared explorer/search view-mode predicate.
 *
 * **Example** (Check abox resource visibility)
 *
 * ```ts
 * import { OntologyResourceSummary, resourceVisibleInViewMode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const resource = OntologyResourceSummary.make({
 *   iri: "https://example.test/alice",
 *   label: "Alice",
 *   kind: "individual",
 *   classification: "abox",
 *   types: [],
 *   parentIris: [],
 *   sourcePartitions: ["asserted"]
 * })
 *
 * console.log(resourceVisibleInViewMode(resource, "abox"))
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const resourceVisibleInViewMode: {
  (mode: OntologyViewMode): (resource: OntologyResourceSummary) => boolean;
  (resource: OntologyResourceSummary, mode: OntologyViewMode): boolean;
} = dual(2, (resource: OntologyResourceSummary, mode: OntologyViewMode): boolean =>
  OntologyViewMode.$match(mode, {
    all: () => true,
    tbox: () => resource.classification === "tbox",
    abox: () => resource.classification === "abox",
  })
);

type SearchOntologyResourcesOptions = {
  readonly mode: OntologyViewMode;
  readonly query: string;
};

/**
 * Search ontology resources using the same ABox/TBox rule as the explorer.
 *
 * **Example** (Search resources by query)
 *
 * ```ts
 * import { OntologyMetrics, OntologyResourceSummary, OntologySnapshot, searchOntologyResources } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const snapshot = OntologySnapshot.make({
 *   sessionId: "session-1",
 *   resources: [
 *     OntologyResourceSummary.make({
 *       iri: "https://example.test/Pizza",
 *       label: "Pizza",
 *       kind: "class",
 *       classification: "tbox",
 *       types: [],
 *       parentIris: [],
 *       sourcePartitions: ["asserted"]
 *     })
 *   ],
 *   hierarchy: [],
 *   metrics: OntologyMetrics.make({
 *     quadCount: 0,
 *     resourceCount: 1,
 *     classCount: 1,
 *     propertyCount: 0,
 *     individualCount: 0,
 *     tboxCount: 1,
 *     aboxCount: 0
 *   })
 * })
 * const matches = searchOntologyResources(snapshot, { query: "pizza", mode: "tbox" })
 *
 * console.log(matches.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const searchOntologyResources: {
  (options: SearchOntologyResourcesOptions): (snapshot: OntologySnapshot) => ReadonlyArray<OntologyResourceSummary>;
  (snapshot: OntologySnapshot, options: SearchOntologyResourcesOptions): ReadonlyArray<OntologyResourceSummary>;
} = dual(
  2,
  (snapshot: OntologySnapshot, options: SearchOntologyResourcesOptions): ReadonlyArray<OntologyResourceSummary> => {
    const normalized = Str.toLowerCase(Str.trim(options.query));
    return pipe(
      snapshot.resources,
      A.filter((resource) => resourceVisibleInViewMode(resource, options.mode)),
      A.filter((resource) =>
        Str.isEmpty(normalized)
          ? true
          : Str.contains(Str.toLowerCase(resource.label), normalized) ||
            Str.contains(Str.toLowerCase(resource.iri), normalized)
      ),
      A.sortWith((resource) => resource.label, Order.String)
    );
  }
);

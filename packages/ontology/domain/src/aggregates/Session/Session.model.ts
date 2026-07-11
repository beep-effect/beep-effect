/**
 * Ontology session aggregate model.
 *
 * @remarks
 * The session keeps imported RDF values in a pure domain model. N3/Turtle IO is
 * owned by server and driver packages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyDomainId } from "@beep/identity/packages";
import {
  Dataset,
  GraphTerm,
  makeDataset,
  makeNamedNode,
  NamedNode,
  PrefixMap,
  Quad,
  serializeQuad,
  serializeTerm,
} from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, O } from "@beep/utils";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { GraphPartition, graphPartitionIri, isExcludedFromReasoning, SessionId } from "./Session.values.js";
import type { Subject } from "@beep/rdf/Rdf";

const $I = $OntologyDomainId.create("aggregates/Session/Session.model");

const ChangeOperationKind = LiteralKit(["addQuad", "removeQuad"]);
const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);

type PartitionedQuad = {
  readonly partition: GraphPartition;
  readonly quad: Quad;
};

/** Authenticated actor IRI retained on an ontology change journal entry.
 * @example
 * ```ts
 * import { OntologyChangeActor } from "@beep/ontology-domain/aggregates/Session"
 * const actor = OntologyChangeActor.make("urn:beep:desktop-mcp-client:1")
 * console.log(actor)
 * ```
 * @category models
 * @since 0.0.0
 */
export const OntologyChangeActor = S.NonEmptyString.pipe(
  S.brand("OntologyChangeActor"),
  $I.annoteSchema("OntologyChangeActor", {
    description: "Authenticated actor IRI retained on an ontology change journal entry.",
  })
);

/** Type for {@link OntologyChangeActor}.
 * @example
 * ```ts
 * import { OntologyChangeActor } from "@beep/ontology-domain/aggregates/Session"
 * import type { OntologyChangeActor as OntologyChangeActorType } from "@beep/ontology-domain/aggregates/Session"
 * const actor: OntologyChangeActorType = OntologyChangeActor.make("urn:beep:desktop-mcp-client:1")
 * console.log(actor)
 * ```
 * @category models
 * @since 0.0.0
 */
export type OntologyChangeActor = typeof OntologyChangeActor.Type;

const OptionalOntologyChangeActor = S.optionalKey(OntologyChangeActor);

const isDefaultGraph = (graph: GraphTerm): boolean =>
  GraphTerm.match(graph, {
    DefaultGraph: () => true,
    NamedNode: () => false,
    BlankNode: () => false,
  });

const graphIsCanonicalPartition = (graph: GraphTerm, partition: Exclude<GraphPartition, "asserted">): boolean =>
  GraphTerm.match(graph, {
    DefaultGraph: () => false,
    NamedNode: (node) => node.value === graphPartitionIri(partition),
    BlankNode: () => false,
  });

const graphMatchesPartition = (change: PartitionedQuad): boolean =>
  GraphPartition.$match(change.partition, {
    asserted: () => isDefaultGraph(change.quad.graph),
    ontologies: () => isDefaultGraph(change.quad.graph) || graphIsCanonicalPartition(change.quad.graph, "ontologies"),
    inferred: () => isDefaultGraph(change.quad.graph) || graphIsCanonicalPartition(change.quad.graph, "inferred"),
    shapes: () => isDefaultGraph(change.quad.graph) || graphIsCanonicalPartition(change.quad.graph, "shapes"),
    provenance: () => isDefaultGraph(change.quad.graph) || graphIsCanonicalPartition(change.quad.graph, "provenance"),
  });

const PartitionGraphCoherenceCheck = S.makeFilter(graphMatchesPartition, {
  identifier: $I`PartitionGraphCoherenceCheck`,
  title: "Partition Graph Coherence",
  description: "Change operation quad graph must match the declared session partition.",
  message: "Change operation quad graph must match the declared session partition",
});

const ChangeOperationBase = ChangeOperationKind.toTaggedUnion("kind")({
  addQuad: {
    partition: GraphPartition,
    quad: Quad,
    actor: OptionalOntologyChangeActor,
  },
  removeQuad: {
    partition: GraphPartition,
    quad: Quad,
    actor: OptionalOntologyChangeActor,
  },
});

/**
 * Typed ontology change operation over RDF quads.
 *
 * @example
 * ```ts
 * import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const change = ChangeOperation.make({
 *   kind: "addQuad",
 *   partition: "asserted",
 *   quad: makeQuad(
 *     makeNamedNode("https://example.test/alice"),
 *     makeNamedNode("https://example.test/knows"),
 *     makeNamedNode("https://example.test/bob")
 *   )
 * })
 *
 * console.log(change.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ChangeOperation = Object.assign(
  ChangeOperationBase.pipe(
    S.check(PartitionGraphCoherenceCheck),
    $I.annoteSchema("ChangeOperation", {
      description: "Typed change operation applied to an ontology session partition.",
    }),
    SchemaUtils.withCodecStatics
  ),
  {
    match: ChangeOperationBase.match,
  }
);

/**
 * Type for {@link ChangeOperation}.
 *
 * @example
 * ```ts
 * import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const change: ChangeOperation = ChangeOperation.make({
 *   kind: "removeQuad",
 *   partition: "asserted",
 *   quad: makeQuad(
 *     makeNamedNode("https://example.test/alice"),
 *     makeNamedNode("https://example.test/knows"),
 *     makeNamedNode("https://example.test/bob")
 *   )
 * })
 *
 * console.log(change.partition)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ChangeOperation = typeof ChangeOperation.Type;

/**
 * Derived RDF datasets for every ontology session named graph partition.
 *
 * @example
 * ```ts
 * import { emptySessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session"
 *
 * const partitions = emptySessionGraphPartitions()
 *
 * console.log(partitions.asserted.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class SessionGraphPartitions extends S.Class<SessionGraphPartitions>($I`SessionGraphPartitions`)(
  {
    asserted: Dataset,
    ontologies: Dataset,
    inferred: Dataset,
    shapes: Dataset,
    provenance: Dataset,
  },
  $I.annote("SessionGraphPartitions", {
    description: "Derived RDF datasets for every ontology session named graph partition.",
  })
) {}

/**
 * Named graph view derived from a session partition.
 *
 * @example
 * ```ts
 * import { NamedGraphPartition } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset, makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const namedGraph = NamedGraphPartition.make({
 *   partition: "asserted",
 *   graph: makeNamedNode("urn:beep:ontology:graph:asserted"),
 *   dataset: makeDataset([]),
 *   excludedFromReasoning: false
 * })
 *
 * console.log(namedGraph.graph.value)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class NamedGraphPartition extends S.Class<NamedGraphPartition>($I`NamedGraphPartition`)(
  {
    partition: GraphPartition,
    graph: NamedNode,
    dataset: Dataset,
    excludedFromReasoning: S.Boolean,
  },
  $I.annote("NamedGraphPartition", {
    description: "Named graph view derived from a session partition.",
  })
) {}

/**
 * Real dataset delta produced by applying ontology change operations.
 *
 * @example
 * ```ts
 * import { SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session"
 *
 * const delta = SessionChangeDelta.make({
 *   added: [],
 *   removed: []
 * })
 *
 * console.log(delta.added.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class SessionChangeDelta extends S.Class<SessionChangeDelta>($I`SessionChangeDelta`)(
  {
    added: S.Array(Quad),
    removed: S.Array(Quad),
  },
  $I.annote("SessionChangeDelta", {
    description: "Real RDF quad delta produced by applying ontology change operations.",
  })
) {}

const emptyPrefixMap = (): PrefixMap => ({});

const PrefixMapWithEmptyDefault = PrefixMap.pipe(
  S.withConstructorDefault(Effect.succeed(emptyPrefixMap())),
  S.withDecodingDefaultKey(Effect.succeed(emptyPrefixMap()))
);

/**
 * Ontology workbench session with base dataset and ordered change log.
 *
 * @example
 * ```ts
 * import { Session, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = Session.make({
 *   id: S.decodeUnknownSync(SessionId)("session-1"),
 *   baseDataset: makeDataset([]),
 *   changeLog: []
 * })
 *
 * console.log(session.changeLog.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class Session extends S.Class<Session>($I`Session`)(
  {
    id: SessionId,
    baseDataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
    changeLog: S.Array(ChangeOperation),
  },
  $I.annote("Session", {
    description: "Ontology workbench session with base dataset and ordered change log.",
  })
) {}

/**
 * Applied session batch with the updated session and real dataset delta.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, emptySessionChangeDelta, SessionChangeApplication, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const applied = SessionChangeApplication.make({
 *   session,
 *   delta: emptySessionChangeDelta(),
 *   operations: []
 * })
 *
 * console.log(applied.operations.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class SessionChangeApplication extends S.Class<SessionChangeApplication>($I`SessionChangeApplication`)(
  {
    session: Session,
    delta: SessionChangeDelta,
    operations: S.Array(ChangeOperation),
  },
  $I.annote("SessionChangeApplication", {
    description: "Applied session batch containing the updated session and real dataset delta.",
  })
) {}

/**
 * Input for creating an ontology session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const input = CreateSessionInput.make({
 *   id: S.decodeUnknownSync(SessionId)("session-1"),
 *   baseDataset: makeDataset([])
 * })
 *
 * console.log(input.baseDataset.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class CreateSessionInput extends S.Class<CreateSessionInput>($I`CreateSessionInput`)(
  {
    id: SessionId,
    baseDataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  },
  $I.annote("CreateSessionInput", {
    description: "Input for creating an ontology session.",
  })
) {}

const emptyDataset = () => makeDataset([]);

/**
 * Empty session change delta.
 *
 * @example
 * ```ts
 * import { emptySessionChangeDelta } from "@beep/ontology-domain/aggregates/Session"
 *
 * const delta = emptySessionChangeDelta()
 *
 * console.log(delta.removed.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const emptySessionChangeDelta = (): SessionChangeDelta =>
  SessionChangeDelta.make({
    added: [],
    removed: [],
  });

/**
 * Empty partition set.
 *
 * @example
 * ```ts
 * import { emptySessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session"
 *
 * const partitions = emptySessionGraphPartitions()
 *
 * console.log(partitions.inferred.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const emptySessionGraphPartitions = (): SessionGraphPartitions =>
  SessionGraphPartitions.make({
    asserted: emptyDataset(),
    ontologies: emptyDataset(),
    inferred: emptyDataset(),
    shapes: emptyDataset(),
    provenance: emptyDataset(),
  });

const sameQuad = (left: Quad, right: Quad): boolean => serializeQuad(left) === serializeQuad(right);

const hasQuad = (quads: ReadonlyArray<Quad>, candidate: Quad): boolean =>
  pipe(
    quads,
    A.some((quad) => sameQuad(quad, candidate))
  );

const addQuad = (dataset: Dataset, quad: Quad): Dataset =>
  hasQuad(dataset.quads, quad) ? dataset : makeDataset(pipe(dataset.quads, A.append(quad)));

const removeQuad = (dataset: Dataset, target: Quad): Dataset =>
  makeDataset(
    pipe(
      dataset.quads,
      A.filter((quad) => !sameQuad(quad, target))
    )
  );

const subjectKey = (subject: Subject): string => serializeTerm(subject);
const quadSubjectKey = (quad: Quad): string => subjectKey(quad.subject);

const objectSubjectKeys = (quad: Quad): ReadonlyArray<string> =>
  quad.object.termType === "NamedNode" || quad.object.termType === "BlankNode" ? [subjectKey(quad.object)] : [];

const blankObjectSubjectKeys = (quad: Quad): ReadonlyArray<string> =>
  quad.object.termType === "BlankNode" ? [subjectKey(quad.object)] : [];

const hasSubjectKey = (keys: ReadonlyArray<string>, quad: Quad): boolean =>
  pipe(keys, A.contains(quadSubjectKey(quad)));

const nodeShapeSubjectKeys = (dataset: Dataset): ReadonlyArray<string> =>
  pipe(
    dataset.quads,
    A.filter((quad) => quad.predicate.value === RDF_TYPE.value),
    A.filter((quad) => quad.object.termType === "NamedNode" && quad.object.value === SH_NODE_SHAPE.value),
    A.map(quadSubjectKey),
    A.dedupe
  );

const propertyShapeSubjectKeys = (dataset: Dataset, shapeSubjectKeys: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    dataset.quads,
    A.filter((quad) => hasSubjectKey(shapeSubjectKeys, quad)),
    A.filter((quad) => quad.predicate.value === SH_PROPERTY.value),
    A.flatMap(objectSubjectKeys),
    A.dedupe
  );

const baseShapeSubjectKeys = (dataset: Dataset): ReadonlyArray<string> => {
  const nodeShapes = nodeShapeSubjectKeys(dataset);
  const seeds = pipe(nodeShapes, A.appendAll(propertyShapeSubjectKeys(dataset, nodeShapes)), A.dedupe);
  let visited: ReadonlyArray<string> = [];
  let frontier = seeds;

  while (frontier.length > 0) {
    const current = frontier[0];
    frontier = pipe(frontier, A.drop(1));
    if (current === undefined || pipe(visited, A.contains(current))) {
      continue;
    }

    visited = pipe(visited, A.append(current));
    const next = pipe(
      dataset.quads,
      A.filter((quad) => quadSubjectKey(quad) === current),
      A.flatMap(blankObjectSubjectKeys),
      A.filter((key) => !pipe(visited, A.contains(key))),
      A.filter((key) => !pipe(frontier, A.contains(key)))
    );
    frontier = pipe(frontier, A.appendAll(next));
  }

  return visited;
};

/**
 * Classify an ingested RDF dataset into asserted and SHACL-shape partitions.
 *
 * @example
 * ```ts
 * import { classifySessionDatasetPartitions } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const partitions = classifySessionDatasetPartitions(makeDataset([]))
 * console.log(partitions.asserted.quads.length) // 0
 * ```
 *
 * @remarks This classifier is shared by base-document ingestion and typed
 * change-batch validation so SHACL closure follows one routing rule.
 * @category utilities
 * @since 0.0.0
 */
export const classifySessionDatasetPartitions = (
  dataset: Dataset
): Pick<SessionGraphPartitions, "asserted" | "shapes"> => {
  const shapeSubjectKeys = baseShapeSubjectKeys(dataset);
  return {
    asserted: makeDataset(
      pipe(
        dataset.quads,
        A.filter((quad) => !hasSubjectKey(shapeSubjectKeys, quad))
      )
    ),
    shapes: makeDataset(
      pipe(
        dataset.quads,
        A.filter((quad) => hasSubjectKey(shapeSubjectKeys, quad))
      )
    ),
  };
};

/**
 * Read the dataset for a partition.
 *
 * @example
 * ```ts
 * import { datasetForPartition, emptySessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session"
 *
 * const asserted = datasetForPartition(emptySessionGraphPartitions(), "asserted")
 *
 * console.log(asserted.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const datasetForPartition: {
  (partition: GraphPartition): (partitions: SessionGraphPartitions) => Dataset;
  (partitions: SessionGraphPartitions, partition: GraphPartition): Dataset;
} = dual(
  2,
  (partitions: SessionGraphPartitions, partition: GraphPartition): Dataset =>
    GraphPartition.$match(partition, {
      asserted: () => partitions.asserted,
      ontologies: () => partitions.ontologies,
      inferred: () => partitions.inferred,
      shapes: () => partitions.shapes,
      provenance: () => partitions.provenance,
    })
);

const setPartitionDataset = (
  partitions: SessionGraphPartitions,
  partition: GraphPartition,
  dataset: Dataset
): SessionGraphPartitions =>
  GraphPartition.$match(partition, {
    asserted: () => SessionGraphPartitions.make({ ...partitions, asserted: dataset }),
    ontologies: () => SessionGraphPartitions.make({ ...partitions, ontologies: dataset }),
    inferred: () => SessionGraphPartitions.make({ ...partitions, inferred: dataset }),
    shapes: () => SessionGraphPartitions.make({ ...partitions, shapes: dataset }),
    provenance: () => SessionGraphPartitions.make({ ...partitions, provenance: dataset }),
  });

const applyChangeToDataset = (dataset: Dataset, change: ChangeOperation): Dataset =>
  ChangeOperation.match(change, {
    addQuad: ({ quad }) => addQuad(dataset, quad),
    removeQuad: ({ quad }) => removeQuad(dataset, quad),
  });

/**
 * Combine two real session deltas.
 *
 * @example
 * ```ts
 * import { combineSessionChangeDelta, emptySessionChangeDelta, SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session"
 *
 * const combined = combineSessionChangeDelta(
 *   emptySessionChangeDelta(),
 *   SessionChangeDelta.make({ added: [], removed: [] })
 * )
 *
 * console.log(combined.added.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const combineSessionChangeDelta: {
  (right: SessionChangeDelta): (left: SessionChangeDelta) => SessionChangeDelta;
  (left: SessionChangeDelta, right: SessionChangeDelta): SessionChangeDelta;
} = dual(
  2,
  (left: SessionChangeDelta, right: SessionChangeDelta): SessionChangeDelta =>
    SessionChangeDelta.make({
      added: pipe(left.added, A.appendAll(right.added)),
      removed: pipe(left.removed, A.appendAll(right.removed)),
    })
);

/**
 * Compute the real dataset delta for one change operation before it is applied.
 *
 * @example
 * ```ts
 * import { changeDeltaForOperation, ChangeOperation, emptySessionGraphPartitions } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const delta = changeDeltaForOperation(
 *   emptySessionGraphPartitions(),
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * )
 *
 * console.log(delta.added.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const changeDeltaForOperation: {
  (change: ChangeOperation): (partitions: SessionGraphPartitions) => SessionChangeDelta;
  (partitions: SessionGraphPartitions, change: ChangeOperation): SessionChangeDelta;
} = dual(2, (partitions: SessionGraphPartitions, change: ChangeOperation): SessionChangeDelta => {
  const dataset = datasetForPartition(partitions, change.partition);
  return ChangeOperation.match(change, {
    addQuad: ({ quad }) =>
      hasQuad(dataset.quads, quad)
        ? emptySessionChangeDelta()
        : SessionChangeDelta.make({
            added: [quad],
            removed: [],
          }),
    removeQuad: ({ quad }) =>
      hasQuad(dataset.quads, quad)
        ? SessionChangeDelta.make({
            added: [],
            removed: [quad],
          })
        : emptySessionChangeDelta(),
  });
});

/**
 * Apply one change operation to partitioned session datasets.
 *
 * @example
 * ```ts
 * import { applyChangeToPartitions, ChangeOperation, emptySessionGraphPartitions, graphPartitionIri } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const next = applyChangeToPartitions(
 *   emptySessionGraphPartitions(),
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "ontologies",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       {
 *         object: makeNamedNode("https://example.test/bob"),
 *         graph: makeNamedNode(graphPartitionIri("ontologies"))
 *       }
 *     )
 *   })
 * )
 *
 * console.log(next.ontologies.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const applyChangeToPartitions: {
  (change: ChangeOperation): (partitions: SessionGraphPartitions) => SessionGraphPartitions;
  (partitions: SessionGraphPartitions, change: ChangeOperation): SessionGraphPartitions;
} = dual(
  2,
  (partitions: SessionGraphPartitions, change: ChangeOperation): SessionGraphPartitions =>
    setPartitionDataset(
      partitions,
      change.partition,
      applyChangeToDataset(datasetForPartition(partitions, change.partition), change)
    )
);

/**
 * Create an ontology session from a base asserted dataset.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 *
 * console.log(session.id)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const createSession = (input: CreateSessionInput): Session =>
  Session.make({
    id: input.id,
    baseDataset: input.baseDataset,
    prefixes: input.prefixes,
    changeLog: [],
  });

/**
 * Append a typed change operation to a session.
 *
 * @example
 * ```ts
 * import { appendChange, ChangeOperation, CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const updated = appendChange(
 *   session,
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * )
 *
 * console.log(updated.changeLog.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const appendChange: {
  (change: ChangeOperation): (session: Session) => Session;
  (session: Session, change: ChangeOperation): Session;
} = dual(
  2,
  (session: Session, change: ChangeOperation): Session =>
    Session.make({
      ...session,
      changeLog: pipe(session.changeLog, A.append(change)),
    })
);

/**
 * Append a batch of typed change operations to a session.
 *
 * @example
 * ```ts
 * import { appendChanges, ChangeOperation, CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const updated = appendChanges(session, [
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * ])
 *
 * console.log(updated.changeLog.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const appendChanges: {
  (changes: ReadonlyArray<ChangeOperation>): (session: Session) => Session;
  (session: Session, changes: ReadonlyArray<ChangeOperation>): Session;
} = dual(
  2,
  (session: Session, changes: ReadonlyArray<ChangeOperation>): Session =>
    Session.make({
      ...session,
      changeLog: pipe(session.changeLog, A.appendAll(changes)),
    })
);

/**
 * Invert one authored change operation for undo/redo.
 *
 * @example
 * ```ts
 * import { ChangeOperation, invertChangeOperation } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const inverted = invertChangeOperation(
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * )
 *
 * console.log(inverted.kind)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const invertChangeOperation = (change: ChangeOperation): ChangeOperation =>
  ChangeOperation.match(change, {
    addQuad: ({ actor, partition, quad }) =>
      ChangeOperation.make({
        kind: "removeQuad",
        partition,
        quad,
        ...O.getSomesStruct({ actor: O.fromUndefinedOr(actor) }),
      }),
    removeQuad: ({ actor, partition, quad }) =>
      ChangeOperation.make({
        kind: "addQuad",
        partition,
        quad,
        ...O.getSomesStruct({ actor: O.fromUndefinedOr(actor) }),
      }),
  });

/**
 * Derive named graph partition datasets from session base and change log.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, deriveSessionGraphPartitions, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const partitions = deriveSessionGraphPartitions(session)
 *
 * console.log(partitions.asserted.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const deriveSessionGraphPartitions = (session: Session): SessionGraphPartitions => {
  const base = classifySessionDatasetPartitions(session.baseDataset);
  return pipe(
    session.changeLog,
    A.reduce(
      SessionGraphPartitions.make({
        ...emptySessionGraphPartitions(),
        asserted: base.asserted,
        shapes: base.shapes,
      }),
      applyChangeToPartitions
    )
  );
};

/**
 * Apply a batch of operations and return the updated session plus real delta.
 *
 * @example
 * ```ts
 * import { applyChangeOperationsWithDelta, ChangeOperation, CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const applied = applyChangeOperationsWithDelta(session, [
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * ])
 *
 * console.log(applied.delta.added.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const applyChangeOperationsWithDelta: {
  (operations: ReadonlyArray<ChangeOperation>): (session: Session) => SessionChangeApplication;
  (session: Session, operations: ReadonlyArray<ChangeOperation>): SessionChangeApplication;
} = dual(2, (session: Session, operations: ReadonlyArray<ChangeOperation>): SessionChangeApplication => {
  const initial = {
    delta: emptySessionChangeDelta(),
    partitions: deriveSessionGraphPartitions(session),
  };
  const result = pipe(
    operations,
    A.reduce(initial, (state, operation) => {
      const delta = changeDeltaForOperation(state.partitions, operation);
      return {
        delta: combineSessionChangeDelta(state.delta, delta),
        partitions: applyChangeToPartitions(state.partitions, operation),
      };
    })
  );

  return SessionChangeApplication.make({
    session: appendChanges(session, operations),
    delta: result.delta,
    operations: A.fromIterable(operations),
  });
});

const makeNamedGraphPartition = (partitions: SessionGraphPartitions, partition: GraphPartition): NamedGraphPartition =>
  NamedGraphPartition.make({
    partition,
    graph: makeNamedNode(graphPartitionIri(partition)),
    dataset: datasetForPartition(partitions, partition),
    excludedFromReasoning: isExcludedFromReasoning(partition),
  });

/**
 * Derive all named graph views for a session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, deriveNamedGraphs, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const session = createSession(
 *   CreateSessionInput.make({
 *     id: S.decodeUnknownSync(SessionId)("session-1"),
 *     baseDataset: makeDataset([])
 *   })
 * )
 * const namedGraphs = deriveNamedGraphs(session)
 *
 * console.log(namedGraphs.length)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const deriveNamedGraphs = (session: Session): ReadonlyArray<NamedGraphPartition> => {
  const partitions = deriveSessionGraphPartitions(session);
  return [
    makeNamedGraphPartition(partitions, "asserted"),
    makeNamedGraphPartition(partitions, "ontologies"),
    makeNamedGraphPartition(partitions, "inferred"),
    makeNamedGraphPartition(partitions, "shapes"),
    makeNamedGraphPartition(partitions, "provenance"),
  ];
};

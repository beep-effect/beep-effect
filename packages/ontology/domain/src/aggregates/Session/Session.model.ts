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

import { make as makeIdentity } from "@beep/identity";
import { Dataset, makeDataset, makeNamedNode, NamedNode, Quad, serializeQuad } from "@beep/rdf/Rdf";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { GraphPartition, graphPartitionIri, isExcludedFromReasoning, SessionId } from "./Session.values.js";

const { $OntologyDomainId } = makeIdentity("ontology-domain");
const $I = $OntologyDomainId.create("aggregates/Session/Session.model");

const ChangeOperationKind = LiteralKit(["addQuad", "removeQuad"]);

/**
 * Typed ontology change operation over RDF quads.
 *
 * @since 0.0.0
 * @category models
 */
export const ChangeOperation = ChangeOperationKind.toTaggedUnion("kind")({
  addQuad: {
    partition: GraphPartition,
    quad: Quad,
  },
  removeQuad: {
    partition: GraphPartition,
    quad: Quad,
  },
}).pipe(
  $I.annoteSchema("ChangeOperation", {
    description: "Typed change operation applied to an ontology session partition.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ChangeOperation}.
 *
 * @since 0.0.0
 * @category models
 */
export type ChangeOperation = typeof ChangeOperation.Type;

/**
 * Derived RDF datasets for every ontology session named graph partition.
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
 * Ontology workbench session with base dataset and ordered change log.
 *
 * @since 0.0.0
 * @category models
 */
export class Session extends S.Class<Session>($I`Session`)(
  {
    id: SessionId,
    baseDataset: Dataset,
    changeLog: S.Array(ChangeOperation),
  },
  $I.annote("Session", {
    description: "Ontology workbench session with base dataset and ordered change log.",
  })
) {}

/**
 * Input for creating an ontology session.
 *
 * @since 0.0.0
 * @category models
 */
export class CreateSessionInput extends S.Class<CreateSessionInput>($I`CreateSessionInput`)(
  {
    id: SessionId,
    baseDataset: Dataset,
  },
  $I.annote("CreateSessionInput", {
    description: "Input for creating an ontology session.",
  })
) {}

const emptyDataset = () => makeDataset([]);

/**
 * Empty partition set.
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

/**
 * Read the dataset for a partition.
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
 * Apply one change operation to partitioned session datasets.
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
 * @since 0.0.0
 * @category constructors
 */
export const createSession = (input: CreateSessionInput): Session =>
  Session.make({
    id: input.id,
    baseDataset: input.baseDataset,
    changeLog: [],
  });

/**
 * Append a typed change operation to a session.
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
 * Derive named graph partition datasets from session base and change log.
 *
 * @since 0.0.0
 * @category utilities
 */
export const deriveSessionGraphPartitions = (session: Session): SessionGraphPartitions =>
  pipe(
    session.changeLog,
    A.reduce(
      SessionGraphPartitions.make({
        ...emptySessionGraphPartitions(),
        asserted: session.baseDataset,
      }),
      applyChangeToPartitions
    )
  );

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

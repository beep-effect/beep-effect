/**
 * Ontology session supporting value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const { $OntologyDomainId } = makeIdentity("ontology-domain");
const $I = $OntologyDomainId.create("aggregates/Session/Session.values");

/**
 * Stable ontology workbench session id.
 *
 * @since 0.0.0
 * @category models
 */
export const SessionId = S.NonEmptyString.pipe(
  S.brand("OntologySessionId"),
  $I.annoteSchema("SessionId", {
    description: "Stable id for an ontology workbench session.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link SessionId}.
 *
 * @since 0.0.0
 * @category models
 */
export type SessionId = typeof SessionId.Type;

/**
 * Derived named graph partitions owned by an ontology session.
 *
 * @since 0.0.0
 * @category models
 */
export const GraphPartition = LiteralKit(["asserted", "ontologies", "inferred", "shapes", "provenance"]).pipe(
  $I.annoteSchema("GraphPartition", {
    description: "Derived ontology session named graph partition.",
  })
);

/**
 * Type for {@link GraphPartition}.
 *
 * @since 0.0.0
 * @category models
 */
export type GraphPartition = typeof GraphPartition.Type;

/**
 * Canonical graph IRI for each ontology session partition.
 *
 * @since 0.0.0
 * @category utilities
 */
export const graphPartitionIri = (partition: GraphPartition): string =>
  GraphPartition.$match(partition, {
    asserted: () => "urn:beep:ontology:graph:asserted",
    ontologies: () => "urn:beep:ontology:graph:ontologies",
    inferred: () => "urn:beep:ontology:graph:inferred",
    shapes: () => "urn:beep:ontology:graph:shapes",
    provenance: () => "urn:beep:ontology:graph:provenance",
  });

/**
 * Shared SPEC 13 exclusion rule for derived graph partitions.
 *
 * @since 0.0.0
 * @category utilities
 */
export const isExcludedFromReasoning = (partition: GraphPartition): boolean =>
  GraphPartition.$match(partition, {
    asserted: () => false,
    ontologies: () => false,
    inferred: () => true,
    shapes: () => true,
    provenance: () => true,
  });

/**
 * Ontology session supporting value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { thunkFalse, thunkTrue } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $OntologyDomainId.create("aggregates/Session/Session.values");

/**
 * Stable ontology workbench session id.
 *
 * @example
 * ```ts
 * import { SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const sessionId = S.decodeUnknownSync(SessionId)("session-1")
 *
 * console.log(sessionId)
 * ```
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
 * @example
 * ```ts
 * import { SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const sessionId: SessionId = S.decodeUnknownSync(SessionId)("session-1")
 *
 * console.log(sessionId)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SessionId = typeof SessionId.Type;

/**
 * Derived named graph partitions owned by an ontology session.
 *
 * @example
 * ```ts
 * import { graphPartitionIri } from "@beep/ontology-domain/aggregates/Session"
 *
 * const graphIri = graphPartitionIri("asserted")
 *
 * console.log(graphIri)
 * ```
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
 * @example
 * ```ts
 * import { graphPartitionIri, GraphPartition } from "@beep/ontology-domain/aggregates/Session"
 *
 * const partition: GraphPartition = "ontologies"
 *
 * console.log(graphPartitionIri(partition))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GraphPartition = typeof GraphPartition.Type;

/**
 * Canonical graph IRI for each ontology session partition.
 *
 * @example
 * ```ts
 * import { graphPartitionIri } from "@beep/ontology-domain/aggregates/Session"
 *
 * const iri = graphPartitionIri("provenance")
 *
 * console.log(iri)
 * ```
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
 * @example
 * ```ts
 * import { isExcludedFromReasoning } from "@beep/ontology-domain/aggregates/Session"
 *
 * const excluded = isExcludedFromReasoning("shapes")
 *
 * console.log(excluded)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const isExcludedFromReasoning = (partition: GraphPartition): boolean =>
  GraphPartition.$match(partition, {
    asserted: thunkFalse,
    ontologies: thunkFalse,
    inferred: thunkTrue,
    shapes: thunkTrue,
    provenance: thunkTrue,
  });

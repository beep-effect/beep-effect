import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI } from "@beep/rdf/Iri";
import { ObjectRef } from "@beep/rdf/Prov";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import {
  Entity,
  EntityObservation,
  EvidenceSpan,
  GroundingDecision,
  KnowledgeGraph,
  makeExtractionProvenanceBundle,
} from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { entityToClaims } from "../../Utils/ClaimFactory.ts";
import { mergeGraphs } from "../../Workflow/Merge.ts";

describe("grounding provenance", () => {
  it.effect(
    "prefers supported grounding while retaining rejected observations and PROV records",
    Effect.fnUntraced(function* () {
      const activity = yield* S.decodeEffect(ObjectRef)("urn:beep:test:activity");
      const source = yield* S.decodeEffect(ObjectRef)("urn:beep:test:source:chunk:0");
      const rejectedArtifact = yield* S.decodeEffect(ObjectRef)("urn:beep:test:artifact:rejected");
      const supportedArtifact = yield* S.decodeEffect(ObjectRef)("urn:beep:test:artifact:supported");
      const rejectedObservationId = yield* S.decodeEffect(ObjectRef)("urn:beep:test:observation:rejected");
      const supportedObservationId = yield* S.decodeEffect(ObjectRef)("urn:beep:test:observation:supported");
      const rejectedEvidence = yield* S.decodeEffect(EvidenceSpan)({
        text: "Ada",
        startChar: 0,
        endChar: 3,
      });
      const supportedEvidence = yield* S.decodeEffect(EvidenceSpan)({
        text: "Lovelace",
        startChar: 4,
        endChar: 12,
      });
      const rejected = GroundingDecision.cases.Rejected.make({ confidence: Confidence.make(0.9) });
      const supported = GroundingDecision.cases.Supported.make({ confidence: Confidence.make(0.95) });
      const rejectedObservation = EntityObservation.make({
        id: rejectedObservationId,
        provenance: rejectedArtifact,
        activity,
        source,
        evidence: [rejectedEvidence],
        grounding: rejected,
      });
      const supportedObservation = EntityObservation.make({
        id: supportedObservationId,
        provenance: supportedArtifact,
        activity,
        source,
        evidence: [supportedEvidence],
        grounding: supported,
      });
      const entityId = EntityId.make("ada_lovelace");
      const entityType = IRI.make("https://schema.org/Person");
      const merged = mergeGraphs(
        KnowledgeGraph.make({
          entities: [
            Entity.make({
              id: entityId,
              mention: "Ada Lovelace",
              types: [entityType],
              grounding: rejected,
              observations: [rejectedObservation],
            }),
          ],
          provenance: makeExtractionProvenanceBundle(activity, source, [rejectedArtifact]),
          entityObservations: [rejectedObservation],
        }),
        KnowledgeGraph.make({
          entities: [
            Entity.make({
              id: entityId,
              mention: "Ada Lovelace",
              types: [entityType],
              grounding: supported,
              observations: [supportedObservation],
            }),
          ],
          provenance: makeExtractionProvenanceBundle(activity, source, [supportedArtifact]),
          entityObservations: [supportedObservation],
        })
      );

      expect(merged.entities[0]?.grounding.status).toBe("Supported");
      expect(merged.entities[0]?.observations).toHaveLength(2);
      expect(merged.entityObservations).toHaveLength(2);
      expect(merged.provenance.records).toHaveLength(4);
    })
  );

  it.effect(
    "derives claims from the supported observation and aggregate grounding confidence",
    Effect.fnUntraced(function* () {
      const activity = yield* S.decodeEffect(ObjectRef)("urn:beep:test:activity:claim");
      const source = yield* S.decodeEffect(ObjectRef)("urn:beep:test:source:claim");
      const artifact = yield* S.decodeEffect(ObjectRef)("urn:beep:test:artifact:claim");
      const observationId = yield* S.decodeEffect(ObjectRef)("urn:beep:test:observation:claim");
      const evidence = yield* S.decodeEffect(EvidenceSpan)({
        text: "Lovelace",
        startChar: 4,
        endChar: 12,
      });
      const supported = GroundingDecision.cases.Supported.make({ confidence: Confidence.make(0.92) });
      const entity = Entity.make({
        id: EntityId.make("ada_lovelace"),
        mention: "Ada Lovelace",
        types: [IRI.make("https://schema.org/Person")],
        grounding: supported,
        observations: [
          EntityObservation.make({
            id: observationId,
            provenance: artifact,
            activity,
            source,
            evidence: [evidence],
            grounding: supported,
          }),
        ],
      });
      const claims = entityToClaims(entity, {
        baseNamespace: "https://example.org/entity/",
        documentId: "document-1",
        ontologyId: "ontology-1",
      });

      expect(claims[0]?.confidence).toBe(0.92);
      expect(claims[0]?.evidence).toEqual({ text: "Lovelace", startOffset: 4, endOffset: 12 });
    })
  );
});

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI } from "@beep/rdf/Iri";
import { ObjectRef } from "@beep/rdf/Prov";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
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
import { ClaimId } from "../../Domain/Schema/KnowledgeModel.ts";
import {
  ClaimData,
  ClaimExtractionArtifact,
  claimExtractionArtifactFromQuads,
  claimExtractionArtifactToQuads,
  entityToClaims,
} from "../../Utils/ClaimFactory.ts";
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

  it.effect(
    "roundtrips exact claims and rejected grounding observations through the durable RDF artifact",
    Effect.fnUntraced(function* () {
      const activity = yield* S.decodeEffect(ObjectRef)("urn:beep:test:activity:durable");
      const source = yield* S.decodeEffect(ObjectRef)("urn:beep:test:source:durable");
      const provenance = yield* S.decodeEffect(ObjectRef)("urn:beep:test:artifact:durable");
      const id = yield* S.decodeEffect(ObjectRef)("urn:beep:test:observation:durable");
      const evidence = yield* S.decodeEffect(EvidenceSpan)({ text: "Ada", startChar: 4, endChar: 7 });
      const observation = EntityObservation.make({
        id,
        provenance,
        activity,
        source,
        evidence: [evidence],
        grounding: GroundingDecision.cases.Rejected.make({ confidence: Confidence.make(0.91) }),
      });
      const artifact = ClaimExtractionArtifact.make({
        claims: [
          ClaimData.make({
            claimId: ClaimId.make("claim-abc123def456"),
            subjectIri: "https://example.test/entity/ada",
            predicateIri: "https://schema.org/name",
            objectValue: "Ada",
            objectType: "literal",
            articleId: "document-1",
            ontologyId: "ontology-1",
            confidence: Confidence.make(0.92),
            evidence: {
              text: "Ada",
              startOffset: NonNegativeInt.make(4),
              endOffset: NonNegativeInt.make(7),
            },
          }),
        ],
        entityObservations: [observation],
        relationObservations: [],
      });

      const quads = yield* claimExtractionArtifactToQuads(artifact, "urn:beep:test:graph:durable");
      const decoded = yield* claimExtractionArtifactFromQuads(quads);

      expect(O.isSome(decoded)).toBe(true);
      expect(O.exists(decoded, (value) => Equal.equals(value, artifact))).toBe(true);
      expect(O.map(decoded, (value) => value.claims[0]?.evidence).pipe(O.getOrNull)).toEqual({
        text: "Ada",
        startOffset: 4,
        endOffset: 7,
      });
      expect(O.map(decoded, (value) => value.entityObservations[0]?.grounding.status).pipe(O.getOrNull)).toBe(
        "Rejected"
      );
    })
  );

  it("merges associatively and deterministically across completion permutations", () => {
    const entityId = EntityId.make("merge_subject");
    const graph = (mention: string, types: A.NonEmptyReadonlyArray<string>, attribute: string) =>
      KnowledgeGraph.make({
        entities: [
          Entity.make({
            id: entityId,
            mention,
            types: A.map(types, (type) => IRI.make(type)),
            attributes: { "https://example.test/value": attribute },
          }),
        ],
      });
    const first = graph("Alpha", ["urn:type:A", "urn:type:B"], "zeta");
    const second = graph("Beta", ["urn:type:B", "urn:type:C"], "alpha");
    const third = graph("Gamma", ["urn:type:C"], "middle");
    const leftAssociated = mergeGraphs(mergeGraphs(first, second), third);
    const rightAssociated = mergeGraphs(first, mergeGraphs(second, third));
    const permutations = [
      [first, second, third],
      [first, third, second],
      [second, first, third],
      [second, third, first],
      [third, first, second],
      [third, second, first],
    ];

    expect(Equal.equals(leftAssociated, rightAssociated)).toBe(true);
    expect(
      A.every(permutations, (values) =>
        Equal.equals(A.reduce(values, KnowledgeGraph.make({}), mergeGraphs), leftAssociated)
      )
    ).toBe(true);
  });
});

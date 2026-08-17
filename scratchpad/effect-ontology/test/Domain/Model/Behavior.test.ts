import { IRI } from "@beep/rdf/Iri";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  BatchId,
  ContentHash,
  DocumentId,
  GcsUri,
  Namespace,
  OntologyName,
  OntologyVersion,
} from "../../../Domain/Identity.ts";
import { BatchIdentity, BatchState } from "../../../Domain/Model/BatchWorkflow.ts";
import {
  EventId,
  EventInterval,
  EventTime,
  MentionEvidence,
  TrackedEvent,
} from "../../../Domain/Model/CoreOntology.ts";
import { Entity, EvidenceSpan, Relation, RelationObject } from "../../../Domain/Model/Entity.ts";
import { ExtractionRun } from "../../../Domain/Model/ExtractionRun.ts";
import { OntologyContext, PropertyDefinition } from "../../../Domain/Model/Ontology.ts";
import {
  EnhancedValidationReport,
  ExtractWithClaimsOptions,
  OntologyAgentConfig,
  ViolationsByLevel,
} from "../../../Domain/Model/OntologyAgent.ts";
import { OntologyEmbeddings } from "../../../Domain/Model/OntologyEmbeddings.ts";
import { EntityId } from "../../../Domain/Model/shared.ts";

const now = DateTime.makeUnsafe("2026-07-25T12:00:00.000Z");

describe("effect-ontology model behavior", () => {
  it("rejects reversed provenance and event intervals with informative checks", () => {
    const span = S.decodeResult(EvidenceSpan)({
      text: "Seattle",
      startChar: 10,
      endChar: 3,
    });
    const interval = S.decodeResult(EventInterval)({
      start: "2026-07-25T12:00:01.000Z",
      end: "2026-07-25T12:00:00.000Z",
    });

    expect(Result.isFailure(span)).toBe(true);
    expect(Result.isFailure(interval)).toBe(true);
  });

  it.effect("decodes legacy evidence into canonical quote fields and rejects width mismatches", () =>
    Effect.gen(function* () {
      const span = yield* S.decodeEffect(EvidenceSpan)({
        text: "Seattle",
        startChar: 10,
        endChar: 17,
        confidence: 0.9,
      });
      const mismatched = S.decodeResult(EvidenceSpan)({
        text: "Seattle",
        startChar: 10,
        endChar: 18,
      });
      const legacy = yield* S.encodeEffect(EvidenceSpan)(span);

      expect(span.quote).toBe("Seattle");
      expect(span.confidence).toEqual(O.some(0.9));
      expect(legacy).toEqual({
        text: "Seattle",
        startChar: 10,
        endChar: 17,
        confidence: 0.9,
      });
      expect(Result.isFailure(mismatched)).toBe(true);
    })
  );

  it.effect("decodes legacy mention evidence to the canonical text-anchor shape", () =>
    Effect.gen(function* () {
      const evidence = yield* S.decodeEffect(MentionEvidence)({
        text: "Seattle",
        startOffset: 10,
        endOffset: 17,
      });
      const encoded = yield* S.encodeEffect(MentionEvidence)(evidence);

      expect(evidence.quote).toBe("Seattle");
      expect(evidence.startChar).toBe(10);
      expect(evidence.endChar).toBe(17);
      expect(encoded).toEqual({
        text: "Seattle",
        startOffset: 10,
        endOffset: 17,
      });
    })
  );

  it("keeps relation references distinct from literal strings", () => {
    const subject = Entity.make({
      id: EntityId.make("alice"),
      mention: "Alice",
      types: [IRI.make("https://schema.org/Person")],
    });
    const relation = Relation.make({
      subjectId: subject.id,
      predicate: IRI.make("https://schema.org/knows"),
      object: RelationObject.cases.Text.make({ value: "bob" }),
    });

    expect(relation.isEntityReference).toBe(false);
    expect(relation.object._tag).toBe("Text");
  });

  it("enforces batch transitions and derives progress from stage payloads", () => {
    const batch = BatchIdentity.make({
      batchId: BatchId.make("batch-deadbeefcafe"),
      ontologyId: "football",
      manifestUri: GcsUri.fromUnknown("gs://beep-ontology/manifest.json"),
      ontologyVersion: OntologyVersion.fromParts(
        Namespace.make("football"),
        OntologyName.make("premier_league"),
        ContentHash.make("a".repeat(64))
      ),
      createdAt: now,
      updatedAt: now,
    });
    const pending = BatchState.cases.Pending.make({
      batchId: batch.batchId,
      ontologyId: batch.ontologyId,
      manifestUri: batch.manifestUri,
      ontologyVersion: batch.ontologyVersion,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      documentCount: NonNegativeInt.make(0),
    });

    expect(BatchState.isValidTransition("Pending", "Preprocessing")).toBe(true);
    expect(BatchState.isValidTransition("Pending", "Validating")).toBe(false);
    expect(BatchState.progressPercent(pending)).toEqual(O.some(0));
  });

  it("builds stable run-scoped chunk identifiers without a free helper", () => {
    const chunkId = ExtractionRun.chunkId(DocumentId.make("doc-deadbeefcafe"), NonNegativeInt.make(2));

    expect(chunkId).toBe("doc-deadbeefcafe-chunk-2");
  });

  it("traverses cyclic class hierarchies without recursion failure", () => {
    const parent = IRI.make("https://example.org/Parent");
    const child = IRI.make("https://example.org/Child");
    const propertyInput = {
      id: IRI.make("https://example.org/name"),
      label: "name",
      domain: [parent],
      range: [IRI.make("http://www.w3.org/2001/XMLSchema#string")],
      rangeType: "datatype",
    };
    const property = PropertyDefinition.fromUnknown(propertyInput);
    const context = OntologyContext.fromUnknown({
      classes: [
        { id: parent, label: "Parent" },
        { id: child, label: "Child" },
      ],
      properties: [propertyInput],
      hierarchy: {
        [child]: [parent],
        [parent]: [child],
      },
    });

    expect(context.isSubClassOf(child, parent)).toBe(true);
    expect(context.getAllSuperClasses(child)).toEqual([parent, child]);
    expect(context.getPropertiesForClass(child)).toEqual([property]);
  });

  it("normalizes obvious agent and extraction defaults at schema construction", () => {
    const config = OntologyAgentConfig.default();
    const options = ExtractWithClaimsOptions.fromUnknown({
      ontologyId: "seattle",
      articleId: "article-001",
    });

    expect(config.concurrency).toBe(4);
    expect(config.chunking.preserveSentences).toBe(true);
    expect(options.autoCreateAssertions).toBe(false);
    expect(options.defaultConfidence).toBe(0.8);
    expect(O.isNone(options.targetNamespace)).toBe(true);
  });

  it("derives enhanced validation counts instead of storing stale duplicates", () => {
    const grouped = ViolationsByLevel.fromUnknown({
      violations: ["Expected one name."],
      warnings: ["A preferred label is recommended."],
    });
    const report = EnhancedValidationReport.fromUnknown({
      conforms: false,
      byLevel: grouped,
      duration: 4,
      dataGraphTripleCount: 10,
      shapesCount: 2,
    });

    expect(report.violationCount).toBe(2);
    expect(report.isValid).toBe(false);
  });

  it("rejects ontology embedding artifacts with inconsistent dimensions", () => {
    const artifact = S.decodeResult(OntologyEmbeddings)({
      ontologyUri: "gs://beep-ontology/ontology.ttl",
      version: "a".repeat(64),
      model: "text-embedding-3-small",
      dimension: 2,
      createdAt: "2026-07-25T12:00:00.000Z",
      classes: [
        {
          iri: "https://schema.org/Person",
          text: "Person",
          embedding: [0.5],
        },
      ],
    });

    expect(Result.isFailure(artifact)).toBe(true);
  });

  it("derives temporal grounding from the tagged event-time value", () => {
    const event = TrackedEvent.make({
      id: EventId.make("event-deadbeefcafe"),
      iri: IRI.make("https://example.org/event/announcement"),
      types: [IRI.make("https://schema.org/Event")],
      time: EventTime.cases.Instant.make({ value: now }),
    });
    const unspecified = TrackedEvent.make({
      id: EventId.make("event-feedfacecafe"),
      iri: IRI.make("https://example.org/event/unknown"),
      types: [IRI.make("https://schema.org/Event")],
    });

    expect(event.hasTemporalGrounding).toBe(true);
    expect(unspecified.hasTemporalGrounding).toBe(false);
  });
});

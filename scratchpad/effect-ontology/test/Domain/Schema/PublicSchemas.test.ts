import { HttpUrl as CanonicalHttpUrl } from "@beep/ontology/Ontology.models";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as Api from "../../../Domain/Schema/Api.ts";
import * as Auth from "../../../Domain/Schema/Auth.ts";
import * as Batch from "../../../Domain/Schema/Batch.ts";
import * as BatchRequest from "../../../Domain/Schema/BatchRequest.ts";
import * as BatchStatusResponse from "../../../Domain/Schema/BatchStatusResponse.ts";
import * as CurationAction from "../../../Domain/Schema/CurationAction.ts";
import * as DocumentMetadata from "../../../Domain/Schema/DocumentMetadata.ts";
import * as Inference from "../../../Domain/Schema/Inference.ts";
import * as JobSchema from "../../../Domain/Schema/JobSchema.ts";
import * as KnowledgeModel from "../../../Domain/Schema/KnowledgeModel.ts";
import * as LinkIngestion from "../../../Domain/Schema/LinkIngestion.ts";
import * as OntologyBrowser from "../../../Domain/Schema/OntologyBrowser.ts";
import * as OntologyRegistry from "../../../Domain/Schema/OntologyRegistry.ts";
import * as Search from "../../../Domain/Schema/Search.ts";
import * as Shacl from "../../../Domain/Schema/Shacl.ts";
import * as Timeline from "../../../Domain/Schema/Timeline.ts";

const schemaModules = [
  ["Api", Api],
  ["Auth", Auth],
  ["Batch", Batch],
  ["BatchRequest", BatchRequest],
  ["BatchStatusResponse", BatchStatusResponse],
  ["CurationAction", CurationAction],
  ["DocumentMetadata", DocumentMetadata],
  ["Inference", Inference],
  ["JobSchema", JobSchema],
  ["KnowledgeModel", KnowledgeModel],
  ["LinkIngestion", LinkIngestion],
  ["OntologyBrowser", OntologyBrowser],
  ["OntologyRegistry", OntologyRegistry],
  ["Search", Search],
  ["Shacl", Shacl],
  ["Timeline", Timeline],
];

const publicSchemas = A.flatMap(schemaModules, ([moduleName, moduleExports]) =>
  A.filterMap(Object.entries(moduleExports), ([exportName, value]) =>
    /^[A-Z]/.test(exportName) && S.isSchema(value)
      ? Result.succeed({
          name: `${moduleName}.${exportName}`,
          schema: value,
        })
      : Result.failVoid
  )
);

describe("effect-ontology public schema surface", () => {
  it("uses the canonical ontology HTTP URL schema at link-ingestion boundaries", () => {
    expect(LinkIngestion.HttpUrl).toBe(CanonicalHttpUrl);
  });

  it("derives arbitraries whose samples satisfy every exported schema", () => {
    expect(publicSchemas.length).toBeGreaterThan(50);

    for (const { name, schema } of publicSchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value), name).toBe(true);
        }),
        { numRuns: 8 }
      );
    }
  });

  it("normalizes omitted batch options and requires a non-empty document set", () => {
    const request = S.decodeResult(BatchRequest.BatchRequest)({
      ontologyId: "premier-league",
      ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
      ontologyVersion: `football/premier-league@${"a".repeat(64)}`,
      targetNamespace: "football",
      documents: [
        {
          sourceUri: "gs://beep-input/documents/report.pdf",
          contentType: "application/pdf",
        },
      ],
    });
    const empty = S.decodeUnknownResult(BatchRequest.BatchRequest)({
      ontologyId: "premier-league",
      ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
      ontologyVersion: `football/premier-league@${"a".repeat(64)}`,
      targetNamespace: "football",
      documents: [],
    });

    expect(Result.isSuccess(request)).toBe(true);
    if (Result.isSuccess(request)) {
      expect(request.success.preprocessing.enabled).toBe(true);
      expect(request.success.preprocessing.classificationBatchSize).toBe(10);
      expect(O.isNone(request.success.batchId)).toBe(true);
    }
    expect(Result.isFailure(empty)).toBe(true);
  });

  it.effect(
    "represents extraction input and terminal output with discriminated variants",
    Effect.fnUntraced(function* () {
      const source = yield* S.decodeEffect(Api.SubmitJobSource)({
        _tag: "Remote",
        value: { url: "https://example.com/report.pdf" },
      });
      const missingSource = S.decodeUnknownResult(Api.SubmitJobRequest)({});
      const notFound = yield* S.decodeEffect(BatchStatusResponse.BatchStatusResponse)({
        _tag: "NotFound",
        value: { batchId: "batch-abc123def456" },
      });

      expect(source._tag).toBe("Remote");
      expect(Result.isFailure(missingSource)).toBe(true);
      expect(notFound).toEqual({
        _tag: "NotFound",
        value: { batchId: "batch-abc123def456" },
      });
    })
  );

  it("keeps classification-derived chunking behavior colocated with its literal schema", () => {
    expect(
      DocumentMetadata.ChunkingStrategy.recommend("transcript", "moderate", DocumentMetadata.ComplexityScore.make(0.5))
    ).toBe("speaker_aware");
    expect(
      DocumentMetadata.ChunkingStrategy.recommend("report", "dense", DocumentMetadata.ComplexityScore.make(0.5))
    ).toBe("fine_grained");
    expect(DocumentMetadata.ChunkingStrategy.parameters("standard").preserveSentences).toBe(true);
  });
});

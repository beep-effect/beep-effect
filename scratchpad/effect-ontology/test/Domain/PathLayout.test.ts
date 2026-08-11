import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { BatchId, ContentHash, DocumentId, Namespace, OntologyName } from "../../Domain/Identity.ts";
import {
  BatchCanonicalPath,
  BatchEnrichedManifestPath,
  BatchFinalOutputPath,
  BatchInferencePath,
  BatchIngestManifestPath,
  BatchManifestPath,
  BatchResolutionPath,
  BatchStatusPath,
  BatchValidationGraphPath,
  BatchValidationReportPath,
  CanonicalNamespacePath,
  DocumentGraphPath,
  DocumentInputPath,
  DocumentMetadataPath,
  ImageLabelsPath,
  ImageManifestPath,
  ImageMetadataPath,
  ImageOriginalPath,
  ImageOwnerBasePath,
  ImageOwnerType,
  ImageVariantPath,
  ImageVariantSize,
  OntologyFilePath,
  OntologyManifestPath,
  PathLayout,
  RunChunkPath,
  RunInputPath,
  RunMetadataPath,
  RunOutputPath,
  StoragePathSegment,
} from "../../Domain/PathLayout.ts";

const storagePathSchemas: ReadonlyArray<S.Constraint> = [
  StoragePathSegment,
  OntologyFilePath,
  OntologyManifestPath,
  BatchStatusPath,
  BatchManifestPath,
  BatchResolutionPath,
  BatchValidationGraphPath,
  BatchValidationReportPath,
  BatchCanonicalPath,
  BatchEnrichedManifestPath,
  BatchIngestManifestPath,
  BatchFinalOutputPath,
  BatchInferencePath,
  DocumentMetadataPath,
  DocumentInputPath,
  DocumentGraphPath,
  RunMetadataPath,
  RunInputPath,
  RunChunkPath,
  RunOutputPath,
  ImageVariantSize,
  ImageOwnerType,
  ImageOriginalPath,
  ImageMetadataPath,
  ImageLabelsPath,
  ImageVariantPath,
  ImageOwnerBasePath,
  ImageManifestPath,
  CanonicalNamespacePath,
];

const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const documentId = DocumentId.make("doc-deadbeefcafe");
const batchId = BatchId.make("batch-deadbeefcafe");
const namespace = Namespace.make("legal");

describe("effect-ontology storage path layout", () => {
  it("derives warning-free arbitraries whose values satisfy every public path schema", () => {
    for (const schema of storagePathSchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 16 }
      );
    }
  });

  it("constructs exact ontology, batch, document, and run paths", () => {
    expect(PathLayout.ontology.encode(namespace, OntologyName.make("patents"), hash)).toBe(
      `ontologies/legal/patents/${hash}/ontology.ttl`
    );
    expect(PathLayout.batch.status(batchId)).toBe("batches/batch-deadbeefcafe/status.json");
    expect(PathLayout.document.graph(documentId)).toBe("documents/doc-deadbeefcafe/extraction/graph.ttl");
    expect(PathLayout.run.output(documentId, "rdf-jsonld")).toBe("runs/doc-deadbeefcafe/outputs/graph.jsonld");
  });

  it("parses structured paths through total Result-returning schema statics", () => {
    const ontologyPath = OntologyFilePath.fromParts(namespace, OntologyName.make("patents"), hash);
    const chunkPath = RunChunkPath.fromParts(documentId, NonNegativeInt.make(2));

    expect(Result.getOrThrow(OntologyFilePath.parts(ontologyPath))).toEqual([namespace, "patents", hash]);
    expect(Result.getOrThrow(RunChunkPath.parts(chunkPath))).toEqual([documentId, 2]);
  });

  it("rejects traversal, non-canonical indices, and unregistered outputs", () => {
    expect(StoragePathSegment.is("../escape")).toBe(false);
    expect(Result.isFailure(S.decodeResult(RunChunkPath)("runs/doc-deadbeefcafe/input/chunks/chunk-01.txt"))).toBe(
      true
    );
    expect(
      Result.isFailure(S.decodeUnknownResult(RunOutputPath)("runs/doc-deadbeefcafe/outputs/custom-output.json"))
    ).toBe(true);
  });

  it("constructs image paths only from validated hash, owner, and variant values", () => {
    const ownerId = StoragePathSegment.make("article-42");

    expect(PathLayout.image.original(hash)).toBe(`assets/images/${hash}/original`);
    expect(PathLayout.image.variant(hash, "thumb")).toBe(`assets/images/${hash}/variants/thumb.jpg`);
    expect(PathLayout.image.ownerBase("link", ownerId)).toBe("assets/owners/link/article-42/images");
    expect(PathLayout.image.manifest("link", ownerId)).toBe("assets/owners/link/article-42/images/manifest.json");
  });
});

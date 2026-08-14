import { HttpsUrl } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  BatchId,
  ChunkId,
  ContentHash,
  DocumentId,
  ExtractionRunId,
  GcsBucket,
  GcsObject,
  GcsUri,
  IdempotencyKey,
  LegacyContentHashPrefix,
  Namespace,
  OntologyName,
  OntologyVersion,
  SecureHttpUrl,
} from "../../Domain/Identity.ts";

const emptySha256 = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const identitySchemas: ReadonlyArray<S.Constraint> = [
  LegacyContentHashPrefix,
  ContentHash,
  IdempotencyKey,
  SecureHttpUrl,
  GcsBucket,
  GcsObject,
  GcsUri,
  Namespace,
  OntologyName,
  OntologyVersion,
  DocumentId,
  ChunkId,
  ExtractionRunId,
  BatchId,
];

describe("effect-ontology identity schemas", () => {
  it("derives arbitraries whose values satisfy every public identity schema", () => {
    for (const schema of identitySchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("keeps full content identity distinct from its explicit legacy prefix", () => {
    expect(ContentHash.prefix(emptySha256)).toBe("e3b0c44298fc1c14");
    expect(ContentHash.is(emptySha256)).toBe(true);
    expect(ContentHash.is("e3b0c44298fc1c14")).toBe(false);
    expect(LegacyContentHashPrefix.is("e3b0c44298fc1c14")).toBe(true);
  });

  it("derives compact storage identifiers through schema-owned statics", () => {
    const documentId = DocumentId.fromContentHash(emptySha256);

    expect(documentId).toBe("doc-e3b0c44298fc");
    expect(ChunkId.fromDocument(documentId, 0)).toBe("doc-e3b0c44298fc-chunk-0");
    expect(BatchId.fromContentHash(emptySha256)).toBe("batch-e3b0c44298fc");
  });

  it("constructs and resolves canonical GCS URIs without duplicating existing URIs", () => {
    const bucket = GcsBucket.fromUnknown("beep-ontology-state");
    const objectPath = GcsObject.fromUnknown("snapshots/ontology-v1.ttl");
    const uri = GcsUri.fromParts(bucket, objectPath);

    expect(uri).toBe("gs://beep-ontology-state/snapshots/ontology-v1.ttl");
    expect(GcsUri.resolve(objectPath, bucket)).toBe(uri);
    expect(GcsUri.resolve(uri, bucket)).toBe(uri);
  });

  it("rejects insecure, ambiguous, reserved, and non-canonical locations", () => {
    expect(SecureHttpUrl).toBe(HttpsUrl);
    expect(SecureHttpUrl.is("https://example.org/report.pdf")).toBe(true);
    expect(SecureHttpUrl.is("http://example.org/report.pdf")).toBe(false);
    expect(Result.isFailure(S.decodeResult(GcsBucket)("192.168.5.4"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsBucket)("goog-ontology-state"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsObject)("/snapshots/data.ttl"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsObject)("snapshots//data.ttl"))).toBe(true);
  });
});

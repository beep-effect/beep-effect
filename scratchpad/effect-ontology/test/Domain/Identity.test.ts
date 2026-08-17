import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
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
} from "../../Domain/Identity.ts";
import { IdempotencyKey as UtilityIdempotencyKey } from "../../Utils/IdempotencyKey.ts";

const emptySha256 = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const identitySchemas: ReadonlyArray<S.Constraint> = [
  LegacyContentHashPrefix,
  ContentHash,
  IdempotencyKey,
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
  it("keeps idempotency-key utilities on the domain-owned schema", () => {
    expect(UtilityIdempotencyKey).toBe(IdempotencyKey);
  });

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

  it.effect("constructs and resolves canonical GCS URIs without duplicating existing URIs", Effect.fnUntraced(function* () {
      const bucket = yield* S.decodeEffect(GcsBucket)("beep-ontology-state");
      const objectPath = yield* S.decodeEffect(GcsObject)("snapshots/ontology-v1.ttl");
      const uri = GcsUri.fromParts(bucket, objectPath);

      expect(uri).toBe("gs://beep-ontology-state/snapshots/ontology-v1.ttl");
      expect(GcsUri.resolve(objectPath, bucket)).toBe(uri);
      expect(GcsUri.resolve(uri, bucket)).toBe(uri);
    })
  );

  it("rejects insecure, ambiguous, reserved, and non-canonical locations", () => {
    expect(Result.isFailure(S.decodeResult(GcsBucket)("192.168.5.4"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsBucket)("goog-ontology-state"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsObject)("/snapshots/data.ttl"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(GcsObject)("snapshots//data.ttl"))).toBe(true);
  });
});

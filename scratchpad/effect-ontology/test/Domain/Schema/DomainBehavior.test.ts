import { MimeType, NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ContentHash, DocumentId, GcsUri } from "../../../Domain/Identity.ts";
import {
  ChunkingParams,
  ComplexityScore,
  DocumentMetadata,
  EntityDensity,
  PreprocessingOptions,
} from "../../../Domain/Schema/DocumentMetadata.ts";
import { BackgroundJobId, JobMetadataSchema } from "../../../Domain/Schema/JobSchema.ts";
import { AssertionId, ClaimId, DerivedAssertionId, TextSpan } from "../../../Domain/Schema/KnowledgeModel.ts";

const contentHash = ContentHash.make("a".repeat(64));

describe("effect-ontology schema-owned domain behavior", () => {
  it("enforces adaptive chunking and preprocessing bounds at decode time", () => {
    const valid = S.decodeResult(ChunkingParams)({
      chunkSize: 500,
      overlapSentences: 2,
    });
    const invalidSize = S.decodeResult(ChunkingParams)({
      chunkSize: 0,
      overlapSentences: 2,
    });
    const invalidOverlap = S.decodeResult(ChunkingParams)({
      chunkSize: 500,
      overlapSentences: 11,
    });
    const invalidBatchSize = S.decodeResult(PreprocessingOptions)({
      classificationBatchSize: 51,
    });

    expect(Result.isSuccess(valid)).toBe(true);
    expect(Result.isFailure(invalidSize)).toBe(true);
    expect(Result.isFailure(invalidOverlap)).toBe(true);
    expect(Result.isFailure(invalidBatchSize)).toBe(true);
  });

  it.effect("applies complete preprocessing defaults and Option-normalizes overrides", () =>
    Effect.gen(function* () {
      const defaults = yield* S.decodeEffect(PreprocessingOptions)({});
      const override = yield* S.decodeEffect(PreprocessingOptions)({
        chunkingStrategyOverride: "section_aware",
      });

      expect(defaults.enabled).toBe(true);
      expect(defaults.classifyDocuments).toBe(true);
      expect(defaults.adaptiveChunking).toBe(true);
      expect(defaults.priorityOrdering).toBe(true);
      expect(defaults.classificationBatchSize).toBe(10);
      expect(O.isNone(defaults.chunkingStrategyOverride)).toBe(true);
      expect(override.chunkingStrategyOverride).toEqual(O.some("section_aware"));
    })
  );

  it("keeps token estimation and priority pure, deterministic, and schema-owned", () => {
    expect(DocumentMetadata.estimateTokens(NonNegativeInt.make(0))).toBe(0);
    expect(DocumentMetadata.estimateTokens(NonNegativeInt.make(1))).toBe(1);
    expect(DocumentMetadata.estimateTokens(NonNegativeInt.make(9))).toBe(3);

    const sparse = DocumentMetadata.computePriority(
      ComplexityScore.make(0.5),
      NonNegativeInt.make(500),
      EntityDensity.Enum.sparse
    );
    const dense = DocumentMetadata.computePriority(
      ComplexityScore.make(0.5),
      NonNegativeInt.make(500),
      EntityDensity.Enum.dense
    );

    expect(sparse).toBeLessThan(dense);
  });

  it.effect("constructs a complete conservative metadata fallback without nullish fields", () =>
    Effect.gen(function* () {
      const preprocessedAt = yield* S.decodeEffect(S.DateTimeUtcFromString)("2026-07-25T12:00:00.000Z");
      const sourceUri = yield* S.decodeEffect(GcsUri)("gs://beep-input/documents/report.txt");
      const metadata = DocumentMetadata.fallback({
        documentId: DocumentId.make("doc-abc123def456"),
        sourceUri,
        contentType: MimeType.make("text/plain"),
        sizeBytes: NonNegativeInt.make(4_000),
        preprocessedAt,
      });

      expect(metadata.documentType).toBe("unknown");
      expect(metadata.chunkingStrategy).toBe("standard");
      expect(metadata.estimatedTokens).toBe(1_000);
      expect(metadata.estimatedExtractionCost).toBe(2_000);
      expect(O.isNone(metadata.title)).toBe(true);
      expect(O.isNone(metadata.eventTime)).toBe(true);
      expect(O.isNone(metadata.publishedAt)).toBe(true);
    })
  );

  it("derives stable knowledge and job identifiers from the full content hash", () => {
    expect(ClaimId.fromContentHash(contentHash)).toBe("claim-aaaaaaaaaaaa");
    expect(AssertionId.fromContentHash(contentHash)).toBe("assertion-aaaaaaaaaaaa");
    expect(AssertionId.is("assertion-mssxstfx21i3v9")).toBe(false);
    expect(DerivedAssertionId.fromContentHash(contentHash)).toBe("derived-aaaaaaaaaaaa");
    expect(BackgroundJobId.fromContentHash(contentHash)).toBe("job-aaaaaaaaaaaa");
  });

  it.effect("applies retry defaults and normalizes width-checked evidence spans", () =>
    Effect.gen(function* () {
      const metadata = yield* S.decodeEffect(JobMetadataSchema)({
        id: BackgroundJobId.fromContentHash(contentHash),
      });
      const span = yield* S.decodeEffect(TextSpan)({
        start: 4,
        end: 9,
        text: "Alice",
      });
      const mismatched = S.decodeResult(TextSpan)({
        start: 4,
        end: 8,
        text: "Alice",
      });
      const encoded = yield* S.encodeEffect(TextSpan)(span);

      expect(metadata.attempts).toBe(0);
      expect(O.isNone(metadata.lastError)).toBe(true);
      expect(O.isNone(metadata.lastAttemptAt)).toBe(true);
      expect(span.quote).toBe("Alice");
      expect(span.startChar).toBe(4);
      expect(span.endChar).toBe(9);
      expect(encoded).toEqual({ start: 4, end: 9, text: "Alice" });
      expect(Result.isFailure(mismatched)).toBe(true);
    })
  );
});

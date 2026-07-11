import { DocumentContentDigest, FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy";
import {
  DocumentIntakeLayer,
  FilingDecisionHeuristicLayer,
  FilingDecisionLlmConfig,
  FilingDecisionLlmConfigValue,
  FilingDecisionLlmLayer,
  FilingTextExtractionLiveLayer,
} from "@beep/documents-server/aggregates/Document";
import { Document } from "@beep/documents-use-cases/server";
import { FileProcessingService } from "@beep/file-processing/Service";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";

const testConfig = FilingDecisionLlmConfigValue.make({
  confidenceThreshold: UnitInterval.make(0.6),
  maxExcerptChars: 8000,
  model: "fixture-model",
});

const TestConfigLayer = Layer.succeed(FilingDecisionLlmConfig, testConfig);
const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const makeLanguageModelLayer = (response: Effect.Effect<string>): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        response.pipe(
          Effect.map((text) => [
            Response.makePart("text", { text }),
            Response.makePart("finish", { reason: "stop", response: undefined, usage: TestUsage }),
          ])
        ),
      streamText: () => Stream.empty,
    })
  );

const makeDecisionLayer = (response: Effect.Effect<string>) =>
  FilingDecisionLlmLayer.pipe(Layer.provide(Layer.merge(TestConfigLayer, makeLanguageModelLayer(response))));

const filingInput = Document.FilingDecisionInput.make({
  contentDigest: DocumentContentDigest.make("abc123"),
  originalFileName: "ambiguous-document.pdf",
  textExcerpt: O.some("A complaint alleging breach of contract."),
});

const decideWith = (response: Effect.Effect<string>) =>
  Effect.gen(function* () {
    const filingDecision = yield* Document.FilingDecision;
    return yield* filingDecision.decide(filingInput);
  }).pipe(provideScopedLayer(makeDecisionLayer(response)));

describe("@beep/documents-server FilingDecisionLlm", () => {
  it.effect("files a taxonomy-valid high-confidence proposal", () =>
    Effect.gen(function* () {
      const outcome = yield* decideWith(
        Effect.succeed(
          '{"confidence":0.91,"rationale":"The excerpt describes a complaint.","taxonomyConceptId":"pleadings"}'
        )
      );

      expect(outcome).toMatchObject({
        confidence: 0.91,
        kind: "filed",
        taxonomyConceptId: "pleadings",
      });
    })
  );

  it.effect("routes a below-threshold proposal to the inbox", () =>
    Effect.gen(function* () {
      const outcome = yield* decideWith(
        Effect.succeed('{"confidence":0.42,"rationale":"The evidence is ambiguous.","taxonomyConceptId":"pleadings"}')
      );

      expect(outcome).toMatchObject({
        kind: "inboxed",
        rationale: "The evidence is ambiguous.",
        reason: "low-confidence",
      });
    })
  );

  it.effect("routes an unknown concept id to the inbox without inventing a folder", () =>
    Effect.gen(function* () {
      const outcome = yield* decideWith(
        Effect.succeed(
          '{"confidence":0.99,"rationale":"The model proposed an unknown class.","taxonomyConceptId":"invented-folder"}'
        )
      );

      expect(outcome).toMatchObject({
        kind: "inboxed",
        rationale: "The model proposed an unknown class.",
        reason: "no-match",
      });
    })
  );

  it.effect("routes provider failure to the inbox without failing the port", () =>
    Effect.gen(function* () {
      const outcome = yield* decideWith(Effect.die("fixture provider unavailable"));

      expect(outcome).toMatchObject({ kind: "inboxed", reason: "llm-unavailable" });
    })
  );
});

const FailingFileProcessingLayer = Layer.succeed(
  FileProcessingService,
  FileProcessingService.of({
    detect: Effect.fn("FailingFileProcessing.detect")(function* () {
      return yield* Effect.die("fixture extraction unavailable");
    }),
    exportArchive: Effect.fn("FailingFileProcessing.exportArchive")(function* () {
      return yield* Effect.die("fixture extraction unavailable");
    }),
    extract: Effect.fn("FailingFileProcessing.extract")(function* () {
      return yield* Effect.die("fixture extraction unavailable");
    }),
    process: Effect.fn("FailingFileProcessing.process")(function* () {
      return yield* Effect.die("fixture extraction unavailable");
    }),
  })
);

const FailingExtractionLayer = FilingTextExtractionLiveLayer.pipe(
  Layer.provide(Layer.merge(TestConfigLayer, FailingFileProcessingLayer))
);

const IntakeWithFailingExtractionLayer = DocumentIntakeLayer.pipe(
  Layer.provide(Layer.merge(FilingDecisionHeuristicLayer, FailingExtractionLayer)),
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

describe("@beep/documents-server FilingTextExtraction", () => {
  it.effect("materializes the heuristic filing when the optional extraction engine fails", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-documents-extraction-fail-" });
      const input = yield* S.decodeUnknownEffect(Document.IntakeDroppedFileInput)({
        content: Buffer.from("complaint body").toString("base64"),
        filingContext: DefaultVaultFilingContext,
        intakeBatchId: "batch-extraction-fail",
        originalFileName: "Complaint.pdf",
        vaultRootPath,
        workspaceId: 1,
      });

      const document = yield* intake.intakeDroppedFile(input);

      expect(FilingOutcome.guards.filed(document.filing)).toBe(true);
      expect(document.vaultPath.relativePath).toContain("01-pleadings");
    }).pipe(provideScopedLayer(IntakeWithFailingExtractionLayer))
  );
});

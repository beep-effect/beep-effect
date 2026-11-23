import { makeClaimGate } from "@beep/epistemic-use-cases/ClaimGate";
import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import {
  ArchiveExportProcessFileResult,
  ArchiveExportResult,
  ExtractedProcessFileResult,
  ExtractionResult,
  ProcessFileResult,
  SkippedProcessFileResult,
} from "@beep/file-processing/Extraction";
import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { decodeExtractionHandoff, encodeExtractionHandoff } from "@beep/langextract/Handoff";
import { allowRemoteExtractionPolicyLayer, LangExtractService, layer } from "@beep/langextract/Service";
import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { makeOfficeActionReview, OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import { PosixPath } from "@beep/schema/PosixPath";
import { ShaclValidationResult, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Response from "effect/ai/Response";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  missingOutput,
  modelOutput,
  overCapOutput,
  text,
  unalignedOutput,
} from "./fixtures/office-action-review/fixture.ts";
import type { ExtractionHandoff } from "@beep/langextract/Handoff";

const usage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});
const makeLayer = (output: string) => {
  const model = Model.make(
    "test",
    "office-action-stub",
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: () =>
          Effect.succeed([
            Response.makePart("text", { text: output }),
            Response.makePart("finish", { reason: "stop", response: undefined, usage }),
          ]),
        streamText: () => Stream.empty,
      })
    )
  );
  const extraction = layer.pipe(Layer.provide(Layer.merge(model, allowRemoteExtractionPolicyLayer)));
  const files = makeFileProcessingServiceLayer([
    {
      ...TestFileProcessingEngine,
      extract: (operation) =>
        TestFileProcessingEngine.extract(operation).pipe(
          Effect.map((result) => ExtractionResult.make({ ...result, engineVersion: "1" }))
        ),
    },
  ]);
  return Layer.mergeAll(extraction, files).pipe(Layer.provideMerge(Digest.layerWebCrypto));
};
const fixtureInput = Effect.fn("OfficeActionFlow.fixtureInput")(function* () {
  const digest = yield* Digest.Digest;
  const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(text));
  return OfficeActionReviewInput.make({
    matterFixtureKey: "matter.flow",
    officeActionFixtureKey: "office-action.flow",
    operationId: OperationId.make(`operation:${hash}`),
    sourceArtifact: SourceArtifact.make({
      id: ArtifactId.make(`artifact:${hash}`),
      digest: ContentDigest.make(`sha256:${hash}`),
      extension: "txt",
      name: "office-action.txt",
      relativePath: PosixPath.make("fixtures/office-action-review.txt"),
      locator: ArtifactLocator.make({ kind: "synthetic", value: PosixPath.make("fixtures/office-action-review.txt") }),
      sizeBytes: S.Natural.make(text.length),
      text,
    }),
  });
});
const conformingShacl = ShaclValidationService.of({
  validate: Effect.fn("ShaclValidationService.validate")(() =>
    Effect.succeed(ShaclValidationResult.make({ conforms: true, violations: [], truncated: false }))
  ),
});
const scenario = Effect.fn("OfficeActionFlow.scenario")(function* () {
  const digest = yield* Digest.Digest;
  const fileProcessing = yield* FileProcessingService;
  const langExtract = yield* LangExtractService;
  let captured = O.none<ExtractionHandoff>();
  const irToLaw = makeIrToLaw();
  const review = makeOfficeActionReview({
    digest,
    fileProcessing,
    irToLaw,
    gate: makeClaimGate(conformingShacl),
    transition: makeClaimTransition(),
    langExtract: {
      extract: (request) =>
        langExtract.extract(request).pipe(
          Effect.tap((result) =>
            Effect.sync(() => {
              captured = O.some(result.handoff);
            })
          )
        ),
    },
  });
  const input = yield* fixtureInput();
  const view = yield* review.review(input);
  const handoff = O.getOrThrow(captured);
  const law = yield* irToLaw.toLaw(handoff);
  return { input, handoff, law, view };
});

const skipped = (processed: ProcessFileResult): ProcessFileResult =>
  SkippedProcessFileResult.make({
    engine: processed.engine,
    format: processed.format,
    operationId: processed.operationId,
    resultKind: "skipped",
    skipReason: "format-out-of-scope",
    sourceArtifactId: processed.sourceArtifactId,
    warnings: [],
  });
const archived = (processed: ProcessFileResult): ProcessFileResult =>
  ArchiveExportProcessFileResult.make({
    archiveExport: ArchiveExportResult.make({
      children: [],
      engine: processed.engine,
      operationId: processed.operationId,
      sourceArtifactId: processed.sourceArtifactId,
      warnings: [],
    }),
    engine: processed.engine,
    format: processed.format,
    operationId: processed.operationId,
    resultKind: "archive-exported",
    sourceArtifactId: processed.sourceArtifactId,
    warnings: [],
  });
const extractedWith =
  (fields: { readonly engineVersion?: string; readonly text?: string }) =>
  (processed: ProcessFileResult): ProcessFileResult =>
    ProcessFileResult.match(processed, {
      "archive-exported": (archive): ProcessFileResult => archive,
      extracted: (extracted) =>
        ExtractedProcessFileResult.make({
          ...extracted,
          extraction: ExtractionResult.make({
            engine: extracted.extraction.engine,
            format: extracted.extraction.format,
            metadata: extracted.extraction.metadata,
            operationId: extracted.extraction.operationId,
            sourceArtifactId: extracted.extraction.sourceArtifactId,
            warnings: extracted.extraction.warnings,
            ...fields,
          }),
        }),
      skipped: (skip): ProcessFileResult => skip,
    });
const refusedBy = Effect.fn("OfficeActionFlow.refusedBy")(function* (
  reshape: (processed: ProcessFileResult) => ProcessFileResult
) {
  const digest = yield* Digest.Digest;
  const fileProcessing = yield* FileProcessingService;
  const langExtract = yield* LangExtractService;
  const review = makeOfficeActionReview({
    digest,
    fileProcessing: { ...fileProcessing, process: flow(fileProcessing.process, Effect.map(reshape)) },
    irToLaw: makeIrToLaw(),
    gate: makeClaimGate(conformingShacl),
    transition: makeClaimTransition(),
    langExtract,
  });
  const input = yield* fixtureInput();
  return yield* review.review(input).pipe(Effect.flip);
});

describe("office-action annotation flow", () => {
  it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("real extraction service and pure mapping", (it) => {
    it.effect(
      "office-action flow runs the handoff into the review on an annotation document",
      Effect.fnUntraced(function* () {
        const result = yield* scenario();
        expect(result.view.counts.shape_valid).toBe(1);
        expect(R.keys(result.law)).toHaveLength(5);
      })
    );
    it.effect(
      "office-action flow anchors every target on the fixture capture",
      Effect.fnUntraced(function* () {
        const { handoff, input, law } = yield* scenario();
        const encoded = yield* encodeExtractionHandoff(handoff);
        const decoded = yield* decodeExtractionHandoff(encoded);
        expect(decoded).toEqual(handoff);
        expect(handoff.document.text.scopeRef).toBe(input.matterFixtureKey);
        expect(handoff.document.text.sourceRef).toBe(input.sourceArtifact.id);
        for (const anchored of HashMap.values(handoff.document.anchors))
          expect(anchored.receipt.source).toEqual(handoff.document.text);
        expect(Str.slice(law.distinction.anchor.startChar, law.distinction.anchor.endChar)(text)).toBe(
          law.distinction.anchor.quote
        );
      })
    );
    it.effect(
      "office-action flow keeps every candidate",
      Effect.fnUntraced(function* () {
        const { handoff } = yield* scenario();
        const indices = A.appendAll(
          handoff.readings.pipe(
            HashMap.toValues,
            A.flatten,
            A.map((reading) => reading.candidate)
          ),
          A.map(handoff.residual, (candidate) => candidate.candidate)
        );
        expect(A.sort(indices, Order.Number)).toEqual([0, 1, 2, 3]);
        expect(indices.length).toBe(handoff.candidateCount);
        expect(handoff.candidateCount).toBe(4);
      })
    );
  });

  it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("unusable extraction results", (it) => {
    it.effect(
      "office-action review refuses a skipped, archived, textless or unversioned extraction before the model",
      Effect.fnUntraced(function* () {
        const refusals = yield* Effect.forEach(
          [skipped, archived, extractedWith({ engineVersion: "1" }), extractedWith({ text })],
          refusedBy,
          { concurrency: 1 }
        );
        expect(A.map(refusals, (refusal) => refusal._tag)).toStrictEqual(
          A.replicate("FileProcessingOperationError", 4)
        );
        expect(
          A.map(refusals, (refusal) =>
            refusal._tag === "FileProcessingOperationError" ? refusal.message : refusal._tag
          )
        ).toStrictEqual([
          "Office-action review requires extracted text, received skipped.",
          "Office-action review requires extracted text, received archive-exported.",
          "Office-action review requires text extraction output.",
          "Office-action review requires a versioned extractor.",
        ]);
      })
    );
  });

  it.layer(makeLayer(missingOutput), { timeout: "10 seconds" })("missing label", (it) => {
    it.effect(
      "office-action flow refuses a missing or unaligned label before the gate",
      Effect.fnUntraced(function* () {
        const missing = yield* scenario().pipe(Effect.flip);
        expect(missing._tag).toBe("IrToLawExtractionError");
        if (missing._tag === "IrToLawExtractionError") expect(missing.reason).toBe("required-extraction-missing");
      })
    );
  });
  it.layer(makeLayer(unalignedOutput), { timeout: "10 seconds" })("unaligned label", (it) => {
    it.effect(
      "office-action flow refuses a missing or unaligned label before the gate",
      Effect.fnUntraced(function* () {
        const unaligned = yield* scenario().pipe(Effect.flip);
        expect(unaligned._tag).toBe("IrToLawExtractionError");
        if (unaligned._tag === "IrToLawExtractionError") {
          expect(unaligned.reason).toBe("required-extraction-unaligned");
          assertSome(unaligned.alignmentStatus, "unaligned");
          assertSome(unaligned.residualReason, "unaligned");
        }
      })
    );
  });
  it.layer(makeLayer(overCapOutput), { timeout: "10 seconds" })("over-cap label", (it) => {
    it.effect(
      "office-action flow reports a required label past the extraction cap as residual, not unaligned",
      Effect.fnUntraced(function* () {
        const capped = yield* scenario().pipe(Effect.flip);
        expect(capped._tag).toBe("IrToLawExtractionError");
        if (capped._tag === "IrToLawExtractionError") {
          expect(capped.reason).toBe("required-extraction-residual");
          expect(capped.label).toBe("distinction");
          assertSome(capped.residualReason, "over-extraction-cap");
        }
      })
    );
  });
});

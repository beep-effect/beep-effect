import { makeClaimGate } from "@beep/epistemic-use-cases/ClaimGate";
import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractionResult } from "@beep/file-processing/Extraction";
import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { allowRemoteExtractionPolicyLayer, LangExtractService, layer } from "@beep/langextract/Service";
import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { makeOfficeActionReview, OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import { PosixPath } from "@beep/schema/PosixPath";
import { ShaclValidationResult, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Response from "effect/ai/Response";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { modelOutput, text } from "./fixtures/office-action-review/fixture.ts";
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
const scenario = Effect.fn("OfficeActionFlow.scenario")(function* () {
  const digest = yield* Digest.Digest;
  const fileProcessing = yield* FileProcessingService;
  const langExtract = yield* LangExtractService;
  let captured = O.none<ExtractionHandoff>();
  const shacl = ShaclValidationService.of({
    validate: Effect.fn("ShaclValidationService.validate")(() =>
      Effect.succeed(ShaclValidationResult.make({ conforms: true, violations: [], truncated: false }))
    ),
  });
  const irToLaw = makeIrToLaw();
  const review = makeOfficeActionReview({
    digest,
    fileProcessing,
    irToLaw,
    gate: makeClaimGate(shacl),
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
  const extraction = yield* review.extractCandidate(input);
  const handoff = O.getOrThrow(captured);
  const law = yield* irToLaw.toLaw(handoff);
  return { input, handoff, law, extraction };
});

it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("office-action extraction observations", (it) => {
  it.effect("L4-7 verified office-action alignment leaves unreported confidence absent", () =>
    Effect.gen(function* () {
      const { extraction, law } = yield* scenario();
      expect(extraction.evidence.span).toMatchObject({
        version: "evidence-position/v2",
        position: law.distinction.anchor,
        extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
      });
    })
  );
});

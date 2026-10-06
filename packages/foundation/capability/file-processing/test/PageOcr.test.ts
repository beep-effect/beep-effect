import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import {
  makePageOcrServiceLayer,
  PageImage,
  PageOcrEngineIdentity,
  PageOcrError,
  PageOcrModelIdentity,
  PageOcrRequest,
  PageOcrResult,
  PageOcrService,
  PageOcrTiming,
  recognizePage,
} from "@beep/file-processing/PageOcr";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, flow } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PageOcrEngineShape } from "@beep/file-processing/PageOcr";

const hex = Str.repeat(64)("a");
const digest = ContentDigest.make(`sha256:${hex}`);
const operationId = OperationId.make(`operation:${hex}`);
const sourceArtifactId = ArtifactId.make(`artifact:${hex}`);

const requestInput = {
  image: { bytes: new Uint8Array([137, 80, 78, 71]), digest, dpi: 300, mediaType: "image/png" },
  languages: ["eng"],
  operationId,
  pageCount: 2,
  pageNumber: 1,
  sourceArtifactId,
  sourceDigest: digest,
  textFormat: "plain-text",
} as const;

const acceptsRequest = flow(S.decodeUnknownResult(PageOcrRequest), Result.isSuccess);
const acceptsResult = flow(S.decodeUnknownResult(PageOcrResult), Result.isSuccess);

const modelIdentity = PageOcrModelIdentity.make({
  modelId: "example-org/example-ocr",
  projectorDigest: digest,
  quantization: "Q8_0",
  weightsDigest: digest,
});

const visionIdentity = PageOcrEngineIdentity.make({
  engineId: "llama-server/example-ocr",
  family: "llama-server",
  model: modelIdentity,
  version: "b0000",
});

const makeRequest = (): PageOcrRequest =>
  PageOcrRequest.make({
    ...requestInput,
    image: PageImage.make(requestInput.image),
  });

const makeEngine = (identity: PageOcrEngineIdentity, text: string): PageOcrEngineShape => ({
  identity,
  recognizePage: (request) =>
    Effect.succeed(
      PageOcrResult.make({
        engine: identity,
        imageDigest: request.image.digest,
        operationId: request.operationId,
        pageNumber: request.pageNumber,
        sourceArtifactId: request.sourceArtifactId,
        sourceDigest: request.sourceDigest,
        text,
        textFormat: request.textFormat,
        timing: PageOcrTiming.make({ recognizeMillis: 12 }),
        warnings: [],
      })
    ),
});

describe("@beep/file-processing PageOcr", () => {
  it("accepts a page number inside the page count", () => {
    assertTrue(acceptsRequest(requestInput));
  });

  it("rejects a page number past the page count", () => {
    assertFalse(acceptsRequest({ ...requestInput, pageNumber: 3 }));
  });

  it("rejects a zero page number", () => {
    assertFalse(acceptsRequest({ ...requestInput, pageNumber: 0 }));
  });

  it("rejects a confidence outside the unit interval", () => {
    const result = {
      confidence: 1.2,
      engine: { engineId: "tesseract/eng", family: "tesseract", version: "5.5.3" },
      imageDigest: digest,
      operationId,
      pageNumber: 1,
      sourceArtifactId,
      sourceDigest: digest,
      text: "Synthetic page text.",
      textFormat: "plain-text",
      timing: { recognizeMillis: 850 },
      warnings: [],
    };

    assertFalse(acceptsResult(result));
    assertTrue(acceptsResult({ ...result, confidence: 0.93 }));
  });

  it("rejects an unknown warning", () => {
    assertFalse(
      acceptsResult({
        engine: { engineId: "tesseract/eng", family: "tesseract", version: "5.5.3" },
        imageDigest: digest,
        operationId,
        pageNumber: 1,
        sourceArtifactId,
        sourceDigest: digest,
        text: "",
        textFormat: "plain-text",
        timing: { recognizeMillis: 1 },
        warnings: ["made-up-warning"],
      })
    );
  });

  it.layer(
    makePageOcrServiceLayer([
      makeEngine(
        PageOcrEngineIdentity.make({ engineId: "tesseract/eng", family: "tesseract", version: "5.5.3" }),
        "baseline text"
      ),
      makeEngine(visionIdentity, "vision text"),
    ]),
    { timeout: "30 seconds" }
  )("routes pages by engine id", (it) => {
    it.effect(
      "routes a page to the engine with the requested id and keeps its model identity",
      Effect.fnUntraced(function* () {
        const result = yield* recognizePage("llama-server/example-ocr", makeRequest());
        const service = yield* PageOcrService;

        expect(result.text).toBe("vision text");
        expect(result.engine.model?.weightsDigest).toBe(digest);
        expect(result.engine.model?.quantization).toBe("Q8_0");
        expect(service.engines.length).toBe(2);
      })
    );
  });

  it.layer(makePageOcrServiceLayer([makeEngine(visionIdentity, "vision text")]), { timeout: "30 seconds" })(
    "refuses an unknown engine id",
    (it) => {
      it.effect(
        "fails with engine-not-found instead of substituting another engine",
        Effect.fnUntraced(function* () {
          const error = yield* recognizePage("tesseract/eng", makeRequest()).pipe(Effect.flip);

          expect(error).toBeInstanceOf(PageOcrError);
          expect(error.reason).toBe("engine-not-found");
          expect(error.pageNumber).toBe(1);
          expect(error.sourceArtifactId).toBe(sourceArtifactId);
        })
      );
    }
  );
});

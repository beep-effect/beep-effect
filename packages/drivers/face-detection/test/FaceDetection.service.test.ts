import {
  FaceDetection,
  FaceDetectionBox,
  FaceDetectionConfidence,
  FaceDetectionError,
  FaceDetectionErrorFromUnknownOptions,
  FaceDetectionImageRequest,
  FaceDetectionLandmarks,
  FaceDetectionModelConfig,
  FaceDetectionOperation,
  FaceDetectionPercentage,
  FaceDetectionPoint,
  FaceDetectionResult,
  FaceDetectionService,
  FaceDetectionTopK,
  NonNegativeImageCoordinate,
  PositivePixelDimension,
  RawFaceDetectionConfidence,
  withDetector,
} from "@beep/face-detection";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Layer, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const point = FaceDetectionPoint.make({ x: 1, y: 2 });

const fakeFace = FaceDetection.make({
  box: FaceDetectionBox.make({ height: 24, width: 20, x: 10, y: 12 }),
  confidence: 0.9,
  landmarks: FaceDetectionLandmarks.make({
    leftEye: point,
    leftMouth: point,
    nose: point,
    rightEye: point,
    rightMouth: point,
  }),
});

const PositivePixelDimensionArbitrary = S.toArbitrary(PositivePixelDimension);
const FaceDetectionConfidenceArbitrary = S.toArbitrary(FaceDetectionConfidence);
const RawFaceDetectionConfidenceArbitrary = S.toArbitrary(RawFaceDetectionConfidence);
const FaceDetectionPercentageArbitrary = S.toArbitrary(FaceDetectionPercentage);
const FaceDetectionTopKArbitrary = S.toArbitrary(FaceDetectionTopK);
const NonNegativeImageCoordinateArbitrary = S.toArbitrary(NonNegativeImageCoordinate);
const FaceDetectionOperationArbitrary = S.toArbitrary(FaceDetectionOperation);
const FaceDetectionImageRequestArbitrary = S.toArbitrary(FaceDetectionImageRequest);
const FaceDetectionBoxArbitrary = S.toArbitrary(FaceDetectionBox);
const FaceDetectionArbitrary = S.toArbitrary(FaceDetection);
const FaceDetectionResultArbitrary = S.toArbitrary(FaceDetectionResult);
const FaceDetectionErrorFromUnknownOptionsArbitrary = S.toArbitrary(FaceDetectionErrorFromUnknownOptions).filter(
  (options) => O.isNone(options.cause)
);
const FaceDetectionErrorArbitrary = S.toArbitrary(FaceDetectionError).filter((error) => O.isNone(error.cause));

const expectCodecIdentity = <Schema extends S.Codec<unknown, unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value)).toBe(true);
};

const fakeLayer = Layer.succeed(
  FaceDetectionService,
  FaceDetectionService.of({
    withDetector: Effect.fn("FaceDetectionService.withDetector")((config, use) =>
      use({
        detect: Effect.fn("LoadedFaceDetector.detect")((request) =>
          Effect.succeed(
            FaceDetectionResult.make({
              faces: [fakeFace],
              height: 100,
              imagePath: request.imagePath,
              width: 100,
            })
          )
        ),
      }).pipe(Effect.annotateLogs({ modelPath: config.modelPath }))
    ),
  })
);

describe("@beep/face-detection", () => {
  it("preserves encoded schema wire shapes", () => {
    expect(
      JSON.stringify(
        Result.getOrThrow(
          S.encodeResult(FaceDetectionImageRequest)(FaceDetectionImageRequest.make({ imagePath: "./photo.jpg" }))
        )
      )
    ).toBe(
      JSON.stringify({
        imagePath: "./photo.jpg",
        minConfidence: 0.75,
        nmsThreshold: 0.3,
        topK: 5000,
      })
    );
    expect(JSON.stringify(Result.getOrThrow(S.encodeResult(FaceDetectionBox)(fakeFace.box)))).toBe(
      JSON.stringify({ height: 24, width: 20, x: 10, y: 12 })
    );
    expect(JSON.stringify(Result.getOrThrow(S.encodeResult(FaceDetection)(fakeFace)))).toBe(
      JSON.stringify({
        box: { height: 24, width: 20, x: 10, y: 12 },
        confidence: 0.9,
        landmarks: {
          leftEye: { x: 1, y: 2 },
          leftMouth: { x: 1, y: 2 },
          nose: { x: 1, y: 2 },
          rightEye: { x: 1, y: 2 },
          rightMouth: { x: 1, y: 2 },
        },
      })
    );
    expect(
      JSON.stringify(
        Result.getOrThrow(
          S.encodeResult(FaceDetectionResult)(
            FaceDetectionResult.make({
              faces: [fakeFace],
              height: 100,
              imagePath: "./photo.jpg",
              width: 100,
            })
          )
        )
      )
    ).toBe(
      JSON.stringify({
        faces: [Result.getOrThrow(S.encodeResult(FaceDetection)(fakeFace))],
        height: 100,
        imagePath: "./photo.jpg",
        width: 100,
      })
    );
    expect(
      JSON.stringify(
        Result.getOrThrow(
          S.encodeResult(FaceDetectionErrorFromUnknownOptions)(
            FaceDetectionErrorFromUnknownOptions.make({ modelPath: O.some("./yunet.onnx") })
          )
        )
      )
    ).toBe(JSON.stringify({ modelPath: "./yunet.onnx" }));
    expect(
      JSON.stringify(
        Result.getOrThrow(
          S.encodeResult(FaceDetectionError)(
            FaceDetectionError.make({ message: "model failed", operation: "loadModel" })
          )
        )
      )
    ).toBe(JSON.stringify({ _tag: "FaceDetectionError", message: "model failed", operation: "loadModel" }));
  });

  it("round-trips schema-derived face-detection values through encoded form", () =>
    fc.assert(
      fc.property(
        PositivePixelDimensionArbitrary,
        FaceDetectionConfidenceArbitrary,
        RawFaceDetectionConfidenceArbitrary,
        FaceDetectionPercentageArbitrary,
        FaceDetectionTopKArbitrary,
        NonNegativeImageCoordinateArbitrary,
        FaceDetectionOperationArbitrary,
        FaceDetectionImageRequestArbitrary,
        FaceDetectionBoxArbitrary,
        FaceDetectionArbitrary,
        FaceDetectionResultArbitrary,
        FaceDetectionErrorFromUnknownOptionsArbitrary,
        FaceDetectionErrorArbitrary,
        (
          positivePixelDimension,
          confidence,
          rawConfidence,
          percentage,
          topK,
          coordinate,
          operation,
          request,
          box,
          face,
          result,
          errorOptions,
          error
        ) => {
          expectCodecIdentity(PositivePixelDimension, positivePixelDimension);
          expectCodecIdentity(FaceDetectionConfidence, confidence);
          expectCodecIdentity(RawFaceDetectionConfidence, rawConfidence);
          expectCodecIdentity(FaceDetectionPercentage, percentage);
          expectCodecIdentity(FaceDetectionTopK, topK);
          expectCodecIdentity(NonNegativeImageCoordinate, coordinate);
          expectCodecIdentity(FaceDetectionOperation, operation);
          expectCodecIdentity(FaceDetectionImageRequest, request);
          expectCodecIdentity(FaceDetectionBox, box);
          expectCodecIdentity(FaceDetection, face);
          expectCodecIdentity(FaceDetectionResult, result);
          expectCodecIdentity(FaceDetectionErrorFromUnknownOptions, errorOptions);
          expectCodecIdentity(FaceDetectionError, error);
        }
      ),
      fcRuns(20)
    ));

  it("normalizes raw model confidence at the schema boundary", () => {
    expect(RawFaceDetectionConfidence.fromUnknown(-0.2)).toBe(0);
    expect(RawFaceDetectionConfidence.fromUnknown(0.5)).toBe(0.5);
    expect(RawFaceDetectionConfidence.fromUnknown(1.2)).toBe(1);
  });

  it.effect("runs workflows through the service contract", () =>
    withDetector({ modelPath: "./model.onnx" }, (detector) =>
      detector.detect(FaceDetectionImageRequest.make({ imagePath: "./photo.jpg" }))
    ).pipe(
      Effect.map((result) => {
        expect(result.faces).toEqual([fakeFace]);
        expect(result.imagePath).toBe("./photo.jpg");
      }),
      provideScopedLayer(fakeLayer)
    )
  );

  it.effect("supports data-last detector workflows", () =>
    withDetector((detector) => detector.detect(FaceDetectionImageRequest.make({ imagePath: "./photo.jpg" })))(
      FaceDetectionModelConfig.make({ modelPath: "./model.onnx" })
    ).pipe(
      Effect.map((result) => {
        expect(result.faces).toEqual([fakeFace]);
        expect(result.width).toBe(100);
      }),
      provideScopedLayer(fakeLayer)
    )
  );
});

/**
 * Schema-first public models for the ONNX face detection driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FaceDetectionId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { identity, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $FaceDetectionId.create("FaceDetection.models");

/**
 * Pixel dimension greater than zero.
 *
 * **Example** (Decode positive pixel width)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositivePixelDimension } from "@beep/face-detection/FaceDetection.models"
 *
 * const width = S.decodeUnknownSync(PositivePixelDimension)(640)
 * console.log(width)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositivePixelDimension = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`PositivePixelDimensionGreaterThanZeroCheck`,
    title: "Positive Pixel Dimension",
    description: "Image pixel dimensions must be greater than zero.",
    message: "Expected a positive pixel dimension",
  })
).pipe(
  $I.annoteSchema("PositivePixelDimension", {
    description: "A positive integer pixel dimension.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link PositivePixelDimension} schema.
 *
 * **Example** (Type decoded pixel dimension)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositivePixelDimension } from "@beep/face-detection/FaceDetection.models"
 * import type { PositivePixelDimension as PositivePixelDimensionValue } from "@beep/face-detection/FaceDetection.models"
 *
 * const width: PositivePixelDimensionValue = S.decodeUnknownSync(PositivePixelDimension)(1280)
 * console.log(width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositivePixelDimension = typeof PositivePixelDimension.Type;

/**
 * Detection confidence between zero and one.
 *
 * **Example** (Decode confidence score)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionConfidence } from "@beep/face-detection/FaceDetection.models"
 *
 * const confidence = S.decodeUnknownSync(FaceDetectionConfidence)(0.92)
 * console.log(confidence)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FaceDetectionConfidence = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`FaceDetectionConfidenceGreaterThanOrEqualToZeroCheck`,
        title: "Face Detection Confidence Minimum",
        description: "Detection confidence must be greater than or equal to zero.",
        message: "Expected confidence greater than or equal to zero",
      }),
      S.isLessThanOrEqualTo(1, {
        identifier: $I`FaceDetectionConfidenceLessThanOrEqualToOneCheck`,
        title: "Face Detection Confidence Maximum",
        description: "Detection confidence must be less than or equal to one.",
        message: "Expected confidence less than or equal to one",
      }),
    ],
    {
      identifier: $I`FaceDetectionConfidenceChecks`,
      title: "Face Detection Confidence",
      description: "Checks for normalized face detection confidence values.",
    }
  )
).pipe(
  $I.annoteSchema("FaceDetectionConfidence", {
    description: "Normalized face detection confidence between zero and one.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link FaceDetectionConfidence} schema.
 *
 * **Example** (Type decoded confidence value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionConfidence } from "@beep/face-detection/FaceDetection.models"
 * import type { FaceDetectionConfidence as FaceDetectionConfidenceValue } from "@beep/face-detection/FaceDetection.models"
 *
 * const confidence: FaceDetectionConfidenceValue = S.decodeUnknownSync(FaceDetectionConfidence)(0.5)
 * console.log(confidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FaceDetectionConfidence = typeof FaceDetectionConfidence.Type;

/**
 * Raw model confidence score normalized into the public confidence domain.
 *
 * **Example** (Decode raw confidence score)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { RawFaceDetectionConfidence } from "@beep/face-detection/FaceDetection.models"
 *
 * const confidence = Effect.runSync(S.decodeUnknownEffect(RawFaceDetectionConfidence)(1.25))
 * console.log(confidence)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawFaceDetectionConfidence = S.Finite.pipe(
  S.decodeTo(
    FaceDetectionConfidence,
    SchemaTransformation.transform({
      decode: (value) => Math.min(1, Math.max(0, value)),
      encode: identity,
    })
  ),
  $I.annoteSchema("RawFaceDetectionConfidence", {
    description: "Finite raw ONNX confidence score normalized into the zero-to-one confidence domain.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link RawFaceDetectionConfidence} schema.
 *
 * **Example** (Annotate raw confidence type)
 *
 * ```ts
 * import type { RawFaceDetectionConfidence } from "@beep/face-detection/FaceDetection.models"
 *
 * const confidence: RawFaceDetectionConfidence = 1
 * console.log(confidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RawFaceDetectionConfidence = typeof RawFaceDetectionConfidence.Type;

/**
 * Percentage threshold accepted by face-detection triage.
 *
 * **Example** (Decode percentage threshold)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionPercentage } from "@beep/face-detection/FaceDetection.models"
 *
 * const threshold = S.decodeUnknownSync(FaceDetectionPercentage)(75)
 * console.log(threshold)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FaceDetectionPercentage = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`FaceDetectionPercentageGreaterThanOrEqualToZeroCheck`,
        title: "Face Detection Percentage Minimum",
        description: "Face-detection percentage values must be greater than or equal to zero.",
        message: "Expected percentage greater than or equal to zero",
      }),
      S.isLessThanOrEqualTo(100, {
        identifier: $I`FaceDetectionPercentageLessThanOrEqualToOneHundredCheck`,
        title: "Face Detection Percentage Maximum",
        description: "Face-detection percentage values must be less than or equal to 100.",
        message: "Expected percentage less than or equal to 100",
      }),
    ],
    {
      identifier: $I`FaceDetectionPercentageChecks`,
      title: "Face Detection Percentage",
      description: "Checks for percentage values accepted by face-detection triage.",
    }
  )
).pipe(
  $I.annoteSchema("FaceDetectionPercentage", {
    description: "Percentage value between zero and 100.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link FaceDetectionPercentage} schema.
 *
 * **Example** (Type decoded percentage value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionPercentage } from "@beep/face-detection/FaceDetection.models"
 * import type { FaceDetectionPercentage as FaceDetectionPercentageValue } from "@beep/face-detection/FaceDetection.models"
 *
 * const percentage: FaceDetectionPercentageValue = S.decodeUnknownSync(FaceDetectionPercentage)(50)
 * console.log(percentage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FaceDetectionPercentage = typeof FaceDetectionPercentage.Type;

/**
 * Positive maximum number of detections to keep.
 *
 * **Example** (Decode top-K limit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionTopK } from "@beep/face-detection/FaceDetection.models"
 *
 * const topK = S.decodeUnknownSync(FaceDetectionTopK)(20)
 * console.log(topK)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FaceDetectionTopK = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`FaceDetectionTopKGreaterThanZeroCheck`,
    title: "Face Detection Top K",
    description: "The maximum number of detections must be greater than zero.",
    message: "Expected top-k greater than zero",
  })
).pipe(
  $I.annoteSchema("FaceDetectionTopK", {
    description: "Positive maximum number of face detections kept after non-maximum suppression.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link FaceDetectionTopK} schema.
 *
 * **Example** (Type decoded top-K value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FaceDetectionTopK } from "@beep/face-detection/FaceDetection.models"
 * import type { FaceDetectionTopK as FaceDetectionTopKValue } from "@beep/face-detection/FaceDetection.models"
 *
 * const topK: FaceDetectionTopKValue = S.decodeUnknownSync(FaceDetectionTopK)(10)
 * console.log(topK)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FaceDetectionTopK = typeof FaceDetectionTopK.Type;

/**
 * Non-negative image coordinate or dimension.
 *
 * **Example** (Decode non-negative coordinate)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonNegativeImageCoordinate } from "@beep/face-detection/FaceDetection.models"
 *
 * const x = S.decodeUnknownSync(NonNegativeImageCoordinate)(12.5)
 * console.log(x)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativeImageCoordinate = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeImageCoordinateMinimumCheck`,
    title: "Non-negative Image Coordinate",
    description: "Image coordinates and box dimensions must be greater than or equal to zero.",
    message: "Expected a non-negative image coordinate",
  })
).pipe(
  $I.annoteSchema("NonNegativeImageCoordinate", {
    description: "Finite image coordinate or dimension greater than or equal to zero.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by the {@link NonNegativeImageCoordinate} schema.
 *
 * **Example** (Annotate coordinate type)
 *
 * ```ts
 * import type { NonNegativeImageCoordinate } from "@beep/face-detection/FaceDetection.models"
 *
 * const x: NonNegativeImageCoordinate = 0
 * console.log(x)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativeImageCoordinate = typeof NonNegativeImageCoordinate.Type;

/**
 * Request to load a YuNet-compatible ONNX face detector.
 *
 * **Example** (Make model config)
 *
 * ```ts
 * import { FaceDetectionModelConfig } from "@beep/face-detection"
 *
 * const config = FaceDetectionModelConfig.make({ modelPath: "./face_detection_yunet_2023mar.onnx" })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionModelConfig extends S.Class<FaceDetectionModelConfig>($I`FaceDetectionModelConfig`)(
  {
    modelPath: S.String.annotateKey({
      description: "Filesystem path to the YuNet-compatible ONNX model.",
    }),
  },
  $I.annote("FaceDetectionModelConfig", {
    description: "Request to load a YuNet-compatible ONNX face detector.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(FaceDetectionModelConfig);
}

/**
 * Request to detect faces in one image with a loaded detector.
 *
 * **Example** (Make image request)
 *
 * ```ts
 * import { FaceDetectionImageRequest } from "@beep/face-detection"
 *
 * const request = FaceDetectionImageRequest.make({ imagePath: "./photo.jpg" })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionImageRequest extends S.Class<FaceDetectionImageRequest>($I`FaceDetectionImageRequest`)(
  {
    imagePath: S.String.annotateKey({
      description: "Filesystem path to the source image.",
    }),
    minConfidence: FaceDetectionConfidence.pipe(SchemaUtils.withKeyDefaults(0.75)).annotateKey({
      description: "Minimum normalized confidence required for a face candidate.",
    }),
    nmsThreshold: FaceDetectionConfidence.pipe(SchemaUtils.withKeyDefaults(0.3)).annotateKey({
      description: "Intersection-over-union threshold used for non-maximum suppression.",
    }),
    topK: FaceDetectionTopK.pipe(SchemaUtils.withKeyDefaults(5000)).annotateKey({
      description: "Maximum number of candidate faces retained before suppression.",
    }),
  },
  $I.annote("FaceDetectionImageRequest", {
    description: "Request to detect faces in one image with a loaded YuNet-compatible detector.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(FaceDetectionImageRequest);
}

/**
 * Two-dimensional point emitted by a face detector.
 *
 * **Example** (Make detection point)
 *
 * ```ts
 * import { FaceDetectionPoint } from "@beep/face-detection/FaceDetection.models"
 *
 * const point = FaceDetectionPoint.make({ x: 112.5, y: 48 })
 * console.log(point.x)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionPoint extends S.Class<FaceDetectionPoint>($I`FaceDetectionPoint`)(
  {
    x: NonNegativeImageCoordinate.annotateKey({
      description: "Horizontal image coordinate.",
    }),
    y: NonNegativeImageCoordinate.annotateKey({
      description: "Vertical image coordinate.",
    }),
  },
  $I.annote("FaceDetectionPoint", {
    description: "Two-dimensional image point emitted by a face detector.",
  })
) {}

/**
 * Bounding box emitted by a face detector.
 *
 * **Example** (Make bounding box)
 *
 * ```ts
 * import { FaceDetectionBox } from "@beep/face-detection/FaceDetection.models"
 *
 * const box = FaceDetectionBox.make({ height: 80, width: 64, x: 40, y: 24 })
 * console.log(box.width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionBox extends S.Class<FaceDetectionBox>($I`FaceDetectionBox`)(
  {
    height: NonNegativeImageCoordinate.annotateKey({
      description: "Detected face box height.",
    }),
    width: NonNegativeImageCoordinate.annotateKey({
      description: "Detected face box width.",
    }),
    x: NonNegativeImageCoordinate.annotateKey({
      description: "Left image coordinate for the detected face box.",
    }),
    y: NonNegativeImageCoordinate.annotateKey({
      description: "Top image coordinate for the detected face box.",
    }),
  },
  $I.annote("FaceDetectionBox", {
    description: "Face bounding box using top-left x/y coordinates plus width and height.",
  })
) {}

/**
 * Five landmark points emitted by YuNet-compatible face detection models.
 *
 * **Example** (Make five landmarks)
 *
 * ```ts
 * import { FaceDetectionLandmarks } from "@beep/face-detection/FaceDetection.models"
 *
 * const landmarks = FaceDetectionLandmarks.make({
 *   leftEye: { x: 58, y: 42 },
 *   leftMouth: { x: 60, y: 78 },
 *   nose: { x: 74, y: 62 },
 *   rightEye: { x: 90, y: 42 },
 *   rightMouth: { x: 88, y: 78 }
 * })
 * console.log(landmarks.nose.x)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionLandmarks extends S.Class<FaceDetectionLandmarks>($I`FaceDetectionLandmarks`)(
  {
    leftEye: FaceDetectionPoint.annotateKey({
      description: "Left eye landmark point.",
    }),
    leftMouth: FaceDetectionPoint.annotateKey({
      description: "Left mouth-corner landmark point.",
    }),
    nose: FaceDetectionPoint.annotateKey({
      description: "Nose landmark point.",
    }),
    rightEye: FaceDetectionPoint.annotateKey({
      description: "Right eye landmark point.",
    }),
    rightMouth: FaceDetectionPoint.annotateKey({
      description: "Right mouth-corner landmark point.",
    }),
  },
  $I.annote("FaceDetectionLandmarks", {
    description: "Five face landmarks emitted by a YuNet-compatible detector.",
  })
) {}

/**
 * One face detection emitted for an image.
 *
 * **Example** (Make face detection)
 *
 * ```ts
 * import { FaceDetection } from "@beep/face-detection/FaceDetection.models"
 *
 * const face = FaceDetection.make({
 *   box: { height: 80, width: 64, x: 40, y: 24 },
 *   confidence: 0.91,
 *   landmarks: {
 *     leftEye: { x: 58, y: 42 },
 *     leftMouth: { x: 60, y: 78 },
 *     nose: { x: 74, y: 62 },
 *     rightEye: { x: 90, y: 42 },
 *     rightMouth: { x: 88, y: 78 }
 *   }
 * })
 * console.log(face.confidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetection extends S.Class<FaceDetection>($I`FaceDetection`)(
  {
    box: FaceDetectionBox.annotateKey({
      description: "Detected face bounding box in source-image coordinates.",
    }),
    confidence: FaceDetectionConfidence.annotateKey({
      description: "Normalized confidence score for the detected face.",
    }),
    landmarks: FaceDetectionLandmarks.annotateKey({
      description: "Five facial landmarks in source-image coordinates.",
    }),
  },
  $I.annote("FaceDetection", {
    description: "One detected face with confidence, bounding box, and landmarks.",
  })
) {}

/**
 * Face detection result for one image.
 *
 * **Example** (Make empty detection result)
 *
 * ```ts
 * import { FaceDetectionResult } from "@beep/face-detection/FaceDetection.models"
 *
 * const result = FaceDetectionResult.make({
 *   faces: [],
 *   height: 720,
 *   imagePath: "./photo.jpg",
 *   width: 1280
 * })
 * console.log(result.faces.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionResult extends S.Class<FaceDetectionResult>($I`FaceDetectionResult`)(
  {
    faces: S.Array(FaceDetection).annotateKey({
      description: "Detected faces in descending confidence order after suppression.",
    }),
    height: PositivePixelDimension.annotateKey({
      description: "Source image height in pixels.",
    }),
    imagePath: S.String.annotateKey({
      description: "Filesystem path to the processed source image.",
    }),
    width: PositivePixelDimension.annotateKey({
      description: "Source image width in pixels.",
    }),
  },
  $I.annote("FaceDetectionResult", {
    description: "Face detection result for one image.",
  })
) {}

/**
 * Decode a model config from unknown input.
 *
 * **Example** (Decode model config)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeFaceDetectionModelConfig } from "@beep/face-detection/FaceDetection.models"
 *
 * const config = Effect.runSync(
 *   decodeFaceDetectionModelConfig({ modelPath: "./face_detection_yunet_2023mar.onnx" })
 * )
 * console.log(config.modelPath)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeFaceDetectionModelConfig = FaceDetectionModelConfig.decodeEffect;

/**
 * Decode an image request from unknown input.
 *
 * **Example** (Decode image request)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeFaceDetectionImageRequest } from "@beep/face-detection/FaceDetection.models"
 *
 * const request = Effect.runSync(
 *   decodeFaceDetectionImageRequest({
 *     imagePath: "./photo.jpg",
 *     minConfidence: 0.8,
 *     nmsThreshold: 0.3,
 *     topK: 20
 *   })
 * )
 * console.log(request.topK)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeFaceDetectionImageRequest = FaceDetectionImageRequest.decodeEffect;

/**
 * ONNX face detection driver service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FaceDetectionId } from "@beep/identity/packages";
import { A, thunkUndefined } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Context, Effect, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import sharp from "sharp";
import { FaceDetectionError } from "./FaceDetection.errors.ts";
import {
  FaceDetection,
  FaceDetectionBox,
  FaceDetectionImageRequest,
  FaceDetectionLandmarks,
  FaceDetectionModelConfig,
  FaceDetectionPoint,
  FaceDetectionResult,
  PositivePixelDimension,
  RawFaceDetectionConfidence,
} from "./FaceDetection.models.ts";

const $I = $FaceDetectionId.create("FaceDetection.service");
const divisor = 32;
const MAX_FACE_DETECTION_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_FACE_DETECTION_IMAGE_PIXELS = 16_777_216;
const MAX_FACE_DETECTION_TENSOR_PIXELS = 16_777_216;
const strides = [8, 16, 32] as const;
const outputNames = [
  "cls_8",
  "cls_16",
  "cls_32",
  "obj_8",
  "obj_16",
  "obj_32",
  "bbox_8",
  "bbox_16",
  "bbox_32",
  "kps_8",
  "kps_16",
  "kps_32",
] as const;

const PositiveScale = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveScaleGreaterThanZeroCheck`,
    title: "Positive Preprocessing Scale",
    description: "Preprocessing scale must be greater than zero.",
    message: "Expected preprocessing scale greater than zero",
  })
).pipe(
  $I.annoteSchema("PositiveScale", {
    description: "Positive image preprocessing scale.",
  })
);

const NonNegativeOffset = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeOffsetMinimumCheck`,
    title: "Non-negative Preprocessing Offset",
    description: "Preprocessing offsets must be greater than or equal to zero.",
    message: "Expected preprocessing offset greater than or equal to zero",
  })
).pipe(
  $I.annoteSchema("NonNegativeOffset", {
    description: "Non-negative image preprocessing offset.",
  })
);

class PreprocessedImage extends S.Class<PreprocessedImage>($I`PreprocessedImage`)(
  {
    height: PositivePixelDimension.annotateKey({
      description: "Source image height in pixels.",
    }),
    offsetX: NonNegativeOffset.annotateKey({
      description: "Horizontal padding offset applied during preprocessing.",
    }),
    offsetY: NonNegativeOffset.annotateKey({
      description: "Vertical padding offset applied during preprocessing.",
    }),
    padHeight: PositivePixelDimension.annotateKey({
      description: "Padded tensor height in pixels.",
    }),
    padWidth: PositivePixelDimension.annotateKey({
      description: "Padded tensor width in pixels.",
    }),
    scale: PositiveScale.annotateKey({
      description: "Scale applied from source image coordinates into tensor coordinates.",
    }),
    tensorData: S.Uint8Array.annotateKey({
      description: "Preprocessed BGR tensor bytes.",
    }),
    width: PositivePixelDimension.annotateKey({
      description: "Source image width in pixels.",
    }),
  },
  $I.annote("PreprocessedImage", {
    description: "Internal BGR image tensor input for YuNet-compatible face detection.",
  })
) {}

class RawFaceDetectionPoint extends S.Class<RawFaceDetectionPoint>($I`RawFaceDetectionPoint`)(
  {
    x: S.Finite,
    y: S.Finite,
  },
  $I.annote("RawFaceDetectionPoint", {
    description: "Raw tensor-space point before projection back to source-image bounds.",
  })
) {}

class RawFaceDetectionBox extends S.Class<RawFaceDetectionBox>($I`RawFaceDetectionBox`)(
  {
    height: S.Finite,
    width: S.Finite,
    x: S.Finite,
    y: S.Finite,
  },
  $I.annote("RawFaceDetectionBox", {
    description: "Raw tensor-space box before projection back to source-image bounds.",
  })
) {}

class RawFaceDetectionLandmarks extends S.Class<RawFaceDetectionLandmarks>($I`RawFaceDetectionLandmarks`)(
  {
    leftEye: RawFaceDetectionPoint,
    leftMouth: RawFaceDetectionPoint,
    nose: RawFaceDetectionPoint,
    rightEye: RawFaceDetectionPoint,
    rightMouth: RawFaceDetectionPoint,
  },
  $I.annote("RawFaceDetectionLandmarks", {
    description: "Raw tensor-space landmarks before projection back to source-image bounds.",
  })
) {}

class RawFaceDetection extends S.Class<RawFaceDetection>($I`RawFaceDetection`)(
  {
    box: RawFaceDetectionBox,
    confidence: RawFaceDetectionConfidence,
    landmarks: RawFaceDetectionLandmarks,
  },
  $I.annote("RawFaceDetection", {
    description: "Raw tensor-space face detection before source-image coordinate projection.",
  })
) {}

class ModelInputDimensions extends S.Class<ModelInputDimensions>($I`ModelInputDimensions`)(
  {
    height: PositivePixelDimension,
    width: PositivePixelDimension,
  },
  $I.annote("ModelInputDimensions", {
    description: "Fixed tensor dimensions expected by a loaded face detection model.",
  })
) {}

type Ort = typeof import("onnxruntime-node");
type OrtSession = import("onnxruntime-node").InferenceSession;
type OrtTensor = import("onnxruntime-node").Tensor;

/**
 * Loaded face detector bound to one model session.
 *
 * **Example** (Mock detector detect call)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { FaceDetectionImageRequest, FaceDetectionResult } from "@beep/face-detection"
 * import type { LoadedFaceDetector } from "@beep/face-detection"
 *
 * const detector: LoadedFaceDetector = {
 *   detect: (request) =>
 *     Effect.succeed(
 *       FaceDetectionResult.make({
 *         faces: [],
 *         height: 480,
 *         imagePath: request.imagePath,
 *         width: 640
 *       })
 *     )
 * }
 *
 * const result = Effect.runSync(
 *   detector.detect(
 *     FaceDetectionImageRequest.make({
 *       imagePath: "./photo.jpg",
 *       minConfidence: 0.8,
 *       nmsThreshold: 0.3,
 *       topK: 20
 *     })
 *   )
 * )
 * console.log(result.faces.length)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LoadedFaceDetector {
  readonly detect: (request: FaceDetectionImageRequest) => Effect.Effect<FaceDetectionResult, FaceDetectionError>;
}

/**
 * Runtime shape exposed by the {@link FaceDetectionService}.
 *
 * **Example** (Service shape withDetector usage)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { FaceDetectionImageRequest, FaceDetectionModelConfig, FaceDetectionResult } from "@beep/face-detection"
 * import type { FaceDetectionServiceShape, LoadedFaceDetector } from "@beep/face-detection"
 *
 * const detector: LoadedFaceDetector = {
 *   detect: (request) =>
 *     Effect.succeed(
 *       FaceDetectionResult.make({
 *         faces: [],
 *         height: 480,
 *         imagePath: request.imagePath,
 *         width: 640
 *       })
 *     )
 * }
 * const service: FaceDetectionServiceShape = {
 *   withDetector: (_config, use) => use(detector)
 * }
 * const result = Effect.runSync(
 *   service.withDetector(
 *     FaceDetectionModelConfig.make({ modelPath: "./yunet.onnx" }),
 *     (loaded) =>
 *       loaded.detect(
 *         FaceDetectionImageRequest.make({
 *           imagePath: "./photo.jpg",
 *           minConfidence: 0.8,
 *           nmsThreshold: 0.3,
 *           topK: 20
 *         })
 *       )
 *   )
 * )
 * console.log(result.imagePath)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FaceDetectionServiceShape {
  readonly withDetector: <A, E, R>(
    config: FaceDetectionModelConfig,
    use: (detector: LoadedFaceDetector) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | FaceDetectionError, R>;
}

/**
 * Service tag for ONNX face detection.
 *
 * **Example** (Provide and inject service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   FaceDetectionImageRequest,
 *   FaceDetectionModelConfig,
 *   FaceDetectionResult,
 *   FaceDetectionService
 * } from "@beep/face-detection"
 * import type { LoadedFaceDetector } from "@beep/face-detection"
 *
 * const detector: LoadedFaceDetector = {
 *   detect: (request) =>
 *     Effect.succeed(
 *       FaceDetectionResult.make({
 *         faces: [],
 *         height: 480,
 *         imagePath: request.imagePath,
 *         width: 640
 *       })
 *     )
 * }
 * const service = FaceDetectionService.of({
 *   withDetector: (_config, use) => use(detector)
 * })
 * const program = Effect.gen(function* () {
 *   const faceDetection = yield* FaceDetectionService
 *   return yield* faceDetection.withDetector(
 *     FaceDetectionModelConfig.make({ modelPath: "./yunet.onnx" }),
 *     (loaded) =>
 *       loaded.detect(
 *         FaceDetectionImageRequest.make({
 *           imagePath: "./photo.jpg",
 *           minConfidence: 0.8,
 *           nmsThreshold: 0.3,
 *           topK: 20
 *         })
 *       )
 *   )
 * })
 *
 * const result = Effect.runSync(Effect.provideService(program, FaceDetectionService, service))
 * console.log(result.width)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FaceDetectionService extends Context.Service<FaceDetectionService, FaceDetectionServiceShape>()(
  $I`FaceDetectionService`
) {
  /**
   * Live ONNX Runtime service layer.
   *
   * **Example** (Create live service layer)
   *
   * ```ts
   * import { Layer } from "effect"
   * import { FaceDetectionService } from "@beep/face-detection"
   *
   * const layer = FaceDetectionService.makeLayer()
   * const isLayer = Layer.isLayer(layer)
   * console.log(isLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (): Layer.Layer<FaceDetectionService> =>
    Layer.succeed(FaceDetectionService, makeFaceDetectionService());
}

const loadOnnxRuntime = Effect.fn("FaceDetection.loadOnnxRuntime")(function* (): Effect.fn.Return<
  Ort,
  FaceDetectionError
> {
  return yield* Effect.tryPromise({
    try: () => import("onnxruntime-node"),
    catch: (cause) => FaceDetectionError.fromUnknown("loadOnnxRuntime", "Failed to load onnxruntime-node.", { cause }),
  });
});

const loadSession = Effect.fn("FaceDetection.loadSession")(function* (
  ort: Ort,
  config: FaceDetectionModelConfig
): Effect.fn.Return<OrtSession, FaceDetectionError> {
  return yield* Effect.tryPromise({
    try: () => ort.InferenceSession.create(config.modelPath, { executionProviders: ["cpu"] }),
    catch: (cause) =>
      FaceDetectionError.fromUnknown("loadSession", `Failed to load ONNX face detection model: "${config.modelPath}"`, {
        cause,
        modelPath: config.modelPath,
      }),
  });
});

const releaseSession = (session: OrtSession): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => session.release(),
    catch: thunkUndefined,
  }).pipe(Effect.ignore);

const toPaddedDimension = (value: number): number => Math.ceil(value / divisor) * divisor;

const checkedPixelCount = (
  operation: string,
  imagePath: string | undefined,
  width: number,
  height: number,
  maxPixels: number
): Effect.Effect<number, FaceDetectionError> => {
  const pixels = width * height;

  if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
    return Effect.fail(
      FaceDetectionError.make({
        imagePath: O.fromUndefinedOr(imagePath),
        message: `Face detection ${operation} dimensions exceed the ${maxPixels} pixel safety limit.`,
        operation: "preprocessImage",
      })
    );
  }

  return Effect.succeed(pixels);
};

const fixedInputDimensions = (
  session: OrtSession,
  inputName: string
): Effect.Effect<O.Option<ModelInputDimensions>, FaceDetectionError> => {
  const inputMetadata = pipe(
    session.inputMetadata,
    A.findFirst((metadata) => metadata.name === inputName)
  );

  if (O.isNone(inputMetadata)) {
    return Effect.succeedNone;
  }

  const metadata = inputMetadata.value;

  if (!metadata.isTensor) {
    return Effect.fail(
      FaceDetectionError.make({
        message: `YuNet model input "${inputName}" is not a tensor.`,
        operation: "detect",
      })
    );
  }

  const height = metadata.shape[2];
  const width = metadata.shape[3];

  if (!P.isNumber(height) || !P.isNumber(width) || height < 1 || width < 1) {
    return Effect.succeedNone;
  }

  return checkedPixelCount("model input", undefined, width, height, MAX_FACE_DETECTION_TENSOR_PIXELS).pipe(
    Effect.as(O.some(ModelInputDimensions.make({ height, width })))
  );
};

const preprocessImage = Effect.fn("FaceDetection.preprocessImage")(function* (
  imagePath: string,
  inputDimensions: O.Option<ModelInputDimensions>
): Effect.fn.Return<PreprocessedImage, FaceDetectionError> {
  const metadata = yield* Effect.tryPromise({
    try: () => sharp(imagePath).metadata(),
    catch: (cause) =>
      FaceDetectionError.fromUnknown("preprocessImage", `Failed to read image metadata: "${imagePath}"`, {
        cause,
        imagePath,
      }),
  });

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const imageBytes = metadata.size ?? 0;

  if (width < 1 || height < 1) {
    return yield* FaceDetectionError.make({
      imagePath: O.some(imagePath),
      message: `Image metadata did not return usable dimensions for "${imagePath}"`,
      operation: "preprocessImage",
    });
  }

  if (imageBytes > MAX_FACE_DETECTION_IMAGE_BYTES) {
    return yield* FaceDetectionError.make({
      imagePath: O.some(imagePath),
      message: `Image file exceeds the ${MAX_FACE_DETECTION_IMAGE_BYTES} byte face-detection safety limit.`,
      operation: "preprocessImage",
    });
  }

  yield* checkedPixelCount("source image", imagePath, width, height, MAX_FACE_DETECTION_IMAGE_PIXELS);

  const scale = pipe(
    inputDimensions,
    O.map((dimensions) => Math.min(dimensions.width / width, dimensions.height / height)),
    O.getOrElse(() => 1)
  );
  const padWidth = pipe(
    inputDimensions,
    O.map((dimensions) => dimensions.width),
    O.getOrElse(() => toPaddedDimension(width))
  );
  const padHeight = pipe(
    inputDimensions,
    O.map((dimensions) => dimensions.height),
    O.getOrElse(() => toPaddedDimension(height))
  );
  const resizedWidth = Math.round(width * scale);
  const resizedHeight = Math.round(height * scale);
  const offsetX = O.isSome(inputDimensions) ? (padWidth - resizedWidth) / 2 : 0;
  const offsetY = O.isSome(inputDimensions) ? (padHeight - resizedHeight) / 2 : 0;

  yield* checkedPixelCount("tensor", imagePath, padWidth, padHeight, MAX_FACE_DETECTION_TENSOR_PIXELS);

  const decoded = yield* Effect.tryPromise({
    try: () => {
      let image = sharp(imagePath)
        .rotate()
        .flatten({ background: { b: 0, g: 0, r: 0 } })
        .toColorspace("srgb");

      if (O.isSome(inputDimensions)) {
        image = image.resize({
          background: { b: 0, g: 0, r: 0 },
          fit: "contain",
          height: inputDimensions.value.height,
          width: inputDimensions.value.width,
        });
      }

      return image.raw().toBuffer({ resolveWithObject: true });
    },
    catch: (cause) =>
      FaceDetectionError.fromUnknown("preprocessImage", `Failed to decode image pixels: "${imagePath}"`, {
        cause,
        imagePath,
      }),
  });

  const channels = decoded.info.channels;

  if (decoded.info.width < 1 || decoded.info.height < 1 || channels < 3) {
    return yield* FaceDetectionError.make({
      imagePath: O.some(imagePath),
      message: `Image decode did not return usable RGB pixels for "${imagePath}"`,
      operation: "preprocessImage",
    });
  }

  yield* checkedPixelCount(
    "decoded image",
    imagePath,
    decoded.info.width,
    decoded.info.height,
    MAX_FACE_DETECTION_IMAGE_PIXELS
  );

  const tensorData = new Uint8Array(3 * padWidth * padHeight);

  for (let y = 0; y < decoded.info.height; y += 1) {
    for (let x = 0; x < decoded.info.width; x += 1) {
      const sourceOffset = (y * decoded.info.width + x) * channels;
      const targetOffset = y * padWidth + x;
      tensorData[targetOffset] = decoded.data[sourceOffset + 2] ?? 0;
      tensorData[padWidth * padHeight + targetOffset] = decoded.data[sourceOffset + 1] ?? 0;
      tensorData[2 * padWidth * padHeight + targetOffset] = decoded.data[sourceOffset] ?? 0;
    }
  }

  return PreprocessedImage.make({
    height,
    offsetX,
    offsetY,
    padHeight,
    padWidth,
    scale,
    tensorData,
    width,
  });
});

const makeInputTensor = (ort: Ort, image: PreprocessedImage): OrtTensor =>
  new ort.Tensor("float32", Float32Array.from(image.tensorData), [1, 3, image.padHeight, image.padWidth]);

const tensorData = (tensor: OrtTensor, name: string): Effect.Effect<Float32Array, FaceDetectionError> => {
  if (tensor.data instanceof Float32Array) {
    return Effect.succeed(tensor.data);
  }

  return Effect.fail(
    FaceDetectionError.make({
      message: `YuNet output "${name}" did not return Float32 tensor data.`,
      operation: "postprocess",
    })
  );
};

const outputTensor = (
  outputs: Awaited<ReturnType<OrtSession["run"]>>,
  name: (typeof outputNames)[number]
): Effect.Effect<OrtTensor, FaceDetectionError> =>
  pipe(
    O.fromUndefinedOr(outputs[name]),
    Effect.fromOption(() =>
      FaceDetectionError.make({
        message: `YuNet model output "${name}" was not returned.`,
        operation: "postprocess",
      })
    )
  );

const confidenceScore = (value: number | undefined): RawFaceDetectionConfidence =>
  pipe(
    O.fromUndefinedOr(value),
    O.flatMap(RawFaceDetectionConfidence.decodeUnknownOption),
    O.getOrElse(() => 0)
  );

const faceByConfidenceDescending: Order.Order<RawFaceDetection> = Order.mapInput(
  Order.Number,
  (face: RawFaceDetection) => -face.confidence
);

const intersectionOverUnion = (left: RawFaceDetectionBox, right: RawFaceDetectionBox): number => {
  const leftRight = left.x + left.width;
  const leftBottom = left.y + left.height;
  const rightRight = right.x + right.width;
  const rightBottom = right.y + right.height;
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(leftRight, rightRight);
  const y2 = Math.min(leftBottom, rightBottom);
  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);
  const intersection = width * height;
  const union = left.width * left.height + right.width * right.height - intersection;

  return union <= 0 ? 0 : intersection / union;
};

const suppressOverlappingFaces = (
  faces: ReadonlyArray<RawFaceDetection>,
  nmsThreshold: number,
  topK: number
): ReadonlyArray<RawFaceDetection> => {
  const candidates = pipe(faces, A.sort(faceByConfidenceDescending), A.take(topK));
  let kept = A.empty<RawFaceDetection>();

  for (const candidate of candidates) {
    if (A.every(kept, (face) => intersectionOverUnion(candidate.box, face.box) < nmsThreshold)) {
      kept = A.append(kept, candidate);
    }
  }

  return kept;
};

const point = (x: number, y: number): RawFaceDetectionPoint => RawFaceDetectionPoint.make({ x, y });

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const scalePointToOriginal = (value: RawFaceDetectionPoint, image: PreprocessedImage): FaceDetectionPoint =>
  FaceDetectionPoint.make({
    x: clamp((value.x - image.offsetX) / image.scale, 0, image.width),
    y: clamp((value.y - image.offsetY) / image.scale, 0, image.height),
  });

const scaleFaceToOriginal = (face: RawFaceDetection, image: PreprocessedImage): FaceDetection => {
  const left = clamp((face.box.x - image.offsetX) / image.scale, 0, image.width);
  const top = clamp((face.box.y - image.offsetY) / image.scale, 0, image.height);
  const right = clamp((face.box.x + face.box.width - image.offsetX) / image.scale, 0, image.width);
  const bottom = clamp((face.box.y + face.box.height - image.offsetY) / image.scale, 0, image.height);

  return FaceDetection.make({
    box: FaceDetectionBox.make({
      height: Math.max(0, bottom - top),
      width: Math.max(0, right - left),
      x: left,
      y: top,
    }),
    confidence: face.confidence,
    landmarks: FaceDetectionLandmarks.make({
      leftEye: scalePointToOriginal(face.landmarks.leftEye, image),
      leftMouth: scalePointToOriginal(face.landmarks.leftMouth, image),
      nose: scalePointToOriginal(face.landmarks.nose, image),
      rightEye: scalePointToOriginal(face.landmarks.rightEye, image),
      rightMouth: scalePointToOriginal(face.landmarks.rightMouth, image),
    }),
  });
};

const decodeStrideFaces = Effect.fn("FaceDetection.decodeStrideFaces")(function* (
  outputs: Awaited<ReturnType<OrtSession["run"]>>,
  strideIndex: number,
  image: PreprocessedImage,
  request: FaceDetectionImageRequest
): Effect.fn.Return<ReadonlyArray<RawFaceDetection>, FaceDetectionError> {
  const stride = strides[strideIndex];
  const cols = image.padWidth / stride;
  const rows = image.padHeight / stride;
  const cls = yield* outputTensor(outputs, outputNames[strideIndex]).pipe(
    Effect.flatMap((tensor) => tensorData(tensor, outputNames[strideIndex]))
  );
  const objName = outputNames[strideIndex + strides.length];
  const obj = yield* outputTensor(outputs, objName).pipe(Effect.flatMap((tensor) => tensorData(tensor, objName)));
  const bboxName = outputNames[strideIndex + strides.length * 2];
  const bbox = yield* outputTensor(outputs, bboxName).pipe(Effect.flatMap((tensor) => tensorData(tensor, bboxName)));
  const kpsName = outputNames[strideIndex + strides.length * 3];
  const kps = yield* outputTensor(outputs, kpsName).pipe(Effect.flatMap((tensor) => tensorData(tensor, kpsName)));
  let faces = A.empty<RawFaceDetection>();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const confidence = Math.sqrt(confidenceScore(cls[index]) * confidenceScore(obj[index]));

      if (confidence < request.minConfidence) {
        continue;
      }

      const boxOffset = index * 4;
      const centerX = (col + (bbox[boxOffset] ?? 0)) * stride;
      const centerY = (row + (bbox[boxOffset + 1] ?? 0)) * stride;
      const width = Math.exp(bbox[boxOffset + 2] ?? 0) * stride;
      const height = Math.exp(bbox[boxOffset + 3] ?? 0) * stride;
      const keypointOffset = index * 10;

      faces = A.append(
        faces,
        RawFaceDetection.make({
          box: RawFaceDetectionBox.make({
            height,
            width,
            x: centerX - width / 2,
            y: centerY - height / 2,
          }),
          confidence,
          landmarks: RawFaceDetectionLandmarks.make({
            leftEye: point((kps[keypointOffset + 2] ?? 0) + col, (kps[keypointOffset + 3] ?? 0) + row),
            leftMouth: point((kps[keypointOffset + 8] ?? 0) + col, (kps[keypointOffset + 9] ?? 0) + row),
            nose: point((kps[keypointOffset + 4] ?? 0) + col, (kps[keypointOffset + 5] ?? 0) + row),
            rightEye: point((kps[keypointOffset] ?? 0) + col, (kps[keypointOffset + 1] ?? 0) + row),
            rightMouth: point((kps[keypointOffset + 6] ?? 0) + col, (kps[keypointOffset + 7] ?? 0) + row),
          }),
        })
      );
    }
  }

  return A.map(faces, (face) => {
    const scalePoint = (value: RawFaceDetectionPoint): RawFaceDetectionPoint =>
      RawFaceDetectionPoint.make({ x: value.x * stride, y: value.y * stride });

    return RawFaceDetection.make({
      box: face.box,
      confidence: face.confidence,
      landmarks: RawFaceDetectionLandmarks.make({
        leftEye: scalePoint(face.landmarks.leftEye),
        leftMouth: scalePoint(face.landmarks.leftMouth),
        nose: scalePoint(face.landmarks.nose),
        rightEye: scalePoint(face.landmarks.rightEye),
        rightMouth: scalePoint(face.landmarks.rightMouth),
      }),
    });
  });
});

const postprocess = Effect.fn("FaceDetection.postprocess")(function* (
  outputs: Awaited<ReturnType<OrtSession["run"]>>,
  image: PreprocessedImage,
  request: FaceDetectionImageRequest
): Effect.fn.Return<ReadonlyArray<FaceDetection>, FaceDetectionError> {
  const decoded = yield* Effect.forEach([0, 1, 2], (index) => decodeStrideFaces(outputs, index, image, request), {
    concurrency: 1,
  });
  return pipe(
    suppressOverlappingFaces(A.flatten(decoded), request.nmsThreshold, request.topK),
    A.map((face) => scaleFaceToOriginal(face, image))
  );
});

const makeLoadedDetector = (ort: Ort, session: OrtSession): LoadedFaceDetector => ({
  detect: Effect.fn("LoadedFaceDetector.detect")(function* (request) {
    const validatedRequest = yield* FaceDetectionImageRequest.decodeEffect(request).pipe(
      Effect.mapError(() =>
        FaceDetectionError.make({
          imagePath: O.some(request.imagePath),
          message: "Invalid face detection image request.",
          operation: "detect",
        })
      )
    );
    const inputName = yield* pipe(
      A.head(session.inputNames),
      Effect.fromOption(() =>
        FaceDetectionError.make({
          message: "YuNet model did not expose an input tensor name.",
          operation: "detect",
        })
      )
    );
    const inputDimensions = yield* fixedInputDimensions(session, inputName);
    const image = yield* preprocessImage(validatedRequest.imagePath, inputDimensions);
    const input = makeInputTensor(ort, image);
    const outputs = yield* Effect.tryPromise({
      try: () => session.run({ [inputName]: input }, outputNames),
      catch: (cause) =>
        FaceDetectionError.fromUnknown("detect", `Failed to run ONNX face detection for "${request.imagePath}"`, {
          cause,
          imagePath: request.imagePath,
        }),
    });
    const faces = yield* postprocess(outputs, image, validatedRequest);

    return FaceDetectionResult.make({
      faces,
      height: image.height,
      imagePath: validatedRequest.imagePath,
      width: image.width,
    });
  }),
});

/**
 * Construct the live ONNX Runtime service implementation.
 *
 * **Details**
 *
 * Construction is pure; ONNX Runtime is imported and the model session is
 * opened only when the returned service's `withDetector` method is executed.
 *
 * **Example** (Construct live service)
 *
 * ```ts
 * import { makeFaceDetectionService } from "@beep/face-detection/FaceDetection.service"
 *
 * const service = makeFaceDetectionService()
 * console.log(typeof service.withDetector)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeFaceDetectionService = (): FaceDetectionServiceShape =>
  FaceDetectionService.of({
    withDetector: Effect.fn("FaceDetectionService.withDetector")(function* (config, use) {
      const validatedConfig = yield* FaceDetectionModelConfig.decodeEffect(config).pipe(
        Effect.mapError(() =>
          FaceDetectionError.make({
            message: "Invalid face detection model config.",
            operation: "withDetector",
          })
        )
      );
      const ort = yield* loadOnnxRuntime();
      return yield* Effect.acquireUseRelease(
        loadSession(ort, validatedConfig),
        (session) => use(makeLoadedDetector(ort, session)),
        releaseSession
      );
    }),
  });

/**
 * Run a workflow with a loaded face detector.
 *
 * **Example** (withDetector effect helper)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   FaceDetectionImageRequest,
 *   FaceDetectionModelConfig,
 *   FaceDetectionResult,
 *   FaceDetectionService,
 *   withDetector
 * } from "@beep/face-detection"
 * import type { LoadedFaceDetector } from "@beep/face-detection"
 *
 * const detector: LoadedFaceDetector = {
 *   detect: (request) =>
 *     Effect.succeed(
 *       FaceDetectionResult.make({
 *         faces: [],
 *         height: 480,
 *         imagePath: request.imagePath,
 *         width: 640
 *       })
 *     )
 * }
 * const service = FaceDetectionService.of({
 *   withDetector: (_config, use) => use(detector)
 * })
 * const program = withDetector(
 *   FaceDetectionModelConfig.make({ modelPath: "./yunet.onnx" }),
 *   (loaded) =>
 *     loaded.detect(
 *       FaceDetectionImageRequest.make({
 *         imagePath: "./photo.jpg",
 *         minConfidence: 0.8,
 *         nmsThreshold: 0.3,
 *         topK: 20
 *       })
 *     )
 * )
 *
 * const result = Effect.runSync(Effect.provideService(program, FaceDetectionService, service))
 * console.log(result.imagePath)
 * ```
 *
 * @effects Requires {@link FaceDetectionService} in context. With the live
 * service, each invocation validates the model config, opens an ONNX Runtime
 * session for the callback, and releases the session after the callback exits.
 * @category use-cases
 * @since 0.0.0
 */
export const withDetector: {
  <A, E, R>(
    use: (detector: LoadedFaceDetector) => Effect.Effect<A, E, R>
  ): (config: FaceDetectionModelConfig) => Effect.Effect<A, E | FaceDetectionError, R | FaceDetectionService>;
  <A, E, R>(
    config: FaceDetectionModelConfig,
    use: (detector: LoadedFaceDetector) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | FaceDetectionError, R | FaceDetectionService>;
} = dual(
  2,
  Effect.fn("FaceDetection.withDetector")(function* <A, E, R>(
    config: FaceDetectionModelConfig,
    use: (detector: LoadedFaceDetector) => Effect.Effect<A, E, R>
  ): Effect.fn.Return<A, E | FaceDetectionError, R | FaceDetectionService> {
    const service = yield* FaceDetectionService;
    return yield* service.withDetector(config, use);
  })
);

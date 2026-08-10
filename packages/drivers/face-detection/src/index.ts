/**
 * `@beep/face-detection` ONNX face detection driver package.
 *
 * **Details**
 *
 * This package owns the technical boundary for YuNet-compatible ONNX face
 * detection: model-session loading, image preprocessing, tensor
 * post-processing, and schema-first detection results. Product triage,
 * persistence, and policy decisions belong in downstream packages.
 *
 * **Example** (Create image detection request)
 *
 * ```ts
 * import { FaceDetectionImageRequest } from "@beep/face-detection"
 *
 * const request = FaceDetectionImageRequest.make({
 *   imagePath: "./photo.jpg",
 *   minConfidence: 0.8,
 *   nmsThreshold: 0.3,
 *   topK: 20
 * })
 * console.log(request.minConfidence)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public ONNX face detection driver error exports.
 *
 * **Example** (Construct FaceDetectionError instance)
 *
 * ```ts
 * import { FaceDetectionError } from "@beep/face-detection"
 *
 * const error = FaceDetectionError.make({
 *   message: "model failed",
 *   operation: "loadSession"
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./FaceDetection.errors.ts";
/**
 * Public ONNX face detection driver model exports.
 *
 * **Example** (Make FaceDetectionImageRequest model)
 *
 * ```ts
 * import { FaceDetectionImageRequest } from "@beep/face-detection"
 *
 * const request = FaceDetectionImageRequest.make({
 *   imagePath: "./photo.jpg",
 *   minConfidence: 0.8,
 *   nmsThreshold: 0.3,
 *   topK: 20
 * })
 * console.log(request.topK)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./FaceDetection.models.ts";
/**
 * Public ONNX face detection driver service exports.
 *
 * **Example** (Create face detection service)
 *
 * ```ts
 * import { makeFaceDetectionService } from "@beep/face-detection"
 *
 * const service = makeFaceDetectionService()
 * console.log(typeof service.withDetector)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./FaceDetection.service.ts";

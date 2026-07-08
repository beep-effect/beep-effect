/**
 * Per-file border and face analysis for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FaceDetectionImageRequest } from "@beep/face-detection";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import { FilesCommandError } from "../Files.errors.js";
import { analyzeSolidBorders, classifyBorderSides, roundCandidateMetric } from "../Files.media.js";
import { DetectBordersEntry, DetectFacesEntry } from "../Files.schemas.js";
import { readImagePixelsForBorderDetection } from "./MediaExec.js";
import type { FaceDetection as DetectedFace, LoadedFaceDetector } from "@beep/face-detection";
import type { DetectBordersOptions, DetectFacesFlag, DetectFacesOptions, SortableFile } from "../Files.schemas.js";

/**
 * Analyze a single image for solid border sides.
 *
 * @param file - Selected image file.
 * @param options - Border detection thresholds.
 * @returns Border detection entry for the image.
 * @category analysis
 * @since 0.0.0
 */
export const analyzeDetectBordersFile = Effect.fn("Files.analyzeDetectBordersFile")(function* (
  file: SortableFile,
  options: DetectBordersOptions
): Effect.fn.Return<DetectBordersEntry, FilesCommandError> {
  const pixels = yield* readImagePixelsForBorderDetection(file);
  const sides = analyzeSolidBorders(pixels, options);
  const classification = classifyBorderSides(sides);
  const borderCount = A.length(A.filter(sides, (side) => side.matched));

  return DetectBordersEntry.make({
    borderCount,
    classification,
    extension: file.extension,
    hasBorder: borderCount > 0,
    height: pixels.height,
    sides,
    sourceName: file.name,
    sourcePath: file.sourcePath,
    width: pixels.width,
  });
});

const faceAreaPct = (face: DetectedFace, width: number, height: number): number =>
  roundCandidateMetric((face.box.width * face.box.height * 100) / (width * height));

const faceAtEdge = (face: DetectedFace, width: number, height: number, edgeMarginPct: number): boolean => {
  const xMargin = (width * edgeMarginPct) / 100;
  const yMargin = (height * edgeMarginPct) / 100;
  return (
    face.box.x <= xMargin ||
    face.box.y <= yMargin ||
    face.box.x + face.box.width >= width - xMargin ||
    face.box.y + face.box.height >= height - yMargin
  );
};

const detectFacesFlags = (
  faces: ReadonlyArray<DetectedFace>,
  width: number,
  height: number,
  options: DetectFacesOptions
): ReadonlyArray<DetectFacesFlag> => {
  const primary = A.head(faces);

  if (O.isNone(primary)) {
    return A.of("no-face");
  }

  let flags: ReadonlyArray<DetectFacesFlag> = A.of("has-face");
  const primaryFaceAreaPct = faceAreaPct(primary.value, width, height);

  if (A.length(faces) > 1) {
    flags = A.append(flags, "multiple-faces");
  }

  if (primaryFaceAreaPct < options.minFaceAreaPct) {
    flags = A.append(flags, "face-too-small");
  }

  if (faceAtEdge(primary.value, width, height, options.edgeMarginPct)) {
    flags = A.append(flags, "face-at-edge");
  }

  return flags;
};

/**
 * Analyze a single image with a loaded face detector.
 *
 * @param detector - Loaded detector from the face detection service.
 * @param file - Selected image file.
 * @param options - Face detection thresholds.
 * @returns Face detection entry for the image.
 * @category analysis
 * @since 0.0.0
 */
export const analyzeDetectFacesFile = Effect.fn("Files.analyzeDetectFacesFile")(function* (
  detector: LoadedFaceDetector,
  file: SortableFile,
  options: DetectFacesOptions
): Effect.fn.Return<DetectFacesEntry, FilesCommandError> {
  const result = yield* detector
    .detect(
      FaceDetectionImageRequest.make({
        imagePath: file.sourcePath,
        minConfidence: options.minConfidence,
      })
    )
    .pipe(
      Effect.mapError((cause) =>
        FilesCommandError.make({
          message: cause.message,
          cause,
        })
      )
    );
  const primaryFace = A.head(result.faces);
  const primaryFaceAreaPct = O.map(primaryFace, (face) => faceAreaPct(face, result.width, result.height));
  const primaryFaceFields = O.isSome(primaryFace) ? { primaryFace: primaryFace.value } : {};
  const primaryFaceAreaFields = O.isSome(primaryFaceAreaPct) ? { primaryFaceAreaPct: primaryFaceAreaPct.value } : {};
  const flags = detectFacesFlags(result.faces, result.width, result.height, options);

  return DetectFacesEntry.make({
    extension: file.extension,
    faceCount: A.length(result.faces),
    faces: result.faces,
    flags,
    hasFace: O.isSome(primaryFace),
    height: result.height,
    ...primaryFaceFields,
    ...primaryFaceAreaFields,
    sourceName: file.name,
    sourcePath: file.sourcePath,
    width: result.width,
  });
});

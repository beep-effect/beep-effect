/**
 * Pixel scanning internals for Files border detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Match, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  BorderDetectionMaxScanPercentage,
  BorderDetectionPercentage,
  BorderDetectionTolerance,
  DetectBorderSideMeasurement,
  RgbColor,
} from "../Files.schemas.ts";
import type { BorderDetectionKind, BorderSide } from "../Files.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/BorderDetection");

class RawImagePixelData extends S.Class<RawImagePixelData>($I`RawImagePixelData`)(
  {
    channels: S.Finite,
    data: S.Uint8Array,
    height: S.Finite,
    width: S.Finite,
  },
  $I.annote("RawImagePixelData", {
    description: "Decoded raw image pixels in channel-interleaved byte order.",
  })
) {}

class BorderDetectionThresholds extends S.Class<BorderDetectionThresholds>($I`BorderDetectionThresholds`)(
  {
    maxScanPct: BorderDetectionMaxScanPercentage,
    minSolidPct: BorderDetectionPercentage,
    minWidthPct: BorderDetectionPercentage,
    tolerance: BorderDetectionTolerance,
  },
  $I.annote("BorderDetectionThresholds", {
    description: "Thresholds used while scanning raw image pixels for solid borders.",
  })
) {}

class BorderLineStats extends S.Class<BorderLineStats>($I`BorderLineStats`)(
  {
    averageDistance: S.Finite,
    solidPct: S.Finite,
  },
  $I.annote("BorderLineStats", {
    description: "Per-line border color match metrics.",
  })
) {}

const borderSides: ReadonlyArray<BorderSide> = ["top", "right", "bottom", "left"];

const byteAt = (data: Uint8Array, index: number): number => data[index] ?? 0;

const roundMetric = (value: number): number => Math.round(value * 10_000) / 10_000;

const channelToHex = (channel: number): string => pipe(channel.toString(16), Str.padStart(2, "0"));

const pixelOffset = (image: RawImagePixelData, x: number, y: number): number => (y * image.width + x) * image.channels;

const medianChannel = (values: ReadonlyArray<number>): number =>
  pipe(
    values,
    A.sort(Order.Number),
    A.get(Math.floor(A.length(values) / 2)),
    O.getOrElse(() => 0),
    Math.round
  );

const sampleAxisLength = (image: RawImagePixelData, side: BorderSide): number =>
  side === "left" || side === "right" ? image.width : image.height;

const scanLineLength = (image: RawImagePixelData, side: BorderSide): number =>
  side === "left" || side === "right" ? image.height : image.width;

const borderX = (image: RawImagePixelData, side: BorderSide, axis: number, line: number): number =>
  Match.value(side).pipe(
    Match.when("left", () => axis),
    Match.when("right", () => image.width - 1 - axis),
    Match.orElse(() => line)
  );

const borderY = (image: RawImagePixelData, side: BorderSide, axis: number, line: number): number =>
  Match.value(side).pipe(
    Match.when("top", () => axis),
    Match.when("bottom", () => image.height - 1 - axis),
    Match.orElse(() => line)
  );

const sampleBorderColor = (image: RawImagePixelData, side: BorderSide, sampleWidth: number): RgbColor => {
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const axisLimit = Math.min(sampleWidth, sampleAxisLength(image, side));
  const lineLimit = scanLineLength(image, side);

  for (let axis = 0; axis < axisLimit; axis += 1) {
    for (let line = 0; line < lineLimit; line += 1) {
      const x = borderX(image, side, axis, line);
      const y = borderY(image, side, axis, line);
      const offset = pixelOffset(image, x, y);

      A.appendInPlace(red, byteAt(image.data, offset));
      A.appendInPlace(green, byteAt(image.data, offset + 1));
      A.appendInPlace(blue, byteAt(image.data, offset + 2));
    }
  }

  return RgbColor.make({
    b: medianChannel(blue),
    g: medianChannel(green),
    r: medianChannel(red),
  });
};

const borderLineStats = (
  image: RawImagePixelData,
  side: BorderSide,
  offsetFromEdge: number,
  edgeColor: RgbColor,
  tolerance: BorderDetectionTolerance
): BorderLineStats => {
  const length = scanLineLength(image, side);
  let matched = 0;
  let distanceSum = 0;

  for (let line = 0; line < length; line += 1) {
    const x = borderX(image, side, offsetFromEdge, line);
    const y = borderY(image, side, offsetFromEdge, line);
    const pixel = pixelOffset(image, x, y);
    const distance = Math.max(
      Math.abs(byteAt(image.data, pixel) - edgeColor.r),
      Math.abs(byteAt(image.data, pixel + 1) - edgeColor.g),
      Math.abs(byteAt(image.data, pixel + 2) - edgeColor.b)
    );

    if (distance <= tolerance) {
      matched += 1;
    }
    distanceSum += distance;
  }

  return BorderLineStats.make({
    averageDistance: distanceSum / length,
    solidPct: (matched / length) * 100,
  });
};

const scanBorderSide = (
  image: RawImagePixelData,
  side: BorderSide,
  thresholds: BorderDetectionThresholds
): DetectBorderSideMeasurement => {
  const axisLength = sampleAxisLength(image, side);
  const minWidthPx = Math.max(1, Math.ceil((axisLength * thresholds.minWidthPct) / 100));
  const maxScanPx = Math.max(1, Math.floor((axisLength * thresholds.maxScanPct) / 100));
  const edgeColor = sampleBorderColor(image, side, 5);
  let acceptedWidth = 0;
  let score = 1;

  for (let offset = 0; offset < maxScanPx; offset += 1) {
    const stats = borderLineStats(image, side, offset, edgeColor, thresholds.tolerance);
    const withinAverageDistance =
      thresholds.tolerance === 0 ? stats.averageDistance === 0 : stats.averageDistance <= thresholds.tolerance / 2;

    if (stats.solidPct < thresholds.minSolidPct || !withinAverageDistance) {
      break;
    }

    acceptedWidth = offset + 1;
    score = Math.min(score, stats.solidPct / 100);
  }

  const matched = acceptedWidth >= minWidthPx;
  const widthPx = matched ? acceptedWidth : 0;

  return DetectBorderSideMeasurement.make({
    color: edgeColor,
    colorHex: rgbToHex(edgeColor),
    matched,
    score: matched ? roundMetric(score) : 0,
    side,
    widthPct: matched ? roundMetric((widthPx / axisLength) * 100) : 0,
    widthPx,
  });
};

/**
 * Render an RGB color as a lowercase hexadecimal color.
 *
 * @param color - RGB color to render.
 * @returns Hex color string in `#rrggbb` format.
 * @example
 * ```ts
 * import { rgbToHex } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof rgbToHex = rgbToHex
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const rgbToHex = (color: RgbColor): string =>
  `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;

/**
 * Classify an analyzed image from its matched border sides.
 *
 * @param sides - Per-side border measurements.
 * @returns Border layout classification.
 * @example
 * ```ts
 * import { classifyBorderSides } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof classifyBorderSides = classifyBorderSides
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const classifyBorderSides = (sides: ReadonlyArray<DetectBorderSideMeasurement>): BorderDetectionKind => {
  const matched = A.filter(sides, (side) => side.matched);
  const count = A.length(matched);
  const hasSide = (side: BorderSide): boolean =>
    pipe(
      sides,
      A.findFirst((entry) => entry.side === side),
      O.exists((entry) => entry.matched)
    );
  const top = hasSide("top");
  const right = hasSide("right");
  const bottom = hasSide("bottom");
  const left = hasSide("left");

  if (count === 0) {
    return "none";
  }

  if (top && right && bottom && left) {
    return "frame";
  }

  if (left && right && !top && !bottom) {
    return "pillarbox";
  }

  if (top && bottom && !left && !right) {
    return "letterbox";
  }

  if (count === 1) {
    return "canvas-edge";
  }

  return "mixed";
};

/**
 * Analyze raw RGB image pixels for near-solid borders on all four sides.
 *
 * @param image - Raw image pixel data in RGB channel order.
 * @param thresholds - Detection thresholds.
 * @returns Per-side border measurements in top/right/bottom/left order.
 * @example
 * ```ts
 * import { analyzeSolidBorders } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof analyzeSolidBorders = analyzeSolidBorders
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const analyzeSolidBorders: {
  (thresholds: BorderDetectionThresholds): (image: RawImagePixelData) => ReadonlyArray<DetectBorderSideMeasurement>;
  (image: RawImagePixelData, thresholds: BorderDetectionThresholds): ReadonlyArray<DetectBorderSideMeasurement>;
} = dual(
  2,
  (image: RawImagePixelData, thresholds: BorderDetectionThresholds): ReadonlyArray<DetectBorderSideMeasurement> => {
    const rawImage = RawImagePixelData.make(image);
    const detectionThresholds = BorderDetectionThresholds.make(thresholds);
    return A.map(borderSides, (side) => scanBorderSide(rawImage, side, detectionThresholds));
  }
);

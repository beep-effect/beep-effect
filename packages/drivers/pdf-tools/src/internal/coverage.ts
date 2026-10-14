/**
 * Private raster ink-coverage comparison between two binary PPM (P6) pages:
 * how much of the base page's ink the marked page's (dilated) ink covers.
 *
 * @internal
 */

import { InkCoverage } from "../PdfTools.models.ts";
import { parseP6Header } from "./ppm.ts";

type InkMask = {
  readonly width: number;
  readonly height: number;
  readonly ink: Uint8Array;
  readonly count: number;
};

// Rec. 601 luma, integer arithmetic; the same ink rule as page measurement.
const isInk = (bytes: Uint8Array, i: number, blackThreshold: number): boolean =>
  ((bytes[i] ?? 0) * 299 + (bytes[i + 1] ?? 0) * 587 + (bytes[i + 2] ?? 0) * 114) / 1000 <= blackThreshold;

// One byte per pixel: 1 where the pixel is ink.
const inkMask = (options: { readonly bytes: Uint8Array; readonly blackThreshold: number }): InkMask => {
  const { bytes, blackThreshold } = options;
  const { width, height, offset } = parseP6Header(bytes);
  const ink = new Uint8Array(width * height);
  let count = 0;
  for (let p = 0; p < width * height; p += 1) {
    if (isInk(bytes, offset + p * 3, blackThreshold)) {
      ink[p] = 1;
      count += 1;
    }
  }
  return { width, height, ink, count };
};

// Marks the run of `out` an ink pixel at (x, y) grows into along one axis.
type RunMarker = (out: Uint8Array, mask: InkMask, x: number, y: number, radius: number) => void;

// Inclusive [from, to] of the (2r+1)-wide run around `centre`, clipped to [0, extent).
const runAround = (centre: number, radius: number, extent: number): readonly [number, number] => [
  Math.max(0, centre - radius),
  Math.min(extent - 1, centre + radius),
];

const markRowRun: RunMarker = (out, mask, x, y, radius) => {
  const [from, to] = runAround(x, radius, mask.width);
  out.fill(1, y * mask.width + from, y * mask.width + to + 1);
};

const markColumnRun: RunMarker = (out, mask, x, y, radius) => {
  const [from, to] = runAround(y, radius, mask.height);
  for (let t = from; t <= to; t += 1) {
    out[t * mask.width + x] = 1;
  }
};

// One separable pass of a square dilation: every ink pixel marks its run.
const dilatePass = (mask: InkMask, radius: number, markRun: RunMarker): Uint8Array => {
  const out = new Uint8Array(mask.width * mask.height);
  for (let p = 0; p < mask.width * mask.height; p += 1) {
    if (mask.ink[p] === 1) {
      markRun(out, mask, p % mask.width, Math.floor(p / mask.width), radius);
    }
  }
  return out;
};

// Grow every ink pixel into a (2r+1)-pixel square.
const dilate = (options: { readonly mask: InkMask; readonly radius: number }): InkMask => {
  const { mask, radius } = options;
  if (radius <= 0) {
    return mask;
  }
  const rows = dilatePass(mask, radius, markRowRun);
  const ink = dilatePass({ ...mask, ink: rows }, radius, markColumnRun);
  return { ...mask, ink };
};

/**
 * Compare two P6 rasters with zero offset from the top-left corner. Base ink
 * outside the marked raster's extent counts as uncovered.
 *
 * @internal
 */
export const inkCoverageOf = (options: {
  readonly base: Uint8Array;
  readonly marked: Uint8Array;
  readonly dilatePx: number;
  readonly blackThreshold: number;
}): InkCoverage => {
  const base = inkMask({ bytes: options.base, blackThreshold: options.blackThreshold });
  const markedInk = inkMask({ bytes: options.marked, blackThreshold: options.blackThreshold });
  const marked = dilate({ mask: markedInk, radius: options.dilatePx });
  let covered = 0;
  for (let y = 0; y < base.height; y += 1) {
    for (let x = 0; x < base.width; x += 1) {
      if (
        base.ink[y * base.width + x] === 1 &&
        x < marked.width &&
        y < marked.height &&
        marked.ink[y * marked.width + x] === 1
      ) {
        covered += 1;
      }
    }
  }
  return InkCoverage.make({
    baseInkPixels: base.count,
    coveredPixels: covered,
    markedInkPixels: markedInk.count,
    coverage: base.count === 0 ? 0 : covered / base.count,
  });
};

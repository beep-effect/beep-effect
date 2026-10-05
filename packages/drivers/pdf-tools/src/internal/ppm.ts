/**
 * Private binary PPM (P6) decoding and page measurement.
 *
 * @internal
 */

import { O } from "@beep/utils";
import { PdfToolsError } from "../PdfTools.errors.ts";
import { PixelBox, RasterMetrics } from "../PdfTools.models.ts";

const SPACE = 0x20;
const NEWLINE = 0x0a;
const HASH = 0x23;

const isWhitespace = (byte: number): boolean => byte === SPACE || byte === NEWLINE || byte === 0x0d || byte === 0x09;

/**
 * Parse the P6 header: `P6 <width> <height> <maxval>` with optional `#`
 * comments, then one whitespace byte before the pixel data.
 *
 * @internal
 */
export const parseP6Header = (
  bytes: Uint8Array
): { readonly width: number; readonly height: number; readonly offset: number } => {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x36) {
    throw PdfToolsError.make({ reason: "parse", message: "Expected a binary PPM (P6) header." });
  }
  let offset = 2;
  const fields: Array<number> = [];
  while (fields.length < 3) {
    while (offset < bytes.length && isWhitespace(bytes[offset]!)) {
      offset += 1;
    }
    if (bytes[offset] === HASH) {
      while (offset < bytes.length && bytes[offset] !== NEWLINE) {
        offset += 1;
      }
      continue;
    }
    let value = 0;
    let digits = 0;
    while (offset < bytes.length && bytes[offset]! >= 0x30 && bytes[offset]! <= 0x39) {
      value = value * 10 + (bytes[offset]! - 0x30);
      offset += 1;
      digits += 1;
    }
    if (digits === 0) {
      throw PdfToolsError.make({ reason: "parse", message: "Malformed PPM header." });
    }
    fields.push(value);
  }
  if (fields[2] !== 255) {
    throw PdfToolsError.make({ reason: "parse", message: `Unsupported PPM maxval ${fields[2]}; expected 255.` });
  }
  // Exactly one whitespace byte separates the header from the raster.
  offset += 1;
  const width = fields[0]!;
  const height = fields[1]!;
  if (bytes.length < offset + width * height * 3) {
    throw PdfToolsError.make({ reason: "parse", message: "PPM raster is shorter than its header declares." });
  }
  return { width, height, offset };
};

/**
 * Measure ink bounds, purity, and the largest all-ink square of a P6 raster.
 *
 * @internal
 */
export const measureP6 = (options: {
  readonly bytes: Uint8Array;
  readonly dpi: number;
  readonly blackThreshold: number;
}): RasterMetrics => {
  const { bytes, dpi, blackThreshold } = options;
  const { width, height, offset } = parseP6Header(bytes);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;
  let impurePixels = 0;
  let chromaPixels = 0;
  let largest = 0;
  // Dynamic-programming rows for the largest all-ink square ending at (x, y).
  let previous = new Uint16Array(width + 1);
  let current = new Uint16Array(width + 1);
  for (let y = 0; y < height; y += 1) {
    const rowStart = offset + y * width * 3;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + x * 3;
      const r = bytes[i]!;
      const g = bytes[i + 1]!;
      const b = bytes[i + 2]!;
      if (r !== g || g !== b) {
        chromaPixels += 1;
        impurePixels += 1;
      } else if (r !== 0 && r !== 255) {
        impurePixels += 1;
      }
      // Rec. 601 luma, integer arithmetic.
      const luma = (r * 299 + g * 587 + b * 114) / 1000;
      if (luma <= blackThreshold) {
        inkPixels += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const side = Math.min(previous[x]!, previous[x + 1]!, current[x]!) + 1;
        current[x + 1] = side;
        if (side > largest) largest = side;
      } else {
        current[x + 1] = 0;
      }
    }
    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }
  return RasterMetrics.make({
    width,
    height,
    dpi,
    inkBox: maxX < 0 ? O.none() : O.some(PixelBox.make({ minX, minY, maxX, maxY })),
    inkPixels,
    impurePixels,
    chromaPixels,
    largestBlackSquare: largest,
  });
};

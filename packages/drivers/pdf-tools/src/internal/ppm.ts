/**
 * Private binary PPM (P6) decoding and page measurement.
 *
 * @internal
 */

import { O } from "@beep/utils";
import { PdfToolsError } from "../PdfTools.errors.ts";
import { PixelBox, RasterMetrics } from "../PdfTools.models.ts";

const HASH = 0x23;
const NEWLINE = 0x0a;
const ZERO = 0x30;
const NINE = 0x39;

const parseError = (message: string): PdfToolsError => PdfToolsError.make({ reason: "parse", message });

const isWhitespace = (byte: number): boolean => byte === 0x20 || byte === NEWLINE || byte === 0x0d || byte === 0x09;

const isDigit = (byte: number): boolean => byte >= ZERO && byte <= NINE;

const skipComment = (bytes: Uint8Array, start: number): number => {
  let offset = start;
  while (offset < bytes.length && bytes[offset] !== NEWLINE) {
    offset += 1;
  }
  return offset;
};

// Advance past whitespace and `#` comments; return the first byte of the next token.
const skipBlank = (bytes: Uint8Array, start: number): number => {
  let offset = start;
  while (offset < bytes.length) {
    const byte = bytes[offset] ?? 0;
    if (!isWhitespace(byte) && byte !== HASH) {
      return offset;
    }
    offset = byte === HASH ? skipComment(bytes, offset) : offset + 1;
  }
  return offset;
};

const readNumber = (bytes: Uint8Array, start: number): { readonly value: number; readonly next: number } => {
  let offset = start;
  let value = 0;
  while (offset < bytes.length && isDigit(bytes[offset] ?? 0)) {
    value = value * 10 + ((bytes[offset] ?? 0) - ZERO);
    offset += 1;
  }
  if (offset === start) {
    throw parseError("Malformed PPM header.");
  }
  return { value, next: offset };
};

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
    throw parseError("Expected a binary PPM (P6) header.");
  }
  const width = readNumber(bytes, skipBlank(bytes, 2));
  const height = readNumber(bytes, skipBlank(bytes, width.next));
  const maxval = readNumber(bytes, skipBlank(bytes, height.next));
  if (maxval.value !== 255) {
    throw parseError(`Unsupported PPM maxval ${maxval.value}; expected 255.`);
  }
  // Exactly one whitespace byte separates the header from the raster.
  const offset = maxval.next + 1;
  if (bytes.length < offset + width.value * height.value * 3) {
    throw parseError("PPM raster is shorter than its header declares.");
  }
  return { width: width.value, height: height.value, offset };
};

// Rec. 601 luma, integer arithmetic.
const luma = (r: number, g: number, b: number): number => (r * 299 + g * 587 + b * 114) / 1000;

// Running measurements over one raster; mutated per pixel for speed.
class Tally {
  minX: number;
  minY: number;
  maxX = -1;
  maxY = -1;
  inkPixels = 0;
  impurePixels = 0;
  chromaPixels = 0;
  largest = 0;

  constructor(width: number, height: number) {
    this.minX = width;
    this.minY = height;
  }

  purity(r: number, g: number, b: number): void {
    if (r !== g || g !== b) {
      this.chromaPixels += 1;
      this.impurePixels += 1;
    } else if (r !== 0 && r !== 255) {
      this.impurePixels += 1;
    }
  }

  ink(x: number, y: number, side: number): void {
    this.inkPixels += 1;
    this.minX = Math.min(this.minX, x);
    this.maxX = Math.max(this.maxX, x);
    this.minY = Math.min(this.minY, y);
    this.maxY = Math.max(this.maxY, y);
    this.largest = Math.max(this.largest, side);
  }
}

// Side of the largest all-ink square ending at column x, from the previous row's values.
const squareSide = (previous: Uint16Array, current: Uint16Array, x: number): number =>
  Math.min(previous[x] ?? 0, previous[x + 1] ?? 0, current[x] ?? 0) + 1;

// Measure one pixel: purity always, ink bounds and square when dark enough.
const measurePixel = (row: RowScan, x: number): void => {
  const i = row.rowStart + x * 3;
  const r = row.bytes[i] ?? 0;
  const g = row.bytes[i + 1] ?? 0;
  const b = row.bytes[i + 2] ?? 0;
  row.tally.purity(r, g, b);
  const side = luma(r, g, b) <= row.blackThreshold ? squareSide(row.previous, row.current, x) : 0;
  row.current[x + 1] = side;
  if (side > 0) {
    row.tally.ink(x, row.y, side);
  }
};

type RowScan = {
  readonly bytes: Uint8Array;
  readonly rowStart: number;
  readonly y: number;
  readonly previous: Uint16Array;
  readonly current: Uint16Array;
  readonly tally: Tally;
  readonly blackThreshold: number;
};

const measureRow = (row: RowScan): void => {
  const width = row.current.length - 1;
  for (let x = 0; x < width; x += 1) {
    measurePixel(row, x);
  }
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
  const tally = new Tally(width, height);
  let previous = new Uint16Array(width + 1);
  let current = new Uint16Array(width + 1);
  for (let y = 0; y < height; y += 1) {
    measureRow({ bytes, rowStart: offset + y * width * 3, y, previous, current, tally, blackThreshold });
    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }
  return RasterMetrics.make({
    width,
    height,
    dpi,
    inkBox:
      tally.maxX < 0
        ? O.none()
        : O.some(PixelBox.make({ minX: tally.minX, minY: tally.minY, maxX: tally.maxX, maxY: tally.maxY })),
    inkPixels: tally.inkPixels,
    impurePixels: tally.impurePixels,
    chromaPixels: tally.chromaPixels,
    largestBlackSquare: tally.largest,
  });
};

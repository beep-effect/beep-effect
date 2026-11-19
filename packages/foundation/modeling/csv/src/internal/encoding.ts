// From bytes to text. A byte-order mark names UTF-8 or UTF-16; otherwise valid UTF-8 is UTF-8 and anything else is
// read as Windows-1252, the encoding Excel writes "CSV (Comma delimited)" in, as the app's old reader did. UTF-8 is
// validated here, so the first invalid byte has an offset; `TextDecoder` with `fatal` would only throw.
import * as O from "effect/Option";
import { CsvEncodingFallback, CsvEncodingFromBom, CsvEncodingValidUtf8 } from "../CsvRead.schema.ts";
import type { CsvEncodingName } from "../CsvOptions.schema.ts";

// crispen: kept as loops — it walks the bytes once and stops at the first invalid one, decoding each sequence's code
// point to refuse overlong forms and surrogates; no Effect module validates UTF-8 with an offset.

/** Continuation bytes after each lead byte; 0 for a byte that cannot lead a multi-byte sequence. */
const CONTINUATIONS = new Uint8Array(256);
CONTINUATIONS.fill(1, 0xc2, 0xe0);
CONTINUATIONS.fill(2, 0xe0, 0xf0);
CONTINUATIONS.fill(3, 0xf0, 0xf5);
/** The lead byte's payload bits, by continuation count. */
const LEAD_MASK = [0, 0x1f, 0x0f, 0x07];
/** The smallest code point each sequence length may carry; below it the form is overlong. */
const MIN_CODE = [0, 0x80, 0x800, 0x10000];

/** The code point of the `need` continuation bytes after a lead at `i`, or -1 when one is not a continuation. */
const codePointAt = (bytes: Uint8Array, i: number, need: number): number => {
  let code = (bytes[i] ?? 0) & (LEAD_MASK[need] ?? 0);
  for (let k = 1; k <= need; k += 1) {
    const c = bytes[i + k] ?? 0;
    if ((c & 0xc0) !== 0x80) return -1;
    code = (code << 6) | (c & 0x3f);
  }
  return code;
};

/** Whether `code` is a Unicode scalar value in its shortest form for a sequence of `need` continuations. */
const isShortestScalar = (code: number, need: number): boolean =>
  code >= (MIN_CODE[need] ?? 0) && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);

/** Where the multi-byte sequence led at `i` ends, or -1 when it is not valid UTF-8. */
const sequenceEnd = (bytes: Uint8Array, i: number): number => {
  const need = CONTINUATIONS[bytes[i] ?? 0] ?? 0;
  if (need === 0 || i + need >= bytes.length) return -1;
  return isShortestScalar(codePointAt(bytes, i, need), need) ? i + need + 1 : -1;
};

/** The offset of the first byte that breaks UTF-8, or none when all of `bytes` is valid UTF-8. */
export const firstInvalidUtf8 = (bytes: Uint8Array): O.Option<number> => {
  let i = 0;
  while (i < bytes.length) {
    const next = (bytes[i] ?? 0) < 0x80 ? i + 1 : sequenceEnd(bytes, i);
    if (next < 0) return O.some(i);
    i = next;
  }
  return O.none();
};

/** Which byte-order mark the bytes start with. */
export const bomOf = (bytes: Uint8Array): O.Option<"utf-8" | "utf-16le" | "utf-16be"> => {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return O.some("utf-8");
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return O.some("utf-16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return O.some("utf-16be");
  return O.none();
};

/** How a detected encoding was found: by the rule above. */
export type DetectedEncoding = CsvEncodingFromBom | CsvEncodingValidUtf8 | CsvEncodingFallback;

/**
 * The encoding the bytes are read in when it is detected: a byte-order mark names UTF-8 or UTF-16; otherwise the
 * first `checked` bytes (all of them when left out) are UTF-8 when valid, and Windows-1252 when not.
 */
export const detectEncoding = (input: { readonly bytes: Uint8Array; readonly checked?: number }): DetectedEncoding => {
  const { bytes, checked = bytes.length } = input;
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") return CsvEncodingFromBom.make({ encoding: mark.value });
  return O.match(firstInvalidUtf8(bytes.subarray(0, checked)), {
    onSome: (firstInvalidByte): DetectedEncoding => CsvEncodingFallback.make({ firstInvalidByte }),
    onNone: () => (O.isSome(mark) ? CsvEncodingFromBom.make({ encoding: "utf-8" }) : CsvEncodingValidUtf8.make({})),
  });
};

/**
 * A decoder that keeps every U+FEFF it decodes. `TextDecoder` drops a leading one by default, and a stream decodes
 * piece by piece, so the default would drop a U+FEFF that starts a piece of cell data. The one byte-order mark at the
 * start of the input is stripped from the text instead, once, by the reader.
 */
export const decoderFor = (encoding: CsvEncodingName): TextDecoder => new TextDecoder(encoding, { ignoreBOM: true });

/** Decodes bytes in an encoding, keeping a leading byte-order mark as text (see `decoderFor`). */
export const decodeBytes = (input: { readonly bytes: Uint8Array; readonly encoding: CsvEncodingName }): string =>
  decoderFor(input.encoding).decode(input.bytes);

const encoder = new TextEncoder();

/** UTF-8 bytes of a text. */
export const encodeUtf8 = (text: string): Uint8Array => encoder.encode(text);

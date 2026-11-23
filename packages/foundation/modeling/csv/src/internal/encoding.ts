// decision: utf8-validated-with-offset
import * as O from "effect/Option";
import { CsvEncodingFallback, CsvEncodingFromBom, CsvEncodingValidUtf8 } from "../CsvRead.schema.ts";
import type { CsvEncodingName } from "../CsvOptions.schema.ts";

// decision: imperative-engine-loops

const NOT_A_LEAD_BYTE = 0;
const CONTINUATIONS_AFTER_LEAD = new Uint8Array(256).fill(NOT_A_LEAD_BYTE);
CONTINUATIONS_AFTER_LEAD.fill(1, 0xc2, 0xe0);
CONTINUATIONS_AFTER_LEAD.fill(2, 0xe0, 0xf0);
CONTINUATIONS_AFTER_LEAD.fill(3, 0xf0, 0xf5);
const LEAD_PAYLOAD_MASK_BY_CONTINUATIONS = [0, 0x1f, 0x0f, 0x07];
const OVERLONG_BELOW_BY_CONTINUATIONS = [0, 0x80, 0x800, 0x10000];
const INVALID_SEQUENCE = -1;

const codePointAt = (bytes: Uint8Array, i: number, need: number): number => {
  let code = (bytes[i] ?? 0) & (LEAD_PAYLOAD_MASK_BY_CONTINUATIONS[need] ?? 0);
  for (let k = 1; k <= need; k += 1) {
    const c = bytes[i + k] ?? 0;
    if ((c & 0xc0) !== 0x80) return INVALID_SEQUENCE;
    code = (code << 6) | (c & 0x3f);
  }
  return code;
};

const isShortestScalar = (code: number, need: number): boolean =>
  code >= (OVERLONG_BELOW_BY_CONTINUATIONS[need] ?? 0) && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);

const sequenceEnd = (bytes: Uint8Array, i: number): number => {
  const need = CONTINUATIONS_AFTER_LEAD[bytes[i] ?? 0] ?? NOT_A_LEAD_BYTE;
  if (need === NOT_A_LEAD_BYTE || i + need >= bytes.length) return INVALID_SEQUENCE;
  return isShortestScalar(codePointAt(bytes, i, need), need) ? i + need + 1 : INVALID_SEQUENCE;
};

/** The offset of the first byte that breaks UTF-8, or none when all of `bytes` is valid UTF-8. */
export const firstInvalidUtf8 = (bytes: Uint8Array): O.Option<number> => {
  let i = 0;
  while (i < bytes.length) {
    const next = (bytes[i] ?? 0) < 0x80 ? i + 1 : sequenceEnd(bytes, i);
    if (next === INVALID_SEQUENCE) return O.some(i);
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
 * bytes are UTF-8 unless a UTF-8 sequence that starts before `within` (all of them when left out) is invalid, and
 * Windows-1252 when one is. A sequence that starts before `within` is checked to its end, past `within` too.
 */
export const detectEncoding = (input: { readonly bytes: Uint8Array; readonly within?: number }): DetectedEncoding => {
  const { bytes, within = bytes.length } = input;
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") return CsvEncodingFromBom.make({ encoding: mark.value });
  return O.match(
    O.filter(firstInvalidUtf8(bytes), (offset) => offset < within),
    {
      onSome: (firstInvalidByte): DetectedEncoding => CsvEncodingFallback.make({ firstInvalidByte }),
      onNone: () => (O.isSome(mark) ? CsvEncodingFromBom.make({ encoding: "utf-8" }) : CsvEncodingValidUtf8.make({})),
    }
  );
};

/**
 * A decoder that keeps every U+FEFF it decodes. A UTF decoder drops a leading one by default, and a stream decodes
 * piece by piece, so the default would drop a U+FEFF that starts a piece of cell data. The one byte-order mark at the
 * start of the input is stripped from the text instead, once, by the reader. Windows-1252 has no byte-order mark, so
 * its decoder is not asked to keep one: Node 22's whole-buffer Windows-1252 decoder, asked to, drops a leading 0xFF.
 */
export const decoderFor = (encoding: CsvEncodingName): TextDecoder =>
  new TextDecoder(encoding, { ignoreBOM: encoding !== "windows-1252" });

/** Decodes bytes in an encoding, keeping a leading byte-order mark as text (see `decoderFor`). */
export const decodeBytes = (input: { readonly bytes: Uint8Array; readonly encoding: CsvEncodingName }): string =>
  decoderFor(input.encoding).decode(input.bytes);

const encoder = new TextEncoder();

/** UTF-8 bytes of a text. */
export const encodeUtf8 = (text: string): Uint8Array => encoder.encode(text);

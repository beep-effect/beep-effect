// From bytes to text. A byte-order mark names UTF-8 or UTF-16; otherwise valid UTF-8 is UTF-8 and anything else is
// read as Windows-1252, the encoding Excel writes "CSV (Comma delimited)" in, as the app's old reader did. UTF-8 is
// validated here, so the first invalid byte has an offset; `TextDecoder` with `fatal` would only throw.
import * as O from "effect/Option";
import type { CsvEncodingName } from "../CsvOptions.schema.ts";

/** The offset of the first byte that breaks UTF-8, or none when all of `bytes` is valid UTF-8. */
export const firstInvalidUtf8 = (bytes: Uint8Array): O.Option<number> => {
  const length = bytes.length;
  let i = 0;
  while (i < length) {
    const b = bytes[i] ?? 0;
    if (b < 0x80) {
      i += 1;
      continue;
    }
    let need = 0;
    let min = 0;
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      min = 0x10000;
    } else return O.some(i);
    if (i + need >= length) return O.some(i);
    let code = b & (need === 1 ? 0x1f : need === 2 ? 0x0f : 0x07);
    for (let k = 1; k <= need; k += 1) {
      const c = bytes[i + k] ?? 0;
      if ((c & 0xc0) !== 0x80) return O.some(i);
      code = (code << 6) | (c & 0x3f);
    }
    if (code < min || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return O.some(i);
    i += need + 1;
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

/** Decodes bytes in an encoding; a leading byte-order mark of that encoding is dropped. */
export const decodeBytes = (input: { readonly bytes: Uint8Array; readonly encoding: CsvEncodingName }): string =>
  new TextDecoder(input.encoding).decode(input.bytes);

const encoder = new TextEncoder();

/** UTF-8 bytes of a text. */
export const encodeUtf8 = (text: string): Uint8Array => encoder.encode(text);

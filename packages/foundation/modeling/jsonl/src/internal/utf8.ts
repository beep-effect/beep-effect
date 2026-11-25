/**
 * UTF-8 byte counts for JSONL string records.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "effect/Option";
import * as Str from "effect/String";

const codeUnitAt = (text: string, index: number): number => O.getOrThrow(Str.charCodeAt(text, index));

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

const pairsWithNext = (text: string, index: number): boolean =>
  index + 1 < Str.length(text) && isLowSurrogate(codeUnitAt(text, index + 1));

const SURROGATE_PAIR_CODE_POINT_BYTES = 4;

const unitBytes = (code: number): number => {
  if (code < 0x80) return 1;
  return code < 0x800 ? 2 : 3;
};

/**
 * The UTF-8 byte length of a JavaScript string.
 *
 * **Details**
 *
 * Journal offsets are **bytes**, because that is what `FileSystem.stream`'s
 * `offset` option and every persisted cursor mean. `String.length` counts
 * UTF-16 code units and is wrong for every non-ASCII journal: `"\u{1F600}"` has
 * length 2 and occupies 4 bytes.
 *
 * Matches `TextEncoder#encode(...).length` exactly, including the WHATWG rule
 * that an unpaired surrogate encodes as U+FFFD (3 bytes), without allocating
 * a buffer per call. The scan uses constant auxiliary space.
 *
 * **Example** (Measure an astral character)
 *
 * ```ts import.meta.vitest name="Measure an astral character"
 * import { utf8Length } from "@beep/jsonl/internal/utf8";
 * utf8Length("😀") // => 4
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const utf8Length = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < Str.length(text); index++) {
    const code = codeUnitAt(text, index);
    const startsSurrogatePair = isHighSurrogate(code) && pairsWithNext(text, index);
    if (startsSurrogatePair) {
      bytes += SURROGATE_PAIR_CODE_POINT_BYTES;
      index++;
    } else {
      bytes += unitBytes(code);
    }
  }
  return bytes;
};

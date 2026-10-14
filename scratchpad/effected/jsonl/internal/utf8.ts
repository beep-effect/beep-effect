/**
 * UTF-8 byte counts for JSONL string records.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "effect/Option";
import * as Str from "effect/String";

// UTF-8 byte accounting.
//
// Keep this leaf independent of the line splitter and error taxonomy so both
// can measure bytes without importing each other.

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
 * import { utf8Length } from "@beep/scratchpad/effected/jsonl/internal/utf8";
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
    const code = O.getOrThrow(Str.charCodeAt(text, index));
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: a valid pair is one 4-byte code point; an unpaired
      // one is replaced with U+FFFD, which is 3 bytes.
      const next = index + 1 < Str.length(text) ? O.getOrThrow(Str.charCodeAt(text, index + 1)) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index++;
      } else {
        bytes += 3;
      }
    } else {
      // Low surrogates reaching here are unpaired, and encode as U+FFFD too.
      bytes += 3;
    }
  }
  return bytes;
};
